'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom'),N=require('./build-nuclear-age'),R=require('../js/nuclear-age');
function setup(locale='ko'){
 const {document,window}=parseHTML(N.renderGuide(locale));
 const proto=Object.getPrototypeOf(document.createElement('select'));
 if(!Object.getOwnPropertyDescriptor(proto,'value')?.set)Object.defineProperty(proto,'value',{configurable:true,get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.value??this.querySelector('option')?.value??'';},set(v){for(const o of this.querySelectorAll('option')){if(o.value===String(v))o.setAttribute('selected','');else o.removeAttribute('selected');}}});
 const host=document.querySelector('[data-nuclear-planner]'),form=host.querySelector('form');
 Object.defineProperty(form,'elements',{value:Object.fromEntries([...form.querySelectorAll('[name]')].map(n=>[n.name,n]))});
 R.mount(document);
 const change=(name,value)=>{const s=form.elements[name];assert(s,name);s.value=String(value);s.dispatchEvent(new window.Event('change'));};
 return {host,form,change,result:host.querySelector('[data-nuclear-result]'),status:host.querySelector('[data-nuclear-status]'),requirement:host.querySelector('[data-nuclear-requirement]'),control:host.querySelector('[data-nuclear-power-plant-control]'),copy:N.calculatorConfig(locale).copy};
}
test('the real planner markup renders confirmed zero, unknown cost and empty interval distinctly',()=>{
 const h=setup();assert.equal(h.result.textContent,'400');assert.equal(h.host.dataset.complete,'true');
 h.change('to',1);assert.equal(h.result.textContent,'0');assert.equal(h.status.textContent,'');
 h.change('building',800419);assert.equal(h.result.textContent,'—');assert.equal(h.status.textContent,h.copy.incompletePlan);assert.equal(h.host.dataset.complete,'false');
 h.change('to',0);assert.equal(h.result.textContent,'0');assert.equal(h.status.textContent,'');assert.equal(h.host.dataset.complete,'true');
});
test('N1 and N2 progress never count as completed Power Plant levels and prerequisite costs are not added',()=>{
 const h=setup();h.change('building',800150);h.change('to',1);assert.equal(h.control.hidden,false);
 h.change('powerPlant',4);assert.equal(h.requirement.dataset.met,'false');assert.equal(h.result.textContent,'35');
 h.change('powerPlant',5);assert.equal(h.requirement.dataset.met,'true');assert.equal(h.result.textContent,'35');
 h.change('to',10);h.change('from',5);h.change('powerPlant',9);
 assert.equal(h.requirement.dataset.met,'false');assert.equal(h.result.textContent,'651');
 h.change('powerPlant',10);assert.equal(h.requirement.dataset.met,'true');assert.equal(h.result.textContent,'651');
 h.change('from',0);assert.equal(h.result.textContent,'966');assert.equal(h.requirement.dataset.met,'true');
 h.change('to',15);assert.equal(h.requirement.dataset.met,'false');assert.equal(h.result.textContent,'1,701');
 h.change('powerPlant',15);assert.equal(h.requirement.dataset.met,'true');assert.equal(h.result.textContent,'1,701');
 assert(h.requirement.textContent.includes(h.copy.otherConditions));
});
test('switching targets and invalid or empty intervals never leave a stale prerequisite success',()=>{
 const h=setup();h.change('building',800152);h.change('powerPlant',5);assert.equal(h.requirement.dataset.met,'true');
 h.change('from',5);assert.equal(h.result.textContent,'0');assert.equal(h.requirement.hidden,true);assert.equal(h.requirement.dataset.met,undefined);
 h.change('from',6);assert.equal(h.host.dataset.complete,'false');assert.equal(h.requirement.hidden,true);assert.equal(h.status.textContent,h.copy.invalidRange);
 h.change('from',0);h.change('building',800005);assert.equal(h.control.hidden,true);assert.equal(h.requirement.hidden,true);assert.equal(h.requirement.dataset.met,undefined);
});
test('all 21 locales expose identical completed states and native requirement messages',()=>{
 for(const {code:l,numberLocale}of require('../data/i18n/locales.json').locales){
  const h=setup(l);h.change('building',800150);h.change('powerPlant',4);
  const one=new Intl.NumberFormat(numberLocale).format(1);
  assert(h.requirement.textContent.includes(h.copy.powerPlantRequired.replace('{level}',one)),l);
  h.change('powerPlant',5);assert(h.requirement.textContent.includes(h.copy.powerPlantMet.replace('{level}',one)),l);
  assert.equal(h.form.elements.powerPlant.options.length,16);
  for(const sequence of [5,10,15])assert.equal(h.form.elements.powerPlant.querySelector('option[value="'+sequence+'"]').textContent,h.copy.powerPlantCompletedStage.replace('{level}',new Intl.NumberFormat(numberLocale).format(sequence/5)));
 }
});
