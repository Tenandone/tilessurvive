'use strict';
// The approved Power Plant publication uses A numeric values and B prerequisites.
// This projection never edits either retained source profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const SOURCE=path.join(ROOT,'data/client-buildings-52.json');
const TARGET=path.join(ROOT,'data/power-plant-unified.json');
const integer=(value,label)=>assert(Number.isSafeInteger(value)&&value>=0,label+' must be a nonnegative safe integer');
const identity=row=>row.level+':'+row.rank;
function createModel(source) {
  const buildings=source.buildings.filter(b=>(b.buildingId??b.id)===800005);
  assert.equal(buildings.length,1,'Exactly one Power Plant source building is required');
  const building=buildings[0];
  const profile=id=>{const values=building.profiles.filter(p=>p.id.toLowerCase()===id);assert.equal(values.length,1,'Exactly one '+id+' profile is required');return values[0].levels||values[0].rows;};
  function index(rows,label) {
    assert(Array.isArray(rows)&&rows.length===30,label+' must contain all 30 levels');
    const result=new Map(),levels=new Set();
    for(const row of rows){integer(row.level,label+' level');integer(row.rank,label+' rank');assert(row.level>=1&&row.level<=30,label+' level out of range');assert.equal(row.rank,row.level===30?1:0,label+' unsupported level/rank');assert(!result.has(identity(row))&&!levels.has(row.level),label+' duplicate level/rank');result.set(identity(row),row);levels.add(row.level);}
    for(let level=1;level<=30;level++)assert(levels.has(level),label+' missing level '+level);
    return result;
  }
  const numeric=index(profile('original'),'A'),conditions=index(profile('d'),'B');
  assert.deepEqual([...numeric.keys()].sort(),[...conditions.keys()].sort(),'A/B level and rank identities must match');
  const resourceIds=source.resources.map(row=>row.id);
  assert.equal(resourceIds.length,4,'Exactly four resources required');resourceIds.forEach(id=>integer(id,'resource ID'));assert.equal(new Set(resourceIds).size,4,'Duplicate resource ID');
  const rows=[...numeric.values()].sort((a,b)=>a.level-b.level||a.rank-b.rank).map(a=>{
    assert(Array.isArray(a.resources)&&a.resources.length===4,'A resource vector missing');a.resources.forEach(n=>integer(n,'A resources'));
    integer(a.seconds,'A seconds');integer(a.battlePower,'A battle power');
    assert(Array.isArray(a.constructionItems),'A construction items missing');
    const items=new Set(),constructionItems=a.constructionItems.map(item=>{const id=item.id??item.key??item.itemId,quantity=item.quantity??item.value;integer(id,'construction item ID');integer(quantity,'construction item quantity');assert(!items.has(id),'Duplicate construction item');items.add(id);return{id,quantity};});
    const b=conditions.get(identity(a));assert(Array.isArray(b.requirements),'B requirements missing');
    const seen=new Set(),requirements=b.requirements.map(q=>{integer(q.buildingId,'B building ID');integer(q.level,'B required level');integer(q.rank,'B required rank');assert(q.buildingId>0&&q.level>0,'Invalid B requirement identity');const key=q.buildingId+':'+q.level+':'+q.rank;assert(!seen.has(key),'Duplicate B prerequisite');seen.add(key);return{buildingId:q.buildingId,level:q.level,rank:q.rank};});
    return{level:a.level,rank:a.rank,resources:[...a.resources],seconds:a.seconds,battlePower:a.battlePower,constructionItems,requirements};
  });
  return{schemaVersion:1,buildingId:800005,profile:'unified',resourceIds,rows};
}
function validateModel(actual,source=JSON.parse(fs.readFileSync(SOURCE,'utf8'))) {
  assert.deepEqual(actual,createModel(source),'Unified Power Plant data does not match the approved source projection');return actual;
}
function build() {
  const source=JSON.parse(fs.readFileSync(SOURCE,'utf8')),model=createModel(source),output=JSON.stringify(model,null,2)+'\n';
  validateModel(model,source);
  if(!fs.existsSync(TARGET)||fs.readFileSync(TARGET,'utf8')!==output)fs.writeFileSync(TARGET,output);
  console.log(JSON.stringify({powerPlantUnified:true,rows:model.rows.length,requirements:model.rows.reduce((n,r)=>n+r.requirements.length,0)}));return model;
}
module.exports={createModel,validateModel,build};
if(require.main===module)build();
