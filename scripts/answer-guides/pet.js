'use strict';
// Read-only answer projections. Numeric effects are retained descriptions, never
// recomputed damage estimates. Recommendations retain their conditional rules.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../../data/v4-formation.json'),S=require('../../data/pet-skill-levels.json'),P=require('../../data/content-60/pets-phase2/model.json');
const MathPet=require('../../js/v4-formation-math'),Cards=require('../hero-guide-pet-cards'),X=require('../lib/xssr-catalog');
const C=require('../../data/answer-guide-pet-copy.json').locales,F=require('../../data/v4-formation-copy.json').locales,H=require('../../data/hero-guide-copy.json').locales;
const L=require('../lib/global-localization'),registry=require('../../data/i18n/locales.json').locales;
const templates=new Map(),terms=require('../../data/i18n/client-terms.json').terms;
let convertChinese;
function text(template,values){return template.replace(/\{(\w+)\}/g,(_,k)=>{assert(Object.hasOwn(values,k),'Missing pet answer binding '+k);return String(values[k]);});}
function name(entity,locale){const value=entity?.names?.[locale]?.value||entity?.names?.[locale];assert(typeof value==='string'&&value.trim(),'Missing pet answer official name '+locale);return value;}
function description(values,locale){
 if(values[locale])return values[locale];
 if(locale==='zh-cn'){
  const exact=Object.values(terms).find(t=>t['zh-tw']===values['zh-tw']&&t['zh-cn']);
  if(exact)return exact['zh-cn'];
  convertChinese ||= require('opencc-js').Converter({from:'tw',to:'cn'});
  return convertChinese(values['zh-tw']);
 }
 if(!templates.has(locale)){const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../../data/i18n/messages',locale+'.json'),'utf8'));templates.set(locale,L.createTranslator(locale,catalog));}
 const translator=templates.get(locale),out=translator.translate(values.en,'answer-guide:pet-effect');
 assert.equal(translator.missing.size,0,'Untranslated pet effect '+locale);assert.equal(translator.errors.length,0,'Pet effect numeric/placeholder translation drift '+locale);return out;
}
function selectedRules(pet){
 const seen=new Set();return M.rules.filter(r=>r.petId===pet.id).filter(r=>{const key=r.reasonKey+'|'+(r.requiredRow||'');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,3);
}
function ruleCondition(rule,locale){const copy=H[locale];return rule.conditionKeys.map(k=>{assert(copy.conditions[k]);return copy.conditions[k];}).join(' ');}
function ruleInput(rule,pet){const input=MathPet.emptyInput(M);input[rule.requiredRow==='back'?'back':'front'][0]=rule.heroId;input.petStates[pet.id]={owned:true,trainStage:Cards.requiredStage(rule)};input.petId=pet.id;input.heroSkillsUnlocked=true;return input;}
function guides(locale){
 const lang=registry.find(l=>l.code===locale);assert(lang&&C[locale]&&F[locale]&&H[locale],'Unsupported pet guide locale');
 const c=C[locale],f=F[locale],h=H[locale],nf=new Intl.NumberFormat(lang.numberLocale),fmt=n=>nf.format(n);
 return M.pets.map(pet=>{
  const retained=S.pets.find(p=>p.id===pet.id),phase=P.pets.find(p=>p.id===pet.id),source=retained||phase;assert(source,'Missing pet effect source');
  const sourceFile=retained?'data/pet-skill-levels.json':'data/content-60/pets-phase2/model.json',petName=name(pet,locale),route=`/${locale}/database/pet-system/${pet.id}/`;
  const skills=source.skills.map(skill=>{
   const ref=pet.skills.find(s=>s.slot===skill.slot);assert(ref);assert.equal(ref.unlockStage,skill.unlockStage,'Pet training unlock disagreement');
   const row=skill.levels.find(r=>r.level===1)||null;
   if(row){assert.equal(row.trainingStage,skill.unlockStage);assert.equal(MathPet.petSkillStates(pet,{owned:true,trainStage:skill.unlockStage}).find(s=>s.slot===skill.slot).state,'configured-unlocked');}
   return {ref,skill,row,effect:row?description(row.description,locale):f.ui.unknown};
  });
  const first=skills.find(s=>s.row);assert(first);
  const rules=selectedRules(pet);
  for(const r of rules){const result=MathPet.analyze(ruleInput(r,pet),M);assert(result.valid);const ground=result.candidates.find(g=>g.heroId===r.heroId&&g.petId===pet.id)?.grounds.find(g=>g.id===r.id);assert(ground&&ground.blockers.length===0,'Recommendation does not meet its own configured gates');}
  const growth=MathPet.petGrowth(pet.id,1,2,0,2,M),materialNames=growth.materials.map(m=>`${name(M.items.find(i=>i.clientId===m.itemId),locale)} × ${fmt(BigInt(m.quantity))}`).join(' · ');
  const heroLabel=r=>{const hero=M.heroes.find(x=>x.id===r.heroId),release=X.record(r.heroId)?.release.status;return name(hero,locale)+(release&&release!=='released'?' ('+X.copy(locale)[release]+')':'');};
  const reason=r=>{
   // Chompy's deployed-hero Attack rule has no fixed-row requirement. Do not
   // reuse the generic front/back-row sentence for that all-squad effect.
   if(r.reasonKey==='position-attack-scaling'&&!r.requiredRow){const skill=skills.find(s=>r.petSkillIds.includes(s.ref.clientId)&&s.row);assert(skill);return skill.effect+' '+h.conditions['attack-modifier-applies'];}
   return h.reasons[r.reasonKey];
  };
  const effectAnchor=retained?'pet-skill-1-41':'pet-skills';
  return {route,kind:'pet',targetId:pet.id,title:text(c.title,{pet:petName}),answers:[
   {id:pet.id+'-effects-and-unlocks',question:text(c.effectsQuestion,{pet:petName}),paragraphs:[text(c.effectLead,{pet:petName,skill:name(first.ref,locale),level:fmt(first.row.level),effect:first.effect}),c.trainingNote],
    model:{targetId:pet.clientId,start:{trainingStage:0},target:{skillLevel:1},material:{id:null,unit:'skill-effect'},method:'effect',scope:{queryClass:'expected-search-question',skillSlots:skills.map(s=>s.ref.slot),unlockStages:skills.map(s=>s.ref.unlockStage),unknownSlots:skills.filter(s=>!s.row).map(s=>s.ref.slot),serverAvailabilityVerified:false},source:{file:sourceFile,recordIds:skills.map(s=>`${pet.id}:slot:${s.ref.slot}:`+(s.row?'level:1':'description-held')),version:S.gameVersion},status:skills.every(s=>s.row)?'confirmed':'partial'},
    table:{caption:text(c.effectsQuestion,{pet:petName}),columns:[h.ui.skills,c.skillLevel,h.ui.unlockStage,c.effect],rows:skills.map(s=>[name(s.ref,locale),s.row?fmt(s.row.level):f.ui.unknown,fmt(s.ref.unlockStage),s.effect])},links:[{label:h.ui.skillDetails,href:route+'#'+effectAnchor}]},
   {id:pet.id+'-recommended-heroes',question:text(c.recommendQuestion,{pet:petName}),paragraphs:rules.length?rules.map(r=>text(c.recommendLead,{hero:heroLabel(r),reason:reason(r)})).concat(f.cautions['no-performance-estimate']):[c.noRecommendation],
    model:{targetId:pet.clientId,start:{owned:true},target:{mode:'squad'},material:{id:null,unit:'conditional-recommendation'},method:'effect',scope:{queryClass:'expected-search-question',editorial:true,ranked:false,ruleIds:rules.map(r=>r.id),rows:rules.map(r=>r.requiredRow),minimumTrainingStages:rules.map(Cards.requiredStage),heroAndPetSkillsRequired:true,serverAvailabilityVerified:false},source:{file:'data/v4-formation.json',recordIds:rules.map(r=>r.id),version:rules.some(r=>r.origin==='xssr-client-2.6.300')?'2.6.200 + 2.6.300':M.version.game,verifiedAt:M.version.reviewedOn},status:'partial'},
    ...(rules.length?{table:{caption:text(c.recommendQuestion,{pet:petName}),columns:[f.ui.hero,h.ui.unlockStage,h.ui.conditions],rows:rules.map(r=>[heroLabel(r),fmt(Cards.requiredStage(r)),ruleCondition(r,locale)])}}:{}),
    links:[{label:h.ui.formation,href:`/${locale}/tools/#v4-formation`},{label:h.ui.allHeroes,href:route+'#hero-pet-reference'},...rules.map(r=>({label:heroLabel(r),href:M.heroes.find(h=>h.id===r.heroId).routes[locale]+'#hero-pet-connections'}))]},
   {id:pet.id+'-growth-example',question:text(c.exampleTitle,{fromLevel:fmt(1),toLevel:fmt(2),fromStage:fmt(0),toStage:fmt(2)}),paragraphs:[text(c.growthExample,{pet:petName,exp:fmt(BigInt(growth.experience)),materials:materialNames,fromLevel:fmt(1),toLevel:fmt(2),fromStage:fmt(0),toStage:fmt(2)})],
    model:{targetId:pet.clientId,start:{level:1,trainingStage:0},target:{level:2,trainingStage:2},material:{id:'pet-experience',unit:'EXP'},method:'incremental',scope:{queryClass:'expected-search-question',example:true,independentProgressions:true,wholeTrainingStagesOnly:true,trainingMaterials:growth.materials},source:{file:'data/v4-formation.json',recordIds:[...pet.evidenceRefs,...pet.stages.slice(0,2).flatMap(s=>s.evidenceRefs)],version:M.version.game,verifiedAt:M.version.reviewedOn},status:'confirmed',value:Number(growth.experience)},
    table:{caption:f.ui.growth,columns:[c.growthRange,c.growthCost],rows:[[f.ui.fromLevel+' '+fmt(1)+' → '+fmt(2),fmt(BigInt(growth.experience))+' EXP'],[f.ui.trainingStage+' '+fmt(0)+' → '+fmt(2),materialNames]]},links:[{label:h.ui.growthCalculator,href:`/${locale}/tools/#v4-formation`}]}
  ],basis:{text:`${M.version.game} · ${f.messages['retained-only']} ${f.messages['skill-learned-unverified']}`,links:[{label:h.ui.petDirectory,href:`/${locale}/database/pet-system/`}]}};
 });
}
module.exports={guides,selectedRules,ruleInput,description};
