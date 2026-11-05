'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const S=require('./nuclear-service-overrides'),M=require('../data/nuclear-age.json'),B=require('./building-data-registry');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex'),clone=x=>structuredClone(x);
const SOURCE_MODEL_SHA='734f29e851c2ca1f5fe48c637743fde2d83ab23f97a0d121da5b00f839d57a1c';

test('the one operator correction is exactly reversible to every pre-service source fact',()=>{
 const before=clone(M),raw=S.sourceProjection(M);assert.equal(sha(raw),SOURCE_MODEL_SHA);assert.deepEqual(M,before);
 assert.deepEqual(S.validate(M),{correctedRows:1,prerequisiteBuildings:6,prerequisiteRows:90});assert.deepEqual(S.project(M),M);assert.deepEqual(S.project(raw),M);
 const first=M.buildings[0].stages[0];assert.equal(first.sourceId,501051);assert.equal(first.nuclearFuel,0);assert.equal(first.nuclearFuelStatus,'operator-confirmed');
 assert.equal(raw.buildings[0].stages[0].nuclearFuel,null);assert.equal(M.factory.levels[0].sourceId,507644);assert.equal(M.factory.levels[0].nuclearFuel,null);
 assert.deepEqual(M.fuelSummaryScopes,raw.fuelSummaryScopes);assert.equal(M.fuelSummaryScopes.tree.buildingIds.length,4);assert.equal(M.fuelSummaryScopes.all.buildingIds.length,14);
});

test('90 source transitions point from each target to the same completed Power Plant N level',()=>{
 const raw=S.sourceProjection(M),all=[...M.buildings,...M.configuredBuildings];let count=0;
 for(const b of all){const old=[...raw.buildings,...raw.configuredBuildings].find(x=>x.id===b.id);for(const [i,s]of b.stages.entries()){
  assert.deepEqual(s.requiredBuildings,old.stages[i].requiredBuildings);assert.equal(s.functionOpen,old.stages[i].functionOpen);
  if(!S.SIX.includes(b.id)){assert(!Object.hasOwn(s,'powerPlantRequirement'));continue;}
  const n=Math.floor(i/5)+1,p=s.powerPlantRequirement;assert.deepEqual(p,{sourceId:[501054,501058,501249][n-1],buildingId:800005,level:30+n,rank:0,completedNuclearLevel:n,completedSequence:n*5,sourceField:'ReqBuildingD'});
  assert.equal(s.nuclearFuel,old.stages[i].nuclearFuel);count++;
 }}assert.equal(count,90);assert.deepEqual(M.buildings[0].stages.map(s=>s.requiredBuildings),raw.buildings[0].stages.map(s=>s.requiredBuildings),'Never reverse the six target prerequisites into Power Plant requirements');
});

test('the correction rejects wrong version, source ID, item, sequence, evidence or unauthorised zero',()=>{
 const source=S.sourceProjection(M);
 for(const mutate of [
  x=>x.client.version='2.6.200',x=>x.client.build=1512,x=>x.client.tables.buildings.sha256='0'.repeat(64),x=>x.item.id=202201,
  x=>x.buildings[0].stages[0].sourceId=501052,x=>x.buildings[0].stages[0].sourceKey='building_stronghold_30',x=>x.buildings[0].stages[0].sequence=5,
  x=>x.buildings[0].stages[0].rank=0,x=>x.buildings[0].stages[0].nuclearFuel=0
 ]){const bad=clone(source);mutate(bad);assert.throws(()=>S.project(bad));}
 for(const mutate of [x=>x.serviceOverrides[0].sourceId=507644,x=>x.serviceOverrides[0].value=1,x=>x.buildings[0].stages[0].nuclearFuel=null,x=>x.buildings[0].stages[0].nuclearFuelOverrideId='other']){const bad=clone(M);mutate(bad);assert.throws(()=>S.validate(bad));}
});

test('a partial Power Plant level, wrong prerequisite direction and altered ninety-row mapping are rejected',()=>{
 for(const mutate of [
  s=>s.powerPlantRequirement.completedSequence=4,
  s=>s.powerPlantRequirement.rank=1,
  s=>s.powerPlantRequirement.sourceId=501051,
  s=>s.powerPlantRequirement.buildingId=800150,
  s=>s.requiredBuildings[0].id=501051,
  s=>s.requirementsSourceField='ReqBuildingB',
  s=>s.sourceId++,s=>s.sequence++,s=>delete s.powerPlantRequirement
 ]){const bad=clone(M),stage=bad.configuredBuildings.find(b=>b.id===800150).stages[0];mutate(stage);assert.throws(()=>S.validate(bad));}
 const bad=clone(M);bad.buildings[0].stages[0].powerPlantRequirement={...M.configuredBuildings.find(b=>b.id===800150).stages[0].powerPlantRequirement};assert.throws(()=>S.validate(bad));
});

test('existing extra prerequisites and feature conditions are retained, not satisfied by the new Power Plant marker',()=>{
 const raw=S.sourceProjection(M),b=raw.configuredBuildings.find(b=>b.id===800150),s=b.stages[0];
 s.requiredBuildings.push({id:123456,buildingId:800419,code:'other-existing-condition',level:3,rank:0});s.functionOpen='existing-additional-gate';
 const service=S.project(raw),next=service.configuredBuildings.find(x=>x.id===800150).stages[0];
 assert.deepEqual(next.requiredBuildings,s.requiredBuildings);assert.equal(next.functionOpen,s.functionOpen);assert.equal(next.powerPlantRequirement.completedSequence,5);
});

test('generic 2.6.200 buildings and V4 ordinary projections remain unchanged despite matching Level30/rank1',()=>{
 assert.equal(B.model.gameVersion,'2.6.200');assert.equal(B.model.buildings.length,29);
 assert.equal(sha(B.slugs.flatMap(slug=>B.publicBuildings(slug))),'6dffacb4f7bcf955172f80d743bdd48956ae9bc610efaccb8e63a2b7fe373a55');
 assert.equal(sha(require('../data/v4-economy.json')),'834ac5fac3552f882299b2ff64fe8891cf44697e10732af06fbf94d47944d1ce');
 const normal=B.publicBuildings('power-plant')[0].profiles[0].rows.find(r=>r.level===30&&r.rank===1);assert(normal);assert(!Object.hasOwn(normal,'nuclearFuel'));assert(!Object.hasOwn(normal,'sourceId'));
 assert.equal(require('./sync-v4-building-projection').validate().rows,761);
});

test('unrelated missing costs remain unknown while an explicit configured zero remains zero',()=>{
 const raw=S.sourceProjection(M),workshop=raw.configuredBuildings.find(b=>b.id===800150);
 workshop.stages[1].nuclearFuel=null;workshop.stages[2].nuclearFuel=0;
 const service=S.project(raw),next=service.configuredBuildings.find(b=>b.id===800150);
 assert.equal(next.stages[1].nuclearFuel,null);assert.equal(next.stages[2].nuclearFuel,0);assert.equal(service.factory.levels[0].nuclearFuel,null);
 assert.equal(service.buildings[0].stages[0].nuclearFuel,0);
 const missing=clone(M);missing.configuredBuildings.find(b=>b.id===800150).id=899999;assert.throws(()=>S.validate(missing),/Missing reviewed prerequisite building/);
});
