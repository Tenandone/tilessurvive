'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom'),P=require('./build-analytics-privacy'),G=require('./client-release-gate');
const ROOT=path.resolve(__dirname,'..'),codes=require('../data/i18n/locales.json').locales.map(l=>l.code);
test('all21 policies share one measurement model and the user-confirmed public contact',()=>{
 assert.deepEqual(P.validate(),{locales:21,sections:7});
 for(const locale of codes){const html=P.render(locale),d=parseHTML(html).document;assert.equal(d.querySelectorAll('section').length,7);assert.equal(d.querySelectorAll('[data-analytics-stop]').length,1);assert.equal(d.querySelectorAll('[data-analytics-resume]').length,1);assert.equal(d.querySelector('a[href^="mailto:"]').href,'mailto:ant79798@gmail.com');assert(html.includes('G-Z2MJ6TXZHK'));assert(!/data-v3-consent|data-v3-consent-allow|data-v3-consent-deny/.test(html));}
});
test('privacy projection preserves SEO, ads, verification, site chrome and is idempotent',()=>{
 for(const locale of codes){const before=fs.readFileSync(path.join(ROOT,locale,'privacy/index.html'),'utf8'),after=P.project(before,locale),a=parseHTML(before).document,b=parseHTML(after).document;
  assert.equal(P.project(after,locale),after);assert(P.validateOwnership(after,locale));
  for(const selector of ['link[rel="canonical"]','script#ts-website-schema','script#ts-org-schema','script#ts-locale-routes','header.ts-header','footer.ts-footer'])assert.equal(b.querySelector(selector)?.outerHTML,a.querySelector(selector)?.outerHTML,locale+' '+selector);
  assert.deepEqual([...b.querySelectorAll('link[hreflang]')].map(x=>x.outerHTML),[...a.querySelectorAll('link[hreflang]')].map(x=>x.outerHTML));
  assert.deepEqual(G.preservedContent(after).ads,G.preservedContent(before).ads);
  assert.deepEqual([...b.querySelectorAll('meta[name="google-site-verification"]')].map(x=>x.content),[...a.querySelectorAll('meta[name="google-site-verification"]')].map(x=>x.content));
 }
});
test('current release pipeline regenerates policies before final publication guards',()=>{
 const steps=require('./build-client-release').steps();assert.equal(steps.filter(x=>x==='scripts/build-analytics-privacy.js').length,1);assert(steps.indexOf('scripts/build-analytics-privacy.js')>steps.indexOf('scripts/build-v3-platform.js'));assert(steps.indexOf('scripts/build-analytics-privacy.js')<steps.indexOf('scripts/build-site-identity.js'));
});
test('policy ownership rejects duplicated or added content and stale stylesheets',()=>{
 const page=P.project(fs.readFileSync(path.join(ROOT,'ko/privacy/index.html'),'utf8'),'ko');
 for(const altered of [page.replace('</main>',P.render('ko')+'</main>'),page.replace('</main>','<p>unreviewed policy</p></main>'),page.replace(/analytics-policy\.css\?v=[a-f0-9]+/,'analytics-policy.css?v=stale'),page.replace('</head>','<link data-analytics-policy-asset rel="stylesheet" href="/css/analytics-policy.css"></head>')])assert.throws(()=>P.validateOwnership(altered,'ko'));
});
