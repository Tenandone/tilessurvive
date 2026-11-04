"""Summarize verified audit DBs and conservative website-consumption evidence."""
import argparse,collections,hashlib,json,re,sqlite3
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--corpus',required=True);p.add_argument('--audit',required=True);p.add_argument('--repo',required=True);p.add_argument('--output',required=True);a=p.parse_args()
 corpus=Path(a.corpus).resolve();root=Path(a.repo).resolve();out=Path(a.output).resolve();assert root not in out.parents and corpus not in out.parents and out not in (root,corpus);assert not out.exists()
 audit=Path(a.audit);summary=json.loads((audit/'inventory-cfg-summary.json').read_text());payloads=json.loads((audit/'inventory-cfg-payloads.json').read_text());manifest=json.loads((corpus/'selected-source-manifest.json').read_text(encoding='utf8'));selected={e['tableName']:e for e in manifest['entries'] if e.get('filePath') and e.get('currentness')=='MATCHES_LOCAL_REALTIME_INDEX' and not re.match(r'account(?:_|$)',e['tableName'])}
 db=sqlite3.connect('file:'+(audit/'inventory-cfg.sqlite').resolve().as_posix()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
 evidence=collections.defaultdict(list);record_ids=collections.defaultdict(set);script_mentions=collections.defaultdict(list)
 def walk(obj,file):
  if isinstance(obj,list):
   for v in obj:walk(v,file)
  elif isinstance(obj,dict):
   t=obj.get('table') or obj.get('tableName')
   if isinstance(t,str) and t in selected and any(k in obj for k in ('internalId','recordKey','sourceSHA256','sourceSha256')):
    if len(evidence[t])<12:evidence[t].append({'file':file,'recordKey':obj.get('recordKey'),'id':obj.get('internalId'),'fields':obj.get('fields'),'basis':'Explicit source evidence stored in public JSON; not proof every field is rendered'})
    if isinstance(obj.get('internalId'),int):record_ids[t].add(obj['internalId'])
   for v in obj.values():walk(v,file)
 for file in sorted((root/'data').glob('*.json')):
  if file.name=='search-index.json':continue
  try:walk(json.loads(file.read_text(encoding='utf8')),file.relative_to(root).as_posix())
  except (ValueError,UnicodeDecodeError):continue
 for file in sorted((root/'scripts').rglob('*')):
  if file.suffix not in ('.js','.cjs','.mjs') or 'client-audit' in file.parts or 'test' in file.name:continue
  text=file.read_text(encoding='utf8')
  for m in re.finditer(r'''(['"])([a-z][a-z0-9_]{2,})\1''',text):
   t=m.group(2)
   if t in selected and len(script_mentions[t])<8:script_mentions[t].append({'file':file.relative_to(root).as_posix(),'line':text.count('\n',0,m.start())+1,'basis':'Literal table identifier in build code; dependency candidate, not dynamic execution attestation'})
 counts={r['source_sha']:dict(r) for r in db.execute('select source_sha,count(*) physical,count(distinct internal_id) ids from identities where selected=1 group by source_sha')}
 lang={r['source_sha']:r['n'] for r in db.execute('select source_sha,count(*) n from localization_uses where selected=1 and english_present=0 group by source_sha')}
 tags={r['source_sha']:r['n'] for r in db.execute('select source_sha,count(*) n from typed_edges where selected=1 and reference_tag<>0 group by source_sha')}
 strings={r['source_sha']:r['n'] for r in db.execute('select source_sha,count(*) n from string_bindings where selected=1 group by source_sha')}
 bysha={x['sha256']:x for x in payloads};byclass=collections.defaultdict(list)
 for x in payloads:byclass[x.get('rootClass')].append(x)
 rows=[]
 for name,e in sorted(selected.items()):
  x=bysha[e['sha256']];variants=[v for v in byclass[x['rootClass']] if not v['selectedTables'] and (name in v['tables'] or any(re.sub(r'_\d+$','',t)==re.sub(r'_\d+$','',name) for t in v['tables']))]
  rows.append({'table':name,'sourcePath':x['paths'][0],'sourceSHA256':x['sha256'],'rootClass':x['rootClass'],'recordCount':x['rows'],'identities':counts.get(x['sha256']),'parseStatus':x['parseStatus'],'normalizedStatus':x['normalizedStatus'],'typedReferences':x['referenceCount'],'nonzeroTagReferences':tags.get(x['sha256'],0),'rawEightByteScalars':x['metrics']['rawType4Scalars'],'localizationMissingCandidates':lang.get(x['sha256'],0),'pipeStringBindings':strings.get(x['sha256'],0),'publicModelEvidence':evidence[name],'publicModelDistinctIDs':len(record_ids[name]),'buildCodeMentions':script_mentions[name],'retainedUnselectedVariants':[{'sha256':v['sha256'],'rows':v['rows']} for v in variants],'requestedSevenClassifications':{'1_original_present_extracted':'CONFIRMED' if x['normalizedStatus']=='EXACT_VALUES_AND_REFERENCES' else 'BLOCKED','2_extracted_site_unused':'NOT_ESTABLISHED' if evidence[name] or script_mentions[name] else 'NO_STATIC_USAGE_EVIDENCE_NOT_PROOF_OF_UNUSED','3_field_semantics_incomplete':'STRUCTURAL_PARSE_ONLY; live units/conditions not comprehensively proven','4_original_present_extraction_missing':'NO_MISMATCH_IN_THIS_SELECTED_TABLE','5_absent_due_to_version':'NOT_ESTABLISHED; retained variants listed separately, no assumed chronological meaning','6_server_confirmation_needed':'Live activation/selectors/timetables/combat authority not supplied by this static table','7_release_unverified':'CLIENT_PRESENCE_IS_NOT_RELEASE_PROOF'}})
 scal=lambda q:db.execute(q).fetchone()[0]
 result={'auditSummary':summary,'sevenClassificationPolicy':'Categories overlap and unknown is allowed. No table is called unused merely because a static string scan misses it. The three intentionally excluded operational schemas are inventoried separately, not new gameplay omissions.','tables':rows,'usageSummary':{'tablesWithExplicitPublicModelEvidence':len([r for r in rows if r['publicModelEvidence']]),'tablesWithLiteralBuildCodeMention':len([r for r in rows if r['buildCodeMentions']]),'tablesWithoutEitherEvidence':len([r for r in rows if not r['publicModelEvidence'] and not r['buildCodeMentions']]),'siteUsagePercent':None,'limitation':'Static explicit provenance and build-code identifier audit only. Dynamic paths, hand-transcribed values, HTML and every visible field are not fully traced.'},'deduplication':{'selectedPhysicalRows':scal('select count(*) from identities where selected=1'),'selectedLogicalClassIDPairs':scal('select count(*) from (select root_class,internal_id from identities where selected=1 group by root_class,internal_id)'),'duplicatedClassIDPairs':scal('select count(*) from (select root_class,internal_id from identities where selected=1 group by root_class,internal_id having count(*)>1)'),'sameClassIDConflictingValues':scal('select count(*) from (select root_class,internal_id from identities where selected=1 group by root_class,internal_id having count(distinct values_sha)>1)'),'typedPhysicalEdges':scal('select count(*) from typed_edges where selected=1'),'typedLogicalEdges':scal('select count(*) from (select distinct source_class,source_id,field_path,target_class,target_id,reference_tag from typed_edges where selected=1)')},'operationalOnlyPayloads':[{'sha256':x['sha256'],'rootClass':x['rootClass'],'rows':x['rows']} for x in payloads if not(corpus/'integration-41/cfg/records'/(x['sha256']+'.jsonl')).exists()]}
 out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({'tables':len(rows),'usage':result['usageSummary'],'deduplication':result['deduplication']}))
if __name__=='__main__':main()
