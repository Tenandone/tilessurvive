'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
const M=require('../data/v4-formation.json'),MathModel=require('../js/v4-formation-math'),X=require('./lib/xssr-catalog'),S=require('./sync-xssr-formation');
const ROOT=path.resolve(__dirname,'..'),BASE=JSON.parse(cp.execFileSync('git',['show','43b9eb3c:data/v4-formation.json'],{cwd:ROOT,encoding:'utf8',maxBuffer:32e6}));
function ready(){const v=MathModel.emptyInput(M);v.front=['furiosa','lava'];v.back=['alita','lucky','rusty'];v.petId='starhorn';v.heroSkillsUnlocked=true;v.serverAgeDays=60;for(const pet of M.pets)v.petStates[pet.id]={owned:true,trainStage:5};return v;}
test('retains all 29 previous calculation heroes and all 70 previous rules exactly',()=>{
 for(const h of BASE.heroes)assert.deepEqual(M.heroes.find(x=>x.id===h.id),h);for(const r of BASE.rules)assert.deepEqual(M.rules.find(x=>x.id===r.id),r);
 assert.equal(M.heroes.length,31);assert.equal(M.rules.length,74);assert.deepEqual(M.factionRules,BASE.factionRules);assert.deepEqual(M.pets,BASE.pets);assert.deepEqual(M.heldHeroIds,BASE.heldHeroIds);
 const input=MathModel.emptyInput(BASE);input.front=['lava','rusty'];input.back=['lucky','tony','maddy'];assert.deepEqual(MathModel.analyze(input,M),MathModel.analyze(input,BASE));
});
test('verified new heroes work in five slots with preserved release status and faction rules',()=>{
 const input=ready(),out=MathModel.analyze(input,M);assert(out.valid&&out.complete);assert.equal(out.heroCount,5);assert.equal(out.liveEligibilityVerified,false);
 assert.deepEqual(out.faction,MathModel.factionDisplay([2,1,3,3,1],BASE));assert.equal(M.heroes.find(h=>h.id==='alita').releaseStatus,'upcoming');
 assert.deepEqual(X.counts(),{total:31,released:30,development:1,xssr:3});assert.equal(X.heroes().length,37);assert.equal(X.officialHeroes().length,0);assert.deepEqual(X.verifiedHeroes().map(h=>h.roles.classTags[0].clientId),[27500028,27500028]);
 input.back[0]='furiosa';assert(MathModel.validateInput(input,M).errors.some(e=>e.code==='duplicate-hero'));
});
test('new pet candidates remain conditional and respond to actual row, training and ownership',()=>{
 let input=ready(),out=MathModel.analyze(input,M),get=(o,h,p)=>o.candidates.find(c=>c.heroId===h&&c.petId===p).grounds[0];
 for(const[h,p]of[['furiosa','fluffy'],['furiosa','hardhead'],['alita','chompy'],['alita','starhorn']])assert.equal(get(out,h,p).readiness,'conditional');
 [input.front[0],input.back[0]]=[input.back[0],input.front[0]];out=MathModel.analyze(input,M);assert(get(out,'furiosa','fluffy').blockers.includes('wrong-row'));assert(get(out,'furiosa','hardhead').blockers.includes('wrong-row'));assert(get(out,'alita','starhorn').blockers.includes('wrong-row'));assert.equal(get(out,'alita','chompy').readiness,'conditional');
 input=ready();input.petStates.hardhead={owned:false,trainStage:5};out=MathModel.analyze(input,M);assert(get(out,'furiosa','hardhead').blockers.includes('pet-not-owned'));
 input.petStates.chompy.trainStage=0;out=MathModel.analyze(input,M);assert(get(out,'alita','chompy').blockers.includes('pet-skill-locked'));
 input.petStates.starhorn.owned=false;assert(MathModel.validateInput(input,M).errors.some(e=>e.code==='pet-not-owned'));
});
test('new rule labels exist in all 21 locales and synchronization is idempotent',()=>{
 for(const f of ['hero-guide-copy','v4-formation-copy']){const copy=require('../data/'+f+'.json');assert.equal(Object.keys(copy.locales).length,21);for(const c of Object.values(copy.locales))for(const r of M.rules.filter(r=>r.origin===S.ORIGIN)){assert(c.reasons[r.reasonKey]);for(const key of r.conditionKeys)assert(c.conditions[key]);}}
 const extra=S.additions(M);assert.deepEqual(extra.heroes,M.heroes.slice(-2));assert.deepEqual(extra.rules,M.rules.slice(-4));
});
