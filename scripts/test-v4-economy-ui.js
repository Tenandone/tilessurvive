'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const M=require('../data/v4-economy.json'),COPY=require('../data/v4-economy-copy.json'),UI=require('../js/v4-economy-ui');
function setup(locale='en',kind='growth'){
 const {document,window}=parseHTML('<main><div id="app"></div></main>');
 // Linkedom exposes a select getter but no setter; emulate the browser property.
 const proto=Object.getPrototypeOf(document.createElement('select')),descriptor=Object.getOwnPropertyDescriptor(proto,'value');
 if(!descriptor?.set)Object.defineProperty(proto,'value',{configurable:true,get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.getAttribute('value')??this.querySelector('option')?.getAttribute('value')??'';},set(v){for(const o of this.querySelectorAll('option')){if(o.getAttribute('value')===String(v))o.setAttribute('selected','');else o.removeAttribute('selected');}}});
 let changes=0,controller;const snapshots=[],host=document.getElementById('app'),ctx={host,model:M,copy:COPY.locales[locale],locale,numberLocale:locale,onChange(){changes++;snapshots.push(controller.read());}};controller=kind==='growth'?UI.mountGrowth(ctx):UI.mountVS(ctx);
 return{document,window,host,controller,snapshots,changes:()=>changes,input(key,value){const n=host.querySelector('[data-v4-field="'+key+'"]');assert(n,key);n.value=value;n.dispatchEvent(new window.Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}));},click(text){const b=[...host.querySelectorAll('button')].find(n=>n.textContent===text);assert(b,text);b.click();}};
}
test('growth UI exposes one shared inventory, edits goals and reorders reservations without duplicate spending',()=>{
 const h=setup(),L=COPY.locales.en.labels;h.click(L.add);h.input('to','3');h.input('held-1200005','20000');h.input('held-1200004','20000');assert.equal(h.controller.read().goals.length,1);assert(h.host.querySelector('[data-v4-results]').textContent.includes('17,400'));h.click(L.add);assert(h.host.querySelector('[role="alert"]'));h.host.querySelectorAll('[data-v4-goal]')[1].querySelector('button:last-child')?.click();assert(h.changes()>0);for(const n of h.host.querySelectorAll('input,select'))assert(n.closest('label'),'Every control has a semantic label');
});
test('restoring either domain is atomic, silent and rejects invalid identities, quantities and overlapping transitions',()=>{
 for(const kind of ['growth','vs']){const h=setup('en',kind),before=h.controller.read(),count=h.changes();h.controller.restore(before);assert.equal(h.changes(),count);const bad=structuredClone(before);if(kind==='growth')bad.goals=[{uid:'a',kind:'building',id:999,profile:'unified',from:1,to:2}];else bad.quantities.survivor_chip_5=-1;assert.throws(()=>h.controller.restore(bad));assert.deepEqual(h.controller.read(),before);assert.equal(h.changes(),count);h.controller.reset();assert.equal(h.changes(),count);}
});
test('blank input is serialized as null and visibly withheld, never NaN or a plausible zero result',()=>{
 const h=setup();h.click(COPY.locales.en.labels.add);h.input('from','');assert.equal(h.controller.read().goals[0].from,null);assert(!JSON.stringify(h.controller.read()).includes('NaN'));assert(h.host.querySelector('[role="alert"]'));const saved=h.controller.read();h.controller.restore(saved);assert.equal(h.host.querySelector('[data-v4-field="from"]').value,'');assert(h.host.querySelector('[role="alert"]'));
});
test('restored numeric identities normalize before controls render and rewards retain exact item quantities',()=>{
 const h=setup(),s=h.controller.read();s.goals=[{uid:'restored',kind:'building',id:'800005',profile:'unified',from:1,to:3}];h.controller.restore(s);assert.equal(h.controller.read().goals[0].id,800005);assert.equal(h.changes(),0);assert(h.host.querySelector('[data-v4-results]').textContent.includes('37,400'));
 const v=setup('en','vs'),text=v.host.querySelector('[data-v4-results]').textContent;for(const r of M.events[0].profiles[0].days[3].stages[0].rewards){const item=M.rewardItems.find(x=>x.id===r.id);assert(item);assert(text.includes(item.names.en+' × '+r.quantity.toLocaleString('en')));}
});
test('VS changes update points, chest shortage and independent day alternatives while retaining material stock',()=>{
 const h=setup('en','vs');h.input('survivor_chip_5','10');h.input('item-201725','20');assert(h.host.querySelector('[data-v4-results]').textContent.includes('202,000'));h.input('day','2');assert.equal(h.controller.read().quantities.survivor_chip_5,10);h.input('use_build_speedup','120');assert(h.host.querySelector('[data-v4-results]').textContent.includes('30,000'));h.controller.reset();assert.equal(h.controller.read().quantities.survivor_chip_5,0);
});
test('every shipped locale mounts both interfaces with the same complete keys and safe text-only translations',()=>{
 assert.deepEqual(Object.keys(COPY.locales).sort(),require('../data/i18n/locales.json').locales.map(x=>x.code).sort());assert.equal(Object.keys(COPY.locales).length,21);assert.equal(COPY.provenance.nativeSpeakerReview,false);const expected=Object.keys(COPY.locales.en);for(const [locale,c]of Object.entries(COPY.locales)){assert.deepEqual(Object.keys(c),expected);for(const group of expected){assert.deepEqual(Object.keys(c[group]),Object.keys(COPY.locales.en[group]));for(const value of Object.values(c[group]))assert(typeof value==='string'&&value.trim());}for(const kind of ['growth','vs']){const h=setup(locale,kind);assert.equal(h.host.querySelectorAll('script').length,0);assert(h.host.textContent.includes(c.labels[kind==='growth'?'growthTitle':'vsTitle']));assert(!h.host.textContent.includes('undefined'));}}
});
test('numeric input updates result and share snapshot synchronously without blur or change events',()=>{
 const S=require('../js/v4-state');
 function edit(h,kind,key,value,read){const count=h.changes();h.input(key,value);assert.equal(h.changes(),count+1);const snapshot=h.snapshots.at(-1);assert.equal(read(snapshot),Number(value));assert.deepEqual(snapshot,h.controller.read());const url=S.url('https://tilessurvive.net/en/tools/',{schema:1,tab:kind,plans:{[kind]:snapshot}});assert.deepEqual(S.fromHash(new URL(url).hash).plans[kind],snapshot);}
 const g=setup();g.click(COPY.locales.en.labels.add);edit(g,'growth','to','3',s=>s.goals[0].to);assert(g.host.querySelector('[data-v4-results]').textContent.includes('37,400'));
 edit(g,'growth','from','2',s=>s.goals[0].from);edit(g,'growth','held-1200005','10000',s=>s.held[1200005]);edit(g,'growth','speedup-construction','2',s=>s.speedupSeconds.construction);g.input('kind','training');edit(g,'growth','quantity','7',s=>s.goals[0].quantity);assert(g.host.querySelector('[data-v4-results]').textContent.includes('140'));
 const v=setup('en','vs');edit(v,'vs','survivor_chip_5','10',s=>s.quantities.survivor_chip_5);assert(v.host.querySelector('[data-v4-results]').textContent.includes('152,000'));edit(v,'vs','currentPoints','7000',s=>s.currentPoints);
});
test('blank or invalid input replaces old results and immediately shares null instead of the last valid quantity',()=>{
 const S=require('../js/v4-state');for(const kind of ['growth','vs']){const h=setup('en',kind);if(kind==='growth')h.click(COPY.locales.en.labels.add);const key=kind==='growth'?'held-1200005':'survivor_chip_5';for(const bad of ['','-1','1.5','9007199254740992']){h.input(key,'10');assert(h.host.querySelector('[data-v4-results] table'));const count=h.changes();h.input(key,bad);assert.equal(h.changes(),count+1);const value=h.snapshots.at(-1);assert.equal(kind==='growth'?value.held[1200005]:value.quantities.survivor_chip_5,null);const result=h.host.querySelector('[data-v4-results]');assert(result.querySelector('[role="alert"]'));assert.equal(result.querySelectorAll('table').length,0);const state=S.decode(S.encode({schema:1,tab:kind,plans:{[kind]:value}}));assert.deepEqual(state.plans[kind],value);assert(!JSON.stringify(state).includes('NaN'));}}
});
