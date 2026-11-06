'use strict';
// One-unit base scores come from the same configured profiles as the live tool.
// A points threshold is kept separate from chest unlocks and actual eligibility.
const assert=require('node:assert/strict'),M=require('../../data/v4-economy.json'),MathEvent=require('../../js/v4-economy-math');
const C=require('../../data/answer-guide-event-copy.json').locales,E=require('../../data/v4-economy-copy.json').locales;
const registry=require('../../data/i18n/locales.json').locales,terms=require('../../data/i18n/client-terms.json').terms;
function text(template,values){return template.replace(/\{(\w+)\}/g,(_,k)=>{assert(Object.hasOwn(values,k),'Missing event answer binding '+k);return String(values[k]);});}
function input(profile,day,extra={}){return {eventId:'alliance-duel',profileId:profile.id,day:day.day,quantities:{},currentPoints:0,unlockedBoxGroups:[],...extra};}
function minimumQuantity(model,request,materialId){
 const empty=MathEvent.scoreEvent(model,{...request,quantities:{}});assert(empty.target,'An exact target stage is required');
 const one=MathEvent.scoreEvent(model,{...request,quantities:{[materialId]:1}});assert(Number.isSafeInteger(one.basePoints)&&one.basePoints>0,'Selected material does not score on this day');
 const quantity=Math.ceil(empty.target.pointShortage/one.basePoints);assert(Number.isSafeInteger(quantity),'Unsafe quantity');
 const result=MathEvent.scoreEvent(model,{...request,quantities:{[materialId]:quantity}}),previousQuantity=Math.max(0,quantity-1),previous=MathEvent.scoreEvent(model,{...request,quantities:{[materialId]:previousQuantity}});
 assert.equal(result.target.pointShortage,0);if(quantity>0)assert(previous.target.pointShortage>0,'Quantity must be the smallest whole unit that reaches the threshold');
 return {quantity,rate:one.basePoints,result,previousQuantity,previous};
}
function dayGroups(event){
 const groups=new Map();for(const profile of event.profiles)for(const day of profile.days){const key=JSON.stringify({day:day.day,rules:day.rules,stages:day.stages,excludedTaskCount:day.excludedTaskCount});if(!groups.has(key))groups.set(key,{day,profiles:[]});groups.get(key).profiles.push(profile);}
 return [...groups.values()];
}
function guides(locale){
 const language=registry.find(l=>l.code===locale);assert(language&&C[locale]&&E[locale],'Unsupported event guide locale');
 const c=C[locale],e=E[locale],nf=new Intl.NumberFormat(language.numberLocale),fmt=n=>nf.format(n),event=M.events.find(x=>x.id==='alliance-duel');assert(event);
 const eventName=terms.new_tree_1v1_duel_name[locale]||terms.new_tree_1v1_duel_name.en;
 const profileName=profile=>{const label={'season-1':e.labels.season1,'season-2-cross':e.labels.season2}[profile.id];assert(label,'Unreviewed event profile');return label;};
 const source=recordIds=>({file:'data/v4-economy.json',recordIds,version:M.gameVersion,verifiedAt:M.reviewedOn});
 const answers=dayGroups(event).map(({day,profiles})=>{
  const profile=profiles[0],names=profiles.map(profileName).join(' / '),first=day.rules[0];assert(first,'No scoring actions to answer');
  const material=id=>{const item=M.materials.find(m=>m.id===id);assert(item&&['count','minutes'].includes(item.unit));return item;};
  const rows=day.rules.map(rule=>{const m=material(rule.materialId),score=MathEvent.scoreEvent(M,input(profile,day,{quantities:{[m.id]:1}}));assert.equal(score.basePoints,rule.points);return [m.names[locale],fmt(score.basePoints)];});
  const sentence=text(c.pointSentence,{event:eventName,profiles:names,day:fmt(day.day),action:material(first.materialId).names[locale],points:fmt(first.points)});
  return {id:'vs-'+profiles.map(p=>p.id).join('-and-')+'-day-'+day.day+'-base-points',question:text(c.question,{day:fmt(day.day),theme:day.names[locale]}),paragraphs:[sentence,...(profiles.length>1?[text(c.sharedProfiles,{profiles:names})]:[]),e.reasons.eventBaseOnly],
   model:{targetId:event.id,start:{points:0},target:{day:day.day},material:{id:null,unit:'points-per-listed-action-unit'},method:'effect',scope:{queryClass:'expected-search-question',profiles:profiles.map(p=>p.id),eventDay:day.day,weekday:null,baseOnly:true,personalBonusesIncluded:false,listedActionsOnly:true,units:day.rules.map(r=>({materialId:r.materialId,unit:material(r.materialId).unit,quantity:1,points:r.points})),currentServerProfileVerified:false},source:source([...profiles.map(p=>p.clientId),...profiles.map(p=>p.days.find(d=>d.day===day.day).clientId),...day.rules.map(r=>r.id)]),status:'confirmed'},
   table:{caption:text(c.tableCaption,{event:eventName,profiles:names,day:fmt(day.day)}),columns:[c.action,e.labels.points],rows},links:[{label:e.labels.vsTitle,href:`/${locale}/tools/#v4-vs`}]};
 });
 const profile=event.profiles.find(p=>p.id==='season-1'),day=profile.days.find(d=>d.day===4),rule=day.rules.find(r=>r.materialId==='survivor_chip_5'),target=day.stages.find(s=>s.unlockFunctionId===null);assert(rule&&target);
 const material=M.materials.find(m=>m.id===rule.materialId),q=minimumQuantity(M,input(profile,day,{targetStage:target.id}),material.id);
 const vars={current:fmt(0),target:fmt(target.points),quantity:fmt(q.quantity),action:material.names[locale],total:fmt(q.result.totalPoints),rate:fmt(q.rate),previousQuantity:fmt(q.previousQuantity),previousTotal:fmt(q.previous.totalPoints)};
 answers.push({id:'vs-season-1-day-4-target-example',question:text(c.exampleTitle,vars),paragraphs:[`${eventName} · ${profileName(profile)} · ${e.labels.day} ${fmt(day.day)} · ${day.names[locale]}`,text(c.example,vars),text(c.rounding,vars),e.reasons.eventBaseOnly,e.reasons.eventUnlockUnverified],
  model:{targetId:event.id,start:{points:0,quantity:0},target:{day:day.day,points:target.points,rewardStageId:target.id},material:{id:material.id,unit:material.unit},method:'ceiling',scope:{queryClass:'expected-search-question',example:true,profileId:profile.id,baseOnly:true,currentServerProfileVerified:false,bonusMultiplier:1,chestUnlockGuaranteed:false,rewardGroupId:target.groupId,unlockFunctionId:target.unlockFunctionId,previousQuantity:q.previousQuantity,previousTotal:q.previous.totalPoints,total:q.result.totalPoints,perUnit:q.rate},source:source([profile.clientId,day.clientId,rule.id,target.id,target.groupId]),status:q.quantity===0?'confirmed-zero':'confirmed',value:q.quantity},
  table:{caption:text(c.exampleTitle,vars),columns:[c.action,e.labels.quantity,e.labels.points],rows:[[material.names[locale],fmt(q.previousQuantity),fmt(q.previous.totalPoints)],[material.names[locale],fmt(q.quantity),fmt(q.result.totalPoints)]]},links:[{label:e.labels.vsTitle,href:`/${locale}/tools/#v4-vs`}]});
 return [{route:`/${locale}/events/calendar/`,kind:'event',targetId:event.id,title:text(c.title,{event:eventName}),answers,basis:{text:`${M.gameVersion} · ${e.reasons.eventProfileUnverified} ${e.reasons.eventScheduleUnknown} ${e.reasons.eventExcludedActions} ${e.reasons.eventUnlockUnverified}`,links:[{label:e.labels.vsTitle,href:`/${locale}/tools/#v4-vs`}]}}];
}
module.exports={guides,dayGroups,minimumQuantity};
