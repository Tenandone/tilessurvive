'use strict';
// Private, read-only inventory. Discoveries never imply publication or release.
// Optional evidence is separate from the six required CFG tables.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const changedKeys=(a={},b={})=>[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>hash(a[k]??null)!==hash(b[k]??null));
const DOWNSTREAM={PveNewSkill:'pve_new_skill',PveNewEffect:'pve_new_effect',PveNewBuff:'pve_new_buff',PveSkillRelease:'pve_skill_release',PveCondition:'pve_condition',PveFormula:'pve_formula',PveSkill:'pve_skill',PveEffect:'pve_effect',PveBuff:'pve_buff',SurvivorSlgSkillNew:'survivor_slg_skill_new',SurvivorSlgEffectNew:'survivor_slg_effect_new',SurvivorSlgConditionNew:'survivor_slg_condition_new',SurvivorSlgEffectCondition:'survivor_slg_effect_condition'};
// Native RaidSkillParam aliases refer to the newer effect/buff tables.
const MODIFIER_TABLES={pve_effect:'pve_new_effect',pve_buff:'pve_new_buff',pve_skill:'pve_new_skill'};
const CORE_CLASSES=new Set(['Survivor','SurvivorSkillType','SurvivorSkillMain','SurvivorRankMain','SurvivorExclusiveGear','SurvivorExclusiveGearMain']);
function rows(value){if(Array.isArray(value))return value;if(value?.records)return value.records.map(r=>r.row||r);return null;}
function optionalTables(source){
 const tables={},checks={};
 for(const name of new Set(Object.values(DOWNSTREAM))){
  try{const value=rows(source.table(name));if(value===null){checks[name]={status:'unavailable',reason:'source-did-not-provide-table'};continue;}tables[name]=value;checks[name]={status:'checked',rows:value.length};}
  catch(error){
   // Missing captured inputs are reportable; corrupt or mismatched bytes are not.
   if(error.code!=='ENOENT'&&!/^No approved captured-index selection for /.test(error.message))throw error;
   checks[name]={status:'unavailable',reason:'table-not-in-available-capture'};
  }
 }
 return{tables,checks};
}
function downstreamFor(components,optional){
 const selected=new Map(),missing=new Set(),unavailable=new Set(),untrackedClasses=new Set(),untrackedModifierAliases=new Set();
 const byTable=Object.fromEntries(Object.entries(optional.tables).map(([name,rs])=>[name,{ids:new Map(rs.map(r=>[r.InternalId,r])),names:new Map(rs.map(r=>[r.Id,r]))}]));
 function follow(table,id,byName=false){
  if(id===null||id===undefined||id===0||id==='0')return;
  if(!byTable[table]){unavailable.add(table);return;}
  const row=byTable[table][byName?'names':'ids'].get(id),key=table+':'+id;
  if(!row){missing.add(key);return;}
  const identity=table+':'+row.InternalId;if(selected.has(identity))return;
  selected.set(identity,{table,row});visit(row);
 }
 function visit(value){
  if(Array.isArray(value)){value.forEach(visit);return;}
  if(value&&typeof value==='object'){
   if(value.referenceClass&&value.internalId){const table=DOWNSTREAM[value.referenceClass];if(table)follow(table,value.internalId);else if(!CORE_CLASSES.has(value.referenceClass))untrackedClasses.add(value.referenceClass);}
   Object.values(value).forEach(visit);return;
  }
  if(typeof value==='string'&&value.includes('|')){const tokens=value.split('|'),table=MODIFIER_TABLES[tokens[0]];if(table&&tokens.length>=4)follow(table,tokens[1],true);else if(/^(pve_|slg_)/.test(tokens[0]))untrackedModifierAliases.add(tokens[0]);}
 }
 visit(components);
 return{status:!Object.keys(optional.tables).length?'not-checked':unavailable.size||missing.size||untrackedClasses.size||untrackedModifierAliases.size?'partial':'checked',scope:'Bound typed references and RaidSkillParam aliases only; runtime scripts, formulas from unavailable tables and unknown reference classes are not inferred.',records:[...selected.values()].sort((a,b)=>(a.table+':'+a.row.InternalId).localeCompare(b.table+':'+b.row.InternalId)),missingReferences:[...missing].sort(),unavailableTables:[...unavailable].sort(),untrackedReferenceClasses:[...untrackedClasses].sort(),untrackedModifierAliases:[...untrackedModifierAliases].sort()};
}
function normalizeAssets(input){
 if(input===undefined)return null;
 const body=input.byNativeKey||input.assets||input,entries=Array.isArray(body)?body.map(r=>[r.nativeKey||r.name||r.key,r]):Object.entries(body),result={};
 for(const[key,row]of entries){assert(typeof key==='string'&&key,'Asset manifest entry needs a native key/name');assert(!Object.hasOwn(result,key),'Duplicate asset key '+key);const digest=typeof row==='string'?row:row.sha256||row.hash||row.md5||null;assert(digest===null||typeof digest==='string','Asset digest must be a string');result[key]={hash:digest,width:typeof row==='object'?row.width??null:null,height:typeof row==='object'?row.height??null:null,status:digest?'manifest-reported-hash':'manifest-entry-without-content-hash'};}
 return Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
}
function stringKeys(value,fieldPattern,result=new Set()){
 if(Array.isArray(value)){value.forEach(x=>stringKeys(x,fieldPattern,result));return result;}
 if(value&&typeof value==='object')for(const[key,v]of Object.entries(value)){if(fieldPattern.test(key)&&typeof v==='string'&&v)result.add(v);else if(v&&typeof v==='object')stringKeys(v,fieldPattern,result);}
 return result;
}
function supplementaryFor(components,assets,dictionaries){
 const imageKeys=[...stringKeys(components,/(image|icon|pic|portrait)/i)].sort(),languageKeys=[...stringKeys(components,/(name|description|^GearSkillDes$|^Title$|^Text$|^Tips$)/i)].sort();
 const images={status:assets===null?'not-checked':'checked',scope:'Only supplied manifest entries; reported hashes are not independent file-byte verification.',keys:imageKeys,records:assets===null?null:Object.fromEntries(imageKeys.map(key=>[key,assets[key]||null])),missingKeys:assets===null?null:imageKeys.filter(key=>!Object.hasOwn(assets,key))};
 const translations={status:dictionaries===undefined?'not-checked':'checked',scope:'Only supplied locale dictionaries, with no translation fallback.',keys:languageKeys,locales:dictionaries===undefined?null:Object.fromEntries(Object.entries(dictionaries).sort(([a],[b])=>a.localeCompare(b)).map(([locale,dict])=>[locale,Object.fromEntries(languageKeys.map(key=>[key,Object.hasOwn(dict,key)?dict[key]:null]))]))};
 return{images,translations};
}
function publicationCoverage(heroes,input,options){
 if(input===undefined)return{status:'not-checked',reason:'No publication registry supplied',fileChecks:'not-checked'};
 const list=Array.isArray(input)?input:input.heroes||input.ids;assert(Array.isArray(list),'Published IDs must be an array or a heroes/ids array');
 const records=list.map(value=>typeof value==='object'?value:{id:value}),identity=h=>String(h.sourceId||'').replace(/^survivor_/,''),matches=(entry,h)=>[entry.id,entry.clientId,entry.sourceId].some(v=>v!==undefined&&(String(v)===String(h.clientId)||String(v)===h.sourceId||String(v)===identity(h)));
 const missing=heroes.filter(h=>!records.some(r=>matches(r,h))).map(h=>({clientId:h.clientId,sourceId:h.sourceId})),orphaned=records.filter(r=>!heroes.some(h=>matches(r,h))).map(r=>({id:r.id??null,clientId:r.clientId??null}));
 const requiredLocales=options.locales||input.locales||[...new Set(records.flatMap(r=>Object.keys(r.routes||{})))].sort(),missingRoutes=[],missingFiles=[];
 for(const r of records){for(const locale of requiredLocales){const route=r.routes?.[locale];if(!route){missingRoutes.push({id:r.id??r.clientId,locale});continue;}if(!options.siteRoot)continue;
   assert(typeof route==='string'&&route.startsWith('/')&&!/[?#]/.test(route),'Expected local publication route');
   const root=path.resolve(options.siteRoot),file=path.resolve(root,'.'+route,route.endsWith('.html')?'':'index.html'),relative=path.relative(root,file);assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Publication route leaves supplied site root');if(!fs.existsSync(file))missingFiles.push({id:r.id??r.clientId,locale,route});
  }}
 return{status:'checked',scope:'Differences are review candidates; NPCs, variants and unreleased records may intentionally lack pages.',publishedIdentities:records.length,missingClientIdentities:missing,unmatchedPublishedIdentities:orphaned,requiredLocales,routeChecks:requiredLocales.length?'checked':'not-checked',missingRoutes,fileChecks:options.siteRoot?'checked':'not-checked',missingFiles};
}
function snapshot(source,evidence={}){
 const get=name=>{const result=rows(source.table(name));assert(result,'Required table unavailable: '+name);return result;};
 const heroes=get('survivor'),skills=get('survivor_skill_type'),levels=get('survivor_skill_main'),ranks=get('survivor_rank_main'),gears=get('survivor_exclusive_gear'),gearLevels=get('survivor_exclusive_gear_main'),optional=optionalTables(source),assets=normalizeAssets(evidence.assets),dictionaries=evidence.dictionaries?.languages||evidence.dictionaries;
 if(dictionaries!==undefined)for(const[locale,dict]of Object.entries(dictionaries))assert(dict&&typeof dict==='object'&&!Array.isArray(dict),'Invalid dictionary '+locale);
 const byId=new Map(skills.map(r=>[r.InternalId,r])),byGear=new Map(gears.map(r=>[r.InternalId,r]));
 const records=heroes.map(h=>{
  const skillIds=(h.SkillConfig||[]).map(x=>x.key),gearId=h.ExclusiveGear?.internalId||null,gear=gearId?byGear.get(gearId):null;
  const boundSkills=skillIds.map(id=>byId.get(id)).filter(Boolean),boundLevels=levels.filter(s=>skillIds.includes(s.SkillType?.internalId)),boundRanks=ranks.filter(r=>r.SurvivorType?.internalId===h.InternalId),boundGearLevels=gear?gearLevels.filter(g=>g.GearId?.internalId===gearId):[];
  const refs={skillIds,gearId,rankRowIds:boundRanks.map(x=>x.InternalId),skillLevelRowIds:boundLevels.map(x=>x.InternalId),gearLevelRowIds:boundGearLevels.map(x=>x.InternalId),raidNewSkillIds:boundSkills.map(x=>x.RaidNewSkill?.internalId||null),slgSkillIds:boundSkills.map(x=>x.SurvivorSlgSkillNew_ID?.internalId||null)};
  const missing=[...skillIds.filter(id=>!byId.has(id)).map(id=>'SurvivorSkillType:'+id),...(gearId&&!gear?['SurvivorExclusiveGear:'+gearId]:[])];
  const components={hero:h,skills:boundSkills,levels:boundLevels,ranks:boundRanks,gear:gear||null,gearLevels:boundGearLevels},downstream=downstreamFor(components,optional),supplementary=supplementaryFor({...components,downstream:downstream.records},assets,dictionaries);
  Object.assign(components,{downstream,...supplementary});
  return{clientId:h.InternalId,sourceId:h.Id,fingerprint:hash(components),coreFingerprint:hash(h),fieldFingerprints:Object.fromEntries(Object.entries(h).map(([k,v])=>[k,hash(v)])),componentFingerprints:Object.fromEntries(Object.entries(components).map(([k,v])=>[k,hash(v)])),references:refs,missingReferences:missing,downstream,...supplementary};
 });
 assert.equal(new Set(records.map(x=>x.clientId)).size,records.length,'Duplicate hero identity in inventory');
 return {schemaVersion:2,heroes:records,counts:{heroes:heroes.length,skills:skills.length,skillLevels:levels.length,rankRows:ranks.length,gears:gears.length,gearLevels:gearLevels.length},checks:{downstreamTables:optional.checks,assets:assets===null?'not-checked':'checked',translations:dictionaries===undefined?'not-checked':'checked'},assetManifest:assets,publication:publicationCoverage(records,evidence.published,evidence),publicationDecision:false};
}
function diff(before,after){
 const a=new Map(before.heroes.map(h=>[h.clientId,h])),b=new Map(after.heroes.map(h=>[h.clientId,h]));
 const changes=after.heroes.filter(h=>a.has(h.clientId)&&a.get(h.clientId).fingerprint!==h.fingerprint).map(h=>{const prior=a.get(h.clientId),languages=new Set([...Object.keys(prior.translations?.locales||{}),...Object.keys(h.translations?.locales||{})]);return{clientId:h.clientId,sourceId:h.sourceId,coreChanged:prior.coreFingerprint!==h.coreFingerprint,changedCoreFields:changedKeys(prior.fieldFingerprints,h.fieldFingerprints),changedComponents:changedKeys(prior.componentFingerprints,h.componentFingerprints),beforeReferences:prior.references,afterReferences:h.references,changedImageKeys:prior.images?.records&&h.images?.records?changedKeys(prior.images.records,h.images.records):null,changedTranslationKeys:prior.translations?.locales&&h.translations?.locales?Object.fromEntries([...languages].map(locale=>[locale,changedKeys(prior.translations.locales[locale],h.translations.locales[locale])]).filter(([,keys])=>keys.length)):null};});
 return{schemaVersion:2,before:before.counts,after:after.counts,added:after.heroes.filter(h=>!a.has(h.clientId)),removed:before.heroes.filter(h=>!b.has(h.clientId)),changed:changes,missingReferences:after.heroes.filter(h=>h.missingReferences.length),downstreamMissingReferences:after.heroes.filter(h=>h.downstream?.missingReferences.length).map(h=>({clientId:h.clientId,references:h.downstream.missingReferences})),evidenceChecks:{before:before.checks,after:after.checks},changedManifestKeys:before.assetManifest&&after.assetManifest?changedKeys(before.assetManifest,after.assetManifest):null,publication:after.publication,publicationDecision:false};
}
function readEvidence(args,prefix=''){
 const flag=name=>'--'+prefix+name,get=name=>{const i=args.indexOf(flag(name));if(i<0)return undefined;assert(args[i+1]&&!args[i+1].startsWith('--'),'Missing value for '+flag(name));return args[i+1];},read=file=>JSON.parse(fs.readFileSync(file));
 const assets=get('asset-manifest'),dictionaries=get('dictionaries'),published=get('published-ids'),siteRoot=get('site-root'),locales=get('locales');
 return{...(assets?{assets:read(assets)}:{}),...(dictionaries?{dictionaries:fs.statSync(dictionaries).isDirectory()?require('../build-xssr-details').readLanguages(dictionaries).languages:read(dictionaries)}:{}),...(published?{published:read(published)}:{}),...(siteRoot?{siteRoot}:{}),...(locales?{locales:locales.split(',').filter(Boolean)}:{})};
}
if(require.main===module){
 const args=process.argv.slice(2),get=f=>args[args.indexOf(f)+1];
 assert(args.includes('--previous')&&args.includes('--current')&&args.includes('--out'),'--previous RETAINED_CORPUS --current CURRENT_CAPTURE --out PRIVATE_OUTPUT required; optional current and --previous- prefixed: --asset-manifest JSON --dictionaries JSON_OR_DIRECTORY --published-ids JSON --site-root DIRECTORY --locales en,ko');
 const {createSource}=require('./source.cjs'),{createCapture}=require('../build-xssr-details'),{assertPrivate}=require('../game-data/paths.cjs');
 const out=assertPrivate(get('--out'),'Relationship audit output');fs.mkdirSync(out,{recursive:true});
 const previous=snapshot(createSource(get('--previous')),readEvidence(args,'previous-')),current=snapshot(createCapture(get('--current')),readEvidence(args)),delta=diff(previous,current);
 for(const[name,data]of[['previous',previous],['current',current],['diff',delta]])fs.writeFileSync(path.join(out,'hero-relationships-'+name+'.json'),JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({before:delta.before,after:delta.after,added:delta.added.map(h=>h.clientId),removed:delta.removed.map(h=>h.clientId),changed:delta.changed.map(h=>h.clientId),missingReferences:delta.missingReferences.length,evidenceChecks:delta.evidenceChecks,publication:delta.publication}));
}
module.exports={snapshot,diff,readEvidence};
