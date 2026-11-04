"""Re-read named Unity TextAssets from retained bundles. Never executes Lua."""
import argparse,hashlib,json,sys
from pathlib import Path
from unity_bytes import unity_files,textasset

def main():
 p=argparse.ArgumentParser();p.add_argument('--index',required=True);p.add_argument('--snapshot-root',required=True);p.add_argument('--output',required=True);p.add_argument('--names',nargs='+',required=True);a=p.parse_args()
 output=Path(a.output).resolve();repo=Path(__file__).resolve().parents[2]
 if output==repo or repo in output.parents:raise ValueError('Raw validation output must remain outside public repository')
 sys.dont_write_bytecode=True
 sha=lambda b:hashlib.sha256(b).hexdigest()
 rows=[json.loads(line) for line in Path(a.index).open(encoding='utf-8') if line.strip()];selected=[r for r in rows if r['name'] in a.names];sources={};result=[]
 missing=set(a.names)-{r['name'] for r in selected}
 if not selected or missing:raise ValueError('Requested TextAssets absent from source index: '+', '.join(sorted(missing)))
 for row in selected:
  source=Path(a.snapshot_root)/row['sourceSha256']
  if row['sourceSha256'] not in sources:
   raw=source.read_bytes();assert sha(raw)==row['sourceSha256'];offset=raw[:4096].find(b'UnityFS\0');assert offset>=0
   body=raw[offset:];assert sha(body)==row['bodySha256'];sources[row['sourceSha256']]=unity_files(body)
  files,header=sources[row['sourceSha256']]
  records=Path(row['path']).parent.parent/'objects.jsonl';objects=[json.loads(line) for line in records.open(encoding='utf-8') if line.strip()];objects=[o for o in objects if int(o['pathId'])==int(row['pathId']) and o['serializedFile']==row['serializedFile']];assert len(objects)==1
  obj=objects[0];serialized=files[row['serializedFile']];raw_object=serialized[obj['byteStart']:obj['byteStart']+obj['byteSize']];actual_name,body=textasset(raw_object);assert actual_name==row['name']
  stored=Path(row['path']).read_bytes();check={'name':row['name'],'sourcePath':str(source),'sourceSHA256':row['sourceSha256'],'bodySHA256':row['bodySha256'],'serializedFile':row['serializedFile'],'pathId':str(row['pathId']),'rawObjectExpectedSHA256':row['rawObjectSha256'],'rawObjectActualSHA256':sha(raw_object),'extractedTextSHA256':sha(body),'indexTextSHA256':row['sha256'],'storedTextSHA256':sha(stored),'storedTextPath':row['path'],'bytes':len(body),'luaExecuted':False}
  check['match']=check['rawObjectActualSHA256']==check['rawObjectExpectedSHA256'] and check['extractedTextSHA256']==check['indexTextSHA256']==check['storedTextSHA256'];result.append(check)
 output.parent.mkdir(parents=True,exist_ok=True);data={'status':'PASS' if all(r['match'] for r in result) else 'FAIL','parser':'independent bounded UnityFS/LZ4 and aligned TextAsset byte reader','scope':'Raw bundle -> decompressed CAB node -> recorded object byte offset -> embedded name and script bytes -> existing decoded file','pathIDLimitation':'PathID/offset association comes from the existing object index; raw object hash and embedded name/script were independently checked against original bundle bytes. No runtime selection is implied.','rows':result,'executedClientCode':False};output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':data['status'],'objects':len(result),'sourceBundles':len(sources)}));return 0 if data['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
