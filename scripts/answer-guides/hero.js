'use strict';
const assert=require('node:assert/strict');
const Data=require('../xssr-details-data'),Detail=require('../xssr-detail-content'),Catalog=require('../lib/xssr-catalog');
const Copy=require('../../data/answer-guide-hero-copy.json'),Math=require('./hero-math');
const clean=s=>String(s??'').replace(/<[^>]*>/g,'').trim();
function text(template,params){return template.replace(/\{(\w+)\}/g,(_,key)=>{assert(Object.hasOwn(params,key),'Missing hero copy parameter '+key);return String(params[key]);});}
function local(values,locale){return values?.[locale]||values?.en||null;}
function item(id,h,locale,u){return local(Data.data.items[id]?.names,locale)||Data.name(h.id,locale)+' · '+(id===h.growth.fragmentItemId?u.fragments:u.parts);}
function source(version,recordIds,file='data/xssr-details.json'){return{file,recordIds,version:{game:version.game,build:version.build},verifiedAt:version.reviewedOn};}
function costModel(h,p,kind,from,to,result,materialId,scope){
 return{targetId:h.clientId,start:{[kind]:from},target:{[kind]:to},material:{id:materialId,unit:'item'},method:from===0?'cumulative':'difference',scope,
  source:source(p.version,result.recordIds),status:result.status,...(result.value===null?{knownSubtotal:result.knownSubtotal,unknownRecordIds:result.unknownRecordIds}:{value:result.value})};
}
function guides(locale){
 const c=Copy.locales[locale];assert(c,'Missing hero answer locale '+locale);const u=Detail.copy(locale).ui,n=v=>new Intl.NumberFormat(locale).format(v),t=(key,p)=>text(c[key],p);
 return Data.heroes().map(h=>{
  const p=Math.projectHero(h.id),hero=Data.name(h.id,locale),route='/'+locale+'/heroes/'+h.id+'/',material=item(h.growth.fragmentItemId,h,locale,u),gearMaterial=item(h.exclusiveGear.fragmentItemId,h,locale,u),manual=item(201725,h,locale,u);
  // The answer's scope is fixed by the explicit source hero, never by rarity.
  const rankScope={heroId:h.id,recruitmentExcluded:true,wholeCompletedStages:true,partialStageProgressDeducted:false,visualStarMappingVerified:false};
  const first=p.growth.slice(0,3),rank=Math.rankRange(h,0,3),link=(label,anchor)=>({label,href:route+'#'+anchor});
  const display=r=>r.value===null?c.unknown:n(r.value),levelMax=h.exclusiveGear.levels.at(-1).level;
  const answers=[{
   id:'answer-'+h.id+'-growth-stages',question:t('growthQuestion',{hero,first:n(1),last:n(3)}),
   paragraphs:[t('growthAnswer',{first:n(1),second:n(2),last:n(3),firstCost:display(first[0].incremental),secondCost:display(first[1].incremental),lastCost:display(first[2].incremental),material,total:display(rank),steps:n(first[0].steps)}),c.starCaution,t('recruitmentNote',{recruit:n(h.recruitment.cost.quantity),material}),u.universalNote],
   model:{...costModel(h,p,'completedGrowthStage',0,3,rank,h.growth.fragmentItemId,rankScope),recruitment:{itemId:h.recruitment.cost.itemId,quantity:h.recruitment.cost.quantity,included:false},universalConversion:{...h.growth.universalFragment,consumer:undefined}},
   table:{caption:c.stage+' · '+material,columns:[c.stage,c.incremental,u.cumulative],rows:first.map(r=>[n(r.rank),display(r.incremental),display(r.cumulative)])},links:[link(u.calculator,h.id+'-growth')]
  }];
  const skill=p.skills[0].skill,skillMax=skill.configuredLevelRange.max,skillTotal=p.skills[0].total;
  assert(p.skills.every(s=>s.total.status===skillTotal.status&&s.total.value===skillTotal.value),'Individual skill costs require separate wording');
  answers.push({id:'answer-'+h.id+'-skill-manuals',question:t('skillQuestion',{hero,from:n(1),to:n(skillMax)}),paragraphs:[t('skillAnswer',{count:n(p.skills.length),value:display(skillTotal),material:manual,from:n(1),to:n(skillMax)}),t('skillScope',{slot:n(h.skills.find(s=>s.automaticUpgrade).slot+1)})],
   model:{...costModel(h,p,'skillLevel',1,skillMax,skillTotal,201725,{perSkill:true,automaticSkillExcluded:true,liveUnlockVerified:false}),skillIds:p.skills.map(s=>s.skill.clientId),source:source(p.version,p.skills.flatMap(s=>s.total.recordIds))},
   table:{caption:u.skillCosts,columns:[u.skills,u.level,manual],rows:p.skills.map(s=>[Detail.skillName(h,s.skill,locale),'1 → '+n(s.skill.configuredLevelRange.max),display(s.total)])},links:[link(u.skillCosts,h.id+'-growth'),link(u.skills,h.id+'-skills')]});
  const effects=[1,skillMax].map(level=>Detail.skillText(h,skill,level,locale)),effectKnown=effects.every(Boolean);
  answers.push({id:'answer-'+h.id+'-skill-effect',question:t('effectQuestion',{skill:Detail.skillName(h,skill,locale)}),paragraphs:[effects[0]||c.unknown,c.effectScope],
   model:{targetId:skill.clientId,start:{skillLevel:1},target:{skillLevel:skillMax},material:{id:null,unit:'native-description-units'},method:'effect',scope:{heroId:h.clientId,profile:skill.numericEffects.profile,growthAndGearBonusesIncluded:false},source:source(p.version,[skill.clientId,skill.clientRefs.raidNewSkillId,skill.clientRefs.slgSkillId],'data/xssr-skill-values.json'),status:effectKnown?'confirmed':'partial',parameters:[1,skillMax].map(level=>({level,values:Data.skillParameters(h.id,skill.clientId,level)}))},
   table:{caption:Detail.skillName(h,skill,locale),columns:[u.level,c.effects],rows:effects.map((effect,i)=>[n(i?skillMax:1),effect||c.unknown])},links:[link(u.skills,h.id+'-skills')]});
  answers.push({id:'answer-'+h.id+'-gear-cost',question:t('gearQuestion',{hero,from:n(1),to:n(levelMax)}),paragraphs:[t('gearAnswer',{from:n(1),to:n(levelMax),value:display(p.gear.fromOne),material:gearMaterial}),t('gearNote',{first:n(1),firstCost:n(h.exclusiveGear.levels[0].cost.quantity),last:n(levelMax),total:display(p.gear.total)})],
   model:{...costModel(h,p,'gearLevel',1,levelMax,p.gear.fromOne,h.exclusiveGear.fragmentItemId,{heroId:h.id,acquisitionExcluded:true,onlySelectedGear:true}),examples:[costModel(h,p,'gearLevel',10,levelMax,p.gear.example,h.exclusiveGear.fragmentItemId,{onlySelectedGear:true}),costModel(h,p,'gearLevel',10,10,p.gear.unchanged,h.exclusiveGear.fragmentItemId,{onlySelectedGear:true})]},
   table:{caption:u.gear+' · '+gearMaterial,columns:[u.fromLevel,u.toLevel,u.quantity],rows:[[n(0),n(levelMax),display(p.gear.total)],[n(1),n(levelMax),display(p.gear.fromOne)],[n(10),n(levelMax),display(p.gear.example)]]},links:[link(u.calculator,h.id+'-gear')]});
  const gearRows=[h.exclusiveGear.levels[0],h.exclusiveGear.levels.at(-1)],knownGear=gearRows.every(r=>['attack','defense','health','power'].every(k=>Number.isSafeInteger(r[k])));
  const gearEffect=r=>{const native=Data.gearEffect(h.id,r.level,locale);if(native&&!['ar','vi','nb'].includes(locale))return clean(native);const values=r.skillDisplayParameters||[],percent=v=>v==null?c.unknown:String(v).includes('%')?v:v+'%';return u.attack+' +'+percent(values[0])+' · '+u.defense+' +'+percent(values[1]??values[0]);};
  answers.push({id:'answer-'+h.id+'-gear-effect',question:t('gearEffectQuestion',{from:n(1),to:n(levelMax)}),paragraphs:[gearEffect(gearRows[1])],
   model:{targetId:h.exclusiveGear.clientId,start:{gearLevel:1},target:{gearLevel:levelMax},material:{id:null,unit:'attribute-points-and-native-effect-units'},method:'effect',scope:{heroId:h.clientId,onlySelectedGear:true},source:source(p.version,gearRows.map(r=>r.clientRowId)),status:knownGear?'confirmed':'partial',attributes:gearRows.map(r=>({level:r.level,attack:r.attack,defense:r.defense,health:r.health,power:r.power,effectParameters:r.skillDisplayParameters}))},
   table:{caption:u.gear,columns:[u.level,u.attack,u.defense,u.health,u.power,u.gearSkill],rows:gearRows.map(r=>[n(r.level),...['attack','defense','health','power'].map(k=>Number.isSafeInteger(r[k])?n(r[k]):c.unknown),gearEffect(r)])},links:[link(u.gear,h.id+'-gear')]});
  const release=Catalog.record(h.id)?.release;
  for(const answer of answers){answer.model.scope.releaseStatus=release?.status||'unverified';answer.model.scope.liveServerUnlockVerified=false;}
  return{route,kind:'hero-growth',targetId:h.clientId,title:t('title',{hero}),answers,example:{title:c.exampleTitle,paragraphs:[t('growthExample',{from:n(3),to:n(p.growth.length),value:display(p.growthExample),material}),t('skillExample',{skill:Detail.skillName(h,skill,locale),from:n(1),to:n(10),value:display(p.skills[0].example),material:manual}),t('gearExample',{from:n(10),to:n(levelMax),value:display(p.gear.example),material:gearMaterial,same:n(10),zero:display(p.gear.unchanged)})],links:[link(u.calculator,h.id+'-growth'),link(u.gear,h.id+'-gear')]},basis:{text:t('basis',{version:p.version.game,build:p.version.build,date:p.version.reviewedOn})+(release?.status!=='released'?' '+c.preview:''),links:[{label:u.atlas,href:'/'+locale+'/heroes/'}]}};
 });
}
module.exports={guides,projectHero:Math.projectHero};
