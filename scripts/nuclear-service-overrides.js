'use strict';
// Service facts are kept separate from the retained 2.6.400 binary evidence.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),FILE='data/nuclear-age.json';
const clone=x=>structuredClone(x);
const SOURCE_SHA='19b0eb838c5dfce7c47c3fae2dacbaf98bf2754bdb90fc98ef963be076fd76df';
const OVERRIDE=Object.freeze({id:'power-plant-first-nuclear-fuel-zero',buildingId:800005,sourceId:501051,sourceKey:'building_stronghold_30_2',level:30,rank:1,sequence:1,itemId:210658,field:'nuclearFuel',sourceField:'ReqItemSoc',sourceValue:null,value:0,sourceTableSHA256:SOURCE_SHA,verification:'operator-in-game-confirmation',confirmedOn:'2026-11-06'});
const SIX=Object.freeze([800150,800148,800149,800147,800142,800152]);
const FIRST=Object.freeze({800150:507720,800148:507614,800149:507629,800147:507599,800142:507705,800152:508280});
const POWER=Object.freeze([501054,501058,501249]);

function identity(model){
 assert.equal(model.client?.version,'2.6.400','Service correction requires the reviewed nuclear client version');
 assert.equal(model.client.build,1546,'Service correction requires the reviewed nuclear client build');
 assert.equal(model.client.tables?.buildings?.sha256,SOURCE_SHA,'Nuclear source table changed');
 assert.equal(model.item?.id,210658,'Wrong Nuclear Fuel item');
 assert.equal(model.scope.minimumPowerPlantLevel,30);assert.equal(model.scope.stepsPerLevel,5);assert.equal(model.scope.initialNuclearMax,3);
 const all=[...model.buildings,...model.configuredBuildings];
 assert.equal(all.length,14,'Nuclear building count changed');
 assert.equal(new Set(all.map(b=>b.id)).size,14,'Nuclear building identity/count changed');
 for(const id of SIX)assert(all.some(b=>b.id===id),'Missing reviewed prerequisite building '+id);
 const power=all.find(b=>b.id===800005);assert(power,'Missing Power Plant');
 const matches=all.flatMap(b=>b.stages.filter(s=>s.sourceId===501051).map(s=>({b,s})));
 assert.equal(matches.length,1,'Correction row must be unique');assert.equal(matches[0].b.id,800005,'Correction row belongs to another building');
 const first=matches[0].s;
 for(const key of ['sourceId','sourceKey','level','rank','sequence'])assert.equal(first[key],OVERRIDE[key],'Correction row identity '+key);
 assert.equal(first.targetNuclearLevel,1);assert.equal(first.step,1);assert.equal(first.nuclearFuelSourceField,'ReqItemSoc');
 return {all,power,first};
}

function requirement(model,building,stage,index){
 assert(SIX.includes(building.id),'Unreviewed prerequisite building');
 assert.equal(stage.sourceId,FIRST[building.id]+index,'Prerequisite source-row identity');
 assert.equal(stage.sequence,index+1,'Prerequisite sequence');
 const n=Math.floor(index/5)+1,step=index%5+1;
 assert.equal(stage.targetNuclearLevel,n);assert.equal(stage.step,step);
 assert.equal(stage.level,30+Math.floor((index+1)/5));assert.equal(stage.rank,(index+1)%5);
 assert.equal(stage.requirementsSourceField,'ReqBuildingD','Distinct prerequisite profiles must not be mixed');
 assert(Array.isArray(stage.requiredBuildings),'Missing configured prerequisites');
 const expected={sourceId:POWER[n-1],buildingId:800005,level:30+n,rank:0,completedNuclearLevel:n,completedSequence:n*5,sourceField:'ReqBuildingD'};
 const refs=stage.requiredBuildings.filter(r=>r.buildingId===800005);assert.equal(refs.length,1,'Exactly one reviewed Power Plant prerequisite');
 for(const [key,value]of Object.entries({id:expected.sourceId,buildingId:800005,level:expected.level,rank:0}))assert.equal(refs[0][key],value,'Power Plant prerequisite identity '+key);
 const completed=model.buildings.find(b=>b.id===800005).stages.find(s=>s.sourceId===expected.sourceId);assert(completed,'Missing completed Power Plant source row');
 for(const [key,value]of Object.entries({sequence:n*5,level:30+n,rank:0,targetNuclearLevel:n,step:5}))assert.equal(completed[key],value,'Power Plant completion state '+key);
 return expected;
}

// This inverse is strict: it removes only the approved service correction and
// validated derived prerequisite metadata, never arbitrary numeric differences.
function sourceProjection(input){
 const model=clone(input),{all,first}=identity(model);
 if(Object.hasOwn(model,'serviceOverrides')){
  assert.deepEqual(model.serviceOverrides,[OVERRIDE],'Unreviewed service correction');
  assert.equal(first.nuclearFuel,0);assert.equal(first.nuclearFuelStatus,'operator-confirmed');assert.equal(first.nuclearFuelOverrideId,OVERRIDE.id);
  first.nuclearFuel=null;first.nuclearFuelStatus='unconfirmed-null-source';delete first.nuclearFuelOverrideId;delete model.serviceOverrides;
 }else{
  assert.equal(first.nuclearFuel,null,'Zero requires the exact operator correction evidence');
  assert.equal(first.nuclearFuelStatus,'unconfirmed-null-source');assert(!Object.hasOwn(first,'nuclearFuelOverrideId'));
 }
 for(const b of all){
  if(SIX.includes(b.id))assert.equal(b.stages.length,15,'Fifteen prerequisite transitions required');
  for(const [i,s]of b.stages.entries()){
   if(SIX.includes(b.id)){const expected=requirement(model,b,s,i);if(Object.hasOwn(s,'powerPlantRequirement')){assert.deepEqual(s.powerPlantRequirement,expected,'Unreviewed derived Power Plant prerequisite');delete s.powerPlantRequirement;}}
   else assert(!Object.hasOwn(s,'powerPlantRequirement'),'Unexpected new prerequisite target building');
  }
 }
 return model;
}

function project(input){
 const model=sourceProjection(input),{all,first}=identity(model);
 first.nuclearFuel=0;first.nuclearFuelStatus='operator-confirmed';first.nuclearFuelOverrideId=OVERRIDE.id;
 model.serviceOverrides=[clone(OVERRIDE)];
 for(const b of all)if(SIX.includes(b.id))for(const [i,s]of b.stages.entries())s.powerPlantRequirement=requirement(model,b,s,i);
 return model;
}
function validate(model=require('../data/nuclear-age.json')){
 assert.deepEqual(model,project(model),'Nuclear service projection is stale or altered');
 return {correctedRows:1,prerequisiteBuildings:SIX.length,prerequisiteRows:SIX.length*15};
}
function write(){const file=path.join(ROOT,FILE),before=fs.readFileSync(file,'utf8'),model=project(JSON.parse(before));validate(model);const after=JSON.stringify(model,null,2)+'\n',changed=before!==after;if(changed)fs.writeFileSync(file,after);return {...validate(model),changed};}
module.exports={SOURCE_SHA,OVERRIDE,SIX,POWER,powerPlantRequirement:requirement,sourceProjection,project,validate,write};
if(require.main===module){assert(process.argv.length===2||process.argv.length===3&&process.argv[2]==='--write','Use --write for explicit service synchronization');console.log(JSON.stringify(process.argv[2]==='--write'?write():validate()));}
