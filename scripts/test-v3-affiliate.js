'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {parseHTML} = require('linkedom');
const content = require('./v3-affiliate-content');
const copy = require('../data/v3-affiliate-copy.json');
const locales = require('../data/i18n/locales.json').locales.map(x => x.code);
const source = fs.readFileSync(path.join(__dirname, '../js/v3-affiliate.js'), 'utf8');
function setup({hostname = 'tilessurvive.net', saved, canonical = '/ko/top-up/', registry = 'ko', storageThrows = false, gaIds} = {}) {
  const {document, Event} = parseHTML(`<html data-v3-affiliate data-lang="ko"><head><link rel="canonical" href="https://tilessurvive.net${canonical}"></head><body>${content.renderGuide('ko')}${content.renderResultChoices('ko')}${content.renderPrivacyNotice('ko')}<button data-bookmark-cta>bookmark</button><p data-bookmark-hint hidden>hint</p></body></html>`);
  Object.defineProperty(document, 'hidden', {value: false, writable: true});
  Object.defineProperty(document, 'referrer', {value: 'https://www.google.com/search?q=private.email%40example.com'});
  const calls = [], handlers = {}, timers = new Map(), observers = [];
  const values = new Map(saved ? [['tiles.v3.analyticsConsent', saved]] : []);
  let next = 0;
  const window = {TS_LOCALES: {current: () => registry}, gtag: (...args) => calls.push(args),
    localStorage: {getItem: key => {if(storageThrows) throw Error('disabled'); return values.get(key);}, setItem: (key, value) => {if(storageThrows) throw Error('disabled'); values.set(key, value);}},
    addEventListener: (type, fn) => {handlers[type] = fn;}
  };
  if (gaIds !== undefined) window.TS_V3_GA_IDS = gaIds;
  const IntersectionObserver = class {constructor(callback) {this.callback = callback; observers.push(this);} observe() {} unobserve() {}};
  const MutationObserver = class {observe() {}};
  window.IntersectionObserver = IntersectionObserver; window.MutationObserver = MutationObserver;
  const location = {hostname, origin: 'https://' + hostname, pathname: canonical, search: '?email=private@example.com', hash: '#private-token'};
  const context = vm.createContext({window, document, location, URL, IntersectionObserver, MutationObserver, setTimeout: fn => {timers.set(++next,fn);return next;}, clearTimeout: id => timers.delete(id)});
  vm.runInContext(source, context);
  return {window, document, calls, handlers, timers, values, rerun: () => vm.runInContext(source, context),
    events: name => calls.filter(x => x[0] === 'event' && (!name || x[1] === name)),
    click: selector => document.querySelector(selector).dispatchEvent(new Event('click', {bubbles: true})),
    view: (selector, ratio) => observers[0].callback([{target: document.querySelector(selector), intersectionRatio: ratio}]),
    flush: () => {for(const [id, fn] of [...timers]) {timers.delete(id); fn();}},
    visibility: hidden => {document.hidden = hidden;document.dispatchEvent(new Event('visibilitychange'));}
  };
}
test('all 21 languages have complete independent guide, choices and privacy copy with exact TEN destination', () => {
  assert.deepEqual(Object.keys(copy.locales).sort(), locales.slice().sort());
  for(const locale of locales) {
    const c = copy.locales[locale];
    assert.deepEqual(Object.keys(c).sort(), Object.keys(copy.locales.en).sort());
    assert.equal(c.faq.length, 8);
    assert.ok(c.faq.every(pair => pair.length === 2 && pair.every(x => typeof x === 'string' && x.trim())));
    assert.ok(Object.entries(c).every(([k,v]) => k === 'faq' || typeof v === 'string' && v.trim()));
    const {document} = parseHTML('<html><body>' + content.renderGuide(locale) + content.renderResultChoices(locale) + content.renderPrivacyNotice(locale) + '</body></html>');
    assert.equal(document.querySelector('[data-v3-cta="outbound"]').getAttribute('href'), content.TEN_URL);
    assert.ok(document.querySelector('[data-v3-cta="outbound"]').rel.includes('sponsored'));
    assert.equal(document.querySelector('[data-v3-cta="guide"]').getAttribute('href'), '/' + locale + '/top-up/');
    assert.ok(fs.existsSync(path.join(__dirname, '..', locale, 'events/daily-missions/index.html')));
    assert.equal(document.querySelectorAll('[data-v3-consent] button').length, 2);
    assert.equal(document.querySelectorAll('input,form,iframe').length, 0);
    assert.equal(document.querySelectorAll('.v3-topup-question').length, 7);
    assert.equal(document.querySelectorAll('[data-ten-benefits]').length, 1);
  }
  assert.throws(() => content.renderGuide('not-a-locale'));
});
test('unknown/declined consent sends no events, queues no interaction, and loads no GA script', () => {
  const a = setup(); a.click('[data-v3-cta="outbound"]'); a.view('[data-v3-cta="outbound"]', 1); a.flush();
  assert.equal(a.calls.length, 0); assert.equal(a.timers.size, 0); assert.equal(a.document.querySelectorAll('script').length, 0);
  a.click('[data-v3-consent-deny]'); assert.equal(a.calls.length, 0);
  a.click('[data-v3-consent-allow]');
  assert.equal(a.events('page_view').length, 1); assert.equal(a.events('topup_guide_view').length, 1);
  assert.equal(a.events('lootbar_outbound_click').length, 0); // previous click never replayed
  assert.equal(a.document.querySelectorAll('script[data-v3-ga-loader]').length, 1);
  assert.equal(a.values.get('tiles.v3.analyticsConsent'), 'granted');
});
test('opt-in click has one semantic event; safe payload has no query, fragment, raw referrer, form value or destination URL', () => {
  const a = setup({saved:'granted'}); a.click('[data-v3-cta="outbound"]');
  assert.equal(a.events('lootbar_outbound_click').length, 1);
  const p = a.events('lootbar_outbound_click')[0][2];
  assert.equal(p.page, '/ko/top-up/'); assert.equal(p.source_category, 'search'); assert.equal(p.language, 'ko');
  assert.equal(p.page_location, 'https://tilessurvive.net/ko/top-up/'); assert.equal(p.page_referrer, '');
  assert.equal('destination' in p, false);
  assert.ok(!JSON.stringify(a.calls).includes('private')); assert.ok(!JSON.stringify(p).includes('?'));
  a.click('[data-v3-cta="guide"]'); a.click('[data-v3-cta="free"]');
  assert.equal(a.events('topup_guide_open').length, 1); assert.equal(a.events('free_progress_open').length, 1);
  assert.ok(a.events().every(x => !['purchase','begin_checkout','add_payment_info'].includes(x[1])));
});
test('impressions require continuous visible 60% for 1s, cancel on hide/revoke and deduplicate per anchor', () => {
  const a = setup({saved:'granted'}); a.view('[data-v3-cta="outbound"]', .59); assert.equal(a.timers.size, 0);
  a.view('[data-v3-cta="outbound"]', .6); assert.equal(a.timers.size, 1);
  a.visibility(true); a.flush(); assert.equal(a.events('affiliate_viewable').length, 0);
  a.visibility(false); a.window.TS_V3_AFFILIATE.setConsent(false); a.flush(); assert.equal(a.events('affiliate_viewable').length, 0);
  a.window.TS_V3_AFFILIATE.setConsent(true); a.flush(); assert.equal(a.events('affiliate_viewable').length, 1);
  a.view('[data-v3-cta="outbound"]', 1); a.flush(); assert.equal(a.events('affiliate_viewable').length, 1);
  assert.equal(a.events('page_view').length, 1); assert.equal(a.document.querySelectorAll('script[data-v3-ga-loader]').length, 1);
});
test('revocation, storage changes and blocked storage are safe; localhost never sends GA', () => {
  const a = setup({saved:'granted'}); a.window.TS_V3_AFFILIATE.setConsent(false); const before = a.events().length;
  a.click('[data-v3-cta="outbound"]'); assert.equal(a.events().length, before);
  a.handlers.storage({key:'tiles.v3.analyticsConsent',newValue:'granted'}); assert.equal(a.window.TS_V3_AFFILIATE.hasConsent(), true);
  a.handlers.storage({key:null,newValue:null}); assert.equal(a.window.TS_V3_AFFILIATE.hasConsent(), false);
  const blocked = setup({storageThrows:true}); blocked.window.TS_V3_AFFILIATE.setConsent(true); assert.equal(blocked.events('page_view').length,1);
  const local = setup({hostname:'localhost',saved:'granted'}); local.click('[data-v3-cta="outbound"]'); assert.equal(local.calls.length, 0);
});

test('revocation disables every configured Google destination before consent update and can resume without duplicate views', () => {
  const ids=[content.MEASUREMENT_ID,content.SECONDARY_MEASUREMENT_ID,content.LEGACY_HOME_MEASUREMENT_ID];
  const a=setup({gaIds:ids});
  for(const id of ids)assert.equal(a.window['ga-disable-'+id],true);
  a.window.TS_V3_AFFILIATE.setConsent(true);
  for(const id of ids)assert.equal(a.window['ga-disable-'+id],false);
  const views=a.events('page_view').length,gtag=a.window.gtag;
  let denied=0;
  a.window.gtag=(...args)=>{if(args[0]==='consent'&&args[2]?.analytics_storage==='denied'){for(const id of ids)assert.equal(a.window['ga-disable-'+id],true);denied++;}gtag(...args);};
  a.window.TS_V3_AFFILIATE.setConsent(false);
  assert.equal(denied,1);
  a.click('[data-v3-cta="outbound"]');assert.equal(a.events('lootbar_outbound_click').length,0);
  a.handlers.storage({key:'tiles.v3.analyticsConsent',newValue:'granted'});
  for(const id of ids)assert.equal(a.window['ga-disable-'+id],false);
  assert.equal(a.events('page_view').length,views);assert.equal(a.document.querySelectorAll('[data-v3-ga-loader]').length,1);
  a.handlers.storage({key:null,newValue:null});for(const id of ids)assert.equal(a.window['ga-disable-'+id],true);
  for(const options of [{saved:'denied'},{storageThrows:true},{hostname:'localhost',saved:'granted'},{saved:'granted',gaIds:[content.MEASUREMENT_ID,'G-UNKNOWN123']}]){
    const b=setup(options);for(const id of ids)assert.equal(b.window['ga-disable-'+id],true);
    assert.equal(b.window['ga-disable-G-UNKNOWN123'],undefined);assert.equal(b.calls.length,0);
  }
  const primary=setup({saved:'granted'});assert.equal(primary.window['ga-disable-'+ids[0]],false);for(const id of ids.slice(1))assert.equal(primary.window['ga-disable-'+id],true);
});
test('duplicate module load does not duplicate listeners; feature API rejects arbitrary values; bookmark still works', () => {
  const a = setup({saved:'granted'}); a.rerun(); a.click('[data-v3-cta="outbound"]'); assert.equal(a.events('lootbar_outbound_click').length,1);
  assert.equal(a.window.TS_V3_AFFILIATE.trackFeature('email@example.com','result'), false);
  assert.equal(a.window.TS_V3_AFFILIATE.trackFeature('power_plant','private text'), false);
  assert.equal(a.window.TS_V3_AFFILIATE.trackFeature('power_plant','result'), true);
  a.click('[data-bookmark-cta]'); assert.equal(a.document.querySelector('[data-bookmark-hint]').hidden,false);
});
test('known GA bootstrap replacement is exactly idempotent and preserves AdSense/CMP bytes', () => {
  const ad = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123"></script><script>window.adsbygoogle=window.adsbygoogle||[];</script><script>window.__tcfapi=function(){};</script>';
  const old = `<html><head><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-Z2MJ6TXZHK');window.addEventListener('load',function(){var load=function(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=G-Z2MJ6TXZHK';document.head.appendChild(s)};if('requestIdleCallback'in window){requestIdleCallback(load,{timeout:2500})}else{setTimeout(load,1200)}});</script></head><body>content</body></html>`;
  const html = old.replace('</head>', ad + '</head>');
  const once = content.transformAnalytics(html), twice = content.transformAnalytics(once);
  assert.equal(twice, once); assert.ok(once.includes(ad));
  assert.equal((once.match(/data-v3-ga-bootstrap/g)||[]).length,1); assert.ok(once.includes('data-v3-owned="analytics"'));
  const {document} = parseHTML(once); const js = [...document.querySelectorAll('script:not([src])')].map(x=>x.textContent).join('\n');
  assert.ok(!/gtag\('config','G-Z2MJ6TXZHK'\)/.test(js));
  assert.ok(once.includes("analytics_storage:'denied'"));
  assert.throws(() => content.transformAnalytics('<html><head><script>gtag("config","G-Z2MJ6TXZHK");window.adsbygoogle=[];</script></head></html>'));
});
test('all 44 historical secondary-ID pages migrate without eager GA requests and preserve exact per-page IDs', () => {
  const pages = locales.flatMap(locale => [
    {locale, route:'codes/', id:content.SECONDARY_MEASUREMENT_ID},
    {locale, route:'guides/discount-topup-promotion/', id:content.SECONDARY_MEASUREMENT_ID}
  ]).concat(['zh-cn','zh-tw'].map(locale => ({locale,route:'',id:content.LEGACY_HOME_MEASUREMENT_ID})));
  assert.equal(pages.length,44);
  for(const p of pages) {
    const file = path.join(__dirname,'..',p.locale,p.route,'index.html');
    const before = fs.readFileSync(file,'utf8'), after = content.transformAnalytics(before);
    assert.equal(content.transformAnalytics(after),after);
    const {document} = parseHTML(after), boot = document.querySelector('[data-v3-ga-bootstrap]');
    const ids = JSON.parse(boot.textContent.match(/TS_V3_GA_IDS=(\[[^;]+\]);/)[1]);
    assert.deepEqual(ids,[content.MEASUREMENT_ID,p.id],file);
    assert.equal(document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length,0,file);
    assert.equal(document.querySelectorAll('link[href*="googletagmanager.com"][rel="preconnect"],link[href*="googletagmanager.com"][rel="dns-prefetch"]').length,0,file);
    assert.ok(![...document.querySelectorAll('script:not([src])')].some(s=>/gtag\s*\(\s*['"]config['"]/.test(s.textContent)),file);
    const a = setup({gaIds:ids,canonical:'/'+p.locale+'/'+p.route,registry:p.locale});
    assert.equal(a.calls.length,0); assert.equal(a.document.querySelectorAll('script').length,0);
    a.window.TS_V3_AFFILIATE.setConsent(true);
    assert.deepEqual(a.calls.filter(c=>c[0]==='config').map(c=>c[1]),ids);
    assert.equal(a.document.querySelectorAll('script[data-v3-ga-loader]').length,1);
    const views = a.events('page_view'); assert.equal(views.length,2);
    assert.deepEqual(views.map(c=>c[2].send_to),ids);
    for(const v of views) {assert.equal(v[2].page_location,'https://tilessurvive.net/'+p.locale+'/'+p.route);assert.equal(v[2].page_referrer,'');assert.ok(!JSON.stringify(v).includes('private'));}
    a.click('[data-v3-cta="outbound"]');
    assert.equal(a.events('lootbar_outbound_click').length,1);assert.equal(a.events('lootbar_outbound_click')[0][2].send_to,content.MEASUREMENT_ID);
    a.window.TS_V3_AFFILIATE.setConsent(false);a.window.TS_V3_AFFILIATE.setConsent(true);a.rerun();assert.equal(a.events('page_view').length,2);
  }
});
test('approved historical IDs are retained in old inline/loader formats, never sprayed onto unrelated pages', () => {
  for(const id of [content.SECONDARY_MEASUREMENT_ID,content.LEGACY_HOME_MEASUREMENT_ID]) {
    const original = `<html><head><link rel="preconnect" href="https://www.googletagmanager.com"><script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{send_page_view:true});</script></head><body>unchanged</body></html>`;
    const migrated = content.transformAnalytics(original);
    assert.ok(migrated.includes(`TS_V3_GA_IDS=["${content.MEASUREMENT_ID}","${id}"];`));
    assert.equal(content.transformAnalytics(migrated),migrated);
  }
  const plain = content.transformAnalytics('<html><head></head><body>unrelated</body></html>');
  assert.ok(plain.includes(`TS_V3_GA_IDS=["${content.MEASUREMENT_ID}"];`));
  assert.ok(!plain.includes(content.SECONDARY_MEASUREMENT_ID));assert.ok(!plain.includes(content.LEGACY_HOME_MEASUREMENT_ID));
});
test('unknown measurement IDs and dynamic configs fail closed; invalid runtime ID list sends nothing', () => {
  for(const fragment of [
    '<script async src="https://www.googletagmanager.com/gtag/js?id=G-UNKNOWN123"></script>',
    '<script>gtag("config","G-UNKNOWN123");</script>',
    '<script data-v3-ga-bootstrap>window.TS_V3_GA_IDS=["G-Z2MJ6TXZHK","G-UNKNOWN123"];</script>',
    '<script>gtag("config",unreviewedId);</script>',
    '<script>gtag("config","G-Z2MJ6TXZHK");gtag("config",unreviewedId);</script>',
    '<script>gtag("config","G-Z2MJ6TXZHK");s.src="https://www.googletagmanager.com/gtag/js?id=G-UNKNOWN123";</script>'
  ]) assert.throws(()=>content.transformAnalytics('<html><head>'+fragment+'</head></html>'),/Unreviewed/);
  const invalid = setup({saved:'granted',gaIds:[content.MEASUREMENT_ID,'G-UNKNOWN123']});
  invalid.click('[data-v3-cta="outbound"]'); assert.equal(invalid.calls.length,0);assert.equal(invalid.document.querySelectorAll('script').length,0);
});
test('legacy modules are disabled only on V3-marked documents', () => {
  for(const file of ['platform-affiliate.js','affiliate-tracking.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),{document:{documentElement:{hasAttribute: name => name === 'data-v3-affiliate'}}});
  }
});
test('legacy compatibility pages respect explicit denial and block tracking if storage access throws', () => {
  for(const file of ['platform-affiliate.js','affiliate-tracking.js']) {
    const code = fs.readFileSync(path.join(__dirname,'../js',file),'utf8');
    const doc = {documentElement:{hasAttribute: () => false}};
    vm.runInNewContext(code,{document:doc,window:{localStorage:{getItem:()=>'denied'}}});
    vm.runInNewContext(code,{document:doc,window:{get localStorage(){throw Error('blocked');}}});
  }
});
test('legacy step correction touches only step 2 and is idempotent across all 21 locales', () => {
  for(const locale of locales) {
    const html = fs.readFileSync(path.join(__dirname,'..',locale,'top-up/index.html'),'utf8');
    const {document} = parseHTML(html), step1 = document.querySelector('[data-topup-step="1"]').outerHTML, step3 = document.querySelector('[data-topup-step="3"]').outerHTML;
    document.querySelector('[data-topup-step="2"] p').textContent = 'A legacy step with ambiguous order.';
    assert.equal(content.projectLegacyTopup(document,locale).length,1);
    assert.equal(document.querySelector('[data-topup-step="2"] p').textContent,copy.locales[locale].faq[3][1]);
    assert.equal(document.querySelector('[data-topup-step="1"]').outerHTML,step1); assert.equal(document.querySelector('[data-topup-step="3"]').outerHTML,step3);
    assert.deepEqual(content.projectLegacyTopup(document,locale),[]);
  }
});
