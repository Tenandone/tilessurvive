'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),{parseHTML}=require('linkedom');
const G=require('./gift-codes-content'),B=require('./build-gift-codes'),R=require('../js/gift-codes'),NOW=Date.parse('2026-11-05T12:00:00Z');
test('all ten original code IDs, date fields and permanent flags survive canonical merge',()=>{
 const old=JSON.parse(cp.execFileSync('git',['show','5bd9065aa00e773895cf41ba3f6625452c0e401f:data/tilessurvive-coupons.json'],{cwd:B.ROOT,encoding:'utf8'}));assert.equal(G.facts.coupons.length,11);
 for(const row of old.coupons){const fresh=G.facts.coupons.find(c=>c.code===row.code);assert(fresh);for(const [k,v]of Object.entries(row))assert.deepEqual(fresh[k],v,row.code+' '+k);}
 assert.equal(G.facts.coupons.filter(c=>R.phase(c,NOW)==='ongoing').length,3);assert.equal(G.facts.coupons.filter(c=>R.phase(c,NOW)==='limited').length,1);assert.equal(G.facts.coupons.filter(c=>R.phase(c,NOW)==='expired').length,7);G.validate();
});
test('minute-end boundary and unknown expiry never become an invented active code',()=>{
 const row=G.facts.coupons.find(c=>c.code==='THANKS40MLN'),end=Date.parse(row.expiresAt);assert.equal(row.expiresAt,'2026-11-22T23:59:00Z');assert.equal(R.phase(row,end-1),'limited');assert.equal(R.phase(row,end),'expired');assert.equal(R.phase(row,Date.parse(row.announcedAt)-1),'upcoming');
 for(const code of ['TS777','TS888','TS999'])assert.equal(R.phase(G.facts.coupons.find(x=>x.code===code),end+1e12),'ongoing');assert.equal(R.phase({code:'UNKNOWN',expiresAt:null},NOW),'unverified');assert.equal(R.phase({code:'UNKNOWN',expiresAt:'bad'},NOW),'unverified');assert.equal(R.phase({code:'UNKNOWN',expiresAt:'2099-01-01T00:00:00Z'},NOW),'unverified');
});
test('21 locales share exact IDs and distinguish game codes from commercial coupons',()=>{
 for(const {code:l}of B.locales){const home=parseHTML(G.render(l)).document,detail=parseHTML(G.render(l,{archive:true})).document;assert.deepEqual([...home.querySelectorAll('[data-gift-code]')].map(x=>x.dataset.giftCode).sort(),['THANKS40MLN','TS777','TS888','TS999']);assert.equal(detail.querySelectorAll('[data-gift-code]').length,11);assert.equal(home.querySelectorAll('[data-common-code],[data-v6-copy]').length,0);assert(!home.textContent?.includes('#s4qU'));assert.equal(home.querySelectorAll('[data-gift-copy]').length,4);assert(!G.render(l).includes('undefined'));assert(G.copy(l).title.trim());assert(G.copy(l).redemptionNote.trim());}
});
test('detail owner preserves SEO routes, advertising, analytics, privacy and TEN while removing only old coupon app',()=>{
 for(const {code:l}of B.locales){const input=fs.readFileSync(B.ROOT+'/'+l+'/codes/index.html','utf8'),output=B.project(input,l),a=parseHTML(input).document,b=parseHTML(output).document;assert.equal(B.project(output,l),output);assert(B.validateOwnership(output,l));
  for(const selector of ['link[rel=canonical]','link[rel=alternate]','script[src*="adsbygoogle.js"]','script[src*="v3-affiliate.js"]','script#ts-locale-routes','[data-v3-owned="privacy"]','[data-lootbar-slot="codes/"]','footer'])assert.deepEqual([...b.querySelectorAll(selector)].map(n=>n.outerHTML),[...a.querySelectorAll(selector)].map(n=>n.outerHTML),l+' '+selector);
  assert.equal(b.querySelectorAll('#popBack,#entry,#toast').length,0);assert.equal(b.querySelectorAll('[data-gift-config]').length,1);assert.equal(b.querySelectorAll('[data-gift-owned="assets"]').length,2);assert.equal(b.querySelectorAll('h1').length,1);assert.equal(b.querySelector('meta[name="description"]').content,G.copy(l).intro);assert.equal(JSON.parse(b.querySelector('#ts-faq-schema').textContent).mainEntity[0].acceptedAnswer.text,G.copy(l).redeemText);
 }
});
function fixture(archive=false,clipboard={writeText:async()=>{}}){const {document}=parseHTML('<html><body>'+G.render('en',{archive})+'</body></html>'),host={navigator:{clipboard},setInterval(){return 7;},clearInterval(){}};return {document,host};}
test('countdown ticks preserve copy button nodes and move expired detail card to archive at exact boundary',()=>{
 const {document,host}=fixture(true),runtime=R.mount(document,host),card=document.querySelector('[data-gift-code="THANKS40MLN"]'),button=card.querySelector('button'),end=Date.parse(G.facts.coupons[0].expiresAt);runtime.tick(NOW);runtime.tick(NOW+1000);assert.equal(card.querySelector('button'),button);assert.equal(card.parentElement.dataset.giftCurrentList,'');runtime.tick(end);assert.equal(card.parentElement.dataset.giftArchiveList,'');assert.equal(card.dataset.giftPhase,'expired');assert(card.querySelector('[data-gift-countdown]').hidden);assert.equal(card.querySelector('button'),button);assert.equal(document.querySelector('[data-gift-archive-count]').textContent,'8');runtime.destroy();
});
test('home expiry hides only the timed code and keeps all three ongoing codes visible',()=>{
 const {document,host}=fixture(),runtime=R.mount(document,host);runtime.tick(Date.parse('2026-11-22T23:59:00Z'));assert(document.querySelector('[data-gift-code="THANKS40MLN"]').hidden);for(const code of ['TS777','TS888','TS999'])assert(!document.querySelector('[data-gift-code="'+code+'"]').hidden);assert(!document.querySelector('[data-gift-empty-limited]').hidden);runtime.destroy();
});
test('clipboard success copies exact uppercase code once; failure is announced without fake success',async()=>{
 const copied=[],events=[],f=fixture(false,{writeText:async text=>copied.push(text)});f.host.TS_V3_AFFILIATE={trackLanding:(...args)=>events.push(args)};const mounted=R.mount(f.document,f.host);R.mount(f.document,f.host);f.document.querySelector('[data-gift-copy="TS777"]').click();await Promise.resolve();await Promise.resolve();assert.deepEqual(copied,['TS777']);assert.deepEqual(events,[['copy','coupon']]);assert.equal(f.document.querySelector('[data-gift-code="TS777"] [data-gift-copy-status]').textContent,G.copy('en').copied);mounted.destroy();
 const bad=fixture(false,{writeText:async()=>{throw Error('denied');}}),failed=R.mount(bad.document,bad.host);bad.document.querySelector('[data-gift-copy="TS888"]').click();await Promise.resolve();await Promise.resolve();assert.equal(bad.document.querySelector('[data-gift-code="TS888"] [data-gift-copy-status]').textContent,G.copy('en').copyFailed);failed.destroy();
});
