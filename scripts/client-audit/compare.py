"""Fail-closed structural gate and reviewable record diff for two private audits."""
import argparse, hashlib, json, sqlite3
from pathlib import Path

def connect(folder):
 return sqlite3.connect('file:'+(Path(folder)/'inventory-cfg.sqlite').resolve().as_posix()+'?mode=ro',uri=True)

def validate(db):
 queries={
  'blockedPayloads':"select count(*) from payloads where parse_status<>'PARSED'",
  'normalizedDifferences':'select count(*) from normalized_issues',
  'conflictingSelectedIdentities':'select count(*) from (select root_class,internal_id from identities where selected=1 group by root_class,internal_id having count(distinct values_sha)>1)',
  'danglingSelectedTypedReferences':'select count(*) from typed_edges e where selected=1 and reference_tag=0 and not exists(select 1 from identities i where i.selected=1 and i.root_class=e.target_class and i.internal_id=e.target_id)'}
 return {k:db.execute(q).fetchone()[0] for k,q in queries.items()}

def records(db):
 result={}
 for cls,ident,digest in db.execute('select distinct root_class,internal_id,values_sha from identities where selected=1'):
  key=(cls,ident)
  if key in result and result[key]!=digest:raise ValueError('Ambiguous selected class/ID cannot be compared')
  result[key]=digest
 return result

def compare(before,after):
 old,new=records(before),records(after)
 def row(k):return {'rootClass':k[0],'internalId':k[1]}
 added=[{**row(k),'valuesSHA256':new[k]} for k in sorted(new.keys()-old.keys())]
 removed=[{**row(k),'valuesSHA256':old[k]} for k in sorted(old.keys()-new.keys())]
 changed=[{**row(k),'beforeSHA256':old[k],'afterSHA256':new[k]} for k in sorted(old.keys()&new.keys()) if old[k]!=new[k]]
 changes={'added':added,'removed':removed,'changed':changed};signature=hashlib.sha256(json.dumps(changes,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 return {'counts':{k:len(v) for k,v in changes.items()},'changeSHA256':signature,**changes,'interpretation':'Differences between explicitly supplied snapshots; ordering does not prove real release chronology.'}

def main():
 p=argparse.ArgumentParser();p.add_argument('--after',required=True);p.add_argument('--before');p.add_argument('--output',required=True);p.add_argument('--ack-change-sha');a=p.parse_args()
 out=Path(a.output).resolve();repo=Path(__file__).resolve().parents[2];assert out!=repo and repo not in out.parents;assert not out.exists(),'Preserve previous report'
 with connect(a.after) as db:
  structural=validate(db)
  if a.before:
   with connect(a.before) as old:diff=compare(old,db)
  else:diff=None
 changed=bool(diff and any(diff['counts'].values()));ack=bool(changed and a.ack_change_sha==diff['changeSHA256'])
 result={'status':'BLOCKED' if any(structural.values()) else 'REVIEW_NEW_DATA' if changed and not ack else 'PASS','structural':structural,'diff':diff,'explicitChangeAcknowledged':ack,'firstSnapshotHasNoVersionComparison':not bool(a.before),'limits':['This gate does not verify live gameplay/release/server or license status.','Localization/image/public semantic-adapter gates run separately; a generic type-7 audit cannot validate integer/string semantic joins.','A changed table with no record-value difference can still have schema/source metadata changes; retain payload inventories for review.']}
 out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({'status':result['status'],'structural':structural,'diffCounts':diff['counts'] if diff else None}));return 0 if result['status']=='PASS' else 2
if __name__=='__main__':raise SystemExit(main())
