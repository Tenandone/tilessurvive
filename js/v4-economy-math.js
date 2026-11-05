(function(root,factory){'use strict';const api=factory(typeof module==='object'&&module.exports?require('./building-system'):root.BUILDING_SYSTEM);if(typeof module==='object'&&module.exports)module.exports=api;else root.TS_V4_ECONOMY=api;})(typeof globalThis!=='undefined'?globalThis:this,function(building){
 'use strict';
 function fail(code){const e=new Error(code);e.code=code;throw e;}
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),integer=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
 function number(n){if(!integer(n))fail('invalidInput');return n;}
 function add(a,b){const n=a+b;if(!integer(n))fail('overflow');return n;}
 function multiply(a,b){number(a);number(b);const n=a*b;if(!integer(n))fail('overflow');return n;}
 function object(x){if(!x||typeof x!=='object'||Array.isArray(x))fail('invalidInput');return x;}
 function unique(list,key){if(new Set(list.map(key)).size!==list.length)fail('duplicateGoal');}
 const copy=x=>JSON.parse(JSON.stringify(x)),sum=a=>a.reduce(add,0);
 function find(list,id){const x=list.find(v=>String(v.id)===String(id));if(!x)fail('unknownId');return x;}
 function range(rows,from,to){number(from);number(to);if(to<from)fail('invalidRange');const levels=rows.map(r=>r.level);if(!levels.includes(to)&&to!==0||from!==0&&!levels.includes(from))fail('invalidRange');const selected=rows.filter(r=>r.level>from&&r.level<=to);if(selected.length!==to-from||new Set(selected.map(r=>r.level)).size!==selected.length)fail('invalidRange');return selected;}
 function amountMap(m,allowed){object(m);for(const [key,n]of Object.entries(m)){if(!allowed.has(String(key)))fail('unknownResource');number(n);}return m;}
 function resourceKeys(model){return new Set([...model.resources.map(r=>String(r.id)),...model.buildings.flatMap(b=>b.profiles.flatMap(p=>p.rows.flatMap(r=>(r.constructionItems||[]).map(i=>String(i.id??i.itemId)))))]);}
 function powerDifference(rows,from,to,key){if(from===to)return 0;const a=from===0?0:rows.find(r=>r.level===from)?.[key],b=rows.find(r=>r.level===to)?.[key];return integer(a)&&integer(b)&&b>=a?b-a:null;}
 function normalizeGoal(model,goal){object(goal);const result={...goal};if(goal.kind==='building'){const entity=find(model.buildings,goal.id);let profile=goal.profile;if(entity.profiles.length===1&&entity.profiles[0].id==='unified'&&['original','d'].includes(profile))profile='unified';result.id=entity.id;result.profile=find(entity.profiles,profile).id;}return result;}
 function quoteGoal(model,goal){goal=normalizeGoal(model,goal);const kind=goal.kind;let resources=null,seconds=null,powerDelta=null,requirements=[],reasonCodes=[],route=null;
  if(kind==='building'){
   const entity=find(model.buildings,goal.id),p=find(entity.profiles,goal.profile);const rows=range(p.rows,goal.from,goal.to);route='/buildings/'+entity.slug+'/';
   requirements=rows.flatMap(r=>(r.requirements||[]).map(q=>({...copy(q),step:r.level})));powerDelta=powerDifference(p.rows,goal.from,goal.to,'battlePower');
   if(rows.some(r=>r.blocked||!Array.isArray(r.resources)||r.resources.some(x=>!integer(x))||!integer(r.seconds)||r.requirements===null)){reasonCodes.push('buildingIncomplete');}
   else{if(!building?.sumRange)fail('missingDependency');const q=building.sumRange(p.rows,goal.from,goal.to,[0,0,0,0]);resources=Object.fromEntries(model.resources.map((r,i)=>[r.id,q.resources[i]]));for(const item of q.constructionItems){const id=item.id??item.itemId;resources[id]=add(resources[id]||0,item.quantity);}seconds=q.seconds;}
   if(powerDelta===null)reasonCodes.push('powerUnknown');reasonCodes.push('prerequisiteCostsExcluded','configuredBase');
  }else if(kind==='research'){
   const entity=find(model.research,goal.id),rows=range(entity.levels,goal.from,goal.to);route=entity.route;requirements=rows.flatMap(r=>r.requirements.map(q=>({...copy(q),step:r.level})));powerDelta=powerDifference(entity.levels,goal.from,goal.to,'totalPower');
   if(!rows.length){resources={};seconds=0;}else reasonCodes.push(...entity.reasonCodes);
   reasonCodes.push('configuredBase');
  }else if(kind==='training'||kind==='healing'){
   const entity=find(model.troops,goal.id),quantity=number(goal.quantity),unit=kind==='training'?entity.resources:entity.healingResources;route='/database/';
   resources=Object.fromEntries(Object.entries(unit).map(([id,cost])=>[id,multiply(cost,quantity)]));seconds=quantity===0?0:null;powerDelta=kind==='training'?multiply(entity.power,quantity):null;requirements=[copy(entity.requirements)];reasonCodes.push(...entity.reasonCodes);if(kind==='healing')reasonCodes.push('powerUnknown');
  }else fail('unknownKind');
  return {kind,id:goal.id,resources,seconds,powerDelta,requirements,route,reasonCodes:[...new Set(reasonCodes)]};
 }
 function plan(model,input){object(input);if(!Array.isArray(input.goals)||input.goals.length>30)fail('invalidInput');const goals=input.goals.map(goal=>normalizeGoal(model,goal));unique(goals,g=>g.uid);for(const g of goals)if(typeof g.uid!=='string'||!g.uid||g.uid.length>80)fail('invalidInput');
  // A single entity cannot be charged twice for overlapping level transitions.
  const levelGoals=goals.filter(g=>['building','research'].includes(g.kind));for(let i=0;i<levelGoals.length;i++)for(let j=i+1;j<levelGoals.length;j++){const a=levelGoals[i],b=levelGoals[j];if(a.kind===b.kind&&String(a.id)===String(b.id)&&(a.profile!==b.profile||Math.max(a.from,b.from)<Math.min(a.to,b.to)))fail('overlappingGoal');}
  const allowed=resourceKeys(model),held=amountMap(input.held||{},allowed),wallet={...held},speedup=input.speedupSeconds||{};amountMap(speedup,new Set(['construction','research','training','healing','universal']));const speeds={construction:0,research:0,training:0,healing:0,universal:0,...speedup};
  const knownResources={},knownAllocated={},knownShortage={},results=[];let knownSeconds=0,knownRemainingSeconds=0,knownPowerDelta=0,incompleteCost=false,incompleteTime=false,incompletePower=false;
  for(const goal of goals){const q=quoteGoal(model,goal),allocated={},shortage={};let canFund=null;if(q.resources===null)incompleteCost=true;else{for(const [id,required]of Object.entries(q.resources)){number(required);const value=Math.min(wallet[id]||0,required);allocated[id]=value;shortage[id]=required-value;wallet[id]=(wallet[id]||0)-value;knownResources[id]=add(knownResources[id]||0,required);knownAllocated[id]=add(knownAllocated[id]||0,value);knownShortage[id]=add(knownShortage[id]||0,shortage[id]);}canFund=Object.values(shortage).every(n=>n===0);}
   let remainingSeconds=null,usedSpeedupSeconds=0;if(q.seconds===null)incompleteTime=true;else{const family=q.kind==='building'?'construction':q.kind;const typed=Math.min(speeds[family],q.seconds);speeds[family]-=typed;const universal=Math.min(speeds.universal,q.seconds-typed);speeds.universal-=universal;usedSpeedupSeconds=add(typed,universal);remainingSeconds=q.seconds-usedSpeedupSeconds;knownSeconds=add(knownSeconds,q.seconds);knownRemainingSeconds=add(knownRemainingSeconds,remainingSeconds);}
   if(q.powerDelta===null)incompletePower=true;else knownPowerDelta=add(knownPowerDelta,q.powerDelta);
   results.push({...q,uid:goal.uid,allocated:q.resources===null?null:allocated,shortage:q.resources===null?null:shortage,canFund,remainingSeconds,usedSpeedupSeconds});
  }
  return {goals:results,resources:incompleteCost?null:knownResources,knownResources,allocated:knownAllocated,shortage:incompleteCost?null:knownShortage,knownShortage,remainingHeld:wallet,seconds:incompleteTime?null:knownSeconds,knownSeconds,remainingSeconds:incompleteTime?null:knownRemainingSeconds,knownRemainingSeconds,powerDelta:incompletePower?null:knownPowerDelta,knownPowerDelta,unusedSpeedupSeconds:speeds,reasonCodes:['priorityReservation','workTimeNotDeadline',...(incompleteCost?['partialResources']:[]),...(incompleteTime?['partialTime']:[])]};
 }
 function scoreEvent(model,input){object(input);const event=find(model.events,input.eventId),profile=find(event.profiles,input.profileId);number(input.day);const day=profile.days.find(d=>d.day===input.day);if(!day)fail('invalidDay');
  const materialIds=new Set(model.materials.map(m=>m.id)),quantities=amountMap(input.quantities||{},materialIds),current=number(input.currentPoints??0);const groups=input.unlockedBoxGroups||[];if(!Array.isArray(groups))fail('invalidInput');unique(groups,x=>x);for(const id of groups)if(!day.stages.some(s=>s.groupId===id))fail('unknownId');
  const perDay=profile.days.map(d=>({day:d.day,basePoints:sum(d.rules.map(r=>multiply(quantities[r.materialId]||0,r.points)))})),basePoints=perDay.find(d=>d.day===input.day).basePoints,totalPoints=add(current,basePoints);
  const stages=day.stages.map(s=>({id:s.id,groupId:s.groupId,points:s.points,pointShortage:Math.max(0,s.points-totalPoints),pointsMet:totalPoints>=s.points,unlockConfirmed:!s.unlockFunctionId||groups.includes(s.groupId),rewards:copy(s.rewards)}));
  let target=null;if(input.targetStage!==null&&input.targetStage!==undefined){target=stages.find(s=>s.id===input.targetStage);if(!target)fail('unknownId');}
  const used=new Set(day.rules.map(r=>r.materialId));return {eventId:event.id,profileId:profile.id,day:day.day,basePoints,totalPoints,currentPoints:current,perDay,stages,target,eligibleStages:stages.filter(s=>s.pointsMet&&s.unlockConfirmed).map(s=>s.id),excludedMaterials:Object.keys(quantities).filter(id=>quantities[id]>0&&!used.has(id)),reasonCodes:copy(event.reasonCodes)};
 }
 return {normalizeGoal,quoteGoal,plan,scoreEvent};
});
