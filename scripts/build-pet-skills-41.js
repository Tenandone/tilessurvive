'use strict';
// Level-one descriptions for six existing pets. Original growth data stays intact.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),data=require('../data/foundation-40/pet-skills-41.json'),copy=require('../data/foundation-40/pet-skills-copy-41');
const legacy=require('./lib/pet-skills-legacy-41.json');
const langs=['ko','en','ja','ru','zh-tw'],pets=['snowball','dodo','buckler','hardhead','shadow','starhorn'];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const statScope={ko:'능력치는 표시된 레벨·훈련 단계·변신 상태 기준입니다.',en:'Stats apply to the level, training stage and evolution state shown.',ja:'能力値は表示されたレベル・訓練段階・進化状態のものです。',ru:'Характеристики относятся к указанным уровню, этапу тренировки и состоянию эволюции.','zh-tw':'屬性適用於所標示的等級、訓練階段與進化狀態。'};
function exactNode(d,html){const nodes=[...d.querySelectorAll('main h2,main p')].filter(n=>n.outerHTML===html);assert.equal(nodes.length,1,'Expected one reviewed legacy fragment');return nodes[0];}
function applyPetSkills(document,pet,lang){
 assert(pets.includes(pet)&&langs.includes(lang),'Unapproved pet or language');
 const skills=data.skills.filter(s=>s.pet===pet),t=copy[lang];assert.deepEqual(skills.map(s=>s.slot),[1,2,3,4]);
 assert.deepEqual(skills.map(s=>s.unlockStage),[0,2,4,5]);assert(skills.every(s=>s.level===1));
 const route=`/${lang}/database/pet-system/${pet}/`,main=document.querySelector('main'),stage=main.querySelector('.ts3-pet-stage'),nav=main.querySelector('.ts3-character-sections');assert(stage&&nav);
 const old=document.querySelector('[data-pet-skills-41]');
 if(old)assert.equal(old.getAttribute('data-pet-skills-41'),pet,'Unexpected existing skill block');
 old?.remove();document.querySelectorAll('link[data-pet-skills-style-41]').forEach(n=>n.remove());
 const headingId=pet==='starhorn'?'character-section-1':'pet-skills-heading-41';
 if(pet==='starhorn'){
  const l=legacy[lang],existing=document.getElementById(headingId);
  if(existing){assert.equal(existing.outerHTML,l.heading);exactNode(document,l.primary).remove();existing.remove();}
  else assert(old||[...main.querySelectorAll('[data-pet-training-retained-41]')].some(n=>n.textContent===l.retained),'Missing original Starhorn skill heading');
  const all=[...main.querySelectorAll('p')],combined=all.find(n=>n.outerHTML===l.combined);
  if(combined){combined.textContent=l.retained;combined.setAttribute('data-pet-training-retained-41','');}
  else assert(all.some(n=>n.hasAttribute('data-pet-training-retained-41')&&n.textContent===l.retained),'Original training detail changed');
  const scope=[...main.querySelectorAll('p')].find(n=>n.outerHTML===l.scopeParagraph);
  if(scope){exactNode(document,l.scopeHeading).remove();scope.textContent=statScope[lang];scope.setAttribute('data-pet-stat-scope-41','');}
  else assert(all.some(n=>n.hasAttribute('data-pet-stat-scope-41')&&n.textContent===statScope[lang]),'Missing exact stat scope');
 }
 const section=document.createElement('section');section.className='ts3-character-section ts3-pet-skills-41';
 section.setAttribute('data-pet-skills-41',pet);section.setAttribute('data-characters-generated','');section.setAttribute('aria-labelledby',headingId);
 section.innerHTML=`<h2 id="${headingId}">${esc(t.title)}</h2><p class="ts3-pet-skill-scope">${esc(t.scope)}</p><div class="ts3-pet-skill-list">${skills.map(s=>`<article class="ts3-pet-skill" id="pet-skill-${s.slot}-41" data-pet-skill-slot="${s.slot}"><img src="${esc(s.src)}" width="128" height="128" alt="" loading="lazy" decoding="async"><h3>${esc(s.names[lang])}<small>Lv.1</small></h3><p class="ts3-pet-skill-unlock">${esc(s.unlockStage?t.unlock.replace('{stage}',s.unlockStage):t.basic)}</p><p class="ts3-pet-skill-description">${esc(s.description[lang])}</p>${s.additionalLimit?`<p class="ts3-pet-skill-limit">${esc(s.additionalLimit[lang])}</p>`:''}</article>`).join('')}</div>`;
 nav.after(section);
 const anchorHref=route+'#'+headingId;
 const oldLinks=[...nav.querySelectorAll('a')].filter(a=>a.getAttribute('href')===anchorHref);assert(oldLinks.length<=1);oldLinks.forEach(a=>a.remove());
 const a=document.createElement('a');a.href=anchorHref;a.textContent=t.title;nav.prepend(a);
 const style=document.createElement('link');style.rel='stylesheet';style.href='/css/pet-skills-41.css?v=1';style.setAttribute('data-pet-skills-style-41','');document.head.append(style);
 return document;
}
function applyPetRoster(document,lang){
 assert(langs.includes(lang),'Unapproved roster language');
 const unconfirmed={ko:'미확인',en:'Unconfirmed',ja:'未確認',ru:'Не подтверждено','zh-tw':'待確認'};
 const snowballCopy=lang==='ko'?'공식 소개는 무작위 적에게 물 피해를 주는 효과를 설명합니다. 피해 계수는 미확인입니다.':'The announcement describes water damage to a random enemy. The coefficient is not confirmed.';
 const changes=[];
 for(const pet of ['snowball','dodo','buckler','hardhead','shadow']){
  const cards=document.querySelectorAll(`main #pet-${pet}.ts-pet-row`);assert.equal(cards.length,1,'Expected one reviewed roster card');const card=cards[0];
  const href=`/${lang}/database/pet-system/${pet}/#pet-skills-heading-41`,label=copy[lang].title+' · Lv.1';
  const owned=[...card.children].filter(n=>n.hasAttribute('data-pet-skill-roster-41'));
  assert(owned.length<=1,'Duplicate roster skill link');
  if(owned.length){const a=owned[0];assert.equal(a.tagName,'A');assert.equal(a.getAttribute('data-pet-skill-roster-41'),pet);assert.equal(a.getAttribute('href'),href);
   // The late six-language skill-level owner regenerates this link after legacy builds.
   if(a.hasAttribute('data-pet-skill-roster-levels')){a.removeAttribute('data-pet-skill-roster-levels');a.textContent=label;}
   assert.equal(a.textContent,label);assert.equal([...card.children].filter(n=>n.tagName==='DETAILS'||n.matches('span.ts-evidence-label')).length,0,'Old roster uncertainty duplicates the skill link');continue;}
  const old=[...card.children].filter(n=>pet==='snowball'?n.tagName==='DETAILS':n.matches('span.ts-evidence-label'));
  assert.equal(old.length,1,'Expected one reviewed roster uncertainty');
  const expected=pet==='snowball'?`<details><summary>${esc(copy[lang].title)}</summary><p>${esc(snowballCopy)}</p></details>`:`<span class="ts-evidence-label">${esc(copy[lang].title+' · '+unconfirmed[lang])}</span>`;
  assert.equal(old[0].outerHTML,expected,'Unexpected roster skill copy');
  const a=document.createElement('a');a.setAttribute('data-pet-skill-roster-41',pet);a.setAttribute('href',href);a.textContent=label;changes.push([old[0],a]);
 }
 // Validate every scoped card before changing the document.
 for(const [old,a]of changes)old.replaceWith(a);
 return document;
}
function build(){let changed=0;const write=(file,d,before)=>{const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';if(after!==before){fs.writeFileSync(file,after);changed++;}};for(const lang of langs){for(const pet of pets){const file=path.join(root,lang,'database/pet-system',pet,'index.html'),before=fs.readFileSync(file,'utf8');write(file,applyPetSkills(parseHTML(before).document,pet,lang),before);}const file=path.join(root,lang,'database/pet-system/index.html'),before=fs.readFileSync(file,'utf8');write(file,applyPetRoster(parseHTML(before).document,lang),before);}console.log(JSON.stringify({petSkillPages:30,petRosterPages:5,skills:24,changed}));}
if(require.main===module)build();
module.exports={applyPetSkills,applyPetRoster,langs,pets,statScope};
