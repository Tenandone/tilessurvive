'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {StringDecoder}=require('node:string_decoder');
const {assertPrivate,inputWithin}=require('./paths.cjs');
const {sha,hashValue,normalizeRecord}=require('./record.cjs');
function fingerprint(){
  return hashValue(Object.fromEntries(['cfg.cjs','record.cjs','semantics.json','normalize.cjs','incremental.cjs'].map(file=>[file,sha(fs.readFileSync(path.join(__dirname,file)))])));
}
function reusableContext(context){
  // Collection/manifest identities are rebound to this run, never copied from a
  // previous collection. All per-source, schema, version and category data match.
  const {manifestSha256,collectedAt,...identity}=context;return hashValue(identity);
}
function hashFile(file){
  const digest=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),buffer=Buffer.allocUnsafe(256*1024);
  try{let size;while((size=fs.readSync(fd,buffer,0,buffer.length,null)))digest.update(buffer.subarray(0,size));}finally{fs.closeSync(fd);}
  return digest.digest('hex');
}
function *jsonLines(file){
  const fd=fs.openSync(file,'r'),buffer=Buffer.allocUnsafe(256*1024),decoder=new StringDecoder('utf8');let pending='';
  try{let size;while((size=fs.readSync(fd,buffer,0,buffer.length,null))){pending+=decoder.write(buffer.subarray(0,size));let end;while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);if(line.trim())yield JSON.parse(line);}}pending+=decoder.end();if(pending.trim())yield JSON.parse(pending);}finally{fs.closeSync(fd);}
}
function openPrevious(directory,scope,currentFingerprint){
  if(!directory)return null;
  const root=assertPrivate(directory,'Previous snapshot'),summary=JSON.parse(fs.readFileSync(inputWithin(root,'snapshot.json')));
  if(summary.schemaVersion!==1||summary.blockedTables||summary.conflictingIdentities)throw Error('Previous snapshot must be complete and conflict-free');
  if(!Array.isArray(summary.scope)||JSON.stringify([...summary.scope].sort())!==JSON.stringify([...scope].sort()))throw Error('Previous snapshot table scope differs');
  if(hashFile(inputWithin(root,'snapshot.sqlite'))!==summary.snapshotIndexSha256)throw Error('Previous snapshot index hash mismatch');
  if(!Array.isArray(summary.results)||summary.results.length!==scope.length||new Set(summary.results.map(r=>r.tableName)).size!==scope.length)throw Error('Previous snapshot table status mismatch');
  const statuses=new Map(summary.results.map(r=>[r.tableName,r]));
  for(const name of scope)if(statuses.get(name)?.status!=='STRUCTURED')throw Error('Previous snapshot contains an incomplete table');
  return {root,summary,statuses,compatible:summary.normalizationFingerprint===currentFingerprint};
}
function reuse(previous,entry,parsed,context){
  if(!previous)return {reason:'NO_PREVIOUS_SNAPSHOT'};
  if(!previous.compatible)return {reason:'NORMALIZATION_POLICY_CHANGED_OR_UNRECORDED'};
  const old=previous.statuses.get(entry.tableName);
  if(old.sourceSha256!==entry.sha256)return {reason:'SOURCE_HASH_CHANGED'};
  if(old.reuseContextSha256!==reusableContext(context))return {reason:'SOURCE_SCHEMA_OR_VERSION_CONTEXT_CHANGED'};
  const schemaFile=inputWithin(previous.root,path.join('schemas',entry.tableName+'.json'));
  if(hashFile(schemaFile)!==old.schemaFileSha256)throw Error('Previous schema hash mismatch');
  const schema=JSON.parse(fs.readFileSync(schemaFile));
  if(schema.sourceSha256!==entry.sha256||schema.rootClass!==parsed.rootClass||hashValue(schema.classes)!==hashValue(parsed.schema)||hashValue(schema.schemaSource)!==hashValue(parsed.schemaSource))throw Error('Previous schema does not match current source');
  const file=inputWithin(previous.root,path.join('tables',entry.tableName+'.jsonl'));
  if(hashFile(file)!==old.recordsSha256)throw Error('Previous normalized records hash mismatch');
  if(old.rows!==parsed.header.recordCount||!Number.isSafeInteger(old.rawType4Scalars)||old.rawType4Scalars<0)throw Error('Previous row/metric count mismatch');
  function *records(){
    let count=0;
    for(const record of jsonLines(file)){
      if(record.provenance?.sourceManifestSha256!==previous.summary.manifestSha256||record.provenance?.sourceSha256!==entry.sha256||record.provenance?.tableName!==entry.tableName||record.provenance?.recordIndex!==count)throw Error('Previous record provenance mismatch');
      const raw={row:record.rawValues,index:record.provenance.recordIndex,offset:record.provenance.recordByteOffset,references:record.references.map(r=>({fieldPath:r.fieldPath,referenceTag:r.rawReferenceTag,referenceClass:r.targetClass,internalId:r.internalId}))};
      const next=normalizeRecord(raw,context);
      const {provenance:oldProvenance,...oldContent}=record,{provenance:newProvenance,...newContent}=next;
      if(hashValue(oldContent)!==hashValue(newContent))throw Error('Previous normalized record fails current identity/value/condition checks');
      count++;yield next;
    }
    if(count!==old.rows)throw Error('Previous normalized row count mismatch');
  }
  return {reason:'EXACT_SOURCE_SCHEMA_AND_POLICY',records,rawType4Scalars:old.rawType4Scalars};
}
module.exports={fingerprint,reusableContext,openPrevious,reuse,hashFile};
