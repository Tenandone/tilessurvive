'use strict';
const assert=require('node:assert/strict');
const Data=require('../xssr-details-data');
const Math=require('../../js/xssr-growth-calculator');

// A null row remains unknown. Only a fully known interval has a total/value.
function interval(rows,from,to){
 assert(Array.isArray(rows));assert(Number.isInteger(from)&&Number.isInteger(to)&&from>=0&&to>=from&&to<=rows.length,'Invalid hero range');
 assert.deepEqual(rows.map(r=>r.level),Array.from({length:rows.length},(_,i)=>i+1),'Missing or duplicated destination');
 const selected=rows.slice(from,to),unknown=selected.filter(r=>r.quantity===null||r.quantity===undefined);
 for(const r of selected)assert(r.quantity==null||Number.isSafeInteger(r.quantity)&&r.quantity>=0,'Invalid material quantity');
 const knownSubtotal=selected.filter(r=>r.quantity!=null).reduce((n,r)=>{const v=n+r.quantity;assert(Number.isSafeInteger(v),'Unsafe total');return v;},0);
 const value=unknown.length?null:Math.calculate(rows,from,to);
 return{status:unknown.length?'partial':value===0?'confirmed-zero':'confirmed',value,knownSubtotal,unknownRecordIds:unknown.map(r=>r.recordId),recordIds:selected.map(r=>r.recordId)};
}
function rankRange(h,from,to){
 const rows=h.growth.rankRows,groups=[...new Set(rows.map(r=>r.rank))];
 assert.deepEqual(groups,Array.from({length:groups.length},(_,i)=>i+1),'Invalid growth-stage order');
 assert(Number.isInteger(from)&&Number.isInteger(to)&&from>=0&&to>=from&&to<=groups.length,'Invalid growth stage');
 const counts=groups.map(rank=>{const group=rows.filter(r=>r.rank===rank);assert.deepEqual(group.map(r=>r.step),Array.from({length:group.length},(_,i)=>i+1),'Invalid growth steps');return group.length;});
 const boundary=rank=>counts.slice(0,rank).reduce((a,b)=>a+b,0);
 return interval(rows.map((r,i)=>({level:i+1,quantity:r.cost?.quantity,recordId:r.clientRowId})),boundary(from),boundary(to));
}
function gearRange(h,from,to){return interval(h.exclusiveGear.levels.map(r=>({level:r.level,quantity:r.cost?.quantity,recordId:r.clientRowId})),from,to);}
function skillRange(s,from,to){
 assert(s.automaticUpgrade===false,'Automatic skills are not manual upgrades');
 assert(Number.isInteger(from)&&Number.isInteger(to)&&from>=s.configuredLevelRange.min&&to>=from&&to<=s.configuredLevelRange.max,'Invalid skill level');
 assert.equal(s.configuredLevelRange.min,1,'Unsupported skill origin');
 return interval(s.materialCosts.map(r=>({level:r.destinationLevel-1,quantity:r.cost?.quantity,recordId:r.clientRowId})),from-1,to-1);
}
function projectHero(id,data=Data.data){
 const h=data.heroes[id];assert(h,'Unknown hero');
 const rankIds=[...new Set(h.growth.rankRows.map(r=>r.rank))],manual=h.skills.filter(s=>!s.automaticUpgrade);
 return{hero:h,version:data.version,visualStarMappingVerified:false,
  growth:rankIds.map(rank=>({rank,steps:h.growth.rankRows.filter(r=>r.rank===rank).length,incremental:rankRange(h,rank-1,rank),cumulative:rankRange(h,0,rank)})),
  growthExample:rankRange(h,3,rankIds.at(-1)),
  skills:manual.map(s=>({skill:s,total:skillRange(s,s.configuredLevelRange.min,s.configuredLevelRange.max),example:skillRange(s,1,10)})),
  gear:{total:gearRange(h,0,h.exclusiveGear.levels.at(-1).level),fromOne:gearRange(h,1,h.exclusiveGear.levels.at(-1).level),example:gearRange(h,10,h.exclusiveGear.levels.at(-1).level),unchanged:gearRange(h,10,10)}};
}
module.exports={interval,rankRange,gearRange,skillRange,projectHero};
