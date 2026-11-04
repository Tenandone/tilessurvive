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
   assert.equal(document.querySelector('[data-v3-cta="outbound"]').textContent,affiliate.de.outbound);
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
 document.querySelector('[data-v3-cta="outbound"]').textContent='LootBar →';
 const nav=document.createElement('nav');nav.className='ts3-contents';nav.setAttribute('data-product-30','');
 nav.innerHTML='<a href="/en/top-up/#article-section-999">'+affiliate.en.title+'</a><a href="#unrelated">Unrelated original section</a>';
 document.querySelector('main').prepend(nav);
 const prepared=G.prepareV3Source(document.toString(),'en',route).source;
 assert(!prepared.includes('href="/en/top-up/#article-section-999"'));
 assert(prepared.includes('Unrelated original section'));
 assert([...parseHTML(prepared).document.querySelectorAll('[data-v3-owned]')].every(node=>node.getAttribute('data-v3-owned')==='analytics'));
 const output=G.render(document.toString(),value=>value,route);
 assert.equal(parseHTML(output).document.querySelector('[data-v3-cta="outbound"]').textContent,affiliate.de.outbound);
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
