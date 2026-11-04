'use strict';
// Private audit-manifest exporter and semantic-category diff. No downloads, raw
// writes, game execution, release inference or automatic public-data changes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),readline=require('node:readline'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite'),{hashValue,stable}=require('../game-data/record.cjs'),{assertPrivate,within}=require('../game-data/paths.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const SKILL=/(?:Skill|Buff|Effect|Condition)/,empty=()=>Object.create(null),key=(c,id)=>c+':'+id;
function numericLeaves(v,p='',out=empty()){
 if(v===null)return out;
 if(typeof v==='number'){assert(Number.isFinite(v));out[p]=v;}
 else if(typeof v==='object'){
  if(v.rawTypeCode===4){assert(/^[a-f0-9]{16}$/i.test(v.rawHex));out[p]={rawTypeCode:4,rawHex:v.rawHex};}
  else if(Array.isArray(v))v.forEach((x,i)=>numericLeaves(x,p+'['+i+']',out));
  else for(const k of Object.keys(v))if(!['InternalId','Id'].includes(k))numericLeaves(v[k],p?p+'.'+k:k,out);
 }else if(typeof v==='string'&&/(?:Param|Formula)/i.test(p))out[p]={encodedParameter:v};
 return out;
}
function digestRows(iterator,sourceKey,payload){
 const out=empty();let current=null,h=null;
 for(const r of iterator){const k=sourceKey(r);if(k!==current){if(h)out[current]=h.digest('hex');current=k;h=crypto.createHash('sha256');}h.update(stable(payload(r))+'\n');}
 if(h)out[current]=h.digest('hex');return out;
}
async function snapshot(options){
 const audit=assertPrivate(options.audit,'Audit source'),corpus=assertPrivate(options.corpus,'Retained corpus'),summary=read(path.join(audit,'inventory-cfg-summary.json'));
 assert.equal(summary.status,'STRUCTURAL_REPARSE_PASS','Audit is incomplete');
 const db=new DatabaseSync(path.join(audit,'inventory-cfg.sqlite'),{readOnly:true});
 const count=q=>db.prepare(q).get().n;
 const checks={blockedPayloads:count("SELECT count(*) n FROM payloads WHERE parse_status<>'PARSED'"),normalizedDifferences:count('SELECT count(*) n FROM normalized_issues'),conflictingIdentities:count('SELECT count(*) n FROM (SELECT root_class,internal_id FROM identities WHERE selected=1 GROUP BY root_class,internal_id HAVING count(DISTINCT values_sha)>1)'),danglingTypedReferences:count('SELECT count(*) n FROM typed_edges e WHERE e.selected=1 AND e.reference_tag=0 AND NOT EXISTS(SELECT 1 FROM identities i WHERE i.selected=1 AND i.root_class=e.target_class AND i.internal_id=e.target_id)')};
 assert(Object.values(checks).every(n=>n===0),'Source audit structural checks failed');
 const result={schemaVersion:1,version:summary.version,manifestSHA256:summary.manifestSHA256,auditSummarySHA256:sha(fs.readFileSync(path.join(audit,'inventory-cfg-summary.json'))),checks,coverage:{records:'selected captured-index class+ID records',skills:'all selected classes matching Skill/Buff/Effect/Condition; numeric leaves and encoded Param/Formula text; units not inferred',relationships:'typed references and separately labelled integer/string candidates; not all runtime semantics',languages:null,images:null},tables:empty(),records:empty(),skillNumeric:empty(),typedRelationships:empty(),candidateRelationships:empty(),languages:empty(),images:empty()};
 for(const p of db.prepare("SELECT * FROM payloads WHERE selected_tables_json<>'[]'").iterate())for(const name of JSON.parse(p.selected_tables_json))result.tables[name]={sourceSHA256:p.sha,rootClass:p.root_class,records:p.record_count,schemaSHA256:p.schema_sha};
 for(const r of db.prepare('SELECT DISTINCT root_class,internal_id,source_id,values_sha FROM identities WHERE selected=1 ORDER BY root_class,internal_id').iterate()){const k=key(r.root_class,r.internal_id);assert(!Object.hasOwn(result.records,k),'Duplicate conflicting identity');result.records[k]={sha256:r.values_sha,sourceId:r.source_id};}
 // This is an audit export, not a raw decoder fallback: every cached row below
 // must match the independently raw-parsed value SHA from the prior audit DB.
 const numericSources=new Set();
 for(const t of Object.values(result.tables))if(SKILL.test(t.rootClass))numericSources.add(t.sourceSHA256);
 for(const sourceSHA of numericSources){
  const p=db.prepare('SELECT root_class,record_count FROM payloads WHERE sha=?').get(sourceSHA),cache=path.join(corpus,'integration-41/cfg/records',sourceSHA+'.jsonl');assert(fs.existsSync(cache),'Validated cache absent: '+sourceSHA);let rows=0;
  for await(const line of readline.createInterface({input:fs.createReadStream(cache),crlfDelay:Infinity})){if(!line.trim())continue;const v=JSON.parse(line),k=key(p.root_class,v.InternalId);assert.equal(hashValue(v),result.records[k]?.sha256,'Cache differs from raw audit: '+k);const h=hashValue(numericLeaves(v));assert(!Object.hasOwn(result.skillNumeric,k)||result.skillNumeric[k]===h,'Conflicting numerical alias');result.skillNumeric[k]=h;rows++;}
  assert.equal(rows,p.record_count,'Cache count differs from raw audit');
 }
 result.typedRelationships=digestRows(db.prepare('SELECT DISTINCT source_class,source_id,field_path,target_class,target_id,reference_tag FROM typed_edges WHERE selected=1 ORDER BY source_class,source_id,field_path,target_class,target_id,reference_tag').iterate(),r=>key(r.source_class,r.source_id),r=>[r.field_path,r.target_class,r.target_id,r.reference_tag]);
 const candidates=db.prepare(`SELECT DISTINCT source_class,source_id,field_path,'integer-candidate' kind,CAST(target_id AS TEXT) value FROM integer_candidates WHERE selected=1 UNION SELECT DISTINCT source_class,source_id,field_path,'string-binding' kind,raw_value value FROM string_bindings WHERE selected=1 ORDER BY source_class,source_id,field_path,kind,value`).iterate();
 result.candidateRelationships=digestRows(candidates,r=>key(r.source_class,r.source_id),r=>[r.field_path,r.kind,r.value]);
 if(options.languageAudit){
  const la=read(assertPrivate(options.languageAudit,'Language audit'));assert.equal(la.status,'PASS');assert(Array.isArray(la.rows)&&la.rows.length,'Empty language audit');
  for(const r of la.rows){const file=path.join(corpus,'authorized-decryption/decoded-language',r.name+'.json'),b=fs.readFileSync(file);assert.equal(sha(b),r.decodedJSONSHA256,'Language audit SHA mismatch '+r.name);const d=JSON.parse(b),keys=empty();assert.equal(Object.keys(d).length,r.entries);for(const [k,v]of Object.entries(d))keys[k]=hashValue(v);result.languages[r.name]=keys;}
  result.coverage.languages='all dictionaries explicitly pinned by supplied successful language re-decode audit';
 }
 if(options.images){
  const catalog=read(assertPrivate(options.images,'Image manifest'));assert.equal(catalog.schemaVersion,1);assert(Array.isArray(catalog.images)&&catalog.scope,'Image catalog needs explicit scope');
  for(const r of catalog.images){assert(typeof r.id==='string'&&r.id&&!Object.hasOwn(result.images,r.id),'Duplicate image logical ID');assert(/^[a-f0-9]{64}$/.test(r.fingerprint),'Image fingerprint missing');result.images[r.id]=r.fingerprint;}
  result.coverage.images=catalog.scope;
 }
 db.close();return result;
}
function mapDiff(before,after){
 const result={added:[],removed:[],changed:[]};for(const k of Object.keys(after).sort())if(!Object.hasOwn(before,k))result.added.push(k);else if(stable(before[k])!==stable(after[k]))result.changed.push(k);for(const k of Object.keys(before).sort())if(!Object.hasOwn(after,k))result.removed.push(k);return result;
}
function verify(m){
 assert.equal(m.schemaVersion,1,'Unsupported comparison manifest');for(const k of ['tables','records','skillNumeric','typedRelationships','candidateRelationships','languages','images','checks','coverage'])assert(m[k]&&typeof m[k]==='object'&&!Array.isArray(m[k]),'Missing manifest section '+k);
 assert(m.version&&typeof m.version==='object'&&Object.keys(m.version).length,'Missing version evidence');assert(/^[a-f0-9]{64}$/.test(m.manifestSHA256),'Missing source manifest SHA');assert(Object.keys(m.tables).length&&Object.keys(m.records).length,'Empty core audit coverage');
 for(const field of ['blockedPayloads','normalizedDifferences','conflictingIdentities','danglingTypedReferences'])assert(Number.isSafeInteger(m.checks[field])&&m.checks[field]>=0,'Missing structural check '+field);
 for(const [k,v]of Object.entries(m.records))assert(/^[A-Za-z][A-Za-z0-9_]*:\d+$/.test(k)&&/^[a-f0-9]{64}$/.test(v.sha256),'Invalid audited record '+k);
}
function compare(before,after){
 verify(before);verify(after);const categories={sourceMetadata:mapDiff({version:before.version,manifestSHA256:before.manifestSHA256},{version:after.version,manifestSHA256:after.manifestSHA256})};for(const k of ['tables','records','skillNumeric','typedRelationships','candidateRelationships'])categories[k]=mapDiff(before[k],after[k]);
 function subset(prefix){const d=categories.records;return Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v.filter(id=>id.startsWith(prefix+':'))]));}
 categories.heroRecordCandidates=subset('Survivor');categories.petRecordCandidates=subset('PetBase');const unknown=[];
 for(const k of ['languages','images']){
  if(!before.coverage[k]||!after.coverage[k]||before.coverage[k]!==after.coverage[k]){categories[k]=null;unknown.push(k+': missing or non-equivalent scope; absence is not deletion');continue;}
  if(k==='languages'){const flatten=x=>Object.fromEntries(Object.entries(x).flatMap(([locale,d])=>Object.entries(d).map(([key,value])=>[locale+'::'+key,value])));categories[k]=mapDiff(flatten(before[k]),flatten(after[k]));}
  else categories[k]=mapDiff(before[k],after[k]);
 }
 const failed=[['before',before],['after',after]].flatMap(([side,m])=>Object.entries(m.checks).filter(([k,v])=>v!==0).map(([k,v])=>({side,check:k,count:v})));
 const counts=Object.fromEntries(Object.entries(categories).map(([k,v])=>[k,v?Object.fromEntries(Object.entries(v).map(([kind,ids])=>[kind,ids.length])):null]));
 const changed=Object.values(counts).some(v=>v&&Object.values(v).some(n=>n>0));
 return {schemaVersion:1,status:failed.length?'BLOCKED':unknown.length?'INCOMPLETE':changed?'REVIEW_REQUIRED':'NO_CONTENT_CHANGE',beforeVersion:before.version,afterVersion:after.version,counts,categories,missingCoverage:unknown,failedChecks:failed,changeSHA256:hashValue({categories,unknown,failed}),automaticPublicationAllowed:false,limitations:['New Survivor records are hero/NPC configuration candidates until identity and release review.','Skill numeric/encoded-parameter changes are raw-field changes, not verified game-unit or damage changes.','Integer/string candidate changes are not automatically confirmed relationships.','No chronological or live-version claim follows from selecting before/after files.','An unchanged manifest proves only the explicitly declared compared scopes.']};
}
async function main(){const a=process.argv.slice(2),get=k=>a[a.indexOf(k)+1];assert(a.includes('--output'),'--output required');const out=assertPrivate(get('--output'),'Comparison output');assert(!fs.existsSync(out),'Preserve previous manifest/report');let r;
 if(a.includes('--snapshot')){for(const k of ['--audit','--corpus'])assert(a.includes(k),k+' required');assert(!within(fs.realpathSync(get('--corpus')),out),'Output must be outside original corpus');r=await snapshot({audit:get('--audit'),corpus:get('--corpus'),languageAudit:a.includes('--language-audit')?get('--language-audit'):null,images:a.includes('--images')?get('--images'):null});}
 else {for(const k of ['--before','--after'])assert(a.includes(k),k+' required');r=compare(read(assertPrivate(get('--before'))),read(assertPrivate(get('--after'))));}
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(r)+'\n');console.log(JSON.stringify(r.status?{status:r.status,counts:r.counts,missingCoverage:r.missingCoverage}:{status:'SNAPSHOT_EXPORTED',tables:Object.keys(r.tables).length,records:Object.keys(r.records).length,skillNumeric:Object.keys(r.skillNumeric).length,languages:Object.keys(r.languages).length,images:Object.keys(r.images).length}));if(r.status&&r.status!=='NO_CONTENT_CHANGE')process.exitCode=2;
}
module.exports={numericLeaves,mapDiff,compare,verify,snapshot};if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
