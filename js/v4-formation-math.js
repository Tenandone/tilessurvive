(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.TS_V4_FORMATION_MATH=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&(Object.getPrototypeOf(o)===Object.prototype||Object.getPrototypeOf(o)===null);
 function emptyInput(model){return {front:[null,null],back:[null,null,null],petId:null,petStates:Object.fromEntries(model.pets.map(p=>[p.id,{owned:false,trainStage:null}])),heroSkillsUnlocked:null,serverAgeDays:null,petGrowth:{fromLevel:1,toLevel:1,fromStage:0,toStage:0}};}
 function validateInput(input,model){
  const errors=[];const add=(code,field)=>errors.push({code,field});
  if(!plain(input)){add('invalid-input','formation');return {valid:false,errors};}
  const keys=['front','back','petId','petStates','heroSkillsUnlocked','serverAgeDays','petGrowth'];
  if(Object.keys(input).some(k=>!keys.includes(k))||keys.some(k=>!own(input,k)))add('invalid-input','formation');
  const seen=new Set();
  for(const [row,count]of [['front',2],['back',3]]){if(!Array.isArray(input[row])||input[row].length!==count){add('invalid-slots',row);continue;}for(let i=0;i<count;i++){const id=input[row][i];if(id===null)continue;if(typeof id!=='string'){add('unknown-hero',row);continue;}const h=model.heroes.find(h=>h.id===id);if(!h){add(model.heldHeroIds.includes(id)?'held-hero':'unknown-hero',row);continue;}if(seen.has(h.identityId))add('duplicate-hero',row);seen.add(h.identityId);}}
  const petIds=model.pets.map(p=>p.id);
  if(input.petId!==null&&(typeof input.petId!=='string'||!petIds.includes(input.petId)))add('unknown-pet','petId');
  if(!plain(input.petStates)||Object.keys(input.petStates).some(k=>!petIds.includes(k))||petIds.some(k=>!own(input.petStates,k)))add('invalid-pet-state','petStates');
  else for(const id of petIds){const s=input.petStates[id];if(!plain(s)||Object.keys(s).length!==2||!own(s,'owned')||!own(s,'trainStage')||typeof s.owned!=='boolean'||!(s.trainStage===null||Number.isInteger(s.trainStage)&&s.trainStage>=0&&s.trainStage<=5))add('invalid-pet-state','petStates');}
  if(input.petId&&input.petStates&&input.petStates[input.petId]&&input.petStates[input.petId].owned===false)add('pet-not-owned','petId');
  if(![null,true,false].includes(input.heroSkillsUnlocked))add('invalid-skill-state','heroSkillsUnlocked');
  if(input.serverAgeDays!==null&&!(Number.isSafeInteger(input.serverAgeDays)&&input.serverAgeDays>=0&&input.serverAgeDays<=Number.MAX_SAFE_INTEGER/86400))add('invalid-server-age','serverAgeDays');
  const g=input.petGrowth;if(!plain(g)||Object.keys(g).length!==4||!['fromLevel','toLevel','fromStage','toStage'].every(k=>own(g,k)&&(g[k]===null||Number.isInteger(g[k])&&g[k]>=(k.endsWith('Level')?1:0)&&g[k]<=(k.endsWith('Level')?100:5)))||g.fromLevel!==null&&g.toLevel!==null&&g.toLevel<g.fromLevel||g.fromStage!==null&&g.toStage!==null&&g.toStage<g.fromStage)add('invalid-growth','petGrowth');
  return {valid:errors.length===0,errors};
 }
 function groupKey(counts){return counts.filter(n=>n>1).sort((a,b)=>b-a).join('_');}
 function factionDisplay(factions,model){
  if(!Array.isArray(factions)||factions.some(f=>!model.factions.some(x=>x.id===f))||factions.length>5)throw new TypeError('Invalid faction list');
  const r=model.factionRules,counts=model.factions.map(f=>factions.filter(x=>x===f.id).length),oceanIndex=model.factions.findIndex(f=>f.id===r.oceanFaction),ocean=counts[oceanIndex],normal=counts.filter((_,i)=>i!==oceanIndex),wild=normal.slice();
  if(ocean){const max=Math.max(...wild);if(max>0)wild[wild.indexOf(max)]+=ocean;else wild.push(ocean);}
  const healthKey=groupKey(wild),counterKey=groupKey(normal);
  // The retained consumer explicitly returns zero when this display lookup has no matching composition.
  const base=own(r.healthBasisPoints,healthKey)?r.healthBasisPoints[healthKey]:0;
  return {healthKey,counterKey,healthBasisPoints:Math.max(0,base-ocean*r.oceanHealthPenaltyBasisPoints),attackBasisPoints:ocean*r.oceanAttackBasisPoints,counterBasisPoints:own(r.counterBasisPoints,counterKey)?r.counterBasisPoints[counterKey]:0,oceanCount:ocean,complete:factions.length===5,kind:'retained-client-display'};
 }
 function factionComparison(left,right,model){
  factionDisplay(left,model);factionDisplay(right,model);
  const hit=(a,b)=>a.reduce((n,x)=>n+b.filter(y=>model.factionRules.relations.some(r=>r.from===x&&r.to===y&&r.value>0)).length,0),leftHits=hit(left,right),rightHits=hit(right,left);
  return {leftHits,rightHits,direction:leftHits===rightHits?'tie':leftHits>rightHits?'left':'right',meaning:'faction-relations-only',liveEligibilityVerified:false};
 }
 function gate(days,seconds){return {requiredDays:seconds/86400,state:days===null?'unknown':days*86400>=seconds?'met':'below'};}
 function petSkillStates(pet,petState){return pet.skills.map(s=>({...s,state:!petState.owned?'unowned':petState.trainStage===null?'unknown':petState.trainStage>=s.unlockStage?'configured-unlocked':'locked',configuredMaxLevel:petState.trainStage===null?null:pet.stages[petState.trainStage].skillLevels[s.slot-1]}));}
 function analyze(input,model){
  const checked=validateInput(input,model);if(!checked.valid)return {valid:false,errors:checked.errors,liveEligibilityVerified:false};
  const deployed=[...input.front,...input.back].filter(Boolean).map(id=>model.heroes.find(h=>h.id===id)),rows=Object.fromEntries(input.front.filter(Boolean).map(id=>[id,'front']).concat(input.back.filter(Boolean).map(id=>[id,'back'])));
  const candidates=new Map();
  for(const r of model.rules){if(!own(rows,r.heroId))continue;const pet=model.pets.find(p=>p.id===r.petId),state=input.petStates[r.petId],skills=petSkillStates(pet,state),blockers=[];
   if(!state.owned)blockers.push('pet-not-owned');
   if(input.heroSkillsUnlocked!==true)blockers.push(input.heroSkillsUnlocked===false?'hero-skills-locked':'hero-skills-unknown');
   if(state.trainStage===null)blockers.push('pet-stage-unknown');else if(r.petSkillIds.some(id=>skills.find(s=>s.clientId===id).state!=='configured-unlocked'))blockers.push('pet-skill-locked');
   if(r.requiredRow&&rows[r.heroId]!==r.requiredRow)blockers.push('wrong-row');
   const key=r.heroId+'|'+r.petId;if(!candidates.has(key))candidates.set(key,{heroId:r.heroId,petId:r.petId,selectedPet:input.petId===r.petId,owned:state.owned,grounds:[]});
   candidates.get(key).grounds.push({...r,blockers,readiness:blockers.length?'blocked':'conditional'});
  }
  const pet=input.petId?model.pets.find(p=>p.id===input.petId):null,petState=pet?input.petStates[pet.id]:null;
  return {valid:true,errors:[],complete:deployed.length===5&&pet!==null,heroCount:deployed.length,liveEligibilityVerified:false,formationStatus:model.formation.status,
   faction:factionDisplay(deployed.map(h=>h.faction),model),gates:{health:gate(input.serverAgeDays,model.factionRules.healthUnlockSeconds),counter:gate(input.serverAgeDays,model.factionRules.counterUnlockSeconds)},
   petSkills:pet?petSkillStates(pet,petState):[],transferBasisPoints:pet&&petState.trainStage!==null?pet.stages[petState.trainStage].transferBasisPoints:null,
   candidates:[...candidates.values()],heroesWithoutCandidates:deployed.filter(h=>!model.rules.some(r=>r.heroId===h.id)).map(h=>h.id),
   warnings:['retained-only','skill-learned-unverified','no-combat-prediction','no-buff-addition',...(deployed.length<5?['incomplete-formation']:[]),...(model.localePolicy?['official-name-fallback']:[])]};
 }
 function petGrowth(petId,fromLevel,toLevel,fromStage,toStage,model){
  const p=model.pets.find(p=>p.id===petId);if(!p||![fromLevel,toLevel,fromStage,toStage].every(Number.isInteger)||fromLevel<1||toLevel>100||toLevel<fromLevel||fromStage<0||toStage>5||toStage<fromStage)throw new RangeError('Invalid pet growth range');
  const exp=p.levelExp.slice(fromLevel-1,toLevel-1).reduce((n,x)=>n+BigInt(x),0n),costs={};for(const s of p.stages.slice(fromStage,toStage))for(const c of s.fullStageMaterialCosts)costs[c.itemId]=(costs[c.itemId]||0n)+BigInt(c.quantity);
  return {experience:exp.toString(),materials:Object.entries(costs).map(([itemId,n])=>({itemId:Number(itemId),quantity:n.toString()})),wholeStagesOnly:true};
 }
 return {emptyInput,validateInput,analyze,factionDisplay,factionComparison,petSkillStates,petGrowth};
});
