'use strict';
const fs = require('node:fs'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { inspectBuffer, TYPE_CODES } = require('./cfg.cjs');
const { assertPrivate, inputWithin, newPrivateDirectory } = require('./paths.cjs');
const { sha, normalizeRecord } = require('./record.cjs');
const incremental = require('./incremental.cjs');
const writeJSON = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
function normalize({ sourceDir, outputDir, tables, previousDir }) {
  const source = assertPrivate(sourceDir, 'Source directory');
  const requestedOutput = assertPrivate(outputDir, 'Output directory');
  if (fs.existsSync(requestedOutput)) throw Error('Output already exists; choose a new snapshot directory');
  const manifestFile = inputWithin(source, 'selected-source-manifest.json');
  const manifestBytes = fs.readFileSync(manifestFile), manifest = JSON.parse(manifestBytes), manifestSha256 = sha(manifestBytes);
  if (!Array.isArray(manifest.entries)) throw Error('Manifest entries array required');
  const allowed = manifest.entries.filter(e => e.filePath && e.currentness === 'MATCHES_LOCAL_REALTIME_INDEX' && !/^account(?:_|$)/i.test(e.tableName));
  if (new Set(allowed.map(e => e.tableName)).size !== allowed.length) throw Error('Duplicate selected table names');
  const requested = tables ? new Set(tables) : null;
  if (requested && [...requested].some(name => !allowed.some(e => e.tableName === name))) throw Error('Requested table is absent, stale, or excluded');
  const selected = allowed.filter(e => !requested || requested.has(e.tableName));
  if (!selected.length) throw Error('No selected CFG tables');
  const normalizationFingerprint=incremental.fingerprint();
  const previous=incremental.openPrevious(previousDir,selected.map(e=>e.tableName),normalizationFingerprint);
  const family = name => name.replace(/_\d+$/, '');
  const neededFamilies = new Set(selected.map(e => family(e.tableName)));
  const schemaCandidates = allowed.filter(e => neededFamilies.has(family(e.tableName)));
  function bytes(e) {
    if (!/^[A-Za-z0-9_.-]+$/.test(e.tableName) || e.tableName === '.' || e.tableName === '..') throw Error('Unsafe table name');
    if (!/^[a-f0-9]{64}$/i.test(e.sha256 || '') || !/^[a-f0-9]{32}$/i.test(e.expectedRealtimeMD5 || '') || e.md5?.toLowerCase() !== e.expectedRealtimeMD5.toLowerCase()) throw Error('Manifest requires SHA256 and exact local-index MD5 match');
    const b = fs.readFileSync(inputWithin(source, e.filePath));
    if (b.length !== e.bytes) throw Error('Input byte count differs from manifest');
    return b;
  }
  const schemas = new Map(), firstErrors = new Map();
  for (const e of schemaCandidates) {
    try {
      const b = bytes(e); if (b.length >= 12 && b.readUInt32LE(8) === b.length) continue;
      const p = inspectBuffer(b, { expectedHashes: e });
      const key = family(e.tableName); if (!schemas.has(key)) schemas.set(key, []);
      schemas.get(key).push({ tableName: e.tableName, sourceSha256: e.sha256, schemaSha256: sha(JSON.stringify(p.schema)), schema: p.schema });
    } catch (error) { firstErrors.set(e.tableName, error); }
  }
  const out = newPrivateDirectory(outputDir);
  for (const sub of ['tables', 'schemas', 'status']) fs.mkdirSync(path.join(out, sub));
  const db = new DatabaseSync(path.join(out, 'snapshot.sqlite'));
  db.exec(`CREATE TABLE records(record_key TEXT PRIMARY KEY, root_class TEXT, source_id TEXT, values_sha256 TEXT, conditions_sha256 TEXT, activation TEXT, identity_status TEXT, copies INTEGER);
    CREATE TABLE sources(record_key TEXT, table_name TEXT, source_sha256 TEXT, row_index INTEGER);
    CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT);`);
  db.prepare('INSERT INTO metadata VALUES(?,?)').run('schemaVersion','1');
  db.prepare('INSERT INTO metadata VALUES(?,?)').run('manifestSha256',manifestSha256);
  const get = db.prepare('SELECT * FROM records WHERE record_key=?');
  const add = db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?,?,1)');
  const copy = db.prepare('UPDATE records SET copies=copies+1,identity_status=? WHERE record_key=?');
  const sourceAdd = db.prepare('INSERT INTO sources VALUES(?,?,?,?)');
  const results = []; let rows = 0, rawType4Scalars = 0;
  for (const e of selected) {
    const status = { tableName:e.tableName, sourceSha256:e.sha256, currentness:e.currentness, status:'UNKNOWN', rows:0, error:null };
    let fd, inTransaction = false;
    try {
      if (firstErrors.has(e.tableName)) throw firstErrors.get(e.tableName);
      const b = bytes(e), options = { expectedHashes:e };
      if (b.readUInt32LE(8) === b.length) {
        const candidates = schemas.get(family(e.tableName)) || [];
        if (new Set(candidates.map(c => c.schemaSha256)).size !== 1) throw Error('Fragment schema unavailable or ambiguous');
        options.inheritedSchema = candidates[0].schema;
        options.inheritedSchemaSource = { tableName:candidates[0].tableName, sourceSha256:candidates[0].sourceSha256, schemaSha256:candidates[0].schemaSha256, method:'same filename family; all row boundaries and IDs subsequently checked' };
      }
      const parsed = inspectBuffer(b, options);
      if (e.declaredRecords !== undefined && e.declaredRecords !== parsed.header.recordCount) throw Error('Declared source record count differs from header');
      if (e.rootClass && e.rootClass !== parsed.rootClass) throw Error('Declared root class differs from embedded or validated family schema');
      const context = { rootClass:parsed.rootClass, category:e.classification?.primaryCategory, tableName:e.tableName, sourceSha256:e.sha256, sourceMD5:e.md5, sourceKind:e.sourceKind, manifestSha256, currentness:e.currentness, schemaSource:parsed.schemaSource, gameVersion:manifest.device?.gameVersion, gameBuild:manifest.device?.build, collectedAt:manifest.createdAt };
      const cached=incremental.reuse(previous,e,parsed,context);
      status.processing=cached.records?'REUSED':'PARSED';status.reuseReason=cached.reason;
      status.reuseContextSha256=incremental.reusableContext(context);
      const schemaFile=path.join(out,'schemas',e.tableName+'.json');
      writeJSON(schemaFile, { schemaVersion:1, sourceSha256:e.sha256, rootClass:parsed.rootClass, schemaSource:parsed.schemaSource, typeCodes:TYPE_CODES, classes:parsed.schema });
      status.schemaFileSha256=incremental.hashFile(schemaFile);
      fd = fs.openSync(path.join(out,'tables',e.tableName+'.jsonl'),'wx'); db.exec('BEGIN'); inTransaction = true;
      const digest = require('node:crypto').createHash('sha256'); let chunk='';
      const records=cached.records?cached.records():(function*(){for(const raw of parsed.records())yield normalizeRecord(raw,context);})();
      for (const record of records) {
        const indexed = get.get(record.recordKey);
        if (indexed) {
          const same = indexed.values_sha256 === record.valuesSha256 && indexed.conditions_sha256 === record.conditionsSha256;
          copy.run(same && indexed.identity_status !== 'CONFLICT' ? 'EQUIVALENT_COPIES' : 'CONFLICT',record.recordKey);
        } else add.run(record.recordKey,record.identity.rootClass,record.identity.sourceId,record.valuesSha256,record.conditionsSha256,'UNKNOWN','UNIQUE');
        sourceAdd.run(record.recordKey,e.tableName,e.sha256,record.provenance.recordIndex);
        const line = JSON.stringify(record)+'\n'; digest.update(line); chunk += line;
        if (chunk.length > 256*1024) { fs.writeSync(fd,chunk); chunk=''; }
        status.rows++;
      }
      if (chunk) fs.writeSync(fd,chunk); fs.closeSync(fd); fd=undefined;
      db.exec('COMMIT'); inTransaction=false;
      status.status='STRUCTURED'; status.recordsSha256=digest.digest('hex'); status.rawType4Scalars=cached.records?cached.rawType4Scalars:parsed.metrics.rawType4Scalars;
      rows += status.rows; rawType4Scalars += status.rawType4Scalars;
    } catch(error) {
      if(inTransaction) db.exec('ROLLBACK'); if(fd !== undefined) fs.closeSync(fd);
      status.status='BLOCKED'; status.partialRowsNotUsable=status.rows; status.error={ code:error.code || 'NORMALIZATION_ERROR', message:error.message }; status.rows=0;
    }
    writeJSON(path.join(out,'status',e.tableName+'.json'),status); results.push(status);
  }
  db.exec('CREATE INDEX sources_record_idx ON sources(record_key)');
  const logical = db.prepare('SELECT COUNT(*) AS count FROM records').get().count;
  const conflicting = db.prepare("SELECT COUNT(*) AS count FROM records WHERE identity_status='CONFLICT'").get().count;
  db.close();
  const summary = { schemaVersion:1, manifestSha256, normalizationFingerprint, incremental:{previousSnapshotIndexSha256:previous?.summary.snapshotIndexSha256??null,reusedTables:results.filter(r=>r.status==='STRUCTURED'&&r.processing==='REUSED').length,parsedTables:results.filter(r=>r.status==='STRUCTURED'&&r.processing==='PARSED').length}, snapshotIndexSha256:sha(fs.readFileSync(path.join(out,'snapshot.sqlite'))), createdAt:new Date().toISOString(), gameVersion:manifest.device?.gameVersion ?? null, gameBuild:manifest.device?.build ?? null, scope:selected.map(e=>e.tableName), localIndexOnly:true, activation:'UNKNOWN', tableCount:selected.length, structuredTables:results.filter(r=>r.status==='STRUCTURED').length, blockedTables:results.filter(r=>r.status==='BLOCKED').length, physicalRows:rows, logicalRecords:logical, conflictingIdentities:conflicting, rawType4Scalars, results };
  writeJSON(path.join(out,'snapshot.json'),summary); return { outputDir:out, ...summary };
}
module.exports = { normalize };
