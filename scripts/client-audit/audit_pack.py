"""Independently validate a retained SOS directory and member bytes; no extraction."""
import argparse, hashlib, json, struct
from pathlib import Path

def audit(pack, raw_dir, old_manifest):
    raw=pack.read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest()
    magic,block,capacity,slots=struct.unpack_from('<4sIII',raw)
    assert magic==b'\0SOS' and block in (2048,4096) and slots<=capacity<=65536
    names=16+capacity*12;end=names+capacity*256;assert end<len(raw)
    previous={r['name']:r for r in old_manifest['entries']};rows=[];inactive=[]
    copies={}
    for file in raw_dir.glob('*.bin'):
        h=sha(file.read_bytes());copies.setdefault(h,[]).append(str(file))
    for slot in range(slots):
        ident,start,size=struct.unpack_from('<III',raw,16+slot*12)
        if ident==0xffffffff:inactive.append(slot);continue
        assert ident<capacity
        p=names+ident*256;n=raw[p];name=raw[p+1:p+1+n].decode('utf-8');offset=start*block
        assert name and offset>=end and offset+size<=len(raw)
        body=raw[offset:offset+size];h=sha(body);old=previous.get(name)
        rows.append({'slot':slot,'name':name,'offset':offset,'bytes':size,'sha256':h,'magicHex':body[:4].hex(),'rawCopies':copies.get(h,[]),'priorManifestMatches':bool(old and old['sha256']==h and old['offset']==offset and old['size']==size)})
    assert len({r['name'] for r in rows})==len(rows)
    ordered=sorted(rows,key=lambda x:x['offset'])
    assert all(a['offset']+a['bytes']<=b['offset'] for a,b in zip(ordered,ordered[1:]))
    return {'status':'PASS' if all(r['priorManifestMatches'] for r in rows) else 'REVIEW','source':str(pack),'sourceSHA256':sha(raw),'sourceBytes':len(raw),'activeMembers':len(rows),'inactiveSlots':inactive,'cfgMembers':sum(r['magicHex']=='1b434647' for r in rows),'rawCFGMatches':sum(r['magicHex']=='1b434647' and bool(r['rawCopies']) for r in rows),'notMaterializedCFG':[r for r in rows if r['magicHex']=='1b434647' and not r['rawCopies']],'method':'Fresh directory/header/name slots; strict bounds and nonoverlap; SHA of every member compared with retained member copies and old manifest. No original writes.','members':rows}

def main():
    p=argparse.ArgumentParser();p.add_argument('--corpus',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    corpus=Path(a.corpus).resolve();out=Path(a.output).resolve();repo=Path(__file__).resolve().parents[2]
    assert repo not in out.parents and corpus not in out.parents and out not in (repo,corpus)
    assert not out.exists(),'Preserve the previous audit; choose a new output'
    selected=json.loads((corpus/'selected-source-manifest.json').read_text(encoding='utf8'));pack=Path(selected['sourcePack']['filePath']);manifest=json.loads((pack.parent/'pack-manifest.json').read_text(encoding='utf8'))
    result=audit(pack,corpus/'raw/pack',manifest);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({k:v for k,v in result.items() if k not in ('members','notMaterializedCFG')}));print('notMaterializedCFG:',[r['name'] for r in result['notMaterializedCFG']])
if __name__=='__main__':main()
