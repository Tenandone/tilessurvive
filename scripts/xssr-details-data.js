'use strict';
const D=require('../data/xssr-details.json'),P=require('../data/hero-growth-profiles.json');
function record(id){return D.heroes[id]||null;}
function heroes(){return Object.values(D.heroes);}
function growth(id){const binding=P.bindings[id];if(!binding)return null;return{binding,rank:P.rankProfiles.find(p=>p.id===binding.rankProfileId),gear:P.gearProfiles.find(p=>p.id===binding.gearProfileId)};}
function name(id,locale='en'){const h=record(id);return h?.names[locale]||h?.names.en||null;}
function gearEffect(id,level,locale='en'){const row=record(id)?.exclusiveGear.levels.find(x=>x.level===level);if(!row)return null;const template=row.descriptionTemplates[locale]||row.descriptionTemplates.en;if(!template)return null;return template.replace(/\{(\d+)\}/g,(match,index)=>row.skillDisplayParameters[Number(index)]??match);}
function skillParameters(id,skillId,level){const h=record(id),s=h?.skills.find(s=>s.clientId===skillId);if(!s?.numericEffects||!Number.isInteger(level))return null;const values=require('../data/xssr-skill-values.json'),v=values.skills[skillId];if(v?.heroId!==h.clientId)return null;return v.levels[level]?.slice()||null;}
function skillEffect(id,skillId,level,locale='en'){const h=record(id),s=h?.skills.find(s=>s.clientId===skillId),parameters=skillParameters(id,skillId,level),template=s?.descriptionTemplates[locale]||s?.descriptionTemplates.en;if(!parameters||!template)return null;const value=template.replace(/\{(\d+)\}/g,(match,index)=>parameters[Number(index)]??match);return /\{\d+\}/.test(value)?null:value;}
function validate(){
 const assert=require('node:assert/strict');
 for(const h of heroes()){
  const g=growth(h.id);assert(g?.rank&&g.gear,'Missing bound profile '+h.id);assert.equal(g.binding.clientId,h.clientId);
  assert.equal(g.rank.totalFragments,h.growth.totalFragments);assert.equal(g.gear.totalFragments,h.exclusiveGear.totalQuantity);
  assert.equal(new Set(h.skills.map(s=>s.clientId)).size,4);assert.equal(h.skills.length,4);
  for(const s of h.skills){assert(Object.values(s.names).some(Boolean));assert(Object.values(s.descriptionTemplates).some(Boolean));assert.equal(s.totalManualsToMax,s.materialCosts.reduce((n,r)=>n+r.cost.quantity,0));}
  for(const l of h.exclusiveGear.levels){assert(Number.isSafeInteger(l.attack)&&Number.isSafeInteger(l.defense)&&Number.isSafeInteger(l.health));for(const locale of Object.keys(l.descriptionTemplates))if(l.descriptionTemplates[locale])assert(!/\{\d+\}/.test(gearEffect(h.id,l.level,locale)));}
 }
 return true;
}
module.exports={record,heroes,growth,name,gearEffect,skillParameters,skillEffect,validate,data:D,profiles:P};
