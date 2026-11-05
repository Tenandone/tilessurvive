'use strict';
// Rebuild with --corpus <private retained-client directory>. Only reviewed,
// bounded facts are exported; full records and account state are not published.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSource}=require('./client-audit/source.cjs');
const ROOT=path.resolve(__dirname,'..');
const LOCALES=require('../data/i18n/locales.json').locales.map(x=>x.code);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const ref=x=>x?.internalId||0;
const plain=x=>x.replace(/<\/?color(?:=[^>]+)?>/g,'');
function build(corpus){
 const source=createSource(corpus),tables=new Map(),evidence=[];
 function get(name){if(!tables.has(name)){const t=source.table(name);assert.equal(t.version,'2.6.200');assert.equal(t.build,1512);tables.set(name,t.records.map(r=>r.row));evidence.push({table:name,sha256:t.sourceSHA256});}return tables.get(name);}
 const hero=get('survivor').find(x=>x.InternalId===25300242);assert.equal(hero.Id,'survivor_lava');assert.equal(hero.ChipNumberNew,null,'An alternate recruitment profile requires review');
 const languages={};
 for(const locale of LOCALES.filter(x=>!['ar','vi','nb'].includes(x))){const code={'zh-cn':'zh-CN','zh-tw':'zh-TW',ms:'my'}[locale]||locale;languages[locale]=JSON.parse(fs.readFileSync(path.join(corpus,'authorized-decryption/decoded-language','ingame-apk-'+code+'.json'),'utf8'));}
 const names=key=>{assert(languages.en[key],key);return Object.fromEntries(LOCALES.map(l=>[l,languages[l]?.[key]||languages.en[key]]));};
 assert(languages.en.survivor_lava_attack_description_newse.endsWith('for 3 seconds.'),'Reviewed burn duration changed');
 assert(languages.en.survivor_lava_skill_1_description_newse.includes('Berserk status for 5 seconds.'),'Reviewed Berserk duration changed');
 for(const clause of ['When Health is above 50%','When Health is below 50%'])assert(languages.en.survivor_lava_skill_2_description_newse.includes(clause),'Reviewed health branch changed');
 assert.equal(plain(languages.en.exclusive_weapon_skill_description_lava),'Increases Attack and Defense by {0}%.','Reviewed gear effect changed');
 const items={};
 function item(id){if(items[id])return;const x=get('itemlist').find(r=>r.InternalId===id);assert(x,'Missing material '+id);items[id]={clientId:id,names:names(x.Name)};}
 function cost(raw){assert(Array.isArray(raw)&&raw.length===1,'Expected one reviewed material');const r=raw[0];assert(Number.isSafeInteger(r.value)&&r.value>0);item(r.key);return {itemId:r.key,quantity:r.value};}
 const gear=get('survivor_exclusive_gear').find(r=>r.InternalId===ref(hero.ExclusiveGear));assert.equal(gear.Id,'lava_gear');
 const gearRows=get('survivor_exclusive_gear_main').filter(r=>ref(r.GearId)===gear.InternalId).sort((a,b)=>a.Level-b.Level);assert.equal(gearRows.length,20);
 // These two consumer operations establish destination-level costs and literal
 // locale-template arguments. No gameplay scaling is inferred from raw fields.
 const idx=fs.readFileSync(path.join(corpus,'integration-41/unity/textassets-index.jsonl'),'utf8').trim().split(/\r?\n/).map(JSON.parse);
 const lua=idx.find(x=>x.name==='SurvivorExclusiveGearModule.lua'&&x.sha256==='4d82e52f91e8106f4a56f9f243088bd429ff87c2963e6dfeabfb8579e136ce6f');assert(lua,'Reviewed gear consumer missing');
 const luaBytes=fs.readFileSync(lua.path);assert.equal(sha(luaBytes),lua.sha256);const text=luaBytes.toString('utf8');
 for(const token of ['self:GetSpecifyMainCell(survivorIid, mainCell.Level + 1)','ModuleRefer.ItemUseModule:GetLackItems(nextLvCell.ItemNeed)','local originParam = mainCell.GearSkillParam','g_Game.Utils.I18NEx(mainCell.GearSkillDes, paramList)'])assert(text.includes(token));
 evidence.push({consumer:'SurvivorExclusiveGearModule.lua',sha256:lua.sha256});
 let gearTotal=0;
 const exclusiveGear={clientId:gear.InternalId,names:names(gear.GearName),skillNames:names(gear.GearSkillName),costBasis:'destination-level',levels:gearRows.map((r,i)=>{assert.equal(r.Level,i+1);assert.equal(r.GearSkillDes,'exclusive_weapon_skill_description_lava');assert.equal(r.GearSkillParam.length,1);const c=cost(r.ItemNeed);assert.equal(c.itemId,210473);gearTotal+=c.quantity;const percentage=Number(r.GearSkillParam[0]);assert(Number.isFinite(percentage));return {level:r.Level,cost:c,cumulativeQuantity:gearTotal,attackAndDefensePercent:percentage,effect:Object.fromEntries(LOCALES.map(l=>[l,plain(names(r.GearSkillDes)[l]).replace('{0}',r.GearSkillParam[0])]))};}),totalFragments:gearRows.reduce((n,r)=>n+r.ItemNeed[0].value,0)};
 const ranks=get('survivor_rank_main').filter(r=>ref(r.SurvivorType)===hero.InternalId).sort((a,b)=>a.Rank-b.Rank||a.RankSmall-b.RankSmall);assert.equal(ranks.length,61);assert.equal(ranks[0].Rank,0);assert.equal(ranks[0].RankSmall,0);
 // Preserve the actual rank and substage. A Rank is not silently mapped to a
 // visual star count; live unlock rules/caps are deliberately separate.
 let rankTotal=0;const rankSteps=ranks.slice(1).map(r=>{assert.equal(r.ItemReq,null);assert.equal(r.ItemReqNew_A,null);const c=cost(r.ItemReqNew);assert.equal(c.itemId,210474);rankTotal+=c.quantity;return {rank:r.Rank,step:r.RankSmall,cost:c,cumulativeQuantity:rankTotal,configuredSkillCaps:r.SkillLevelMax};});
 const rankGroups=Array.from({length:10},(_,i)=>{const rows=rankSteps.filter(r=>r.rank===i+1);assert.deepEqual(rows.map(r=>r.step),[1,2,3,4,5,6]);return {rank:i+1,stepQuantities:rows.map(r=>r.cost.quantity),quantity:rows.reduce((n,r)=>n+r.cost.quantity,0),cumulativeQuantity:rows.at(-1).cumulativeQuantity,configuredSkillCaps:rows.at(-1).configuredSkillCaps};});
 const skillTypes=get('survivor_skill_type'),skillLevels=get('survivor_skill_main');
 const skills=hero.SkillConfig.map(binding=>{const s=skillTypes.find(r=>r.InternalId===binding.key);assert(s);const rows=skillLevels.filter(r=>ref(r.SkillType)===binding.key).sort((a,b)=>a.Level-b.Level);assert.equal(rows.length,s.SkillNo===3?5:50);return {clientId:s.InternalId,slot:s.SkillNo,names:names(s.Name),configuredLevelRange:{min:rows[0].Level,max:rows.at(-1).Level},materialCosts:rows.filter(r=>r.SlgItemReq).map(r=>({destinationLevel:r.Level,cost:cost(r.SlgItemReq)})),materialCostScope:'configured SlgItemReq only; no automatic cross-mode applicability',numericCombatCoefficientsPublished:false};});
 return {schemaVersion:1,heroId:'lava',clientId:hero.InternalId,gameVersion:'2.6.200',build:1512,reviewedOn:'2026-11-05',liveServerVerified:false,englishFallbackLocales:['ar','vi','nb'],recruitment:{cost:cost(hero.ChipNumber),basis:'configured ChipNumber; current acquisition methods vary'},exclusiveGear,rankGrowth:{visualStarMappingVerified:false,rankGroups,steps:rankSteps,totalFragments:rankTotal,recruitmentExcluded:true},skills,fixedSkillFacts:{burnDurationSeconds:3,berserkDurationSeconds:5,healthBranchPercent:50},items,evidence,limitations:{experienceNumbers:'held-unresolved-eight-byte-scalar',dynamicSkillPercentages:'held-native-description-formatter-unverified',currentServerUnlock:'not-verified'}};
}
if(require.main===module){const i=process.argv.indexOf('--corpus');assert(i>=0&&process.argv[i+1],'--corpus required');const data=build(path.resolve(process.argv[i+1]));fs.writeFileSync(path.join(ROOT,'data/xssr-lava-growth.json'),JSON.stringify(data)+'\n');console.log(JSON.stringify({gearLevels:data.exclusiveGear.levels.length,gearFragments:data.exclusiveGear.totalFragments,rankSteps:data.rankGrowth.steps.length,rankFragments:data.rankGrowth.totalFragments,skills:data.skills.map(s=>({id:s.clientId,levelRange:s.configuredLevelRange,costRows:s.materialCosts.length}))}));}
module.exports={build};
