'use strict';
const fs=require('node:fs'), path=require('node:path'), readline=require('node:readline');
const { DatabaseSync }=require('node:sqlite');
const { assertPrivate,inputWithin,newPrivateDirectory }=require('./paths.cjs');
const { sha,hashValue }=require('./record.cjs');
const defaultRegistry=require('./semantics.json');
function checkRegistry(registry) {
  if(registry.schemaVersion!==1 || !Array.isArray(registry.allowedFields)) throw Error('Unsupported semantic registry');
  const ids=new Set();
  for(const rule of registry.allowedFields) {
    if(typeof rule.ruleId!=='string' || ids.has(rule.ruleId)) throw Error('Registry rule IDs must be unique'); ids.add(rule.ruleId);
    if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(rule.rootClass || '') || !/^[A-Za-z][A-Za-z0-9_]*$/.test(rule.field || '') || !/^[a-z][a-zA-Z0-9]*$/.test(rule.publicKey || '') || ['constructor','prototype','__proto__'].includes(rule.publicKey)) throw Error('Unsafe semantic registry field');
    if(rule.status!=='CONFIRMED' || !Array.isArray(rule.evidenceIds) || !rule.evidenceIds.length || !rule.unit || !rule.meaning) throw Error('Allowlisted rules require CONFIRMED semantics, units and evidence');
    if(!['text','number','boolean','site-link'].includes(rule.publicType)) throw Error('Explicit public value type required');
    if(!['identity','signed-le64'].includes(rule.encoding?.kind)) throw Error('Unsupported semantic interpretation');
  }
  return registry;
}
function interpret(raw,rule) {
  let value;
  if(rule.encoding.kind==='identity') {
    if(raw===null || !['string','number','boolean'].includes(typeof raw) || (typeof raw==='number' && !Number.isFinite(raw))) throw Error('Only explicitly admitted scalar values can be public');
    value=raw;
  } else {
    if(raw?.rawTypeCode!==4 || !/^[0-9a-f]{16}$/i.test(raw.rawHex || '')) throw Error('Expected preserved eight-byte scalar');
    if(rule.encoding.byteOrder!=='LE' || rule.encoding.signed!==true || !Number.isSafeInteger(rule.encoding.divisor) || rule.encoding.divisor<=0) throw Error('Eight-byte interpretation requires explicit signedness, byte order and divisor');
    const integer=Buffer.from(raw.rawHex,'hex').readBigInt64LE();
    if(integer % BigInt(rule.encoding.divisor)!==0n) throw Error('Fractional eight-byte conversion requires a separately implemented exact decimal mapping');
    const converted=integer/BigInt(rule.encoding.divisor);
    if(converted>BigInt(Number.MAX_SAFE_INTEGER) || converted<BigInt(Number.MIN_SAFE_INTEGER)) throw Error('Converted scalar exceeds exact JavaScript integer range');
    value=Number(converted);
  }
  const expected=rule.publicType==='site-link'?'string':rule.publicType==='text'?'string':rule.publicType;
  if(typeof value!==expected) throw Error('Public value type differs from declared semantics');
  if(rule.publicType==='site-link' && (!/^\/(ko|en|ja|ru|zh-tw)\/[a-z0-9/_-]*\/$/.test(value) || value.includes('..'))) throw Error('Only explicit localized site routes may be published as links');
  return value;
}
function publishRecord(record,registry,evidence,verifyArtifact=()=>false) {
  checkRegistry(registry);
  const denied=[];
  if(record.dataStatus!=='STRUCTURED' || record.provenance?.localIndexStatus!=='MATCHES_LOCAL_REALTIME_INDEX' || record.valuesSha256!==hashValue(record.rawValues) || record.conditionsSha256!==hashValue(record.conditions)) return {publicRecord:null,denied:[{reason:'Record structure, hashes or currentness invalid'}]};
  const fields=Object.create(null), claims=[];
  for(const rule of registry.allowedFields.filter(r=>r.rootClass===record.identity.rootClass)) {
    try {
      if(!Object.hasOwn(record.rawValues,rule.field)) throw Error('Source field absent');
      const raw=record.rawValues[rule.field], value=interpret(raw,rule);
      const matches=rule.evidenceIds.map(id=>evidence.get(id)).filter(e=>e && e.recordKey===record.recordKey && e.sourceSha256===record.provenance.sourceSha256 && e.conditionsSha256===record.conditionsSha256 && e.field===rule.field && e.rawValueSha256===hashValue(raw) && e.unit===rule.unit && hashValue(e.confirmedValue)===hashValue(value) && e.activationStatus==='CONFIRMED_ACTIVE' && ['GAME_SCREENSHOT','OFFICIAL_DOCUMENT'].includes(e.kind) && typeof e.observedAt==='string' && !Number.isNaN(Date.parse(e.observedAt)) && verifyArtifact(e));
      if(!matches.length) throw Error('No exact condition/value/source-matched active-game evidence');
      if(Object.hasOwn(fields,rule.publicKey)) throw Error('Duplicate public key');
      fields[rule.publicKey]=value; claims.push({ruleId:rule.ruleId,publicKey:rule.publicKey,evidenceIds:matches.map(e=>e.id)});
    } catch(error) { denied.push({ruleId:rule.ruleId,reason:error.message}); }
  }
  if(!Object.keys(fields).length) return {publicRecord:null,denied};
  // Deliberately omit source IDs, file paths, schema, raw values, internal conditions and evidence prose.
  return { publicRecord:{schemaVersion:1,recordKey:record.recordKey,fields},claims,denied };
}
async function publicationPreview({ sourceDir,outputDir,registryFile,evidenceDir }) {
  const source=assertPrivate(sourceDir), summary=JSON.parse(fs.readFileSync(inputWithin(source,'snapshot.json')));
  if(summary.schemaVersion!==1 || summary.blockedTables || summary.conflictingIdentities) throw Error('Blocked or conflicting snapshots cannot publish');
  if(sha(fs.readFileSync(inputWithin(source,'snapshot.sqlite')))!==summary.snapshotIndexSha256) throw Error('Snapshot index hash mismatch');
  const registry=checkRegistry(registryFile?JSON.parse(fs.readFileSync(registryFile)):defaultRegistry);
  const evidence=new Map(), artifacts=new Map();
  let approvedEvidenceRoot=null;
  if(evidenceDir) {
    approvedEvidenceRoot=assertPrivate(evidenceDir,'Evidence directory');
    const entries=JSON.parse(fs.readFileSync(inputWithin(approvedEvidenceRoot,'evidence.json')));
    if(!Array.isArray(entries)) throw Error('Evidence must be an array');
    for(const entry of entries) { if(!entry.id || evidence.has(entry.id)) throw Error('Evidence IDs must be unique'); evidence.set(entry.id,entry); }
  }
  function verifyArtifact(entry) {
    if(!approvedEvidenceRoot || !entry.artifact || !/^[a-f0-9]{64}$/i.test(entry.artifact.sha256 || '')) return false;
    const file=inputWithin(approvedEvidenceRoot,entry.artifact.path);
    if(!artifacts.has(file)) artifacts.set(file,sha(fs.readFileSync(file)));
    return artifacts.get(file)===entry.artifact.sha256.toLowerCase();
  }
  const out=newPrivateDirectory(outputDir), db=new DatabaseSync(inputWithin(source,'snapshot.sqlite'),{readOnly:true});
  const index=db.prepare('SELECT * FROM records WHERE record_key=?');
  const seen=new Set(), publicFd=fs.openSync(path.join(out,'public-preview.jsonl'),'wx'), auditFd=fs.openSync(path.join(out,'publication-audit.jsonl'),'wx');
  const counts={ examined:0,published:0,withheld:0,deniedClaims:0 };
  try {
    for(const table of summary.results) {
      if(table.status!=='STRUCTURED' || !/^[A-Za-z0-9_.-]+$/.test(table.tableName)) throw Error('Invalid snapshot table');
      const file=inputWithin(source,path.join('tables',table.tableName+'.jsonl'));
      if(sha(fs.readFileSync(file))!==table.recordsSha256) throw Error('Normalized records changed since snapshot');
      for await(const line of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})) {
        if(!line) continue; const record=JSON.parse(line);
        const row=index.get(record.recordKey);
        if(!row || row.identity_status==='CONFLICT' || row.values_sha256!==record.valuesSha256 || row.conditions_sha256!==record.conditionsSha256) throw Error('Snapshot identity index mismatch');
        if(seen.has(record.recordKey)) continue; seen.add(record.recordKey);
        const result=publishRecord(record,registry,evidence,verifyArtifact); counts.examined++; counts.deniedClaims+=result.denied.length;
        if(result.publicRecord) { fs.writeSync(publicFd,JSON.stringify(result.publicRecord)+'\n'); counts.published++; } else counts.withheld++;
        if(result.publicRecord || result.denied.length) fs.writeSync(auditFd,JSON.stringify({recordKey:record.recordKey,claims:result.claims || [],denied:result.denied})+'\n');
      }
    }
  } finally { fs.closeSync(publicFd); fs.closeSync(auditFd); db.close(); }
  const report={schemaVersion:1,counts,automaticDeployment:false,defaultPolicy:'deny unless exact evidence matches an allowlisted confirmed field',outputFile:'public-preview.jsonl'};
  fs.writeFileSync(path.join(out,'publication.json'),JSON.stringify(report,null,2)+'\n'); return {outputDir:out,...report};
}
module.exports={ checkRegistry,interpret,publishRecord,publicationPreview };
