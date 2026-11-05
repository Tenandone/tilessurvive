'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const {parseHTML}=require('linkedom'),M=require('../data/v4-economy.json'),COPY=require('../data/v4-economy-copy.json'),F=require('../js/v4-economy-math'),UI=require('../js/v4-economy-ui'),S=require('../js/v4-state');
const ROOT=path.resolve(__dirname,'..'),BASELINE='90b72553e336d168cbe810bca4246c26b90da08a';
function setup(locale='en',model=M,kind='growth'){
 const {document,window}=parseHTML('<main><div id="app"></div></main>'),proto=Object.getPrototypeOf(document.createElement('select')),descriptor=Object.getOwnPropertyDescriptor(proto,'value');
 if(!descriptor?.set)Object.defineProperty(proto,'value',{configurable:true,get(){return [...this.querySelectorAll('option')].find(o=>o.hasAttribute('selected'))?.getAttribute('value')??this.querySelector('option')?.getAttribute('value')??'';},set(v){for(const o of this.querySelectorAll('option')){if(o.getAttribute('value')===String(v))o.setAttribute('selected','');else o.removeAttribute('selected');}}});
 const host=document.getElementById('app');let changes=0;const ctx={host,model,copy:COPY.locales[locale],locale,numberLocale:locale,onChange(){changes++;}};
 const controller=kind==='growth'?UI.mountGrowth(ctx):UI.mountVS(ctx);return {host,document,window,controller,changes:()=>changes};
}
function goal(entity,profile='unified',uid='g'){const row=entity.profiles[0].rows.find(r=>r.level>1)||entity.profiles[0].rows[0];return{uid,kind:'building',id:entity.id,profile,from:row.level-1,to:row.level};}
const frozen=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(frozen);Object.freeze(x);}return x;};

test('all 29 synchronized buildings accept only same-ID legacy aliases without mutating goals',()=>{
 assert.equal(M.buildings.length,29);let checks=0;for(const entity of M.buildings){assert.deepEqual(entity.profiles.map(p=>p.id),['unified']);const canonical=goal(entity),expected=F.quoteGoal(M,canonical);
  for(const profile of ['original','d','unified']){const input=frozen({...canonical,id:String(entity.id),profile}),before=structuredClone(input);assert.deepEqual(F.quoteGoal(M,input),expected);assert.deepEqual(F.normalizeGoal(M,input),canonical);assert.deepEqual(input,before);checks++;}
 }assert.equal(checks,87);
 for(const input of [{...goal(M.buildings[0]),id:999999},{...goal(M.buildings[0]),profile:'unknown'},{...goal(M.buildings[0]),profile:''},{...goal(M.buildings[0]),profile:'800010:d'}])assert.throws(()=>F.quoteGoal(M,input),e=>e.code==='unknownId');
});

test('alias normalization precedes overlap checks and never double-spends inventory or speedups',()=>{
 const canonical={goals:[{uid:'a',kind:'building',id:800010,profile:'unified',from:1,to:2},{uid:'b',kind:'building',id:800010,profile:'unified',from:2,to:3}],held:{1200005:2000,1200004:2000},speedupSeconds:{construction:90,universal:30}},legacy=structuredClone(canonical);legacy.goals[0].profile='original';legacy.goals[1].profile='d';legacy.goals[1].id='800010';const before=structuredClone(legacy);
 assert.deepEqual(F.plan(M,legacy),F.plan(M,canonical));assert.deepEqual(legacy,before);
 const overlap=structuredClone(legacy);overlap.goals[0].to=3;assert.throws(()=>F.plan(M,overlap),e=>e.code==='overlappingGoal');
 for(const bad of [NaN,Infinity,-1,1.5,'1']){const invalid=structuredClone(legacy);invalid.goals[0].from=bad;assert.throws(()=>F.plan(M,invalid));assert(Object.is(invalid.goals[0].from,bad));}
});

test('saved legacy growth state normalizes every ID before validation and hides only the redundant profile control',()=>{
 const h=setup(),initial=h.controller.read();for(const entity of M.buildings)for(const profile of ['original','d']){const state=frozen({...structuredClone(initial),goals:[{...goal(entity,profile),id:String(entity.id)}]}),before=structuredClone(state);h.controller.restore(state);const restored=h.controller.read();assert.equal(restored.goals[0].id,entity.id);assert.equal(restored.goals[0].profile,'unified');assert.deepEqual(state,before);assert.equal(h.changes(),0);assert.equal(h.host.querySelectorAll('[data-v4-field="profile"]').length,0);assert(h.host.querySelector('[data-v4-field="entity"]'));}
 const legacyModel=structuredClone(M),entity=legacyModel.buildings[0];entity.profiles=['original','d'].map(id=>({...structuredClone(entity.profiles[0]),id}));const old=setup('en',legacyModel),state=old.controller.read();state.goals=[goal(entity,'d')];old.controller.restore(state);assert.equal(old.controller.read().goals[0].profile,'d');assert.equal(old.host.querySelectorAll('[data-v4-field="profile"]').length,1,'Do not hide distinct profiles in a genuinely variant model');
});

test('invalid restored identities, aliases, overlaps and nonfinite inputs fail atomically while blank fields stay blank',()=>{
 const h=setup(),good=h.controller.read();good.goals=[goal(M.buildings.find(b=>b.id===800010),'original')];h.controller.restore(good);const before=h.controller.read();
 for(const mutate of [s=>s.goals[0].id=999999,s=>s.goals[0].profile='made-up',s=>s.goals[0].profile='',s=>s.goals[0].from=NaN,s=>s.held[1200005]=Infinity,s=>s.goals.push({...s.goals[0],uid:'overlap',profile:'d'})]){const input=structuredClone(good);mutate(input);assert.throws(()=>h.controller.restore(input));assert.deepEqual(h.controller.read(),before);assert.equal(h.changes(),0);}
 const incomplete=structuredClone(good);incomplete.goals[0].from=null;h.controller.restore(incomplete);assert.equal(h.controller.read().goals[0].profile,'unified');assert.equal(h.controller.read().goals[0].from,null);assert.equal(h.host.querySelector('[data-v4-field="from"]').value,'');assert(h.host.querySelector('[role="alert"]'));
});

test('local saves and shared URLs migrate a cloned growth plan without rewriting other tabs or input storage',()=>{
 const h=setup(),g=h.controller.read();g.goals=[goal(M.buildings.find(b=>b.id===800010),'d')];const vs=setup('en',M,'vs').controller.read(),wrapper={schema:1,tab:'growth',plans:{growth:g,vs,formation:{schema:1,fixture:'retained'}}},store=new Map(),storage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,value)};
 S.save(storage,'saved',wrapper);const bytes=store.get('saved'),link=S.url('https://tilessurvive.net/en/tools/?legacy=1',wrapper);
 for(const restored of [S.restore(storage,'saved'),S.fromHash(new URL(link).hash)]){const original=structuredClone(restored);h.controller.restore(restored.plans.growth);const next={...restored,plans:{...restored.plans,growth:h.controller.read()}};assert.equal(next.plans.growth.goals[0].profile,'unified');assert.deepEqual(next.plans.vs,vs);assert.deepEqual(next.plans.formation,wrapper.plans.formation);assert.deepEqual(restored,original);assert.deepEqual(S.decode(S.encode(next)),next);}
 assert.equal(store.get('saved'),bytes);assert.equal(wrapper.plans.growth.goals[0].profile,'d');assert.equal(h.changes(),0);
});

test('all 21 locales restore legacy aliases with canonical share state and preserved entity selectors',()=>{
 for(const locale of Object.keys(COPY.locales)){const h=setup(locale),state=h.controller.read();state.goals=[goal(M.buildings.find(b=>b.id===800010),'original')];h.controller.restore(state);assert.equal(h.controller.read().goals[0].profile,'unified');assert(!h.host.querySelector('[data-v4-field="profile"]'));assert(h.host.querySelector('[data-v4-field="entity"]'));assert(!h.host.querySelector('[role="alert"]'));assert(!h.host.textContent.includes('undefined'));}
});

test('research, training, healing and VS calculations remain byte-equivalent to the retained runtime',()=>{
 const previous=cp.execFileSync('git',['show',BASELINE+':js/v4-economy-math.js'],{cwd:ROOT,encoding:'utf8'}),sandbox={module:{exports:{}},require:()=>require('../js/building-system')};vm.runInNewContext(previous,sandbox);const old=sandbox.module.exports,before=JSON.stringify(M),same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
 for(const entity of M.research){const input={kind:'research',id:entity.id,from:0,to:entity.levels[0].level};same(F.quoteGoal(M,input),old.quoteGoal(M,input));}
 for(const entity of M.troops)for(const kind of ['training','healing']){const input={kind,id:entity.id,quantity:7};same(F.quoteGoal(M,input),old.quoteGoal(M,input));}
 for(const event of M.events)for(const profile of event.profiles)for(const day of profile.days){const input={eventId:event.id,profileId:profile.id,day:day.day,quantities:Object.fromEntries(M.materials.map(m=>[m.id,3])),currentPoints:100,targetStage:day.stages[0].id,unlockedBoxGroups:[]};same(F.scoreEvent(M,input),old.scoreEvent(M,input));}
 assert.equal(JSON.stringify(M),before);
});
