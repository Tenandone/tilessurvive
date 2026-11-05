'use strict';
// Publication-only join. Retained A/original and B/d profiles stay independent.
// A supplies numeric values and availability; D supplies the full ordered prerequisites.
const assert=require('node:assert/strict');
const clone=value=>structuredClone(value);
const integer=(value,label,min=0)=>assert(Number.isSafeInteger(value)&&value>=min,label+' must be a safe integer >= '+min);
const identity=row=>row.level+':'+row.rank;
const pick=(value,fields)=>Object.fromEntries(fields.filter(field=>Object.hasOwn(value,field)).map(field=>[field,clone(value[field])]));
function index(rows,label){
 assert(Array.isArray(rows)&&rows.length>0,label+' rows missing');
 const result=new Map();
 for(const row of rows){
  assert(row&&typeof row==='object',label+' malformed row');integer(row.level,label+' level',1);integer(row.rank,label+' rank');
  const key=identity(row);assert(!result.has(key),label+' duplicate level/rank '+key);result.set(key,row);
 }
 return result;
}
function nullableNumber(value,label){if(value!==null)integer(value,label);}
function numericFields(row,resourceCount){
 for(const field of ['resources','seconds','battlePower','constructionItems'])assert(Object.hasOwn(row,field),'A missing '+field);
 if(row.resources!==null){assert(Array.isArray(row.resources)&&row.resources.length===resourceCount,'A resource vector shape');row.resources.forEach(n=>nullableNumber(n,'A resource'));}
 nullableNumber(row.seconds,'A seconds');nullableNumber(row.battlePower,'A battle power');
 if(row.constructionItems!==null){
  assert(Array.isArray(row.constructionItems),'A construction items malformed');const seen=new Set();
  for(const item of row.constructionItems){integer(item.id,'A construction item ID',1);integer(item.quantity,'A construction item quantity');assert(!seen.has(item.id),'Duplicate A construction item');seen.add(item.id);}
 }
 if(Object.hasOwn(row,'availability'))assert(['verified','cost_unknown','initial_conditions_unconfirmed'].includes(row.availability),'Unreviewed A availability');
 return {...pick(row,['level','rank','resources','seconds','battlePower','availability']),constructionItems:row.constructionItems===null?null:row.constructionItems.map(item=>pick(item,['id','quantity','name']))};
}
function prerequisites(row){
 assert(Object.hasOwn(row,'requirements'),'D requirements missing');if(row.requirements===null)return null;
 assert(Array.isArray(row.requirements),'D requirements malformed');const seen=new Set();
 return row.requirements.map(requirement=>{
  integer(requirement.buildingId,'D prerequisite building ID',1);integer(requirement.level,'D prerequisite level',1);integer(requirement.rank,'D prerequisite rank');
  const key=requirement.buildingId+':'+identity(requirement);assert(!seen.has(key),'Duplicate D prerequisite '+key);seen.add(key);
  return pick(requirement,['buildingId','level','rank','slug','name']);
 });
}
function unifyBuilding(building,{resourceCount=4}={}){
 integer(building?.id,'Building ID',1);integer(resourceCount,'Resource count',1);
 assert(Array.isArray(building.profiles)&&building.profiles.length===2,'Exactly two source profiles are required');
 const profile=id=>{const matches=building.profiles.filter(p=>typeof p.id==='string'&&p.id.toLowerCase()===id);assert.equal(matches.length,1,'Exactly one '+id+' profile is required');return matches[0];};
 const a=index(profile('original').rows,'A'),d=index(profile('d').rows,'D');
 assert.deepEqual([...a.keys()].sort(),[...d.keys()].sort(),'A/D level and rank identities must match in both directions');
 const rows=[...a.values()].map(row=>({...numericFields(row,resourceCount),requirements:prerequisites(d.get(identity(row)))}));
 return {...pick(building,['id','slug','name']),profiles:[{id:'unified',rows}]};
}
module.exports={unifyBuilding};
