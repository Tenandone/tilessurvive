'use strict';

// Read-only publication checks for the final building integration. The root
// builder creates HTML; this test never regenerates pages or source data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');
const registry = require('./building-data-registry');
const runtime = require('../js/building-system');
const player = require('./building-player-labels');
const root = path.resolve(__dirname, '..');
const baseline = '7a82e23b3d2184673ed60dc6898813f74b4d9b79';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const oldFile = file => execFileSync('git', ['show', baseline + ':' + file], {cwd: root, maxBuffer: 16e6});
const pages = registry.langs.flatMap(lang => registry.slugs.map(slug => {
  const file = `${lang}/buildings/${slug}/index.html`;
  const html = read(file);
  const payloads = [...html.matchAll(/<script\b[^>]*\bdata-building-system-model(?:=[^>]*)?[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(payloads.length, 1, file + ' must contain one public building payload');
  return {lang, slug, file, html, config: JSON.parse(payloads[0][1])};
}));

const archivedLabels = {module: {exports: {}}};
vm.runInNewContext(registry.governance.legacyGuidance.originalSources['data/building-system-labels.js'], archivedLabels);
const guidanceKeys = ['sourceNote', 'unknownEffects', 'initialNote', 'legacyPowerNote'];
const forbiddenMetadataKeys = new Set([
  'source', 'sourceNote', 'sourceHistory', 'sourceFiles', 'sourcePath', 'sourceURL',
  'gameVersion', 'gameBuild', 'version', 'versionTemplate', 'schemaVersion',
  'verificationScope', 'verifiedAt', 'auditedAt', 'provenance', 'governance',
  'availability',
  'recordKey', 'recordByteOffset', 'sourceSha256', 'buildingTableSha256',
  'corrections', 'changeHistory', 'legacyGuidance'
]);
function checkKeys(value, file) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!forbiddenMetadataKeys.has(key), file + ' public metadata key: ' + key);
    checkKeys(child, file);
  }
}
function exactKeys(object, expected, message) {
  assert.deepEqual(Object.keys(object).sort(), [...expected].sort(), message);
}

test('all 132 building documents omit archived management prose, source metadata and hidden source sections', () => {
  assert.equal(pages.length, 132);
  for (const {lang, file, html, config} of pages) {
    // Inspect the complete HTML, including hidden DOM, comments and scripts.
    // Check archived version/source sections by selector below; do not ban
    // arbitrary version-like text in unrelated retained links or numeric tables.
    const internalText = html.match(/\bbuild\s*1512\b|tscfg:|recordByteOffset|sourceSha256|buildingTableSha256|authorized-decryption|normalized-complete-v1|audit-results/i);
    assert(!internalText, file + ' contains internal token: ' + internalText?.[0]);
    assert(!/["'](?:sourceNote|sourceHistory|gameVersion|gameBuild|versionTemplate|verificationScope)["']\s*:/.test(html), file + ' internal JSON key');
    for (const key of guidanceKeys) {
      const oldText = archivedLabels.module.exports[lang][key];
      if (oldText) assert(!html.includes(oldText), file + ' still contains archived ' + key);
    }
    const document = parseHTML(html).document;
    assert.equal(document.querySelector('.source-details'), null, file + ' hidden source section');
    assert(!document.documentElement.hasAttribute('data-client-truth-52'), file + ' internal client-version marker');
    assert.equal(document.querySelector('main details[data-content301-references]'), null, file + ' archived version/source references');
    assert.equal(document.querySelector('main .hero p.c60-note'), null, file + ' internal image-provenance note');
    if (config.slug === 'lab') assert.equal(document.querySelector('[data-official-fact-ids] small'), null, file + ' archived verification badge');
    const prose = [...document.querySelectorAll('[data-bs-content], [data-bs-effects] summary, [data-bs-profile] > summary, [data-bs-choice] option')].map(node => node.textContent).join('\n');
    assert.doesNotMatch(prose, /\bOriginal\b/, file + ' developer variant label');
    checkKeys(config, file);
  }
});

test('embedded locale and UI copy use explicit public keys without old source and verification objects', () => {
  const configKeys = ['lang', 'slug', 'buildings', 'resources', 'links', 'names', 'locale', 'copy'];
  const copyKeys = ['original', 'd', 'empty', 'profile', 'profileHint', 'sample', 'initial', 'sumNote', 'rawNote', 'effects', 'all', 'calculator', 'base', 'missing', 'selectFirst', 'legacyPowerNote', 'range', 'powerCondition', 'labCondition', 'from', 'to', 'inventory', 'invalid', 'shortage', 'items'];
  const labelKeys = ['requirements', 'level', 'exactValues', 'capture', 'levelHeader', 'conditions', 'time', 'newConstruction', 'stage', 'none', 'exactValue', 'close', 'totals', 'levelPrefix', 'power', 'unknown'];
  for (const {lang, slug, file, config} of pages) {
    exactKeys(config, configKeys, file + ' config');
    exactKeys(config.copy, copyKeys, file + ' copy');
    exactKeys(config.locale, ['numberLocale', 'labels', 'units', 'messages'], file + ' locale');
    exactKeys(config.locale.labels, labelKeys, file + ' labels');
    exactKeys(config.locale.units, ['resourceSuffix', 'seconds', 'duration'], file + ' units');
    exactKeys(config.locale.messages, ['numberLegend'], file + ' messages');
    assert.equal(config.lang, lang);
    assert.equal(config.slug, slug);
    assert.equal(config.locale.labels.unknown, '—');
    assert.equal(config.copy.original, player[lang].original);
    assert.equal(config.copy.d, player[lang].d);
    assert.notEqual(config.copy.original, config.copy.d, file + ' requirements choices must remain distinct');
    assert.equal(config.copy.profileHint, slug === 'enlistment-office' ? player[lang].profileHintInitial : player[lang].profileHint);
    if (slug === 'enlistment-office') assert(config.buildings.every(building => building.profiles.every(profile => profile.rows.every(row => row.level === 1))), file + ' construction-only guidance must match the published scope');
    assert(Object.values(config.copy).every(value => typeof value === 'string'), file + ' missing public copy');
  }
});

test('public profile identities and independent datasets survive neutral labels in all six languages', () => {
  let rowCount = 0;
  for (const {lang, slug, file, html, config} of pages) {
    const expected = registry.publicBuildings(slug);
    for (const building of expected) for (const profile of building.profiles) for (const row of profile.rows) {
      if (row.availability === 'initial_conditions_unconfirmed') row.calculationBlocked = true;
      delete row.availability;
    }
    assert.deepEqual(config.buildings, expected, file + ' independent source profiles');
    const document = parseHTML(html).document;
    const options = [...document.querySelectorAll('[data-bs-choice] option')];
    assert.equal(options[0].getAttribute('value'), '', file + ' calculation must require a choice');
    const ids = expected.flatMap(building => building.profiles.map(profile => `${building.id}:${profile.id}`));
    assert.deepEqual(options.slice(1).map(option => option.getAttribute('value')), ids, file + ' share URL identifiers');
    for (const building of expected) {
      assert.deepEqual(building.profiles.map(profile => profile.id), ['original', 'd'], file + ' distinct profile IDs');
      for (const profile of building.profiles) {
        const id = `${building.id}:${profile.id}`;
        const option = options.find(node => node.getAttribute('value') === id);
        const label = profile.id === 'original' ? player[lang].original : player[lang].d;
        assert(option.textContent.endsWith(' · ' + label), file + ' player-facing label for ' + id);
        assert.equal(document.querySelectorAll(`[data-bs-profile="${id}"]`).length, 1, file + ' distinct profile panel');
        rowCount += profile.rows.length;
      }
    }
    const effect = registry.evidence.effects.find(entry => entry.slug === slug);
    if (effect) for (const profile of effect.profiles) assert.equal(document.querySelectorAll(`[data-bs-effect-profile="${profile.id.toLowerCase()}"]`).length, 1, file + ' independent effect profile');
  }
  assert.equal(rowCount, 9132, '1,522 independent rows in each of six languages');
  const power = pages.find(page => page.lang === 'ko' && page.slug === 'power-plant').config.buildings[0];
  assert.notDeepEqual(power.profiles[0].rows, power.profiles[1].rows, 'Different requirement datasets must not be merged');
});

test('unknown construction values and guard states survive publication and still reject invalid totals', () => {
  let guardedRows = 0;
  let unknownRows = 0;
  for (const {file, config} of pages) for (const building of config.buildings) for (const profile of building.profiles) {
    for (const row of profile.rows) {
      assert(!Object.hasOwn(row, 'availability'), file + ' management availability status leaked');
      if (Object.hasOwn(row, 'calculationBlocked')) {
        assert.equal(row.calculationBlocked, true, file + ' calculation flag must be an essential true guard only');
        guardedRows++;
      }
      if (row.resources === null || row.resources.some(value => value === null) || row.seconds === null) {
        unknownRows++;
        assert.throws(() => runtime.sumRange(profile.rows, row.level - 1, row.level), /missing/, file + ' unknown original value');
      }
    }
  }
  assert.equal(guardedRows, 24, 'two buildings x two profiles x six languages retain their initial gate');
  assert(unknownRows > 0, 'unknown values must remain present rather than coerced to zero');
});

test('runtime initialization restores the private calculation guard without changing the public payload', () => {
  for (const {lang, slug, file, html} of pages.filter(page => ['refinery', 'lab-2'].includes(page.slug))) {
    const document = parseHTML(html).document;
    const host = document.querySelector('[data-building-system]');
    const payload = host.querySelector('[data-building-system-model]').textContent;
    const choice = host.querySelector('[data-bs-choice]');
    const level = host.querySelector('[data-bs-level]');
    for (const [element, initial] of [[choice, ''], [level, 'all']]) {
      let value = initial;
      Object.defineProperty(element, 'value', {get: () => value, set: next => { value = String(next); }});
    }
    const change = element => element.dispatchEvent(new document.defaultView.Event('change', {bubbles: true}));
    const input = element => element.dispatchEvent(new document.defaultView.Event('input', {bubbles: true}));
    runtime.init(document);
    const from = host.querySelector('[name="from"]');
    const to = host.querySelector('[name="to"]');
    const output = host.querySelector('[data-bs-result]');
    const building = registry.model.buildings.find(entry => entry.slug === slug);
    for (const profile of building.profiles) {
      choice.value = `${building.id}:${profile.id}`;
      change(choice);
      from.value = '0'; to.value = '1'; input(from);
      assert.equal(output.dataset.result, 'missing', file + ' restored construction guard ' + profile.id);
      from.value = '1'; to.value = '2'; input(from);
      const actual = JSON.parse(output.dataset.result);
      const expected = runtime.sumRange(profile.rows, 1, 2);
      assert.deepEqual(actual, expected, `${lang} ${slug} ${profile.id} valid upgrade range`);
    }
    assert.equal(host.querySelector('[data-building-system-model]').textContent, payload, file + ' initialization mutated the public payload');
  }
});

test('the cumulative calculation function and completed layout CSS remain identical to 7a82e23b', () => {
  const calculation = source => {
    const match = source.replaceAll('\r\n', '\n').match(/  function sumRange\([\s\S]*?(?=\n  function duration)/);
    assert(match, 'sumRange function boundary');
    return match[0];
  };
  assert.equal(calculation(read('js/building-system.js')), calculation(oldFile('js/building-system.js').toString('utf8')), 'sumRange changed during a presentation-only integration');
  assert.deepEqual(fs.readFileSync(path.join(root, 'css/building-system.css')), oldFile('css/building-system.css'), 'completed layout fixes changed');
});

test('GitHub Pages excludes building management sources while retaining public runtime assets', () => {
  const yaml = read('_config.yml');
  const block = yaml.match(/^exclude:\s*\r?\n((?:(?:[ \t]+.*|[ \t]*)\r?\n?)*)/m)?.[1];
  assert(block, '_config.yml must declare a concrete exclude list');
  const excluded = [...block.matchAll(/^[ \t]+-[ \t]+([^\r\n#]+)/gm)].map(match => match[1].trim().replace(/^['"]|['"]$/g, '').replace(/^\.\//, '').replace(/\/$/, ''));
  const isExcluded = file => excluded.some(entry => file === entry || file.startsWith(entry + '/'));
  const managementFiles = [
    'scripts/building-data-registry.js',
    'scripts/building-data/policy.json',
    'scripts/building-data/legacy-guidance-7a82e23b.json',
    'scripts/building-data/baseline-7a82e23b.json',
    'data/client-buildings-52.json',
    'data/content-60/buildings.json',
    'data/content-60/buildings-phase2.json',
    'data/content-60/buildings-copy.js',
    'data/content-60/buildings-phase2-copy.js',
    'data/building-system-evidence.json',
    'data/building-system-audit.json',
    'data/building-system-copy.js',
    'data/building-system-labels.js',
    'data/power-plant-copy.json',
    'data/building-refinement-51.json',
    'data/building-assets-51.json',
    'data/product-50/german-building-review.json'
  ];
  for (const file of managementFiles) assert(isExcluded(file), file + ' can be published without its management exclusion');
  assert(!fs.existsSync(path.join(root, '.nojekyll')), '.nojekyll would bypass Pages exclusions');
  for (const file of ['css/building-system.css', 'js/building-system.js', 'ko/buildings/power-plant/index.html']) assert(!isExcluded(file), file + ' public runtime asset excluded');
});
