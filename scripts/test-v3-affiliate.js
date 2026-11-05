'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {parseHTML} = require('linkedom');
const content = require('./v3-affiliate-content');
const copy = require('../data/v3-affiliate-copy.json');
const locales = require('../data/i18n/locales.json').locales.map(x => x.code);
const source = fs.readFileSync(path.join(__dirname, '../js/v3-affiliate.js'), 'utf8');
function setup({hostname = 'tilessurvive.net', saved, canonical = '/ko/top-up/', registry = 'ko', storageThrows = false, gaIds, objection=false, navigator={}, search='?email=private@example.com'} = {}) {
  const {document, Event} = parseHTML(`<html data-v3-affiliate data-lang="ko"><head><link rel="canonical" href="https://tilessurvive.net${canonical}"></head><body>${content.renderGuide('ko')}${content.renderResultChoices('ko')}${content.renderPrivacyNotice('ko')}<button data-analytics-stop>stop</button><button data-analytics-resume>resume</button><p data-analytics-status data-active="active" data-stopped="stopped"></p><button data-bookmark-cta>bookmark</button><p data-bookmark-hint hidden>hint</p></body></html>`);
  Object.defineProperty(document, 'hidden', {value: false, writable: true});
  Object.defineProperty(document, 'referrer', {value: 'https://www.google.com/search?q=private.email%40example.com'});
  const calls = [], handlers = {}, timers = new Map(), observers = [];
  const values = new Map(saved ? [['tiles.v3.analyticsConsent', saved]] : []);
  if(objection)values.set('tiles.analytics.objection.v1','true');values.set('tiles.v4.workbench.1','private-plan');const reads=[];
  let next = 0;
  const window = {navigator,TS_ANALYTICS_SCHEMA:require('../js/analytics-contract'),TS_LOCALES: {current: () => registry}, gtag: (...args) => calls.push(args),
    localStorage: {getItem: key => {reads.push(key);if(storageThrows) throw Error('disabled'); return values.get(key);}, setItem: (key, value) => {if(storageThrows) throw Error('disabled'); values.set(key, value);},removeItem:key=>{if(storageThrows)throw Error('disabled');values.delete(key);}},
    addEventListener: (type, fn) => {handlers[type] = fn;}
  };
  if (gaIds !== undefined) window.TS_V3_GA_IDS = gaIds;
  const IntersectionObserver = class {constructor(callback) {this.callback = callback; observers.push(this);} observe() {} unobserve() {}};
  const MutationObserver = class {observe() {}};
  window.IntersectionObserver = IntersectionObserver; window.MutationObserver = MutationObserver;
  const location = {hostname, origin: 'https://' + hostname, pathname: canonical, search, hash: '#private-token'};
  const context = vm.createContext({window, document, location, URL, URLSearchParams, IntersectionObserver, MutationObserver, setTimeout: fn => {timers.set(++next,fn);return next;}, clearTimeout: id => timers.delete(id)});
  vm.runInContext(source, context);
  return {window, document, calls, handlers, timers, values, reads, rerun: () => vm.runInContext(source, context),
    events: name => calls.filter(x => x[0] === 'event' && (!name || x[1] === name)),
    click: selector => document.querySelector(selector).dispatchEvent(new Event('click', {bubbles: true})),
    view: (selector, ratio) => observers[0].callback([{target: document.querySelector(selector), intersectionRatio: ratio}]),
    flush: () => {for(const [id, fn] of [...timers]) {timers.delete(id); fn();}},
    visibility: hidden => {document.hidden = hidden;document.dispatchEvent(new Event('visibilitychange'));}
  };
}
test('all 21 languages have complete independent guide and choices; retired privacy controls are absent with exact TEN destination', () => {
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
    assert.equal(document.querySelectorAll('[data-v3-consent] button').length, 0);
    assert.equal(document.querySelectorAll('input,form,iframe').length, 0);
    assert.equal(document.querySelectorAll('.v3-topup-question').length, 7);
    assert.equal(document.querySelectorAll('[data-ten-benefits]').length, 1);
  }
  assert.throws(() => content.renderGuide('not-a-locale'));
});
test('unknown/granted/denied historical states migrate identically without reading the old value',()=>{
 for(const saved of [undefined,'granted','denied']){const a=setup({saved});assert.equal(a.events('page_view').length,1);assert.equal(a.events('topup_guide_view').length,1);assert.equal(a.values.has('tiles.v3.analyticsConsent'),false);assert(!a.reads.includes('tiles.v3.analyticsConsent'));assert.equal(a.values.get('tiles.v4.workbench.1'),'private-plan');assert.equal(a.document.querySelectorAll('script[data-v3-ga-loader]').length,1);assert.equal(a.window.TS_V3_AFFILIATE.setConsent,undefined);assert.equal(a.window.TS_V3_AFFILIATE.hasConsent,undefined);
 const defaults=a.calls.filter(c=>c[0]==='consent');assert.equal(defaults.length,1);assert.deepEqual(Object.values(defaults[0][2]),['denied','denied','denied','denied']);assert(!JSON.stringify(a.calls).includes('granted'));assert.equal(a.calls.find(c=>c[0]==='config')[2].send_page_view,false);}
});

test('GA-only click has one semantic event; safe payload has no query, fragment, raw referrer, form value or destination URL', () => {
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
  a.visibility(false); a.window.TS_ANALYTICS.stop(); a.flush(); assert.equal(a.events('affiliate_viewable').length, 0);
  a.window.TS_ANALYTICS.resume(); a.flush(); assert.equal(a.events('affiliate_viewable').length, 1);
  a.view('[data-v3-cta="outbound"]', 1); a.flush(); assert.equal(a.events('affiliate_viewable').length, 1);
  assert.equal(a.events('page_view').length, 1); assert.equal(a.document.querySelectorAll('script[data-v3-ga-loader]').length, 1);
});
test('new objection, cross-tab preference and blocked storage are safe without reusing historical states',()=>{
 const a=setup({objection:true});assert.equal(a.calls.length,0);assert.equal(a.window.TS_ANALYTICS.isEnabled(),false);a.click('[data-analytics-resume]');assert.equal(a.events('page_view').length,1);assert(!a.values.has('tiles.analytics.objection.v1'));a.click('[data-analytics-stop]');assert.equal(a.values.get('tiles.analytics.objection.v1'),'true');const count=a.events().length;a.click('[data-v3-cta="outbound"]');assert.equal(a.events().length,count);
 a.handlers.storage({key:'tiles.v3.analyticsConsent',newValue:'granted'});assert.equal(a.window.TS_ANALYTICS.isEnabled(),false);
 a.handlers.storage({key:'tiles.analytics.objection.v1',newValue:null});assert.equal(a.window.TS_ANALYTICS.isEnabled(),true);assert.equal(a.events('page_view').length,1);
 const blocked=setup({storageThrows:true});assert.equal(blocked.calls.length,0);assert.equal(blocked.window.TS_ANALYTICS.resume(),true);assert.equal(blocked.events('page_view').length,1);
 const local=setup({hostname:'localhost'});local.click('[data-v3-cta="outbound"]');assert.equal(local.calls.length,0);
});

test('objection disables GA before any later event; resume never grants storage or duplicates page views',()=>{
 const a=setup();assert.equal(a.window['ga-disable-'+content.MEASUREMENT_ID],false);for(const id of [content.SECONDARY_MEASUREMENT_ID,content.LEGACY_HOME_MEASUREMENT_ID])assert.equal(a.window['ga-disable-'+id],true);
 const views=a.events('page_view').length;a.window.TS_ANALYTICS.stop();assert.equal(a.window['ga-disable-'+content.MEASUREMENT_ID],true);a.click('[data-v3-cta="outbound"]');assert.equal(a.events('lootbar_outbound_click').length,0);a.window.TS_ANALYTICS.resume();assert.equal(a.window['ga-disable-'+content.MEASUREMENT_ID],false);assert.equal(a.events('page_view').length,views);assert.equal(a.document.querySelectorAll('[data-v3-ga-loader]').length,1);assert(a.calls.filter(c=>c[0]==='consent').every(c=>Object.values(c[2]).every(v=>v==='denied')));
 for(const options of [{navigator:{globalPrivacyControl:true}},{navigator:{doNotTrack:'1'}},{navigator:{doNotTrack:'yes'}},{navigator:{webdriver:true}},{search:'?analytics_test=1'},{gaIds:[content.MEASUREMENT_ID,'G-UNKNOWN123']}]){const b=setup(options);assert.equal(b.calls.length,0);assert.equal(b.window.TS_ANALYTICS.resume(),false);assert.equal(b.window['ga-disable-'+content.MEASUREMENT_ID],true);}
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
  for(const key of ['analytics_storage','ad_storage','ad_user_data','ad_personalization'])assert.ok(once.includes(key+":'denied'"));assert(once.includes("'ads_data_redaction',true"));assert(once.includes("'url_passthrough',false"));
  assert.throws(() => content.transformAnalytics('<html><head><script>gtag("config","G-Z2MJ6TXZHK");window.adsbygoogle=[];</script></head></html>'));
});
test('all 44 historical secondary-ID pages migrate exactly to the confirmed primary destination', () => {
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
    assert.deepEqual(ids,[content.MEASUREMENT_ID],file);
    assert.equal(document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length,0,file);
    assert.equal(document.querySelectorAll('link[href*="googletagmanager.com"][rel="preconnect"],link[href*="googletagmanager.com"][rel="dns-prefetch"]').length,0,file);
    assert.ok(![...document.querySelectorAll('script:not([src])')].some(s=>/gtag\s*\(\s*['"]config['"]/.test(s.textContent)),file);
    const a = setup({gaIds:ids,canonical:'/'+p.locale+'/'+p.route,registry:p.locale});
    assert.equal(a.events('page_view').length,1);
    assert.deepEqual(a.calls.filter(c=>c[0]==='config').map(c=>c[1]),ids);
    assert.equal(a.document.querySelectorAll('script[data-v3-ga-loader]').length,1);
    const views = a.events('page_view'); assert.equal(views.length,1);
    assert.deepEqual(views.map(c=>c[2].send_to),ids);
    for(const v of views) {assert.equal(v[2].page_location,'https://tilessurvive.net/'+p.locale+'/'+p.route);assert.equal(v[2].page_referrer,'');assert.ok(!JSON.stringify(v).includes('private'));}
    a.click('[data-v3-cta="outbound"]');
    assert.equal(a.events('lootbar_outbound_click').length,1);assert.equal(a.events('lootbar_outbound_click')[0][2].send_to,content.MEASUREMENT_ID);
    a.window.TS_ANALYTICS.stop();a.window.TS_ANALYTICS.resume();a.rerun();assert.equal(a.events('page_view').length,1);
  }
});
test('approved historical inline/loader formats migrate to primary-only without spreading old IDs', () => {
  for(const id of [content.SECONDARY_MEASUREMENT_ID,content.LEGACY_HOME_MEASUREMENT_ID]) {
    const original = `<html><head><link rel="preconnect" href="https://www.googletagmanager.com"><script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{send_page_view:true});</script></head><body>unchanged</body></html>`;
    const migrated = content.transformAnalytics(original);
    assert.ok(migrated.includes(`TS_V3_GA_IDS=["${content.MEASUREMENT_ID}"];`));
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
test('both retired legacy assets are inert even with unmarked pages and inaccessible storage',()=>{
 for(const file of ['platform-affiliate.js','affiliate-tracking.js']){const code=fs.readFileSync(path.join(__dirname,'../js',file),'utf8');vm.runInNewContext(code,{document:{},window:{get localStorage(){throw Error('must not read');},gtag(){throw Error('must not emit');}}});assert(!code.includes('analyticsConsent'));}
});
test('common tracking API sanitizes custom dimensions and counts coupon copies away from home',()=>{
 const a=setup({canonical:'/ko/codes/'});assert.equal(a.window.TS_V3_AFFILIATE.trackCoupon(),true);assert.equal(a.events('coupon_copy').length,1);assert.equal(a.window.TS_ANALYTICS.track('purchase',{value:100}),false);assert.equal(a.window.TS_ANALYTICS.track('calculator_run',{feature:'nuclear_fuel',action:'result',email:'private',page:'/private/',language:'secret',query:'private'}),true);
 const value=a.events('calculator_run')[0][2];assert.equal(value.page,'/ko/codes/');assert.equal(value.site_language,'ko');assert.equal(value.measurement_version,'global-1');assert(!JSON.stringify(value).includes('private'));assert.equal(value.email,undefined);assert.equal(a.window.TS_ANALYTICS.track('page_view'),false);assert.equal(a.events('page_view').length,1);
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
