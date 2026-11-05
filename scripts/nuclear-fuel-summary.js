'use strict';
const assert=require('node:assert/strict');
const {plan}=require('../js/nuclear-age');
const OFFICIAL_IDS=Object.freeze([800005,800007,800008,800009,800010]);
const BADGES=Object.freeze(['I','II','III']);

function amount(building,from,to){
 const result=plan([building],building.id,from,to);
 return {knownFuel:result.knownFuel,total:result.complete?result.knownFuel:null,complete:result.complete,missingSourceIds:[...result.missingStages],sourceIds:building.stages.slice(from,to).map(s=>s.id),stageCount:result.stageCount};
}
function combine(amounts){
 let knownFuel=0;
 for(const value of amounts){knownFuel+=value.knownFuel;assert(Number.isSafeInteger(knownFuel),'Unsafe combined Nuclear Fuel requirement');}
 const missingSourceIds=amounts.flatMap(value=>value.missingSourceIds),sourceIds=amounts.flatMap(value=>value.sourceIds),complete=missingSourceIds.length===0;
 return {knownFuel,total:complete?knownFuel:null,complete,missingSourceIds,sourceIds,stageCount:sourceIds.length};
}
function project(data=require('../data/nuclear-age.json')){
 assert.equal(data.scope?.minimumPowerPlantLevel,30,'Unreviewed Nuclear Fuel base level');
 assert.equal(data.scope?.stepsPerLevel,5,'Unreviewed Nuclear Fuel step count');
 assert.equal(data.scope?.initialNuclearMax,3,'Unreviewed Nuclear Fuel level range');
 assert(Array.isArray(data.buildings),'Missing official Nuclear Age buildings');
 assert.deepEqual(data.buildings.map(b=>b.id),OFFICIAL_IDS,'Official Nuclear Fuel totals require the reviewed five buildings');
 const configured=data.configuredBuildings??[];
 assert(Array.isArray(configured),'Malformed configured Nuclear Age buildings');
 const buildingIds=new Set(),sourceIds=new Set();
 function building(source){
  assert(Number.isSafeInteger(source.id)&&source.id>0&&!buildingIds.has(source.id),'Invalid or duplicate Nuclear Age building');buildingIds.add(source.id);
  assert(Array.isArray(source.stages)&&source.stages.length===15,'N1–N3 require exactly fifteen reviewed steps');
  for(const [index,stage]of source.stages.entries()){
   assert(Number.isSafeInteger(stage.sourceId)&&stage.sourceId>0&&!sourceIds.has(stage.sourceId),'Invalid or duplicate Nuclear Age source row');sourceIds.add(stage.sourceId);
   assert.equal(stage.sequence,index+1,'Unreviewed Nuclear Age step order');
   assert.equal(stage.targetNuclearLevel,Math.floor(index/5)+1,'Unreviewed Nuclear Age target level');
   assert.equal(stage.step,index%5+1,'Unreviewed Nuclear Age substep');
  }
  const input={id:source.id,stages:source.stages.map(s=>({id:s.sourceId,fuel:s.nuclearFuel}))};
  return {id:source.id,names:{...source.names},image:source.image?{...source.image}:null,levels:[1,2,3].map(level=>({level,badge:BADGES[level-1],sourceIds:input.stages.slice((level-1)*5,level*5).map(s=>s.id),incremental:amount(input,(level-1)*5,level*5),cumulative:amount(input,0,level*5)}))};
 }
 const buildings=data.buildings.map(building),configuredBuildings=configured.map(building);
 return {schemaVersion:1,baseLevel:30,stepsPerLevel:5,levels:[1,2,3],officialBuildingIds:[...OFFICIAL_IDS],client:{version:data.client.version,build:data.client.build},item:{id:data.item.id,names:{...data.item.names},image:data.item.image?{...data.item.image}:null},stageMarker:data.stageMarker?{...data.stageMarker}:null,buildings,totals:[1,2,3].map(level=>({level,badge:BADGES[level-1],incremental:combine(buildings.map(b=>b.levels[level-1].incremental)),cumulative:combine(buildings.map(b=>b.levels[level-1].cumulative))})),configuredBuildings};
}
module.exports={project};
