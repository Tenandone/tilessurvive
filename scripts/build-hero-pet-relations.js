'use strict';
// Offline, read-only client reanalysis. Raw CFGs selected by the captured index
// are the inputs; normalized/public game models are comparison targets only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createSource}=require('./client-audit/source.cjs');
const ROOT=path.resolve(__dirname,'..');
const LOCALES=require('../data/i18n/locales.json').locales.map(l=>l.code);
const PET_IDS={pet_seal:'snowball',pet_raccoon:'dodo',pet_turtle:'buckler',pet_sheep:'fluffy',pet_armored_boar:'hardhead',pet_shadow_hound:'shadow',pet_whitebear:'snowy',pet_starlight_deer:'starhorn',pet_crocodile:'chompy',pet_fox:'hopper'};
const HERO_IDS={ken:'chef-ken',freja:'freya',becca:'beka',layla:'laila',maddie:'maddy',tim:'ghost',wright:'light',tithi:'kiki',chiron:'kiron',ragnar:'lagnar'};
const FALLBACK=new Set(['ar','vi','nb']);
const PET_FACTS={
 pet_seal:[['battle-start','random-enemy','pet-attack-damage'],['deployed-heroes','attack-up'],['deployed-heroes','target-below-25','attack-up'],['pet-stats-up']],
 pet_raccoon:[['battle-start','random-two-allies','attack-up','temporary-effect'],['feeding-exp-up'],['legendary-hatch-chance-up'],['pet-stats-up']],
 pet_turtle:[['battle-start','nearest-ally','defense-up','normal-damage-reduction','temporary-effect'],['feeding-exp-up'],['hatching-time-down'],['pet-stats-up']],
 pet_sheep:[['battle-start','front-row-allies','healing','temporary-effect'],['deployed-heroes','health-up'],['deployed-heroes','healing-effect-up'],['pet-stats-up']],
 pet_armored_boar:[['battle-start','nearest-enemy','pet-attack-damage','defense-down','temporary-effect'],['front-row-allies','attack-up'],['damage-taken-up'],['pet-stats-up']],
 pet_shadow_hound:[['battle-start','random-enemy','damage-taken-up','temporary-effect'],['deployed-heroes','attack-up'],['deployed-heroes','target-below-35','attack-up'],['pet-stats-up']],
 pet_whitebear:[['battle-start','enemies-ahead','pet-attack-damage','attack-down','attack-speed-down','temporary-effect'],['deployed-heroes','attack-up'],['deployed-heroes','on-kill','attack-up','defense-up'],['pet-stats-up']],
 pet_starlight_deer:[['battle-start','front-row-allies','defense-up','back-row-allies','attack-up','temporary-effect'],['deployed-heroes','health-up'],['deployed-heroes','skill-damage-reduction'],['pet-stats-up']],
 pet_crocodile:[['battle-start','lowest-health-enemy','pet-attack-damage','damage-taken-up','temporary-effect'],['deployed-heroes','attack-up'],['deployed-heroes','crit-up'],['pet-stats-up']],
 pet_fox:[['battle-start','random-two-allies','attack-up','dodge-up','temporary-effect'],['deployed-heroes','attack-up'],['deployed-heroes','self-below-50','normal-damage-reduction'],['pet-stats-up']]
};
// Reviewed semantic joins, not a keyword-scoring/ranking algorithm. Each joins
// two explicit client description fields and carries the limiting conditions.
const RULE_DEFS=[
 ['rusty-fluffy-max-health-shield','rusty','fluffy','data-based','max-health-shield','survivor_rusty_skill_1','pet_sheep_skill_2',['hero-deployed','max-health-shield-scaling'],['starhorn']],
 ['rusty-starhorn-max-health-shield','rusty','starhorn','data-based','max-health-shield','survivor_rusty_skill_1','pet_starlight_deer_skill_2',['hero-deployed','max-health-shield-scaling'],['fluffy']],
 ['becca-shadow-low-health','beka','shadow','data-based','low-health-target','survivor_becca_skill_1','pet_shadow_hound_skill_3',['hero-deployed','same-target','target-below-30-and-35'],['snowball']],
 ['becca-snowball-low-health','beka','snowball','data-based','low-health-target','survivor_becca_skill_1','pet_seal_skill_3',['hero-deployed','same-target','target-below-25'],['shadow']],
 ...[['maddy','survivor_maddie_skill_2'],['rosie','survivor_rosie_skill_2'],['ray','survivor_ray_skill_2'],['laila','survivor_layla_skill_1'],['candy','survivor_candy_skill_1'],['mike','survivor_mike_skill_1'],['chef-ken','survivor_ken_skill_1'],['lava','survivor_lava_skill_2']].map(([hero,skill])=>[hero+'-fluffy-healing',hero,'fluffy','practical-check','healing-support',skill,'pet_sheep_skill_3',['hero-deployed','healing-modifier-applies',...(hero==='lava'?['hero-below-50']:[])],[]]),
 ['lava-hopper-low-health','lava','hopper','practical-check','low-health-survival','survivor_lava_skill_2','pet_fox_skill_3',['hero-deployed','hero-below-50','normal-attacks-received'],[]],
 ['nikola-hopper-low-health','nikola','hopper','practical-check','low-health-survival','survivor_nikola_skill_2','pet_fox_skill_3',['hero-deployed','hero-below-30','normal-attacks-received'],[]]
];
const TABLES=['survivor','survivor_skill_type','survivor_skill_main','pet_base','pet_shape','pet_skill_main','pet_train_stage','pet_train_step','pet_level','pve_skill','pve_new_skill','pve_skill_release','pve_effect','pve_new_effect','pve_buff','pve_new_buff','pve_condition','pve_skill_attrlist','pve_attrlist_condition','survivor_slg_skill_new','survivor_slg_effect_new','effect_buff'];
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const ref=x=>x?.internalId||0;
const clean=x=>JSON.parse(JSON.stringify(x));
function validate(data){
 assert.equal(data.schemaVersion,1);assert.equal(data.version.game,'2.6.200');assert.equal(data.version.build,1512);assert.equal(data.version.sourceManifestCreatedAt,'2026-10-09T13:55:11.415Z');assert.equal(data.version.reviewedOn,'2026-11-05');
 assert.equal(data.pets.length,10);assert.equal(data.heroes.length,35);assert.equal(new Set(data.heroes.map(h=>h.identityId)).size,29);
 assert.equal(data.heroes.filter(h=>h.publication==='held').length,6);assert.equal(data.pets.reduce((n,p)=>n+p.skills.length,0),40);
 const pets=new Map(data.pets.map(p=>[p.id,p])),heroes=new Map(data.heroes.map(h=>[h.id,h]));assert.equal(pets.size,10);assert.equal(heroes.size,35);
 const sourceIds=new Set(data.sources.map(s=>s.id));assert.equal(sourceIds.size,data.sources.length);for(const s of data.sources)assert(/^[a-f0-9]{64}$/.test(s.sha256));
 for(const e of Object.values(data.evidence)){assert(sourceIds.has(e.sourceRef));assert.equal(e.table,e.sourceRef);assert(Number.isInteger(e.recordId)&&e.recordId>0);assert(e.fields.length);}
 for(const s of Object.values(data.skills)){assert(Number.isInteger(s.clientId));assert(s.evidenceRefs.length);for(const e of s.evidenceRefs)assert(data.evidence[e]);for(const lang of LOCALES){assert(s.names[lang]?.value);assert.equal(s.names[lang].status,FALLBACK.has(lang)?'english-fallback':'client-official');if(FALLBACK.has(lang))assert.equal(s.names[lang].value,s.names.en.value);}}
 const ruleIds=new Set();
 for(const p of data.pets){assert(Object.values(PET_IDS).includes(p.id));assert.deepEqual(p.skills.map(s=>s.slot),[1,2,3,4]);assert.deepEqual(p.skills.map(s=>s.unlockStage),[0,2,4,5]);for(const s of p.skills){assert.deepEqual(s.levelRange,{min:1,max:s.slot===1?6:1});assert(data.skills[s.clientId]);assert.deepEqual(s.factKeys,PET_FACTS[p.sourceId][s.slot-1]);}for(const lang of LOCALES){assert(p.names[lang]?.value);assert.equal(p.names[lang].status,FALLBACK.has(lang)?'english-fallback':'client-official');}}
 for(const r of data.rules){assert(!ruleIds.has(r.id),'Duplicate rule');ruleIds.add(r.id);const hero=heroes.get(r.heroId),pet=pets.get(r.petId);assert(hero&&pet,'Unknown pairing endpoint');assert.equal(hero.publication,'published','Held form must not be silently recommended');assert(['data-based','practical-check'].includes(r.status));assert.equal(r.mode,'squad');assert(r.heroSkillIds.length&&r.petSkillIds.length&&r.evidenceRefs.length>=2);for(const id of r.heroSkillIds)assert(hero.skillIds.includes(id),'Hero does not bind cited skill');for(const id of r.petSkillIds)assert(pet.skills.some(s=>s.clientId===id),'Pet does not bind cited skill');for(const id of r.evidenceRefs)assert(data.evidence[id],'Missing evidence');assert(r.conditionKeys.includes('pet-skill-unlocked'));assert(r.conditionKeys.includes('hero-skill-unlocked'));assert(r.cautionKeys.includes('not-official-pairing'));for(const id of r.alternatePetIds)assert(pets.has(id)&&id!==r.petId);for(const key of ['score','rank','winRate','damageGain'])assert(!Object.hasOwn(r,key),'No invented performance metric');}
 for(const hero of data.heroes){const expected=data.rules.filter(r=>r.heroId===hero.id).map(r=>r.id);assert.deepEqual(hero.candidateRuleIds,expected);assert(expected.length<=3,'Do not fabricate a top-three list');for(const id of hero.skillIds)assert(data.skills[id]);}
 for(const r of data.rules){const expected=RULE_DEFS.find(d=>d[0]===r.id);assert(expected,'Unreviewed pairing rule');assert.deepEqual([r.heroId,r.petId,r.status,r.reasonKey],[expected[1],expected[2],expected[3],expected[4]],'Reviewed endpoint and classification');assert.deepEqual(r.heroSkillIds.map(id=>data.skills[id].sourceId),[expected[5]]);assert.deepEqual(r.petSkillIds.map(id=>data.skills[id].sourceId),[expected[6]]);assert.deepEqual(r.conditionKeys,[...expected[7],'hero-skill-unlocked','pet-skill-unlocked']);assert.deepEqual(r.alternatePetIds,expected[8]);assert.deepEqual(r.cautionKeys,['not-official-pairing','no-performance-estimate','current-rules-unverified',...(r.status==='practical-check'||r.reasonKey==='max-health-shield'?['modifier-order-unverified']:[]),...(r.heroId==='lava'?['healing-crosses-threshold']:[])],'Reviewed limitations must remain visible');}
 assert.equal(ruleIds.size,RULE_DEFS.length,'Reviewed rules must not silently disappear');
 assert.equal(data.formation.maxHeroes,null);assert.equal(data.formation.maxPets,1);assert.equal(data.formation.currentServerVerified,false);
 assert.equal(data.scope.directHeroPetPairingRecords,0);return true;
}
function collect(corpus){
 const source=createSource(corpus),tables=new Map(),sources=[],evidence={},audit={rawTables:[],normalizationComparisons:[],bindingResolution:[],limitations:[],siteCoverage:{}};
 for(const name of TABLES){const t=source.table(name),rows=t.records.map(r=>r.row);assert.equal(t.version,'2.6.200');assert.equal(t.build,1512);assert.equal(new Set(rows.map(r=>r.InternalId)).size,rows.length,name+' duplicate internal IDs');tables.set(name,{...t,rows,byId:new Map(rows.map(r=>[r.InternalId,r])),bySourceId:new Map(rows.map(r=>[r.Id,r]))});sources.push({id:name,kind:'cfg',sha256:t.sourceSHA256,rows:rows.length});audit.rawTables.push({table:name,path:t.sourcePath,sha256:t.sourceSHA256,rows:rows.length,manifestSHA256:t.manifestSHA256});
  // Comparison only: parsed source values have already been obtained directly.
  const normalized=path.join(corpus,'normalized-complete-v1','tables',name+'.jsonl');if(fs.existsSync(normalized)){const n=fs.readFileSync(normalized,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);assert.equal(n.length,rows.length,name+' normalized row count');for(let i=0;i<rows.length;i++){assert.equal(n[i].provenance.sourceSha256,t.sourceSHA256);assert.deepEqual(clean(rows[i]),n[i].rawValues,name+' raw/normalized '+i);}audit.normalizationComparisons.push({table:name,rows:rows.length,allRawValuesEqual:true});}
 }
 const get=name=>tables.get(name),row=(name,id)=>{const r=typeof id==='string'?get(name).bySourceId.get(id):get(name).byId.get(id);assert(r,'Missing '+name+':'+id);return r;};
 const languages={},languageSources=[];
 for(const locale of LOCALES.filter(l=>!FALLBACK.has(l))){const code={'zh-cn':'zh-CN','zh-tw':'zh-TW',ms:'my'}[locale]||locale,file=path.join(corpus,'authorized-decryption/decoded-language','ingame-apk-'+code+'.json'),bytes=fs.readFileSync(file);languages[locale]=JSON.parse(bytes);languageSources.push({id:'language-'+locale,kind:'retained-decoded-language',sha256:hash(bytes),keys:Object.keys(languages[locale]).length});}
 const names=key=>{assert(key&&typeof languages.en[key]==='string','Missing English name '+key);return Object.fromEntries(LOCALES.map(locale=>{const value=languages[locale]?.[key];assert(FALLBACK.has(locale)||typeof value==='string'&&value,'Missing official name '+locale+':'+key);return [locale,{value:value||languages.en[key],status:value?'client-official':'english-fallback'}];}));};
 function ev(table,r,fields){const id=table+':'+r.InternalId;if(!evidence[id])evidence[id]={table,recordId:r.InternalId,sourceId:r.Id,sourceRef:table,fields:[]};evidence[id].fields=[...new Set([...evidence[id].fields,...fields])];return id;}
 const skillCatalog={};
 function skill(id){if(skillCatalog[id])return skillCatalog[id];const s=row('survivor_skill_type',id),levels=get('survivor_skill_main').rows.filter(r=>ref(r.SkillType)===id).sort((a,b)=>a.Level-b.Level);assert(levels.length,'Skill has no level records '+id);assert.equal(new Set(levels.map(x=>x.Level)).size,levels.length,'Ambiguous skill levels '+id);
  const desc=s.DescriptionSquad?languages.en[s.DescriptionSquad]:null;assert(!s.DescriptionSquad||typeof desc==='string','Missing source description '+s.DescriptionSquad);
  for(const [field,table]of [['RaidSkill','pve_skill'],['RaidNewSkill','pve_new_skill'],['SurvivorSlgSkillNew_ID','survivor_slg_skill_new']])if(ref(s[field]))row(table,ref(s[field]));
  const bindings=[];for(const l of levels)for(const field of ['RaidSkillParam_1','RaidSkillParam_2'])for(const value of l[field]||[]){if(value===null){bindings.push({recordId:l.InternalId,field,raw:null,possibleTables:[],status:'explicit-null-binding'});continue;}assert.equal(typeof value,'string','Unexpected display binding type');const parts=value.split('|'),candidates=({pve_effect:['pve_effect','pve_new_effect'],pve_buff:['pve_buff','pve_new_buff'],pve_skill:['pve_skill','pve_new_skill']})[parts[0]]||[];const matches=candidates.filter(t=>get(t).bySourceId.has(parts[1]));bindings.push({recordId:l.InternalId,field,raw:value,possibleTables:matches,status:matches.length===1?'one-retained-record':matches.length>1?'old-new-mode-resolution-required':'unresolved-namespace-or-record'});}
  audit.bindingResolution.push({skillId:id,sourceId:s.Id,levelRows:levels.length,bindingCount:bindings.length,uniqueBindings:[...new Map(bindings.map(b=>[b.raw,b])).values()]});
  const e=ev('survivor_skill_type',s,['Name','DescriptionSquad','RaidSkill','RaidNewSkill','SurvivorSlgSkillNew_ID','PveSkillParam','MaxSkillLevel']);
  const result={clientId:id,sourceId:s.Id,slot:s.SkillNo,nameKey:s.Name,names:names(s.Name),descriptionKey:s.DescriptionSquad||null,descriptionSHA256:desc?hash(desc):null,configuredLevelRange:{min:levels[0].Level,max:levels.at(-1).Level},runtime:{raidSkillId:ref(s.RaidSkill)||null,raidNewSkillId:ref(s.RaidNewSkill)||null,slgNewSkillId:ref(s.SurvivorSlgSkillNew_ID)||null,effectResolution:'configured-reference; script execution and current server not verified'},evidenceRefs:[e]};skillCatalog[id]=result;return result;
 }
 const originalHeroes=get('survivor').rows.filter(h=>(h.Tags||[]).includes('hero'));assert.equal(originalHeroes.length,35);const parent=new Map(originalHeroes.filter(h=>ref(h.SurvivorRarityUp)).map(h=>[ref(h.SurvivorRarityUp),h.InternalId]));
 const heroes=originalHeroes.map(h=>{const base=row('survivor',parent.get(h.InternalId)||h.InternalId),token=base.Id.replace(/^survivor_/,''),identityId=HERO_IDS[token]||token,promoted=parent.has(h.InternalId),id=identityId+(promoted?'-promoted':'');const skillIds=(h.SkillConfig||[]).map(s=>s.key);skillIds.forEach(skill);return {id,identityId,clientId:h.InternalId,publication:promoted?'held':'published',skillIds,candidateRuleIds:[],evidenceRefs:[ev('survivor',h,['SkillConfig','SurvivorRarityUp','ClientVersion','IsBlockByServer'])]};});
 const representative=new Set(require('../data/companions.json').pets.map(p=>p.id)),phase2=new Set(require('../data/content-60/pets-phase2/model.json').pets.map(p=>p.id));
 const pets=get('pet_base').rows.map(p=>{const id=PET_IDS[p.Id];assert(id,'Unreviewed new pet '+p.Id);const shape=row('pet_shape',ref(p.DefaultShapeId)),stages=get('pet_train_stage').rows.filter(s=>ref(s.PetId)===p.InternalId).sort((a,b)=>a.TrainStage-b.TrainStage);assert.deepEqual(stages.map(s=>s.TrainStage),[0,1,2,3,4,5]);const skills=p.PetSkill.map(binding=>{const s=skill(binding.key),slot=s.slot;assert(slot>=1&&slot<=4);const unlock=stages.find(x=>x.SkillLevelMax?.[slot-1]>0);assert(unlock,'No configured skill unlock '+p.Id+':'+slot);const lv=get('pet_skill_main').rows.filter(x=>ref(x.SkillType)===binding.key).map(x=>x.Level).sort((a,b)=>a-b);assert.deepEqual(lv,Array.from({length:slot===1?6:1},(_,i)=>i+1));return {...s,unlockStage:unlock.TrainStage,levelRange:{min:lv[0],max:lv.at(-1)},factKeys:PET_FACTS[p.Id][slot-1],evidenceRefs:[...s.evidenceRefs,ev('pet_train_stage',unlock,['PetId','TrainStage','SkillLevelMax'])]};}).sort((a,b)=>a.slot-b.slot);
  const status=representative.has(id)?'existing-catalog':phase2.has(id)?'configured-reference':null;assert(status,'Unreviewed site pet status '+id);audit.siteCoverage[id]={representativeCatalog:representative.has(id),phase2Reference:phase2.has(id),existingSkillLevels:require('../data/pet-skill-levels.json').pets.some(p=>p.id===id)};
  return {id,clientId:p.InternalId,sourceId:p.Id,nameKey:shape.ShapeNameKey,names:names(shape.ShapeNameKey),qualityRaw:p.Quality,availability:{state:status,currentReleaseVerified:false,clientVersion:p.ClientVersion,serverOpenDays:p.ServerOpenDays,serverOpenWeeks:p.ServerOpenWeeks},skills,evidenceRefs:[ev('pet_base',p,['PetSkill','Quality','DefaultShapeId','ServerOpenWeeks','ClientVersion']),ev('pet_shape',shape,['PetId','ShapeNameKey'])]};});
 // A reviewed source wording change must be audited rather than silently
 // keeping an old recommendation. Pinned hashes are added from the private
 // raw-source review; no full proprietary description text is exported.
 const descriptionPins=DESCRIPTION_PINS;
 for(const [id,pin]of Object.entries(descriptionPins)){const s=row('survivor_skill_type',id);assert.equal(hash(languages.en[s.DescriptionSquad]),pin,'Reviewed description changed: '+id);}
 const rules=RULE_DEFS.map(([id,heroId,petId,status,reasonKey,heroSkill,petSkill,conditions,alternates])=>{const hs=row('survivor_skill_type',heroSkill),ps=row('survivor_skill_type',petSkill);assert(descriptionPins[heroSkill]&&descriptionPins[petSkill]);return {id,heroId,petId,status,mode:'squad',reasonKey,conditionKeys:[...conditions,'hero-skill-unlocked','pet-skill-unlocked'],cautionKeys:['not-official-pairing','no-performance-estimate','current-rules-unverified',...(status==='practical-check'||reasonKey==='max-health-shield'?['modifier-order-unverified']:[]),...(heroId==='lava'?['healing-crosses-threshold']:[])],heroSkillIds:[hs.InternalId],petSkillIds:[ps.InternalId],alternatePetIds:alternates,evidenceRefs:[ev('survivor_skill_type',hs,['DescriptionSquad']),ev('survivor_skill_type',ps,['DescriptionSquad'])]};});
 for(const h of heroes)h.candidateRuleIds=rules.filter(r=>r.heroId===h.id).map(r=>r.id);
 const formation=readFormation(corpus);sources.push(formation.source);
 audit.effectGraphs=traceEffects(tables,Object.values(skillCatalog));
 const model={schemaVersion:1,version:{game:'2.6.200',build:1512,sourceManifestCreatedAt:source.manifest.createdAt,reviewedOn:'2026-11-05'},scope:{heroForms:35,heroIdentities:29,pets:10,petSkills:40,heroSkillBindings:heroes.reduce((n,h)=>n+h.skillIds.length,0),heroSkillLevelRows:heroes.reduce((n,h)=>n+h.skillIds.reduce((m,id)=>m+get('survivor_skill_main').rows.filter(r=>ref(r.SkillType)===id).length,0),0),directHeroPetPairingRecords:0,directPairingSearchScope:'the selected Survivor, PetBase and referenced skill records; not a claim about every client file or current server',pairingMeaning:'conditional effect compatibility; not an official pairing or combat optimum'},localePolicy:{officialClientLocales:LOCALES.filter(l=>!FALLBACK.has(l)),englishFallbackLocales:[...FALLBACK],fallbackIsOfficialTranslation:false},sources:[...sources,...languageSources],evidence,pets,heroes,skills:skillCatalog,rules,formation:formation.model,limitations:['No score, ranking, win rate, damage gain or optimum is asserted.','All six promoted forms remain held; pairing rules are not inherited automatically.','No current server or ownership eligibility is inferred.','Display-only parameters and runtime buff coefficients remain separate and are not published as combat coefficients.','The comparison tool does not certify a legal hero lineup; hero-slot and positional constraints remain unresolved.']};
 validate(model);audit.summary={tables:TABLES.length,rawRows:audit.rawTables.reduce((n,t)=>n+t.rows,0),petSkills:40,heroSkillBindings:model.scope.heroSkillBindings,heroSkillLevelRows:model.scope.heroSkillLevelRows,rules:rules.length,dataBased:rules.filter(r=>r.status==='data-based').length,practicalCheck:rules.filter(r=>r.status==='practical-check').length,heroesWithCandidates:heroes.filter(h=>h.candidateRuleIds.length).length};audit.formation=formation.audit;return {model,audit};
}
function readFormation(corpus){
 const index=path.join(corpus,'integration-41/unity/priority-lua/textassets-index.jsonl'),entries=fs.readFileSync(index,'utf8').trim().split(/\r?\n/).map(JSON.parse).filter(x=>x.name==='PetFormationProxy.lua');assert.equal(entries.length,2);const texts=entries.map(e=>{const file=e.path.replaceAll('\\\\','\\'),b=fs.readFileSync(file);assert.equal(e.sha256,'629c4ba157413ba35d6c4a4516cb1b4b2d683f9b4bafe35fa080ac86a9d5160d','Reviewed original Lua text fingerprint');assert.equal(hash(b),e.sha256);assert.equal(b.length,e.bytes);return b.toString('utf8');});assert.equal(texts[0],texts[1]);assert(texts[0].includes('PetFormationProxy.MaxFormationPetCount = 1'));assert(texts[0].includes('math.min(self.MaxFormationPetCount, #petIds)'));assert(texts[0].includes('math.min(self.MaxFormationPetCount, #candidates)'));
 return {model:{maxPets:1,maxHeroes:null,currentServerVerified:false,scope:['City','FreightDef','FreightAtk','Arena3v3Def','AllStar3v3Def','SandTable','UnderGroundGoldMine'],sourceRef:'PetFormationProxy.lua',evidenceStatus:'retained-local-client-rule; original bundle/text chain independently rechecked',unsupported:['hero-slot-count','front-back-position-validity','live-server-eligibility']},source:{id:'PetFormationProxy.lua',kind:'retained-client-lua',sha256:entries[0].sha256,lines:[30,173,299]},audit:{index,entries:entries.map(e=>({bodySha256:e.bodySha256,sourceSha256:e.sourceSha256,rawObjectSha256:e.rawObjectSha256,path:e.path,sha256:e.sha256})),currentVariantSelectionVerified:false}};
}
function traceEffects(tables,skills){
 const byClass=new Map([...tables].map(([name,t])=>[t.reader.rootClass,name]));
 return skills.map(skill=>{const queue=[],seen=new Set(),records=[],edges=[],unresolved=[],events=[];
  for(const [key,table]of [['raidSkillId','pve_skill'],['raidNewSkillId','pve_new_skill'],['slgNewSkillId','survivor_slg_skill_new']])if(skill.runtime[key])queue.push({table,id:skill.runtime[key]});
  while(queue.length){const next=queue.shift(),identity=next.table+':'+next.id;if(seen.has(identity))continue;seen.add(identity);assert(seen.size<3000,'Unexpected graph explosion');const row=tables.get(next.table).byId.get(next.id);assert(row,'Dangling selected-mode effect '+identity);records.push({table:next.table,raw:clean(row)});
   const walk=(value,field)=>{if(value&&typeof value==='object'&&Number.isInteger(value.internalId)&&value.referenceClass){if(!value.internalId)return;const table=byClass.get(value.referenceClass);if(!table){unresolved.push({from:identity,field,targetClass:value.referenceClass,id:value.internalId,status:'table-outside-focused-scope'});return;}const edge={from:identity,field,to:table+':'+value.internalId,kind:'declared-reference'};edges.push(edge);if(tables.get(table).byId.has(value.internalId))queue.push({table,id:value.internalId});else unresolved.push({...edge,status:'missing-retained-target'});return;}if(Array.isArray(value))value.forEach((v,i)=>walk(v,field+'['+i+']'));else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))walk(v,field?field+'.'+k:k);};walk(row,'');
   if(next.table==='pve_skill_release'&&row.SkillEvent)events.push({recordId:row.InternalId,event:row.SkillEvent,status:'event-script-not-executed; null static Effect is not evidence of no effect'});
   if(next.table==='pve_new_effect'&&typeof row.EffectParam1==='string'){const buff=tables.get('pve_new_buff').bySourceId.get(row.EffectParam1);if(buff){edges.push({from:identity,field:'EffectParam1',to:'pve_new_buff:'+buff.InternalId,kind:'exact-source-id-string-match',interpretation:'Candidate configured binding, not a decoded numeric enum'});queue.push({table:'pve_new_buff',id:buff.InternalId});}}
   if(next.table==='pve_new_buff')for(const [i,value]of (row.ParamString||[]).entries()){const attr=tables.get('pve_attrlist_condition').bySourceId.get(value);if(attr){edges.push({from:identity,field:'ParamString['+i+']',to:'pve_attrlist_condition:'+attr.InternalId,kind:'exact-source-id-string-match',interpretation:'Candidate conditional attribute binding; no numeric enum inferred'});queue.push({table:'pve_attrlist_condition',id:attr.InternalId});}}
   if(next.table==='pve_attrlist_condition'){const attr=tables.get('pve_skill_attrlist').rows.filter(r=>r.EId===row.PveSkillAttrlistEid);assert.equal(attr.length,1,'Conditional attribute EId must resolve uniquely');edges.push({from:identity,field:'PveSkillAttrlistEid',to:'pve_skill_attrlist:'+attr[0].InternalId,kind:'explicit-eid-match'});queue.push({table:'pve_skill_attrlist',id:attr[0].InternalId});}
  }
  return {skillId:skill.clientId,sourceId:skill.sourceId,records,edges,unresolved,eventDrivenReleases:events};
 });
}
// Filled with SHA-256 fingerprints after direct retained-source inspection.
const DESCRIPTION_PINS={
  "survivor_maddie_skill_2": "da065154d0d449e7eeae9848546743bd36cf3826ecfa17070c0d7cfe41e5ec57",
  "survivor_ray_skill_2": "eb4a6e8a08c4761a8e5e370477c7666799cb8eb50c2656bd8713f2696c6ff63e",
  "pet_seal_skill_1": "4ba69467db6d5bcd0fcce9a500649c8d1ab9426328649c17a9ac12ab67379feb",
  "pet_seal_skill_2": "b1503c1b63fd3e2e009b00d92e6844a2f5b71447cdc5cec60653d9b01c1466b3",
  "pet_seal_skill_3": "747300849078a67afb22c24c4e5d8302ff6c96f6836cbd40d83f7b42abfa96f6",
  "pet_seal_skill_4": "3daeec75c833d5230006313e51b532d2029e793f6a82486456f5244702ec9259",
  "pet_raccoon_skill_1": "c5e7a9de6da0911faa93080f59916715b724903eec2d039a421e61358558cd03",
  "pet_raccoon_skill_2": "e7dbefc07a5d766924448ecd1cd52887b78a4f5371a763f52ee39cc29579eb83",
  "pet_raccoon_skill_3": "1e9480e15d94efc83411cc52cc9ce1bfa20de1b169ee8ad27357b6bb282e88c8",
  "pet_raccoon_skill_4": "3daeec75c833d5230006313e51b532d2029e793f6a82486456f5244702ec9259",
  "pet_turtle_skill_1": "f48bc3d7b40a28c4684d73416665cefcedcc3e9f5170fd22da11274e1eb17e8b",
  "pet_turtle_skill_2": "e7dbefc07a5d766924448ecd1cd52887b78a4f5371a763f52ee39cc29579eb83",
  "pet_turtle_skill_3": "0611ecfd1004a5ce795de7dfa69545630eea51739491cc915d66bea694a2b2e9",
  "pet_turtle_skill_4": "3daeec75c833d5230006313e51b532d2029e793f6a82486456f5244702ec9259",
  "pet_sheep_skill_1": "ce2b1cc56aae004e71993545bf5d66ce1b5d35404ab6e3f84d549fa081287984",
  "pet_sheep_skill_2": "51a715b42ba4ea1291b7311aa800c59d5e98e8749420a4c17fb49fd67d8b30e6",
  "pet_sheep_skill_3": "dcb988616262b6fbab785b74045e1fbde82aa9e70f9f642442983775bf338141",
  "pet_sheep_skill_4": "3daeec75c833d5230006313e51b532d2029e793f6a82486456f5244702ec9259",
  "pet_armored_boar_skill_1": "40d3717c233af2066fd7680e867cc737fdbc0c35d59973cd8f2c2580f220f0da",
  "pet_armored_boar_skill_2": "e94e95738562a554acf55b75a0c0da9b4035d1e38ef10abe2f5df9f3f006874b",
  "pet_armored_boar_skill_3": "ace0ef8b24410f644b97081884e3d30b67f84ccb9543d37510bcdbaf5ee886d0",
  "pet_armored_boar_skill_4": "3daeec75c833d5230006313e51b532d2029e793f6a82486456f5244702ec9259",
  "pet_shadow_hound_skill_1": "5c0ec3e8701e88cb2d0fbe5e2404884d102c36e7dc50beb6d59735dbe6254bc4",
  "pet_shadow_hound_skill_2": "b1503c1b63fd3e2e009b00d92e6844a2f5b71447cdc5cec60653d9b01c1466b3",
  "pet_shadow_hound_skill_3": "97aec25e6270d4a6ee933c6cdc7b720c1067eea86c0fd9f8db8e38844b2a903c",
  "pet_shadow_hound_skill_4": "3daeec75c833d5230006313e51b532d2029e793f6a82486456f5244702ec9259",
  "pet_whitebear_skill_1": "b78d2470343419d82e38cabd611701c131ba16cddb73ee56db9d9d542aaef23c",
  "pet_whitebear_skill_2": "b1503c1b63fd3e2e009b00d92e6844a2f5b71447cdc5cec60653d9b01c1466b3",
  "pet_whitebear_skill_3": "5ae8153eaed06c69241944b33400c34d1d38bc012b4cd1c28a051180648b0ea3",
  "pet_whitebear_skill_4": "3daeec75c833d5230006313e51b532d2029e793f6a82486456f5244702ec9259",
  "pet_starlight_deer_skill_1": "1f44b7f80c79ea75f2ba7c8a5c26435569553913b7fccea5ba598237690657e2",
  "pet_starlight_deer_skill_2": "51a715b42ba4ea1291b7311aa800c59d5e98e8749420a4c17fb49fd67d8b30e6",
  "pet_starlight_deer_skill_3": "31a690a1e37f5d2990b5d81cf7a8db551ec416b51f06f89eaa719e431bb5ce62",
  "pet_starlight_deer_skill_4": "3daeec75c833d5230006313e51b532d2029e793f6a82486456f5244702ec9259",
  "pet_fox_skill_1": "bc2264c90505971b5afbdf33b72d8c29f17cdfded4c49456f17d7dd010673765",
  "pet_fox_skill_2": "b1503c1b63fd3e2e009b00d92e6844a2f5b71447cdc5cec60653d9b01c1466b3",
  "pet_fox_skill_3": "a53f05c7e5d9b97d8e0d04fde2dd0aae2a84089b746c7507bda8e17d4b55583a",
  "pet_fox_skill_4": "3daeec75c833d5230006313e51b532d2029e793f6a82486456f5244702ec9259",
  "pet_crocodile_skill_1": "6345fed33e6ed581ffe26529ab2253aca16cefdf89cef1e52e3371faa0493806",
  "pet_crocodile_skill_2": "b1503c1b63fd3e2e009b00d92e6844a2f5b71447cdc5cec60653d9b01c1466b3",
  "pet_crocodile_skill_3": "06f2f5e2aaf35096ffc3f38d4fb872fd47b5381784c3f797268623163eeb68eb",
  "pet_crocodile_skill_4": "3daeec75c833d5230006313e51b532d2029e793f6a82486456f5244702ec9259",
  "survivor_chiron_attack": "0b2ff5b577c0d7be03d9d75346bb6a5176f22ccfd05354745532782bcc2c253a",
  "survivor_rusty_skill_1": "4d4fdc787758b782e393db7c7f297b0709e614d151ebc130fd21145915546025",
  "survivor_becca_skill_1": "61d58a0e862830f960ca9e5cf89bf49a75586569ecf293789cc4793c15550ed6",
  "survivor_rosie_skill_2": "a63f4de6fed3f22a369d205199008e6b355c64c18019123145e2caf188b790b3",
  "survivor_layla_skill_1": "def5fe90959b9b79f43c87d43ae067a624fa4e4387d97e2538bd3945c12be831",
  "survivor_candy_skill_1": "2818dc18caca438e0e7dce7a0c1b378249952427a13616f231caccb166846b8e",
  "survivor_mike_skill_1": "7dbc48bfac5a4c6c67aa5bad21947ea9bdbf3f5fbed8e9a9635f5dc92c0253c7",
  "survivor_ken_skill_1": "8d874b0a6b2ec9409337608ad586b4f0f840c3d61c6394c9d8d311df082b877e",
  "survivor_lava_skill_2": "da561070fbc42476fa6bee88283f204a7740999c7a95304a03d6d1b593bb1e45",
  "survivor_nikola_skill_2": "31c51dd9f7e4dee0afeb0386f85ffe7296fa05bda620b69179c733cf236f610e"
};
function build(corpus,privateOutput){const result=collect(corpus);fs.writeFileSync(path.join(ROOT,'data/hero-pet-relations.json'),JSON.stringify(result.model)+'\n');if(privateOutput){const out=path.resolve(privateOutput);assert(!out.startsWith(ROOT+path.sep),'Audit output must remain outside public repo');fs.writeFileSync(out,JSON.stringify(result.audit,null,2)+'\n');}console.log(JSON.stringify(result.audit.summary));return result;}
module.exports={collect,validate,build,RULE_DEFS,PET_FACTS,TABLES};
if(require.main===module){const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;},corpus=arg('--corpus');assert(corpus,'--corpus <retained private foundation-40 directory> required');build(path.resolve(corpus),arg('--audit-output'));}
