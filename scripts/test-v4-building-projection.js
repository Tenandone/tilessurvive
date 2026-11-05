'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const S = require('./sync-v4-building-projection');
const B = require('./building-data-registry');
const M = require('../data/v4-economy.json');
const F = require('../js/v4-economy-math');
const ROOT = path.resolve(__dirname, '..');
const clone = value => structuredClone(value);
const nonBuildings = model => {const result = clone(model); delete result.buildings; return result;};
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const oldKey = row => row.level + ':' + row.rank;

test('V4 sync only replaces building profiles and preserves 21 locale labels, all non-building fields and provenance', () => {
  const before = clone(M), next = S.project(M);
  assert.deepEqual(M, before);
  assert.deepEqual(nonBuildings(next), nonBuildings(M));
  for (const building of next.buildings) {
    const old = M.buildings.find(b => b.id === building.id);
    for (const key of Object.keys(old).filter(key => key !== 'profiles')) assert.deepEqual(building[key], old[key], building.id + ':' + key);
    assert.equal(Object.keys(building.names).length, 21);
    assert.equal(Object.keys(building.nameStatus).length, 21);
  }
  assert.deepEqual(S.validate(next), {buildings:29,profiles:29,rows:761,unknownResourceRows:9,blockedRows:2});
  assert.deepEqual(S.project(next), next, 'Repeated projection is exact');
});

test('all 761 V4 rows use A numeric fields and complete ordered D prerequisites, with no raw model mutation', () => {
  const rawBefore = sha(B.model), next = S.project(M);
  let rows = 0, prerequisites = 0;
  for (const building of next.buildings) {
    assert.deepEqual(building.profiles.map(p => p.id), ['unified']);
    const source = B.model.buildings.find(b => b.id === building.id);
    const a = new Map(source.profiles.find(p => p.id === 'original').rows.map(r => [oldKey(r), r]));
    const d = new Map(source.profiles.find(p => p.id === 'd').rows.map(r => [oldKey(r), r]));
    for (const row of building.profiles[0].rows) {
      const ar = a.get(oldKey(row)), dr = d.get(oldKey(row)); assert(ar && dr);
      for (const key of ['level','rank','resources','seconds','battlePower','constructionItems']) assert.deepEqual(row[key], ar[key] ?? null, building.id + ':' + oldKey(row) + ':' + key);
      assert.deepEqual(row.requirements, dr.requirements === null ? null : dr.requirements.map(q => ({buildingId:q.buildingId,level:q.level,rank:q.rank,route:B.links[q.buildingId] ? '/buildings/' + B.links[q.buildingId] + '/' : null})));
      prerequisites += row.requirements?.length || 0; rows++;
    }
  }
  assert.equal(rows, 761); assert.equal(prerequisites, 803); assert.equal(sha(B.model), rawBefore);
});

test('nine unknown initial costs and two guarded rows remain incomplete in V4 calculations', () => {
  const next = S.project(M), unknown = [], blocked = [];
  for (const b of next.buildings) for (const row of b.profiles[0].rows) {
    if (row.resources === null || row.resources.some(v => v === null)) {
      unknown.push(b.id);
      const q = F.quoteGoal(next, {kind:'building',id:b.id,profile:'unified',from:0,to:row.level});
      assert.equal(q.resources, null); assert.equal(q.seconds, null); assert(q.reasonCodes.includes('buildingIncomplete'));
    }
    if (row.blocked) blocked.push(b.id);
  }
  assert.deepEqual(unknown, [800007,800008,800009,800012,800016,800001,800003,800004,800168]);
  assert.deepEqual(blocked, [800004,800168]);
});

test('V4 validator rejects stale profiles, numeric drift, prerequisite loss, guard removal, identity drift and missing labels', () => {
  const good = S.project(M);
  for (const mutate of [
    x => {x.buildings[1].profiles[0].id = 'original';},
    x => {x.buildings[1].profiles[0].rows[1].resources[0]++;},
    x => {x.buildings[0].profiles[0].rows.find(r => r.requirements.length).requirements.pop();},
    x => {x.buildings.find(b => b.id === 800004).profiles[0].rows[0].blocked = false;},
    x => {x.buildings[1].id = x.buildings[0].id;},
    x => {x.buildings.reverse();},
    x => {delete x.referenceNames[800005];},
    x => {delete x.buildings[0].names.ko;},
    x => {x.sourceEvidence.models[0].sha256 = '0'.repeat(64);}
  ]) {const broken = clone(good); mutate(broken); assert.throws(() => S.validate(broken));}
  assert.deepEqual(S.validate(good), {buildings:29,profiles:29,rows:761,unknownResourceRows:9,blockedRows:2});
});

test('shared projection handles both guard representations and does not invent zeros for unknown values', () => {
  const previous = B.publicBuildings;
  try {
    B.publicBuildings = slug => previous(slug).map(b => ({...b,profiles:b.profiles.map(p => ({...p,rows:p.rows.map(r => {
      if (r.availability !== 'initial_conditions_unconfirmed') return r;
      const result = {...r,calculationBlocked:true}; delete result.availability; return result;
    })}))}));
    const next = S.project(M);
    assert.deepEqual(next.buildings.flatMap(b => b.profiles[0].rows.filter(r => r.blocked).map(() => b.id)), [800004,800168]);
    assert.equal(next.buildings.find(b => b.id === 800004).profiles[0].rows[0].resources, null);
  } finally {B.publicBuildings = previous;}
});

test('the full client generator reuses the same public-building projection', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/build-v4-economy.js'), 'utf8');
  assert.match(source, /require\(['"]\.\/sync-v4-building-projection['"]\)/);
  assert.match(source, /projectBuildings\(\{[^}]*labels:/);
  assert.doesNotMatch(source, /const buildings=B\.slugs\.flatMap/);
  const expected = S.project(M).buildings;
  const direct = S.projectBuildings({labels:b => M.buildings.find(x => x.id === b.id),reference:id => id});
  assert.deepEqual(direct, expected);
});
