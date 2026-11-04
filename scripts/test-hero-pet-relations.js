'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const B=require('./build-hero-pet-relations'),data=require('../data/hero-pet-relations.json'),atlas=require('../data/hero-atlas-client.json');
const root=path.resolve(__dirname,'..'),corpus=process.env.TILES_CLIENT_CORPUS||path.resolve(root,'../audit-results/game-observations-20261009/foundation-40');
const clone=()=>structuredClone(data),sha=x=>crypto.createHash('sha256').update(x).digest('hex');

test('the public model is reproduced from captured-index-selected original CFG bytes, not normalized inputs',()=>{
 assert(fs.existsSync(corpus),'Provide TILES_CLIENT_CORPUS for the mandatory original-source release check');
 const result=B.collect(corpus);assert.deepEqual(result.model,data);assert.equal(result.audit.rawTables.length,22);assert.equal(result.audit.rawTables.reduce((n,t)=>n+t.rows,0),15790);assert(result.audit.normalizationComparisons.every(t=>t.allRawValuesEqual));
 assert.equal(result.audit.summary.heroSkillBindings,138);assert.equal(result.audit.summary.heroSkillLevelRows,4277);
 for(const t of result.audit.rawTables)assert.equal(sha(fs.readFileSync(t.path)),t.sha256,'Source was not changed while read '+t.table);
 for(const name of ['pet_base','survivor_skill_type','survivor_skill_main','pve_new_skill'])assert(result.audit.rawTables.find(t=>t.table===name).path.includes('loose-update'),name+' uses selected overlay, not stale pack');
});

test('all 29 published identities and six held promoted forms preserve their original client IDs and configured skill bindings',()=>{
 assert.equal(data.heroes.length,35);assert.equal(new Set(data.heroes.map(h=>h.identityId)).size,29);assert.equal(data.heroes.filter(h=>h.publication==='held').length,6);
 for(const h of data.heroes){const old=atlas.heroes.find(x=>x.id===h.id);assert(old);assert.equal(h.clientId,old.clientId);assert.equal(h.identityId,old.identityId);assert.deepEqual(h.skillIds,old.skillRefs.map(s=>s.key));if(h.publication==='held')assert.deepEqual(h.candidateRuleIds,[]);}
 assert(!data.heroes.some(h=>['furiosa','alita'].includes(h.id)),'No invented retained identities');
});

test('all existing published hero metadata and all 138 skill names and level summaries agree with the original selected cohort',()=>{
 const source=require('./client-audit/source.cjs').createSource(corpus),original=new Map(source.table('survivor').records.map(r=>[r.row.InternalId,r.row]));
 let count=0;for(const h of data.heroes){const old=atlas.heroes.find(x=>x.id===h.id),raw=original.get(h.clientId);assert(raw);for(const [key,field]of [['sourceId','Id'],['nameKey','Name'],['rarityRaw','Rarity'],['typeRaw','Type'],['professionRaw','Profession'],['factionRaw','Faction']])assert.deepEqual(old[key],raw[field],h.id+':'+field);assert.deepEqual(old.skillRefs,raw.SkillConfig);assert.equal(old.promotion.to,raw.SurvivorRarityUp?.internalId||null);
  for(const s of old.skills){const current=data.skills[s.clientId];assert.equal(s.sourceId,current.sourceId);assert.equal(s.nameKey,current.nameKey);assert.equal(s.skillNo,current.slot);assert.equal(s.levels.min,current.configuredLevelRange.min);assert.equal(s.levels.max,current.configuredLevelRange.max);assert.equal(s.levels.recordCount,current.configuredLevelRange.max-current.configuredLevelRange.min+1);for(const [locale,n]of Object.entries(current.names)){assert.equal(s.names[locale].value,n.value);assert.equal(s.names[locale].status,n.status);}count++;}
 }
 assert.equal(count,138);
});

test('ten pets integrate the existing seven-pet catalog and three configured reference pages without a release assertion',()=>{
 assert.deepEqual(data.pets.map(p=>p.id).sort(),['snowball','dodo','buckler','fluffy','hardhead','shadow','snowy','starhorn','chompy','hopper'].sort());
 assert.equal(data.pets.filter(p=>p.availability.state==='existing-catalog').length,7);assert.deepEqual(data.pets.filter(p=>p.availability.state==='configured-reference').map(p=>p.id).sort(),['chompy','hopper','snowy']);
 for(const p of data.pets){assert.equal(p.availability.currentReleaseVerified,false);for(const lang of Object.keys(p.names))assert(fs.existsSync(path.join(root,lang,'database/pet-system',p.id,'index.html')),lang+' existing pet detail '+p.id);}
 assert.equal(data.pets.find(p=>p.id==='hardhead').names.en.value,'Ironhead','Retained official label and historical URL stay separate');
});

test('all 40 pet skill identities, 90 level records and configured unlock stages are retained without arbitrary combat coefficients',()=>{
 assert.equal(data.pets.reduce((n,p)=>n+p.skills.length,0),40);assert.equal(data.pets.reduce((n,p)=>n+p.skills.reduce((m,s)=>m+s.levelRange.max,0),0),90);
 for(const p of data.pets){assert.deepEqual(p.skills.map(s=>s.unlockStage),[0,2,4,5]);assert.deepEqual(p.skills.map(s=>s.levelRange.max),[6,1,1,1]);for(const s of p.skills){assert(s.runtime.raidNewSkillId||['pet_raccoon_skill_2','pet_raccoon_skill_3','pet_turtle_skill_2','pet_turtle_skill_3'].includes(s.sourceId));assert(!Object.hasOwn(s,'damagePercent'));}}
 assert(data.pets.find(p=>p.id==='snowy').skills[0].factKeys.includes('attack-down'));assert(!data.pets.find(p=>p.id==='snowy').skills[0].factKeys.includes('defense-down'));
});

test('conditional recommendations cite both bound skills, distinguish inference strength, and leave unsupported heroes empty',()=>{
 assert(B.validate(data));assert.equal(data.rules.length,14);assert.equal(data.rules.filter(r=>r.status==='data-based').length,4);assert.equal(data.rules.filter(r=>r.status==='practical-check').length,10);
 assert.equal(data.heroes.filter(h=>h.candidateRuleIds.length).length,11);assert.equal(Math.max(...data.heroes.map(h=>h.candidateRuleIds.length)),2);
 assert(!data.rules.some(r=>r.heroId==='kiron'),'A generic defense reduction cannot be assumed to satisfy a named Chiron buff condition');assert.deepEqual(data.heroes.find(h=>h.id==='kiron').candidateRuleIds,[]);
 const becca=data.rules.filter(r=>r.heroId==='beka');assert(becca.some(r=>r.conditionKeys.includes('target-below-25')));assert(becca.some(r=>r.conditionKeys.includes('target-below-30-and-35')));
 for(const r of data.rules.filter(r=>r.heroId==='lava')){assert.equal(r.status,'practical-check');assert(r.cautionKeys.includes('healing-crosses-threshold'));assert(r.conditionKeys.includes('hero-below-50'));}
 assert.deepEqual(data.heroes.find(h=>h.id==='travis').candidateRuleIds,[],'No filler top-three list');
});

test('public validation rejects changed ownership, invented certainty, missing evidence, altered conditions and fabricated performance',()=>{
 for(const mutate of [d=>{d.rules[0].heroId='lucky';},d=>{d.rules.find(r=>r.status==='practical-check').status='data-based';},d=>{delete d.evidence[d.rules[0].evidenceRefs[0]];},d=>{d.rules.find(r=>r.heroId==='beka').conditionKeys=d.rules.find(r=>r.heroId==='beka').conditionKeys.filter(k=>k!=='same-target');},d=>{d.rules[0].cautionKeys=d.rules[0].cautionKeys.filter(k=>k!=='no-performance-estimate');},d=>{d.rules[0].winRate=99;},d=>{d.pets[0].skills[0].unlockStage=1;},d=>{d.pets[0].skills[0].factKeys.push('invented-buff');},d=>{d.rules.pop();},d=>{d.heroes.find(h=>h.id==='rusty').publication='held';}]){const d=clone();mutate(d);assert.throws(()=>B.validate(d));}
});

test('retained names distinguish 18 official client language cohorts from three English fallback cohorts',()=>{
 assert.equal(data.localePolicy.officialClientLocales.length,18);assert.deepEqual([...data.localePolicy.englishFallbackLocales].sort(),['ar','nb','vi']);
 for(const item of [...data.pets,...Object.values(data.skills)])for(const locale of ['ar','vi','nb']){assert.equal(item.names[locale].status,'english-fallback');assert.equal(item.names[locale].value,item.names.en.value);}
 const d=clone();d.skills[Object.keys(d.skills)[0]].names.ar.status='client-official';assert.throws(()=>B.validate(d));
});

test('one retained pet slot is scoped to the observed local proxy, with unknown hero lineup and live-server constraints',()=>{
 assert.equal(data.formation.maxPets,1);assert.equal(data.formation.maxHeroes,null);assert.equal(data.formation.currentServerVerified,false);assert.deepEqual(data.formation.scope,['City','FreightDef','FreightAtk','Arena3v3Def','AllStar3v3Def','SandTable','UnderGroundGoldMine']);
 const src=data.sources.find(s=>s.id==='PetFormationProxy.lua');assert.equal(src.sha256,'629c4ba157413ba35d6c4a4516cb1b4b2d683f9b4bafe35fa080ac86a9d5160d');
 const d=clone();d.formation.maxHeroes=5;assert.throws(()=>B.validate(d));
});

test('public export contains compact facts and fingerprints, not whole original descriptions, raw effects or private paths',()=>{
 const text=JSON.stringify(data);for(const pattern of [/C:\\\\Users/i,/rawValues/,/RaidSkillParam_1/,/EffectParam2/,/Param3/,/<color=/,/The Baby Seal kicks up/,/The Polar Bear unleashes/])assert(!pattern.test(text),String(pattern));
 for(const s of Object.values(data.skills)){assert(!Object.hasOwn(s,'description'));if(s.descriptionKey)assert(/^[a-f0-9]{64}$/.test(s.descriptionSHA256));}
});

test('a named Chiron trigger blocks the previously plausible Ironhead recommendation, while low-health source thresholds stay distinct',()=>{
 const source=require('./client-audit/source.cjs').createSource(corpus),rows=name=>source.table(name).records.map(r=>r.row),conditional=rows('pve_attrlist_condition'),conditions=rows('pve_condition'),buffs=rows('pve_new_buff');
 const chiron=conditional.find(r=>r.Id==='survivor_chiron_damage_target_debuff'),trigger=conditions.find(r=>r.InternalId===chiron.Conditionid.internalId);
 assert.equal(chiron.InternalId,86900002);assert.equal(trigger.InternalId,158000186);assert.equal(trigger.Type,11);assert.deepEqual(trigger.ParamString,['chiron_skill_1_debuff_def']);assert(buffs.some(b=>b.Id==='pet_armored_boar_skill_1_buff'));assert(!trigger.ParamString.includes('pet_armored_boar_skill_1_buff'));
 for(const [id,threshold]of [['survivor_becca_crit_target_lowhp',300],['pet_seal_skill_3_target_lowhp_attr',250],['pet_shadow_hound_skill_3_kill_attr',350]]){const a=conditional.find(r=>r.Id===id),c=conditions.find(r=>r.InternalId===a.Conditionid.internalId);assert.equal(c.Type,6);assert.deepEqual(c.ParamInt,[threshold]);assert.equal(c.ConditionTarget,1);}
 const d=clone(),hero=d.heroes.find(h=>h.id==='kiron'),pet=d.pets.find(p=>p.id==='hardhead'),hs=hero.skillIds.find(id=>d.skills[id].sourceId==='survivor_chiron_attack'),ps=pet.skills[0].clientId;
 const rejected={...structuredClone(d.rules[0]),id:'chiron-ironhead-defense-window',heroId:'kiron',petId:'hardhead',heroSkillIds:[hs],petSkillIds:[ps],reasonKey:'defense-window',conditionKeys:['same-target','defense-reduction-active','hero-skill-unlocked','pet-skill-unlocked'],alternatePetIds:[],evidenceRefs:[...d.skills[hs].evidenceRefs,...d.skills[ps].evidenceRefs]};d.rules.push(rejected);hero.candidateRuleIds.push(rejected.id);assert.throws(()=>B.validate(d),/Unreviewed pairing rule/);
});
