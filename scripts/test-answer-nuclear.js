'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const N=require('./answer-guides/nuclear'),D=require('../data/nuclear-age.json'),R=require('../js/nuclear-age'),REG=require('../data/i18n/locales.json').locales;
test('Power Plant answers preserve completed levels, self costs and all seven fixed cases',()=>{
 const g=N.guides('ko')[0],a=Object.fromEntries(g.answers.map(a=>[a.id,a]));
 assert.deepEqual([1,2,3].map(n=>a[`power-plant-n${n}-fuel`].model.value),[400,1330,2380]);
 assert.equal(a['power-plant-n3-fuel'].model.incremental,1050);assert.equal(a['first-nuclear-upgrade'].model.value,0);assert.equal(a['first-nuclear-upgrade'].model.status,'confirmed-zero');
 assert.equal(a['first-nuclear-upgrade'].model.target.completedSequence,1);assert.equal(a['power-plant-n1-fuel'].model.target.completedSequence,5);
 assert.equal(g.example.model.required,1980);assert.equal(g.example.model.owned,1000);assert.equal(g.example.model.value,980);
 for(const answer of Object.values(a))assert.equal(answer.model.scope.prerequisitesIncluded,false);
 for(const n of [1,2,3])assert(a[`power-plant-n${n}-fuel`].paragraphs[0].includes('선행 건물 비용은 별도'));
});
test('building-scope sums are not a minimum prerequisite path',()=>{
 const g=N.guides('en')[0];for(const [id,count,values]of [['tree',4,[1480,4642,8212]],['all',14,[8335,23624,41939]]]){
  const a=g.answers.find(a=>a.id===`${id}-building-fuel-total`);assert.equal(a.model.scope.buildingIds.length,count);assert.equal(a.model.scope.minimumPath,false);assert(a.paragraphs[1].includes('not the minimum'));assert.deepEqual(a.table.rows.map(r=>Number(r[1].replaceAll(',',''))),values);
 }
});
test('21 languages use the identical numbers, state boundaries, scope and source rows',()=>{
 const en=N.guides('en')[0],shape=g=>({answers:g.answers.map(a=>a.model),example:g.example.model});
 for(const l of REG){const g=N.guides(l.code)[0];assert.deepEqual(shape(g),shape(en),l.code);assert(g.answers.every(a=>a.question&&a.paragraphs.every(p=>p&&!/\{\w+\}/.test(p))));const formatted=new Intl.NumberFormat(l.numberLocale).format(2380);assert(g.answers[2].paragraphs[0].includes(formatted),l.code);}
});
test('missing source fuel never produces a complete total or a zero answer',()=>{
 const altered=structuredClone(D);altered.buildings[0].stages[0].nuclearFuel=null;
 const g=N.guides('en',altered)[0];assert(!g.answers.some(a=>a.id==='power-plant-n1-fuel'));assert(!g.answers.some(a=>a.id==='first-nuclear-upgrade'));assert(!g.answers.some(a=>a.id.endsWith('building-fuel-total')));assert.equal(g.example.model.value,980,'A later fully-known interval remains answerable');
 assert.deepEqual(g.answers.map(a=>[a.model.method,a.model.value]),[['incremental',930],['incremental',1050]],'Known intervals remain answerable without fabricating cumulative totals');
 assert(g.answers.every(a=>a.paragraphs.some(p=>p.includes('Prerequisite'))));
 assert.equal(D.buildings[0].stages[0].nuclearFuel,0,'Source object is immutable');
});
test('an unknown N3 step preserves complete N1 and N2 answers without inventing N3 or an example',()=>{
 const altered=structuredClone(D);altered.buildings[0].stages[14].nuclearFuel=null;const g=N.guides('en',altered)[0];assert.equal(g.answers.find(a=>a.id==='power-plant-n1-fuel').model.value,400);assert.equal(g.answers.find(a=>a.id==='power-plant-n2-fuel').model.value,1330);assert(!g.answers.some(a=>a.id==='power-plant-n3-fuel'));assert.equal(g.example,undefined);
});
test('shortfall rejects fractions and invalid holdings, distinguishes an unknown requirement',()=>{
 const p={complete:true,knownFuel:1980};assert.equal(R.shortfall(p,1000),980);assert.equal(R.shortfall(p,2000),0);assert.equal(R.shortfall({complete:false,knownFuel:100},0),null);
 for(const value of [-1,1.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'1000'])assert.throws(()=>R.shortfall(p,value));
});
test('real planner inputs calculate N1 to N3 with owned fuel and clear stale shortfalls',()=>{
 const {document,window}=parseHTML(require('./build-nuclear-age').renderGuide('ko'));
 const proto=Object.getPrototypeOf(document.createElement('select'));if(!Object.getOwnPropertyDescriptor(proto,'value')?.set)Object.defineProperty(proto,'value',{configurable:true,get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.value===String(v));}});
 const host=document.querySelector('[data-nuclear-planner]'),form=host.querySelector('form');Object.defineProperty(form,'elements',{value:Object.fromEntries([...form.querySelectorAll('[name]')].map(n=>[n.name,n]))});R.mount(document);
 const change=(name,value,event='change')=>{form.elements[name].value=String(value);form.elements[name].dispatchEvent(new window.Event(event));};
 change('from',5);change('to',15);change('owned',1000,'input');assert.equal(host.querySelector('[data-nuclear-result]').textContent,'1,980');assert.equal(host.querySelector('[data-nuclear-shortfall]').textContent,'980');
 change('owned','1.5','input');assert.equal(host.querySelector('[data-nuclear-shortfall]').textContent,'—');assert(host.querySelector('[data-nuclear-status]').textContent.includes('정수'));
 change('owned',1000,'input');change('from',0);change('building',800419);change('to',1);assert.equal(host.querySelector('[data-nuclear-shortfall]').textContent,'—');
});
test('the original service correction and its actual confirmation date are retained',()=>{
 const a=N.guides('en')[0].answers.find(a=>a.id==='first-nuclear-upgrade');assert.equal(a.model.source.verifiedAt,'2026-11-06');assert.equal(a.model.source.recordIds[0],501051);assert.equal(D.serviceOverrides[0].sourceValue,null);assert.equal(D.serviceOverrides[0].value,0);
 assert.equal(N.guides('en')[0].answers[0].model.source.capturedAt,D.client.capturedDate);assert.equal(N.guides('en')[0].answers[0].model.source.verifiedAt,'2026-11-06');
 for(const a of N.guides('en')[0].answers)if(a.model.source.recordIds.includes(501051))assert.equal(a.model.source.serviceCorrections[0].id,D.serviceOverrides[0].id);
});
