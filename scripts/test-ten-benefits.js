'use strict';
// Release-specific regression against the deployed V3 baseline. Read-only: this
// suite does not run the legacy full build or write regenerated public pages.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {parseHTML} = require('linkedom');
const ROOT = path.resolve(__dirname, '..');
const BASE = '166b1c964d70ca11688c290d6f7bc0f563a11912';
const TEN = 'https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive';
const locales = require('../data/i18n/locales.json').locales;
const copy = require('../data/v3-affiliate-copy.json');
const policy = require('../data/ten-benefits-policy.json');
const publisher = require('./build-v3-platform');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const git = args => execFileSync('git', args, {cwd: ROOT, encoding: 'utf8', stdio:['ignore','pipe','pipe'], maxBuffer: 20 * 1024 * 1024});
const baseline = file => git(['show', BASE + ':' + file]);
const originalCopy = JSON.parse(baseline('data/v3-affiliate-copy.json'));
const rows = locales.map(l => {
  const file = l.code + '/top-up/index.html';
  const before = baseline(file), after = read(file);
  return {locale: l.code, definition: l, file, before, after, old: parseHTML(before).document, doc: parseHTML(after).document};
});
const texts = nodes => [...nodes].map(n => n.textContent.trim());
const serialized = (doc, selector) => [...doc.querySelectorAll(selector)].map(n => n.outerHTML);
const changed = git(['diff', '--name-only', BASE, '--', '.', ':(exclude)node_modules']).trim().split('\n').filter(Boolean);
const tracked = git(['ls-tree', '-r', '--name-only', BASE]).trim().split('\n');
const added = git(['ls-files', '--others', '--exclude-standard']).trim().split('\n').filter(Boolean);
const currentTracked = git(['ls-files']).trim().split('\n');
const newPaths = [...new Set([...currentTracked,...added])].filter(f=>!tracked.includes(f));
const publicHtml = f => f.endsWith('.html') && !/^(?:node_modules|delivery|scripts|test-results)\//.test(f);
const isTopup = f => locales.some(l => f === l.code + '/top-up/index.html');
const benefitFields = ['couponTitle','couponText','drawTitle','drawText','flow1','flow2','flow3','flow4','eligibility','variation','historyTitle','historyMonth','historyIntro','packageLabel','recipientsLabel','historyTotal','historyCaveat','bookmarkTitle','bookmarkText','bookmarkButton','bookmarkHint','bookmarkCta'];
const textKey = key => 'ten' + key[0].toUpperCase() + key.slice(1);

test('operator policy fixes the completed USD payout record without inventing future rates or eligibility thresholds', () => {
  assert.equal(policy.tenUrl, TEN);
  assert.equal(policy.frequency, 'monthly');
  assert.equal(policy.applicationRequired, false);
  assert.match(policy.eligibility, /attributed.*TEN.*operator/i);
  assert.equal(policy.coupons.recipientRule, 'Users who meet the operating eligibility conditions');
  assert.equal(policy.coupons.discountPercent, null);
  assert.equal(policy.coupons.minimumTopUpAmount, null);
  assert.deepEqual(policy.freePackages, {selection:'draw', automaticEligibleEntry:true, guaranteedForEveryParticipant:false});
  assert.equal(policy.conditionsMayVary, true);
  assert.equal(policy.history.length, 1);
  const h = policy.history[0];
  assert.equal(h.month, '2026-11');
  assert.equal(h.currency, 'USD');
  assert.equal(h.status, 'paid');
  assert.equal(h.source, 'operator-reported');
  assert.deepEqual(h.packages, [{faceValueCents:9999,recipients:1},{faceValueCents:999,recipients:5},{faceValueCents:499,recipients:5}]);
  assert.equal(h.totalRecipients, 11);
  assert.equal(h.packages.reduce((n, p) => n + p.recipients, 0), 11);
  assert.equal(h.futureCompositionGuaranteed, false);
});

test('21 locale catalogs preserve FAQ indices 0 through 6 and all unrelated affiliate copy', () => {
  assert.equal(locales.length, 21);
  assert.deepEqual(Object.keys(copy.locales).sort(), locales.map(l => l.code).sort());
  for (const {code} of locales) {
    const old = originalCopy.locales[code], now = copy.locales[code];
    assert.equal(now.faq.length, 8, code);
    assert.deepEqual(now.faq.slice(0,7), old.faq.slice(0,7), code + ' FAQ 0–6');
    assert.notEqual(now.faq[7][1], old.faq[7][1], code + ' old unsupported-benefit answer replaced');
    for (const [key, value] of Object.entries(old)) if (key !== 'faq') assert.deepEqual(now[key], value, code + ':' + key);
    for (const key of benefitFields) assert.ok(typeof now[textKey(key)] === 'string' && now[textKey(key)].trim(), code + ':' + key);
    assert.deepEqual(now.tenHistoryMonth.match(/\{[^{}]+\}/g), ['{month}'], code);
    assert.deepEqual(now.tenHistoryTotal.match(/\{[^{}]+\}/g), ['{count}'], code);
  }
});

test('21 rendered guides lead with one open TEN answer and preserve seven other questions and payment step', () => {
  for (const r of rows) {
    const c = copy.locales[r.locale];
    const guide = r.doc.querySelector('[data-v3-guide]');
    const questions = [...guide.children].filter(n => n.matches?.('details.v3-topup-question'));
    assert.equal(questions.length, 8, r.locale);
    assert.equal(questions[0].getAttribute('data-ten-benefits'), 'ten-monthly-member-benefits');
    assert.ok(questions[0].hasAttribute('open'), r.locale);
    assert.equal(questions[0].querySelector('summary').textContent, c.faq[7][0]);
    for (let i=0; i<7; i++) {
      assert.equal(questions[i+1].querySelector('summary').textContent, originalCopy.locales[r.locale].faq[i][0]);
      assert.equal(questions[i+1].querySelector('p').textContent, originalCopy.locales[r.locale].faq[i][1]);
    }
    assert.equal(r.doc.querySelector('[data-topup-step="2"] p').textContent, originalCopy.locales[r.locale].faq[3][1]);
    assert.ok(!r.doc.documentElement.textContent.includes(originalCopy.locales[r.locale].faq[7][1]), r.locale + ' stale claim absent');
  }
});

test('21 histories display identical completed month, USD amounts, recipient counts and non-guarantee caveat', () => {
  for (const r of rows) {
    const c = copy.locales[r.locale], histories = r.doc.querySelectorAll('[data-ten-history]');
    assert.equal(histories.length, 1, r.locale);
    const h = histories[0];
    assert.equal(h.getAttribute('data-ten-history'), '2026-11');
    assert.equal(h.getAttribute('data-payout-status'), 'paid');
    assert.equal(h.querySelector('time').getAttribute('datetime'), '2026-11');
    assert.equal(h.querySelector('[data-ten-total]').getAttribute('data-ten-total'), '11');
    assert.deepEqual([...h.querySelectorAll('[data-ten-package-cents]')].map(n => n.getAttribute('value')), ['9999','999','499']);
    assert.deepEqual([...h.querySelectorAll('[data-ten-recipients]')].map(n => n.getAttribute('value')), ['1','5','5']);
    const money = new Intl.NumberFormat(r.definition.numberLocale, {style:'currency', currency:'USD', currencyDisplay:'code', minimumFractionDigits:2, maximumFractionDigits:2});
    assert.deepEqual(texts(h.querySelectorAll('[data-ten-package-cents]')), [99.99,9.99,4.99].map(n => money.format(n).trim()), r.locale);
    assert.ok(h.textContent.includes(c.tenHistoryIntro));
    assert.ok(h.textContent.includes(c.tenHistoryCaveat));
    assert.ok(!/\{(?:month|count)\}/.test(h.textContent));
    assert.equal(h.hasAttribute('open'), false, r.locale + ' payout detail is separately expandable');
  }
});

test('21 guides show distinct coupon and draw cards, all four steps and complete eligibility/variation copy', () => {
  for (const r of rows) {
    const c = copy.locales[r.locale], area = r.doc.querySelector('[data-ten-benefits]');
    assert.deepEqual(texts(area.querySelectorAll('.ten-benefit-flow > li')), [c.tenFlow1,c.tenFlow2,c.tenFlow3,c.tenFlow4]);
    assert.deepEqual(texts(area.querySelectorAll('.ten-benefit-grid h3')), [c.tenCouponTitle,c.tenDrawTitle]);
    assert.deepEqual(texts(area.querySelectorAll('.ten-benefit-grid p')), [c.tenCouponText,c.tenDrawText]);
    const directConditions = [...area.children].filter(n => n.matches?.('p.ten-conditions'));
    assert.deepEqual(texts(directConditions), [c.tenEligibility,c.tenVariation], r.locale);
    assert.equal(area.querySelector('.ten-disclosure').textContent, c.disclosure);
  }
});

test('every commercial TEN destination is exact, disclosed and sponsored; original footer remains unchanged', () => {
  for (const r of rows) {
    const links = [...r.doc.querySelectorAll('a[href]')].filter(a => a.getAttribute('href').includes('/shop/ten/'));
    assert.ok(links.length >= 3, r.locale);
    for (const a of links) {
      assert.equal(a.getAttribute('href'), TEN, r.locale);
      const rel = new Set((a.getAttribute('rel') || '').split(/\s+/));
      assert.ok(rel.has('sponsored') && rel.has('noopener') && rel.has('noreferrer'), r.locale);
    }
    assert.deepEqual(serialized(r.doc,'footer'), serialized(r.old,'footer'), r.locale + ' footer');
    const disclosure = r.doc.querySelector('p.topup-disclosure');
    assert.ok(disclosure.textContent.includes(copy.locales[r.locale].disclosure));
    assert.equal(disclosure.querySelector('a').getAttribute('href'), '/' + r.locale + '/affiliate-disclosure/');
  }
});

test('21 bookmark sections retain article anchors and show one manual hint for the TEN destination', () => {
  for (const r of rows) {
    const c = copy.locales[r.locale], area = r.doc.getElementById('ten-bookmark');
    assert.ok(area, r.locale);
    assert.equal(r.doc.querySelectorAll('[data-bookmark-cta]').length, 1);
    assert.equal(r.doc.querySelectorAll('[data-bookmark-hint]').length, 1);
    const previousId = r.old.querySelector('[data-bookmark-cta]').closest('section').querySelector('h2').id;
    assert.equal(area.querySelector('h2').id, previousId, r.locale);
    const target = area.querySelector('[data-ten-bookmark-destination]');
    assert.equal(target.getAttribute('href'), TEN);
    assert.equal(target.getAttribute('target'), '_blank');
    assert.equal(area.querySelector('button').getAttribute('type'), 'button');
    assert.equal(area.querySelector('button').textContent, c.tenBookmarkButton);
    assert.equal(area.querySelector('[data-bookmark-hint]').textContent, c.tenBookmarkHint);
    assert.ok(area.querySelector('[data-bookmark-hint]').hasAttribute('hidden'));
    assert.ok(!area.querySelector('form,input,[onclick]'), r.locale + ' no registration or automatic bookmark handler');
  }
});

test('bookmark clicks only reveal the single hint, without navigation, automatic bookmarking, storage or denied analytics', () => {
  const source = read('js/v3-affiliate.js');
  for (const r of rows) {
    const {document, Event} = parseHTML(r.after), calls=[], mutations=[];
    const window = {TS_LOCALES:{current:()=>r.locale}, localStorage:{getItem:()=> 'denied',setItem:(...a)=>mutations.push(a)}, addEventListener(){},
      gtag:(...a)=>calls.push(a),open(){throw Error('bookmark must not navigate');},external:{AddFavorite(){throw Error('automatic bookmark');}},sidebar:{addPanel(){throw Error('automatic bookmark');}}};
    const context = vm.createContext({window,document,URL,location:{hostname:'tilessurvive.net',origin:'https://tilessurvive.net',pathname:'/'+r.locale+'/top-up/',search:'',hash:''},setTimeout,clearTimeout});
    vm.runInContext(source,context);
    const hint = document.querySelector('[data-bookmark-hint]');
    document.querySelector('[data-bookmark-cta]').dispatchEvent(new Event('click',{bubbles:true}));
    assert.equal(hint.hidden, false, r.locale);
    assert.equal(document.querySelectorAll('[data-bookmark-hint]').length, 1);
    assert.deepEqual(mutations, [], r.locale);
    assert.equal(calls.filter(c => c[0] === 'event').length, 0, r.locale);
    assert.equal(document.querySelectorAll('script[src*="googletagmanager.com"]').length, 0);
  }
});

test('21 pages preserve metadata, structured data, advertisements, analytics and all other script bytes', () => {
  for (const r of rows) {
    for (const selector of ['title','meta','link[rel="canonical"]','link[rel="alternate"]','script','ins.adsbygoogle']) {
      assert.deepEqual(serialized(r.doc, selector), serialized(r.old, selector), r.locale + ' ' + selector);
    }
    assert.equal(r.doc.querySelectorAll('link[href^="/css/ten-benefits.css?"]').length, 1, r.locale);
  }
});

test('21 pages preserve all remaining DOM outside the explicitly reviewed guide, bookmark, FAQ and disclosure owners', () => {
  function retained(html) {
    html=html.replace(/<!-- TS_V3_AFFILIATE_BEGIN -->[\s\S]*?<!-- TS_V3_AFFILIATE_END -->/g,'');
    const d=parseHTML(html).document;
    const bookmark=d.querySelector('[data-bookmark-cta]').closest('section'), id=bookmark.querySelector('h2').id;
    bookmark.remove();
    d.querySelector('.topup-faq > details').remove();
    d.querySelector('p.topup-disclosure').remove();
    for (const a of d.querySelectorAll('a[href]')) {
      const u=new URL(a.getAttribute('href'),'https://tilessurvive.net');
      if(u.hash==='#'+id) {a.textContent='[retained-bookmark-link]';a.removeAttribute('data-v3-owned');}
    }
    for(const n of d.querySelectorAll('link[href^="/css/ten-benefits.css?"]'))n.remove();
    return d.documentElement.outerHTML;
  }
  for(const r of rows)assert.equal(retained(r.after), retained(r.before), r.locale);
});

test('current release changes only exact reviewed Atlas/V4 HTML; all 21 TEN pages remain byte-identical', () => {
  const pin='fe4d8d394b5f4e0624ac8e8be15864e5de5e00b8',V4=require('./v4-workbench-content'),Atlas=require('./build-hero-atlas'),T=require('./test-v3-platform');
  const names=git(['diff','--name-only',pin,'--','*.html']).trim().split('\n').filter(Boolean),old=T.batch(names,pin);
  for(const file of names){const locale=file.split('/')[0],route='/'+file.replace(/index\.html$/,''),pet=/^\/[^/]+\/database\/pet-system\/(?:[^/]+\/)?$/.test(route),allowed=Atlas.isOwnedRoute(route)||V4.kindFor(route)||pet;assert(allowed,'Unrelated page '+file);let expected=old.get(file);if(Atlas.isOwnedRoute(route))expected=Atlas.project(expected,locale,route);if(pet)expected=require('./build-hero-pet-pages').project(expected,locale);if(V4.kindFor(route)){expected=V4.project(expected,locale,route);V4.validateOwnership(read(file),locale,route);}assert.equal(read(file),expected,file+' exact reviewed projection');}
  const topups=locales.map(l=>l.code+'/top-up/index.html'),before=T.batch(topups,pin);for(const file of topups)assert.equal(read(file),before.get(file),file+' unchanged');
  const original=new Set(git(['ls-tree','-r','--name-only',pin]).trim().split('\n'));assert.deepEqual([...new Set([...currentTracked,...added])].filter(f=>publicHtml(f)&&!original.has(f)),[],'V4 adds no public page URLs');
});

test('every current pre-V4 public model/runtime/style is unchanged except reviewed search projections', () => {
  const pin='fe4d8d394b5f4e0624ac8e8be15864e5de5e00b8';
  const originals=new Set(git(['ls-tree','-r','--name-only',pin]).trim().split('\n'));
  const files=git(['diff','--name-only',pin]).trim().split('\n').filter(Boolean),protectedFile=f=>/^(?:data|js|components|css|assets)\//.test(f)||['robots.txt','sitemap.xml','_config.yml'].includes(f);
  assert.deepEqual(files.filter(f=>originals.has(f)&&protectedFile(f)&&!new Set(['css/hero-atlas.css','css/hero-pet.css','js/hero-atlas.js']).has(f)&&!/^data\/(?:search\/|v3-search\/|search-index\.json$)/.test(f)),[],'Existing protected input changed');
  for(const f of [...originals].filter(protectedFile))assert(fs.existsSync(path.join(ROOT,f)),f+' preserved');
  const reviewed=new Set(['data/hero-guide-copy.json','data/hero-guide-presentation.json','data/v4-formation.json','data/v4-formation-copy.json','data/v4-economy.json','data/v4-economy-copy.json','data/v4-workbench-copy.json','data/v4-provenance.json','js/v4-state.js','js/v4-workbench.js','js/v4-formation-math.js','js/v4-formation-ui.js','js/v4-economy-math.js','js/v4-economy-ui.js','css/v4-workbench.css']);
  assert.deepEqual([...new Set([...currentTracked,...added])].filter(f=>protectedFile(f)&&!originals.has(f)&&!reviewed.has(f)),[],'Unreviewed new public input');
});

test('the narrow publisher projects the 21 finished pages identically on repeated read-only application', () => {
  for(const r of rows) {
    const once=publisher.project(r.after,r.locale,'/'+r.locale+'/top-up/');
    assert.equal(once,r.after,r.locale+' first reapplication');
    assert.equal(publisher.project(once,r.locale,'/'+r.locale+'/top-up/'),once,r.locale+' second reapplication');
  }
});
