'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../data/nuclear-age.json'),{project}=require('./nuclear-fuel-summary');

test('N1–N3 official totals distinguish five-step requirements from cumulative requirements',()=>{
 const result=project();
 assert.deepEqual(result.officialBuildingIds,[800005,800007,800008,800009,800010]);
 assert.deepEqual(result.totals.map(l=>l.incremental.knownFuel),[1840,3906,4410]);
 assert.deepEqual(result.totals.map(l=>l.incremental.total),[null,3906,4410]);
 assert.deepEqual(result.totals.map(l=>l.cumulative.knownFuel),[1840,5746,10156]);
 assert.deepEqual(result.totals.map(l=>l.cumulative.total),[null,null,null]);
 assert.deepEqual(result.totals.map(l=>l.incremental.stageCount),[25,25,25]);
 assert.deepEqual(result.totals.map(l=>l.cumulative.stageCount),[25,50,75]);
 assert.deepEqual(result.totals.map(l=>l.cumulative.missingSourceIds),[[501051],[501051],[501051]]);
});

test('each building retains independent reviewed increments, exact source order and unknown propagation',()=>{
 const result=project(),power=result.buildings[0];
 assert.deepEqual(power.levels.map(l=>l.incremental.knownFuel),[400,930,1050]);
 assert.deepEqual(power.levels.map(l=>l.incremental.complete),[false,true,true]);
 assert.deepEqual(power.levels.map(l=>l.cumulative.knownFuel),[400,1330,2380]);
 for(const b of result.buildings.slice(1)){
  assert.deepEqual(b.levels.map(l=>l.incremental.total),[360,744,840]);
  assert.deepEqual(b.levels.map(l=>l.cumulative.total),[360,1104,1944]);
 }
 for(const b of result.buildings){
  const original=M.buildings.find(x=>x.id===b.id);
  assert.deepEqual(b.levels.flatMap(l=>l.sourceIds),original.stages.map(s=>s.sourceId));
  assert.deepEqual(b.levels[2].cumulative.sourceIds,original.stages.map(s=>s.sourceId));
 }
 assert(!result.totals.flatMap(l=>l.incremental.sourceIds).some(id=>M.factory.levels.some(s=>s.sourceId===id)));
});

test('configured buildings and the factory cannot enter official totals or mutate canonical inputs',()=>{
 const data=structuredClone(M),before=JSON.stringify(data),all=project(data);
 const officialOnly=structuredClone(data);delete officialOnly.configuredBuildings;
 assert.deepEqual(all.totals,project(officialOnly).totals);
 assert.deepEqual(all.configuredBuildings.map(b=>b.id),(data.configuredBuildings||[]).map(b=>b.id));
 for(const b of all.configuredBuildings)for(const l of b.levels)for(const id of l.sourceIds)assert(!all.totals.some(t=>t.cumulative.sourceIds.includes(id)));
 assert.equal(JSON.stringify(data),before);
 all.buildings[0].names.en='modified';all.buildings[0].levels[0].sourceIds[0]=-1;
 assert.equal(JSON.stringify(data),before);
});

test('a missing cost never becomes a complete zero while an explicit zero remains valid',()=>{
 const data=structuredClone(M);for(const b of data.buildings)for(const s of b.stages)s.nuclearFuel=null;
 let result=project(data);assert.equal(result.totals[0].incremental.total,null);assert.equal(result.totals[0].incremental.knownFuel,0);assert.equal(result.totals[0].incremental.missingSourceIds.length,25);
 for(const b of data.buildings)for(const s of b.stages)s.nuclearFuel=0;
 result=project(data);assert.equal(result.totals[2].cumulative.total,0);assert.equal(result.totals[2].cumulative.complete,true);
});

test('misordered, duplicated, incomplete or unsafe inputs fail before publication',()=>{
 for(const mutate of [
  d=>d.buildings.reverse(),d=>d.buildings[0].stages.pop(),d=>d.buildings[0].stages[0].sequence=2,
  d=>d.buildings[0].stages[4].targetNuclearLevel=2,d=>d.buildings[0].stages[4].step=4,
  d=>d.buildings[1].stages[0].sourceId=d.buildings[0].stages[0].sourceId,
  d=>d.configuredBuildings=[structuredClone(d.buildings[0])],d=>d.scope.stepsPerLevel=4
 ]){const data=structuredClone(M);mutate(data);assert.throws(()=>project(data));}
 for(const value of [undefined,NaN,Infinity,-1,.5,'70',true]){const data=structuredClone(M);data.buildings[0].stages[0].nuclearFuel=value;assert.throws(()=>project(data),/INVALID_REQUIREMENT/);}
 const data=structuredClone(M);data.buildings[0].stages[0].nuclearFuel=Number.MAX_SAFE_INTEGER;assert.throws(()=>project(data),/OVERFLOW/);
});
