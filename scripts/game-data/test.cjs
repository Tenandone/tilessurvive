'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {inspectBuffer}=require('./cfg.cjs');
const {normalize}=require('./normalize.cjs');
const {diffSnapshots}=require('./diff.cjs');
const {publishRecord,publicationPreview,interpret,checkRegistry}=require('./publication.cjs');
const {assertPrivate,inputWithin,within}=require('./paths.cjs');
const {sha,hashValue}=require('./record.cjs');
const sourceDir=process.env.TILES_CFG_SOURCE_DIR;
if(!sourceDir) throw Error('Set TILES_CFG_SOURCE_DIR to the approved private manifest directory; tests never download fixtures');
const manifest=JSON.parse(fs.readFileSync(path.join(sourceDir,'selected-source-manifest.json')));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'tiles-cfg-test-'));
const fixtureDir=path.join(temp,'source'); fs.mkdirSync(fixtureDir);
const fixtures=manifest.entries.filter(e=>['pet_base','pet_level'].includes(e.tableName));
assert.equal(fixtures.length,2,'Actual pet_base and pet_level fixtures required');
const entries=fixtures.map(e=>{
  const filePath=path.join(fixtureDir,e.tableName+'.bin'); fs.copyFileSync(e.filePath,filePath); return {...e,filePath};
});
fs.writeFileSync(path.join(fixtureDir,'selected-source-manifest.json'),JSON.stringify({...manifest,entries}));
const snapshot=path.join(temp,'snapshot');
const result=normalize({sourceDir:fixtureDir,outputDir:snapshot});
const first=JSON.parse(fs.readFileSync(path.join(snapshot,'tables','pet_level.jsonl'),'utf8').split('\n')[0]);
const clone=x=>structuredClone(x);
function claims(record=first) {
  const rule={ruleId:'test-only-level-exp',rootClass:'PetLevel',field:'LevelExp',publicKey:'experience',status:'CONFIRMED',meaning:'Synthetic test assertion; not gameplay confirmation',unit:'test-units',publicType:'number',encoding:{kind:'identity'},evidenceIds:['test-evidence']};
  const evidence={id:'test-evidence',kind:'GAME_SCREENSHOT',recordKey:record.recordKey,sourceSha256:record.provenance.sourceSha256,conditionsSha256:record.conditionsSha256,field:'LevelExp',rawValueSha256:hashValue(record.rawValues.LevelExp),unit:'test-units',confirmedValue:record.rawValues.LevelExp,activationStatus:'CONFIRMED_ACTIVE',observedAt:'2026-10-09T00:00:00Z'};
  return {registry:{schemaVersion:1,allowedFields:[rule]},evidence:new Map([[evidence.id,evidence]])};
}
test('actual approved CFG files normalize without lost rows, IDs or level conditions',()=>{
  assert.equal(result.blockedTables,0); assert.equal(result.tableCount,2);
  assert.equal(result.physicalRows,entries.reduce((sum,e)=>sum+e.declaredRecords,0));
  assert.equal(first.identity.sourceId,'pet_seal_level_1'); assert.equal(first.rawValues.LevelExp,110);
  assert.equal(first.conditions.rawConfigConditions.Level,1); assert.equal(first.activation.status,'UNKNOWN');
  assert.equal(first.provenance.sourceSha256,entries.find(e=>e.tableName==='pet_level').sha256);
  assert.equal(first.valuesSha256,hashValue(first.rawValues));
  assert.ok(first.references.some(ref=>ref.targetRecordKey==='tscfg:PetBase:173800001'));
});
test('raw output is rejected inside the public repository and symlinked public roots',()=>{
  assert.throws(()=>assertPrivate(path.resolve(__dirname,'../../data/raw-test')),/outside/);
  const link=path.join(temp,'repo-link');fs.symlinkSync(path.resolve(__dirname,'../..'),link,'junction');
  assert.throws(()=>assertPrivate(path.join(link,'output')),/outside/);
  const privateWorkspace=path.join(temp,'private-workspace');fs.mkdirSync(privateWorkspace);fs.mkdirSync(path.join(privateWorkspace,'.git'));
  assert.equal(assertPrivate(privateWorkspace),fs.realpathSync(privateWorkspace));
  assert.throws(()=>inputWithin(fixtureDir,path.join(snapshot,'snapshot.json')),/escapes/);
});
test('source SHA mismatch and invalid magic are rejected by the actual parser',()=>{
  const entry=entries[0], bytes=fs.readFileSync(entry.filePath);
  assert.throws(()=>inspectBuffer(bytes,{expectedHashes:{sha256:'0'.repeat(64)}}),error=>error.code==='HASH_MISMATCH');
  const bad=Buffer.from(bytes);bad[0]=0;
  assert.throws(()=>inspectBuffer(bad),error=>error.code==='MAGIC');
});
test('stale manifests, overwritten outputs and missing selected tables fail closed',()=>{
  assert.throws(()=>normalize({sourceDir:fixtureDir,outputDir:snapshot}),/already exists/);
  assert.throws(()=>normalize({sourceDir:fixtureDir,outputDir:path.join(temp,'absent'),tables:['unknown_table']}),/absent/);
  const invalid=path.join(temp,'invalid-source');fs.mkdirSync(invalid);
  fs.writeFileSync(path.join(invalid,'selected-source-manifest.json'),JSON.stringify({entries:entries.map(e=>({...e,currentness:'STALE'}))}));
  assert.throws(()=>normalize({sourceDir:invalid,outputDir:path.join(temp,'invalid-output')}),/No selected/);
});
test('default registry withholds every actual record and copies no raw fields to public preview',async()=>{
  const output=path.join(temp,'preview'); const published=await publicationPreview({sourceDir:snapshot,outputDir:output});
  assert.equal(published.counts.published,0); assert.equal(published.counts.examined,result.logicalRecords);
  assert.equal(fs.readFileSync(path.join(output,'public-preview.jsonl'),'utf8'),'');
});
test('explicit matched test evidence admits only a listed scalar; independent artifact verification is required',()=>{
  const {registry,evidence}=claims();
  assert.equal(publishRecord(first,registry,evidence).publicRecord,null);
  const admitted=publishRecord(first,registry,evidence,()=>true).publicRecord;
  assert.deepEqual(Object.keys(admitted),['schemaVersion','recordKey','fields']);
  assert.equal(admitted.fields.experience,110); assert.equal(admitted.rawValues,undefined); assert.equal(admitted.provenance,undefined);
});
test('source, level-condition, raw-value and activation mismatches cannot publish',()=>{
  for(const [key,value] of [['sourceSha256','0'.repeat(64)],['conditionsSha256','0'.repeat(64)],['rawValueSha256','0'.repeat(64)],['activationStatus','UNKNOWN'],['confirmedValue',111]]) {
    const {registry,evidence}=claims();evidence.get('test-evidence')[key]=value;
    assert.equal(publishRecord(first,registry,evidence,()=>true).publicRecord,null,key);
  }
  const mutated=clone(first);mutated.conditions.rawConfigConditions.Level=2;
  const {registry,evidence}=claims();assert.equal(publishRecord(mutated,registry,evidence,()=>true).publicRecord,null);
});
test('unconfirmed semantic rules and undeclared links are not accepted',()=>{
  const {registry}=claims();registry.allowedFields[0].status='STRUCTURED';
  assert.throws(()=>checkRegistry(registry),/CONFIRMED/);
  const rule={encoding:{kind:'identity'},publicType:'site-link'};
  assert.throws(()=>interpret('https://unapproved.example/',rule),/localized site routes/);
  assert.throws(()=>interpret('/ko/../data/',rule),/localized site routes/);
  assert.equal(interpret('/ko/pets/',rule),'/ko/pets/');
});
test('actual type-4 bytes are preserved and require explicit exact semantics',()=>{
  const entry=manifest.entries.find(e=>e.tableName==='research_main');assert.ok(entry);
  const parsed=inspectBuffer(fs.readFileSync(entry.filePath),{expectedHashes:entry});
  let raw;
  function find(value){if(!value || typeof value!=='object')return;if(value.rawTypeCode===4){raw ||=value;return;}for(const v of Object.values(value))find(v);}
  for(const record of parsed.records()){find(record.row);if(raw)break;}
  assert.ok(raw);assert.equal(raw.rawHex.length,16);assert.equal(raw.status,'STRUCTURED');
  assert.throws(()=>interpret(raw,{encoding:{kind:'identity'},publicType:'number'}),/scalar/);
  assert.throws(()=>interpret(raw,{encoding:{kind:'signed-le64'},publicType:'number'}),/explicit/);
  const b=Buffer.from(raw.rawHex,'hex');assert.equal(b.readBigInt64LE().toString(),raw.signedLE64Candidate);
});
test('identical on-demand snapshots produce zero false changes',()=>{
  const other=path.join(temp,'same-snapshot');normalize({sourceDir:fixtureDir,outputDir:other});
  const diff=diffSnapshots({beforeDir:snapshot,afterDir:other,outputDir:path.join(temp,'same-diff')});
  assert.deepEqual(diff.counts,{added:0,modified:0,deleted:0,activationUnknown:0,unchanged:result.logicalRecords});
});
test('diff reports added/modified/deleted as snapshot changes with unknown activation',()=>{
  const other=path.join(temp,'changed-snapshot');normalize({sourceDir:fixtureDir,outputDir:other});
  const db=new DatabaseSync(path.join(other,'snapshot.sqlite'));
  const rows=db.prepare('SELECT * FROM records ORDER BY record_key LIMIT 2').all();
  db.prepare('DELETE FROM records WHERE record_key=?').run(rows[0].record_key);
  db.prepare('UPDATE records SET values_sha256=? WHERE record_key=?').run('f'.repeat(64),rows[1].record_key);
  db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?,?,?)').run('tscfg:TestOnly:999','TestOnly','test-only-added','a'.repeat(64),'b'.repeat(64),'UNKNOWN','UNIQUE',1);db.close();
  // Synthetic snapshot-control mutations are intentional, never game observations.
  const summaryFile=path.join(other,'snapshot.json'), changedSummary=JSON.parse(fs.readFileSync(summaryFile));
  changedSummary.snapshotIndexSha256=sha(fs.readFileSync(path.join(other,'snapshot.sqlite')));fs.writeFileSync(summaryFile,JSON.stringify(changedSummary));
  const output=path.join(temp,'changed-diff'), diff=diffSnapshots({beforeDir:snapshot,afterDir:other,outputDir:output});
  assert.equal(diff.counts.added,1);assert.equal(diff.counts.modified,1);assert.equal(diff.counts.deleted,1);assert.equal(diff.counts.activationUnknown,3);
  for(const line of fs.readFileSync(path.join(output,'changes.jsonl'),'utf8').trim().split('\n'))assert.equal(JSON.parse(line).activationStatus,'UNKNOWN');
});
test('scope or blocked-table mismatch cannot create misleading deletion changes',()=>{
  const subset=path.join(temp,'subset');normalize({sourceDir:fixtureDir,outputDir:subset,tables:['pet_base']});
  assert.throws(()=>diffSnapshots({beforeDir:snapshot,afterDir:subset,outputDir:path.join(temp,'bad-diff')}),/scope differs/);
  const file=path.join(subset,'snapshot.json'), summary=JSON.parse(fs.readFileSync(file));summary.blockedTables=1;fs.writeFileSync(file,JSON.stringify(summary));
  assert.throws(()=>diffSnapshots({beforeDir:subset,afterDir:subset,outputDir:path.join(temp,'blocked-diff')}),/Incomplete/);
});
test('snapshot index tampering blocks diff and publication',async()=>{
  const other=path.join(temp,'tampered-snapshot');normalize({sourceDir:fixtureDir,outputDir:other});
  const db=new DatabaseSync(path.join(other,'snapshot.sqlite'));db.exec('DELETE FROM records');db.close();
  assert.throws(()=>diffSnapshots({beforeDir:snapshot,afterDir:other,outputDir:path.join(temp,'tampered-diff')}),/hash mismatch/);
  await assert.rejects(publicationPreview({sourceDir:other,outputDir:path.join(temp,'tampered-preview')}),/hash mismatch/);
});

test('incremental same-input run reuses actual tables with identical normalized bytes',()=>{
  const other=path.join(temp,'incremental-identical');
  const next=normalize({sourceDir:fixtureDir,outputDir:other,previousDir:snapshot});
  assert.equal(next.blockedTables,0);assert.deepEqual(next.incremental.reusedTables,2);assert.equal(next.incremental.parsedTables,0);
  assert.equal(next.logicalRecords,result.logicalRecords);
  for(const entry of entries)assert.equal(fs.readFileSync(path.join(other,'tables',entry.tableName+'.jsonl'),'utf8'),fs.readFileSync(path.join(snapshot,'tables',entry.tableName+'.jsonl'),'utf8'));
});

function changedSource(name,change){
  const directory=path.join(temp,name);fs.mkdirSync(directory);
  const changed=clone(JSON.parse(fs.readFileSync(path.join(fixtureDir,'selected-source-manifest.json'))));
  changed.entries=changed.entries.map(entry=>{const filePath=path.join(directory,entry.tableName+'.bin');fs.copyFileSync(entry.filePath,filePath);return {...entry,filePath};});
  change(changed,directory);fs.writeFileSync(path.join(directory,'selected-source-manifest.json'),JSON.stringify(changed));return directory;
}

test('one changed actual CFG row is parsed while unchanged tables reuse and receive new manifest provenance',()=>{
  const directory=changedSource('incremental-source-change',changed=>{
    const entry=changed.entries.find(e=>e.tableName==='pet_level'),b=fs.readFileSync(entry.filePath),parsed=inspectBuffer(b),raw=parsed.records().next().value;
    const field=parsed.schema.find(c=>c.name===parsed.rootClass).fields.find(f=>f.name==='LevelExp');
    assert.equal(field.code,3);b.writeInt32LE(111,raw.offset+field.recordByteOffset);fs.writeFileSync(entry.filePath,b);
    const hashes=inspectBuffer(b).hashes;entry.sha256=hashes.sha256;entry.md5=hashes.md5;entry.expectedRealtimeMD5=hashes.md5;
  });
  const other=path.join(temp,'incremental-one-change'),next=normalize({sourceDir:directory,outputDir:other,previousDir:snapshot});
  assert.equal(next.blockedTables,0);assert.equal(next.incremental.reusedTables,1);assert.equal(next.incremental.parsedTables,1);
  assert.notEqual(next.manifestSha256,result.manifestSha256);
  const pet=JSON.parse(fs.readFileSync(path.join(other,'tables','pet_base.jsonl'),'utf8').split('\n')[0]);
  assert.equal(pet.provenance.sourceManifestSha256,next.manifestSha256);
  const changed=JSON.parse(fs.readFileSync(path.join(other,'tables','pet_level.jsonl'),'utf8').split('\n')[0]);assert.equal(changed.rawValues.LevelExp,111);
  const delta=diffSnapshots({beforeDir:snapshot,afterDir:other,outputDir:path.join(temp,'incremental-diff')});
  assert.equal(delta.counts.modified,1);assert.equal(delta.counts.added,0);assert.equal(delta.counts.deleted,0);
});

test('collection metadata is rebound explicitly while version and source provenance changes invalidate reuse',()=>{
  const collection=changedSource('incremental-new-collection',m=>{m.createdAt='2026-10-10T00:00:00Z';});
  const directory=path.join(temp,'incremental-rebound'),next=normalize({sourceDir:collection,outputDir:directory,previousDir:snapshot});
  assert.equal(next.incremental.reusedTables,2);
  const row=JSON.parse(fs.readFileSync(path.join(directory,'tables','pet_level.jsonl'),'utf8').split('\n')[0]);
  assert.equal(row.provenance.collectedAt,'2026-10-10T00:00:00Z');assert.equal(row.provenance.sourceManifestSha256,next.manifestSha256);
  const version=changedSource('incremental-version-change',m=>{m.device.build+=1;});
  const newer=normalize({sourceDir:version,outputDir:path.join(temp,'incremental-version'),previousDir:snapshot});assert.equal(newer.incremental.reusedTables,0);assert.equal(newer.incremental.parsedTables,2);
  const provenance=changedSource('incremental-kind-change',m=>{m.entries[0].sourceKind='synthetic-test-source';});
  const changed=normalize({sourceDir:provenance,outputDir:path.join(temp,'incremental-provenance'),previousDir:snapshot});assert.equal(changed.incremental.reusedTables,1);assert.equal(changed.incremental.parsedTables,1);
});

function snapshotCopy(name){const directory=path.join(temp,name);fs.cpSync(snapshot,directory,{recursive:true});return directory;}
test('unrecorded or changed normalization policy cannot reuse older normalized rows',()=>{
  const directory=snapshotCopy('incremental-old-policy'),file=path.join(directory,'snapshot.json'),s=JSON.parse(fs.readFileSync(file));delete s.normalizationFingerprint;fs.writeFileSync(file,JSON.stringify(s));
  const next=normalize({sourceDir:fixtureDir,outputDir:path.join(temp,'incremental-policy-reparse'),previousDir:directory});
  assert.equal(next.blockedTables,0);assert.equal(next.incremental.reusedTables,0);assert.equal(next.incremental.parsedTables,2);
});
test('cache schema/records corruption blocks the affected table rather than reusing or hiding corruption',()=>{
  for(const kind of ['schemas','tables']){
    const directory=snapshotCopy('incremental-corrupt-'+kind),suffix=kind==='tables'?'.jsonl':'.json';fs.appendFileSync(path.join(directory,kind,'pet_level'+suffix),' ');
    const next=normalize({sourceDir:fixtureDir,outputDir:path.join(temp,'incremental-corrupt-output-'+kind),previousDir:directory});
    assert.equal(next.blockedTables,1);assert.match(next.results.find(r=>r.tableName==='pet_level').error.message,/hash mismatch/);
  }
});
test('rehashed cached record with forged provenance still fails condition and identity validation',()=>{
  const directory=snapshotCopy('incremental-forged-record'),file=path.join(directory,'tables','pet_level.jsonl');
  const lines=fs.readFileSync(file,'utf8').trimEnd().split('\n'),row=JSON.parse(lines[0]);row.provenance.sourceManifestSha256='0'.repeat(64);lines[0]=JSON.stringify(row);fs.writeFileSync(file,lines.join('\n')+'\n');
  const summaryFile=path.join(directory,'snapshot.json'),s=JSON.parse(fs.readFileSync(summaryFile));s.results.find(r=>r.tableName==='pet_level').recordsSha256=sha(fs.readFileSync(file));fs.writeFileSync(summaryFile,JSON.stringify(s));
  const next=normalize({sourceDir:fixtureDir,outputDir:path.join(temp,'incremental-forged-output'),previousDir:directory});assert.equal(next.blockedTables,1);assert.match(next.results.find(r=>r.tableName==='pet_level').error.message,/provenance mismatch/);
});
test('incremental snapshots reject changed scope, corrupted index and public prior-directory targets',()=>{
  assert.throws(()=>normalize({sourceDir:fixtureDir,outputDir:path.join(temp,'incremental-scope'),previousDir:snapshot,tables:['pet_base']}),/scope differs/);
  const directory=snapshotCopy('incremental-corrupt-index');fs.appendFileSync(path.join(directory,'snapshot.sqlite'),' ');
  assert.throws(()=>normalize({sourceDir:fixtureDir,outputDir:path.join(temp,'incremental-index'),previousDir:directory}),/index hash mismatch/);
  assert.throws(()=>normalize({sourceDir:fixtureDir,outputDir:path.join(temp,'incremental-public'),previousDir:path.resolve(__dirname,'../..')}),/outside/);
});
test.after(()=>{
  const actual=fs.realpathSync(temp), expected=fs.realpathSync(os.tmpdir());
  assert.ok(within(expected,actual) && path.basename(actual).startsWith('tiles-cfg-test-'));
  fs.rmSync(actual,{recursive:true,force:true});
});
