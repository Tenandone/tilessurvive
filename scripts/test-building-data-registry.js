'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const registry = require('./building-data-registry');
const fixture = require('./building-data/baseline-7a82e23b.json');
const runtime = require('../js/building-system');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('central registry preserves the frozen 7a82e23b model, effects and every profile row', () => {
  assert.equal(hash(registry.model), fixture.modelSha256);
  assert.equal(hash(registry.evidence.effects), fixture.effectsSha256);
  assert.deepEqual(registry.model.buildings.map(building => building.id), fixture.buildingIds);
  assert.equal(registry.model.buildings.length, 29);
  assert.equal(registry.slugs.length, 22);
  for (const expected of fixture.profileRows) {
    const building = registry.model.buildings.find(entry => entry.id === expected.id);
    const profile = building.profiles.find(entry => entry.id === expected.profile);
    assert.equal(profile.rows.length, expected.rowCount);
    assert.equal(hash(profile.rows), expected.rowsSha256, `${building.id}:${profile.id}`);
  }
  assert.equal(fixture.profileRows.reduce((count, profile) => count + profile.rowCount, 0), 1522);
});

test('all profile construction and upgrade totals match independent frozen BigInt fixtures', () => {
  for (const expected of fixture.profileRows) {
    const profile = registry.model.buildings.find(building => building.id === expected.id).profiles.find(entry => entry.id === expected.profile);
    for (const range of expected.ranges) {
      const label = `${expected.id}:${expected.profile} ${range.from}->${range.to}`;
      if (range.status === 'missing') {
        assert.throws(() => runtime.sumRange(profile.rows, range.from, range.to), /missing/, label);
        continue;
      }
      const result = runtime.sumRange(profile.rows, range.from, range.to);
      assert.deepEqual(result.resources, range.resources, label + ' resources');
      assert.equal(result.seconds, range.seconds, label + ' seconds');
      assert.deepEqual(result.constructionItems.map(item => ({id: item.id, quantity: item.quantity})), range.constructionItems, label + ' items');
      assert.deepEqual(result.levels, range.levels, label + ' levels');
    }
  }
});

test('public building allowlist preserves runtime values and excludes management metadata at every level', () => {
  const permitted = (object, fields) => assert(Object.keys(object).every(key => fields.includes(key)), `Unexpected public key in ${JSON.stringify(Object.keys(object))}`);
  for (const slug of registry.slugs) {
    const buildings = registry.publicBuildings(slug);
    assert.deepEqual(buildings, registry.model.buildings.filter(building => building.slug === slug));
    for (const building of buildings) {
      permitted(building, ['id', 'slug', 'name', 'profiles']);
      permitted(building.name, registry.langs);
      for (const profile of building.profiles) {
        permitted(profile, ['id', 'rows']);
        for (const row of profile.rows) {
          permitted(row, ['level', 'rank', 'resources', 'seconds', 'requirements', 'constructionItems', 'battlePower', 'availability']);
          for (const requirement of row.requirements || []) {
            permitted(requirement, ['buildingId', 'level', 'rank', 'name', 'slug']);
            if (requirement.name) permitted(requirement.name, registry.langs);
          }
          for (const item of row.constructionItems || []) {
            permitted(item, ['id', 'quantity', 'name']);
            permitted(item.name, registry.langs);
          }
        }
      }
    }
  }
  const detached = registry.publicBuildings('power-plant');
  detached[0].profiles[0].rows[0].resources[0] = -1;
  assert.equal(hash(registry.model), fixture.modelSha256, 'Public projection must not mutate the registry');
  assert.throws(() => registry.publicBuildings('not-a-building'), /Unknown building route/);
});

test('build-only governance retains distinct variants, unknown gates and prior source guidance', () => {
  const governance = registry.governance;
  assert.equal(governance.gameVersion, '2.6.200');
  assert.equal(governance.gameBuild, 1512);
  assert.deepEqual(governance.variants.map(variant => [variant.id, variant.sourceLabel, variant.publicChoice]), [['original', 'Original', 'A'], ['d', 'D', 'B']]);
  assert.equal(governance.scopes.length, 29);
  assert.equal(governance.corrections.length, 5);
  assert.equal(governance.scopes.flatMap(building => building.profiles.flatMap(profile => profile.unknownRows)).length, 20);
  for (const slug of ['refinery', 'lab-2']) {
    const scope = governance.scopes.find(building => building.slug === slug);
    for (const profile of scope.profiles) assert(profile.unknownRows.some(row => row.level === 1 && row.fields.includes('initialConditions')));
  }
  assert.match(governance.legacyGuidance.originalSources['data/building-system-labels.js'], /build 1512/);
  assert.match(governance.legacyGuidance.originalSources['data/power-plant-copy.json'], /clientScopeNote/);
  const fragments = governance.legacyGuidance.pageFragments;
  assert.equal(fragments.filter(entry => entry.selector === '#rules-22 p').length, 24);
  assert.equal(fragments.filter(entry => entry.selector === '#research-effects-50 > p').length, 6);
  assert.equal(fragments.reduce((count, entry) => count + entry.matches.length, 0), 210);
  assert.equal(new Set(fragments.map(entry => entry.file + '|' + entry.selector)).size, fragments.length, 'Archived selectors must not be duplicated');
  const count = category => fragments.filter(entry => entry.category === category).reduce((total, entry) => total + entry.matches.length, 0);
  assert.equal(count('source-reference-section'), 24);
  assert.equal(count('version-attribute'), 18);
  assert.equal(count('image-provenance'), 54);
  assert.equal(count('player-copy-replacement'), 65);
  assert.equal(count('accessibility-label-replacement'), 1);
  const stele = governance.effects.find(building => building.slug === 'cursed-wound-stele');
  assert.notDeepEqual(stele.profiles[0].metrics, stele.profiles[1].metrics, 'Different profile effects must not be merged');
});
