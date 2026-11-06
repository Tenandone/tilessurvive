'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const Pet=require('./answer-guides/pet'),Event=require('./answer-guides/event'),PM=require('../data/v4-formation.json'),EM=require('../data/v4-economy.json');
const mathPet=require('../js/v4-formation-math'),mathEvent=require('../js/v4-economy-math'),registry=require('../data/i18n/locales.json').locales;
const ROOT=path.resolve(__dirname,'..'),snapshot=x=>JSON.stringify(x),placeholders=s=>(s.match(/\{\w+\}/g)||[]).sort();
const all=l=>Pet.guides(l).concat(Event.guides(l));
test('all 21 authored copies preserve every required binding and produce the same language-neutral answer models',()=>{
 for(const file of ['answer-guide-pet-copy','answer-guide-event-copy']){const c=require('../data/'+file+'.json').locales;assert.deepEqual(Object.keys(c).sort(),registry.map(l=>l.code).sort());for(const locale of registry.map(l=>l.code)){assert.deepEqual(Object.keys(c[locale]).sort(),Object.keys(c.en).sort());for(const key of Object.keys(c.en)){assert(c[locale][key].trim());assert.deepEqual(placeholders(c[locale][key]),placeholders(c.en[key]),locale+'/'+key);}}}
 const expected=all('en').map(g=>({targetId:g.targetId,answers:g.answers.map(a=>({id:a.id,model:a.model}))}));
 for(const {code}of registry){const guides=all(code);assert.equal(guides.length,11);assert.equal(new Set(guides.map(g=>g.route)).size,11);assert.deepEqual(guides.map(g=>({targetId:g.targetId,answers:g.answers.map(a=>({id:a.id,model:a.model}))})),expected);for(const g of guides){assert(g.route.startsWith('/'+code+'/'));assert.equal(new Set(g.answers.map(a=>a.id)).size,g.answers.length);assert(!/\{\w+\}/.test(JSON.stringify(g)),'Unfilled answer in '+code);for(const a of g.answers){assert(a.paragraphs.every(x=>typeof x==='string'&&x.trim()));assert.equal(a.model.scope.queryClass,'expected-search-question');assert(a.table?.caption||a.model.scope.editorial);if(a.table)assert(a.table.rows.every(r=>r.length===a.table.columns.length));}}}
});
test('pet effects retain the exact reviewed Lv.1 text, real training unlocks and the unresolved Chompy skill',()=>{
 assert.equal(Pet.guides('ko')[0].answers[0].table.columns[1],'스킬 레벨');
 assert.equal(Pet.guides('en')[0].answers[0].table.columns[1],'Skill level');
 const source=[...require('../data/pet-skill-levels.json').pets,...require('../data/content-60/pets-phase2/model.json').pets];let verified=0,held=0;
 for(const l of ['en','ko','ja','de','ru','zh-tw'])for(const g of Pet.guides(l)){const p=source.find(p=>p.id===g.targetId),a=g.answers[0];assert.equal(a.table.rows.length,4);for(const [i,s]of p.skills.entries()){assert.equal(a.table.rows[i][2],String(s.unlockStage));const row=s.levels.find(x=>x.level===1);if(row){assert.equal(a.table.rows[i][3],row.description[l]);verified++;}else{assert.equal(g.targetId,'chompy');assert.equal(s.slot,3);assert.equal(a.model.status,'partial');assert.deepEqual(a.model.scope.unknownSlots,[3]);assert(!a.model.source.recordIds.includes('chompy:slot:3:level:1'));held++;}}}
 assert.equal(verified,39*6);assert.equal(held,6);
});
test('recommendations remain editorial and every selected rule reacts to ownership, skill and row blockers',()=>{
 for(const pet of PM.pets)for(const rule of Pet.selectedRules(pet)){const input=Pet.ruleInput(rule,pet);const ground=x=>mathPet.analyze(x,PM).candidates.find(c=>c.heroId===rule.heroId&&c.petId===pet.id)?.grounds.find(r=>r.id===rule.id);assert.equal(ground(input).readiness,'conditional');
  const locked=structuredClone(input);locked.heroSkillsUnlocked=false;assert(ground(locked).blockers.includes('hero-skills-locked'));
  const unowned=structuredClone(input);unowned.petId=null;unowned.petStates[pet.id].owned=false;assert(ground(unowned).blockers.includes('pet-not-owned'));
  const stage=input.petStates[pet.id].trainStage;if(stage>0){const lower=structuredClone(input);lower.petStates[pet.id].trainStage=stage-1;assert(ground(lower).blockers.includes('pet-skill-locked'));}
  if(rule.requiredRow){const wrong=structuredClone(input),from=rule.requiredRow,to=from==='front'?'back':'front';wrong[from][0]=null;wrong[to][0]=rule.heroId;assert(ground(wrong).blockers.includes('wrong-row'));}
 }
 for(const g of Pet.guides('en')){const a=g.answers[1];assert.equal(a.model.status,'partial');assert.equal(a.model.scope.editorial,true);assert.equal(a.model.scope.ranked,false);assert.equal(a.model.scope.serverAvailabilityVerified,false);}
 const chompy=Pet.guides('en').find(g=>g.targetId==='chompy').answers[1],X=require('./lib/xssr-catalog');assert.deepEqual(chompy.model.scope.rows,[null]);assert(!chompy.paragraphs[0].includes('in this row'));assert.equal(X.record('alita').release.status,'upcoming');assert(chompy.paragraphs[0].includes(X.copy('en').upcoming),'Alita must retain the upcoming distinction');
});
test('pet examples use the existing growth calculator and keep EXP separate from complete training-stage materials',()=>{
 assert.deepEqual(Pet.guides('ko')[0].answers[2].table.columns,['성장 구간','필요 경험치·재료']);
 assert.deepEqual(Pet.guides('en')[0].answers[2].table.columns,['Growth range','Required EXP / materials']);
 for(const g of Pet.guides('en')){const a=g.answers[2],pet=PM.pets.find(p=>p.id===g.targetId),q=mathPet.petGrowth(pet.id,1,2,0,2,PM);assert.equal(a.model.value,Number(q.experience));assert.deepEqual(a.model.scope.trainingMaterials,q.materials);assert.deepEqual(a.model.start,{level:1,trainingStage:0});assert.deepEqual(a.model.target,{level:2,trainingStage:2});assert(a.model.scope.independentProgressions);assert(a.model.scope.wholeTrainingStagesOnly);assert(a.paragraphs[0].includes('partial training progress is not deducted'));}
 assert.throws(()=>mathPet.petGrowth('snowball',2,1,0,2,PM),RangeError);
});
test('each event rate matches scoreEvent and profile grouping never erases an excluded-action or point difference',()=>{
 const guide=Event.guides('en')[0],answers=guide.answers.filter(a=>a.model.method==='effect');let sourceRows=0;
 for(const answer of answers){const {scope}=answer.model;assert.equal(scope.weekday,null);assert.equal(scope.personalBonusesIncluded,false);assert.equal(scope.currentServerProfileVerified,false);for(const profileId of scope.profiles){const p=EM.events[0].profiles.find(p=>p.id===profileId),day=p.days.find(d=>d.day===scope.eventDay);sourceRows+=day.rules.length;for(const r of day.rules){const q=mathEvent.scoreEvent(EM,{eventId:'alliance-duel',profileId,day:day.day,currentPoints:0,quantities:{[r.materialId]:1},unlockedBoxGroups:[]});assert.equal(q.basePoints,r.points);assert(scope.units.some(u=>u.materialId===r.materialId&&u.points===q.basePoints&&u.quantity===1));}}}
 assert.equal(sourceRows,EM.events[0].profiles.flatMap(p=>p.days.flatMap(d=>d.rules)).length);
 const clone=structuredClone(EM.events[0]),before=Event.dayGroups(clone).length;clone.profiles[1].days[0].rules[0].points++;assert.equal(Event.dayGroups(clone).length,before+1);
});
test('event threshold example rounds up, proves the previous quantity insufficient and never promises a chest unlock',()=>{
 const a=Event.guides('en')[0].answers.at(-1);assert.equal(a.model.value,4);assert.equal(a.model.target.points,50000);assert.equal(a.model.scope.perUnit,15200);assert.equal(a.model.scope.total,60800);assert.equal(a.model.scope.previousTotal,45600);assert.equal(a.model.scope.chestUnlockGuaranteed,false);
 const base={eventId:'alliance-duel',profileId:'season-1',day:4,currentPoints:50000,targetStage:182600010,unlockedBoxGroups:[]};assert.equal(Event.minimumQuantity(EM,base,'survivor_chip_5').quantity,0);
 assert.throws(()=>Event.minimumQuantity(EM,{...base,currentPoints:0,day:2},'survivor_chip_5'),/does not score/);
 const day=EM.events[0].profiles[0].days[3],gated=day.stages.find(s=>s.unlockFunctionId);assert(gated);const q=Event.minimumQuantity(EM,{...base,currentPoints:0,targetStage:gated.id},'survivor_chip_5');assert(q.result.target.pointsMet);assert.equal(q.result.target.unlockConfirmed,false);assert(!q.result.eligibleStages.includes(gated.id));
});
test('all answer links resolve to existing locale pages and real static anchors, including the actual VS and formation tool',()=>{
 const cache=new Map();for(const {code}of registry)for(const guide of all(code)){assert(fs.existsSync(path.join(ROOT,guide.route,'index.html')));for(const link of [...guide.answers.flatMap(a=>a.links||[]),...(guide.basis?.links||[])]){const u=new URL(link.href,'https://tilessurvive.net');assert.equal(u.origin,'https://tilessurvive.net');assert(u.pathname.startsWith('/'+code+'/'));if(!cache.has(u.pathname)){const file=path.join(ROOT,u.pathname,'index.html');assert(fs.existsSync(file),link.href);cache.set(u.pathname,fs.readFileSync(file,'utf8'));}if(u.hash){const id=decodeURIComponent(u.hash.slice(1));assert(cache.get(u.pathname).includes('id="'+id+'"')||cache.get(u.pathname).includes("id='"+id+"'"),link.href+' nonexistent static anchor');}}}
});
test('answer generation is deterministic and leaves all retained pet, event and arithmetic sources unchanged',()=>{
 const sources=['data/v4-formation.json','data/v4-economy.json','data/pet-skill-levels.json','data/content-60/pets-phase2/model.json','data/event-calendar.json','js/v4-formation-math.js','js/v4-economy-math.js'];
 for(const file of sources){const before=cp.execFileSync('git',['show','90c3be09:'+file],{cwd:ROOT,maxBuffer:20e6});assert.equal(fs.readFileSync(path.join(ROOT,file),'utf8').replaceAll('\r\n','\n'),before.toString('utf8').replaceAll('\r\n','\n'),file);}
 const before=snapshot([PM,EM]),first=snapshot(all('ko'));assert.equal(snapshot(all('ko')),first);assert.equal(snapshot([PM,EM]),before);
});
