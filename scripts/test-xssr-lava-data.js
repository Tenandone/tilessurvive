'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {build}=require('./xssr-lava-data.js');
const root=path.resolve(__dirname,'..'),data=require('../data/xssr-lava-growth.json'),locales=require('../data/i18n/locales.json').locales.map(x=>x.code);
assert.equal(data.heroId,'lava');assert.equal(data.clientId,25300242);assert.equal(data.gameVersion,'2.6.200');assert.equal(data.liveServerVerified,false);
const expectedGear=[10,5,10,20,25,30,30,30,30,30,30,30,40,40,40,50,50,50,50,50];
assert.deepEqual(data.exclusiveGear.levels.map(x=>x.cost.quantity),expectedGear);
assert.deepEqual(data.exclusiveGear.levels.map(x=>x.attackAndDefensePercent),[10,12,14,16,18,20,22,23,24,25,26,27,28,29,30,31,32,33,34,35]);
assert.equal(data.exclusiveGear.totalFragments,650);assert.equal(data.exclusiveGear.levels.at(-1).cumulativeQuantity,650);
assert.equal(data.recruitment.cost.itemId,210474);assert.equal(data.recruitment.cost.quantity,10);
assert.deepEqual(data.rankGrowth.rankGroups.map(x=>x.quantity),[24,70,165,240,300,360,420,450,480,540]);
assert.equal(data.rankGrowth.totalFragments,3049);assert.equal(data.rankGrowth.steps.length,60);assert.equal(data.rankGrowth.recruitmentExcluded,true);assert.equal(data.rankGrowth.visualStarMappingVerified,false);
assert.deepEqual(data.skills.map(s=>s.configuredLevelRange.max),[50,50,50,5]);
for(const s of data.skills){assert.equal(s.numericCombatCoefficientsPublished,false);assert(!('damagePercent' in s));if(s.slot<3){assert.deepEqual(s.materialCosts.map(x=>x.destinationLevel),Array.from({length:49},(_,i)=>i+2));assert(s.materialCosts.every(x=>x.cost.itemId===201725&&x.cost.quantity>0));}else assert.equal(s.materialCosts.length,0);}
assert.deepEqual(data.fixedSkillFacts,{burnDurationSeconds:3,berserkDurationSeconds:5,healthBranchPercent:50});
for(const l of locales){for(const item of Object.values(data.items))assert(item.names[l]);for(const s of data.skills)assert(s.names[l]);for(const row of data.exclusiveGear.levels){assert(row.effect[l]);assert(!/\{\d+\}|<[^>]+>/.test(row.effect[l]));assert(row.effect[l].includes(String(row.attackAndDefensePercent)));}}
const serialized=JSON.stringify(data);assert(!/C:[\\/]|audit-results|authorized-decryption|tscfg:/.test(serialized),'Private source data must stay private');
assert.throws(()=>build(path.join(root,'data')),/private|public|source|manifest/i,'Public repository must not be used as private raw corpus');
const i=process.argv.indexOf('--corpus');let rawBuild=false;
if(i>=0){const corpus=path.resolve(process.argv[i+1]);const manifest=path.join(corpus,'selected-source-manifest.json'),hash=()=>crypto.createHash('sha256').update(fs.readFileSync(manifest)).digest('hex'),before=hash();const first=build(corpus),second=build(corpus);assert.deepEqual(first,data,'Published model must match a fresh raw parse');assert.deepEqual(first,second,'Repeated builds must be deterministic');assert.equal(hash(),before,'Original source manifest must not be mutated');rawBuild=true;}
console.log(JSON.stringify({status:'PASS',hero:'lava',gearLevels:20,rankSteps:60,locales:locales.length,rawBuildAndDeterminism:rawBuild}));
