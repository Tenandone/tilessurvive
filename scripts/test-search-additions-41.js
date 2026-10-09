'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{createRequire}=require('node:module'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),baseline='ebe0cd9f738e1c4e497ad17934139618a40c43f6';
const old=JSON.parse(execFileSync('git',['show',`${baseline}:data/search-index.json`],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024}));
const index=JSON.parse(fs.readFileSync(path.join(root,'data/search-index.json'),'utf8'));
const gear=require('../data/foundation-40/hero-gear-levels-41.json'),pets=require('../data/foundation-40/pet-training-profiles-41.json'),official=require('./lib/official-locales-40'),reviewed=require('./integration-41-test-allowances');
const langs=['ko','en','ja','ru','zh-tw'],heroIds=['beka','candy','jacob','kiki','kiron','laila','light','maddy','mike','nikola','ray','rosie','shark','tara','tarzan','tony','undine'];
let groups=0;
assert.equal(old.items.length,545);assert.equal(index.itemCount,635);assert.equal(index.items.length,635);assert.equal(new Set(index.items.map(i=>i.url)).size,635);
const correctedDuration={ko:'선택한 대기열의 남은 시간을 20시간 줄입니다.',en:'Reduces the selected queue countdown by 20 hours.',ja:'選択した待ち時間を20時間短縮。',ru:'Сокращает выбранную очередь на 20 часов.','zh-tw':'縮短所選佇列的倒數時間20小時。'};
let corrected=0;
for(const prior of old.items){
 const expected={...prior};
 if(prior.url===`/${prior.language}/database/items/#speedup-20h`){
  expected.description=`20시간 일반 가속 · ${correctedDuration[prior.language]} · ${prior.description.split(' · ').at(-1)}`;corrected++;
 }
 assert.equal(JSON.stringify(index.items.find(i=>i.url===prior.url)),JSON.stringify(expected),'Original search fields changed outside the reviewed duration correction: '+prior.url);
}
assert.equal(corrected,5);
assert(!/\{(?:hours|minutes)\}/.test(JSON.stringify(index.items)),'Search descriptions must contain rendered durations');
groups++;
assert.deepEqual(gear.gears.map(g=>g.id).sort(),heroIds.slice().sort());
const oldURLs=new Set(old.items.map(i=>i.url)),added=index.items.filter(i=>!oldURLs.has(i.url));
const expectedURLs=langs.flatMap(lang=>[...heroIds.map(id=>official.entries(lang).find(h=>h.type==='heroes'&&h.entity.id===id).route+'#hero-primary-gear-levels-41'),`/${lang}/database/pet-system/#pet-training-scope-41`]);
assert.deepEqual(added.map(i=>i.url).sort(),expectedURLs.sort());groups++;
for(const lang of langs){
 const local=added.filter(i=>i.language===lang);assert.equal(local.length,18);
 for(const item of local){
  const [route,anchor]=item.url.split('#'),document=parseHTML(fs.readFileSync(path.join(root,route,'index.html'),'utf8')).document;
  assert(document.getElementById(anchor),'Destination anchor must exist');assert((lang==='zh-tw'?['zh-tw','zh-Hant']:[lang]).includes(document.documentElement.lang),'Destination uses the expected language');
  assert.deepEqual(Object.keys(item),['language','type','title','description','url','aliases']);
  assert(!JSON.stringify(item).match(/(?:[A-Za-z]:\\|snapshotPath|sourceSha256|InternalId|STRUCTURED|\.bin\b|\.lua\b)/));
  if(anchor==='hero-primary-gear-levels-41'){
   assert.equal(item.type,old.items.find(i=>i.url===route).type,'Use the existing localized hero filter category');
   const entry=official.entries(lang).find(h=>h.route===route);assert(item.title.startsWith(entry.entity.names[lang]+' · '));
   assert(item.description.startsWith(entry.entity.gear.name[lang]+' · '+entry.entity.gear.skillName[lang]+' · '));
   assert.equal(reviewed.reviewedGearTables(document,lang,route).size,2);
  }else{
   reviewed.assertPetSelection(document,lang);
   assert.equal(item.aliases,pets.pets.flatMap(p=>[p.names[lang],p.resourceNames[lang]]).join(' '));
   assert.equal(pets.pets.length,7);
   for(const p of pets.pets)assert(item.aliases.includes(p.resourceNames[lang]),'Official material alias missing');
  }
 }
}
groups++;
// Exercise the actual builder without mutating public output: no-op rebuilding
// must preserve bytes/timestamp, and either missing anchor must abort publication.
const builder=path.join(__dirname,'build-search-index.js'),source=fs.readFileSync(builder,'utf8'),requireBuilder=createRequire(builder);
function run(missing){
 let writes=0;
 const fakeFS={...fs,readFileSync(file,...args){const result=fs.readFileSync(file,...args);if(missing&&path.resolve(file)===path.resolve(path.join(root,missing.route,'index.html')))return String(result).replace(`id="${missing.anchor}"`,`id="unavailable-test-fixture"`);return result;},writeFileSync(){writes++;throw Error('Unexpected public write in isolated builder test');}};
 vm.runInNewContext(source,{__dirname,path,console:{log(){}},require:name=>name==='node:fs'?fakeFS:requireBuilder(name)});
 assert.equal(writes,0);
}
run();groups++;
assert.throws(()=>run({route:'/ko/heroes/beka/',anchor:'hero-primary-gear-levels-41'}),/Missing reviewed search anchor/);groups++;
assert.throws(()=>run({route:'/ko/database/pet-system/',anchor:'pet-training-scope-41'}),/Missing reviewed search anchor/);groups++;
console.log(JSON.stringify({passed:true,groups,oldEntriesPreserved:540,reviewedDurationCorrections:5,addedGearAnchors:85,addedPetAnchors:5,totalEntries:635,scope:'Baseline objects with five exact duration corrections, exact reviewed additions, localized labels and material aliases, existing visible anchors, source-field boundary, actual builder no-op and rejection paths'}));
