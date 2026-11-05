'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {parseHTML,DOMParser}=require('linkedom');
const M=require('../data/nuclear-age.json'),S=require('./nuclear-service-overrides');
const N=require('./build-nuclear-age'),P=require('./build-nuclear-fuel-poster'),F=require('./nuclear-fuel-summary');
const R=require('../js/nuclear-age'),B=require('./building-data-registry');
const REG=require('../data/i18n/locales.json').locales;
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const all=m=>[...m.buildings,...m.configuredBuildings];
const SOURCE_SHA='734f29e851c2ca1f5fe48c637743fde2d83ab23f97a0d121da5b00f839d57a1c';
const TREE=[800005,800007,800010,800012];
const ALL=[800005,800007,800008,800009,800010,800012,800168,800016,800152,800142,800147,800148,800149,800150];
// Independent reviewed source-row identities. Contiguous ranges apply only to
// these six buildings, not to Power Plant or other non-contiguous source IDs.
const SIX=[{id:800150,first:507720},{id:800148,first:507614},{id:800149,first:507629},{id:800147,first:507599},{id:800142,first:507705},{id:800152,first:508280}];
const LARGE=[100,170,220,250,280,300,320,340,360,380,400,410,430,440,450];
const WORKSHOP=[35,49,63,77,91,105,119,133,147,147,147,147,147,147,147];
const expectedRequirement=n=>({sourceId:[501054,501058,501249][n-1],buildingId:800005,level:30+n,rank:0,completedNuclearLevel:n,completedSequence:n*5,sourceField:'ReqBuildingD'});
const numericalConfig=cfg=>cfg.buildings.map(b=>({id:b.id,stages:b.stages.map(({id,fuel,powerPlantRequirement})=>({id,fuel,...(powerPlantRequirement?{powerPlantRequirement}:{} )}))}));

test('the complete source model reverses exactly one zero correction and ninety derived prerequisites',()=>{
 const before=sha(M),raw=S.sourceProjection(M);
 assert.equal(sha(raw),SOURCE_SHA,'Every retained source fact must survive the exact authorized inverse');
 assert.deepEqual(S.validate(M),{correctedRows:1,prerequisiteBuildings:6,prerequisiteRows:90});
 assert.equal(M.serviceOverrides.length,1);assert.equal(M.serviceOverrides[0].verification,'operator-in-game-confirmation');
 const changes=[];
 for(const b of all(M))for(const [index,row]of b.stages.entries()){
  const original=all(raw).find(x=>x.id===b.id).stages[index];
  if(row.nuclearFuel!==original.nuclearFuel)changes.push([b.id,row.sourceId,original.nuclearFuel,row.nuclearFuel]);
  assert.deepEqual(row.requiredBuildings,original.requiredBuildings,b.id+' ordered prerequisites');
  assert.equal(row.functionOpen,original.functionOpen,b.id+' feature gate');
 }
 assert.deepEqual(changes,[[800005,501051,null,0]]);
 assert.deepEqual(M.factory,raw.factory);assert.equal(M.factory.levels[0].sourceId,507644);assert.equal(M.factory.levels[0].nuclearFuel,null);
 assert.deepEqual(S.project(raw),M);assert.equal(sha(M),before,'Read-only projections must not mutate the shared model');
});

test('all ninety target transitions preserve independent fuel values and point to completed Power Plant levels',()=>{
 let count=0;const targets=new Set(SIX.map(b=>b.id));
 for(const golden of SIX){
  const b=all(M).find(b=>b.id===golden.id);assert(b);assert.equal(b.stages.length,15);
  assert.deepEqual(b.stages.map(s=>s.sourceId),Array.from({length:15},(_,i)=>golden.first+i));
  assert.deepEqual(b.stages.map(s=>s.nuclearFuel),golden.id===800150?WORKSHOP:LARGE);
  for(const [i,s]of b.stages.entries()){
   const n=Math.floor(i/5)+1,q=expectedRequirement(n);
   assert.equal(s.sequence,i+1);assert.equal(s.targetNuclearLevel,n);assert.equal(s.step,i%5+1);
   assert.deepEqual(s.powerPlantRequirement,q);assert.equal(s.requirementsSourceField,'ReqBuildingD');
   assert(s.requiredBuildings.some(r=>r.id===q.sourceId&&r.buildingId===800005&&r.level===q.level&&r.rank===0));
   const completion=M.buildings[0].stages.find(r=>r.sourceId===q.sourceId);
   assert.equal(completion.sequence,n*5);assert.equal(completion.rank,0);assert.equal(completion.step,5);count++;
  }
 }
 assert.equal(count,90);
 for(const b of all(M).filter(b=>!targets.has(b.id)))for(const s of b.stages)assert(!Object.hasOwn(s,'powerPlantRequirement'));
 assert.equal(all(M).flatMap(b=>b.stages).filter(s=>s.powerPlantRequirement).length,90);
 // Preserve direction: these new target markers do not become Power Plant prerequisites.
 const raw=S.sourceProjection(M);
 assert.deepEqual(M.buildings[0].stages.map(s=>s.requiredBuildings),raw.buildings[0].stages.map(s=>s.requiredBuildings));
});

test('the four/fourteen scopes and independent interval/cumulative totals are complete without duplicate targets',()=>{
 for(const [scope,ids,incremental,cumulative]of [
  ['tree',TREE,[1480,3162,3570],[1480,4642,8212]],
  ['all',ALL,[8335,15289,18315],[8335,23624,41939]]
 ]){
  const model=F.project(M,scope);
  assert.deepEqual(model.buildingIds,ids);assert.equal(new Set(model.buildingIds).size,ids.length);
  assert.deepEqual(model.firstPowerPlantUpgrade,{buildingId:800005,sourceId:501051,nuclearFuel:0});
  for(const b of model.buildings)for(const level of b.levels)assert.deepEqual(level.powerPlantRequirement,SIX.some(x=>x.id===b.id)?expectedRequirement(level.level):null);
  assert.deepEqual(model.totals.map(t=>t.incremental.total),incremental);
  assert.deepEqual(model.totals.map(t=>t.cumulative.total),cumulative);
  for(const t of model.totals)for(const mode of ['incremental','cumulative']){
   assert.equal(t[mode].complete,true);assert.deepEqual(t[mode].missingSourceIds,[]);
   assert.equal(new Set(t[mode].sourceIds).size,t[mode].sourceIds.length);
  }
  assert.equal(model.totals[2].cumulative.stageCount,ids.length*15);
  const pp=model.buildings.find(b=>b.id===800005);
  assert.deepEqual(pp.levels.map(l=>l.incremental.total),[400,930,1050]);
  assert.deepEqual(pp.levels.map(l=>l.cumulative.total),[400,1330,2380]);
 }
 assert(SIX.every(b=>ALL.includes(b.id)&&!TREE.includes(b.id)));
});

test('all twenty-one guide tables and calculator configurations receive the same zero and ninety conditions',()=>{
 assert.equal(REG.length,21);let reference;
 for(const locale of REG){
  const cfg=N.calculatorConfig(locale.code),numeric=numericalConfig(cfg),doc=parseHTML(N.renderGuide(locale.code)).document;
  if(reference)assert.deepEqual(numeric,reference,locale.code+' numeric/localization isolation');else reference=numeric;
  assert.equal(cfg.buildings.length,15);assert.equal(new Set(cfg.buildings.map(b=>b.id)).size,15);
  assert.deepEqual(JSON.parse(doc.getElementById('ts-nuclear-age').textContent),cfg);
  assert.equal(doc.querySelectorAll('[data-stage-id]').length,222);
  assert.equal(doc.querySelector('[data-stage-id="501051"] td').textContent,new Intl.NumberFormat(locale.numberLocale).format(0));
  for(const scope of ['tree','all'])for(const mode of ['incremental','cumulative']){
   const panel=doc.querySelector('[data-nuclear-fuel-scope="'+scope+'"][data-nuclear-fuel-panel="'+mode+'"]');
   const badges=[...panel.querySelectorAll('[data-nuclear-power-plant-badge]')].map(n=>Number(n.getAttribute('data-nuclear-power-plant-badge')));
   assert.deepEqual(badges,scope==='all'?ALL.filter(id=>SIX.some(b=>b.id===id)):[]);
   assert.equal(panel.querySelectorAll('[data-nuclear-power-plant-note]').length,scope==='all'?1:0);
  }
  const free=R.plan(cfg.buildings,800005,0,1);assert.equal(free.knownFuel,0);assert.equal(free.complete,true);assert.deepEqual(free.missingStages,[]);
  assert.equal(R.plan(cfg.buildings,800005,0,5).knownFuel,400);
  assert.equal(R.plan(cfg.buildings,800005,5,6).knownFuel,150);assert.equal(R.plan(cfg.buildings,800005,10,11).knownFuel,210);
  for(const {id}of SIX){const b=cfg.buildings.find(b=>b.id===id);for(const [i,s]of b.stages.entries()){
   const n=Math.floor(i/5)+1;assert.deepEqual(s.powerPlantRequirement,expectedRequirement(n));
   assert.equal(R.powerPlantCondition(cfg.buildings,id,i,i+1,n*5-1).met,false);
   assert.equal(R.powerPlantCondition(cfg.buildings,id,i,i+1,n*5).met,true);
  }}
  assert.equal(cfg.buildings.flatMap(b=>b.stages).filter(s=>s.powerPlantRequirement).length,90);
  const target=R.plan(cfg.buildings,800150,0,10);assert.equal(target.knownFuel,966,'Only selected workshop stages are counted');
  assert.equal(R.powerPlantCondition(cfg.buildings,800150,0,10,5).met,false);assert.equal(R.powerPlantCondition(cfg.buildings,800150,0,10,10).met,true);
  assert.deepEqual(R.plan(cfg.buildings,800150,0,10),target,'Checking Power Plant cannot insert prerequisite fuel');
 }
});

test('unknown costs remain incomplete outside the sole correction, including injected nulls',()=>{
 const cfg=N.calculatorConfig('en');
 assert.deepEqual(R.plan(cfg.buildings,800419,0,1),{buildingId:800419,from:0,to:1,stageCount:1,knownFuel:0,complete:false,missingStages:[507644]});
 const changed=structuredClone(M);changed.buildings[0].stages[1].nuclearFuel=null;
 for(const scope of ['tree','all']){
  const out=F.project(changed,scope);assert.equal(out.totals[0].incremental.total,null);assert.equal(out.totals[0].incremental.complete,false);
  assert.deepEqual(out.totals[0].incremental.missingSourceIds,[501052]);
 }
 const invalid=structuredClone(cfg.buildings);invalid.find(b=>b.id===800150).stages[0].fuel=NaN;
 assert.throws(()=>R.plan(invalid,800150,0,1),/INVALID_REQUIREMENT/);
 assert.equal(R.plan(cfg.buildings,800150,5,5).complete,true);assert.equal(R.plan(cfg.buildings,800150,5,5).knownFuel,0);
 assert.equal(R.powerPlantCondition(cfg.buildings,800150,5,5,0).requiredLevel,null);
});

test('Korean and RTL posters embed the same complete comparison model and visible total values',()=>{
 for(const locale of ['ko','ar'])for(const scope of ['tree','all']){
  const model=F.project(M,scope),doc=new DOMParser().parseFromString(P.render(locale,model),'image/svg+xml');
  assert.deepEqual(JSON.parse(doc.querySelector('#nuclear-fuel-projection').textContent),model);
  assert.equal(doc.querySelectorAll('#nuclear-first-upgrade-zero').length,1);
  const nf=new Intl.NumberFormat(REG.find(l=>l.code===locale).numberLocale);
  for(const mode of ['incremental','cumulative']){
   const panel=doc.querySelector('[data-nuclear-fuel-panel="'+mode+'"]');
   assert.equal(panel.querySelectorAll('[data-nuclear-fuel-building]').length,scope==='tree'?4:14);
   const badges=[...panel.querySelectorAll('[data-nuclear-power-plant-badge]')].map(n=>Number(n.getAttribute('data-nuclear-power-plant-badge')));
   assert.deepEqual(badges,scope==='all'?ALL.filter(id=>SIX.some(b=>b.id===id)):[]);
   const numbers=[...panel.querySelectorAll('[data-nuclear-fuel-total] text')].map(n=>n.textContent).slice(-3);
   assert.deepEqual(numbers,model.totals.map(t=>nf.format(t[mode].total)));
  }
  assert.equal(doc.querySelectorAll('#nuclear-power-plant-note').length,scope==='all'?1:0);
 }
});

test('ordinary models and V4 stay immutable while all locales expose the dedicated Nuclear Age route',()=>{
 const rawBaseline=require('./building-data/baseline-7a82e23b.json'),ordinary=B.slugs.flatMap(slug=>B.publicBuildings(slug));
 assert.equal(sha(B.model),rawBaseline.modelSha256);assert.equal(sha(B.evidence.effects),rawBaseline.effectsSha256);
 assert.equal(B.model.buildings.flatMap(b=>b.profiles).length,58);assert.equal(B.model.buildings.flatMap(b=>b.profiles.flatMap(p=>p.rows)).length,1522);
 assert.equal(ordinary.length,29);assert.equal(ordinary.flatMap(b=>b.profiles.flatMap(p=>p.rows)).length,761);
 assert.equal(sha(ordinary),'6dffacb4f7bcf955172f80d743bdd48956ae9bc610efaccb8e63a2b7fe373a55');
 assert.equal(sha(require('../data/v4-economy.json')),'834ac5fac3552f882299b2ff64fe8891cf44697e10732af06fbf94d47944d1ce');
 const pp=ordinary.find(b=>b.id===800005).profiles[0].rows.find(r=>r.level===30&&r.rank===1);assert(pp);assert(!Object.hasOwn(pp,'nuclearFuel'));assert(!Object.hasOwn(pp,'sourceId'));
 const related=['tools/','buildings/power-plant/',...SIX.map(({id})=>'buildings/'+ordinary.find(b=>b.id===id).slug+'/')];
 for(const {code}of REG){
  assert.equal(N.linkRoutes(code).length,16);
  for(const relative of related){
   const route='/'+code+'/'+relative;assert(N.linkRoutes(code).includes(route));
   const projected=N.projectLinks('<html><head></head><body><main><h1>Retained title</h1></main></body></html>',code,route);
   assert.equal(N.validateLinks(projected,code,route),true);
   const d=parseHTML(projected).document;assert(d.querySelector('[data-nuclear-owned="link"] a[href="/'+code+'/eras/nuclear-age/#nuclear-planner"]'));
  }
 }
});
