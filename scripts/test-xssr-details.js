'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const X=require('./xssr-details-data'),B=require('./build-xssr-details'),codes=require('../data/i18n/locales.json').locales.map(x=>x.code);
test('fresh client identities retain their independent source bindings and release limits',()=>{
 assert(X.validate());assert.deepEqual(X.heroes().map(h=>h.clientId),[25300242,25300243,25300244]);
 assert.equal(X.data.version.game,'2.6.300');assert.equal(X.data.version.build,1531);
 for(const h of X.heroes()){assert.equal(h.clientAvailability.provesLiveRelease,false);assert.equal(h.skills.length,4);assert.equal(h.capabilities.formationPlanning,true);assert.equal(h.capabilities.numericSkills,true);assert.equal(h.skills.every(s=>s.numericEffects?.source==='xssr-skill-values'),true);}
 assert.equal(X.record('furiosa').typeRaw,3);assert.equal(X.record('alita').professionRaw,'assault');assert.equal(X.record('alita').clientAvailability.minVersion,'2.6.300');
 assert.equal(X.record('missing'),null);assert.equal(X.growth('future-xssr'),null);
});
test('shared profiles bind three verified cost curves without rarity-based inheritance',()=>{
 assert.equal(X.profiles.rankProfiles.length,1);assert.equal(X.profiles.gearProfiles.length,1);assert.equal(X.profiles.skillManualProfiles.length,1);
 for(const h of X.heroes()){
  const g=X.growth(h.id);assert.equal(g.binding.rankRowIds.length,61);assert.equal(h.growth.rankRows.length,60);assert.equal(g.rank.totalFragments,3049);assert.equal(h.recruitment.cost.quantity,10);
  assert.deepEqual(g.rank.rankGroups.map(x=>x.cumulativeQuantity),[24,94,259,499,799,1159,1579,2029,2509,3049]);
  assert.equal(g.gear.totalFragments,650);assert.equal(h.exclusiveGear.levels.length,20);
  for(const s of h.skills.slice(0,3)){assert.equal(s.materialCosts.length,49);assert.equal(s.totalManualsToMax,35555);assert.deepEqual(s.configuredLevelRange,{min:1,max:50});}
  assert.deepEqual(h.skills[3].configuredLevelRange,{min:1,max:5});assert.equal(h.skills[3].automaticUpgrade,true);
 }
});
test('gear values use bound integer attributes and exact native text parameters',()=>{
 for(const h of X.heroes()){
  const first=h.exclusiveGear.levels[0],last=h.exclusiveGear.levels.at(-1);
  assert.deepEqual([first.attack,first.defense,first.health],[3600,720,240000]);assert.deepEqual([last.attack,last.defense,last.health],[30960,6190,2064000]);
  for(const locale of codes)for(const row of h.exclusiveGear.levels){const text=X.gearEffect(h.id,row.level,locale);if(row.descriptionTemplates[locale]||row.descriptionTemplates.en){assert(text);assert(!/\{\d+\}|%%|undefined|NaN/.test(text));}else assert.equal(text,null);}
 }
 assert.deepEqual(X.record('alita').exclusiveGear.levels[0].skillDisplayParameters,['10%','10%']);
 assert.deepEqual(X.record('furiosa').exclusiveGear.levels[0].skillDisplayParameters,['10']);
 assert.equal(X.gearEffect('alita',21),null);
});
test('all localized names and materials come from captured dictionaries or English fallback',()=>{
 for(const h of X.heroes())for(const locale of codes){assert(h.names[locale]);for(const skill of h.skills){assert(Object.hasOwn(skill.names,locale));assert(Object.hasOwn(skill.descriptionTemplates,locale));assert(skill.names[locale]===null||typeof skill.names[locale]==='string');}assert(Object.hasOwn(h.exclusiveGear.names,locale));}
 for(const item of Object.values(X.data.items))for(const locale of codes)assert(Object.hasOwn(item.names,locale));
 assert.equal(X.record('alita').skills[0].names.en,null);assert(X.record('alita').skills[0].names.ko);assert.equal(X.record('alita').capabilities.rankCosts,true);
 for(const source of X.data.sources){assert.equal(source.currentIndexMatch,true);assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.match(source.md5,/^[a-f0-9]{32}$/);}
 assert(!/C:\\\\|Users|Documents|Android\/data|candidateInt64LE/.test(JSON.stringify(X.data)));
});
test('capture reader rejects bytes that differ from the captured realtime index',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xssr-capture-test-'));
 try{fs.mkdirSync(path.join(dir,'BinaryConfig'));fs.writeFileSync(path.join(dir,'version.json'),JSON.stringify({version:'2.6.300',buildnumber:'1531'}));fs.writeFileSync(path.join(dir,'BinaryConfig','BinVersionList_Realtime.json'),JSON.stringify({survivor:'0'.repeat(32)}));fs.writeFileSync(path.join(dir,'BinaryConfig','survivor.bin'),'tampered');assert.throws(()=>B.createCapture(dir).table('survivor'),/differs from this capture/);}finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert(path.basename(dir).startsWith('xssr-capture-test-'));fs.rmSync(dir,{recursive:true,force:true});}
});
test('every published growth, gear and locale value reproduces from the fresh indexed client tables',()=>{
 const captureRoot=path.resolve(__dirname,'../../xssr-completion-review-20261105/client/current-26300');
 const result=B.makeDetails(B.createCapture(captureRoot),B.readLanguages(path.join(captureRoot,'decoded-language')));
 B.bindSkillValues(result.details,require('../data/xssr-skill-values.json'));
 function numericAndText(data){const copy=structuredClone(data);delete copy.mediaSources;for(const h of Object.values(copy.heroes)){delete h.portrait;delete h.thumbnail;delete h.exclusiveGear.icon;delete h.exclusiveGear.skillIcon;for(const skill of h.skills)skill.icon=null;}return copy;}
 assert.deepEqual(numericAndText(result.details),numericAndText(X.data));
 assert.deepEqual(result.profiles,X.profiles);
 assert.equal(result.details.sources.length,8);
});
test('skill parameters are bound to the owning hero and selected level without rank or gear additions',()=>{
 assert.deepEqual(X.skillParameters('alita',25401405,1),['100%','30%','10%','2']);assert.deepEqual(X.skillParameters('alita',25401406,50),['1788%']);
 assert.equal(X.skillParameters('lava',25401405,1),null);assert.equal(X.skillParameters('alita',25401405,51),null);assert.equal(X.skillParameters('alita',25401405,1.5),null);
 assert.equal(X.skillEffect('alita',25401405,1,'en'),null);assert(!/\{\d+\}/.test(X.skillEffect('alita',25401405,1,'ko')));
 for(const h of X.heroes())for(const s of h.skills)for(let level=s.configuredLevelRange.min;level<=s.configuredLevelRange.max;level++){assert(X.skillParameters(h.id,s.clientId,level));for(const locale of codes)if(s.descriptionTemplates[locale])assert(!/\{\d+\}|undefined|NaN|%%/.test(X.skillEffect(h.id,s.clientId,level,locale)));}
});
test('future relationship diff finds new IDs and growth-only changes outside the published registry',()=>{
 const audit=require('./client-audit/diff_hero_relationships.cjs'),tables={survivor:[{InternalId:1,Id:'unpublished_npc',SkillConfig:[{key:100}],ExclusiveGear:{internalId:300}}],survivor_skill_type:[{InternalId:100,Survivor:{internalId:1}}],survivor_skill_main:[{InternalId:101,SkillType:{internalId:100},Level:1}],survivor_rank_main:[{InternalId:200,SurvivorType:{internalId:1},ItemReqNew:[{key:4,value:3}]}],survivor_exclusive_gear:[{InternalId:300,Survivor:{internalId:1}}],survivor_exclusive_gear_main:[{InternalId:301,GearId:{internalId:300},Level:1}]};
 const source=data=>({table:name=>data[name]}),before=audit.snapshot(source(tables)),changed=structuredClone(tables);changed.survivor_rank_main[0].ItemReqNew[0].value=9;changed.survivor.push({InternalId:98765,Id:'unknown_future_hero',SkillConfig:[{key:999}],ExclusiveGear:null});
 const result=audit.diff(before,audit.snapshot(source(changed)));assert.deepEqual(result.added.map(h=>h.clientId),[98765]);assert.equal(result.changed[0].coreChanged,false);assert.deepEqual(result.changed[0].changedComponents,['ranks']);assert.deepEqual(result.missingReferences[0].missingReferences,['SurvivorSkillType:999']);assert.equal(result.publicationDecision,false);
});
test('universal fragments use the verified one-to-one conversion only for an already owned hero',()=>{
 for(const h of X.heroes()){const rule=h.growth.universalFragment;assert.equal(rule.itemId,202060);assert.equal(rule.requiresOwnedHero,true);assert.deepEqual(rule.exchangeRatio,{universal:1,dedicated:1});assert.equal(rule.conversionQuantityVerified,true);assert.equal(rule.usableForRecruitment,false);assert.notEqual(h.growth.fragmentItemId,rule.itemId);assert.equal(rule.consumer.method,'ItemlistConfigCell.GetExchangeSurvivorItemCount');assert.match(rule.consumer.boundedBytesSHA256,/^[a-f0-9]{64}$/);}
 assert(X.data.items[202060].descriptions.en.includes('currently own'));
});
function auditFixture(){return{survivor:[{InternalId:1,Id:'survivor_sample',Name:'hero_sample_name',ImageBig:'portrait_sample',SkillConfig:[{key:100}]}],survivor_skill_type:[{InternalId:100,Name:'skill_sample_name',DescriptionSquad:'skill_sample_desc',Survivor:{internalId:1},RaidNewSkill:{internalId:400,referenceClass:'PveNewSkill'}}],survivor_skill_main:[{InternalId:101,SkillType:{internalId:100},Level:1,RaidSkillParam_1:['pve_buff|sample_buff|param3|0|1']}],survivor_rank_main:[],survivor_exclusive_gear:[],survivor_exclusive_gear_main:[],pve_new_skill:[{InternalId:400,Id:'sample_skill',Effect:{internalId:401,referenceClass:'PveNewEffect'}}],pve_new_effect:[{InternalId:401,Id:'sample_effect',EffectParam2:1200}],pve_new_buff:[{InternalId:402,Id:'sample_buff',Param3:[25]}]};}
test('optional image evidence detects a changed hash without a hero-row change',()=>{
 const audit=require('./client-audit/diff_hero_relationships.cjs'),tables=auditFixture(),source={table:name=>tables[name]},assets=[{name:'portrait_sample',sha256:'a'.repeat(64)}],before=audit.snapshot(source,{assets});
 const after=audit.snapshot(source,{assets:[{name:'portrait_sample',sha256:'b'.repeat(64)},{name:'new_skill_icon',sha256:'c'.repeat(64)}]}),result=audit.diff(before,after);
 assert.deepEqual(result.changedManifestKeys,['portrait_sample','new_skill_icon']);assert.deepEqual(result.changed[0].changedImageKeys,['portrait_sample']);assert.deepEqual(result.changed[0].changedComponents,['images']);assert.equal(result.changed[0].coreChanged,false);assert.equal(result.publicationDecision,false);
});
test('optional dictionaries identify changed and missing localized keys without English fallback',()=>{
 const audit=require('./client-audit/diff_hero_relationships.cjs'),tables=auditFixture(),source={table:name=>tables[name]},first={en:{hero_sample_name:'Sample',skill_sample_name:'Shot',skill_sample_desc:'Deals {0} damage'},ko:{hero_sample_name:'샘플'}};
 const next=structuredClone(first);next.ko.skill_sample_name='사격';next.en.skill_sample_desc='Deals {0} area damage';
 const result=audit.diff(audit.snapshot(source,{dictionaries:first}),audit.snapshot(source,{dictionaries:next}));
 assert.deepEqual(result.changed[0].changedTranslationKeys,{en:['skill_sample_desc'],ko:['skill_sample_name']});assert.deepEqual(result.changed[0].changedComponents,['translations']);assert.equal(result.changed[0].coreChanged,false);assert.equal(audit.snapshot(source,{dictionaries:first}).heroes[0].translations.locales.ko.skill_sample_desc,null);
});
test('publication coverage distinguishes absent identities, locale routes and actual missing files',()=>{
 const audit=require('./client-audit/diff_hero_relationships.cjs'),tables=auditFixture(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'xssr-coverage-test-'));
 try{fs.mkdirSync(path.join(dir,'en/heroes/sample'),{recursive:true});fs.writeFileSync(path.join(dir,'en/heroes/sample/index.html'),'<main>Sample</main>');tables.survivor.push({InternalId:2,Id:'survivor_new'});
  const result=audit.snapshot({table:name=>tables[name]},{published:{heroes:[{id:'sample',routes:{en:'/en/heroes/sample/',ko:'/ko/heroes/sample/'}}]},siteRoot:dir,locales:['en','ko','ja']}).publication;
  assert.deepEqual(result.missingClientIdentities,[{clientId:2,sourceId:'survivor_new'}]);assert.deepEqual(result.missingRoutes,[{id:'sample',locale:'ja'}]);assert.deepEqual(result.missingFiles,[{id:'sample',locale:'ko',route:'/ko/heroes/sample/'}]);assert.equal(result.fileChecks,'checked');
  assert.throws(()=>audit.snapshot({table:name=>tables[name]},{published:[{id:'sample',routes:{en:'/../../outside/'}}],siteRoot:dir}),/leaves supplied site root/);
 }finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert(path.basename(dir).startsWith('xssr-coverage-test-'));fs.rmSync(dir,{recursive:true,force:true});}
});
test('downstream-only effect and buff coefficient changes propagate to the bound hero',()=>{
 const audit=require('./client-audit/diff_hero_relationships.cjs'),first=auditFixture(),source=t=>({table:name=>t[name]}),before=audit.snapshot(source(first));
 for(const[table,field,value]of [['pve_new_buff','Param3',[30]],['pve_new_effect','EffectParam2',1350]]){const next=structuredClone(first);next[table][0][field]=value;const result=audit.diff(before,audit.snapshot(source(next)));assert.equal(result.changed.length,1);assert.equal(result.changed[0].coreChanged,false);assert.deepEqual(result.changed[0].changedComponents,['downstream']);assert.equal(result.changed[0].clientId,1);}
 const missing=structuredClone(first);missing.pve_new_buff=[];assert.deepEqual(audit.snapshot(source(missing)).heroes[0].downstream.missingReferences,['pve_new_buff:sample_buff']);
});
test('unprovided audit evidence stays unverified and corrupt optional source bytes still fail closed',()=>{
 const audit=require('./client-audit/diff_hero_relationships.cjs'),tables=auditFixture();for(const key of Object.keys(tables))if(key.startsWith('pve_'))delete tables[key];
 const result=audit.snapshot({table:name=>tables[name]});assert.equal(result.checks.assets,'not-checked');assert.equal(result.checks.translations,'not-checked');assert.equal(result.publication.status,'not-checked');assert.equal(result.heroes[0].downstream.status,'not-checked');assert.equal(result.checks.downstreamTables.pve_new_buff.status,'unavailable');assert.equal(result.heroes[0].images.records,null);
 assert.throws(()=>audit.snapshot({table:name=>{if(name==='pve_new_buff')throw new Error('pve_new_buff differs from this capture realtime index');return tables[name];}}),/differs from this capture/);assert.throws(()=>audit.readEvidence(['--asset-manifest']),/Missing value/);
});
