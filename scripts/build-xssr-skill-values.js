'use strict';
// Display parameters follow the captured native RaidSkillLevelValue consumer.
// Only the explicit level profile is evaluated; account/rank/gear bonuses are
// never silently selected. Combat simulation is outside this module's scope.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createCapture,readLanguages}=require('./build-xssr-details');
const CONSUMER_RANGES=[{"method":"SurvivorSquadSkillUtils.ParseSquadSkillDescParams","methodIndex":62065,"address":78273580,"fileOffset":78257196,"bytes":944,"sha256":"cd301c467c440d26381b3003f86e8afb8cc845ea142ea8483847895bac0907eb"},{"method":"SurvivorSquadSkillUtils.FormatContent","methodIndex":62066,"address":78275212,"fileOffset":78258828,"bytes":1784,"sha256":"2fe51ecd0e6f9368a12aa3440357cf9c72e762df5f3ffe3f6a3a12e17676eda9"},{"method":"SurvivorSquadSkillUtils.GetSquadSkillDescription","methodIndex":62068,"address":78270484,"fileOffset":78254100,"bytes":704,"sha256":"c4c900ae007e4ede3ed96a57a6c375216756ac9f5b25b02af5ec394a4aaef41b"},{"method":"SurvivorSkillMainConfigCell.get_RaidSkillLevelValues","methodIndex":84919,"address":83755008,"fileOffset":83738624,"bytes":168,"sha256":"387ec067f59fc11b40c19a37296f854e3625b2e356f249d47ae434ddfea76d83"},{"method":"RaidSkillLevelValue.GetFinalValue","methodIndex":84934,"address":83758860,"fileOffset":83742476,"bytes":2456,"sha256":"830a1edfca3ae3c2d033af8c6d026f4ac11e3f4457f589d2526c1f975fb9ad9e"},{"method":"RaidUtils.RaidParseSkillParams","methodIndex":137023,"address":95928036,"fileOffset":95911652,"bytes":828,"sha256":"abd53ee146560caacbed2489ec03b6ba32a846540e15eab339d1561443c9212f"},{"method":"RaidUtils.GetRaidSkillLevelValues","methodIndex":137022,"address":95927796,"fileOffset":95911412,"bytes":240,"sha256":"1ded62458db7c0e0e87e1112b8f1542cc5d78b2e54784fa7838b93bdab0f6678"},{"method":"RaidUtils.RaidUpdateSkillValues","methodIndex":137024,"address":95928864,"fileOffset":95912480,"bytes":844,"sha256":"c62c175f55c106cc8e8e8f71b109921c6e5b914c9bc3c8fc2ad1125db59ea1b5"}];
const CONSUMER_MANIFEST_SHA256='21fc952d96831c5e8dc39657d01e9cbf71673e5dccffef3f808cb697008b5434';
const TABLES={pve_effect:'pve_new_effect',pve_buff:'pve_new_buff'};
const FIELDS={effect_param2:'EffectParam2',effect_param3:'EffectParam3',time:'Time',param1:'Param1',param2:'Param2',param3:'Param3'};
const decimal=n=>String(Number(n.toFixed(10)));
function formatParameter(value,type){
 assert(Number.isFinite(value),'Unresolved parameter value');
 switch(type){
  case '0':return decimal(value);
  case '2':return decimal(value/1000);
  case '5':return decimal(value/10);
  case '6':return decimal(value/100);
  case '10':return decimal(value/10)+'%';
  case '11':return decimal(value/-10)+'%';
  default:throw new Error('Unreviewed parameter format '+type);
 }
}
function parseModifiers(level){
 const ordered=[],map=new Map();
 for(const [property,slot]of [['RaidSkillParam_1',0],['RaidSkillParam_2',1]]){
  for(const raw of level[property]||[]){
   // The native parser catches a null entry and stops that list. Later list
   // entries must not be moved to fill holes or used as display parameters.
   if(raw===null)break;
   const p=raw.split('|');assert(p.length===4||p.length===5,'Unreviewed modifier shape');
   const [table,id,field]=p,index=p.length===5?Number(p[3]):-1,coefficient=Number(p.at(-1));
   assert(TABLES[table]&&FIELDS[field]&&Number.isInteger(index)&&index>=-1&&Number.isFinite(coefficient),'Unreviewed modifier '+raw);
   const key=JSON.stringify([table,id,field,index]);let item=map.get(key);
   if(!item){item={table,id,field,index,multiplier:1,addend:0};map.set(key,item);ordered.push(item);}
   item[slot===0?'multiplier':'addend']=coefficient;
  }
 }
 return ordered;
}
function buildSkillValues(capture,languageInput){
 const allHeroes=capture.table('survivor'),types=capture.table('survivor_skill_type'),main=capture.table('survivor_skill_main');
 const maps=Object.fromEntries(Object.entries(TABLES).map(([alias,name])=>[alias,new Map(capture.table(name).map(r=>[r.Id,r]))]));
 const skills={},heroSkills={},joins=[];
 for(const entry of require('../data/xssr-heroes.json').heroes){
  const hero=allHeroes.find(r=>r.Id==='survivor_'+entry.id);assert(hero,'Missing bound hero '+entry.id);const heroId=hero.InternalId;heroSkills[heroId]=hero.SkillConfig.map(r=>r.key);
  for(const {key:id}of hero.SkillConfig){
   const skill=types.find(r=>r.InternalId===id);assert.equal(skill.Survivor.internalId,heroId);
   const templates=Object.values(languageInput.languages).map(l=>l[skill.DescriptionSquad]).filter(Boolean);
   assert(templates.length,'No captured description template');
   const slots=[...new Set(templates.flatMap(t=>[...t.matchAll(/\{(\d+)\}/g)].map(m=>Number(m[1]))))].sort((a,b)=>a-b);
   assert.deepEqual(slots,Array.from({length:slots.length},(_,i)=>i),'Noncontiguous template slots');
   const descriptors=skill.PveSkillParam.split(',').map(x=>x.split('|'));assert(descriptors.length>=slots.length);
   const levels={},numericLevels={},levelRows={};
   for(const level of main.filter(r=>r.SkillType?.internalId===id).sort((a,b)=>a.Level-b.Level)){
    const modifiers=parseModifiers(level),params=[],numbers=[];
    for(const slot of slots){
     const [mode,format,index,formula]=descriptors[slot];assert.equal(mode,'0');assert.equal(formula,'0','Context-dependent benefit formula must remain withheld');
     const modifier=modifiers[Number(index)];assert(modifier,'Missing required level modifier');
     const source=maps[modifier.table].get(modifier.id);assert(source,'Missing source row '+modifier.id);
     const field=FIELDS[modifier.field],raw=source[field];
     const base=Array.isArray(raw)?raw[modifier.index]:raw;
     assert(Number.isSafeInteger(base),'Unresolved/non-integer underlying effect field');
     const value=base*modifier.multiplier+modifier.addend;
     params.push(formatParameter(value,format));numbers.push({value:Number(value.toFixed(10)),format});
     joins.push({heroId,skillId:id,level:level.Level,slot,levelRowId:level.InternalId,table:TABLES[modifier.table],rowId:source.InternalId,field,arrayIndex:Array.isArray(raw)?modifier.index:null,base,multiplier:modifier.multiplier,addend:modifier.addend,format});
    }
    levels[level.Level]=params;numericLevels[level.Level]=numbers;levelRows[level.Level]=level.InternalId;
   }
   skills[id]={heroId,descriptionKey:skill.DescriptionSquad,levels,numericLevels,levelRows};
  }
 }
 return {schemaVersion:1,version:capture.version,profile:'configured-skill-level-without-rank-or-gear-bonuses',heroSkills,skills,sources:capture.sources,indexSHA256:capture.indexSHA256,consumer:{version:'2.6.200',build:1512,privateManifestSHA256:CONSUMER_MANIFEST_SHA256,methodRanges:CONSUMER_RANGES,rangeLimit:'Bounded by the next mapped method, not asserted exact function size.',methods:['SurvivorSquadSkillUtils.ParseSquadSkillDescParams','SurvivorSquadSkillUtils.FormatContent','RaidUtils.GetRaidSkillLevelValues','RaidUtils.RaidParseSkillParams','RaidUtils.RaidUpdateSkillValues','RaidSkillLevelValue.GetFinalValue'],scope:'Static normal consumer; current server/account activation and patched runtime are not inferred.',displayPolicy:'Exact configured values with at most ten decimal places; client cosmetic rounding is not simulated.'},joins};
}
if(require.main===module){
 const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];assert(args.includes('--source')&&args.includes('--languages'),'Usage: --source CAPTURE --languages DICTIONARIES [--out FILE]');
 const result=buildSkillValues(createCapture(get('--source')),readLanguages(get('--languages'))),out=path.resolve(args.includes('--out')?get('--out'):path.join(__dirname,'../data/xssr-skill-values.json'));
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({skills:Object.keys(result.skills).length,levels:Object.values(result.skills).reduce((n,s)=>n+Object.keys(s.levels).length,0),parameters:result.joins.length}));
}
module.exports={buildSkillValues,parseModifiers,formatParameter};
