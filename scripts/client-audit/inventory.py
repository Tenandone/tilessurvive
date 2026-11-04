"""Local source/package inventory. Writes only private audit artifacts."""
import argparse,collections,hashlib,json,os,sqlite3,stat,struct,time,zipfile
from pathlib import Path

MAGIC_CFG=b'\x1bCFG'
def kind(head,name):
 if head.startswith(MAGIC_CFG):return 'CFG'
 if head.startswith(b'PK\x03\x04'):return 'ZIP'
 if head.startswith(b'\x7fELF'):return 'ELF_NATIVE'
 if head.startswith(b'\x89PNG'):return 'PNG'
 if head.startswith(b'RIFF') and head[8:12]==b'WEBP':return 'WEBP'
 if b'UnityFS\0' in head:return 'UNITYFS_WRAPPED' if head.find(b'UnityFS\0') else 'UNITYFS'
 if name.endswith('.jsonl'):return 'JSONL'
 if name.endswith('.json'):return 'JSON'
 return 'UNDETERMINED'

def fingerprint(file):
 h=hashlib.sha256();first=b'';before=file.stat()
 with file.open('rb') as stream:
  for chunk in iter(lambda:stream.read(1024*1024),b''):
   if not first:first=chunk[:512]
   h.update(chunk)
 after=file.stat()
 if (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):raise ValueError('Source changed during read: '+str(file))
 return h.hexdigest(),first,before

def main():
 p=argparse.ArgumentParser();p.add_argument('--corpus',required=True);p.add_argument('--output',required=True);p.add_argument('--workspace');a=p.parse_args()
 root=Path(a.corpus).resolve();out=Path(a.output).resolve();repo=Path(__file__).resolve().parents[2]
 if out==root or root in out.parents or out==repo or repo in out.parents:raise ValueError('Audit output must be outside original corpus and public repo')
 out.mkdir(parents=True,exist_ok=True);dbfile=out/'inventory.sqlite'
 if dbfile.exists():raise ValueError('Choose a new private inventory output; existing audit is preserved')
 db=sqlite3.connect(dbfile);db.executescript('''
 PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;
 CREATE TABLE files(path TEXT PRIMARY KEY,scope TEXT,bytes INTEGER,sha256 TEXT,format TEXT,mtime_ns INTEGER,header_hex TEXT);
 CREATE TABLE zip_members(container TEXT,member TEXT,bytes INTEGER,compressed_bytes INTEGER,crc INTEGER,sha256 TEXT,format TEXT,PRIMARY KEY(container,member));
 CREATE TABLE cfg_candidates(source_sha256 TEXT,source_path TEXT,bytes INTEGER,records INTEGER,index_offset INTEGER,schema_offset INTEGER,embedded_schema INTEGER,PRIMARY KEY(source_sha256,source_path));
 CREATE TABLE issues(kind TEXT,path TEXT,detail TEXT);
 ''')
 scopes={'integration-41/snapshot/apks':'original-apk','integration-41/snapshot/blobs':'original-static-snapshot','raw':'original-selected-cfg-and-metadata','integration-41/formats/payloads':'decoded-container-payload','normalized-complete-v1/tables':'existing-normalized-table','integration-41/cfg/records':'existing-all-variant-records','integration-41/cfg/schemas':'existing-cfg-schema','authorized-decryption/raw-language':'original-language-copy','authorized-decryption/decoded-language':'decoded-language'}
 source_files={};skipped=[]
 for rel,scope in scopes.items():
  folder=root/rel
  if not folder.exists():db.execute('INSERT INTO issues VALUES(?,?,?)',('MISSING_SCOPE',str(folder),scope));continue
  for base,dirs,files in os.walk(folder,followlinks=False):
   dirs[:]=[d for d in dirs if not (Path(base)/d).is_symlink()]
   for name in files:
    f=Path(base)/name
    if f.is_symlink() or f.stat().st_file_attributes&stat.FILE_ATTRIBUTE_REPARSE_POINT:skipped.append(str(f));continue
    source_files[f]=scope
 manifest=json.loads((root/'selected-source-manifest.json').read_text(encoding='utf-8'))
 pack=Path(manifest['sourcePack']['filePath']);source_files[pack]='original-config-pack'
 discovered=[]
 if a.workspace:
  workspace=Path(a.workspace).resolve()
  for base,dirs,files in os.walk(workspace,followlinks=False):
   dirs[:]=[d for d in dirs if d not in {'.git','node_modules','.venv','__pycache__'} and not (Path(base)/d).is_symlink() and not ((Path(base)/d).resolve()==out or out in (Path(base)/d).resolve().parents)]
   for name in files:
    if Path(name).suffix.lower() in {'.apk','.xapk','.apks','.obb'}:
     f=Path(base)/name;discovered.append(str(f));source_files.setdefault(f,'separately-stored-package-candidate')
 started=time.time();zip_files=[];counts=collections.Counter();bytes_by_scope=collections.Counter();source_count=len(source_files)
 for i,(file,scope) in enumerate(source_files.items(),1):
  try:
   digest,head,st=fingerprint(file);fmt=kind(head,file.name)
   db.execute('INSERT INTO files VALUES(?,?,?,?,?,?,?)',(str(file),scope,st.st_size,digest,fmt,st.st_mtime_ns,head[:24].hex()));counts[scope]+=1;bytes_by_scope[scope]+=st.st_size
   if fmt=='ZIP':zip_files.append(file)
   if fmt=='CFG':
    idx,schema,rows=struct.unpack_from('<III',head,4);db.execute('INSERT OR IGNORE INTO cfg_candidates VALUES(?,?,?,?,?,?,?)',(digest,str(file),st.st_size,rows,idx,schema,int(schema<st.st_size)))
  except Exception as exc:db.execute('INSERT INTO issues VALUES(?,?,?)',('FILE_READ',str(file),str(exc)))
  if i%500==0:db.commit();print(json.dumps({'phase':'files','done':i,'total':source_count}),flush=True)
 db.commit();zip_errors=0;member_count=0
 for i,file in enumerate(zip_files,1):
  try:
   with zipfile.ZipFile(file) as z:
    for info in z.infolist():
     if info.is_dir():continue
     h=hashlib.sha256();head=b''
     with z.open(info) as stream:
      for block in iter(lambda:stream.read(1024*1024),b''):
       if not head:head=block[:512]
       h.update(block)
     digest=h.hexdigest();fmt=kind(head,info.filename)
     db.execute('INSERT INTO zip_members VALUES(?,?,?,?,?,?,?)',(str(file),info.filename,info.file_size,info.compress_size,info.CRC,digest,fmt));member_count+=1
     if fmt=='CFG':
      idx,schema,rows=struct.unpack_from('<III',head,4);db.execute('INSERT OR IGNORE INTO cfg_candidates VALUES(?,?,?,?,?,?,?)',(digest,str(file)+'!/'+info.filename,info.file_size,rows,idx,schema,int(schema<info.file_size)))
   db.commit()
  except Exception as exc:zip_errors+=1;db.execute('INSERT INTO issues VALUES(?,?,?)',('ZIP_READ',str(file),str(exc)))
  if i%10==0:print(json.dumps({'phase':'zip','done':i,'total':len(zip_files),'members':member_count}),flush=True)
 db.executescript('CREATE INDEX files_sha ON files(sha256); CREATE INDEX member_sha ON zip_members(sha256); CREATE INDEX cfg_sha ON cfg_candidates(source_sha256);');db.commit()
 summary={'scope':'Actual filesystem SHA256 and ZIP member decompression/CRC checks; no game execution or network acquisition','corpus':str(root),'files':source_count,'filesRead':sum(counts.values()),'scopeCounts':dict(counts),'scopeBytes':dict(bytes_by_scope),'zipContainers':len(zip_files),'zipMembers':member_count,'zipFailures':zip_errors,'cfgDistinctPayloadSHA':db.execute('SELECT count(DISTINCT source_sha256) FROM cfg_candidates').fetchone()[0],'cfgPhysicalAliases':db.execute('SELECT count(*) FROM cfg_candidates').fetchone()[0],'issues':[dict(zip(['kind','path','detail'],r)) for r in db.execute('SELECT * FROM issues')],'reparseSkipped':skipped,'separatelyFoundPackages':discovered,'globalGameExtractionPercentage':None,'denominatorLimitation':'No claim about absent devices, hidden app-private files, live CDN/server or unknown client versions. File copies/derived variants are not unique game data.','sourcePreservation':'Files opened read-only; SHA measured and source size/mtime checked for change during every read. No originals rewritten.','seconds':round(time.time()-started,2),'sqlite':str(dbfile)}
 (out/'inventory-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');db.close();print(json.dumps({k:summary[k] for k in ['filesRead','zipContainers','zipMembers','cfgDistinctPayloadSHA','seconds']}),flush=True)

if __name__=='__main__':main()
