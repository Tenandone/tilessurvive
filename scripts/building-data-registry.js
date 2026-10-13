'use strict';

// Build-only owner of the building data joins and their management policy.
// Generation config uses publicBuildings(); HTML serialization converts its
// essential availability guard to calculationBlocked. Never serialize governance.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const policy = require('./building-data/policy.json');
const evidence = require('../data/building-system-evidence.json');
const audit = require('../data/building-system-audit.json');
const sourceFiles = [
  'data/client-buildings-52.json',
  'data/content-60/buildings.json',
  'data/content-60/buildings-phase2.json'
];
const sources = sourceFiles.map(file => require(path.join(root, file)));
const langs = ['ko', 'en', 'ja', 'ru', 'zh-tw', 'de'];
const clone = value => structuredClone(value);

for (const source of [...sources, evidence]) {
  assert.equal(source.gameVersion, sources[0].gameVersion, 'Building game version mismatch');
  if (source.resources) assert.deepEqual(source.resources, sources[0].resources, 'Building resource order mismatch');
}
assert.equal(evidence.gameBuild, audit.scope.gameBuild, 'Building game build mismatch');

const model = {
  gameVersion: sources[0].gameVersion,
  resources: clone(sources[0].resources),
  buildings: clone([...sources.flatMap(source => source.buildings), ...evidence.buildings]).map(building => ({
    id: building.id || building.buildingId,
    slug: building.slug,
    name: building.name,
    profiles: building.profiles.map(profile => ({id: profile.id.toLowerCase(), rows: profile.rows || profile.levels}))
  }))
};

const buildingIds = new Set();
const rowByIdentity = new Map();
const key = (id, profile, level, rank) => `${id}:${profile.toLowerCase()}:${level}:${rank}`;
for (const building of model.buildings) {
  assert(!buildingIds.has(building.id), `Duplicate building ID ${building.id}`);
  buildingIds.add(building.id);
  const profileIds = new Set();
  for (const profile of building.profiles) {
    assert(policy.variants.some(variant => variant.id === profile.id), `Unknown profile ${profile.id}`);
    assert(!profileIds.has(profile.id), `Duplicate profile ${building.id}:${profile.id}`);
    profileIds.add(profile.id);
    for (const row of profile.rows) {
      const identity = key(building.id, profile.id, row.level, row.rank);
      assert(!rowByIdentity.has(identity), `Duplicate building row ${identity}`);
      rowByIdentity.set(identity, row);
      row.constructionItems = row.constructionItems.map(item => {
        if (item.key === undefined) return item;
        const named = evidence.items.find(entry => entry.id === item.key);
        assert(named, `Missing construction item ${item.key}`);
        assert(langs.every(lang => named.name[lang]), `Missing item localization ${item.key}`);
        return {id: item.key, quantity: item.value, name: clone(named.name)};
      });
    }
  }
}

for (const correction of evidence.corrections || []) {
  const identity = key(correction.id, correction.profile, correction.level, correction.rank);
  const row = rowByIdentity.get(identity);
  assert(row, `Correction row does not exist: ${identity}`);
  assert.equal(row[correction.field], null, 'Only supplement unconfirmed fields');
  row[correction.field] = clone(correction.value);
}

for (const building of model.buildings) for (const profile of building.profiles) for (const row of profile.rows) {
  const power = evidence.power.find(entry => entry.id === building.id)?.rows.find(entry => entry.level === row.level && entry.rank === row.rank);
  if (!power) continue;
  if (row.battlePower !== undefined) assert.equal(row.battlePower, power.battlePower, `Conflicting power ${building.id}:${row.level}:${row.rank}`);
  row.battlePower = power.battlePower;
}

const slugs = [...new Set(model.buildings.map(building => building.slug))];
const links = Object.fromEntries(model.buildings.map(building => [building.id, building.slug]));
const names = Object.fromEntries(model.buildings.map(building => [building.id, building.name]));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file), 'utf8').replaceAll('\r\n', '\n')).digest('hex');
const unknownFields = row => {
  const fields = [];
  if (!Array.isArray(row.resources) || row.resources.some(value => value === null)) fields.push('resources');
  if (row.seconds === null || row.seconds === undefined) fields.push('seconds');
  if (row.requirements === null) fields.push('requirements');
  if (row.constructionItems === null) fields.push('constructionItems');
  if (row.battlePower === null || row.battlePower === undefined) fields.push('battlePower');
  if (row.availability === 'initial_conditions_unconfirmed') fields.push('initialConditions');
  return fields;
};

const governance = {
  ...clone(policy),
  gameVersion: model.gameVersion,
  gameBuild: evidence.gameBuild,
  sources: [...sourceFiles, 'data/building-system-evidence.json'].map(file => ({
    file,
    sha256: sha256(file),
    hashEncoding: 'UTF-8 with LF line endings',
    role: file === 'data/building-system-evidence.json' ? 'reviewed additive evidence' : 'retained validated level data'
  })),
  originalSource: clone(evidence.source),
  scopes: model.buildings.map(building => ({
    id: building.id,
    slug: building.slug,
    source: sourceFiles[sources.findIndex(source => source.buildings.some(entry => (entry.id || entry.buildingId) === building.id))] || 'data/building-system-evidence.json',
    status: audit.pages.find(page => page.slug === building.slug)?.pageStatus || 'unreviewed',
    verifiedAt: policy.verifiedAt,
    profiles: building.profiles.map(profile => ({
      id: profile.id,
      minLevel: Math.min(...profile.rows.map(row => row.level)),
      maxLevel: Math.max(...profile.rows.map(row => row.level)),
      ranks: [...new Set(profile.rows.map(row => row.rank))],
      rowCount: profile.rows.length,
      unknownRows: profile.rows.filter(row => unknownFields(row).length).map(row => ({level: row.level, rank: row.rank, fields: unknownFields(row)}))
    })),
    issues: clone(audit.pages.find(page => page.slug === building.slug)?.issues || [])
  })),
  effects: (evidence.effects || []).map(building => ({
    id: building.id,
    slug: building.slug,
    profiles: building.profiles.map(profile => ({
      id: profile.id.toLowerCase(),
      metrics: clone(profile.metrics || building.metrics),
      minLevel: Math.min(...profile.rows.map(row => row.level)),
      maxLevel: Math.max(...profile.rows.map(row => row.level)),
      ranks: [...new Set(profile.rows.map(row => row.rank))],
      rowCount: profile.rows.length,
      unknownRows: profile.rows.filter(row => row.values.some(value => value === null)).map(row => ({level: row.level, rank: row.rank}))
    }))
  })),
  corrections: (evidence.corrections || []).map(correction => ({...clone(correction), previousValue: null})),
  legacyGuidance: require('./building-data/legacy-guidance-7a82e23b.json')
};

// Every nested object is reconstructed: unknown metadata cannot leak via spreads.
const pick = (object, fields) => Object.fromEntries(fields.filter(field => Object.hasOwn(object, field)).map(field => [field, clone(object[field])]));
const publicName = name => pick(name, langs);
function publicBuildings(slug) {
  assert(slugs.includes(slug), `Unknown building route ${slug}`);
  return model.buildings.filter(building => building.slug === slug).map(building => ({
    id: building.id,
    slug: building.slug,
    name: publicName(building.name),
    profiles: building.profiles.map(profile => ({
      id: profile.id,
      rows: profile.rows.map(row => ({
        ...pick(row, ['level', 'rank', 'resources', 'seconds', 'battlePower', 'availability']),
        requirements: row.requirements === null ? null : row.requirements.map(requirement => ({
          ...pick(requirement, ['buildingId', 'level', 'rank', 'slug']),
          ...(requirement.name ? {name: publicName(requirement.name)} : {})
        })),
        constructionItems: row.constructionItems === null ? null : row.constructionItems.map(item => ({
          ...pick(item, ['id', 'quantity']),
          name: publicName(item.name)
        }))
      }))
    }))
  }));
}

module.exports = {model, evidence, governance, langs, slugs, links, names, publicBuildings};
