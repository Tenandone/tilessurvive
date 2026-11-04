"""Read Android binary XML manifest identity from retained APK ZIPs."""
import argparse,hashlib,json,struct,zipfile
from pathlib import Path

def axml_identity(raw):
 kind,head,total=struct.unpack_from('<HHI',raw);assert kind==3 and total==len(raw)
 strings=[];at=head;result={}
 while at<len(raw):
  kind,header,size=struct.unpack_from('<HHI',raw,at);assert header>=8 and size>=header and at+size<=len(raw)
  if kind==1:
   count,styles,flags,start,style_start=struct.unpack_from('<IIIII',raw,at+8)
   offsets=struct.unpack_from('<'+'I'*count,raw,at+header)
   for off in offsets:
    p=at+start+off
    if flags&0x100:
     def n8(p):
      n=raw[p];return (((n&127)<<8)|raw[p+1],p+2) if n&128 else (n,p+1)
     chars,p=n8(p);length,p=n8(p);value=raw[p:p+length].decode('utf8');assert raw[p+length]==0
    else:
     length=struct.unpack_from('<H',raw,p)[0];p+=2
     if length&0x8000:length=((length&0x7fff)<<16)|struct.unpack_from('<H',raw,p)[0];p+=2
     value=raw[p:p+length*2].decode('utf-16le');assert raw[p+length*2:p+length*2+2]==b'\0\0'
    strings.append(value)
  elif kind==0x102:
   ns,name,attr_start,attr_size,attr_count=struct.unpack_from('<IIHHH',raw,at+16)
   if strings[name]=='manifest':
    for i in range(attr_count):
     p=at+16+attr_start+i*attr_size;ns,n,rv,typed_size,res0,typ,data=struct.unpack_from('<IIIHBBI',raw,p)
     value=strings[rv] if rv!=0xffffffff else strings[data] if typ==3 else data
     result[strings[n]]=value
    return result
  at+=size
 raise ValueError('No manifest identity')

def main():
 p=argparse.ArgumentParser();p.add_argument('--corpus',required=True);p.add_argument('--output',required=True);a=p.parse_args()
 root=Path(a.corpus).resolve();out=Path(a.output).resolve();repo=Path(__file__).resolve().parents[2];assert out not in (root,repo) and root not in out.parents and repo not in out.parents;assert not out.exists()
 index=json.loads((root/'integration-41/inventory/apk-containers.json').read_text(encoding='utf8'));rows=[]
 for old in index:
  file=root/'integration-41/snapshot/apks'/old['sha256'];b=file.read_bytes();h=hashlib.sha256(b).hexdigest();assert h==old['sha256']
  with zipfile.ZipFile(file) as z:raw=z.read('AndroidManifest.xml');identity=axml_identity(raw)
  rows.append({'path':str(file),'retainedSourcePath':old['path'],'sha256':h,'bytes':len(b),'manifestSHA256':hashlib.sha256(raw).hexdigest(),'manifest':identity})
 keys={(r['manifest'].get('package'),r['manifest'].get('versionCode')) for r in rows};names={r['manifest']['versionName'] for r in rows if r['manifest'].get('versionName')};same=len(keys)==1 and len(names)<=1
 result={'status':'PASS','apkCount':len(rows),'distinctPackageVersionCodeIdentities':len(keys),'sameIdentity':same,'interpretation':'Retained APKs share package/versionCode. Missing versionName on a split is not a different version; inspect each manifest and split name below instead of counting files as releases' if same else 'Distinct manifest identities require separate review','rows':rows};out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':main()
