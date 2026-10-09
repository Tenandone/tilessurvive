/* Extends existing, released sea heroes with explicit display values. */
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),D=require('../data/foundation-40/sea-hero-growth.json'),C=require('../data/foundation-40/sea-hero-growth-copy'),N=require('../data/foundation-40/official-character-locales.json'),legacy=require('../data/foundation-40/dave-copy');
const math=require('../js/sea-hero-growth-40');const langs=['ko','en','ja','ru','zh-tw'];
const capContext={ko:'예시 화면의 스킬 상한은 Lv.20입니다.',en:'The example screen has a Lv.20 skill cap.',ja:'参考画面のスキル上限はLv.20です。',ru:'На примере экрана предел навыка — ур.20.','zh-tw':'範例畫面的技能上限為Lv.20。'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fragment=(d,s)=>{const n=d.createElement('template');n.innerHTML=s;return n.content;};
const value=(s,u,l)=>(l==='ru'?s.replace('.',','):s)+(u==='percent-atk'?'% ATK':'%');
const wrap=(title,table)=>`<div class="ts-table-wrap" role="region" tabindex="0" aria-label="${esc(title)}">${table}</div>`;
function controls(t,kind,max,from,to){const select=(name,label,selected)=>`<label>${esc(label)}<select name="${name}">${Array.from({length:max},(_,i)=>`<option value="${i+1}"${i+1===selected?' selected':''}>Lv.${i+1}</option>`).join('')}</select></label>`;return`<form hidden data-sea-growth-controls="${kind}">${select('from',t.from,from)}${select('to',t.to,to)}<span class="visually-hidden" role="status" aria-live="polite"></span></form>`;}
function build(){let changed=0;
for(const id of ['lagnar','dave'])for(const lang of langs){const file=path.join(root,lang,'heroes',id,'index.html'),before=fs.readFileSync(file,'utf8'),d=parseHTML(before).document,t=C[lang],names=N.heroes.find(h=>h.id===id),gear=D.gears.find(g=>g.id===id),banner=d.querySelector('.ts-lootbar-slot--hero');assert(banner,'Missing hero banner');
const bannerHTML=banner.outerHTML,previous=banner.previousElementSibling,next=banner.nextElementSibling,skillsBefore=[...d.querySelectorAll('.ts-skill-body')].map(n=>n.textContent),metadataBefore=[...d.querySelectorAll('link[rel=canonical],link[hreflang],title,meta[name=description]')].map(n=>n.outerHTML);
d.querySelectorAll('[data-sea-growth],#sea-hero-growth-data,script[src^="/js/sea-hero-growth-40.js"],link[href^="/css/sea-hero-growth-40.css"]').forEach(n=>n.remove());
if(id==='dave'){
 const table=d.querySelector('[data-dave-skill]')?.closest('table');assert(table,'Dave observed comparison table missing');table.id='dave-live-level-table';
 for(const p of previous.querySelectorAll('p'))if(p.textContent===legacy[lang].condition)p.remove();
 const block=d.createElement('div');block.setAttribute('data-sea-growth','skills');block.id='dave-full-skill-levels';
 block.innerHTML=controls(t,'skills',40,10,11)+`<p>${esc(capContext[lang])} ${esc(t.skillCondition)}</p><details><summary>${esc(t.skillAll)}</summary>`+wrap(t.skillAll,`<table data-static><thead><tr><th scope="col">${esc(t.level)}</th>${D.dave.skills.map((s,i)=>`<th scope="col">${esc(names.skills[i].name[lang])}</th>`).join('')}</tr></thead><tbody>${D.dave.skills[0].values.map(r=>`<tr><th scope="row">${r.level}</th>${D.dave.skills.map(s=>`<td>${esc(value(s.values[r.level-1].value,s.unit,lang))}</td>`).join('')}</tr>`).join('')}</tbody></table>`)+`</details>`;
 table.parentElement.before(block); // The live table keeps the original observed values until interaction.
 const oldNote=[...next.querySelectorAll('p')].find(n=>n.textContent===legacy[lang].gearNote||n.hasAttribute('data-sea-gear-note'));
 if(oldNote){oldNote.setAttribute('data-sea-gear-note','');oldNote.textContent=t.gearNote.replace('{name}',names.gear.name[lang]);}
}
const block=d.createElement('div');block.setAttribute('data-sea-growth','gear');block.id='sea-exclusive-gear-levels';
const initial=math.compareGear(gear,lang,1,15);
block.innerHTML=`<h3 id="sea-exclusive-effects">${esc(t.gearTitle)}</h3><p>${esc(names.gear.name[lang])} · ${esc(names.gear.skillName[lang])}</p><p>${esc(t.gearCondition)}</p>`+controls(t,'gear',15,1,15)+wrap(t.gearTitle,`<table id="sea-gear-live-table" data-static><thead><tr><th scope="col">${esc(t.effect)}</th><th scope="col">Lv.1</th><th scope="col">Lv.15</th></tr></thead><tbody><tr><th scope="row">${esc(names.gear.skillName[lang])}</th><td>${esc(initial.from)}</td><td>${esc(initial.to)}</td></tr></tbody></table>`)+`<details><summary>${esc(t.gearAll)}</summary>`+wrap(t.gearAll,`<table data-static><thead><tr><th scope="col">${esc(t.level)}</th><th scope="col">${esc(t.effect)}</th></tr></thead><tbody>${gear.levels.map(row=>`<tr><th scope="row">${row.level}</th><td>${esc(math.format(gear.descriptionTemplate[lang],row.args))}</td></tr>`).join('')}</tbody></table>`)+`</details><h4>${esc(t.unlock)}</h4><ul>${gear.unlocks.map(u=>`<li><strong>Lv.${u.level}</strong> · ${esc(math.format(u.descriptionTemplate[lang],u.args))}</li>`).join('')}</ul>`;
const nav=next.querySelector('nav');if(nav)nav.before(block);else next.append(block);
d.head.append(fragment(d,'<link rel="stylesheet" href="/css/sea-hero-growth-40.css?v=1">'));
d.body.append(fragment(d,`<script id="sea-hero-growth-data" type="application/json">${JSON.stringify({language:lang,skills:id==='dave'?D.dave.skills:[],gear,copy:t}).replaceAll('<','\\u003c')}</script><script src="/js/sea-hero-growth-40.js?v=1" defer></script>`));
assert.equal(banner.outerHTML,bannerHTML);assert.equal(banner.previousElementSibling,previous);assert.equal(banner.nextElementSibling,next);assert.deepEqual([...d.querySelectorAll('.ts-skill-body')].map(n=>n.textContent),skillsBefore);assert.deepEqual([...d.querySelectorAll('link[rel=canonical],link[hreflang],title,meta[name=description]')].map(n=>n.outerHTML),metadataBefore);
const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';if(after!==before){fs.writeFileSync(file,after);changed++;}
}
console.log(JSON.stringify({pages:10,skillValues:120,gearLevels:30,gearUnlockEffects:4,changed}));}
module.exports={build};if(require.main===module)build();
