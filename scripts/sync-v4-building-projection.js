'use strict';

// Explicit derived-model synchronization. This never reads the private client
// corpus or changes labels, source evidence, or any non-building model field.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const FILE = 'data/v4-economy.json';
const clone = value => structuredClone(value);
const registry = root => require(path.join(root, 'scripts/building-data-registry'));
const canonical = root => { const b = registry(root); return b.slugs.flatMap(slug => b.publicBuildings(slug)); };

function checkLabels(value, codes, id) {
  assert(value && typeof value === 'object', 'Missing building labels ' + id);
  for (const key of ['names', 'nameStatus']) {
    assert(value[key] && typeof value[key] === 'object', 'Missing building ' + key + ' ' + id);
    assert.deepEqual(Object.keys(value[key]).sort(), codes.slice().sort(), 'Building locale coverage ' + id + ':' + key);
    for (const text of Object.values(value[key])) assert(typeof text === 'string' && text.trim(), 'Empty building label ' + id);
  }
  assert(value.nameKey === null || typeof value.nameKey === 'string' && value.nameKey.trim(), 'Missing building name key ' + id);
  return {names:clone(value.names), nameStatus:clone(value.nameStatus), nameKey:value.nameKey};
}

// Shared by the full client generator and the bounded existing-model sync.
function projectBuildings({labels, reference, root = ROOT} = {}) {
  assert.equal(typeof labels, 'function', 'Building label resolver required');
  assert.equal(typeof reference, 'function', 'Building reference resolver required');
  const b = registry(root), codes = require(path.join(root, 'data/i18n/locales.json')).locales.map(x => x.code);
  return canonical(root).map(building => ({
    id:building.id, slug:building.slug,
    ...checkLabels(labels(building), codes, building.id),
    profiles:building.profiles.map(profile => ({
      id:profile.id,
      rows:profile.rows.map(row => ({
        level:row.level, rank:row.rank, resources:clone(row.resources), seconds:row.seconds,
        battlePower:row.battlePower ?? null, constructionItems:clone(row.constructionItems),
        requirements:row.requirements === null ? null : row.requirements.map(q => {
          assert.equal(reference(q.buildingId, q.name || b.names[q.buildingId] || {en:String(q.buildingId)}), q.buildingId, 'Building reference identity');
          return {buildingId:q.buildingId, level:q.level, rank:q.rank, route:b.links[q.buildingId] ? '/buildings/' + b.links[q.buildingId] + '/' : null};
        }),
        blocked:row.calculationBlocked === true || row.availability === 'initial_conditions_unconfirmed'
      }))
    }))
  }));
}

function checkSourceEvidence(model, root) {
  assert(Array.isArray(model.sourceEvidence?.models) && model.sourceEvidence.models.length, 'Missing source model evidence');
  const seen = new Set();
  for (const source of model.sourceEvidence.models) {
    assert(typeof source.file === 'string' && /^data\/[a-zA-Z0-9_./-]+\.json$/.test(source.file), 'Invalid source model path');
    const file = path.resolve(root, source.file), relative = path.relative(root, file);
    assert(!relative.startsWith('..') && !path.isAbsolute(relative), 'Source model path outside repository');
    assert(!seen.has(source.file), 'Duplicate source model evidence'); seen.add(source.file);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), source.sha256, 'Source model evidence changed: ' + source.file);
  }
}

function project(model, {root = ROOT} = {}) {
  assert.equal(model.schemaVersion, 1, 'V4 schema version');
  assert.equal(model.gameVersion, registry(root).model.gameVersion, 'V4 building game version');
  checkSourceEvidence(model, root);
  const source = canonical(root);
  assert.deepEqual(model.buildings.map(b => [b.id, b.slug]), source.map(b => [b.id, b.slug]), 'V4 building identities/order differ from registry');
  const previous = new Map(model.buildings.map(b => [b.id, b]));
  const buildings = projectBuildings({root, labels:b => previous.get(b.id), reference:id => {
    assert(model.referenceNames && Object.hasOwn(model.referenceNames, id), 'Missing existing reference label ' + id);
    return id;
  }});
  const result = clone(model);
  result.buildings = buildings.map(b => ({...clone(previous.get(b.id)), profiles:b.profiles}));
  return result;
}

function validate(model, {root = ROOT} = {}) {
  if (model === undefined) model = JSON.parse(fs.readFileSync(path.join(root, FILE), 'utf8'));
  const expected = project(model, {root});
  assert.deepEqual(model.buildings, expected.buildings, 'V4 building projection is stale or differs from the canonical public registry');
  const rows = model.buildings.flatMap(b => b.profiles.flatMap(p => p.rows));
  return {buildings:model.buildings.length, profiles:model.buildings.reduce((sum, b) => sum + b.profiles.length, 0), rows:rows.length,
    unknownResourceRows:rows.filter(r => r.resources === null || r.resources.some(v => v === null)).length,
    blockedRows:rows.filter(r => r.blocked).length};
}

function sync({root = ROOT} = {}) {
  const file = path.join(root, FILE), before = fs.readFileSync(file, 'utf8');
  const model = project(JSON.parse(before), {root}), summary = validate(model, {root}), after = JSON.stringify(model) + '\n';
  const changed = after !== before;
  if (changed) fs.writeFileSync(file, after);
  return {...summary, changed};
}

module.exports = {ROOT, FILE, projectBuildings, project, validate, sync};
if (require.main === module) {
  assert(process.argv.length === 2 || process.argv.length === 3 && process.argv[2] === '--write', 'Use --write for explicit V4 building synchronization; no argument validates only');
  console.log(JSON.stringify(process.argv[2] === '--write' ? sync() : validate()));
}
