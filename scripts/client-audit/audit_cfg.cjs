'use strict';
// Reparse retained plaintext CFG bytes, audit normalized values and typed/untyped
// relationship coverage. All output is private; game activation is never inferred.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),readline=require('node:readline'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {inspectBuffer}=require('../game-data/cfg.cjs'),{hashValue}=require('../game-data/record.cjs'),{assertPrivate}=require('../game-data/paths.cjs');
const {createSource,hash,family,privateOutput}=require('./source.cjs');
function json(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
async function main(){
 const argv=process.argv.slice(2),get=k=>argv[argv.indexOf(k)+1];assert(argv.includes('--corpus')&&argv.includes('--output'),'--corpus and --output required');
 const source=createSource(get('--corpus')),out=privateOutput(source.root,get('--output'));assert(!fs.existsSync(out),'Preserve existing audits; choose a new output directory');fs.mkdirSync(out,{recursive:true});
 const inputs=new Map(),aliases=new Map(),selectedBySHA=new Map(),sourceHashes=[];
 for(const e of source.entries){if(!selectedBySHA.has(e.sha256))selectedBySHA.set(e.sha256,[]);selectedBySHA.get(e.sha256).push(e);}
 function alias(sha,name){if(!aliases.has(sha))aliases.set(sha,new Set());aliases.get(sha).add(name);}
 for(const e of source.manifest.entries)for(const c of e.candidates||[])if(c.sha256)alias(c.sha256,e.tableName);
 for(const rel of ['raw/pack','raw/loose-update','integration-41/formats/payloads']){
  const dir=path.join(source.root,rel);for(const name of fs.readdirSync(dir)){
   const file=path.join(dir,name);if(!fs.statSync(file).isFile())continue;const b=fs.readFileSync(file);if(b.subarray(0,4).toString('hex')!=='1b434647')continue;
   const sha=hash(b);if(!inputs.has(sha))inputs.set(sha,{sha,file,bytes:b.length,headerRecords:b.readUInt32LE(12),embedded:b.readUInt32LE(8)<b.length,paths:[]});inputs.get(sha).paths.push(file);
   if(name.includes('--'))alias(sha,name.split('--')[0]);
  }
 }
 // Cached schema metadata is only a lookup hint. Every accepted schema is
 // re-read from an actual embedded source payload, and hashes must agree.
 const embedded=new Map();
 for(const p of inputs.values())if(p.embedded){try{const r=inspectBuffer(fs.readFileSync(p.file));embedded.set(p.sha,{schema:r.schema,schemaSHA:hash(JSON.stringify(r.schema)),rootClass:r.rootClass});}catch(e){p.headerError=e.message;}}
 const db=new DatabaseSync(path.join(out,'inventory-cfg.sqlite'));db.exec(`PRAGMA journal_mode=OFF;PRAGMA synchronous=OFF;
 CREATE TABLE payloads(sha TEXT PRIMARY KEY,source_path TEXT,aliases_json TEXT,selected_tables_json TEXT,root_class TEXT,record_count INTEGER,schema_sha TEXT,embedded INTEGER,parse_status TEXT,normal_status TEXT,detail_json TEXT);
 CREATE TABLE identities(source_sha TEXT,root_class TEXT,internal_id INTEGER,source_id TEXT,values_sha TEXT,selected INTEGER,PRIMARY KEY(source_sha,root_class,internal_id));
 CREATE TABLE typed_edges(source_sha TEXT,source_class TEXT,source_id INTEGER,field_path TEXT,target_class TEXT,target_id INTEGER,reference_tag INTEGER,selected INTEGER);
 CREATE TABLE integer_candidates(source_sha TEXT,source_class TEXT,source_id INTEGER,field_path TEXT,target_id INTEGER,selected INTEGER);
 CREATE TABLE localization_uses(source_sha TEXT,source_class TEXT,source_id INTEGER,field_path TEXT,string_key TEXT,english_present INTEGER,selected INTEGER);
 CREATE TABLE string_bindings(source_sha TEXT,source_class TEXT,source_id INTEGER,field_path TEXT,raw_value TEXT,selected INTEGER);
 CREATE TABLE normalized_issues(table_name TEXT,row_index INTEGER,issue TEXT,detail TEXT);
 `);
 const addPayload=db.prepare('INSERT INTO payloads VALUES(?,?,?,?,?,?,?,?,?,?,?)'),addID=db.prepare('INSERT INTO identities VALUES(?,?,?,?,?,?)'),addEdge=db.prepare('INSERT INTO typed_edges VALUES(?,?,?,?,?,?,?,?)'),addInt=db.prepare('INSERT INTO integer_candidates VALUES(?,?,?,?,?,?)'),addLang=db.prepare('INSERT INTO localization_uses VALUES(?,?,?,?,?,?,?)'),addBinding=db.prepare('INSERT INTO string_bindings VALUES(?,?,?,?,?,?)'),addIssue=db.prepare('INSERT INTO normalized_issues VALUES(?,?,?,?)');
 const englishFile=path.join(source.root,'authorized-decryption/decoded-language/ingame-apk-en.json'),english=JSON.parse(fs.readFileSync(englishFile,'utf8')),keys=new Set(Object.keys(english));
 const results=[],integerPath=/(?:SkillConfig\[\d+\]\.key|PetSkill\[\d+\]\.key|\.(?:i_id|item_id|skill_id)|(?:Id|ID|Ids|IDs|Need|Require|Req|Cost|Reward|Skill|Buff|Effect)(?:\[\d+\](?:\.key)?)?)$/;
 const labelPath=/(?:^|\.)(?:Name|Description|Title|Des|Desc|Text|Tips|Tip|Summary|StarName|StarDescription|GearName|GearSkillName|SlgDescription|DescriptionSquad|DescriptionTroop)$/;
 let totalRows=0,totalEdges=0,totalInts=0,totalStrings=0,normalIssues=0,done=0;
 function walk(value,prefix,record,selected){
  if(value===null)return;
  if(typeof value==='object'){
   if(Object.hasOwn(value,'rawTypeCode')||Object.hasOwn(value,'referenceClass'))return;
   if(Array.isArray(value)){for(let i=0;i<value.length;i++)walk(value[i],prefix+'['+i+']',record,selected);}
   else for(const [k,v]of Object.entries(value))walk(v,prefix?prefix+'.'+k:k,record,selected);
  }else if(typeof value==='number'&&Number.isSafeInteger(value)&&value>=100000&&integerPath.test(prefix)){addInt.run(record.sha,record.cls,record.id,prefix,value,selected);totalInts++;}
  else if(typeof value==='string'){
   if(keys.has(value)||labelPath.test(prefix)&&value.length<200&&/^[A-Za-z][A-Za-z0-9_]+$/.test(value)){addLang.run(record.sha,record.cls,record.id,prefix,value,Number(keys.has(value)),selected);totalStrings++;}
   if(value.includes('|')&&value.length<2000)addBinding.run(record.sha,record.cls,record.id,prefix,value,selected);
  }
 }
 for(const input of inputs.values()){
  const current=selectedBySHA.get(input.sha)||[],isSelected=Number(current.length>0),tableNames=[...(aliases.get(input.sha)||[])].sort();let parser,normalStatus=current.length?'PENDING':'NOT_IN_SELECTED_NORMALIZED_COHORT',schemaSource=null,issue=null,rows=0,refCount=0;
  try{
   const b=fs.readFileSync(input.file);assert.equal(hash(b),input.sha,'Source changed');const options={expectedHashes:{sha256:input.sha}};
   if(!input.embedded){
    const hintFile=path.join(source.root,'integration-41/cfg/schemas',input.sha+'.json');assert(fs.existsSync(hintFile),'No schema lineage hint for fragment');const hint=JSON.parse(fs.readFileSync(hintFile,'utf8'));const hintHash=hash(JSON.stringify(hint.schema));
    const familyNames=new Set(tableNames.map(family));const candidates=[...embedded.entries()].filter(([sha,v])=>v.schemaSHA===hintHash&&[...(aliases.get(sha)||[])].some(name=>familyNames.has(family(name))));assert(candidates.length,'No original embedded family schema matches fragment lineage');
    options.inheritedSchema=candidates[0][1].schema;options.inheritedSchemaSource={sourceSHA256:candidates[0][0],schemaSHA256:hintHash,method:'exact schema bytes from re-read embedded same-family source'};schemaSource=options.inheritedSchemaSource;
   }
   parser=inspectBuffer(b,options);const expectedRefs=raw=>raw.references.map(r=>({fieldPath:r.fieldPath,targetRecordKey:r.referenceTag===0?'tscfg:'+r.referenceClass+':'+r.internalId:null,internalId:r.internalId,targetClass:r.referenceClass,rawReferenceTag:r.referenceTag,status:r.referenceTag===0?'UNRESOLVED_TARGET':'UNRESOLVED_REFERENCE_TAG'}));
   let lines=null,iterator=null,normalizedSHA=null;
   if(current.length){assert.equal(current.length,1,'Multiple selected table aliases require explicit comparison');const selected=source.parse(current[0].tableName);assert.equal(selected.sourceSHA256,input.sha);const normal=path.join(source.root,'normalized-complete-v1/tables',current[0].tableName+'.jsonl');assert(fs.existsSync(normal),'Missing normalized table');const stream=fs.createReadStream(normal);normalizedSHA=crypto.createHash('sha256');stream.on('data',data=>normalizedSHA.update(data));lines=readline.createInterface({input:stream,crlfDelay:Infinity});iterator=lines[Symbol.asyncIterator]();}
   db.exec('BEGIN');
   for(const raw of parser.records()){
    const v=raw.row,vsha=hashValue(v),record={sha:input.sha,cls:parser.rootClass,id:v.InternalId};addID.run(input.sha,parser.rootClass,v.InternalId,v.Id,vsha,isSelected);
    for(const e of raw.references){addEdge.run(input.sha,parser.rootClass,v.InternalId,e.fieldPath,e.referenceClass,e.internalId,e.referenceTag,isSelected);refCount++;totalEdges++;}
    walk(v,'',record,isSelected);
    if(iterator){const next=await iterator.next();let problem=null;try{assert(!next.done,'normalized ended early');const n=JSON.parse(next.value);assert.equal(n.identity.internalId,v.InternalId,'record identity');assert.equal(n.identity.rootClass,parser.rootClass,'root class');assert.equal(n.valuesSha256,vsha,'normalized value digest');assert.equal(hashValue(n.rawValues),vsha,'actual normalized values');assert.deepEqual(n.references,expectedRefs(raw),'reference shape');assert.deepEqual(Object.keys(n.rawValues),Object.keys(v),'field set/order');}catch(e){problem=e.message;}if(problem){addIssue.run(current[0].tableName,rows,'RAW_NORMALIZED_DIFFERENCE',problem.slice(0,1000));normalIssues++;}}
    rows++;
   }
   if(iterator){const tail=await iterator.next();assert(tail.done,'Normalized has trailing rows');normalStatus=db.prepare('SELECT count(*) n FROM normalized_issues WHERE table_name=?').get(current[0].tableName).n?'DIFFERENT':'EXACT_VALUES_AND_REFERENCES';sourceHashes.push({table:current[0].tableName,sourceSHA256:input.sha,normalizedSHA256:normalizedSHA.digest('hex'),rows});}
   db.exec('COMMIT');assert.equal(rows,parser.header.recordCount);totalRows+=rows;
  }catch(e){try{db.exec('ROLLBACK');}catch(_){}issue={code:e.code||'AUDIT_ERROR',message:e.message};normalStatus=current.length?'BLOCKED':normalStatus;}
  const detail={paths:input.paths,schemaSource,issue,metrics:parser?.metrics||null,fieldCount:parser?.schema[0]?.fieldCount??null,referenceCount:refCount,gameVersion:source.manifest.device?.gameVersion,gameBuild:source.manifest.device?.build,liveActivation:'UNKNOWN'};
  addPayload.run(input.sha,input.file,JSON.stringify(tableNames),JSON.stringify(current.map(e=>e.tableName)),parser?.rootClass||null,rows,parser?hash(JSON.stringify(parser.schema)):null,Number(input.embedded),issue?'BLOCKED':'PARSED',normalStatus,JSON.stringify(detail));results.push({sha256:input.sha,tables:tableNames,selectedTables:current.map(e=>e.tableName),rootClass:parser?.rootClass,rows,parseStatus:issue?'BLOCKED':'PARSED',normalizedStatus:normalStatus,...detail});
  if(++done%50===0){json(path.join(out,'inventory-cfg-progress.json'),{done,total:inputs.size,totalRows,totalEdges,totalInts,normalIssues});console.log(JSON.stringify({done,total:inputs.size,totalRows,normalIssues}),{flush:true});}
 }
 db.exec('CREATE INDEX ids_key ON identities(root_class,internal_id,selected);CREATE INDEX ids_number ON identities(internal_id);CREATE INDEX edge_target ON typed_edges(target_class,target_id,reference_tag,selected);CREATE INDEX int_target ON integer_candidates(target_id);CREATE INDEX localization_key ON localization_uses(string_key);');
 const scalar=q=>db.prepare(q).get().n;
 const summary={status:results.some(r=>r.parseStatus==='BLOCKED')||normalIssues?'REVIEW_REQUIRED':'STRUCTURAL_REPARSE_PASS',scope:'All distinct accessible plaintext CFG payloads found in raw pack/loose files and decoded payload directory; copied paths deduplicated by freshly computed SHA256.',manifestSHA256:source.manifestSHA256,capturedIndexOnly:true,version:source.manifest.device,distinctPayloads:inputs.size,selectedNormalizedTables:source.entries.length,parsedPayloads:results.filter(r=>r.parseStatus==='PARSED').length,unselectedPayloadVariants:results.filter(r=>!r.selectedTables.length).length,physicalRowsAcrossPayloadVersions:totalRows,selectedLogicalIdentities:scalar('SELECT count(*) n FROM (SELECT DISTINCT root_class,internal_id FROM identities WHERE selected=1)'),allVariantLogicalIdentities:scalar('SELECT count(*) n FROM (SELECT DISTINCT root_class,internal_id FROM identities)'),normalizedRowsCompared:sourceHashes.reduce((n,s)=>n+s.rows,0),normalizedIssues:normalIssues,typedEdges:totalEdges,integerReferenceCandidates:totalInts,localizationUses:totalStrings,nonzeroTagReferences:scalar('SELECT count(*) n FROM typed_edges WHERE reference_tag<>0'),selectedType0Orphans:scalar('SELECT count(*) n FROM typed_edges e WHERE e.selected=1 AND e.reference_tag=0 AND NOT EXISTS(SELECT 1 FROM identities i WHERE i.selected=1 AND i.root_class=e.target_class AND i.internal_id=e.target_id)'),unselectedOnlyTargetCandidates:scalar('SELECT count(*) n FROM typed_edges e WHERE e.selected=1 AND e.reference_tag=0 AND NOT EXISTS(SELECT 1 FROM identities i WHERE i.selected=1 AND i.root_class=e.target_class AND i.internal_id=e.target_id) AND EXISTS(SELECT 1 FROM identities i WHERE i.root_class=e.target_class AND i.internal_id=e.target_id)'),limits:['No global game extraction percent: opaque formats, absent original versions and server scope are not enumerable from this input.','Integer joins and unmatched localization-looking strings are candidates until field-specific semantics establish their meaning.','Nonselected payloads are retained variants, not automatically extraction omissions or chronological version changes.','A successfully parsed row or resolved identity does not verify release, effect execution, duration units or live selectors.'],resultsFile:'inventory-cfg-payloads.json',sourceHashesFile:'inventory-normalized-comparison.json'};
 json(path.join(out,'inventory-cfg-payloads.json'),results);json(path.join(out,'inventory-normalized-comparison.json'),sourceHashes);json(path.join(out,'inventory-cfg-summary.json'),summary);db.close();console.log(JSON.stringify(summary));
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
