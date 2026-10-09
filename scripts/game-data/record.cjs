'use strict';
const crypto = require('node:crypto');
const registry = require('./semantics.json');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
}
const hashValue = value => sha(stable(value));
function keyFor(rootClass, internalId) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(rootClass) || !Number.isSafeInteger(internalId) || internalId <= 0) throw Error('Invalid record identity');
  return 'tscfg:' + rootClass + ':' + internalId;
}
function normalizeRecord(record, context) {
  const row = record.row;
  const conditions = { gameVersion: context.gameVersion ?? null, gameBuild: context.gameBuild ?? null, observedConditions: null, rawConfigConditions: Object.fromEntries(registry.conditionFields.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]])) };
  return {
    schemaVersion: 1,
    recordKey: keyFor(context.rootClass, row.InternalId),
    identity: { rootClass: context.rootClass, internalId: row.InternalId, sourceId: row.Id },
    category: context.category || 'unclassified',
    dataStatus: 'STRUCTURED',
    activation: { status: 'UNKNOWN', reason: 'Local configuration presence does not establish release or account eligibility' },
    conditions,
    conditionsSha256: hashValue(conditions),
    provenance: { tableName: context.tableName, sourceSha256: context.sourceSha256, sourceMD5: context.sourceMD5, sourceKind: context.sourceKind, sourceManifestSha256: context.manifestSha256, localIndexStatus: context.currentness, collectedAt: context.collectedAt ?? null, schemaSource: context.schemaSource, recordIndex: record.index, recordByteOffset: record.offset },
    valuesSha256: hashValue(row),
    rawValues: row,
    references: record.references.map(ref => ({ fieldPath: ref.fieldPath, targetRecordKey: ref.referenceTag === 0 ? keyFor(ref.referenceClass, ref.internalId) : null, internalId: ref.internalId, targetClass: ref.referenceClass, rawReferenceTag: ref.referenceTag, status: ref.referenceTag === 0 ? 'UNRESOLVED_TARGET' : 'UNRESOLVED_REFERENCE_TAG' }))
  };
}
module.exports = { sha, stable, hashValue, keyFor, normalizeRecord };
