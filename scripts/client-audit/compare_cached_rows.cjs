'use strict';
// Compare all existing SHA-addressed record caches to freshly re-parsed audit IDs.
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite'),{hashValue}=require('../game-data/record.cjs'),{createSource,privateOutput}=require('./source.cjs');
async function main(){
 const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];for(const k of ['--corpus','--audit','--output'])assert(args.includes(k));
 const source=createSource(get('--corpus')),out=privateOutput(source.root,get('--output'));assert(!fs.existsSync(out),'Preserve earlier audit');
 const db=new DatabaseSync(path.join(get('--audit'),'inventory-cfg.sqlite'),{readOnly:true}),payload=db.prepare('select root_class,record_count,parse_status from payloads where sha=?'),lookup=db.prepare('select values_sha from identities where source_sha=? and root_class=? and internal_id=?');
 const rows=[],issues=[];let total=0;
 for(const file of fs.readdirSync(path.join(source.root,'integration-41/cfg/records'))){
  if(!/^[a-f0-9]{64}\.jsonl$/.test(file))continue;const sha=file.slice(0,64),meta=payload.get(sha);assert(meta&&meta.parse_status==='PARSED','Cache lacks original parsed payload '+sha);let n=0;const ids=new Set();
  const stream=fs.createReadStream(path.join(source.root,'integration-41/cfg/records',file));for await(const line of readline.createInterface({input:stream,crlfDelay:Infinity})){if(!line.trim())continue;const v=JSON.parse(line),expected=lookup.get(sha,meta.root_class,v.InternalId);if(!expected||expected.values_sha!==hashValue(v)||ids.has(v.InternalId))issues.push({sourceSHA256:sha,id:v.InternalId,issue:!expected?'UNKNOWN_ID':ids.has(v.InternalId)?'DUPLICATE_ID':'VALUE_DIFFERENCE'});ids.add(v.InternalId);n++;}
  if(n!==meta.record_count)issues.push({sourceSHA256:sha,issue:'COUNT_DIFFERENCE',original:meta.record_count,cache:n});rows.push({sourceSHA256:sha,rootClass:meta.root_class,records:n});total+=n;
 }
 const result={status:issues.length?'FAIL':'PASS',tables:rows.length,physicalRows:total,issues,rows,scope:'Every existing SHA-addressed gameplay record cache compared to the new raw CFG parse; operational-only schemas without an existing cache are outside this comparison.'};fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,tables:result.tables,physicalRows:total,issues:issues.length}));db.close();if(issues.length)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.stack);process.exitCode=1;});
