'use strict';
// Rebuild only from explicitly supplied, captured client files. No network or
// benchmark fallback: every numeric table must match that capture's index.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {inspectBuffer}=require('./game-data/cfg.cjs');
const ROOT=path.resolve(__dirname,'..'),LOCALES=require('../data/i18n/locales.json').locales.map(x=>x.code);
const hash=(b,algorithm='sha256')=>crypto.createHash(algorithm).update(b).digest('hex');
const LANGUAGE_CODES={'zh-tw':'zh-TW','zh-cn':'zh-CN',ms:'my'};
function createCapture(directory){
 const root=path.resolve(directory),version=JSON.parse(fs.readFileSync(path.join(root,'version.json'))),binary=path.join(root,'BinaryConfig'),indexBytes=fs.readFileSync(path.join(binary,'BinVersionList_Realtime.json')),index=JSON.parse(indexBytes),cache=new Map(),sources=[];
 function table(name){
  if(cache.has(name))return cache.get(name);
  const file=path.join(binary,name+'.bin'),bytes=fs.readFileSync(file),md5=hash(bytes,'md5');
  assert.equal(md5,index[name],name+' differs from this capture\'s realtime index');
  const reader=inspectBuffer(bytes),rows=[...reader.records()].map(x=>x.row);
  assert.equal(new Set(rows.map(x=>x.InternalId)).size,rows.length,name+' has duplicate identities');
  sources.push({table:name,sha256:hash(bytes),md5,rows:rows.length,currentIndexMatch:true});cache.set(name,rows);return rows;
 }
 return {root,version:{game:version.version,build:Number(version.buildnumber),reviewedOn:'2026-11-05'},indexSHA256:hash(indexBytes),table,sources};
}
function readLanguages(directory){
 const languages={},sources=[];
 for(const locale of LOCALES){
  const code=LANGUAGE_CODES[locale]||locale,candidates=['ingame-cache-'+code+'.json','ingame-apk-'+code+'.json',code+'.json',locale+'.json'];
  const file=candidates.map(name=>path.join(directory,name)).find(fs.existsSync);
  if(!file)continue;
  const bytes=fs.readFileSync(file);languages[locale]=JSON.parse(bytes);sources.push({locale,cohort:path.basename(file,'.json'),sha256:hash(bytes)});
 }
 assert(languages.en,'A captured English language dictionary is required');
 return {languages,sources};
}
function makeDetails(capture,languageInput,heroIds=require('../data/xssr-heroes.json').heroes.map(h=>h.id)){
 const {languages, sources:languageSources}=languageInput;
 const text=key=>Object.fromEntries(LOCALES.map(locale=>[locale,languages[locale]?.[key]||languages.en[key]||null]));
 const names=key=>{const values=text(key);assert(Object.values(values).some(Boolean),'Missing captured name '+key);return values;};
 const table=capture.table,allHeroes=table('survivor'),allRanks=table('survivor_rank_main'),allGears=table('survivor_exclusive_gear'),allGearLevels=table('survivor_exclusive_gear_main'),allSkills=table('survivor_skill_type'),allSkillLevels=table('survivor_skill_main'),benefits=table('benefits'),allItems=table('itemlist');
 for(const [id,label]of [[301825,'attack'],[301826,'defense'],[301827,'health']]){const b=benefits.find(x=>x.InternalId===id);assert.equal(b?.Id,'prop_hero_'+label+'_value');assert.equal(b.Type,'integer');}
 const heroes={},rankProfiles=new Map(),gearProfiles=new Map(),skillProfiles=new Map(),bindings={};
 function profile(map,prefix,shape){const key=JSON.stringify(shape);if(!map.has(key))map.set(key,{id:prefix+'-'+hash(key).slice(0,12),...shape});return map.get(key).id;}
 const cost=x=>{assert(x&&x.length===1,'Expected one explicit material');return{itemId:x[0].key,quantity:x[0].value};};
 for(const id of heroIds){
  const h=allHeroes.find(x=>x.Id==='survivor_'+id);assert(h,'Missing independently bound hero '+id);
  const ranks=allRanks.filter(x=>x.SurvivorType?.internalId===h.InternalId).sort((a,b)=>a.Rank-b.Rank||a.RankSmall-b.RankSmall);
  assert(ranks.length,'Missing rank rows '+id);let cumulative=0;
  const rankRows=ranks.filter(x=>x.Rank>0).map(r=>{const c=cost(r.ItemReqNew);cumulative+=c.quantity;return{clientRowId:r.InternalId,rank:r.Rank,step:r.RankSmall,cost:c,cumulativeQuantity:cumulative,configuredSkillCaps:r.SkillLevelMax,levelCap:r.SurvivorLevelMax};});
  const rankGroups=[...new Set(rankRows.map(x=>x.rank))].map(rank=>{const rows=rankRows.filter(x=>x.rank===rank);return{rank,stepQuantities:rows.map(x=>x.cost.quantity),quantity:rows.reduce((n,x)=>n+x.cost.quantity,0),cumulativeQuantity:rows.at(-1).cumulativeQuantity,configuredSkillCaps:rows.at(-1).configuredSkillCaps};});
  const rankProfileId=profile(rankProfiles,'rank-six-steps',{rankGroups,totalFragments:cumulative});
  const gear=allGears.find(x=>x.InternalId===h.ExclusiveGear?.internalId);assert.equal(gear?.Survivor?.internalId,h.InternalId,'Gear binding mismatch');
  let gearCumulative=0;
  const gearLevels=allGearLevels.filter(x=>x.GearId?.internalId===gear.InternalId).sort((a,b)=>a.Level-b.Level).map(r=>{
   const c=cost(r.ItemNeed);assert.equal(c.itemId,gear.ItemNeed.internalId);gearCumulative+=c.quantity;
   const stat=id=>{const v=r.BenefitSe?.find(x=>x.benefit_id===id)?.benefit_value;assert(Number.isSafeInteger(v),'Unresolved integer gear stat');return v;};
   return {clientRowId:r.InternalId,level:r.Level,cost:c,cumulativeQuantity:gearCumulative,skillDisplayParameters:r.GearSkillParam,descriptionTemplates:text(r.GearSkillDes),attack:stat(301825),defense:stat(301826),health:stat(301827),power:r.Power,combatSkillRowId:r.GearSkillSlg?.internalId||null};
  });
  const gearProfileId=profile(gearProfiles,'exclusive-gear-cost',{levels:gearLevels.map(x=>({level:x.level,quantity:x.cost.quantity,cumulativeQuantity:x.cumulativeQuantity})),totalFragments:gearCumulative});
  const skills=h.SkillConfig.map(({key:skillId},slot)=>{
   const s=allSkills.find(x=>x.InternalId===skillId);assert.equal(s?.Survivor?.internalId,h.InternalId,'Skill ownership mismatch');
   const levels=allSkillLevels.filter(x=>x.SkillType?.internalId===skillId).sort((a,b)=>a.Level-b.Level);assert(levels.length,'No skill levels '+skillId);
   const materialCosts=levels.filter(x=>x.SlgItemReq?.length).map(r=>({destinationLevel:r.Level,cost:cost(r.SlgItemReq),clientRowId:r.InternalId}));
   const manualProfileId=materialCosts.length?profile(skillProfiles,'skill-manual',{levels:materialCosts.map(r=>({destinationLevel:r.destinationLevel,quantity:r.cost.quantity})),totalManuals:materialCosts.reduce((n,r)=>n+r.cost.quantity,0)}):null;
   return{clientId:skillId,sourceId:s.Id,slot,nameKey:s.Name,names:names(s.Name),descriptionKey:s.DescriptionSquad,descriptionTemplates:text(s.DescriptionSquad),iconKey:s.Icon,icon:null,configuredLevelRange:{min:levels[0].Level,max:levels.at(-1).Level},materialCosts,totalManualsToMax:materialCosts.reduce((n,r)=>n+r.cost.quantity,0),manualProfileId,automaticUpgrade:Boolean(s.AutoUpgrade),clientRefs:{raidNewSkillId:s.RaidNewSkill?.internalId||null,slgSkillId:s.SurvivorSlgSkillNew_ID?.internalId||null},numericEffects:null};
  });
  bindings[id]={clientId:h.InternalId,rankProfileId,gearProfileId,rankRowIds:ranks.map(x=>x.InternalId),gearId:gear.InternalId,gearLevelRowIds:gearLevels.map(x=>x.clientRowId)};
  const catalogNames=require('../data/xssr-heroes.json').heroes.find(x=>x.id===id)?.names||{},heroNames=names(h.Name);
  for(const locale of LOCALES)if(!heroNames[locale])heroNames[locale]=catalogNames[locale]?.value||catalogNames.en?.value||null;
  heroes[id]={id,clientId:h.InternalId,sourceId:h.Id,nameKey:h.Name,rarityRaw:h.Rarity,typeRaw:h.Type,professionRaw:h.Profession,classTagIds:(h.RaidProfessionTag||[]).map(t=>t.internalId),factionRaw:h.Faction,names:heroNames,imageKeys:{portrait:h.ImageBig,thumbnail:h.ImageSmall,full:h.SurvivorFullBodyPic},clientAvailability:{minVersion:h.MinServerVersion,clientVersion:h.ClientVersion,serverList:h.ServerList,blockedByServer:Boolean(h.IsBlockByServer),week:h.WhatWeek,day:h.WhatDay,provesLiveRelease:false},recruitment:{cost:cost(h.ChipNumber)},skills,exclusiveGear:{clientId:gear.InternalId,nameKey:gear.GearName,names:names(gear.GearName),skillNameKey:gear.GearSkillName,skillNames:names(gear.GearSkillName),iconKey:gear.Icon,skillIconKey:gear.GearSkillIcon,fragmentItemId:gear.ItemNeed.internalId,profileId:gearProfileId,levels:gearLevels,totalQuantity:gearCumulative},growth:{profileId:rankProfileId,fragmentItemId:rankRows[0].cost.itemId,rankRows,totalFragments:cumulative},capabilities:{formationPlanning:true,factionCounting:true,qualitativePets:true,numericSkills:false,rankCosts:true,gearStats:true},evidenceRefs:['survivor:'+h.InternalId,'survivor_exclusive_gear:'+gear.InternalId]};
  const common=allItems.find(x=>x.InternalId===h.SurvivorCommonChip?.internalId);
  if(common){assert.equal(common.Type,'common_survivor_chip');assert(languages.en[common.Description]?.includes('currently own'),'Common fragment ownership condition needs captured wording');heroes[id].growth.universalFragment={itemId:common.InternalId,requiresOwnedHero:true,exchangeRatio:{universal:1,dedicated:1},conversionQuantityVerified:true,usableForRecruitment:false,sourceField:'Survivor.SurvivorCommonChip',consumer:{method:'ItemlistConfigCell.GetExchangeSurvivorItemCount',version:'2.6.200',build:1512,methodStart:'0x4f59548',checkedBranch:['0x4f595d8','0x4f5960c'],boundedBytesSHA256:'ab512b37fe0f4fab2d60d48aed9ba91fef8ea4112ad6cfddd243c45efeac8c88',predicate:'Item.Type=common_survivor_chip and Survivor.SurvivorCommonChip=Item.InternalId',scope:'configured exchange quantity; current server eligibility is independent'}};}
 }
 const profiles={schemaVersion:1,version:capture.version,rankProfiles:[...rankProfiles.values()],gearProfiles:[...gearProfiles.values()],skillManualProfiles:[...skillProfiles.values()],bindings,applicability:'Only explicit bindings verified from the same captured source; rarity alone never selects a growth profile.'};
 const materialIds=new Set(Object.values(heroes).flatMap(h=>[h.recruitment.cost.itemId,h.exclusiveGear.fragmentItemId,h.growth.universalFragment?.itemId,...h.skills.flatMap(s=>s.materialCosts.map(c=>c.cost.itemId))]).filter(Boolean));
 const items=Object.fromEntries([...materialIds].map(id=>{const item=allItems.find(x=>x.InternalId===id);assert(item,'Missing material '+id);return[id,{clientId:id,sourceId:item.Id,names:names(item.Name),descriptions:text(item.Description)}];}));
 const details={schemaVersion:1,version:capture.version,heroes,items,sources:capture.sources,indexSHA256:capture.indexSHA256,languageSources,localePolicy:{fallback:'captured-English when present; published catalog names for hero identity only',missingValues:null,missingLocalizedTextDoesNotDisableVerifiedNumericData:true},limits:{liveServerUnlockVerified:false,numericSkillFormatterVerified:false}};
 return {details,profiles};
}
function attachMedia(details,manifestFile,siteRoot=ROOT){
 const manifest=JSON.parse(fs.readFileSync(manifestFile)),selected=new Map(),target=path.join(siteRoot,'img/game-26300'),presentationFile=path.join(siteRoot,'data/xssr-presentation.json'),presentation=fs.existsSync(presentationFile)?JSON.parse(fs.readFileSync(presentationFile)).byNativeKey:{};fs.mkdirSync(target,{recursive:true});
 function asset(key){if(!key)return null;if(selected.has(key))return selected.get(key);const m=manifest.find(x=>x.name===key);if(!m)return null;assert(/^[a-z0-9_]+$/.test(key));const bytes=fs.readFileSync(m.file);assert.equal(hash(bytes),m.sha256,'Extracted media SHA mismatch '+key);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),m.width);assert.equal(bytes.readUInt32BE(20),m.height);let value=presentation[key];if(value){assert.equal(value.extractedSourceSHA256,m.sha256,'Presentation must bind the reviewed extraction');assert(value.src.startsWith('/img/'));const installed=fs.readFileSync(path.join(siteRoot,value.src.slice(1)));assert.equal(hash(installed),value.sha256,'Installed presentation SHA mismatch '+key);assert.equal(value.width,m.width);assert.equal(value.height,m.height);if(!value.retainedExisting)assert.equal(value.sha256,m.sha256,'Presentation must match the extracted asset');value={...value};}else{fs.writeFileSync(path.join(target,key+'.png'),bytes);value={src:'/img/game-26300/'+key+'.png',width:m.width,height:m.height,sha256:m.sha256};}selected.set(key,value);return value;}
 for(const h of Object.values(details.heroes)){h.portrait=asset(h.imageKeys.full)||asset(h.imageKeys.portrait);h.thumbnail=asset(h.imageKeys.portrait);for(const skill of h.skills)skill.icon=asset(skill.iconKey);h.exclusiveGear.icon=asset(h.exclusiveGear.iconKey);h.exclusiveGear.skillIcon=asset(h.exclusiveGear.skillIconKey);}
 details.mediaSources=[...selected.keys()].map(key=>{const m=manifest.find(x=>x.name===key);return{name:key,sha256:m.sha256,sourceBundleSHA256:m.sourceBundleSha256,sourceManifest:m.sourceManifest};});return details;
}
function bindSkillValues(details,values){
 assert.equal(values.version.game,details.version.game);assert.equal(values.version.build,details.version.build);assert.equal(values.indexSHA256,details.indexSHA256,'Skill values must use this same captured index');
 for(const h of Object.values(details.heroes)){for(const s of h.skills){const v=values.skills[s.clientId];assert.equal(v?.heroId,h.clientId);for(let level=s.configuredLevelRange.min;level<=s.configuredLevelRange.max;level++)assert(Array.isArray(v.levels[level]),'Missing verified skill level '+s.clientId+':'+level);s.numericEffects={source:'xssr-skill-values',profile:values.profile,levelRange:s.configuredLevelRange};}h.capabilities.numericSkills=true;}
 details.limits.numericSkillFormatterVerified=true;details.skillValueProfile=values.profile;return details;
}
if(require.main===module){
 const args=process.argv.slice(2),get=flag=>args[args.indexOf(flag)+1];assert(args.includes('--source')&&args.includes('--languages'),'Usage: node scripts/build-xssr-details.js --source CAPTURE --languages DECODED_DICTIONARIES [--out DIRECTORY]');
 const result=makeDetails(createCapture(get('--source')),readLanguages(get('--languages'))),out=path.resolve(args.includes('--out')?get('--out'):path.join(ROOT,'data'));fs.mkdirSync(out,{recursive:true});if(args.includes('--media'))attachMedia(result.details,get('--media'),path.dirname(out));if(args.includes('--skill-values'))bindSkillValues(result.details,JSON.parse(fs.readFileSync(get('--skill-values'))));
 fs.writeFileSync(path.join(out,'xssr-details.json'),JSON.stringify(result.details,null,2)+'\n');fs.writeFileSync(path.join(out,'hero-growth-profiles.json'),JSON.stringify(result.profiles,null,2)+'\n');console.log(JSON.stringify({heroes:Object.keys(result.details.heroes),sources:result.details.sources.length,profiles:{rank:result.profiles.rankProfiles.length,gear:result.profiles.gearProfiles.length,skill:result.profiles.skillManualProfiles.length}}));
}
module.exports={createCapture,readLanguages,makeDetails,attachMedia,bindSkillValues};
