'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const {parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),D=require('../data/pet-skill-levels.json'),C=require('../data/pet-skill-levels-copy'),B=require('./build-pet-skill-levels');
const oldSkills=require('../data/foundation-40/pet-skills-41.json');
const base='c7e2ac44a9e4e3388b0c041d4faef70212d0217d',langs=['ko','en','ja','ru','zh-tw','de'],pets=['snowball','dodo','buckler','fluffy','hardhead','shadow','starhorn'];
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),page=(l,p)=>`${l}/database/pet-system/${p?p+'/':''}index.html`,doc=s=>parseHTML(s).document;
const baseline=new Map();
const original=file=>{if(!baseline.has(file))baseline.set(file,cp.execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8',maxBuffer:5e6}));return baseline.get(file);};
const normalize=s=>s.replace(/\r\n/g,'\n');
function semantic(n){
 if(n.nodeType===3)return n.textContent.trim()?n.textContent:null;
 if(n.nodeType===8)return['comment',n.textContent];
 const children=[];let text='';const flush=()=>{if(text.trim())children.push(text);text='';};
 for(const c of n.childNodes){if(c.nodeType===3)text+=c.textContent;else{flush();const value=semantic(c);if(value!==null)children.push(value);}}flush();
 return[n.nodeName,[...(n.attributes||[])].map(a=>[a.name,a.value]).sort((a,b)=>a[0].localeCompare(b[0])),children];
}
const extract=(d,s)=>[...d.querySelectorAll(s)].map(semantic);
const clone=x=>JSON.parse(JSON.stringify(x));
function stripOwned(d,lang,pet){
 d.querySelectorAll('[data-pet-skills-41],[data-pet-skill-levels],[data-pet-skill-levels-asset],link[data-pet-skills-style-41],[data-pet-skill-roster-41],[data-pet-skill-roster-levels]').forEach(n=>n.remove());
 if(pet){const id=pet==='starhorn'?'character-section-1':'pet-skills-heading-41',href=`/${lang}/database/pet-system/${pet}/#${id}`;d.querySelectorAll('.ts3-character-sections a').forEach(n=>{if(n.getAttribute('href')===href)n.remove();});}
}

test('all seven public pets keep skill maxima separate from the level-100 pet EXP curves',()=>{
 assert.equal(D.gameVersion,'2.6.200');assert.deepEqual(D.pets.map(p=>p.id).sort(),pets.slice().sort());
 for(const pet of D.pets){
  assert.deepEqual(pet.skills.map(s=>s.slot),[1,2,3,4]);
  for(const s of pet.skills){
   assert.equal(s.maxLevel,s.slot===1?6:1,`${pet.id}/${s.slot} actual skill maximum`);
   assert.deepEqual(Object.keys(s.names).sort(),langs.slice().sort());
   const levels=s.levels.map(r=>r.level);assert.equal(new Set(levels).size,levels.length);
   assert.deepEqual(levels,levels.slice().sort((a,b)=>a-b));
   assert.equal(s.highestVerifiedLevel,levels.length?Math.max(...levels):null);
   if(s.defaultLevel!=null)assert.equal(s.defaultLevel,s.highestVerifiedLevel);
   if(s.status==='verified-max')assert.equal(s.highestVerifiedLevel,s.maxLevel);
   if(s.status==='unverified'){assert.equal(s.highestVerifiedLevel,null);assert.equal(levels.length,0);}
   for(const row of s.levels){assert(Number.isInteger(row.level)&&row.level>=1&&row.level<=s.maxLevel);for(const lang of langs){assert(row.description[lang]?.trim());assert.doesNotMatch(row.description[lang],/\{\d+\}|<color|<\/color>|undefined|NaN/);}}
  }
 }
 const exp=require('../data/foundation-40/pet-exp-profiles.json');assert(exp.pets.every(p=>p.maxLevel===100));
 assert.doesNotMatch(JSON.stringify(D),/C:\\\\|audit-results|sourceSha256|decryptionKey|accessToken/);
});

test('existing level-one effect values, conditions, names and all approved skill images remain exact',()=>{
 for(const old of oldSkills.skills){const skill=D.pets.find(p=>p.id===old.pet).skills.find(s=>s.slot===old.slot),one=skill.levels.find(r=>r.level===1);assert(one,`${old.pet}/${old.slot} level 1`);
  for(const lang of Object.keys(old.names)){assert.equal(skill.names[lang],old.names[lang]);assert.equal(one.description[lang],old.description[lang],`${old.pet}/${old.slot}/${lang} unchanged reviewed Lv.1 effect`);}
  assert.equal(skill.unlockStage,old.unlockStage);assert.equal(skill.src,old.src);
  if(old.additionalLimit)for(const lang of Object.keys(old.additionalLimit))assert.equal(skill.additionalLimit[lang],old.additionalLimit[lang]);
  assert.deepEqual(fs.readFileSync(path.join(root,old.src)),Buffer.from(cp.execFileSync('git',['show',base+':'+old.src.slice(1)],{cwd:root,maxBuffer:2e6})));
 }
});

test('63 explicit skill levels retain reviewed parameter order, units and training-stage boundaries',()=>{
 // These are reviewed display parameters, not a combat-damage formula.
 const expected={snowball:[['500%'],['1%'],['5%'],['5%']],dodo:[['10%','10'],['2%'],['5%'],['5%']],buckler:[['25%','10%','10'],['2%'],['5%'],['5%']],fluffy:[['2','100%','10'],['2.5%'],['3%'],['7.5%']],hardhead:[['600%','25%','10'],['3.5%'],['3.5%'],['7.5%']],shadow:[['20%','10'],['1.5%'],['7.5%'],['7.5%']],starhorn:[['20%','8%','10'],['3%'],['2.5%'],['10%']]};
 let levels=0,descriptions=0;
 for(const pet of D.pets)for(const skill of pet.skills){
  assert.equal(skill.status,'verified-max');assert.deepEqual(skill.levels.map(r=>r.level),skill.slot===1?[1,2,3,4,5,6]:[1]);
  assert.deepEqual(skill.levels.map(r=>r.trainingStage),skill.slot===1?[0,1,2,3,4,5]:[[0,2,4,5][skill.slot-1]]);
  for(const row of skill.levels){assert.deepEqual(row.arguments,expected[pet.id][skill.slot-1],pet.id+'/'+skill.slot+'/'+row.level+' parameter order and unit');levels++;descriptions+=Object.keys(row.description).length;
   if(skill.slot===1)assert.deepEqual(row.description,skill.levels[0].description,'The explicit level rows have equal description coefficients; no invented increase');
  }
  if(skill.slot===1)for(const lang of langs)assert(skill.additionalLimit[lang]?.trim(),'Equal description values are explained');
 }
 assert.equal(levels,63);assert.equal(descriptions,378);
 const fluffy=D.pets.find(p=>p.id==='fluffy').skills[0].levels.at(-1);assert.match(fluffy.description.ko,/2초/);assert.match(fluffy.description.ko,/100%/);assert.match(fluffy.description.ko,/10초/);
});

test('42 static detail pages default to their highest verified effect and expose only supported levels',()=>{
 for(const lang of langs)for(const pet of D.pets){const file=page(lang,pet.id),d=doc(read(file)),section=d.querySelector(`[data-pet-skill-levels="${pet.id}"]`);assert(section,file);assert.equal(d.querySelectorAll('[data-pet-skill-levels]').length,1);assert.equal(d.querySelectorAll('h1').length,1);assert.equal(section.previousElementSibling,d.querySelector('.ts3-character-sections'));
  const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length,file+' unique IDs');
  const payload=JSON.parse(section.querySelector('[data-pet-skill-levels-data]').textContent);assert.equal(payload.skills.length,4);
  for(const s of pet.skills){const card=section.querySelector(`[data-pet-skill-slot="${s.slot}"]`),max=s.levels.find(r=>r.level===s.highestVerifiedLevel);assert(card);assert.equal(card.id,`pet-skill-${s.slot}-41`);assert.equal(card.querySelector('h3').textContent,s.names[lang]);
   if(!max){assert.equal(card.querySelectorAll('[data-skill-level],[data-skill-compare-toggle],[data-skill-effect]').length,0);assert(card.querySelector('[data-skill-unavailable]'));assert(card.textContent.includes(C[lang].unavailableMax));continue;}
   assert.equal(card.querySelector('[data-skill-effect]').textContent,max.description[lang]);
   const select=card.querySelector('[data-skill-level]');
   if(s.levels.length>1){assert(select);assert.deepEqual([...select.querySelectorAll('option')].map(o=>+o.value),s.levels.map(r=>r.level));assert.equal(+select.querySelector('[selected]').value,s.highestVerifiedLevel);assert(card.querySelector('[data-skill-controls]').hasAttribute('hidden'));assert(card.querySelector('[data-skill-comparison]').hasAttribute('hidden'));
    for(const row of s.levels)assert.equal(card.querySelector(`[data-skill-reference-level="${row.level}"] [data-skill-reference-effect]`).textContent,row.description[lang]);
   }else{assert.equal(select,null);assert(card.textContent.includes(C[lang].single));}
   const embedded=payload.skills.find(x=>x.slot===s.slot);assert.equal(embedded.highestVerifiedLevel,s.highestVerifiedLevel);assert.deepEqual(embedded.levels.map(x=>[x.level,x.description]),s.levels.map(x=>[x.level,x.description[lang]]));
  }
  assert.equal(d.querySelectorAll('[data-pet-skill-levels-asset]').length,2);
 }
});

test('existing tables, growth forms, official portraits, affiliate URLs and SEO remain unchanged on 48 pages',()=>{
 for(const lang of langs)for(const pet of [...pets,'']){const file=page(lang,pet),before=doc(original(file)),after=doc(read(file));stripOwned(before,lang,pet);stripOwned(after,lang,pet);
  for(const selector of['title,meta,link[rel="canonical"],link[hreflang],script[type="application/ld+json"]','main table','form','main img','a[href*="lootbar"]','script[type="application/json"]'])assert.deepEqual(extract(after,selector),extract(before,selector),`${file}: ${selector}`);
  assert.deepEqual(semantic(after.documentElement),semantic(before.documentElement),file+' complete DOM outside owned skill UI');
 }
 for(const file of['js/database-22.js','js/platform-math.js','js/platform-affiliate.js','js/pet-exp-profiles-40.js','js/pet-training-profiles-41.js','data/foundation-40/pet-exp-profiles.json','data/foundation-40/pet-training-profiles-41.json','data/foundation-40/starhorn-growth.json','data/companions.json','data/expansion-22/database.json','sitemap.xml','robots.txt']){if(file==='data/expansion-22/database.json')require('./client-truth-52-test-allowances').assertSource(JSON.parse(read(file)),JSON.parse(original(file)),file);else assert.equal(normalize(read(file)),normalize(original(file)),file+' unchanged protected file');}
});

test('the builder is byte-idempotent and all roster links retain the existing per-skill anchor scheme',()=>{
 for(const lang of langs){for(const pet of D.pets){const file=page(lang,pet.id),d=doc(read(file));B.applyPetSkillLevels(d,pet,lang,D);const once=d.documentElement.outerHTML;B.applyPetSkillLevels(d,pet,lang,D);assert.equal(d.documentElement.outerHTML,once);assert.equal(once,doc(read(file)).documentElement.outerHTML,file+' reproducible output');}
  const file=page(lang,''),d=doc(read(file));B.applyPetSkillRoster(d,lang,D);const once=d.documentElement.outerHTML;B.applyPetSkillRoster(d,lang,D);assert.equal(d.documentElement.outerHTML,once);assert.equal(once,doc(read(file)).documentElement.outerHTML);
  for(const pet of D.pets){const link=d.querySelector(`#pet-${pet.id} [data-pet-skill-roster-levels]`);assert(link);assert.equal(link.textContent,C[lang].roster);const href=link.getAttribute('href'),hash=href.split('#')[1];assert(doc(read(page(lang,pet.id))).getElementById(hash));}
 }
});

test('partial and unknown maximums never publish a fabricated full-level effect',()=>{
 const pet=clone(D.pets.find(p=>p.skills[0].levels.length>1)),skill=pet.skills[0];skill.levels=skill.levels.slice(0,2);skill.highestVerifiedLevel=skill.levels.at(-1).level;if('defaultLevel'in skill)skill.defaultLevel=skill.highestVerifiedLevel;skill.status='partial';
 const partial=doc(B.renderSkill(skill,pet,'ko'));assert(partial.documentElement.textContent.includes(C.ko.highest.replace('{level}',skill.highestVerifiedLevel)));assert.equal(partial.querySelector('[data-skill-effect]').textContent,skill.levels.at(-1).description.ko);assert.equal(partial.querySelector('[data-skill-level] option[selected]').value,String(skill.highestVerifiedLevel));
 const unknown={...skill,levels:[],highestVerifiedLevel:null,defaultLevel:null,status:'unverified'};const d=doc(B.renderSkill(unknown,pet,'ko'));assert.equal(d.querySelectorAll('[data-skill-effect],select').length,0);assert(d.querySelector('[data-skill-unavailable]'));
 assert.throws(()=>B.validatedSkill({...skill,highestVerifiedLevel:6},'ko'),/Highest verified/);
 assert.throws(()=>B.validatedSkill({...skill,levels:[...skill.levels,skill.levels[0]]},'ko'),/Duplicate/);
 assert.throws(()=>B.validatedSkill({...skill,levels:[{...skill.levels[0],level:100}]},'ko'),/Invalid skill level/);
});

test('client changes independent skill selections using exact descriptions and fails closed on invalid levels',()=>{
 for(const lang of langs){const pet=D.pets.find(p=>p.skills[0].levels.length>1),{document,window}=parseHTML(read(page(lang,pet.id))),selected=new Map();
  for(const select of document.querySelectorAll('[data-skill-level],[data-skill-compare-level]')){selected.set(select,select.querySelector('option[selected]')?.value||'');Object.defineProperty(select,'value',{get:()=>selected.get(select),set:v=>selected.set(select,String(v))});}
  vm.runInNewContext(read('js/pet-skill-levels.js'),{document,window});
  const first=pet.skills[0],card=document.querySelector('[data-pet-skill-slot="1"]'),select=card.querySelector('[data-skill-level]'),other=document.querySelector('[data-pet-skill-slot="2"] [data-skill-effect]')?.textContent;
  for(const row of first.levels){select.value=row.level;select.dispatchEvent(new window.Event('change'));assert.equal(card.querySelector('[data-skill-effect]').textContent,row.description[lang]);assert.equal(document.querySelector('[data-pet-skill-slot="2"] [data-skill-effect]')?.textContent,other);}
  const previous=card.querySelector('[data-skill-effect]').textContent;for(const value of['100','0','-1','NaN','1.5']){select.value=value;select.dispatchEvent(new window.Event('change'));assert.equal(card.querySelector('[data-skill-effect]').textContent,previous);}
  select.value=first.highestVerifiedLevel;const toggle=card.querySelector('[data-skill-compare-toggle]'),comparison=card.querySelector('[data-skill-compare-level]');toggle.checked=true;toggle.dispatchEvent(new window.Event('change'));assert.equal(card.querySelector('[data-skill-comparison]').hidden,false);
  for(const row of first.levels){comparison.value=row.level;comparison.dispatchEvent(new window.Event('change'));assert.equal(card.querySelector('[data-skill-comparison-effect]').textContent,row.description[lang]);assert.equal(card.querySelector('[data-skill-effect]').textContent,first.levels.at(-1).description[lang]);}
  toggle.checked=false;toggle.dispatchEvent(new window.Event('change'));assert.equal(card.querySelector('[data-skill-comparison]').hidden,true);
 }
});

test('malformed runtime payload leaves the static maximum effects available without enabling broken controls',()=>{
 const pet=D.pets.find(p=>p.skills[0].levels.length>1),{document,window}=parseHTML(read(page('ko',pet.id))),before=extract(document,'[data-skill-effect]');
 document.querySelector('[data-pet-skill-levels-data]').textContent='{invalid';
 assert.doesNotThrow(()=>vm.runInNewContext(read('js/pet-skill-levels.js'),{document,window}));
 assert.deepEqual(extract(document,'[data-skill-effect]'),before);assert(document.querySelector('[data-skill-controls]').hidden);
});

test('search index preserves every prior URL and uses the actual highest-level effect at each existing skill anchor',()=>{
 const old=JSON.parse(original('data/search-index.json')),now=JSON.parse(read('data/search-index.json')),key=x=>x.language+'|'+x.url,map=new Map(now.items.map(x=>[key(x),x]));
 for(const item of old.items)assert(map.has(key(item)),'Prior searchable URL '+key(item));
 for(const lang of langs)for(const pet of D.pets)for(const s of pet.skills){const max=s.levels.at(-1);if(!max)continue;const url=`/${lang}/database/pet-system/${pet.id}/#pet-skill-${s.slot}-41`,item=map.get(lang+'|'+url);assert(item,url);assert.equal(item.description,`Lv.${max.level} · ${max.description[lang]}`);}
});
