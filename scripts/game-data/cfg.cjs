'use strict';
// Local data-only CFG reader. No network, executable analysis, root or decryption.
const crypto = require('node:crypto');
const decoder = new TextDecoder('utf-8', { fatal: true });
const TYPE_CODES = Object.freeze({
  0: 'boolean byte; only 0 and 1 accepted',
  3: 'signed little-endian 32-bit integer; game units unresolved',
  4: 'STRUCTURED eight-byte scalar; raw bytes retained, signed LE64 is an unproven candidate',
  6: 'finite little-endian IEEE754 double; game units unresolved',
  7: 'external reference ID; trailing schema tag retained without assigning semantic namespace',
  8: 'relative pointer to ULEB128-length-prefixed UTF-8',
  9: 'relative pointer to count-prefixed map',
  10: 'relative pointer to local class record',
  11: 'relative pointer to count-prefixed array',
  12: 'root class schema marker'
});
class CfgError extends Error {
  constructor(code, message, context = {}) { super(message); this.name = 'CfgError'; this.code = code; this.context = context; }
}
function fail(code, message, context) { throw new CfgError(code, message, context); }
function inspectBuffer(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer)) fail('INPUT', 'Input must be a local Buffer');
  const b = buffer;
  const limits = { maxFileBytes: 512 * 1024 * 1024, maxClasses: 5000, maxFields: 5000, maxRecords: 5000000, maxContainer: 1000000, maxStringBytes: 8 * 1024 * 1024, maxDepth: 20, maxRecordValues: 2000000, ...options.limits };
  if (b.length > limits.maxFileBytes) fail('SIZE_LIMIT', 'File exceeds reader size limit');
  const metrics = { relativePointers: 0, utf8Strings: 0, containers: 0, values: 0, rawType4Scalars: 0, nonzeroReferences: 0, nullReferences: 0 };
  function bound(p, n, label, end = b.length) {
    if (!Number.isSafeInteger(p) || !Number.isSafeInteger(n) || p < 0 || n < 0 || p + n > end) fail('BOUNDS', label + ' outside data range', { offset: p, bytes: n, end });
  }
  const u32 = p => { bound(p, 4, 'u32'); return b.readUInt32LE(p); };
  const i32 = p => { bound(p, 4, 'i32'); return b.readInt32LE(p); };
  bound(0, 16, 'header');
  if (b.subarray(0, 4).toString('hex') !== '1b434647') fail('MAGIC', 'Expected plaintext CFG magic 1b434647');
  const hashes = { sha256: crypto.createHash('sha256').update(b).digest('hex'), md5: crypto.createHash('md5').update(b).digest('hex') };
  for (const key of ['sha256', 'md5']) if (options.expectedHashes?.[key] && options.expectedHashes[key].toLowerCase() !== hashes[key]) fail('HASH_MISMATCH', key + ' differs from selection manifest', { expected: options.expectedHashes[key], actual: hashes[key] });
  const indexOffset = u32(4), schemaOffset = u32(8), recordCount = u32(12);
  if (recordCount > limits.maxRecords) fail('RECORD_LIMIT', 'Record count exceeds limit', { recordCount });
  if (!(16 <= indexOffset && indexOffset < schemaOffset && schemaOffset <= b.length)) fail('HEADER_OFFSETS', 'Invalid index/schema offsets');
  let cursor = schemaOffset;
  const byte = () => { bound(cursor, 1, 'schema byte'); return b[cursor++]; };
  function ulebAt(p, end = b.length) {
    let value = 0, shift = 0, octet;
    do { bound(p, 1, 'ULEB128 byte', end); octet = b[p++]; value += (octet & 127) * 2 ** shift; shift += 7; if (shift > 35) fail('VARINT', 'Length ULEB128 too long'); } while (octet & 128);
    return { value, after: p };
  }
  function schemaName() { const { value: n, after } = ulebAt(cursor); cursor = after; if (n > limits.maxStringBytes) fail('STRING_LIMIT', 'Schema name too long'); bound(cursor, n, 'schema name'); const s = decoder.decode(b.subarray(cursor, cursor + n)); cursor += n; if (!s || /[\u0000-\u001f]/.test(s)) fail('SCHEMA_NAME', 'Invalid schema name'); return s; }
  const schemaU32 = () => { const n = u32(cursor); cursor += 4; return n; };
  function type(code, depth = 0) {
    if (depth > limits.maxDepth) fail('TYPE_DEPTH', 'Nested schema type exceeds limit');
    const t = { code };
    if (code === 7) { t.referenceTag = byte(); t.referenceClass = schemaName(); }
    else if (code === 9) { t.mapKey = type(byte(), depth + 1); t.mapValue = type(byte(), depth + 1); }
    else if (code === 10 || code === 12) t.objectClass = schemaName();
    else if (code === 11) t.arrayItem = type(byte(), depth + 1);
    else if (![0, 3, 4, 6, 8].includes(code)) fail('UNKNOWN_TYPE', 'Unrecognized schema type; no width guessed', { code, offset: cursor - 1 });
    return t;
  }
  let classCount;
  const schema = [], classes = new Map();
  const width = t => t.code === 0 ? 1 : [4, 6].includes(t.code) ? 8 : 4;
  const embeddedSchema = schemaOffset < b.length;
  if (!embeddedSchema) {
    if (!Array.isArray(options.inheritedSchema) || !options.inheritedSchema.length) fail('SCHEMA_REQUIRED', 'Fragment has no embedded schema; a separately validated family schema is required');
    for (const c of structuredClone(options.inheritedSchema)) { schema.push(c); classes.set(c.name, c); }
    classCount = schema.length;
  } else {
   classCount = schemaU32();
   if (classCount < 1 || classCount > limits.maxClasses) fail('CLASS_COUNT', 'Invalid schema class count', { classCount });
   for (let c = 0; c < classCount; c++) {
    const marker = byte(); if (![10, 12].includes(marker)) fail('CLASS_MARKER', 'Unknown schema class marker', { marker });
    const name = schemaName(), fieldCount = schemaU32();
    if (classes.has(name)) fail('DUPLICATE_CLASS', 'Duplicate schema class', { name });
    if (fieldCount > limits.maxFields) fail('FIELD_LIMIT', 'Too many fields', { name, fieldCount });
    let offset = 0; const fields = [], fieldNames = new Set();
    for (let f = 0; f < fieldCount; f++) {
      const code = byte(), fieldName = schemaName();
      if (fieldNames.has(fieldName)) fail('DUPLICATE_FIELD', 'Duplicate field in class', { name, fieldName });
      fieldNames.add(fieldName);
      const field = { name: fieldName, ...type(code), recordByteOffset: offset }; field.storageBytes = width(field); offset += field.storageBytes; fields.push(field);
    }
    const cls = { name, marker, fieldCount, fields, fixedRecordBytes: offset }; schema.push(cls); classes.set(name, cls);
   }
  }
  if (cursor !== b.length) fail('SCHEMA_REMAINDER', 'Unconsumed schema tail', { bytes: b.length - cursor });
  for (const c of schema) {
    let offset = 0;
    if (c.fieldCount !== c.fields.length) fail('INHERITED_SCHEMA', 'Inherited field count differs');
    for (const f of c.fields) { if (f.recordByteOffset !== offset || f.storageBytes !== width(f)) fail('INHERITED_SCHEMA', 'Declared field widths/offsets are inconsistent'); offset += width(f); }
    if (offset !== c.fixedRecordBytes) fail('INHERITED_SCHEMA', 'Declared class width is inconsistent');
  }
  const root = schema[0];
  if (!root.fields.some(f => f.name === 'InternalId' && f.code === 3) || !root.fields.some(f => f.name === 'Id' && f.code === 8)) fail('ROOT_ID_SCHEMA', 'Expected explicit InternalId integer and Id string fields');
  if (u32(indexOffset) !== recordCount) fail('INDEX_COUNT', 'Header and record index counts differ');
  bound(indexOffset + 4, recordCount * 4, 'record offset vector', schemaOffset);
  const recordOffsets = Array.from({ length: recordCount }, (_, i) => u32(indexOffset + 4 + 4 * i));
  const idVectorOffset = indexOffset + 4 + 4 * recordCount;
  if (u32(idVectorOffset) !== recordCount) fail('ID_VECTOR_COUNT', 'Internal-ID vector count differs');
  if (idVectorOffset + 8 + recordCount * 4 !== schemaOffset) fail('INDEX_SPAN', 'Index footer does not meet schema');
  const internalIds = Array.from({ length: recordCount }, (_, i) => u32(idVectorOffset + 4 + 4 * i));
  const poolEnd = recordCount ? recordOffsets[0] : indexOffset;
  if (poolEnd < 16) fail('POOL_START', 'Value pool overlaps header');
  let expectedOffset = poolEnd;
  for (const p of recordOffsets) { if (p !== expectedOffset) fail('ROW_STRIDE', 'Record offset differs from declared field width', { offset: p, expectedOffset }); bound(p, root.fixedRecordBytes, 'record', indexOffset); expectedOffset += root.fixedRecordBytes; }
  if (expectedOffset !== indexOffset) fail('LAST_RECORD_BOUNDARY', 'Final row does not meet index');
  const seenStringIds = new Set(), seenInternalIds = new Set();
  function pointer(p) {
    const relative = i32(p); if (!relative) return null;
    const target = p + 4 + relative;
    if (target < 16 || target >= poolEnd) fail('POINTER_TARGET', 'Relative pointer leaves the preceding value pool', { offset: p, target, poolEnd });
    metrics.relativePointers++; return target;
  }
  function stringAt(q) {
    const { value: n, after } = ulebAt(q, poolEnd);
    if (n > limits.maxStringBytes) fail('STRING_LIMIT', 'String exceeds limit', { length: n });
    bound(after, n, 'UTF-8 string', poolEnd); const s = decoder.decode(b.subarray(after, after + n));
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) fail('STRING_CONTROL', 'Unexpected control byte in string', { offset: q });
    metrics.utf8Strings++; return s;
  }
  function recordAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= recordCount) fail('ROW_INDEX', 'Row index out of range');
    let budget = limits.maxRecordValues; const references = [];
    function read(t, p, fieldPath, depth = 0, nested = false) {
      if (--budget < 0) fail('RECORD_VALUE_LIMIT', 'Record exceeds value budget');
      if (depth > limits.maxDepth) fail('VALUE_DEPTH', 'Nested values exceed depth limit');
      bound(p, width(t), 'field', nested ? poolEnd : indexOffset); metrics.values++;
      if (t.code === 0) { if (b[p] > 1) fail('BOOLEAN', 'Boolean byte is not 0 or 1', { offset: p, value: b[p] }); return b[p] === 1; }
      if (t.code === 3) return i32(p);
      if (t.code === 4) { metrics.rawType4Scalars++; return { status: 'STRUCTURED', rawTypeCode: 4, rawHex: b.subarray(p, p + 8).toString('hex'), signedLE64Candidate: b.readBigInt64LE(p).toString(), encodingStatus: 'Eight-byte width validated; integer interpretation and game units unresolved' }; }
      if (t.code === 6) { const v = b.readDoubleLE(p); if (!Number.isFinite(v)) fail('NONFINITE_DOUBLE', 'Non-finite double', { offset: p }); return v; }
      if (t.code === 7) { const id = u32(p); metrics[id ? 'nonzeroReferences' : 'nullReferences']++; const ref = { internalId: id, referenceClass: t.referenceClass, referenceTag: t.referenceTag }; if (id) references.push({ fieldPath, ...ref }); return ref; }
      if (t.code === 8) { const q = pointer(p); return q === null ? null : stringAt(q); }
      if (t.code === 10 || t.code === 12) {
        const c = classes.get(t.objectClass); if (!c) fail('LOCAL_CLASS_MISSING', 'Referenced local class is absent', { className: t.objectClass });
        const q = pointer(p); if (q === null) return null; bound(q, c.fixedRecordBytes, 'local class', poolEnd);
        const o = Object.create(null); for (const f of c.fields) o[f.name] = read(f, q + f.recordByteOffset, fieldPath + '.' + f.name, depth + 1, true); return o;
      }
      if (t.code === 9 || t.code === 11) {
        const q = pointer(p); if (q === null) return null; const count = u32(q);
        if (count > limits.maxContainer) fail('CONTAINER_LIMIT', 'Container count exceeds limit', { count }); metrics.containers++;
        let at = q + 4; const values = [];
        const step = t.code === 11 ? width(t.arrayItem) : width(t.mapKey) + width(t.mapValue); bound(at, count * step, 'container', poolEnd);
        for (let i = 0; i < count; i++) {
          if (t.code === 11) { values.push(read(t.arrayItem, at, fieldPath + '[' + i + ']', depth + 1, true)); at += step; }
          else { const key = read(t.mapKey, at, fieldPath + '[' + i + '].key', depth + 1, true); at += width(t.mapKey); const value = read(t.mapValue, at, fieldPath + '[' + i + '].value', depth + 1, true); at += width(t.mapValue); values.push({ key, value }); }
        }
        return values;
      }
      fail('VALUE_TYPE', 'Unsupported field type', { code: t.code });
    }
    const row = Object.create(null), offset = recordOffsets[index];
    for (const f of root.fields) row[f.name] = read(f, offset + f.recordByteOffset, f.name);
    if (row.InternalId !== internalIds[index]) fail('ROW_ID_MISMATCH', 'InternalId differs from indexed ID', { index, actual: row.InternalId, expected: internalIds[index] });
    if (typeof row.Id !== 'string' || !row.Id.length) fail('ROW_STRING_ID', 'Missing nonempty string ID');
    return { index, offset, row, references };
  }
  function * records() {
    seenStringIds.clear(); seenInternalIds.clear();
    for (let index = 0; index < recordCount; index++) {
      const record = recordAt(index);
      if (seenStringIds.has(record.row.Id)) fail('DUPLICATE_STRING_ID', 'Duplicate string ID', { index, id: record.row.Id });
      if (seenInternalIds.has(record.row.InternalId)) fail('DUPLICATE_INTERNAL_ID', 'Duplicate internal ID', { index, id: record.row.InternalId });
      seenStringIds.add(record.row.Id); seenInternalIds.add(record.row.InternalId); yield record;
    }
  }
  return { header: { magic: '1b434647', indexOffset, schemaOffset, recordCount, classCount, valuePoolEnd: poolEnd, embeddedSchema }, sizeBytes: b.length, hashes, schema, schemaSource: embeddedSchema ? 'embedded' : options.inheritedSchemaSource || 'caller-supplied; family validation required', rootClass: root.name, rootReferenceTag: null, rootNamespaceStatus: 'Schema declares class, but no root namespace tag is established', metrics, recordAt, records, typeCodes: TYPE_CODES };
}
module.exports = { inspectBuffer, CfgError, TYPE_CODES };
