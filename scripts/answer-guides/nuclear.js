'use strict';
const assert=require('node:assert/strict');
const {copy,fill}=require('./copy');
const {project}=require('../nuclear-fuel-summary');
const runtime=require('../../js/nuclear-age');
const DATA=require('../../data/nuclear-age.json');
const REG=require('../../data/i18n/locales.json').locales;
function guides(locale,data=DATA){
 const c=copy(locale),loc=REG.find(l=>l.code===locale);assert(loc);
 const number=n=>new Intl.NumberFormat(loc.numberLocale).format(n),text=(key,values)=>fill(c[key],values);
 const all=project(data,'all'),tree=project(data,'tree'),power=all.buildings.find(b=>b.id===800005),raw=data.buildings.find(b=>b.id===800005);
 const route=`/${locale}/eras/nuclear-age/`,fuel=data.item.names[locale],links=[{label:c.calculator,href:route+'#nuclear-planner'}];
 const source=ids=>{const corrections=data.serviceOverrides.filter(o=>ids.includes(o.sourceId)).map(o=>({id:o.id,sourceId:o.sourceId,sourceValue:o.sourceValue,value:o.value,confirmedOn:o.confirmedOn}));return {file:'data/nuclear-age.json',recordIds:ids,version:data.client.version,capturedAt:data.client.capturedDate,verifiedAt:[data.client.capturedDate,...corrections.map(o=>o.confirmedOn)].sort().at(-1),serviceCorrections:corrections};};
 const state=level=>({normalLevel:all.baseLevel,nuclearLevel:level,completedSequence:level*all.stepsPerLevel,completion:'complete'});
 const model=(from,to,method,value,ids,extra={})=>({targetId:power.id,start:state(from),target:state(to),material:{id:data.item.id,unit:'item'},method,scope:{buildingIds:[power.id],prerequisitesIncluded:false},source:source(ids),status:value===null?'partial':value===0?'confirmed-zero':'confirmed',value,...extra});
 const answers=power.levels.filter(level=>level.cumulative.complete||level.incremental.complete).map(level=>({id:`power-plant-n${level.level}-fuel`,question:text('question',{level:level.level}),paragraphs:[...(level.cumulative.complete?[text('cumulativeAnswer',{base:number(all.baseLevel),level:level.level,total:number(level.cumulative.total)})]:[]),...(level.level>1&&level.incremental.complete?[text('incrementalAnswer',{previous:level.level-1,level:level.level,incremental:number(level.incremental.total)})]:[]),...(!level.cumulative.complete?[require('../../data/nuclear-fuel-copy.json').locales[locale].prerequisiteCostNote]:[])],model:level.cumulative.complete?model(0,level.level,'cumulative',level.cumulative.total,level.cumulative.sourceIds,{incremental:level.incremental.total,incrementalStart:state(level.level-1)}):model(level.level-1,level.level,'incremental',level.incremental.total,level.incremental.sourceIds,{cumulativeKnown:false}),links}));
 const first=raw.stages[0],firstLevels=power.levels[0];
 if(first.nuclearFuel!==null&&firstLevels.cumulative.complete)answers.push({id:'first-nuclear-upgrade',question:c.firstQuestion,paragraphs:[text('firstAnswer',{first:number(first.nuclearFuel),steps:raw.stages.slice(1,5).map(s=>number(s.nuclearFuel)).join(' + '),total:number(firstLevels.cumulative.total)})],model:{...model(0,1,'incremental',first.nuclearFuel,[first.sourceId]),target:{...state(1),completedSequence:1,completion:'first-substep'},source:{...source([first.sourceId]),verifiedAt:data.serviceOverrides.find(x=>x.sourceId===first.sourceId)?.confirmedOn||data.client.capturedDate},serviceCorrection:data.serviceOverrides.find(x=>x.sourceId===first.sourceId)?.id},links:[{label:fuel,href:route+'#nuclear-building-800005'}]});
 const n3=answers.find(a=>a.id==='power-plant-n3-fuel');
 if(n3)n3.table={caption:c.table+' · '+fuel,columns:['N',c.incremental,text('cumulative',{base:number(all.baseLevel)})],rows:power.levels.map(l=>['N'+l.level,l.incremental.complete?number(l.incremental.total):'—',l.cumulative.complete?number(l.cumulative.total):'—'])};
 for(const scope of [tree,all]){
  const values=scope.totals.filter(t=>t.cumulative.complete),last=values.at(-1);if(!last)continue;
  answers.push({id:`${scope.scope}-building-fuel-total`,question:require('../../data/nuclear-fuel-copy.json').locales[locale][scope.scope+'Title']+' · '+c.scopeQuestion,paragraphs:[text('scopeAnswer',{count:number(scope.buildingIds.length),base:number(scope.baseLevel),level:last.level,total:number(last.cumulative.total)}),text('notMinimum',{level:last.level})],model:{...model(0,last.level,'cumulative',last.cumulative.total,last.cumulative.sourceIds),targetId:scope.scope+'-buildings',scope:{buildingIds:scope.buildingIds,prerequisitesIncluded:false,minimumPath:false}},table:{caption:c.table+' · '+scope.buildings.map(b=>b.names[locale]).join(' / '),columns:['N',text('cumulative',{base:number(scope.baseLevel)})],rows:values.map(v=>['N'+v.level,number(v.cumulative.total)])},links:[{label:require('../../data/nuclear-fuel-copy.json').locales[locale][scope.scope+'Title'],href:route+'#nuclear-fuel-table'}]});
 }
 const config=[{id:power.id,stages:raw.stages.map(s=>({id:s.sourceId,fuel:s.nuclearFuel}))}],result=runtime.plan(config,power.id,5,15),held=1000;
 const example=result.complete?{title:c.example,paragraphs:[text('exampleAnswer',{from:1,to:3,held:number(held)}),text('exampleMath',{parts:power.levels.slice(1).map(l=>number(l.incremental.total)).join(' + '),required:number(result.knownFuel),held:number(held),missing:number(runtime.shortfall(result,held))})],model:model(1,3,'difference',runtime.shortfall(result,held),raw.stages.slice(5).map(s=>s.sourceId),{owned:held,required:result.knownFuel,illustrative:true}),links}:undefined;
 const override=data.serviceOverrides.find(x=>x.sourceId===first.sourceId);
 return [{route,kind:'nuclear',targetId:power.id,title:c.heading,answers,example,basis:{text:`${data.client.version} · ${data.client.capturedDate}. `+(override?text('change',{date:override.confirmedOn,first:number(override.value)}):''),links:[{label:data.official.releaseDate,href:locale==='ko'?data.official.ko:data.official.en}]}}];
}
module.exports={guides};
