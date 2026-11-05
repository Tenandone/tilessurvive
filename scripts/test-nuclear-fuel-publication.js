'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const N=require('./build-nuclear-age'),R=require('../js/nuclear-age'),{project}=require('./nuclear-fuel-summary');
const M=require('../data/nuclear-age.json'),REG=require('../data/i18n/locales.json').locales;

test('21 locales render both scopes with exact values and one correction note',()=>{
 for(const {code:l,numberLocale}of REG){
  const d=parseHTML(N.renderFuelSummary(l)).document,c=N.fuelCopy(l),nf=new Intl.NumberFormat(numberLocale);
  assert.equal(d.querySelector('h2').textContent,c.title);
  assert.equal(d.querySelectorAll('.nuclear-fuel-correction-note').length,1);assert.equal(d.querySelector('.nuclear-fuel-correction-note').textContent,c.correctionNote);
  assert.equal(d.querySelectorAll('[data-nuclear-first-upgrade]').length,1);assert.equal(d.querySelector('[data-nuclear-first-upgrade]').textContent,c.firstUpgradeFreeNote);
  assert.equal(d.querySelectorAll('.nuclear-fuel-subtotal,.nuclear-fuel-incomplete-note,.nuclear-fuel-configured').length,0);
  const display=a=>a.complete?nf.format(a.total):a.knownFuel===0?'?':nf.format(a.knownFuel)+' + ?';
  for(const scope of ['tree','all']){
   const model=project(M,scope),download=d.querySelector('[data-nuclear-fuel-download-scope="'+scope+'"] a');
   assert.equal(download.getAttribute('href'),'/img/nuclear-age/fuel-table-'+(scope==='tree'?'tree-':'')+l+'.svg');
   for(const mode of ['incremental','cumulative']){
    const panel=d.querySelector('[data-nuclear-fuel-scope="'+scope+'"][data-nuclear-fuel-panel="'+mode+'"]'),cards=[...panel.querySelectorAll('.nuclear-fuel-card')];assert.equal(cards.length,3);
    cards.forEach((card,i)=>{const amount=model.totals[i][mode];assert.equal(card.querySelector('.nuclear-fuel-amount').dataset.fuelComplete,String(amount.complete));assert.equal(card.querySelector('strong').textContent,display(amount));});
    const table=panel.querySelector('table');assert.deepEqual([...table.querySelectorAll('tbody tr')].map(row=>Number(row.dataset.nuclearSummaryBuilding)),model.buildingIds);
    assert.deepEqual([...panel.querySelectorAll('[data-nuclear-power-plant-badge]')].map(node=>Number(node.dataset.nuclearPowerPlantBadge)),scope==='all'?[800152,800142,800147,800148,800149,800150]:[]);
    const notes=panel.querySelectorAll('[data-nuclear-power-plant-note]');assert.equal(notes.length,scope==='all'?1:0);if(notes.length)assert.equal(notes[0].textContent,'† '+c.powerPlantSharedNote);
    for(const row of table.querySelectorAll('tbody tr')){const b=model.buildings.find(b=>b.id===Number(row.dataset.nuclearSummaryBuilding));assert(row.querySelector('th').textContent.includes(b.names[l]));[...row.querySelectorAll('td')].forEach((cell,i)=>{assert.equal(cell.querySelector('strong').textContent,display(b.levels[i][mode]));assert.equal(cell.querySelector('.nuclear-fuel-amount').dataset.fuelComplete,String(b.levels[i][mode].complete));});}
    [...table.querySelectorAll('tfoot td')].forEach((cell,i)=>assert.equal(cell.querySelector('strong').textContent,display(model.totals[i][mode])));
   }
  }
  assert(!/\{[a-z]+\}/i.test(d.toString()),l+' unresolved placeholder');if(l!=='ko')assert(!/[가-힣]/.test(d.toString()),l+' leaked Korean');
  assert(d.querySelector('noscript style').textContent.includes('.nuclear-fuel-panel[hidden]'));
 }
});

test('summary integration preserves original rows and includes all reviewed buildings in the calculator',()=>{
 const expected=[...M.buildings.flatMap(b=>b.stages),...M.configuredBuildings.flatMap(b=>b.stages),...M.factory.levels].map(s=>s.sourceId);
 for(const {code:l}of REG){
  const d=parseHTML(N.renderGuide(l)).document;
  assert.deepEqual([...d.querySelectorAll('[data-stage-id]')].map(row=>Number(row.dataset.stageId)),expected);
  assert.equal(d.querySelectorAll('[data-nuclear-planner]').length,1);
  assert.equal(d.querySelectorAll('select[name="building"] option').length,15);
  assert.deepEqual(JSON.parse(d.getElementById('ts-nuclear-age').textContent),N.calculatorConfig(l));
  for(const b of N.calculatorConfig(l).buildings)assert(d.getElementById('nuclear-building-'+b.id));
  assert(d.querySelector('.nuclear-jumps a[href="'+N.route(l)+'#nuclear-fuel-table"]'));
  assert(N.renderGuide(l).indexOf('id="nuclear-fuel-table"')<N.renderGuide(l).indexOf('id="nuclear-planner"'));
 }
});

test('scope and mode switches preserve nodes, selected mode and source values on repeated mounting',()=>{
 const {document,window}=parseHTML(N.renderFuelSummary('ko')),host=document.querySelector('[data-nuclear-fuel-summary]');
 const modes=[...host.querySelectorAll('[data-nuclear-fuel-mode]')],scopes=[...host.querySelectorAll('[data-nuclear-fuel-scope-control]')],panels=[...host.querySelectorAll('[data-nuclear-fuel-panel]')],cells=[...host.querySelectorAll('td')],before=cells.map(c=>c.textContent);
 let added=0;for(const button of [...modes,...scopes]){const fn=button.addEventListener.bind(button);button.addEventListener=(...args)=>{added++;return fn(...args);};}
 R.mountSummary(document);R.mountSummary(document);assert.equal(added,4);
 const visible=()=>panels.filter(p=>!p.hidden).map(p=>p.id);assert.deepEqual(visible(),['nuclear-fuel-tree-incremental']);
 modes[1].dispatchEvent(new window.Event('click'));assert.deepEqual(visible(),['nuclear-fuel-tree-cumulative']);
 scopes[1].dispatchEvent(new window.Event('click'));assert.deepEqual(visible(),['nuclear-fuel-all-cumulative']);assert.equal(host.dataset.nuclearFuelMode,'cumulative');
 assert.equal(host.querySelector('[data-nuclear-fuel-download-scope="all"]').hidden,false);assert.equal(host.querySelector('[data-nuclear-fuel-download-scope="tree"]').hidden,true);
 modes[0].dispatchEvent(new window.Event('click'));scopes[0].dispatchEvent(new window.Event('click'));assert.deepEqual(visible(),['nuclear-fuel-tree-incremental']);
 assert.deepEqual([...host.querySelectorAll('td')],cells);assert.deepEqual(cells.map(c=>c.textContent),before);
});

test('the planner never displays an unknown-only range as zero but retains genuine empty-range zero',()=>{
 function select(value){return {value:String(value),listeners:{},children:[],addEventListener(type,fn){this.listeners[type]=fn;},replaceChildren(){this.children=[];},appendChild(node){this.children.push(node);}};}
 const building=select(800005),from=select(0),to=select(0),result={textContent:''},status={textContent:''};
 const form={elements:{building,from,to},addEventListener(){}},host={dataset:{},querySelector(selector){return {'form':form,'[data-nuclear-result]':result,'[data-nuclear-status]':status}[selector];}};
 const cfg=N.calculatorConfig('en'),document={querySelector(selector){return selector==='[data-nuclear-planner]'?host:null;},getElementById(){return {textContent:JSON.stringify(cfg)};},createElement(){return {};}};
 R.mount(document);assert.equal(result.textContent,'400');assert.equal(host.dataset.complete,'true');
 to.value='1';to.listeners.change();assert.equal(result.textContent,'0');assert.equal(status.textContent,'');assert.equal(host.dataset.complete,'true');
 to.value='0';to.listeners.change();assert.equal(result.textContent,'0');assert.equal(host.dataset.complete,'true');assert.equal(status.textContent,'');
 from.value='1';to.value='2';to.listeners.change();assert.equal(result.textContent,'70');assert.equal(host.dataset.complete,'true');
 building.value=String(M.factory.id);from.value='0';to.value='1';building.listeners.change();assert.equal(result.textContent,'—');assert.equal(status.textContent,cfg.copy.incompletePlan);assert.equal(host.dataset.complete,'false');
});
