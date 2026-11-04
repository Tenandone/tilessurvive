'use strict';
// Focused regressions for the audited existing-language defects. No writes/builds.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseHTML } = require('linkedom');
const G = require('./build-german-50');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'edbac42bb41ba4289c24caa5635e388f1cd80e53';
const RU = 'ru/guides/reservoir-raid/index.html';
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const doc = html => parseHTML(html).document;
const text = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();
const prior = file => execFileSync('git', ['show', BASE + ':' + file], { cwd: ROOT, encoding: 'utf8', maxBuffer: 8e6 });
const DE_SCHEMA = [
  'behemoths/legend-griffin', 'behemoths/marine-drake',
  'buildings/comms-outpost', 'buildings/lab', 'codes',
  'database/alliance-duel', 'database/behemoth-cell', 'database/exclusive-gear',
  'database/hero-exp', 'database/hero-star', 'database/legend-gear-star',
  'database/skill-book', 'database/turtle-race', 'database/vip-point',
  'guides/beginner-guide', 'guides/discount-topup', 'guides/discount-topup-promotion',
  'guides/gift-code-how-to-use', 'guides/reservoir-raid',
  'seasons/season-1', 'seasons/season-2', 'seasons/season-3',
].map(route => 'de/' + route + '/index.html');
const ALIASES = [
  ['de/calculators/index.html', '/de/tools/'],
  ['de/heroes/tarzan/index.html', '/de/heroes/tazan/'],
  ['de/behemoths/tidal-drake/index.html', '/de/behemoths/marine-drake/'],
];
function* nodes(value) {
  if (Array.isArray(value)) { for (const item of value) yield* nodes(item); }
  else if (value && typeof value === 'object') {
    if (value['@type']) yield value;
    for (const item of Object.values(value)) yield* nodes(item);
  }
}
const schemas = d => [...d.querySelectorAll('script[type="application/ld+json"]')].flatMap(s => [...nodes(JSON.parse(s.textContent))]);
const refresh = d => d.querySelector('meta[http-equiv="refresh"]')?.getAttribute('content');
const protectedScripts = d => [...d.querySelectorAll('script')].filter(s => /adsbygoogle|googletagmanager|gtag\(|consent|fundingchoices|__tcfapi/i.test(s.outerHTML)).map(s => s.outerHTML);

test('German JSON localization handles regional English tags without rewriting other languages or IDs', () => {
  const value = { language: 'en-US', inLanguage: 'en-GB', id: 'en-US', unit: 'en-US', children: [
    { inLanguage: 'en' }, { inLanguage: 'EN-us' }, { inLanguage: 'zh-Hant' },
    { inLanguage: 'ru-RU' }, { language: 'de' }, { language: 'english' },
  ], count: 30, unknown: null };
  const before = JSON.stringify(value);
  const localized = G.localizeJSON(value, s => s, 'regression');
  assert.equal(localized.language, 'de');
  assert.equal(localized.inLanguage, 'de');
  assert.equal(localized.id, 'en-US');
  assert.equal(localized.unit, 'en-US');
  assert.deepEqual(localized.children, [{ inLanguage: 'de' }, { inLanguage: 'de' },
    { inLanguage: 'zh-Hant' }, { inLanguage: 'ru-RU' }, { language: 'de' }, { language: 'english' }]);
  assert.equal(localized.count, 30);
  assert.equal(localized.unknown, null);
  assert.equal(JSON.stringify(value), before, 'source object remains unchanged');
});

function aliasFixture(target) {
  return `<!doctype html><html lang="en"><head><meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="https://tilessurvive.net/en/tools/"><script type="application/ld+json">{"@type":"WebPage","inLanguage":"en-US"}</script></head><body><main><h1>Tools</h1><a href="/en/tools/">Continue</a></main></body></html>`;
}
test('German rendering localizes relative and absolute internal alias moves with canonical and fallback link', () => {
  for (const target of ['/en/tools/', 'https://tilessurvive.net/en/tools/']) {
    const d = doc(G.render(aliasFixture(target), s => s, 'calculators/index.html'));
    assert.equal(refresh(d), '0; url=' + target.replace('/en/', '/de/'));
    assert.equal(d.querySelector('link[rel="canonical"]').href, 'https://tilessurvive.net/de/tools/');
    assert.equal(d.querySelector('main a').href, '/de/tools/');
    assert.equal(schemas(d)[0].inLanguage, 'de');
  }
});

test('German rendering does not rewrite external redirect destinations or unrelated meta content', () => {
  const external = 'https://example.com/en/tools/';
  const d = doc(G.render(aliasFixture(external), s => s, 'calculators/index.html'));
  assert.equal(refresh(d), '0; url=' + external);
});

test('all 22 audited German pages have consistent Article/WebPage language', () => {
  assert.equal(DE_SCHEMA.length, 22);
  for (const file of DE_SCHEMA) {
    const selected = schemas(doc(read(file))).filter(n => ['Article', 'WebPage'].includes(n['@type']));
    assert(selected.length, file + ' still has page schema');
    for (const node of selected) assert.match(node.inLanguage, /^de(?:-|$)/i, file + ' ' + node['@type']);
  }
});

test('all three German aliases retain noindex and agree on the existing German destination', () => {
  for (const [file, destination] of ALIASES) {
    const d = doc(read(file));
    assert.equal(refresh(d), '0; url=' + destination, file);
    assert.equal(d.querySelector('link[rel="canonical"]').href, 'https://tilessurvive.net' + destination, file);
    assert.match(d.querySelector('meta[name="robots"]').content, /noindex/, file);
    assert.equal(d.querySelector('main p a').href, destination, file);
    assert(fs.existsSync(path.join(ROOT, destination, 'index.html')), file + ' destination exists');
  }
});

test('Russian article, navigation and accessible video text are Russian with local schema destinations', () => {
  const d = doc(read(RU));
  assert.equal(d.documentElement.lang, 'ru');
  for (const n of d.querySelectorAll('main h1,main h2,main h3,main li,main p,main .note-box,main nav a')) {
    assert.match(text(n), /[А-Яа-яЁё]/, 'Russian text required: ' + text(n));
    assert(!/Reservoir Raid|Entry Requirements|Source:|PHASE|EN GUIDE/.test(text(n)), text(n));
  }
  assert.match(d.querySelector('main iframe').title, /водохранилище/);
  assert.equal(d.querySelector('main .breadcrumb a').href, '/ru/');
  const article = schemas(d).find(n => n['@type'] === 'Article');
  assert.equal(article.inLanguage, 'ru');
  assert.equal(article.mainEntityOfPage, 'https://tilessurvive.net/ru/guides/reservoir-raid/');
  assert.equal(article.headline, text(d.querySelector('main h1')));
  const crumbs = schemas(d).find(n => n['@type'] === 'BreadcrumbList').itemListElement;
  assert.deepEqual(crumbs.map(n => n.item), ['https://tilessurvive.net/ru/', 'https://tilessurvive.net/ru/guides/', 'https://tilessurvive.net/ru/guides/reservoir-raid/']);
});

test('Russian translation preserves each article block numeric value, structure, anchors and video', () => {
  const old = doc(prior(RU)), current = doc(read(RU));
  const numericBlocks = d => [...d.querySelectorAll('main article h2,main article h3,main article li,main article p,main article .phase-label')].map(n => text(n).match(/[+−-]?\d+(?:[.,]\d+)?%?/g) || []);
  assert.deepEqual(numericBlocks(current), numericBlocks(old), 'same values in the same semantic blocks, including 30+10/R4/50%/+15%/phase numbers');
  const topology = d => [...d.querySelectorAll('main *')].map(n => [n.tagName, n.id, n.className]);
  assert.deepEqual(topology(current), topology(old), 'same article sections and controls');
  const urls = d => [...d.querySelectorAll('main a[href]')].map(n => n.href);
  assert.deepEqual(urls(current), urls(old).map(u => u === '/en/' ? '/ru/' : u === '/en/guides/' ? '/ru/guides/' : u));
  const media = d => [...d.querySelectorAll('img[src],iframe[src]')].map(n => [n.tagName, n.getAttribute('src')]);
  assert.deepEqual(media(current), media(old), 'existing image and video assets unchanged');
  for (const a of current.querySelectorAll('main a[href*="#"]')) assert(current.getElementById(a.href.split('#')[1]), 'fragment still exists ' + a.href);
});

test('all 26 owned pages preserve existing advertisement/analytics/consent scripts and numeric source tables', () => {
  for (const file of [RU, ...DE_SCHEMA, ...ALIASES.map(a => a[0])]) {
    const old = doc(prior(file)), current = doc(read(file));
    assert.deepEqual(protectedScripts(current), protectedScripts(old), 'protected scripts unchanged: ' + file);
    const numericTables = d => [...d.querySelectorAll('main table tr')].map(n => text(n).match(/[+−-]?\d+(?:[.,]\d+)?%?/g) || []);
    assert.deepEqual(numericTables(current), numericTables(old), 'existing numeric tables unchanged: ' + file);
    const payloads = d => [...d.querySelectorAll('script[type="application/json"]')].filter(n=>!['ts-global-ui','ts-locale-routes'].includes(n.id)).map(n => n.textContent);
    assert.deepEqual(payloads(current), payloads(old), 'existing runtime data unchanged: ' + file);
  }
});
