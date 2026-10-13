'use strict';

// Read-only prerequisite regression checks. Deliberately inspect the public
// JSON, static desktop rows, and mobile cards separately: one correct view must
// not conceal a missing second or third condition in another view.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {parseHTML} = require('linkedom');
const registry = require('./building-data-registry');
const builder = require('./build-building-system');
const runtime = require('../js/building-system');
const root = path.resolve(__dirname, '..');
const documents = new Map();
const byId = new Map(registry.model.buildings.map(building => [building.id, building]));
const tuple = requirement => [requirement.buildingId, requirement.level, requirement.rank || 0];
const key = row => `${row.level}:${row.rank || 0}`;
const documentOf = html => parseHTML(html).document;
function page(lang, slug) {
  const id = `${lang}/${slug}`;
  if (!documents.has(id)) documents.set(id, documentOf(fs.readFileSync(path.join(root, lang, 'buildings', slug, 'index.html'), 'utf8')));
  return documents.get(id);
}
function expectedRequirement(requirement, cfg) {
  const slug = requirement.slug || registry.links[requirement.buildingId];
  const name = requirement.name?.[cfg.lang] || registry.names[requirement.buildingId]?.[cfg.lang];
  assert(name, `Missing localized prerequisite ${cfg.lang}:${requirement.buildingId}`);
  return {
    tuple: tuple(requirement), name,
    href: slug ? `/${cfg.lang}/buildings/${slug}/#building-${requirement.buildingId}` : null,
    level: cfg.locale.labels.levelPrefix + requirement.level + (requirement.rank ? ` · ${cfg.locale.labels.stage} ${requirement.rank}` : '')
  };
}
function verifyConditions(container, row, cfg, context) {
  assert(container, `${context}: condition container`);
  const elements = [...container.querySelectorAll('li[data-building-id]')];
  const expected = (row.requirements || []).map(requirement => expectedRequirement(requirement, cfg));
  const actual = elements.map(node => [Number(node.dataset.buildingId), Number(node.dataset.requiredLevel), Number(node.dataset.rank)]);
  assert.deepEqual(actual, expected.map(entry => entry.tuple), `${context}: every prerequisite tuple in source order`);
  for (const [index, node] of elements.entries()) {
    const requirement = expected[index], link = node.querySelector('a');
    assert.equal(link?.getAttribute('href') || null, requirement.href, `${context}: prerequisite href ${index}`);
    const level = node.querySelector('span');
    assert(level, `${context}: visible required level ${index}`);
    assert.equal(level.textContent, requirement.level, `${context}: visible level/rank ${index}`);
    const name = [...node.childNodes].filter(child => child !== level).map(child => child.textContent).join('').trim();
    assert.equal(name, requirement.name, `${context}: localized name ${index}`);
    if (requirement.href) {
      const slug = requirement.href.split('/')[3], target = page(cfg.lang, slug);
      assert(target.getElementById(`building-${requirement.tuple[0]}`), `${context}: destination building anchor ${index}`);
    }
  }
  if (!expected.length) {
    const unknown = row.requirements === null || row.availability === 'initial_conditions_unconfirmed';
    // Mobile cards have one direct span labelling the whole conditions block.
    const content = container.cloneNode(true);
    if (content.classList.contains('card-conditions')) content.querySelector(':scope > span')?.remove();
    assert.equal(content.textContent.trim(), unknown ? cfg.locale.labels.unknown : cfg.locale.labels.none, `${context}: empty and unknown are distinct`);
  }
}
function verifyPayloadRows(building, profile, payload) {
  assert(payload, `${building.id}:${profile.id}: public profile`);
  assert.deepEqual(payload.rows.map(key), profile.rows.map(key), `${building.id}:${profile.id}: row identities and order`);
  for (const [index, row] of profile.rows.entries()) {
    const value = payload.rows[index];
    assert.deepEqual(value.requirements, row.requirements, `${building.id}:${profile.id}:${key(row)}: complete public prerequisite payload`);
  }
}

test('all 58 profiles match independently pinned raw-client prerequisite arrays', () => {
  const pins = require('./building-data/dependencies-2026-10-13.json');
  const profiles = registry.model.buildings.flatMap(building => building.profiles.map(profile => ({building, profile})));
  assert.equal(pins.profiles.length, profiles.length);
  assert.equal(profiles.length, 58);
  for (const {building, profile} of profiles) {
    const pin = pins.profiles.find(value => value.buildingId === building.id && value.profile === profile.id);
    assert(pin, `Independent prerequisite pin ${building.id}:${profile.id}`);
    assert.equal(pin.slug, building.slug);
    assert.equal(pin.rowCount, profile.rows.length);
    assert.equal(pin.requirementCount, profile.rows.reduce((sum, row) => sum + row.requirements.length, 0));
    const tuples = profile.rows.map(row => [row.level, row.rank, row.requirements.map(requirement => [requirement.buildingId, requirement.level, requirement.rank])]);
    const digest = crypto.createHash('sha256').update(JSON.stringify(tuples), 'utf8').digest('hex');
    assert.equal(digest, pin.orderedRequirementsSha256, `Raw-client condition sequence ${building.id}:${profile.id}`);
  }
  const power = byId.get(800005);
  assert.equal(pins.powerPlantProfiles.length, 2);
  for (const pin of pins.powerPlantProfiles) {
    const profile = power.profiles.find(value => value.id === pin.profile);
    assert(profile);
    assert.equal(pin.rows.length, 30);
    assert.deepEqual(profile.rows.map(row => [row.level, row.rank, row.requirements.map(tuple)]), pin.rows.map(row => [row.level, row.rank, row.requirements]), `Power Plant ${pin.profile}: all 30 independent conditions`);
    for (const row of pin.rows) assert.equal(row.requiredSourceRecordIds.length, row.requirements.length, 'every referenced source record has one resolved tuple');
  }
});

test('Power Plant A and B keep their independently verified multi-building conditions', () => {
  const building = byId.get(800005);
  // Native ReqBuilding / ReqBuildingD records were checked independently.
  // These literals prevent a first-only change to the shared model from making
  // all three display-layer comparisons pass with the same truncated input.
  const expected = {
    original: {15: [[800007, 14, 0]], 20: [[800008, 19, 0]], 30: [[800007, 29, 0]]},
    d: {
      15: [[800016, 13, 0], [800007, 14, 0], [800010, 5, 0]],
      20: [[800012, 19, 0], [800152, 16, 0]],
      30: [[800012, 29, 0], [800007, 29, 0], [800147, 26, 0]]
    }
  };
  for (const profile of building.profiles) for (const [level, requirements] of Object.entries(expected[profile.id])) {
    const row = profile.rows.find(value => value.level === Number(level));
    assert(row);
    assert.equal(row.rank, Number(level) === 30 ? 1 : 0, 'target level rank remains separate');
    assert.deepEqual(row.requirements.map(tuple), requirements, `${profile.id}: Lv.${level}`);
  }
});

test('all six languages preserve every prerequisite in public JSON, desktop tables and mobile cards', t => {
  const counts = {pages: 0,profileRows: 0,desktopRows: 0,mobileRows: 0,prerequisites: 0,multipleConditionRows: 0,unlinkedConditions: 0};
  for (const lang of registry.langs) for (const slug of registry.slugs) {
    const document = page(lang, slug), cfg = builder.config(lang, slug);
    const host = document.querySelector('[data-building-system]');
    assert(host, `${lang}/${slug}: common building page`);
    const payload = JSON.parse(host.querySelector('[data-building-system-model]').textContent);
    assert.deepEqual(payload.buildings.map(building => building.id), cfg.buildings.map(building => building.id));
    counts.pages++;
    for (const building of cfg.buildings) {
      const publicBuilding = payload.buildings.find(value => value.id === building.id);
      assert.deepEqual(publicBuilding.profiles.map(profile => profile.id), building.profiles.map(profile => profile.id));
      for (const profile of building.profiles) {
        verifyPayloadRows(building, profile, publicBuilding.profiles.find(value => value.id === profile.id));
        const panel = host.querySelector(`[data-bs-profile="${building.id}:${profile.id}"]`);
        assert(panel);
        const rows = [...panel.querySelectorAll('.desktop-table tbody tr')];
        const cards = [...panel.querySelectorAll('.mobile-cards > article')];
        assert.equal(rows.length, profile.rows.length);
        assert.equal(cards.length, profile.rows.length);
        for (const [index, row] of profile.rows.entries()) {
          const context = `${lang}/${slug}/${building.id}/${profile.id}/${key(row)}`;
          assert.equal(rows[index].dataset.level, String(row.level), context);
          assert.equal(rows[index].dataset.rank, String(row.rank || 0), context);
          assert.equal(cards[index].dataset.level, String(row.level), context);
          verifyConditions(rows[index].querySelector('.condition'), row, cfg, context + ':desktop');
          verifyConditions(cards[index].querySelector('.card-conditions'), row, cfg, context + ':mobile');
          counts.profileRows++; counts.desktopRows++; counts.mobileRows++;
          counts.prerequisites += row.requirements?.length || 0;
          counts.multipleConditionRows += (row.requirements?.length || 0) > 1 ? 1 : 0;
          counts.unlinkedConditions += (row.requirements || []).filter(requirement => !(requirement.slug || registry.links[requirement.buildingId])).length;
        }
      }
    }
  }
  assert.deepEqual(counts, {pages:132,profileRows:9132,desktopRows:9132,mobileRows:9132,prerequisites:9372,multipleConditionRows:216,unlinkedConditions:36});
  t.diagnostic(JSON.stringify(counts));
});

test('empty, unknown, initial unlock and construction-item conditions remain distinct', () => {
  for (const lang of registry.langs) {
    const cfg = builder.config(lang, 'power-plant'), building = structuredClone(cfg.buildings[0]);
    const row = structuredClone(building.profiles[0].rows[0]);
    for (const state of ['none', 'unknown', 'initial_conditions_unconfirmed']) {
      row.requirements = state === 'unknown' ? null : [];
      delete row.availability;
      if (state === 'initial_conditions_unconfirmed') row.availability = state;
      const d = documentOf(runtime.renderProfile(building, {id:'original',rows:[row]}, cfg));
      verifyConditions(d.querySelector('td.condition'), row, cfg, `${lang}:${state}:desktop`);
      verifyConditions(d.querySelector('.card-conditions'), row, cfg, `${lang}:${state}:mobile`);
    }
  }
  for (const building of registry.model.buildings) for (const profile of building.profiles) for (const row of profile.rows) {
    const unique = new Set((row.requirements || []).map(requirement => tuple(requirement).join(':')));
    assert.equal(unique.size, row.requirements?.length || 0, `${building.id}:${profile.id}:${key(row)} duplicate prerequisite`);
    for (const requirement of row.requirements || []) {
      const target = byId.get(requirement.buildingId);
      if (!target) continue; // Names without invented routes are verified above.
      const targetProfile = target.profiles.find(value => value.id === profile.id);
      assert(targetProfile?.rows.some(value => value.level === requirement.level && (value.rank || 0) === (requirement.rank || 0)), `${building.id}:${profile.id}:${key(row)} target prerequisite level/rank must exist`);
    }
    for (const item of row.constructionItems || []) assert(!(row.requirements || []).some(requirement => requirement.buildingId === item.id), 'construction item ID must not be reclassified as a building');
  }
});

test('dependency verifier rejects a missing second condition, wrong level/rank, and wrong building link', () => {
  const cfg = builder.config('ko', 'power-plant'), building = cfg.buildings[0], profile = building.profiles.find(value => value.id === 'd');
  const source = profile.rows.find(value => value.level === 15);
  const panel = page('ko', 'power-plant').querySelector('[data-bs-profile="800005:d"]');
  const original = panel.querySelector('tr[data-level="15"] .condition');
  verifyConditions(original, source, cfg, 'control');
  const mutations = [
    node => node.querySelectorAll('li')[1].remove(),
    node => node.querySelectorAll('li')[1].dataset.requiredLevel = '13',
    node => node.querySelectorAll('li')[1].dataset.rank = '1',
    node => node.querySelectorAll('li')[1].querySelector('span').textContent = 'Lv.99',
    node => node.querySelectorAll('li')[1].querySelector('a').setAttribute('href', '/ko/buildings/barracks/#building-800008'),
    node => node.querySelectorAll('li')[1].querySelector('a').textContent = '다른 건물',
    node => node.append(node.querySelector('li'))
  ];
  for (const [index, mutate] of mutations.entries()) {
    const changed = original.cloneNode(true); mutate(changed);
    assert.throws(() => verifyConditions(changed, source, cfg, `mutation-${index}`), assert.AssertionError);
  }
  const payload = structuredClone(profile);
  payload.rows.find(value => value.level === 15).requirements.splice(1, 1);
  assert.throws(() => verifyPayloadRows(building, profile, payload), assert.AssertionError, 'public JSON missing second condition');
});
