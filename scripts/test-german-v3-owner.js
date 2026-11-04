'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom');
const G=require('./build-german-50'),V=require('./build-v3-platform');
const affiliate=require('../data/v3-affiliate-copy.json').locales,events=require('../data/v3-events-copy.json').copy;
const ROOT=path.resolve(__dirname,'..');
const read=route=>V.project(fs.readFileSync(path.join(ROOT,'en',route),'utf8'),'en','/en/'+route.replace(/index\.html$/,''));

test('German regeneration uses reviewed DE V3 owners rather than translating their English prose',()=>{
 for(const route of ['events/index.html','tools/event-helper/index.html','top-up/index.html','heroes/travis/index.html']){
  const input=read(route),calls=[];
  const output=G.render(input,(text)=>{calls.push(text.trim());return text;},route),document=parseHTML(output).document;
  assert.equal(document.querySelector('[data-v3-consent] h2').textContent,affiliate.de.privacyTitle,route);
  assert(!calls.includes(affiliate.en.privacyText),'managed privacy text cannot reach generic catalog');
  if(route==='top-up/index.html'){
   assert.equal(document.querySelector('[data-v3-guide] h2').textContent,affiliate.de.title);
   assert.equal(document.querySelector('[data-v3-guide] > [data-v3-cta="outbound"]').textContent,affiliate.de.outbound);
  }
  if(route==='events/index.html'||route==='tools/event-helper/index.html'){
   assert.equal(document.querySelector('#v3-events-title').textContent,events.de.title);
   const payload=JSON.parse(document.querySelector('#v3-events-data').textContent);
   assert.equal(payload.locale,'de');assert.equal(payload.confirmedSchedules.length,0);
  }
 }
});

test('only verified legacy heading decorations, their exact generated TOC links and CTA label are accepted',()=>{
 const route='top-up/index.html',document=parseHTML(read(route)).document;
 const title=document.querySelector('[data-v3-guide] h2');title.id='article-section-999';
 document.querySelector('[data-v3-guide]').classList.add('ts3-character-section');
 for(const link of document.querySelectorAll('[data-v3-cta="outbound"]'))link.textContent='LootBar →';
 const nav=document.createElement('nav');nav.className='ts3-contents';nav.setAttribute('data-product-30','');
 nav.innerHTML='<a href="/en/top-up/#article-section-999">'+affiliate.en.title+'</a><a href="#unrelated">Unrelated original section</a>';
 document.querySelector('main').prepend(nav);
 const prepared=G.prepareV3Source(document.toString(),'en',route).source;
 assert(!prepared.includes('href="/en/top-up/#article-section-999"'));
 assert(prepared.includes('Unrelated original section'));
 assert([...parseHTML(prepared).document.querySelectorAll('[data-v3-owned]')].every(node=>node.getAttribute('data-v3-owned')==='analytics'));
 const output=G.render(document.toString(),value=>value,route);
 assert.equal(parseHTML(output).document.querySelector('[data-v3-guide] > [data-v3-cta="outbound"]').textContent,affiliate.de.outbound);
 for(const link of parseHTML(output).document.querySelectorAll('a.ten-link'))assert.equal(link.textContent,require('./ten-benefits-content').get('de').values.bookmarkCta);
});

test('forged owners, unreviewed managed text, changed game-facing values and foreign assets fail closed',()=>{
 const route='events/index.html';
 for(const mutate of [
  d=>{d.querySelector('[data-v3-consent] p').textContent='Unreviewed managed prose';},
  d=>{d.querySelector('#v3-events-data').textContent=d.querySelector('#v3-events-data').textContent.replace('"confirmedSchedules":[]','"confirmedSchedules":[{"invented":1}]');},
  d=>{const node=d.createElement('p');node.setAttribute('data-v3-owned','privacy');node.textContent='Pretend to be managed';d.querySelector('main').append(node);},
  d=>{const node=d.createElement('p');node.setAttribute('data-v3-owned','unknown-owner');d.querySelector('main').append(node);},
  d=>{d.querySelector('script[data-v3-owned="assets"]').setAttribute('src','https://unreviewed.invalid/script.js');}
 ]){
  const d=parseHTML(read(route)).document;mutate(d);
  assert.throws(()=>G.prepareV3Source(d.toString(),'en',route),/V3/);
 }
});

test('ordinary unregistered text is still translated/rejected, and nonowned JSON numbers remain exact',()=>{
 const route='events/index.html',d=parseHTML(read(route)).document;
 const paragraph=d.createElement('p');paragraph.textContent='UNREGISTERED_V3_BODY_FIXTURE';d.querySelector('main').append(paragraph);
 assert.throws(()=>G.render(d.toString(),text=>{if(text.trim()==='UNREGISTERED_V3_BODY_FIXTURE')throw Error('Unregistered body');return text;},route),/Unregistered body/);
 paragraph.remove();const script=d.createElement('script');script.type='application/json';script.id='test-original-values';script.textContent=JSON.stringify({value:18180,percent:'20%',resources:[1391947950,1391947950,276945000,68745600],seconds:31143082});d.body.append(script);
 const output=parseHTML(G.render(d.toString(),text=>text,route)).document;
 assert.deepEqual(JSON.parse(output.getElementById(script.id).textContent),JSON.parse(script.textContent));
 const codes=read('codes/index.html'),inBoot=parseHTML(codes).document.querySelector('[data-v3-ga-bootstrap]').textContent;
 const outBoot=parseHTML(G.render(codes,text=>text,'codes/index.html')).document.querySelector('[data-v3-ga-bootstrap]').textContent;
 assert.deepEqual(outBoot.match(/G-[A-Z0-9]+/g),inBoot.match(/G-[A-Z0-9]+/g),'page-specific reviewed GA IDs survive the owner boundary');
});

test('TEN bookmark regeneration preserves its inherited anchor and TOC while keeping policy prose out of the generic translator',()=>{
 const route='top-up/index.html',source=read(route),d=parseHTML(source).document;
 const section=d.querySelector('section[data-v3-owned="topup-bookmark"]');assert(section);
 const heading=section.querySelector('h2'),headingId=heading.id;assert(headingId);
 const links=[...d.querySelectorAll('a[data-v3-owned="topup-bookmark-link"]')];assert(links.length>0);
 for(const a of links){assert.equal(new URL(a.getAttribute('href'),'https://tilessurvive.net/en/top-up/').hash,'#'+headingId);assert.equal(a.textContent,heading.textContent);}
 const prepared=parseHTML(G.prepareV3Source(source,'en',route).source).document;
 const skeleton=prepared.querySelector('[data-bookmark-cta]').closest('section');
 assert.equal(skeleton.querySelector('h2').id,headingId);assert.equal(skeleton.querySelector('h2').textContent,'');
 assert.equal(skeleton.querySelectorAll('*').length,2,'only the inherited heading and renderer trigger remain');
 for(const a of links){const retained=[...prepared.querySelectorAll('a[href]')].find(n=>n.getAttribute('href')===a.getAttribute('href'));assert(retained,'bookmark TOC anchor must survive');assert.equal(retained.textContent,'');}
 const calls=[],out=parseHTML(G.render(source,text=>{calls.push(text.trim());return text;},route)).document;
 const localized=out.querySelector('section[data-v3-owned="topup-bookmark"]');
 assert.equal(localized.querySelector('h2').id,headingId);assert.notEqual(localized.querySelector('h2').textContent,heading.textContent);
 assert(!calls.includes(heading.textContent),'the EN bookmark heading is owner content');
 assert(!calls.includes(section.querySelector('[data-bookmark-hint]').textContent),'the EN bookmark instructions are owner content');
 assert.equal(out.querySelectorAll('[data-bookmark-cta]').length,1);assert.equal(out.querySelectorAll('[data-bookmark-hint]').length,1);
 for(const a of out.querySelectorAll('a[data-v3-owned="topup-bookmark-link"]')){assert.equal(a.textContent,localized.querySelector('h2').textContent);assert.equal(new URL(a.getAttribute('href'),'https://tilessurvive.net/de/top-up/').hash,'#'+headingId);}
 const ten=localized.querySelector('a[href="https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive"]');assert(ten);assert(ten.rel.includes('sponsored'));
 const legacyFaq=out.querySelector('.topup-faq > details[data-v3-owned="topup-bookmark-faq"]');assert(legacyFaq);
 assert.equal(legacyFaq.querySelector('summary').textContent,localized.querySelector('h2').textContent);
 assert.equal(out.querySelectorAll('.topup-faq > details').length,2,'the payment-help FAQ remains present');
 const originalHelp=d.querySelectorAll('.topup-faq > details')[1],currentHelp=out.querySelectorAll('.topup-faq > details')[1];assert.equal(currentHelp.textContent,originalHelp.textContent,'generic identity translation does not replace the unrelated support FAQ');
 const disclosure=out.querySelector('p.topup-disclosure[data-v3-owned="topup-policy-disclosure"]');assert(disclosure.textContent.startsWith(affiliate.de.disclosure));
 assert.equal(disclosure.querySelector('a').getAttribute('href'),'/de/affiliate-disclosure/');
 assert(!calls.includes(affiliate.en.disclosure),'the new operator disclosure is regenerated rather than generically translated');
});

test('TEN bookmark owners reject forged policy and links, and its stylesheet is allowed only on the top-up route',()=>{
 const route='top-up/index.html';
 for(const mutate of [
  d=>{d.querySelector('[data-v3-owned="topup-bookmark"] p').textContent='Every user receives a guaranteed free pack';},
  d=>{d.querySelector('a[data-v3-owned="topup-bookmark-link"]').textContent='Unreviewed bookmark target';},
  d=>{d.querySelector('[data-v3-owned="topup-bookmark"] a[href]').setAttribute('href','https://unreviewed.invalid/reward');},
  d=>{d.querySelector('[data-v3-owned="topup-bookmark-faq"] p').textContent='Guaranteed rewards for all buyers';},
  d=>{d.querySelector('[data-v3-owned="topup-policy-disclosure"] a').setAttribute('href','https://unreviewed.invalid/disclosure');},
  d=>{d.querySelector('link[href^="/css/ten-benefits.css"]').setAttribute('onload','unreviewed()');},
  d=>{d.querySelector('link[href^="/css/ten-benefits.css"]').setAttribute('href','/css/ten-benefits-extra.css?v=0123456789ab');}
 ]){const d=parseHTML(read(route)).document;mutate(d);assert.throws(()=>G.prepareV3Source(d.toString(),'en',route),/V3/);}
 const d=parseHTML(read('events/index.html')).document;
 const style=d.createElement('link');style.setAttribute('data-v3-owned','assets');style.rel='stylesheet';style.href='/css/ten-benefits.css?v=0123456789ab';d.head.append(style);
 assert.throws(()=>G.prepareV3Source(d.toString(),'en','events/index.html'),/Unreviewed V3 asset/);
});
