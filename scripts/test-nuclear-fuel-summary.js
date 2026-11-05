'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../data/nuclear-age.json'),{project}=require('./nuclear-fuel-summary');
const ANNOUNCED=[800005,800007,800008,800009,800010];
const CONFIGURED=[800012,800168,800016,800152,800142,800147,800148,800149,800150];
const ALL=[...ANNOUNCED,...CONFIGURED],TREE=[800005,800007,800010,800012];
const sources=data=>[...data.buildings,...data.configuredBuildings];

test('all and tree totals distinguish five-step requirements from cumulative requirements',()=>{
 for(const [scope,ids,incremental,cumulative]of [
  ['all',ALL,[8335,15289,18315],[8335,23624,41939]],
  ['tree',TREE,[1480,3162,3570],[1480,4642,8212]]
 ]){
  const result=project(M,scope),count=ids.length*5;
  assert.equal(result.schemaVersion,2);assert.equal(result.scope,scope);
  assert.deepEqual(result.buildingIds,ids);assert.deepEqual(result.buildings.map(b=>b.id),ids);
  assert.deepEqual(result.officialBuildingIds,ANNOUNCED);assert.deepEqual(result.announcedBuildingIds,ANNOUNCED);
  assert.deepEqual(result.sourceConfiguredBuildingIds,CONFIGURED);assert.deepEqual(result.configuredBuildings,[]);
  assert.deepEqual(result.totals.map(l=>l.incremental.knownFuel),incremental);
  assert.deepEqual(result.totals.map(l=>l.incremental.total),incremental);
  assert.deepEqual(result.totals.map(l=>l.cumulative.knownFuel),cumulative);
  assert.deepEqual(result.totals.map(l=>l.cumulative.total),cumulative);
  assert.deepEqual(result.totals.map(l=>l.incremental.stageCount),[count,count,count]);
  assert.deepEqual(result.totals.map(l=>l.cumulative.stageCount),[count,count*2,count*3]);
  assert.deepEqual(result.totals.map(l=>l.cumulative.missingSourceIds),[[],[],[]]);
 }
 assert.deepEqual(project(),project(M,'all'));
});

test('each building retains independent reviewed increments, exact source order and unknown propagation',()=>{
 const result=project(),power=result.buildings[0];
 assert.deepEqual(power.levels.map(l=>l.incremental.knownFuel),[400,930,1050]);
 assert.deepEqual(power.levels.map(l=>l.incremental.complete),[true,true,true]);
 assert.deepEqual(power.levels.map(l=>l.cumulative.knownFuel),[400,1330,2380]);
 for(const b of result.buildings.slice(1)){
  const high=[800152,800142,800147,800148,800149].includes(b.id),workshop=b.id===800150;
  assert.deepEqual(b.levels.map(l=>l.incremental.total),workshop?[315,651,735]:high?[1020,1700,2130]:[360,744,840]);
  assert.deepEqual(b.levels.map(l=>l.cumulative.total),workshop?[315,966,1701]:high?[1020,2720,4850]:[360,1104,1944]);
 }
 for(const b of result.buildings){
  const original=sources(M).find(x=>x.id===b.id);
  assert.deepEqual(b.levels.flatMap(l=>l.sourceIds),original.stages.map(s=>s.sourceId));
  assert.deepEqual(b.levels[2].cumulative.sourceIds,original.stages.map(s=>s.sourceId));
 }
});

test('configured buildings join all totals while the tree uses its exact dependency set and excludes factory levels',()=>{
 const data=structuredClone(M),before=JSON.stringify(data),all=project(data),tree=project(data,'tree');
 const allRows=new Set(all.totals.flatMap(l=>l.incremental.sourceIds)),treeRows=new Set(tree.totals.flatMap(l=>l.incremental.sourceIds));
 assert.equal(allRows.size,210);assert.equal(treeRows.size,60);
 for(const b of data.configuredBuildings)for(const s of b.stages){
  assert(allRows.has(s.sourceId));assert.equal(treeRows.has(s.sourceId),TREE.includes(b.id));
 }
 for(const s of data.factory.levels){assert(!allRows.has(s.sourceId));assert(!treeRows.has(s.sourceId));}
 const changedFactory=structuredClone(data);for(const s of changedFactory.factory.levels)s.nuclearFuel=999999;
 assert.deepEqual(project(changedFactory).totals,all.totals);assert.deepEqual(project(changedFactory,'tree').totals,tree.totals);
 assert.equal(JSON.stringify(data),before);
 all.buildings[0].names.en='modified';all.buildings[0].levels[0].sourceIds[0]=-1;all.buildingIds[0]=-1;all.sourceConfiguredBuildingIds[0]=-1;
 assert.equal(JSON.stringify(data),before,'Projection must not mutate source values or source release classifications');
});

test('a missing cost never becomes a complete zero while an explicit zero remains valid in both scopes',()=>{
 const data=structuredClone(M);for(const b of sources(data))for(const s of b.stages)s.nuclearFuel=null;
 for(const scope of ['all','tree']){
  const result=project(data,scope);assert.equal(result.totals[0].incremental.total,null);
  assert.equal(result.totals[0].incremental.knownFuel,0);assert.equal(result.totals[0].incremental.missingSourceIds.length,scope==='all'?70:20);
 }
 for(const b of sources(data))for(const s of b.stages)s.nuclearFuel=0;
 for(const scope of ['all','tree']){const result=project(data,scope);assert.equal(result.totals[2].cumulative.total,0);assert.equal(result.totals[2].cumulative.complete,true);}
});

test('an unknown added-building requirement propagates only through the selected scope',()=>{
 const data=structuredClone(M),comms=data.configuredBuildings.find(b=>b.id===800016),row=comms.stages[5];row.nuclearFuel=null;
 const all=project(data),tree=project(data,'tree');
 assert.equal(all.totals[1].incremental.total,null);assert.equal(all.totals[1].incremental.knownFuel,15289-120);
 assert.deepEqual(all.totals[1].incremental.missingSourceIds,[row.sourceId]);
 assert.deepEqual(all.totals[1].cumulative.missingSourceIds,[row.sourceId]);
 assert.deepEqual(tree,project(M,'tree'));
});

test('unknown scopes, duplicate or reordered IDs and factory inclusion fail before publication',()=>{
 for(const scope of ['',null,undefined,'configured','ALL',{},0]){
  if(scope===undefined)assert.deepEqual(project(M,scope),project(M,'all'));
  else assert.throws(()=>project(M,scope),/Unknown Nuclear Fuel summary scope/);
 }
 for(const mutate of [
  d=>delete d.fuelSummaryScopes,d=>d.fuelSummaryScopes.primaryPrerequisiteField='ReqBuildingB',
  d=>d.fuelSummaryScopes.all.buildingIds.reverse(),d=>d.fuelSummaryScopes.tree.buildingIds.reverse(),
  d=>d.fuelSummaryScopes.tree.buildingIds.push(800016),d=>d.fuelSummaryScopes.all.buildingIds.pop(),
  d=>d.fuelSummaryScopes.all.buildingIds.push(800419),d=>d.fuelSummaryScopes.tree.buildingIds[1]=800005,
  d=>d.fuelSummaryScopes.all.buildingIds[0]='800005',d=>d.fuelSummaryScopes.tree.buildingIds=null
 ]){const data=structuredClone(M);mutate(data);assert.throws(()=>project(data));assert.throws(()=>project(data,'tree'));}
});

test('all source buildings validate before scope selection, including duplicate rows and unsafe costs',()=>{
 for(const mutate of [
  d=>d.buildings.reverse(),d=>d.configuredBuildings.reverse(),d=>d.buildings[0].stages.pop(),d=>d.buildings[0].stages[0].sequence=2,
  d=>d.buildings[0].stages[4].targetNuclearLevel=2,d=>d.buildings[0].stages[4].step=4,
  d=>d.buildings[1].stages[0].sourceId=d.buildings[0].stages[0].sourceId,
  d=>d.configuredBuildings[2].stages[0].sourceId=d.buildings[0].stages[0].sourceId,
  d=>d.configuredBuildings[2].stages.pop(),d=>d.configuredBuildings=[structuredClone(d.buildings[0])],
  d=>delete d.configuredBuildings,d=>d.scope.stepsPerLevel=4
 ]){const data=structuredClone(M);mutate(data);assert.throws(()=>project(data));assert.throws(()=>project(data,'tree'));}
 for(const value of [undefined,NaN,Infinity,-1,.5,'70',true]){
  const data=structuredClone(M);data.configuredBuildings[2].stages[0].nuclearFuel=value;
  assert.throws(()=>project(data),/INVALID_REQUIREMENT/);assert.throws(()=>project(data,'tree'),/INVALID_REQUIREMENT/);
 }
 const data=structuredClone(M);data.buildings[0].stages[0].nuclearFuel=Number.MAX_SAFE_INTEGER;assert.throws(()=>project(data),/OVERFLOW/);
 const sumOverflow=structuredClone(M);for(const b of sources(sumOverflow))for(const s of b.stages)s.nuclearFuel=0;
 sumOverflow.buildings[0].stages[0].nuclearFuel=Number.MAX_SAFE_INTEGER;sumOverflow.configuredBuildings[2].stages[0].nuclearFuel=1;
 assert.throws(()=>project(sumOverflow),/Unsafe combined Nuclear Fuel requirement/);
});
