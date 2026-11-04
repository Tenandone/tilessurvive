'use strict';
// Local, read-only CFG source selection. Normalized records are never inputs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {inspectBuffer}=require('../game-data/cfg.cjs');
const {assertPrivate,inputWithin,within}=require('../game-data/paths.cjs');
const hash=(b,algorithm='sha256')=>crypto.createHash(algorithm).update(b).digest('hex');
const family=name=>name.replace(/_\d+$/,'');
function createSource(sourceDir){
 const root=assertPrivate(sourceDir,'Client corpus'),manifestPath=inputWithin(root,'selected-source-manifest.json');
 const manifestBytes=fs.readFileSync(manifestPath),manifest=JSON.parse(manifestBytes),manifestSHA256=hash(manifestBytes);
 const pin=manifest.metadata?.['BinVersionList_Realtime.json'];assert(pin,'Missing captured realtime index');
 const metadataPath=inputWithin(root,pin.filePath),metadataBytes=fs.readFileSync(metadataPath);
 assert.equal(hash(metadataBytes),pin.sha256,'Captured index SHA mismatch');assert.equal(metadataBytes.length,pin.bytes,'Captured index byte count');
 const index=JSON.parse(metadataBytes),excluded=new Set(['account_delete_config','account_migration_jp','user_behavior_type','activity_festival_seven_days__indexing__','itemlist__indexing__']);
 const entries=manifest.entries.filter(e=>e.filePath&&e.currentness==='MATCHES_LOCAL_REALTIME_INDEX'&&!excluded.has(e.tableName));
 assert.equal(new Set(entries.map(e=>e.tableName)).size,entries.length,'Ambiguous selected table name');
 assert(entries.length,'Captured index has no selected CFG tables');
 const missing=Object.keys(index).filter(name=>!excluded.has(name)&&!entries.some(e=>e.tableName===name));assert.equal(missing.length,0,'Captured-index entries absent from selected manifest: '+missing.join(', '));
 const byName=new Map(entries.map(e=>[e.tableName,e])),cache=new Map();
 function bytes(entry){
  assert.equal(index[entry.tableName],entry.expectedRealtimeMD5,'Manifest differs from original captured index '+entry.tableName);
  const file=inputWithin(root,entry.filePath),data=fs.readFileSync(file);
  assert.equal(data.length,entry.bytes,'Source byte count '+entry.tableName);assert.equal(hash(data),entry.sha256,'Source SHA '+entry.tableName);
  assert.equal(hash(data,'md5'),index[entry.tableName],'Source differs from captured index '+entry.tableName);
  return {file,data};
 }
 function parse(tableName){
  if(cache.has(tableName))return cache.get(tableName);
  const entry=byName.get(tableName);assert(entry,'No approved captured-index selection for '+tableName);
  const {file,data}=bytes(entry),options={expectedHashes:entry};
  if(data.readUInt32LE(8)===data.length){
   const schemas=[];
   for(const candidate of entries.filter(e=>family(e.tableName)===family(tableName))){
    const b=bytes(candidate).data;if(b.readUInt32LE(8)===b.length)continue;
    const p=inspectBuffer(b,{expectedHashes:candidate});schemas.push({table:candidate.tableName,sourceSHA256:candidate.sha256,schema:p.schema,sha256:hash(JSON.stringify(p.schema))});
   }
   assert(schemas.length&&new Set(schemas.map(s=>s.sha256)).size===1,'Missing or ambiguous family schema '+tableName);
   options.inheritedSchema=schemas[0].schema;options.inheritedSchemaSource={tableName:schemas[0].table,sourceSha256:schemas[0].sourceSHA256,schemaSha256:schemas[0].sha256,method:'same captured-index filename family; independently re-parsed embedded schema'};
  }
  const reader=inspectBuffer(data,options);assert.equal(reader.header.recordCount,entry.declaredRecords,'Source header count');
  // The retained header-only inventory deliberately has rootClass=null for
  // schema-less fragments. Their class comes from the verified family schema,
  // not a fabricated null-class constraint.
  if(entry.rootClass!==null&&entry.rootClass!==undefined)assert.equal(reader.rootClass,entry.rootClass,'Source root class');
  else assert(options.inheritedSchema&&reader.rootClass===options.inheritedSchema[0].name,'Fragment class must come from verified inherited schema');
  const result={tableName,entry,sourcePath:file,sourceSHA256:hash(data),reader,manifestSHA256,version:manifest.device?.gameVersion??null,build:manifest.device?.build??null};cache.set(tableName,result);return result;
 }
 function table(name){const parsed=parse(name);return {...parsed,records:[...parsed.reader.records()]};}
 return {root,manifest,manifestPath,manifestSHA256,index,entries,parse,table};
}
function privateOutput(sourceRoot,output){const target=assertPrivate(output,'Audit output');assert(!within(fs.realpathSync(sourceRoot),target),'Audit output must not modify the original corpus');return target;}
module.exports={createSource,hash,family,privateOutput};
