/* Primary gear effects for existing heroes; retain all original unlock context. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),D=require('../data/foundation-40/hero-gear-levels-41.json'),N=require('../data/foundation-40/official-character-locales.json'),C=require('../data/foundation-40/sea-hero-growth-copy'),M=require('../js/sea-hero-growth-40');
const langs=['ko','en','ja','ru','zh-tw'];
const copy={
 ko:{title:'전용 장비 주요 효과 비교',all:'주요 효과 전체 보기 (Lv.1–15)',effect:'주요 효과',condition:'게임 2.6.200 · 장비 레벨별 주요 효과입니다. 실제 사용 가능한 레벨은 해금 상태에 따라 다릅니다. 추가 해금 효과와 강화 비용은 이 비교에 포함하지 않습니다.'},
 en:{title:'Compare primary gear effects',all:'All primary effects (Lv.1–15)',effect:'Primary effect',condition:'Game 2.6.200 · Primary effects by gear level. Available levels depend on unlock progress. Additional unlock effects and upgrade costs are not included in this comparison.'},
 ja:{title:'専用装備の基本効果を比較',all:'基本効果の一覧（Lv.1–15）',effect:'基本効果',condition:'ゲーム2.6.200。装備レベルごとの基本効果です。使用できるレベルは解放状況によって異なります。追加の解放効果と強化費用はこの比較に含まれません。'},
 ru:{title:'Сравнение основных эффектов снаряжения',all:'Все основные эффекты (ур.1–15)',effect:'Основной эффект',condition:'Версия 2.6.200. Основные эффекты по уровням снаряжения. Доступные уровни зависят от прогресса разблокировки. Дополнительные открываемые эффекты и стоимость улучшения в сравнение не входят.'},
 'zh-tw':{title:'比較專屬裝備主要效果',all:'全部主要效果（Lv.1–15）',effect:'主要效果',condition:'遊戲2.6.200。各裝備等級的主要效果。可使用的等級依解鎖進度而定；此比較不包含額外解鎖效果及強化費用。'}
};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fragment=(d,s)=>{const t=d.createElement('template');t.innerHTML=s;return t.content;};
const route=(l,id)=>l+'/heroes/'+(l==='en'&&id==='tarzan'?'tazan':id)+'/index.html';
const wrap=(title,table)=>`<div class="ts-table-wrap" role="region" tabindex="0" aria-label="${esc(title)}">${table}</div>`;
function build(){let changed=0;
 for(const gear of D.gears)for(const lang of langs){
  const file=path.join(root,route(lang,gear.id)),before=fs.readFileSync(file,'utf8'),d=parseHTML(before).document,t=copy[lang],c=C[lang],names=N.heroes.find(h=>h.id===gear.id).gear;
  const banner=d.querySelector('.ts-lootbar-slot--hero');assert(banner);const bannerHTML=banner.outerHTML,previous=banner.previousElementSibling,next=banner.nextElementSibling;
  const owned='[data-hero-gear-levels-41],#sea-hero-growth-data,script[data-hero-gear-client-41],link[data-hero-gear-client-41]';d.querySelectorAll(owned).forEach(n=>n.remove());
  assert(!d.querySelector('[data-sea-growth]'),'Unexpected existing sea comparison on '+gear.id);
  const section=gear.id==='undine'?d.querySelector('[data-hero-observations-40="equipment"]')?.closest('section'):d.querySelector('.equipment-grid')?.closest('section');assert(section,'Gear section missing '+route(lang,gear.id));
  const oldSection=section.innerHTML,skills=[...d.querySelectorAll('.ts-skill-body')].map(n=>n.outerHTML),metadata=[...d.querySelectorAll('title,meta[name=description],link[rel=canonical],link[hreflang]')].map(n=>n.outerHTML);
  const select=(name,label,value)=>`<label>${esc(label)}<select name="${name}">${gear.levels.map(r=>`<option value="${r.level}"${r.level===value?' selected':''}>Lv.${r.level}</option>`).join('')}</select></label>`;
  const initial=M.compareGear(gear,lang,1,15),block=d.createElement('div');block.id='hero-primary-gear-levels-41';block.setAttribute('data-sea-growth','gear');block.setAttribute('data-hero-gear-levels-41','');
  block.innerHTML=`<h3 id="hero-primary-gear-heading-41">${esc(t.title)}</h3><p>${esc(names.name[lang])} · ${esc(names.skillName[lang])}</p><p>${esc(t.condition)}</p><form hidden data-sea-growth-controls="gear">${select('from',c.from,1)}${select('to',c.to,15)}<span class="visually-hidden" role="status" aria-live="polite"></span></form>`+wrap(t.title,`<table id="sea-gear-live-table" data-static><thead><tr><th scope="col">${esc(t.effect)}</th><th scope="col">Lv.1</th><th scope="col">Lv.15</th></tr></thead><tbody><tr><th scope="row">${esc(names.skillName[lang])}</th><td>${esc(initial.from)}</td><td>${esc(initial.to)}</td></tr></tbody></table>`)+`<details><summary>${esc(t.all)}</summary>`+wrap(t.all,`<table data-static data-hero-gear-all-41><thead><tr><th scope="col">${esc(c.level)}</th><th scope="col">${esc(t.effect)}</th></tr></thead><tbody>${gear.levels.map(r=>`<tr><th scope="row">${r.level}</th><td>${esc(M.format(gear.descriptionTemplate[lang],r.args))}</td></tr>`).join('')}</tbody></table>`)+`</details>`;
  section.append(block);
  d.head.append(fragment(d,'<link data-hero-gear-client-41 rel="stylesheet" href="/css/sea-hero-growth-40.css?v=1">'));
  d.body.append(fragment(d,`<script id="sea-hero-growth-data" type="application/json">${JSON.stringify({language:lang,skills:[],gear,copy:c}).replaceAll('<','\\u003c')}</script><script data-hero-gear-client-41 src="/js/sea-hero-growth-40.js?v=1" defer></script>`));
  assert.equal(banner.outerHTML,bannerHTML);assert.equal(banner.previousElementSibling,previous);assert.equal(banner.nextElementSibling,next);assert.equal(section.innerHTML.slice(0,oldSection.length),oldSection);assert.deepEqual([...d.querySelectorAll('.ts-skill-body')].map(n=>n.outerHTML),skills);assert.deepEqual([...d.querySelectorAll('title,meta[name=description],link[rel=canonical],link[hreflang]')].map(n=>n.outerHTML),metadata);
  const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';if(after!==before){fs.writeFileSync(file,after);changed++;}
 }
 console.log(JSON.stringify({heroGearProfiles:D.gears.length,levelRows:255,newLevelAssociations:237,pages:85,changed}));
}
module.exports={build,copy,route};if(require.main===module)build();
