'use strict';

// Independent regression checks for the common building projection. These are
// read-only: no builder is executed and no source data is rewritten by tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {parseHTML} = require('linkedom');
const B = require('./build-building-system');
const runtime = require('../js/building-system');
const legacy = require('../js/client-buildings-52');
const root = path.resolve(__dirname, '..');
const baseline = '735307fd842f91536c3b5580471b553376fd2420';
const langs = ['ko', 'en', 'ja', 'ru', 'zh-tw', 'de'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const documentOf = html => parseHTML(html).document;
const previous = file => execFileSync('git', ['show', baseline + ':' + file], {cwd: root, encoding: 'utf8', maxBuffer: 15e6});
const sourceFiles = [
  ['data/client-buildings-52.json', '1bfdb5912c89fd852cd986539f4b5b8e2914a74e59f809c896aec308ffad436a'],
  ['data/content-60/buildings.json', '1d54f14e6173f00ded0a769bafa091cf319dd972f5a04a6165084d11a3ba06e9'],
  ['data/content-60/buildings-phase2.json', 'a4cb429dd505fbc8a6d6d8ada2732062726c4406ed827bc5fbce621b31ba2570'],
  ['data/building-refinement-51.json', '8a26f60b83623ddec22a83f1a4e9222782de1211e05a060a9aa0ab61202943f6']
];
const sourceBuildings = sourceFiles.slice(0, 3).flatMap(([file]) => JSON.parse(read(file)).buildings.map(b => ({
  id: b.id || b.buildingId, slug: b.slug, name: b.name,
  profiles: b.profiles.map(p => ({id: p.id.toLowerCase(), rows: p.rows || p.levels}))
})));
const evidence = require('../data/building-system-evidence.json');
sourceBuildings.push(...evidence.buildings.map(b => ({...structuredClone(b), profiles: b.profiles.map(p => ({id: p.id.toLowerCase(), rows: structuredClone(p.rows)}))})));
// Independently join the reviewed additive evidence; existing known values may
// never be overwritten and stage/rank is part of the lookup key.
for (const correction of evidence.corrections) {
  const building = sourceBuildings.find(b => b.id === correction.id);
  const profile = building.profiles.find(p => p.id === correction.profile.toLowerCase());
  const row = profile.rows.find(r => r.level === correction.level && r.rank === correction.rank);
  assert.equal(row[correction.field], null, 'evidence correction may only fill null fields');
  row[correction.field] = structuredClone(correction.value);
}
for (const building of sourceBuildings) for (const profile of building.profiles) for (const row of profile.rows) {
  const power = evidence.power.find(b => b.id === building.id)?.rows.find(r => r.level === row.level && r.rank === row.rank);
  if (!power) continue;
  if (row.battlePower !== undefined) assert.equal(row.battlePower, power.battlePower, 'retained power conflict');
  row.battlePower = power.battlePower;
}
const buildings = B.model.buildings || B.model;
const slugs = fs.readdirSync(path.join(root, 'ko/buildings')).filter(slug => fs.statSync(path.join(root, 'ko/buildings', slug)).isDirectory()).sort();
const numericProjection = row => ({
  level: row.level, rank: row.rank, resources: row.resources, seconds: row.seconds,
  requirements: row.requirements.map(q => ({buildingId: q.buildingId, level: q.level, rank: q.rank})),
  constructionItems: row.constructionItems.map(q => ({id: q.id ?? q.key, quantity: q.quantity ?? q.value})),
  ...(row.battlePower === undefined ? {} : {battlePower: row.battlePower})
});

function known(row) {
  return row.availability !== 'initial_conditions_unconfirmed' && Array.isArray(row.resources) && row.resources.length === 4 && row.resources.every(Number.isSafeInteger) && Number.isSafeInteger(row.seconds);
}
function independentSum(rows) {
  const totals = {resources: [0n, 0n, 0n, 0n], seconds: 0n};
  for (const row of rows) {
    row.resources.forEach((value, index) => { totals.resources[index] += BigInt(value); });
    totals.seconds += BigInt(row.seconds);
  }
  return {resources: totals.resources.map(Number), seconds: Number(totals.seconds)};
}

test('source records remain unchanged and all 29 independent building IDs retain their own reviewed profiles', () => {
  for (const [file, hash] of sourceFiles) {
    const actual = crypto.createHash('sha256').update(read(file).replaceAll('\r\n', '\n')).digest('hex');
    assert.equal(actual, hash, file + ' source data changed without reconciliation');
  }
  assert.equal(slugs.length, 22);
  assert.deepEqual([...B.slugs].sort(), slugs);
  assert.deepEqual([...B.langs].sort(), [...langs].sort());
  assert.deepEqual(buildings.map(b => b.id).sort((a, b) => a - b), sourceBuildings.map(b => b.id).sort((a, b) => a - b));
  assert.equal(new Set(buildings.map(b => b.id)).size, 29);
  let rows = 0;
  for (const source of sourceBuildings) {
    const actual = buildings.find(b => b.id === source.id);
    assert.equal(actual.slug, source.slug);
    assert.deepEqual(actual.name, source.name);
    assert.deepEqual(actual.profiles.map(p => p.id).sort(), source.profiles.map(p => p.id).sort());
    for (const profile of source.profiles) {
      const published = actual.profiles.find(p => p.id === profile.id);
      assert.deepEqual(published.rows.map(numericProjection), profile.rows.map(numericProjection), source.id + ':' + profile.id);
      rows += profile.rows.length;
    }
  }
  assert.equal(rows, 1522);
});

test('all construction and upgrade ranges use independent BigInt totals, preserving profile and rank boundaries', () => {
  let ranges = 0;
  for (const building of buildings) for (const profile of building.profiles) {
    const rows = profile.rows;
    const max = Math.max(...rows.map(row => row.level));
    const before = JSON.stringify(rows);
    for (let from = 0; from <= max; from++) for (let to = from; to <= max; to++) {
      const selected = rows.filter(row => row.level > from && row.level <= to);
      const label = `${building.id}:${profile.id} ${from}->${to}`;
      if (!selected.every(known)) {
        assert.throws(() => runtime.sumRange(rows, from, to), /missing/i, label);
      } else {
        const expected = independentSum(selected);
        const result = runtime.sumRange(rows, from, to);
        assert.deepEqual(result.resources, expected.resources, label + ' resources');
        assert.equal(result.seconds, expected.seconds, label + ' seconds');
        assert.deepEqual(result.shortage, expected.resources, label + ' no inventory');
        assert.deepEqual(result.levels, selected.map(row => row.level), label + ' transitions');
        const items = new Map();
        for (const row of selected) for (const item of row.constructionItems) items.set(item.id, (items.get(item.id) || 0) + item.quantity);
        assert.deepEqual(result.constructionItems.map(item => [item.id, item.quantity]).sort(), [...items].sort(), label + ' separate construction items');
      }
      ranges++;
    }
    assert.equal(JSON.stringify(rows), before, 'calculation mutated ' + building.id);
  }
  assert(ranges > 25000);
});

test('inventory is applied once; unconfirmed data, missing levels and malformed input never become zero', () => {
  const rows = sourceBuildings.find(b => b.id === 800005).profiles.find(p => p.id === 'd').rows;
  const result = runtime.sumRange(rows, 9, 10, [700000, 100, 64406, 0]);
  assert.deepEqual(result.resources, [673000, 351000, 64405, 0]);
  assert.deepEqual(result.shortage, [0, 350900, 0, 0]);
  assert.equal(result.seconds, 21600);
  assert.throws(() => runtime.sumRange(rows, -1, 2), /invalid/i);
  assert.throws(() => runtime.sumRange(rows, 3, 2), /invalid/i);
  assert.throws(() => runtime.sumRange(rows, 1, 31), /invalid|missing/i);
  assert.throws(() => runtime.sumRange(rows, 1.5, 2), /invalid/i);
  assert.throws(() => runtime.sumRange(rows, 1, 2, [.5, 0, 0, 0]), /invalid/i);
  assert.throws(() => runtime.sumRange(rows, 1, 2, [0, 0, 0]), /invalid/i);
  assert.throws(() => runtime.sumRange(rows, 1, 2, [NaN, 0, 0, 0]), /invalid/i);
  assert.throws(() => runtime.sumRange(rows.slice(2), 1, 3), /missing/i);
  const unknown = structuredClone(rows);
  unknown[1].resources[0] = null;
  assert.throws(() => runtime.sumRange(unknown, 1, 2), /missing/i);
  unknown[1].resources = null;
  assert.throws(() => runtime.sumRange(unknown, 1, 2), /missing/i);
  const missingTime = structuredClone(rows);
  missingTime[1].seconds = null;
  assert.throws(() => runtime.sumRange(missingTime, 1, 2), /missing/i);
  assert.deepEqual(runtime.sumRange(rows, 10, 10).resources, [0, 0, 0, 0]);
});

test('legacy calculator numerical behavior is unchanged for all already supported upgrade transitions', () => {
  for (const building of sourceBuildings.slice(0, 4)) for (const profile of building.profiles) {
    for (let from = 1; from < 30; from++) for (let to = from + 1; to <= 30; to++) {
      const previous = legacy.sumRange(profile.rows, from, to, [13, 27, 41, 55]);
      const current = runtime.sumRange(profile.rows, from, to, [13, 27, 41, 55]);
      for (const field of ['resources', 'seconds', 'shortage', 'levels']) assert.deepEqual(current[field], previous[field], `${building.id}:${profile.id} ${from}->${to} ${field}`);
    }
  }
  const barracks2 = sourceBuildings.find(b => b.id === 800008).profiles.find(p => p.id === 'original');
  const barracks3 = sourceBuildings.find(b => b.id === 800009).profiles.find(p => p.id === 'original');
  assert.equal(runtime.sumRange(barracks2.rows, 4, 5).seconds, 360);
  assert.equal(runtime.sumRange(barracks3.rows, 4, 5).seconds, 300);
});

test('six-language runtime keeps profile selection, level filtering, exact display and inventory calculations independent', () => {
  for (const lang of langs) {
    const d = documentOf(B.sheet(lang, 'houses'));
    const host = d.querySelector('[data-building-system]');
    const choice = host.querySelector('[data-bs-choice]');
    const level = host.querySelector('[data-bs-level]');
    const exact = host.querySelector('[data-bs-exact]');
    for (const [element, initial] of [[choice, ''], [level, 'all']]) {
      let value = initial;
      Object.defineProperty(element, 'value', {get: () => value, set: next => { value = String(next); }});
    }
    const change = element => element.dispatchEvent(new d.defaultView.Event('change', {bubbles: true}));
    const field = name => host.querySelector(`[name="${name}"]`);
    const result = host.querySelector('[data-bs-result]');
    const payload = host.querySelector('[data-building-system-model]').textContent;
    runtime.init(d);
    assert.equal(host.querySelector('[data-bs-inputs]').disabled, true);
    assert.equal(result.dataset.result, 'unselected');
    choice.value = '800115:d';
    change(choice);
    const active = [...host.querySelectorAll('[data-bs-profile]')].filter(panel => !panel.hidden);
    assert.equal(active.length, 1);
    assert.equal(active[0].getAttribute('data-bs-profile'), '800115:d');
    assert.equal(active[0].open, true);
    assert.equal(host.querySelector('[data-bs-inputs]').disabled, false);
    level.value = '2';
    change(level);
    assert.equal(active[0].querySelectorAll('[data-level]:not([hidden])').length, 2, 'one table row and one mobile card');
    exact.checked = true;
    change(exact);
    const source = buildings.find(b => b.id === 800115).profiles.find(p => p.id === 'd').rows;
    const value = active[0].querySelector('tr[data-level="2"] [data-resource="0"] button');
    assert.equal(value.textContent, source[1].resources[0].toLocaleString(lang === 'zh-tw' ? 'zh-TW' : lang));
    field('from').value = '1';
    field('to').value = '3';
    field('held-0').value = '999999999';
    field('from').dispatchEvent(new d.defaultView.Event('input', {bubbles: true}));
    const expected = independentSum(source.filter(row => row.level > 1 && row.level <= 3));
    const actual = JSON.parse(result.dataset.result);
    assert.deepEqual(actual.resources, expected.resources, lang + ' calculation must ignore display-level filter');
    assert.equal(actual.seconds, expected.seconds);
    assert.equal(actual.shortage[0], 0);
    field('from').value = '';
    field('from').dispatchEvent(new d.defaultView.Event('input', {bubbles: true}));
    assert.equal(result.dataset.result, 'invalid', lang + ' empty input must not be zero');
    choice.value = '';
    change(choice);
    assert.equal(result.dataset.result, 'unselected');
    assert.equal(host.querySelector('[data-bs-inputs]').disabled, true);
    assert.equal([...host.querySelectorAll('[data-bs-profile]')].filter(panel => !panel.hidden).length, 12);
    assert.equal(host.querySelector('[data-building-system-model]').textContent, payload, 'UI never mutates source payload');
    runtime.init(d);
    assert.equal(host.querySelectorAll('[data-bs-choice]').length, 1, 'initialization is idempotent');
  }
});

test('runtime refuses incomplete construction rows while preserving valid upgrade-only ranges', () => {
  const d = documentOf(B.sheet('ko', 'barracks'));
  const host = d.querySelector('[data-building-system]');
  const choice = host.querySelector('[data-bs-choice]');
  const level = host.querySelector('[data-bs-level]');
  for (const [element, initial] of [[choice, '800007:original'], [level, 'all']]) {
    let value = initial;
    Object.defineProperty(element, 'value', {get: () => value, set: next => { value = String(next); }});
  }
  runtime.init(d);
  const from = host.querySelector('[name="from"]');
  const to = host.querySelector('[name="to"]');
  const output = host.querySelector('[data-bs-result]');
  from.value = '0'; to.value = '2';
  from.dispatchEvent(new d.defaultView.Event('input', {bubbles: true}));
  assert.equal(output.dataset.result, 'missing');
  from.value = '1';
  from.dispatchEvent(new d.defaultView.Event('input', {bubbles: true}));
  const actual = JSON.parse(output.dataset.result);
  const source = sourceBuildings.find(b => b.id === 800007).profiles.find(p => p.id === 'original').rows;
  assert.deepEqual(actual.resources, independentSum([source[1]]).resources);
});

test('capture URLs retain legacy range/exact state across languages and house fragments reveal their actual records', () => {
  function browser(slug, query, hash = '') {
    const links = langs.map(lang => `<a hreflang="${lang}" href="/${lang}/buildings/${slug}/">${lang}</a>`).join('');
    const d = documentOf(`<!doctype html><html><body><header class="ts-header"><nav class="ts3-language">${links}</nav></header>${B.sheet('ko', slug)}</body></html>`);
    for (const [selector, initial] of [['[data-bs-choice]', ''], ['[data-bs-level]', 'all']]) {
      let value = initial;
      Object.defineProperty(d.querySelector(selector), 'value', {get: () => value, set: next => { value = String(next); }});
    }
    const location = {href: `https://tilessurvive.net/ko/buildings/${slug}/${query}${hash}`, search: query, hash, assign: value => { location.assigned = value; }};
    const handlers = {};
    const window = {document: d, location, history: {replaceState() {}}, addEventListener: (name, fn) => { handlers[name] = fn; }};
    vm.runInNewContext(read('js/building-system.js'), {window, URL, URLSearchParams});
    return {d, location, handlers, window};
  }
  const capture = browser('power-plant', '?capture=1&range=26-30&exact=1');
  const host = capture.d.querySelector('[data-building-system]');
  assert(capture.d.documentElement.hasAttribute('data-building-capture'));
  assert.equal(host.querySelector('[data-bs-exact]').checked, true);
  assert.equal(host.querySelector('[data-bs-level]').value, '26-30');
  assert.deepEqual([...host.querySelectorAll('[data-bs-profile]:not([hidden]) table tr[data-level]:not([hidden])')].map(n => Number(n.dataset.level)), [26, 27, 28, 29, 30]);
  // The shared deferred shell also appends the original location.search. The
  // building owner must normalize the href after that initialization completes.
  vm.runInNewContext(read('js/platform-shell.js'), {window: capture.window, document: capture.d, location: capture.location});
  capture.d.dispatchEvent(new capture.d.defaultView.Event('DOMContentLoaded'));
  for (const link of capture.d.querySelectorAll('.ts3-language a')) {
    const url = new URL(link.href, 'https://tilessurvive.net');
    assert.equal((link.href.match(/\?/g) || []).length, 1, 'shared shell must not duplicate the query string');
    assert.equal(url.searchParams.get('level'), '26-30');
    assert.equal(url.searchParams.get('exact'), '1');
    assert.equal(url.searchParams.get('capture'), '1');
  }
  const house = browser('houses', '', '#building-800115');
  assert([...house.d.querySelectorAll('[data-bs-profile^="800115:"]')].every(n => n.open && !n.hidden));
  house.location.hash = '#building-heading-800113';
  house.handlers.hashchange();
  assert([...house.d.querySelectorAll('[data-bs-profile^="800113:"]')].every(n => n.open && !n.hidden));
});

test('all 132 documents retain canonical URLs, six language alternatives, static content and accessible unique controls', () => {
  let staticRows = 0;
  for (const lang of langs) for (const slug of slugs) {
    const file = `${lang}/buildings/${slug}/index.html`;
    const d = documentOf(read(file));
    const url = `https://tilessurvive.net/${lang}/buildings/${slug}/`;
    assert.equal(d.querySelector('link[rel="canonical"]').href, url, file);
    for (const language of langs) assert(d.querySelector(`link[rel="alternate"][hreflang="${language}"][href="https://tilessurvive.net/${language}/buildings/${slug}/"]`), file + ' ' + language);
    assert.equal(d.querySelectorAll('h1').length, 1, file + ' h1');
    assert(d.querySelector('meta[name="description"]').content.includes(d.querySelector('h1').textContent), file + ' unique description');
    assert.equal(d.querySelectorAll('#upgrade-sheet').length, 1, file + ' upgrade anchor');
    const ids = [...d.querySelectorAll('[id]')].map(n => n.id);
    assert.equal(new Set(ids).size, ids.length, file + ' duplicate IDs');
    for (const node of d.querySelectorAll('[aria-controls]')) for (const id of node.getAttribute('aria-controls').split(/\s+/)) assert(d.getElementById(id), file + ' missing control ' + id);
    const expectedBuildings = buildings.filter(b => b.slug === slug);
    const host = d.querySelector('[data-building-system]');
    assert(host, file + ' common sheet');
    if (!expectedBuildings.length) {
      assert.equal(slug, 'enlistment-office');
      assert.equal(host.querySelectorAll('table').length, 0, 'no invented enlistment data');
      continue;
    }
    const panels = [...host.querySelectorAll('details[data-bs-profile]')];
    assert.equal(panels.length, expectedBuildings.reduce((n, b) => n + b.profiles.length, 0), file + ' profiles');
    assert(host.querySelector('[data-bs-choice]'), file + ' profile choice');
    assert(host.querySelector('[data-bs-level]'), file + ' level selection');
    assert(host.querySelector('[data-bs-exact]'), file + ' precision selection');
    for (const b of expectedBuildings) for (const p of b.profiles) {
      const panel = panels.find(node => node.getAttribute('data-bs-profile') === `${b.id}:${p.id}`);
      assert(panel, file + ' profile ' + b.id + ':' + p.id);
      const rows = [...panel.querySelectorAll('table tbody tr[data-level]')];
      assert.equal(rows.length, p.rows.length, file + ' static rows');
      for (const source of p.rows) {
        const row = rows.find(r => Number(r.getAttribute('data-level')) === source.level);
        assert(row, file + ' level ' + source.level);
        for (let i = 0; i < 4; i++) {
          const value = source.resources === null ? null : source.resources[i];
          const cell = row.querySelector(`[data-resource="${i}"]`);
          assert(cell, file + ' resource column ' + i);
          if (value === null) assert(!cell.hasAttribute('data-raw') || cell.getAttribute('data-raw') === 'null', file + ' unknown value became numeric');
          else {
            assert(cell.hasAttribute('data-raw'), file + ' missing raw quantity');
            assert.equal(Number(cell.getAttribute('data-raw')), value, file + ` ${b.id}:${p.id} Lv.${source.level} resource ${i}`);
          }
        }
        staticRows++;
      }
    }
  }
  assert.equal(staticRows, 9132, '1,522 distinct source rows in each of six languages');
});

test('building catalog lists all 22 existing routes without duplicate entries or embedded level tables', () => {
  for (const lang of langs) {
    const d = documentOf(read(`${lang}/buildings/index.html`));
    const cards = [...d.querySelectorAll('.building-card')];
    assert.equal(cards.length, 22);
    const targets = cards.map(card => card.querySelector('.building-link').getAttribute('href'));
    assert.equal(new Set(targets).size, 22);
    assert.deepEqual(targets.sort(), slugs.map(slug => `/${lang}/buildings/${slug}/`).sort());
    assert.equal(d.querySelectorAll('main table').length, 0);
  }
});

test('all reviewed functional effects are joined by building, profile, level, rank and metric without copying power values', () => {
  let count = 0;
  for (const lang of langs) for (const building of evidence.effects) {
    const d = documentOf(read(`${lang}/buildings/${building.slug}/index.html`));
    const host = d.querySelector('[data-bs-effects]');
    assert(host, building.slug + ' source-reviewed effects');
    for (const profile of building.profiles) {
      const panel = host.querySelector(`[data-bs-effect-profile="${profile.id.toLowerCase()}"]`);
      assert(panel);
      const metrics = profile.metrics || building.metrics;
      const rows = [...panel.querySelectorAll('tr[data-effect-level]')];
      assert.equal(rows.length, profile.rows.length);
      for (const row of profile.rows) {
        const actual = rows.find(n => Number(n.getAttribute('data-effect-level')) === row.level && Number(n.getAttribute('data-effect-rank')) === row.rank);
        assert(actual, building.slug + ' ' + profile.id + ' level/rank');
        for (let i = 0; i < metrics.length; i++) {
          const cell = actual.querySelector(`[data-effect-id="${metrics[i].id}"]`);
          assert(cell);
          assert.equal(cell.getAttribute('data-effect-value'), String(row.values[i]));
        }
        count++;
      }
    }
  }
  assert.equal(count, 4680, '780 source effect rows in six locales');
});

test('unconfirmed initial gates remain explicit in desktop and mobile rows even when individual fields are verified', () => {
  for (const lang of langs) for (const slug of ['refinery', 'lab-2']) {
    const cfg = B.config(lang, slug);
    const d = documentOf(read(`${lang}/buildings/${slug}/index.html`));
    for (const profile of d.querySelectorAll('[data-bs-profile]')) {
      const sourceProfile = cfg.buildings[0].profiles.find(p => profile.getAttribute('data-bs-profile').endsWith(':' + p.id));
      const source = sourceProfile.rows.find(r => r.level === 1);
      const row = profile.querySelector('tr[data-level="1"]');
      const card = profile.querySelector('.level-card[data-level="1"]');
      assert(row.textContent.includes(cfg.copy.initial));
      assert(card.textContent.includes(cfg.copy.initial));
      if (!source.requirements.length) assert.equal(row.querySelector('.condition').textContent.trim(), cfg.locale.labels.unknown, 'unknown gate must not display no requirements');
      else assert.deepEqual([...row.querySelectorAll('[data-building-id]')].map(n => Number(n.dataset.buildingId)), source.requirements.map(q => q.buildingId), 'individually verified prerequisites remain visible');
      assert.equal(profile.querySelector('[data-bs-total-status]').getAttribute('data-bs-total-status'), 'missing', 'construction-inclusive total remains unavailable');
    }
  }
});

test('analytics, affiliate destinations, image sources and meaningful existing table fragments survive', () => {
  const analytics = d => [...d.querySelectorAll('script')].filter(node => /googletagmanager|gtag\(/.test(node.outerHTML)).map(node => node.outerHTML);
  const affiliate = d => [...d.querySelectorAll('a[href*="lootbar"]')].map(node => node.href).sort();
  for (const lang of langs) for (const slug of slugs) {
    const file = `${lang}/buildings/${slug}/index.html`;
    const old = documentOf(previous(file));
    const current = documentOf(read(file));
    assert.deepEqual(analytics(current), analytics(old), file + ' analytics');
    assert.deepEqual(affiliate(current), affiliate(old), file + ' affiliate');
    for (const anchor of old.querySelectorAll('[id^="ts3-data-table-"]')) assert(current.getElementById(anchor.id), file + ' existing #' + anchor.id);
    const values = table => [...table.querySelectorAll('tbody tr')].map(row => [...row.children].map(cell => cell.getAttribute('data-ts-original-value') || cell.textContent.replace(/\s+/g, ' ').trim()));
    for (const table of old.querySelectorAll('main table[id]')) {
      if (table.closest('[data-building-growth-60],[data-power-plant-original],[data-client-building-52]')) continue;
      if (table.closest('[data-building-refinement-51]') || ['hero-academy', 'warbringer-monument', 'aegis-monument', 'guardian-of-life-monument', 'cursed-wound-stele', 'blessed-healing-stele'].includes(slug)) continue;
      const retained = current.getElementById(table.id);
      assert.equal(retained?.tagName, 'TABLE', file + ' retained effect/research table #' + table.id);
      assert.deepEqual(values(retained), values(table), file + ' retained effects/research values #' + table.id);
    }
    for (const image of old.querySelectorAll('[data-building-art-51],[data-building-phase2-art]')) assert([...current.querySelectorAll('img')].some(node => node.getAttribute('src') === image.getAttribute('src')), file + ' verified image');
  }
});

test('common projection is idempotent in all languages and every building-specific internal link resolves', () => {
  const cache = new Map();
  for (const lang of langs) for (const slug of slugs) {
    const file = `${lang}/buildings/${slug}/index.html`;
    const html = read(file);
    assert.equal(B.project(html, lang, slug), html, file + ' idempotence');
    const d = documentOf(html);
    const pageUrl = `https://tilessurvive.net/${file.replace(/index\.html$/, '')}`;
    const baseUrl = new URL(d.querySelector('base[href]')?.getAttribute('href') || pageUrl, pageUrl);
    for (const link of d.querySelectorAll('main a[href]')) {
      const href = link.getAttribute('href');
      const url = new URL(href, baseUrl);
      if (href.startsWith('#') && link.closest('[data-bs-content],[data-building-system],[data-bs-related]')) assert.equal(url.pathname, new URL(pageUrl).pathname, file + ' hash link must account for base href');
      if (url.origin !== 'https://tilessurvive.net' || !/^\/(ko|en|ja|ru|zh-tw|de)\/(buildings|guides)\//.test(url.pathname)) continue;
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '') + (url.pathname.endsWith('/') ? 'index.html' : '');
      assert(fs.existsSync(path.join(root, relative)), file + ' broken route ' + url.pathname);
      if (url.hash) {
        if (!cache.has(relative)) cache.set(relative, documentOf(read(relative)));
        assert(cache.get(relative).getElementById(decodeURIComponent(url.hash.slice(1))), file + ' broken fragment ' + url.pathname + url.hash);
      }
    }
  }
});
