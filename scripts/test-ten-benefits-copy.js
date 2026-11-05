'use strict';
// The V5.1 operator wording change is checked against the deployed source and
// DOM. Render in memory; this suite never regenerates public HTML.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {parseHTML}=require('linkedom'),Benefits=require('./ten-benefits-content'),copy=require('../data/v3-affiliate-copy.json'),policy=require('../data/ten-benefits-policy.json');
const ROOT=path.resolve(__dirname,'..'),BASE='8a7c777d20b34acfa3068699dd888cef6b6ad38a',codes=require('../data/i18n/locales.json').locales.map(l=>l.code);
const before=file=>cp.execFileSync('git',['show',BASE+':'+file],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024}),oldCopy=JSON.parse(before('data/v3-affiliate-copy.json'));
test('the exact operator message is localized in 21 languages with every unrelated affiliate field preserved',()=>{
 assert.equal(copy.locales.ko.tenHistoryCaveat,'많이 이용해 주실수록 더욱 풍성한 보상과 혜택으로 보답하겠습니다.');
 const retained=structuredClone(copy);
 assert.deepEqual(Object.keys(copy.locales).sort(),codes.slice().sort());
 for(const locale of codes){const current=copy.locales[locale].tenHistoryCaveat,prior=oldCopy.locales[locale].tenHistoryCaveat;assert(typeof current==='string'&&current.trim());assert.notEqual(current,prior,locale);if(locale!=='en')assert.notEqual(current,copy.locales.en.tenHistoryCaveat,locale+' untranslated fallback');assert(!/[0-9%]|\{[^}]+\}/.test(current),locale+' new numeric promise');retained.locales[locale].tenHistoryCaveat=prior;}
 assert.deepEqual(retained,oldCopy,'Only the 21 TEN closing sentences change');
});
test('TEN payout amounts, eleven recipients, coupon/draw rules and affiliate policy remain exact',()=>{
 assert.equal(fs.readFileSync(path.join(ROOT,'data/ten-benefits-policy.json'),'utf8'),before('data/ten-benefits-policy.json'));
 Benefits.validatePolicy();assert.equal(policy.tenUrl,'https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive');assert.equal(policy.history[0].month,'2026-11');assert.equal(policy.history[0].totalRecipients,11);assert.deepEqual(policy.history[0].packages,[{faceValueCents:9999,recipients:1},{faceValueCents:999,recipients:5},{faceValueCents:499,recipients:5}]);assert.equal(policy.freePackages.selection,'draw');assert.equal(policy.freePackages.guaranteedForEveryParticipant,false);assert.equal(policy.applicationRequired,false);
 for(const locale of codes){const doc=parseHTML(Benefits.renderBenefits(locale)).document;assert.deepEqual([...doc.querySelectorAll('[data-ten-package-cents]')].map(n=>Number(n.getAttribute('value'))),[9999,999,499]);assert.deepEqual([...doc.querySelectorAll('[data-ten-recipients]')].map(n=>Number(n.getAttribute('value'))),[1,5,5]);assert.equal(doc.querySelector('[data-ten-total]').getAttribute('data-ten-total'),'11');const a=doc.querySelector('a.ten-link');assert.equal(a.getAttribute('href'),policy.tenUrl);assert.equal(a.getAttribute('rel'),'sponsored noopener noreferrer');}
});
test('all 21 in-memory benefit panels change only the requested closing sentence against deployed markup',()=>{
 for(const locale of codes){const prior=parseHTML(before(locale+'/top-up/index.html')).document.querySelector('[data-ten-benefits]'),current=parseHTML(Benefits.renderBenefits(locale)).document.querySelector('[data-ten-benefits]');assert(prior&&current,locale);const paragraphs=prior.querySelectorAll('.ten-payouts > p.ten-conditions');assert.equal(paragraphs.length,1,locale);assert.equal(paragraphs[0].textContent,oldCopy.locales[locale].tenHistoryCaveat,locale);paragraphs[0].textContent=copy.locales[locale].tenHistoryCaveat;assert.equal(current.outerHTML,prior.outerHTML,locale+' all other TEN markup retained');assert(!current.textContent.includes(oldCopy.locales[locale].tenHistoryCaveat),locale+' old paragraph removed');}
});
