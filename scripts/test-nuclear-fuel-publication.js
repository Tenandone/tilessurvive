'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const N=require('./build-nuclear-age'),R=require('../js/nuclear-age'),{project}=require('./nuclear-fuel-summary');
const M=require('../data/nuclear-age.json'),REG=require('../data/i18n/locales.json').locales;

test('21 locale summaries render the common requirements, native labels and separate configured buildings',()=>{
 const model=project();
 for(const {code:l,numberLocale}of REG){
  const d=parseHTML(N.renderFuelSummary(l)).document,c=N.fuelCopy(l),nf=new Intl.NumberFormat(numberLocale);
  assert.equal(d.querySelector('h2').textContent,c.title);
  assert.equal(d.querySelector('a[download]').getAttribute('href'),'/img/nuclear-age/fuel-table-'+l+'.svg');
  for(const mode of ['incremental','cumulative']){
   const panel=d.querySelector('[data-nuclear-fuel-panel="'+mode+'"]'),cards=[...panel.querySelectorAll('.nuclear-fuel-card')];assert.equal(cards.length,3);
   cards.forEach((card,i)=>{const amount=model.totals[i][mode];assert.equal(card.querySelector('.nuclear-fuel-amount').dataset.fuelComplete,String(amount.complete));assert.equal(card.querySelector('.nuclear-fuel-amount strong').textContent,nf.format(amount.knownFuel));if(!amount.complete){assert.equal(card.querySelector('.nuclear-fuel-subtotal').textContent,c.knownSubtotal);assert.equal(card.querySelector('.nuclear-fuel-amount small').textContent,c.unknown+' · '+nf.format(amount.missingSourceIds.length));}});
   assert.equal(panel.querySelectorAll('.nuclear-fuel-incomplete-note').length,1);
   assert.equal(panel.querySelector('.nuclear-fuel-incomplete-note').textContent,c.incomplete.replace('{count}',nf.format(1)));
   assert.equal(panel.querySelectorAll('.nuclear-fuel-card>p').length,0);
   assert.equal(panel.querySelector('.nuclear-fuel-cards-label').textContent,c.officialTotal);
   const official=panel.querySelector('[data-nuclear-fuel-matrix="official"]');
   assert.deepEqual([...official.querySelectorAll('tbody tr')].map(row=>Number(row.dataset.nuclearSummaryBuilding)),model.officialBuildingIds);
   for(const row of official.querySelectorAll('tbody tr')){
    const building=model.buildings.find(b=>b.id===Number(row.dataset.nuclearSummaryBuilding));assert(row.querySelector('th').textContent.includes(building.names[l]));
    [...row.querySelectorAll('td')].forEach((cell,i)=>{assert.equal(cell.querySelector('strong').textContent,nf.format(building.levels[i][mode].knownFuel));assert.equal(cell.querySelector('.nuclear-fuel-amount').dataset.fuelComplete,String(building.levels[i][mode].complete));});
   }
   const configured=panel.querySelector('[data-nuclear-fuel-matrix="configured"]');
   if(model.configuredBuildings.length){assert(configured);assert.equal(configured.querySelectorAll('tbody tr').length,model.configuredBuildings.length);assert.equal(configured.querySelectorAll('tfoot').length,0);assert(panel.querySelector('.nuclear-fuel-configured p').textContent.includes(c.configuredNote));}
  }
  assert(!/\{[a-z]+\}/i.test(d.toString()),l+' unresolved summary placeholder');
  if(l!=='ko')assert(!/[가-힣]/.test(d.toString()),l+' leaked Korean copy');
  assert(d.querySelector('noscript style').textContent.includes('.nuclear-fuel-panel[hidden]'));
 }
});

test('summary integration preserves the 87 original cost rows and six-building calculator model',()=>{
 const expected=[...M.buildings.flatMap(b=>b.stages),...M.factory.levels].map(s=>s.sourceId);
 for(const {code:l}of REG){
  const d=parseHTML(N.renderGuide(l)).document;
  assert.deepEqual([...d.querySelectorAll('[data-stage-id]')].map(row=>Number(row.dataset.stageId)),expected);
  assert.equal(d.querySelectorAll('[data-nuclear-planner]').length,1);
  assert.equal(d.querySelectorAll('select[name="building"] option').length,6);
  assert.deepEqual(JSON.parse(d.getElementById('ts-nuclear-age').textContent),N.calculatorConfig(l));
  assert(d.querySelector('.nuclear-jumps a[href="'+N.route(l)+'#nuclear-fuel-table"]'));
  assert(N.renderGuide(l).indexOf('id="nuclear-fuel-table"')<N.renderGuide(l).indexOf('id="nuclear-planner"'));
 }
});

test('mode controls retain their nodes, source numbers and configured disclosures on repeated mounting',()=>{
 const {document,window}=parseHTML(N.renderFuelSummary('ko'));
 const host=document.querySelector('[data-nuclear-fuel-summary]'),buttons=[...host.querySelectorAll('[data-nuclear-fuel-mode]')],panels=[...host.querySelectorAll('[data-nuclear-fuel-panel]')],cells=[...host.querySelectorAll('td')],before=cells.map(c=>c.textContent);
 let added=0;for(const button of buttons){const original=button.addEventListener.bind(button);button.addEventListener=(...args)=>{added++;return original(...args);};}
 R.mountSummary(document);R.mountSummary(document);assert.equal(added,2);
 assert.equal(panels[0].hidden,false);assert.equal(panels[1].hidden,true);
 const disclosure=panels[1].querySelector('details');if(disclosure)disclosure.setAttribute('open','');
 buttons[1].dispatchEvent(new window.Event('click'));
 assert.equal(panels[0].hidden,true);assert.equal(panels[1].hidden,false);assert.equal(buttons[1].getAttribute('aria-pressed'),'true');assert.equal(buttons[0].getAttribute('aria-pressed'),'false');
 buttons[0].dispatchEvent(new window.Event('click'));buttons[1].dispatchEvent(new window.Event('click'));
 if(disclosure)assert(disclosure.hasAttribute('open'));
 assert.deepEqual([...host.querySelectorAll('td')],cells);assert.deepEqual(cells.map(c=>c.textContent),before);
 assert.equal(host.dataset.nuclearFuelMode,'cumulative');
});

test('the planner never displays an unknown-only range as zero but retains genuine empty-range zero',()=>{
 function select(value){return {value:String(value),listeners:{},children:[],addEventListener(type,fn){this.listeners[type]=fn;},replaceChildren(){this.children=[];},appendChild(node){this.children.push(node);}};}
 const building=select(800005),from=select(0),to=select(0),result={textContent:''},status={textContent:''};
 const form={elements:{building,from,to},addEventListener(){}},host={dataset:{},querySelector(selector){return {'form':form,'[data-nuclear-result]':result,'[data-nuclear-status]':status}[selector];}};
 const cfg=N.calculatorConfig('en'),document={querySelector(selector){return selector==='[data-nuclear-planner]'?host:null;},getElementById(){return {textContent:JSON.stringify(cfg)};},createElement(){return {};}};
 R.mount(document);assert.equal(result.textContent,'400');assert.equal(host.dataset.complete,'false');
 to.value='1';to.listeners.change();assert.equal(result.textContent,'—');assert.equal(status.textContent,cfg.copy.incompletePlan);assert.equal(host.dataset.complete,'false');
 to.value='0';to.listeners.change();assert.equal(result.textContent,'0');assert.equal(host.dataset.complete,'true');assert.equal(status.textContent,'');
 from.value='1';to.value='2';to.listeners.change();assert.equal(result.textContent,'70');assert.equal(host.dataset.complete,'true');
});
