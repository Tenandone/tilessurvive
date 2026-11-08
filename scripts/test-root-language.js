'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {parseHTML} = require('linkedom');
const registry = require('../data/i18n/locales.json').locales.filter(l => l.status === 'published');

const root = path.resolve(__dirname, '..');
const origin = 'https://tilessurvive.net';
const choiceKey = 'tiles.locale.explicit.v1';
const englishRootTitle = 'Tiles Survive Guide | TilesSurvive.net';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const dom = source => parseHTML(source).document;
const home = code => dom(read(code + '/index.html'));
const metadata = (document, attr, key) => document.querySelector(`meta[${attr}="${key}"]`)?.content;
const canonical = document => document.querySelector('link[rel="canonical"]')?.href;
const manifests = document => JSON.parse(document.getElementById('ts-root-home').textContent);
const normalText = node => node.textContent.replace(/\s+/g, ' ').trim();

// Compare the human-facing dashboard, its destinations and its calculation inputs
// with the already-published localized home. Root-only metadata lives in the head.
function dashboard(document, rootDestinations = false) {
  const main = document.querySelector('main#main');
  assert(main?.querySelector('[data-v5-home]'), 'A complete landing page is required');
  return {
    headings: [...main.querySelectorAll('h1,h2,h3')].map(normalText),
    links: [...main.querySelectorAll('a[href]')].map(a => {
      const href = a.getAttribute('href');
      const localPrefix = '/' + document.documentElement.dataset.lang + '/#';
      return [normalText(a), rootDestinations && href.startsWith(localPrefix) ? '/#' + href.slice(localPrefix.length) : href];
    }),
    images: [...main.querySelectorAll('img[src]')].map(img => [img.getAttribute('src'), img.getAttribute('alt')]),
    configs: ['[data-v5-config]', '[data-gift-config]'].map(selector => JSON.parse(document.querySelector(selector).textContent)),
  };
}

function checkAlternates(document) {
  const found = [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(n => [n.hreflang,n.href]).sort();
  const expected = registry.map(l => [l.hreflang, `${origin}/${l.code}/`]);
  expected.push(['x-default', origin + '/']);
  assert.deepEqual(found, expected.sort());
}

test('raw root HTML contains the complete English dashboard and 21 direct language links', () => {
  const document = dom(read('index.html'));
  assert(document.documentElement.hasAttribute('data-root-home'));
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.title,englishRootTitle);
  assert.equal(metadata(document,'property','og:title'),englishRootTitle);
  assert.equal(canonical(document), origin + '/');
  assert.equal(metadata(document, 'property', 'og:url'), origin + '/');
  assert(!/\b(noindex|none)\b/i.test(metadata(document, 'name', 'robots') || ''));
  assert.equal(document.querySelectorAll('meta[http-equiv="refresh" i],iframe').length, 0);
  assert.deepEqual(dashboard(document), dashboard(home('en'), true));
  checkAlternates(document);
  const menu = [...document.querySelectorAll('header a[data-root-locale]')];
  assert.equal(menu.length, 21);
  for (const l of registry) {
    const link = menu.find(a => a.dataset.rootLocale === l.code);
    assert(link, l.code);
    assert.equal(link.getAttribute('href'), `/${l.code}/`);
    assert.equal(link.getAttribute('hreflang'), l.hreflang);
    assert(link.textContent.includes(l.nativeName));
    assert.equal(canonical(home(l.code)), `${origin}/${l.code}/`);
  }
  assert.equal(document.querySelectorAll('script[src*="adsbygoogle.js"]').length, 1);
  assert.equal(document.querySelectorAll('script[data-v3-ga-bootstrap]').length, 1);
});

test('the root manifest pins every published locale payload and each home runtime exactly once', () => {
  const document = dom(read('index.html'));
  const manifest = manifests(document);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.baseLocale, 'en');
  assert.deepEqual(Object.keys(manifest.locales).sort(), registry.map(l => l.code).sort());
  assert.equal(manifest.locales.en, null);
  for (const l of registry.filter(l => l.code !== 'en')) {
    const url = new URL(manifest.locales[l.code], origin);
    assert.equal(url.origin, origin); assert.equal(url.pathname, `/data/root-home/${l.code}.json`);
    const bytes = fs.readFileSync(path.join(root, url.pathname.slice(1)));
    assert.equal(url.searchParams.get('v'), crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12));
    const data = JSON.parse(bytes);
    assert.equal(data.schemaVersion, manifest.schemaVersion); assert.equal(data.version, manifest.version);
    assert.equal(data.locale, l.code); assert.equal(data.lang, l.htmlLang); assert.equal(data.dir, l.dir);
  }
  const scripts = manifest.scripts.map(src => new URL(src, origin).pathname);
  assert.equal(new Set(scripts).size, scripts.length);
  for (const script of ['/js/analytics-contract.js','/js/root-home-analytics.js','/js/v3-affiliate.js','/js/v5-landing.js','/js/v6-system.js']) assert(scripts.includes(script), script);
  assert(scripts.indexOf('/js/analytics-contract.js') < scripts.indexOf('/js/root-home-analytics.js'));
  assert(scripts.indexOf('/js/root-home-analytics.js') < scripts.indexOf('/js/v3-affiliate.js'));
  const initial = [...document.querySelectorAll('script[src]')].map(n => new URL(n.src, origin)).filter(u => u.origin === origin).map(u => u.pathname);
  const earlyHelper='/js/home-form-state.js';
  assert.deepEqual(initial, ['/js/site-locales.js',earlyHelper,'/js/root-language.js']);
  assert(!scripts.includes(earlyHelper),'The form state helper must not start twice at the root');
  const rootHelper=document.querySelector('script[src^="'+earlyHelper+'?"]').getAttribute('src');
  for(const {code} of registry){
    const sources=[...home(code).querySelectorAll('script[src]')].map(n=>n.getAttribute('src'));
    const matches=sources.filter(src=>src.split('?')[0]===earlyHelper);
    assert.deepEqual(matches,[rootHelper],code+' must load the same form state helper once');
    assert.match(sources[sources.indexOf(rootHelper)+1],/^\/js\/v5-landing\.js\?v=[a-f0-9]{12}$/);
  }
  const updatedScripts = new Set(['/js/site-locales.js',earlyHelper,'/js/root-language.js','/js/root-home-analytics.js','/js/v5-landing.js']);
  for (const src of [...manifest.scripts,...document.querySelectorAll('script[src^="/js/"]')].map(source => typeof source === 'string' ? source : source.src)) {
    const url = new URL(src,origin);
    if (!updatedScripts.has(url.pathname)) continue;
    const file = read(url.pathname.slice(1));
    const hash = body => crypto.createHash('sha256').update(body).digest('hex').slice(0,12);
    assert([hash(file),hash(file.replaceAll('\r\n','\n'))].includes(url.searchParams.get('v')), 'Stale root script version '+url.pathname);
  }
});

// A deterministic browser fixture exercises the actual loader and analytics code.
// Other landing scripts only acknowledge load; real controls are exercised by their
// own suites and the browser smoke test. No third-party request leaves this process.
async function visit({pathname = '/', source, stored = {}, languages = ['en'], language, changePayload, changeManifest, corruptBytes = false, failFetch = false, blockedStorage = false, navigatorExtra = {}} = {}) {
  const document = dom(source || read('index.html'));
  const originalNodes = ['body','header.ts-header','main#main','[data-v5-home]','footer.ts-footer'].map(selector => [selector,document.querySelector(selector)]);
  const reads = [], writes = [], requests = [], scripts = [], navigation = [];
  const state = new Map(Object.entries(stored));
  const alternateBodies = new Map();
  const location = new URL(pathname, origin);
  const trackedLocation = new Proxy(location, {
    get(target, key) { return ['assign','replace'].includes(key) ? url => navigation.push(String(url)) : Reflect.get(target,key,target); },
    set(target, key, value) { navigation.push([key,String(value)]); return true; },
  });
  const localStorage = {
    getItem(key) { reads.push(key); if (blockedStorage) throw Error('Storage unavailable'); return state.get(key) ?? null; },
    setItem(key, value) { if (blockedStorage) throw Error('Storage unavailable'); writes.push([key,value]); state.set(key,value); },
    removeItem(key) { if (blockedStorage) throw Error('Storage unavailable'); state.delete(key); },
  };
  const fetch = async input => {
    const url = new URL(input, origin); requests.push(url.href);
    assert.equal(url.origin, origin); assert.match(url.pathname, /^\/data\/root-home\/[a-z-]+\.json$/);
    if (failFetch) throw Error('Payload unavailable');
    const text = alternateBodies.get(url.pathname) ?? read(url.pathname.slice(1));
    const response = new Response(corruptBytes ? text + ' ' : text, {headers:{'Content-Type':'application/json'}});
    Object.defineProperty(response, 'url', {value: url.href}); return response;
  };
  const navigator = {languages, language, ...navigatorExtra};
  const window = {document,navigator,localStorage,fetch,location:trackedLocation,AbortController,TextEncoder,crypto:crypto.webcrypto,addEventListener(){},removeEventListener(){},setTimeout,clearTimeout};
  const env = {window,document,navigator,localStorage,fetch,location:trackedLocation,URL,URLSearchParams,Promise,AbortController,TextDecoder,TextEncoder,crypto:crypto.webcrypto,setTimeout,clearTimeout,console};
  const context = vm.createContext(env);
  const execute = file => vm.runInContext(read(file), context, {filename:file});
  const analyticsScripts = new Set(['/js/analytics-contract.js','/js/root-home-analytics.js','/js/v3-affiliate.js']);
  const seen = new WeakSet();
  function inserted(node) {
    if (node?.tagName !== 'SCRIPT' || !node.src || seen.has(node)) return;
    seen.add(node);
    const url = new URL(node.src, origin);
    if (url.origin !== origin) return;
    scripts.push(url.pathname);
    queueMicrotask(() => {
      if (analyticsScripts.has(url.pathname)) execute(url.pathname.slice(1));
      node.dispatchEvent(new document.defaultView.Event('load'));
    });
  }
  for (const parent of [document.head, document.body]) {
    const append = parent.append.bind(parent), appendChild = parent.appendChild.bind(parent);
    parent.append = (...nodes) => {append(...nodes);nodes.forEach(inserted);};
    parent.appendChild = node => {const result=appendChild(node);inserted(node);return result;};
  }
  if (changeManifest || changePayload) {
    const node=document.getElementById('ts-root-home'), manifest=JSON.parse(node.textContent);
    if (changePayload) {
      const url = new URL(manifest.locales.ko,origin), data = JSON.parse(read(url.pathname.slice(1)));
      changePayload(data);
      const body=JSON.stringify(data)+'\n';alternateBodies.set(url.pathname,body);
      // A matching content hash forces the test through semantic validation too.
      manifest.locales.ko=url.pathname+'?v='+crypto.createHash('sha256').update(body).digest('hex').slice(0,12);
    }
    if(changeManifest)changeManifest(manifest);
    node.textContent=JSON.stringify(manifest);
  }
  Object.defineProperty(document, 'readyState', {value:'complete', configurable:true});
  const boot = document.querySelector('script[data-v3-ga-bootstrap]');
  if (boot) vm.runInContext(boot.textContent, context);
  execute('js/site-locales.js'); execute('js/home-form-state.js'); execute('js/root-language.js');
  document.dispatchEvent(new document.defaultView.Event('DOMContentLoaded'));
  const ready = await window.TS_ROOT_HOME_READY;
  for(const [selector,original] of originalNodes) assert.equal(document.querySelector(selector),original,'Unexpected replacement of '+selector);
  const calls = () => [...(window.dataLayer || [])].map(call => [...call]);
  return {document,window,ready,requests,reads,writes,scripts,navigation,calls,execute};
}

function assertHome(page, code) {
  const l=registry.find(l=>l.code===code);
  const localized = home(code);
  assert.equal(page.document.documentElement.dataset.lang,code);
  assert.equal(page.document.documentElement.lang,l.htmlLang);
  assert.equal(page.document.documentElement.getAttribute('dir') || 'ltr',l.dir);
  assert.deepEqual(dashboard(page.document),dashboard(localized, true),code+' dashboard or configuration mismatch');
  const title = page.document.title;
  assert.equal(metadata(page.document,'property','og:title'),title,code+' root Open Graph title');
  assert.match(title,/^.+ \| TilesSurvive\.net$/);
  assert([...title].length <= 40,code+' root title exceeds 40 characters');
  if(code==='en') assert.equal(title,englishRootTitle);
  else if([...localized.title].length<=40) assert.equal(title,localized.title);
  else assert.notEqual(title,englishRootTitle,code+' must retain its own language');
  for(const [attr,key] of [['name','description'],['property','og:description'],['property','og:locale'],['name','twitter:title']]) assert.equal(metadata(page.document,attr,key), metadata(localized,attr,key),code+' '+key);
  const schema=JSON.parse(page.document.querySelector('script[type="application/ld+json"][data-v5-owned="metadata"]').textContent);
  assert.equal(schema.url,origin+'/');assert.equal(schema['@id'],origin+'/#webpage');
  assert.equal(metadata(page.document,'property','og:url'),origin+'/');
  assert.equal(canonical(page.document),origin+'/'); checkAlternates(page.document);
  assert.deepEqual(page.navigation,[]);
}

test('manual choice, browser priority, aliases and unsupported languages select consistent full homes', async () => {
  const cases = [
    [{stored:{[choiceKey]:'de',preferred_lang:'en'},languages:['ko-KR']},'de'],
    [{stored:{preferred_lang:'ko'},languages:['my-MM','ar-EG']},'ar'],
    [{stored:{[choiceKey]:'unsupported'},languages:['zh-Hant-TW']},'zh-tw'],
    [{languages:['zh-Hans-CN']},'zh-cn'], [{languages:['no-NO']},'nb'],
    [{languages:['my-MM']},'en'], [{pathname:'/index.html',languages:['en-US']},'en'],
    [{blockedStorage:true,languages:['ko-KR']},'ko'],
  ];
  for (const [inputs,code] of cases) {
    const page=await visit(inputs);
    assertHome(page,code);
    assert.equal(page.ready.locale,code);
    assert(!page.reads.includes('preferred_lang'),'Old automatic preferences cannot represent an explicit choice');
    assert.deepEqual(page.writes,[]);
    assert.equal(page.requests.length,code==='en'?0:1);
    assert.equal(new Set(page.scripts).size,page.scripts.length);
  }
});

test('each explicit locale matches its published dashboard, metadata and runtime configuration', async () => {
  for (const {code} of registry) {
    const page = await visit({stored:{[choiceKey]:code},languages:['en-US']});
    assertHome(page,code);
    assert.equal(page.ready.locale,code);
  }
});

test('network, version, locale and late invalid slot failures retain the complete English home', async () => {
  const cases=[{failFetch:true},{corruptBytes:true},{changePayload:p=>{p.version+='-invalid';}},{changePayload:p=>{p.locale='de';}},
    {changePayload:p=>{p.changes.push({id:99999999,text:[[0,'Unreviewed final slot']]});}},
    {changeManifest:m=>{m.locales.ko='https://untrusted.example/ko.json';}}];
  for(const fault of cases) {
    const page=await visit({languages:['ko'],...fault});assertHome(page,'en');
    assert(page.requests.every(u=>new URL(u).origin===origin));
    assert.equal(page.scripts.filter(p=>p==='/js/v5-landing.js').length,1);
  }
});

test('localized URLs retain their own language, manual links retain browser navigation', async () => {
  const page=await visit({pathname:'/ar/',source:read('ar/index.html'),stored:{[choiceKey]:'de'},languages:['ko-KR']});
  assert.equal(page.document.documentElement.dataset.lang,'ar');assert.equal(canonical(page.document),origin+'/ar/');
  assert.deepEqual(page.requests,[]);assert.deepEqual(page.navigation,[]);
  page.execute('js/analytics-contract.js');page.execute('js/root-home-analytics.js');page.execute('js/v3-affiliate.js');
  const directViews=page.calls().filter(call=>call[0]==='event'&&call[1]==='page_view');
  assert.equal(directViews.length,1);assert.equal(directViews[0][2].page,'/ar/');assert.equal(directViews[0][2].language,'ar');
  const top=await visit({languages:['en-US']});
  const link=top.document.querySelector('header [data-root-locale="ko"]');
  function click(modifiers={}) {const e=new top.document.defaultView.Event('click',{bubbles:true,cancelable:true});Object.assign(e,{button:0,...modifiers});link.dispatchEvent(e);return e.defaultPrevented;}
  assert.equal(click({ctrlKey:true}),false);assert.deepEqual(top.writes,[]);
  assert.equal(click({detail:0}),false);assert.deepEqual(top.writes,[[choiceKey,'ko']]);
  assert.equal(link.getAttribute('href'),'/ko/');assert.deepEqual(top.navigation,[]);
});

test('root analytics starts once after locale selection and continues honoring privacy signals', async () => {
  const page=await visit({languages:['ar-EG']});
  const before=page.scripts.slice(); page.execute('js/root-language.js'); await page.window.TS_ROOT_HOME_READY;
  assert.deepEqual(page.scripts,before,'Loader ran a second home script sequence');
  const calls=page.calls();
  for(const name of ['page_view','landing_view']) {
    const events=calls.filter(x=>x[0]==='event'&&x[1]===name);assert.equal(events.length,1,name);
    assert.equal(events[0][2].send_to,'G-Z2MJ6TXZHK');assert.equal(events[0][2].page,'/');
    assert.equal(events[0][2].language,'ar');assert.equal(events[0][2].page_type,'home');
  }
  assert.equal(calls.filter(c=>c[0]==='config').length,1);
  const defaults=calls.filter(c=>c[0]==='consent');assert.equal(defaults.length,1);
  assert(Object.values(defaults[0][2]).every(v=>v==='denied'));
  const blocked=await visit({languages:['ar'],navigatorExtra:{globalPrivacyControl:true}});
  assert.equal(blocked.calls().filter(c=>c[0]==='event'||c[0]==='config').length,0);
});
