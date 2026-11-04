'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const locales = require('../js/site-locales');
const dictionary = require('../js/platform-i18n');
const registry = require('../data/i18n/locales.json');
const root = path.resolve(__dirname, '..');
const js = (name) => fs.readFileSync(path.join(root, 'js', name), 'utf8');
function browser(code, body = '', head = '', href = `https://tilessurvive.net/${code}/heroes/tazan/?from=2&to=9#skills`) {
  const { window, document } = parseHTML(`<!doctype html><html lang="${code}" data-lang="${code}"><head><link rel="canonical" href="https://tilessurvive.net/${code}/heroes/tazan/">${head}</head><body>${body}</body></html>`);
  const url = new URL(href);
  const location = { href:url.href, origin:url.origin, pathname:url.pathname, search:url.search, hash:url.hash, hostname:url.hostname };
  window.location = location;
  const errors = [];
  window.console = { error:(...parts) => errors.push(parts), warn() {}, log() {} };
  const context = vm.createContext({window, document, location, URL, URLSearchParams, console:window.console,
    setTimeout, clearTimeout, CustomEvent:window.CustomEvent, navigator:{clipboard:{writeText:async()=>{}}}});
  const run = (name) => vm.runInContext(js(name), context, {filename:name});
  run('site-locales.js');
  return {window, document, location, run, errors, context};
}
function copyPayload(code, changes = {}) {
  const copy = Object.fromEntries(Object.keys(dictionary.en).map((key) => [key, code + ':' + key]));
  return `<script type="application/json" id="ts-global-ui">${JSON.stringify({locale:code,copy,...changes})}</script>`;
}

test('runtime embeds the complete authoritative locale registry', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(locales.locales)), registry.locales);
  assert.equal(new Set(locales.codes).size, 21);
  assert.equal(locales.defaultLocale, registry.defaultLocale);
  for (const row of registry.locales) {
    assert.equal(locales.normalize(row.code), row.code);
    assert.equal(locales.normalize(row.htmlLang), row.code);
    assert.equal(locales.normalize(row.hreflang), row.code);
    assert.doesNotThrow(() => new Intl.NumberFormat(row.numberLocale).format(1234.5));
  }
});
test('web language aliases never confuse Malay with Burmese or guess a Chinese script', () => {
  for (const [input, expected] of [['zh_Hant','zh-tw'],['zh-Hans-CN','zh-cn'],['ZH_tw','zh-tw'],['TW','zh-tw'],['ms-MY','ms'],['no-NO','nb'],['nb_NO','nb'],['fr-CA','fr']]) {
    assert.equal(locales.normalize(input), expected, input);
  }
  for (const input of ['my','my-MM','zh','xx','__proto__','']) assert.equal(locales.normalize(input), null, input);
  assert.equal(locales.locales.find((row) => row.code === 'ar').dir, 'rtl');
});
test('page alternates retain different slugs and take priority over generic route maps', () => {
  const b = browser('ko','', '<link rel="alternate" hreflang="en" href="https://tilessurvive.net/en/heroes/tarzan/">');
  assert.equal(b.window.TS_LOCALES.resolvePageUrl('en',{routes:{en:'/en/heroes/tazan/'}}), '/en/heroes/tarzan/?from=2&to=9#skills');
  assert.equal(b.window.TS_LOCALES.resolvePageUrl('en',{preserveState:false}), '/en/heroes/tarzan/');
});
test('explicit page availability maps accept only real safe locale routes', () => {
  const routes = {fr:'/fr/heroes/tarzan/',ar:'/ar/heroes/tarzan/',de:'https://example.com/de/heroes/tarzan/',ja:'javascript:alert(1)',it:'/en/heroes/tarzan/'};
  const b = browser('ko', `<script id="ts-locale-routes" type="application/json">${JSON.stringify(routes)}</script><header class="ts-header"><a hreflang="ru" href="/ru/">RU</a></header>`);
  assert.equal(b.window.TS_LOCALES.resolvePageUrl('fr'), '/fr/heroes/tarzan/?from=2&to=9#skills');
  for (const code of ['de','ja','it','ru','my']) assert.equal(b.window.TS_LOCALES.resolvePageUrl(code), null,code);
});
test('language switch is local during preview and preserves search and fragment exactly once', () => {
  const b = browser('ko','<header class="ts-header"><a hreflang="fr" href="/fr/heroes/tarzan/?old=1">FR</a><a hreflang="my" href="/my/">MY</a></header>', '<link rel="alternate" hreflang="fr" href="https://tilessurvive.net/fr/heroes/tarzan/">', 'http://127.0.0.1:3000/ko/heroes/tazan/?from=2&to=9#skills');
  b.window.TS_COPY = dictionary;
  b.run('platform-shell.js');
  assert.equal(b.document.querySelector('a[hreflang="fr"]').getAttribute('href'), '/fr/heroes/tarzan/?from=2&to=9#skills');
  assert.equal(b.window.TS_LANG.apply('fr'), true);
  assert.equal(b.location.href, '/fr/heroes/tarzan/?from=2&to=9#skills');
  assert.equal(b.window.TS_LANG.apply('my'), false);
  assert.equal(b.document.querySelector('[hreflang="my"]').getAttribute('aria-disabled'), 'true');
});
test('all original six locale dictionaries remain usable without a new payload', () => {
  for (const code of ['ko','en','ja','ru','zh-tw','de']) {
    const b = browser(code);
    b.run('platform-i18n.js');
    assert.equal(b.window.TS_I18N.require(code).search, dictionary[code].search);
    assert.equal(b.window.TS_I18N.requiredKeys.length, Object.keys(dictionary.en).length);
    assert.ok(b.window.TS_I18N.requiredKeys.every((key) => typeof b.window.TS_COPY[code][key] === 'string'));
  }
});

test('a language link preserves planner URL state changed after the initial render', () => {
  const b=browser('zh-cn','<header class="ts-header"><details open><summary>ZH-CN</summary><a hreflang="ko" href="/ko/buildings/power-plant/">한국어</a></details></header>', '<link rel="alternate" hreflang="ko" href="https://tilessurvive.net/ko/buildings/power-plant/">','http://127.0.0.1:4173/zh-cn/buildings/power-plant/');
  b.window.TS_COPY=dictionary;b.run('platform-shell.js');
  b.location.href='http://127.0.0.1:4173/zh-cn/buildings/power-plant/?profile=800005%3Aoriginal#upgrade-sheet';
  b.location.search='?profile=800005%3Aoriginal';b.location.hash='#upgrade-sheet';
  const a=b.document.querySelector('a[hreflang="ko"]');
  a.dispatchEvent(new b.window.Event('click',{bubbles:true,cancelable:true}));
  assert.equal(a.getAttribute('href'),'/ko/buildings/power-plant/?profile=800005%3Aoriginal#upgrade-sheet');
});
test('new locale UI needs a complete matching catalog and never silently displays English', () => {
  for (const code of locales.codes.filter((code) => !dictionary[code])) {
    const b = browser(code, copyPayload(code));
    b.run('platform-i18n.js');
    assert.equal(b.window.TS_COPY[code].calculate, code + ':calculate');
    assert.notEqual(b.window.TS_COPY[code].calculate, dictionary.en.calculate);
  }
  const missing = browser('fr');
  assert.throws(() => missing.run('platform-i18n.js'), /Incomplete UI translation for fr/);
  const incomplete = browser('fr', copyPayload('fr',{copy:{search:'Rechercher'}}));
  assert.throws(() => incomplete.run('platform-i18n.js'), /Incomplete UI translation for fr/);
  const wrong = browser('fr',copyPayload('es'));
  assert.throws(() => wrong.run('platform-i18n.js'), /does not match this page/);
});
test('legacy layout uses exact alternates instead of rewriting a differing entity slug', () => {
  const b = browser('ko','', '<link rel="alternate" hreflang="en" href="https://tilessurvive.net/en/heroes/tarzan/">');
  b.run('layout.js');
  assert.equal(b.window.TS_LANG.current(), 'ko');
  assert.equal(b.window.TS_LANG.url('en'), '/en/heroes/tarzan/?from=2&to=9#skills');
  assert.equal(b.window.TS_LANG.apply('fr'), false);
  assert.equal(b.window.TS_LANG.apply('en'), true);
});
test('all 21 locale home pages keep code-copy controls without altering numeric content', () => {
  for (const code of locales.codes) {
    const b = browser(code, copyPayload(code)+'<main><code>FREE2026</code><p data-number>123,456.78</p></main>','',`https://tilessurvive.net/${code}/`);
    b.run('platform-i18n.js');
    b.run('platform.js');
    assert.equal(b.document.querySelector('code').nextElementSibling.textContent, code+':copy', code);
    assert.equal(b.document.querySelector('[data-number]').textContent, '123,456.78');
  }
});
test('affiliate analytics classify new-locale routes without changing affiliate destinations', () => {
  const b = browser('fr','<a href="https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive" data-affiliate-placement="test">Offre</a>');
  const events = [];
  b.document.addEventListener('ts-affiliate-event',(event) => events.push(event.detail));
  b.run('platform-affiliate.js');
  b.document.querySelector('a').dispatchEvent(new b.window.Event('click',{bubbles:true}));
  assert.equal(events.length,1);
  assert.equal(events[0].page_type,'hero_detail');
  assert.equal(events[0].language,'fr');
  assert.equal(events[0].destination,'https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive');
});
test('existing published six-locale home pages retain all usable alternate routes', () => {
  for (const code of ['ko','en','ja','ru','zh-tw','de']) {
    const {document} = parseHTML(fs.readFileSync(path.join(root,code,'index.html'),'utf8'));
    const location = {href:`https://tilessurvive.net/${code}/?q=7#search`,origin:'https://tilessurvive.net'};
    for (const target of ['ko','en','ja','ru','zh-tw','de']) {
      assert.equal(locales.resolvePageUrl(target,{document,location}),`/${target}/?q=7#search`, code+' → '+target);
    }
  }
});
test('both search runtimes select the current-language shard and discard other-language results', async () => {
  for (const script of ['platform-search.js','site-search.js']) {
    const b=browser('fr',copyPayload('fr')+'<input id="siteSearchInput"><div id="siteSearchResults"></div><p id="siteSearchCount"></p>');
    b.location.search='?q=local';
    const requests=[];
    b.context.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>({items:[{language:'fr',title:'local français',description:'Description française',type:'guide',url:'/fr/guides/local/'},{language:'en',title:'local English',description:'Wrong language',type:'guide',url:'/en/guides/local/'}]})};};
    b.run('platform-i18n.js');b.run(script);
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(requests,['/data/search/fr.json']);
    assert.equal(b.document.querySelectorAll('#siteSearchResults article').length,1);
    assert.ok(b.document.getElementById('siteSearchResults').textContent.includes('français'));
    assert.ok(!b.document.getElementById('siteSearchResults').textContent.includes('English'));
    assert.equal(b.document.getElementById('siteSearchCount').textContent,'1 fr:results');
  }
});
test('legacy affiliate tracking preserves distinct Chinese site codes under script-based HTML lang tags', () => {
  for (const [code,tag] of [['zh-tw','zh-Hant'],['zh-cn','zh-Hans']]) {
    const b=browser(code,'<a href="https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive" data-affiliate-placement="test">Offer</a>');
    b.document.documentElement.lang=tag;
    const events=[];b.window.gtag=(...args)=>events.push(args);
    b.run('affiliate-tracking.js');
    b.document.querySelector('a').dispatchEvent(new b.window.Event('click',{bubbles:true}));
    assert.ok(events.length>0);
    assert.equal(events[0][2].language,code);
  }
});
