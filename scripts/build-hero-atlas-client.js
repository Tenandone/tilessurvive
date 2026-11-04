'use strict';
// Read-only retained-client extractor. Never reads game accounts or live servers.
// Usage: node scripts/build-hero-atlas-client.js --corpus <foundation-40-directory>
// Only data/hero-atlas-client.json is written. Private paths are never published.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const registry=require('../data/i18n/locales.json').locales.map(x=>x.code);
const aliases={ken:'chef-ken',freja:'freya',becca:'beka',layla:'laila',maddie:'maddy',tim:'ghost',wright:'light',tithi:'kiki',chiron:'kiron',ragnar:'lagnar'};
const languageMap={'zh-cn':'zh-CN','zh-tw':'zh-TW',ms:'my'};
const missingLocales=new Set(['ar','vi','nb']);
const ref=x=>x?.internalId||0;
const take=(obj,fields)=>Object.fromEntries(fields.filter(k=>Object.hasOwn(obj,k)).map(k=>[k,obj[k]]));
function extract(corpus){
  const tables=path.join(corpus,'normalized-complete-v1','tables');
  const sourceFiles={},cache=new Map(),languages={},languageSources={};
  function file(rel){const bytes=fs.readFileSync(path.join(corpus,rel));sourceFiles[rel]={sha256:sha(bytes),bytes:bytes.length};return bytes;}
  function load(name){
    if(cache.has(name))return cache.get(name);
    const rel='normalized-complete-v1/tables/'+name+'.jsonl';
    const rows=file(rel).toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
    for(const row of rows){
      if(row.conditions?.gameVersion!=='2.6.200'||row.conditions?.gameBuild!==1512)throw Error('Unexpected retained version in '+name);
      row._table=name;row._copies=[name];
    }
    sourceFiles[rel].rows=rows.length;
    sourceFiles[rel].sourcePayloadSHA256=rows[0]?.provenance.sourceSha256||null;
    cache.set(name,rows);return rows;
  }
  function family(name){
    const by=new Map();
    for(const f of fs.readdirSync(tables).filter(f=>f===name+'.jsonl'||new RegExp('^'+name+'_\\d+\\.jsonl$').test(f)).sort()){
      for(const row of load(f.slice(0,-6))){
        const k=[row.recordKey,row.valuesSha256,row.conditionsSha256].join(':');
        if(by.has(k)){by.get(k)._copies.push(row._table);continue;}by.set(k,row);
      }
    }
    return [...by.values()];
  }
  function evidence(r,fields=[]){return {table:r._table,recordKey:r.recordKey,internalId:r.rawValues.InternalId,sourceId:r.rawValues.Id,sourceSHA256:r.provenance.sourceSha256,valuesSHA256:r.valuesSha256,conditionsSHA256:r.conditionsSha256,sourceRowIndex:r.provenance.recordIndex,fields,copies:[...new Set(r._copies)].sort()};}
  for(const locale of registry){
    if(missingLocales.has(locale))continue;
    const code=languageMap[locale]||locale,rel='authorized-decryption/decoded-language/ingame-apk-'+code+'.json';
    languages[locale]=JSON.parse(file(rel).toString('utf8'));
    languageSources[locale]={cohort:'ingame-apk-'+code,jsonSHA256:sourceFiles[rel].sha256,keyCount:Object.keys(languages[locale]).length};
  }
  const selectedStrings={};
  function names(key){
    if(!key)return null;
    if(selectedStrings[key])return selectedStrings[key];
    const en=languages.en[key];
    const values={};
    for(const locale of registry){
      const value=languages[locale]?.[key];
      values[locale]=typeof value==='string'&&value.length?{value,status:'client-official',cohort:languageSources[locale].cohort}:
        typeof en==='string'&&en.length?{value:en,status:'english-fallback',cohort:'ingame-apk-en'}:{value:null,status:'unavailable',cohort:null};
    }
    selectedStrings[key]=values;return values;
  }
  const allHeroes=load('survivor'),heroes=allHeroes.filter(r=>(r.rawValues.Tags||[]).includes('hero'));
  if(heroes.length!==35)throw Error('Retained hero census changed; review before updating');
  const byId=new Map(heroes.map(r=>[r.rawValues.InternalId,r]));
  const from=new Map(heroes.filter(r=>ref(r.rawValues.SurvivorRarityUp)).map(r=>[ref(r.rawValues.SurvivorRarityUp),r.rawValues.InternalId]));
  const skillTypes=load('survivor_skill_type'),skillById=new Map(skillTypes.map(r=>[r.rawValues.InternalId,r]));
  const skillLevels=family('survivor_skill_main'),levels=family('survivor_level_main'),ranks=family('survivor_rank_main');
  const genericLevels=load('survivor_level'),rankTypes=load('survivor_rank'),promotions=load('survivor_rarity_up_group');
  const gearTypes=load('survivor_exclusive_gear'),gearLevels=load('survivor_exclusive_gear_main');
  const controls=load('hero_control_server'),tags=load('survivor_tag'),tagById=new Map(tags.map(r=>[r.rawValues.InternalId,r]));
  const items=load('itemlist'),itemById=new Map(items.map(r=>[r.rawValues.InternalId,r]));
  const itemFacts={};
  function item(id){if(itemFacts[id])return;const r=itemById.get(id);if(!r)return;names(r.rawValues.Name);itemFacts[id]={clientId:id,sourceId:r.rawValues.Id,nameKey:r.rawValues.Name,names:names(r.rawValues.Name),evidence:evidence(r,['Name'])};}
  function costs(raw){for(const x of raw||[])item(x.key||x.i_id);return raw;}
  function summary(rows,field){
    const values=rows.map(r=>r.rawValues[field]).filter(Number.isFinite);
    return {recordCount:rows.length,min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,tables:[...new Set(rows.flatMap(r=>r._copies))].sort(),liveAccessibleMaximumVerified:false};
  }
  const result=heroes.map(h=>{
    const v=h.rawValues,baseId=from.get(v.InternalId)||v.InternalId,base=byId.get(baseId).rawValues;
    const token=base.Id.replace(/^survivor_/,'');const identityId=aliases[token]||token;const variant=from.has(v.InternalId)?'promoted':'base';
    const id=identityId+(variant==='promoted'?'-promoted':'');
    const ownLevels=levels.filter(r=>ref(r.rawValues.SurvivorType)===v.InternalId).sort((a,b)=>a.rawValues.Level-b.rawValues.Level);
    const ownRanks=ranks.filter(r=>ref(r.rawValues.SurvivorType)===v.InternalId).sort((a,b)=>a.rawValues.Rank-b.rawValues.Rank||a.rawValues.RankSmall-b.rawValues.RankSmall);
    const relevantPromotion=promotions.filter(r=>(r.rawValues.Survivor||[]).some(x=>ref(x)===baseId));
    const roles=(v.RaidProfessionTag||[]).map(x=>tagById.get(ref(x))).filter(Boolean).map(r=>({clientId:r.rawValues.InternalId,nameKey:r.rawValues.Name,names:names(r.rawValues.Name),evidence:evidence(r,['Name'])}));
    const skills=(v.SkillConfig||[]).map(binding=>{
      const r=skillById.get(binding.key);if(!r)throw Error('Missing configured skill '+binding.key);const sv=r.rawValues;
      const ls=skillLevels.filter(x=>ref(x.rawValues.SkillType)===binding.key).sort((a,b)=>a.rawValues.Level-b.rawValues.Level);
      for(const key of [sv.Name,sv.DescriptionSquad,sv.DescriptionTroop,sv.SlgName])if(key)names(key);
      const preview=ls.length?[ls[0],ls.at(-1)].filter((x,i,a)=>a.indexOf(x)===i).map(x=>({raw:take(x.rawValues,['InternalId','Level','BattlePower','SeBattlePower','RaidBattlePower','MarchFactor','ItemReq','SeItemReq','SlgItemReq','SlgDescription','SlgDescriptionParam','RaidSkillParam_1','RaidSkillParam_2','SsrXSurvivorSkill3AttrDes','SsrXSurvivorSkill3AttrParam']),evidence:evidence(x)})):[];
      for(const x of preview){costs(x.raw.ItemReq);costs(x.raw.SeItemReq);costs(x.raw.SlgItemReq);if(x.raw.SlgDescription)names(x.raw.SlgDescription);if(x.raw.SsrXSurvivorSkill3AttrDes)names(x.raw.SsrXSurvivorSkill3AttrDes);}
      const cap=ls.find(x=>x.rawValues.InternalId===ref(sv.MaxSkillLevel));
      return {clientId:binding.key,sourceId:sv.Id,nameKey:sv.Name,names:names(sv.Name),configurationValue:binding.value,skillNo:sv.SkillNo,classificationRaw:sv.SkillClassification,descriptionKeys:take(sv,['DescriptionSquad','DescriptionTroop','SlgName']),parameterBindingsRaw:take(sv,['ParamSquad','ParamTroop','ParamSquadUpgrade','PveSkillParam','RaidSkill']),levels:{...summary(ls,'Level'),configuredMaxRecord:sv.MaxSkillLevel,configuredMaxRecordLevel:cap?.rawValues.Level??null,recordRefs:ls.map(x=>({clientId:x.rawValues.InternalId,level:x.rawValues.Level})),preview},effectResolutionStatus:'raw-template-and-bindings-only; no inferred damage formula',evidence:evidence(r,['Name','SkillNo','SkillClassification','MaxSkillLevel','DescriptionSquad','DescriptionTroop','PveSkillParam','RaidSkill'])};
    });
    const gr=gearTypes.find(r=>r.rawValues.InternalId===ref(v.ExclusiveGear));let gear=null;
    if(gr){const gv=gr.rawValues;for(const k of [gv.GearName,gv.GearSkillName])names(k);item(ref(gv.ItemNeed));const gl=gearLevels.filter(r=>ref(r.rawValues.GearId)===gv.InternalId).sort((a,b)=>a.rawValues.Level-b.rawValues.Level);
      gear={clientId:gv.InternalId,sourceId:gv.Id,nameKey:gv.GearName,names:names(gv.GearName),skillNameKey:gv.GearSkillName,skillNames:names(gv.GearSkillName),fragmentItem:gv.ItemNeed,levels:{...summary(gl,'Level'),rows:gl.map(r=>{costs(r.rawValues.ItemNeed);if(r.rawValues.GearSkillDes)names(r.rawValues.GearSkillDes);return {raw:take(r.rawValues,['InternalId','Level','ItemNeed','GearSkillDes','GearSkillParam','Power','GearSkill2Des','GearSkill2Param']),evidence:evidence(r)};})},evidence:evidence(gr)};
    }
    for(const row of ownRanks){names(row.rawValues.StarName);names(row.rawValues.StarDescription);costs(row.rawValues.ItemReqNew);costs(row.rawValues.ItemReq);}
    const experience=genericLevels.filter(r=>r.rawValues.Rarity===v.Rarity);
    const factionNameKey={1:'hero_faction_mountain',2:'hero_faction_wild',3:'hero_faction_sky',4:'hero_faction_ocean'}[v.Faction];
    return {id,clientId:v.InternalId,sourceId:v.Id,identityId,baseClientId:baseId,variant,nameKey:v.Name,names:names(v.Name),rarityRaw:v.Rarity,typeRaw:v.Type,professionRaw:v.Profession,factionRaw:v.Faction,factionNameKey,factionNames:names(factionNameKey),roles:{classTags:roles,positionKey:{1:'front',2:'back',3:'middle'}[v.Type]||null,positionMappingStatus:'site presentation mapping of Type/role; not a separate client position field'},promotion:{from:from.get(v.InternalId)||null,to:ref(v.SurvivorRarityUp)||null,sourceField:'SurvivorRarityUp'},clientConditions:take(v,['ClientVersion','MinServerVersion','IsLock','IsBlockByServer','SeasonId','ServerList','InvisibleChannel','WhatWeek','WhatDay','HeroGen','AwakenOpenSeason','SurvivorAwakeMinVersion']),releaseStatus:'not-established-by-client-data',skillRefs:v.SkillConfig,skills,exclusiveGearRef:v.ExclusiveGear,exclusiveGear:gear,growth:{level:{...summary(ownLevels,'Level'),recordRefs:ownLevels.map(r=>({clientId:r.rawValues.InternalId,level:r.rawValues.Level})),preview:[ownLevels[0],ownLevels.at(-1)].filter(Boolean).map(r=>({raw:take(r.rawValues,['InternalId','Level','BattlePower','RaidBattlePower','BenefitsTroops']),evidence:evidence(r)}))},rank:{...summary(ownRanks,'Rank'),notation:'Raw Rank and RankSmall only; not a verified visual-star conversion',rows:ownRanks.map(r=>({raw:take(r.rawValues,['InternalId','Rank','RankSmall','BuildingReq','SurvivorLevelReq','SurvivorLevelMax','ItemReqNew','ItemReq','ItemReqNew_A','SkillLevelMax','UnlockSkills','StarName','StarDescription','BattlePower']),evidence:evidence(r)}))},experience:{...summary(experience,'Level'),status:'hold-unresolved-eight-byte-scalar-encoding',fields:['Exp','ExpUp','ExpNew','ExpUpNew']}},promotionGroups:relevantPromotion.map(r=>{costs(r.rawValues.Cost);return {raw:r.rawValues,evidence:evidence(r)}}),serverControlRefs:controls.filter(r=>ref(r.rawValues.HeroId)===v.InternalId).map(r=>({raw:r.rawValues,evidence:evidence(r)})),evidence:evidence(h,['Name','Rarity','Type','Profession','Faction','RaidProfessionTag','SurvivorRarityUp','SkillConfig','ExclusiveGear','ClientVersion','IsLock','IsBlockByServer','SeasonId'])};
  });
  // Hash every consumed input again: the extractor must not mutate source data.
  for(const [rel,info] of Object.entries(sourceFiles))if(sha(fs.readFileSync(path.join(corpus,rel)))!==info.sha256)throw Error('Source changed while reading: '+rel);
  return {schemaVersion:1,version:{game:'2.6.200',build:1512},scope:'35 hero configuration forms = 29 identities and 6 promoted forms; no live release or account eligibility inference',localePolicy:{siteLocales:registry,retainedIngameLocales:Object.keys(languages),englishFallbackLocales:[...missingLocales],fallbackIsOfficialTranslation:false},languageSources,heroes:result,localizations:selectedStrings,items:itemFacts,rankTypes:rankTypes.map(r=>({raw:take(r.rawValues,['InternalId','Rank','ChildRank','Rarity','Name','SkillLevelMax']),evidence:evidence(r)})),sourceFiles,unavailable:[{id:'furiosa',reason:'No Survivor record in the retained cohort; one English IAP title is not a hero/skill/stat model',observedStringKey:'iap_legendaryhero_furiosa_title'},{id:'alita',reason:'No Survivor record or matching English name/string key in the retained cohort'}],limitations:['Current release decisions and official announcements belong to a separate source layer.','Configured level/rank/skill maxima do not establish live accessible caps.','Unresolved eight-byte experience fields are not numeric EXP costs.','Effect templates and bindings are retained without inventing a runtime damage formula.','Source byte hashes cover retained inputs, not proof of current server behavior.']};
}
function compact(full){
  const usedItems=new Set(),rankById=new Map(full.rankTypes.map(r=>[r.raw.InternalId,r]));
  const heroes=full.heroes.map(h=>{
    const groups=h.promotionGroups||[],requirements=new Map();
    for(const g of groups){
      const key=JSON.stringify([g.raw.Cost,g.raw.Rank]);
      if(!requirements.has(key))requirements.set(key,{costItems:g.raw.Cost,requiredRank:g.raw.Rank,rankRaw:rankById.get(ref(g.raw.Rank))?.raw||null,groupIds:[]});
      requirements.get(key).groupIds.push(g.raw.InternalId);
      for(const c of g.raw.Cost||[])usedItems.add(c.i_id);
    }
    let gear=null;
    if(h.exclusiveGear){
      const g=h.exclusiveGear;usedItems.add(ref(g.fragmentItem));
      gear={clientId:g.clientId,sourceId:g.sourceId,nameKey:g.nameKey,names:g.names,skillNameKey:g.skillNameKey,skillNames:g.skillNames,fragmentItem:g.fragmentItem,levels:take(g.levels,['recordCount','min','max','liveAccessibleMaximumVerified']),configuredCosts:g.levels.rows.map(r=>({recordId:r.raw.InternalId,level:r.raw.Level,itemNeed:r.raw.ItemNeed})),costBasis:'raw ItemNeed for the configured destination level; current eligibility not verified',effectResolutionStatus:'description/effect bindings not resolved for display',evidence:g.evidence};
    }
    return {...take(h,['id','clientId','sourceId','identityId','baseClientId','variant','nameKey','names','rarityRaw','typeRaw','professionRaw','factionRaw','factionNameKey','factionNames','roles','promotion','clientConditions','releaseStatus','skillRefs','exclusiveGearRef','evidence']),
      skills:h.skills.map(s=>({...take(s,['clientId','sourceId','nameKey','names','configurationValue','skillNo','classificationRaw','descriptionKeys','effectResolutionStatus','evidence']),levels:take(s.levels,['recordCount','min','max','configuredMaxRecord','configuredMaxRecordLevel','liveAccessibleMaximumVerified'])})),
      exclusiveGear:gear,
      growth:{level:take(h.growth.level,['recordCount','min','max','tables','liveAccessibleMaximumVerified']),rank:take(h.growth.rank,['recordCount','min','max','tables','notation','liveAccessibleMaximumVerified']),experience:h.growth.experience},
      promotionRequirements:{status:groups.length?'configured-group-requirements; live active group and visual-star conversion unverified':'no retained promotion-group entry for this base identity',requirements:[...requirements.values()],groupReferences:groups.map(g=>({recordId:g.raw.InternalId,configuredDurationRaw:g.raw.Duration,evidence:g.evidence}))},
      serverControl:{recordCount:h.serverControlRefs.length,table:'hero_control_server',liveSelectionVerified:false}};
  });
  const sharedKeys=['hero_faction_mountain','hero_faction_wild','hero_faction_sky','hero_faction_ocean','lable_se_shield_kt','lable_se_shotgun_kt','lable_se_gunner_kt'];
  return {...take(full,['schemaVersion','version','scope','localePolicy','languageSources','sourceFiles','unavailable','limitations']),heroes,localizations:Object.fromEntries(sharedKeys.filter(k=>full.localizations[k]).map(k=>[k,full.localizations[k]])),items:Object.fromEntries([...usedItems].filter(id=>full.items[id]).map(id=>[id,full.items[id]])),exportPolicy:'Compact build model. Unresolved effect templates, full level/rank rows and detailed source audit remain private; no client-presence release inference.'};
}
function build(corpus){return compact(extract(corpus));}
if(require.main===module){
 const i=process.argv.indexOf('--corpus');if(i<0||!process.argv[i+1])throw Error('Usage: --corpus <retained foundation-40 directory>');
 const result=build(path.resolve(process.argv[i+1]));const out=path.join(ROOT,'data','hero-atlas-client.json');
 fs.writeFileSync(out,JSON.stringify(result)+'\n');console.log(JSON.stringify({heroes:result.heroes.length,identities:new Set(result.heroes.map(h=>h.identityId)).size,forms:result.heroes.filter(h=>h.variant==='promoted').length,selectedStringKeys:Object.keys(result.localizations).length,sourceFiles:Object.keys(result.sourceFiles).length,bytes:fs.statSync(out).size}));
}
module.exports={build,extract,compact};
