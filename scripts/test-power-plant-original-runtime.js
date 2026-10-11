'use strict';

// Read-only presentation tests. This suite does not run any builder or engine verify.
// DOM assertions use linkedom; they are not browser, viewport, or visual checks.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {parseHTML} = require('linkedom');
const runtime = require('../js/power-plant-original');
const builder = require('./build-power-plant-original');
const copy = require('../data/power-plant-copy.json');
const legacyMath = require('../js/client-buildings-52');

const root = path.resolve(__dirname, '..');
const languages = ['ko', 'en', 'ja', 'ru', 'zh-tw', 'de'];
// Approved v3 levels, canonicalized below; excludes resource paths and display names.
const approvedNumericHash = '46c9cc59c8d4a2b4c0e81587ddc9479356958515c6aa314d0675ffad35966571';
const fullTotal = {resources: [1391947950, 1391947950, 276945000, 68745600], seconds: 31143082};
const upgradeTotal = {resources: [1391940600, 1391940600, 276945000, 68745600], seconds: 31143082};
const {model, links} = builder;
const {formatting} = runtime;
const documentOf = html => parseHTML('<!doctype html><html><body>' + html + '</body></html>').document;
function normalizedMarkup(html) {
  const doc = documentOf(html);
  // HTML class tokens are whitespace-separated; linkedom may normalize them on access.
  for (const node of doc.querySelectorAll('[class]')) {
    node.setAttribute('class', node.getAttribute('class').trim().split(/\s+/).join(' '));
  }
  return doc.body.innerHTML;
}
const options = (lang = 'ko', range = [1, 30], exact = false, data = model) => ({
  model: data, locale: copy.locales[lang], links, lang, range, exact
});
const selectedRows = (range, data = model) => data.levels.filter(r => r.level >= range[0] && r.level <= range[1]);
const exactNumber = (value, locale) => new Intl.NumberFormat(locale.numberLocale).format(value);
// Independent integer oracle for the approved K/M rule: round half up to hundredths.
function expectedCompact(value) {
  if (value < 1000) return String(value);
  const n = BigInt(value);
  let unit = n < 1000000n ? 1000n : 1000000n;
  let hundredths = (n * 100n + unit / 2n) / unit;
  if (unit === 1000n && hundredths >= 100000n) {
    unit = 1000000n;
    hundredths = (n * 100n + unit / 2n) / unit;
  }
  const fraction = String(hundredths % 100n).padStart(2, '0').replace(/0+$/, '');
  return (hundredths / 100n).toLocaleString('en-US') + (fraction ? '.' + fraction : '') + (unit === 1000n ? 'K' : 'M');
}
const numericProjection = rows => rows.map(r => ({
  level: r.level, rank: r.rank, resources: r.resources, seconds: r.seconds, battlePower: r.battlePower,
  requirements: r.requirements.map(q => ({buildingId: q.buildingId, level: q.level, rank: q.rank}))
}));
function independentTotal(rows) {
  const resources = [0n, 0n, 0n, 0n];
  let seconds = 0n;
  for (const row of rows) {
    row.resources.forEach((value, index) => { resources[index] += BigInt(value); });
    seconds += BigInt(row.seconds);
  }
  return {resources: resources.map(Number), seconds: Number(seconds)};
}
function rawTuple(node) {
  return {
    resources: [...node.querySelectorAll('[data-resource]')].map(n => n.getAttribute('data-raw')),
    seconds: node.querySelector('[data-seconds]').getAttribute('data-seconds'),
    power: node.querySelector('[data-power]').getAttribute('data-power'),
    requirements: [...node.querySelectorAll('li[data-building-id]')].map(n => [
      n.getAttribute('data-building-id'), n.getAttribute('data-required-level'), n.getAttribute('data-rank')
    ])
  };
}
function assertNumber(cell, value, type, label, locale, showExact, context) {
  const button = cell.querySelector('button.number');
  assert(button, context + ' button');
  const shown = type === 'time' ? legacyMath.duration(value, locale.units.duration)
    : showExact ? exactNumber(value, locale) : expectedCompact(value);
  const title = type === 'time' ? `${shown} (${exactNumber(value, locale)}${locale.units.seconds})`
    : exactNumber(value, locale) + (type === 'resource' ? locale.units.resourceSuffix : '');
  assert.equal(button.getAttribute('data-value'), String(value), context + ' raw integer');
  assert.equal(button.getAttribute('data-kind'), type, context + ' kind');
  assert.equal(button.getAttribute('data-label'), label, context + ' localized label');
  assert.equal(button.textContent, shown, context + ' display');
  assert.equal(button.getAttribute('title'), title, context + ' exact title');
  assert(button.getAttribute('aria-label').includes(locale.labels.showExactValue), context + ' accessible action');
  assert.equal(button.classList.contains('zero'), value === 0, context + ' zero state');
}
function assertRequirements(node, row, lang, locale) {
  const requirements = [...node.querySelectorAll('li[data-building-id]')];
  assert.equal(requirements.length, row.requirements.length);
  if (!row.requirements.length) {
    assert.equal(node.querySelector('.no-req').textContent, locale.labels.none);
    return;
  }
  row.requirements.forEach((requirement, index) => {
    const item = requirements[index], anchor = item.querySelector('a');
    assert.equal(item.getAttribute('data-building-id'), String(requirement.buildingId));
    assert.equal(item.getAttribute('data-required-level'), String(requirement.level));
    assert.equal(item.getAttribute('data-rank'), String(requirement.rank || 0));
    assert(anchor.textContent.includes(locale.buildingNames[requirement.buildingId]));
    assert.equal(anchor.getAttribute('href'), 'https://tilessurvive.net' + links[requirement.buildingId].replace('/ko/', `/${lang}/`));
    assert.equal(anchor.getAttribute('target'), '_blank');
    assert(anchor.getAttribute('rel').split(/\s+/).includes('noopener'));
  });
}
function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freezeDeep);
  }
  return value;
}

test('the single Power Plant series preserves all 30 approved raw numeric rows', () => {
  assert.equal(model.building.id, 800005);
  assert.deepEqual(model.game, {version: '2.6.200', build: 1512});
  assert.deepEqual(model.resources.map(r => r.id), [1200005, 1200004, 1200003, 1200002]);
  assert.deepEqual(model.levels.map(r => r.level), Array.from({length: 30}, (_, i) => i + 1));
  for (const row of model.levels) {
    assert.equal(row.resources.length, 4);
    for (const value of [...row.resources, row.seconds, row.battlePower]) assert(Number.isSafeInteger(value) && value >= 0);
  }
  const hash = crypto.createHash('sha256').update(JSON.stringify(numericProjection(model.levels))).digest('hex');
  assert.equal(hash, approvedNumericHash, 'approved v3 raw values and requirements');
});

test('compact display handles K/M boundaries without modifying raw values', () => {
  const examples = [
    [0, '0'], [1, '1'], [999, '999'], [1000, '1K'], [1001, '1K'], [7350, '7.35K'],
    [999949, '999.95K'], [999950, '999.95K'], [999994, '999.99K'], [999995, '1M'],
    [999999, '1M'], [1000000, '1M'], [1234567, '1.23M'], [255937500, '255.94M'],
    [1391947950, '1,391.95M']
  ];
  for (const [raw, display] of examples) assert.equal(formatting.compact(raw), display, String(raw));
  for (const raw of model.levels.flatMap(r => [...r.resources, r.seconds, r.battlePower])) {
    assert.equal(formatting.compact(raw), expectedCompact(raw), 'retained raw value ' + raw);
  }
  assert.equal(formatting.compact(null), null);
  assert.equal(formatting.compact(undefined), null);
  for (const invalid of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => formatting.compact(invalid), /invalid display value/);
  }
});

test('six locales preserve exact resource, time, and battle-power integers and legacy time formatting', () => {
  assert.deepEqual(copy.supportedLanguages, languages);
  const values = model.levels.flatMap(r => [...r.resources, r.seconds, r.battlePower]);
  const seconds = [0, 1, 59, 60, 3599, 3600, 86399, 86400, ...model.levels.map(r => r.seconds)];
  for (const lang of languages) {
    const locale = copy.locales[lang];
    for (const value of values) assert.equal(formatting.exact(value, locale.numberLocale), exactNumber(value, locale), lang + ':' + value);
    for (const value of seconds) assert.equal(formatting.duration(value, locale.units.duration), legacyMath.duration(value, locale.units.duration), lang + ':' + value);
    assert.equal(formatting.exact(null, locale.numberLocale), null);
    assert.equal(formatting.exact(undefined, locale.numberLocale), null);
  }
});

test('all 465 inclusive level ranges match independent BigInt totals, including Lv.1 construction', () => {
  let ranges = 0;
  for (let min = 1; min <= 30; min++) for (let max = min; max <= 30; max++) {
    const rows = selectedRows([min, max]);
    assert.deepEqual(formatting.totals(rows), independentTotal(rows), `Lv.${min}-${max}`);
    ranges++;
  }
  assert.equal(ranges, 465);
  assert.deepEqual(formatting.totals(model.levels), fullTotal);
  assert.deepEqual(formatting.totals(model.levels.slice(1)), upgradeTotal);
  assert.deepEqual(formatting.totals([model.levels[0]]), {resources: [7350, 7350, 0, 0], seconds: 0});
  assert.deepEqual(formatting.totals([]), {resources: [0, 0, 0, 0], seconds: 0});
});

for (const lang of languages) test(`${lang}: compact and exact desktop/mobile DOM preserve every field and localized prerequisite`, () => {
  const locale = copy.locales[lang];
  for (const showExact of [false, true]) {
    const doc = documentOf(runtime.renderTables(options(lang, [1, 30], showExact)));
    const desktop = [...doc.querySelectorAll('.desktop-table tbody tr[data-level]')];
    const mobile = [...doc.querySelectorAll('.mobile-cards .level-card[data-level]')];
    assert.equal(desktop.length, 30);
    assert.equal(mobile.length, 30);
    assert.equal(doc.querySelectorAll('.data-table thead th').length, 8);
    model.levels.forEach((row, index) => {
      const expected = {resources: row.resources.map(String), seconds: String(row.seconds), power: String(row.battlePower), requirements: row.requirements.map(q => [String(q.buildingId), String(q.level), String(q.rank || 0)])};
      assert.equal(desktop[index].getAttribute('data-level'), String(row.level));
      assert.equal(mobile[index].getAttribute('data-level'), String(row.level));
      assert.deepEqual(rawTuple(desktop[index]), expected, `desktop Lv.${row.level}`);
      assert.deepEqual(rawTuple(mobile[index]), expected, `mobile Lv.${row.level}`);
      for (const node of [desktop[index], mobile[index]]) {
        row.resources.forEach((value, resource) => assertNumber(node.querySelector(`[data-resource="${resource}"]`), value, 'resource', locale.resources[resource], locale, showExact, `${lang}:Lv.${row.level}:r${resource}`));
        assertNumber(node.querySelector('[data-seconds]'), row.seconds, 'time', locale.labels.time, locale, showExact, `${lang}:Lv.${row.level}:seconds`);
        assertNumber(node.querySelector('[data-power]'), row.battlePower, 'power', locale.labels.power, locale, showExact, `${lang}:Lv.${row.level}:power`);
        assertRequirements(node, row, lang, locale);
      }
    });
    const headerIcons = [...doc.querySelectorAll('thead img.resource-icon')];
    assert.equal(headerIcons.length, 4);
    model.resources.forEach((resource, index) => {
      const expected = `/img/buildings/power-plant-resources/resource-${resource.id}.png`;
      assert(fs.existsSync(path.join(root, expected.slice(1))), 'required original resource icon');
      assert.equal(headerIcons[index].getAttribute('src'), expected);
      for (const card of mobile) {
        const icon = card.querySelector(`[data-resource="${index}"] img`);
        assert.equal(icon.getAttribute('src'), expected);
        assert.equal(icon.getAttribute('data-resource-id'), String(resource.id));
        assert.equal(icon.getAttribute('alt'), '');
      }
    });
  }
});

test('selected ranges and totals render exact localized integers in all six languages', () => {
  for (const lang of languages) for (const range of [[1, 1], [30, 30], [26, 30], [11, 15], [1, 30], [2, 30]]) {
    const rows = selectedRows(range), total = independentTotal(rows), locale = copy.locales[lang];
    const tables = documentOf(runtime.renderTables(options(lang, range)));
    for (const selector of ['.desktop-table tbody tr[data-level]', '.mobile-cards .level-card[data-level]']) {
      assert.deepEqual([...tables.querySelectorAll(selector)].map(n => Number(n.getAttribute('data-level'))), rows.map(r => r.level));
    }
    const doc = documentOf(runtime.renderTotals(options(lang, range)));
    total.resources.forEach((value, index) => {
      const field = doc.querySelector(`[data-total-resource="${index}"]`);
      assert.equal(field.getAttribute('data-raw'), String(value));
      assert.equal(field.textContent, exactNumber(value, locale) + locale.units.resourceSuffix);
    });
    const time = doc.querySelector('[data-total-seconds]');
    assert.equal(time.getAttribute('data-total-seconds'), String(total.seconds));
    assert(time.textContent.includes(legacyMath.duration(total.seconds, locale.units.duration)));
    assert(time.textContent.includes(exactNumber(total.seconds, locale) + locale.units.seconds));
  }
});

test('unknown values remain distinct from zero, no prerequisites, and known totals', () => {
  const data = JSON.parse(JSON.stringify(model));
  data.levels = [{...data.levels[0], resources: [null, 0, 1, null], seconds: null, battlePower: null}];
  assert.deepEqual(formatting.totals(data.levels), {resources: [null, 0, 1, null], seconds: null});
  assert.deepEqual(formatting.totals([...data.levels, {resources: [10, 0, 1, 10], seconds: 0}]), {resources: [null, 0, 2, null], seconds: null});
  for (const lang of languages) for (const showExact of [false, true]) {
    const locale = copy.locales[lang], doc = documentOf(runtime.renderTables(options(lang, [1, 1], showExact, data)));
    for (const selector of ['.desktop-table tbody tr', '.mobile-cards .level-card']) {
      const row = doc.querySelector(selector);
      for (const field of ['[data-resource="0"]', '[data-resource="3"]', '[data-seconds]', '[data-power]']) {
        const cell = row.querySelector(field);
        assert.equal(cell.querySelector('.missing').textContent, locale.labels.unknown);
        assert.equal(cell.querySelector('button.number'), null);
      }
      assert.equal(row.querySelector('[data-resource="1"] .number').textContent, '0');
      assert(row.querySelector('[data-resource="1"] .number').classList.contains('zero'));
      assert.equal(row.querySelector('.no-req').textContent, locale.labels.none);
      assert.notEqual(locale.labels.none, locale.labels.unknown);
    }
    const total = documentOf(runtime.renderTotals(options(lang, [1, 1], showExact, data)));
    assert.equal(total.querySelector('[data-total-resource="0"]').textContent, locale.labels.unknown);
    assert.equal(total.querySelector('[data-total-resource="1"]').textContent, exactNumber(0, locale) + locale.units.resourceSuffix);
    assert.equal(total.querySelector('[data-total-seconds]').textContent, locale.labels.unknown);
  }
});

test('pre-rendered six-language page tables agree with the client renderer and retain exact data without JavaScript', () => {
  assert.deepEqual(builder.pages, languages.map(lang => `${lang}/buildings/power-plant/index.html`));
  for (const lang of languages) {
    const file = `${lang}/buildings/power-plant/index.html`;
    const doc = parseHTML(fs.readFileSync(path.join(root, file), 'utf8')).document;
    const wrapper = doc.querySelector('[data-power-plant-original]');
    assert(wrapper, 'run the approved isolated page build before testing generated pages: ' + file);
    const embedded = JSON.parse(wrapper.querySelector('script[data-power-plant-model]').textContent);
    assert.deepEqual(embedded.model, model, file + ' raw embedded model');
    assert.deepEqual(embedded.locale, copy.locales[lang], file + ' localized copy');
    assert.deepEqual(embedded.links, links, file + ' links');
    assert.equal(embedded.lang, lang);
    const rendered = documentOf(runtime.renderTables(options(lang)));
    for (const selector of ['.desktop-table tbody tr[data-level]', '.mobile-cards .level-card[data-level]']) {
      assert.equal(wrapper.querySelectorAll(selector).length, 30);
      assert.deepEqual([...wrapper.querySelectorAll(selector)].map(rawTuple), [...rendered.querySelectorAll(selector)].map(rawTuple), file + ':' + selector);
    }
    assert.equal(normalizedMarkup(wrapper.querySelector('#tables').innerHTML), normalizedMarkup(runtime.renderTables(options(lang))), file + ' initial table HTML');
    assert.equal(normalizedMarkup(wrapper.querySelector('#totals').innerHTML), normalizedMarkup(runtime.renderTotals(options(lang))), file + ' initial totals HTML');
    assert.equal(wrapper.querySelector('.variation').textContent, copy.locales[lang].messages.variation);
  }
});

test('display and inclusive-total operations do not mutate frozen models, locale copy, or links', () => {
  const frozen = freezeDeep(JSON.parse(JSON.stringify(options())));
  const before = JSON.stringify(frozen);
  assert.doesNotThrow(() => runtime.renderTables(frozen));
  assert.doesNotThrow(() => runtime.renderTotals(frozen));
  assert.doesNotThrow(() => formatting.totals(frozen.model.levels));
  assert.equal(JSON.stringify(frozen), before);
});

test('localized literal text is escaped rather than interpreted as markup', () => {
  const input = JSON.parse(JSON.stringify(options('ko', [30, 30])));
  const literal = '<img src=x onerror="alert(1)"> & "literal"';
  input.locale.resources[0] = literal;
  input.locale.buildingNames[input.model.levels[29].requirements[0].buildingId] = literal;
  input.locale.labels.power = literal;
  const doc = documentOf(runtime.renderTables(input));
  assert.equal(doc.querySelector('[onerror]'), null);
  assert.equal(doc.querySelector('.resource-head').textContent, literal);
  assert(doc.querySelector('.requirements a').textContent.includes(literal));
  assert.equal(doc.querySelector('[data-power] button').getAttribute('data-label'), literal);
});
