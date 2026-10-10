'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), {parseHTML} = require('linkedom');
const root = path.resolve(__dirname, '..'), D = require('../data/product-50/growth-gear.json'), C = require('../data/product-50/growth-copy'), M = require('../js/growth-50');
const langs = ['ko','en','ja','ru','zh-tw','de'];
const RD=require('../data/product-50/growth-research.json'),RC=require('../data/product-50/growth-research-copy');
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const heroRoute = (lang,id) => `${lang}/heroes/${['en','de'].includes(lang) && id === 'tarzan' ? 'tazan' : id}/index.html`;
const n = (value, lang) => value.toLocaleString(lang === 'zh-tw' ? 'zh-TW' : lang);
const wrap = (title,html,extra='') => `<div class="ts-table-wrap" tabindex="0" role="region" aria-label="${esc(title)}" ${extra}>${html}</div>`;
function render(lang, hero=null) {
 const t=C[lang], label=key=>key==='power'?t.power:D.stats[key][lang]+(lang==='de'&&key==='hp'?' (HP)':'');
 const select=(key,text,val)=>`<label>${esc(text)}<select name="${key}">${D.curve.map(r=>`<option value="${r.level}"${r.level===val?' selected':''}>${r.level}</option>`).join('')}</select></label>`;
 const compare=M.compare(D.curve,1,15);
 const intro=hero?`<p>${esc(hero.name[lang])} · ${esc(hero.gearName[lang])}</p>`:`<p>${esc(t.intro)}</p>`;
 const full=hero?.id==='undine'?'':`<details><summary>${esc(t.all)}</summary>${wrap(t.all,`<table data-growth-all><thead><tr><th scope="col">${esc(t.level)}</th>${M.metrics.map(k=>`<th scope="col">${esc(label(k))}</th>`).join('')}</tr></thead><tbody>${D.curve.map(r=>`<tr><th scope="row">${r.level}</th>${M.metrics.map(k=>`<td>${n(r[k],lang)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)}</details>`;
 const related=hero?`<p><a href="/${lang}/database/exclusive-gear/#gear-stats-50">${esc(t.database)}</a></p>`:`<h3>${esc(t.heroes)}</h3><ul class="ts-growth50-links">${D.heroes.map(h=>`<li><a href="/${heroRoute(lang,h.id).replace('index.html','')}#gear-stats-50">${esc(h.name[lang])}<small>${esc(h.gearName[lang])}</small></a></li>`).join('')}</ul>`;
 return `<section id="gear-stats-50" class="ts-growth50" data-growth-50 data-search-entry><h3>${esc(t.title)}</h3>${intro}<p>${esc(t.condition)}</p><form hidden aria-label="${esc(t.title)}">${select('from',t.from,1)}${select('to',t.to,15)}</form><p data-growth-status role="status" aria-live="polite"></p>${wrap(t.title,`<table><thead><tr><th scope="col">${esc(t.metric)}</th><th scope="col" data-growth-from>${esc(t.level)} 1</th><th scope="col" data-growth-to>${esc(t.level)} 15</th><th scope="col">${esc(t.gain)}</th></tr></thead><tbody>${compare.map(v=>`<tr data-growth-metric="${v.key}"><th scope="row">${esc(label(v.key))}</th>${['from','to','gain'].map(k=>`<td data-value="${k}">${n(v[k],lang)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,'data-growth-results')}${full}${related}<script type="application/json" data-growth-config>${JSON.stringify({language:lang,curve:D.curve,copy:{level:t.level,error:t.error}}).replaceAll('<','\\u003c')}</script></section>`;
}
function build({requireAll=false,heroIds=null,includeGearHub=true}={}) {
 let changed=0, pages=0, skipped=[];
 const targeted=Array.isArray(heroIds);
 if(targeted){assert(heroIds.length>0 && new Set(heroIds).size===heroIds.length,'Invalid hero allowlist');for(const id of heroIds)assert(D.heroes.some(h=>h.id===id),'Unknown hero '+id);}
 const selectedHeroes=targeted?D.heroes.filter(h=>heroIds.includes(h.id)):D.heroes;
 for(const lang of langs) for(const hero of [...selectedHeroes,...(includeGearHub?[null]:[])]) {
  const rel=hero?heroRoute(lang,hero.id):`${lang}/database/exclusive-gear/index.html`,file=path.join(root,rel);
  if(!fs.existsSync(file)){if(requireAll)throw Error('Missing6-language route '+rel);skipped.push(rel);continue;}
  const before=fs.readFileSync(file,'utf8'),d=parseHTML(before).document;
  if(targeted && !hero){
   const existingLinks=d.querySelector('#gear-stats-50 .ts-growth50-links');assert(existingLinks,'Missing existing gear links '+rel);
   const replacement=parseHTML(render(lang)).document.querySelector('.ts-growth50-links');existingLinks.replaceWith(replacement);
   const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
   const oldDoc=parseHTML(before).document,newDoc=parseHTML(after).document;
   for(const doc of [oldDoc,newDoc])doc.querySelector('.ts-growth50-links').remove();
   assert.equal(newDoc.documentElement.outerHTML,oldDoc.documentElement.outerHTML,'Unexpected non-link hub modification '+rel);
   if(after!==before){fs.writeFileSync(file,after);changed++;}pages++;continue;
  }
  const phase1=hero && ['lagnar','dave'].includes(hero.id);
  d.querySelectorAll('[data-growth-50],link[data-growth50-asset],script[data-growth50-asset]'+(phase1?',link[data-content-60-style]':'')).forEach(x=>x.remove());
  const baseline=d.documentElement.outerHTML;
  const main=d.querySelector('main');assert(main,'Missing main: '+rel);
  const template=d.createElement('template');template.innerHTML=render(lang,hero);
  if(hero){const equip=d.querySelector('.equipment-grid')?.closest('section') || d.querySelector('[data-hero-observations-40="equipment"]')?.closest('section') || d.querySelector('[data-sea-growth="gear"]')?.closest('section');assert(equip,'Missing gear section '+rel);equip.append(template.content);}
  else {const old=d.querySelector('.ts-database-22')||main;old.append(template.content);}
  const link=d.createElement('link');link.setAttribute('data-growth50-asset','');link.rel='stylesheet';link.href='/css/growth-50.css?v=1';d.head.append(link);
  if(phase1){const shared=d.createElement('link');shared.setAttribute('data-content-60-style','');shared.rel='stylesheet';shared.href='/css/content-60.css?v=1';d.head.append(shared);}
  const js=d.createElement('script');js.setAttribute('data-growth50-asset','');js.src='/js/growth-50.js?v=1';js.defer=true;d.body.append(js);
  const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
  const check=parseHTML(after).document;check.querySelectorAll('[data-growth-50],link[data-growth50-asset],script[data-growth50-asset]'+(phase1?',link[data-content-60-style]':'')).forEach(x=>x.remove());assert.equal(check.documentElement.outerHTML,baseline,'Unexpected non-growth modification '+rel);
  if(after!==before){fs.writeFileSync(file,after);changed++;}pages++;
 }
 let researchPages=0;
 for(const lang of targeted?[]:langs){
  const rel=`${lang}/buildings/lab/index.html`,file=path.join(root,rel);
  if(!fs.existsSync(file)){if(requireAll)throw Error('Missing6-language route '+rel);skipped.push(rel);continue;}
  const before=fs.readFileSync(file,'utf8'),d=parseHTML(before).document;
  d.querySelectorAll('[data-growth-research-50],link[data-growth50-asset]').forEach(x=>x.remove());const baseline=d.documentElement.outerHTML;
  const host=d.querySelector('main > .container');assert(host,'Missing lab content '+rel);
  const template=d.createElement('template');template.innerHTML=renderResearch(lang);host.append(template.content);
  const link=d.createElement('link');link.setAttribute('data-growth50-asset','');link.rel='stylesheet';link.href='/css/growth-50.css?v=1';d.head.append(link);
  const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n',check=parseHTML(after).document;check.querySelectorAll('[data-growth-research-50],link[data-growth50-asset]').forEach(x=>x.remove());assert.equal(check.documentElement.outerHTML,baseline,'Unexpected lab modification '+rel);
  if(after!==before){fs.writeFileSync(file,after);changed++;}pages++;researchPages++;
 }
 let gearExpPages=0;
 for(const lang of targeted?[]:langs){
  const rel=`${lang}/database/gear-exp/index.html`,file=path.join(root,rel);
  if(!fs.existsSync(file)){if(requireAll)throw Error('Missing6-language route '+rel);skipped.push(rel);continue;}
  const before=fs.readFileSync(file,'utf8'),d=parseHTML(before).document;d.querySelectorAll('[data-growth-exp-condition-50]').forEach(x=>x.remove());const baseline=d.documentElement.outerHTML;
  const form=d.querySelector('form[data-growth-form="gear"]');assert(form,'Missing existing gear calculator '+rel);
  const note=d.createElement('p');note.setAttribute('data-growth-exp-condition-50','');note.textContent=C[lang].gearExpCondition;form.before(note);
  const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n',check=parseHTML(after).document;check.querySelectorAll('[data-growth-exp-condition-50]').forEach(x=>x.remove());assert.equal(check.documentElement.outerHTML,baseline,'Unexpected EXP modification '+rel);
  if(after!==before){fs.writeFileSync(file,after);changed++;}pages++;gearExpPages++;
 }
 console.log(JSON.stringify({builder:'growth-50',profiles:D.heroes.length,selectedProfiles:selectedHeroes.length,commonCurveRows:15,researchProfiles:4,researchPages,gearExpPages,pages,changed,missingRoutes:skipped.length}));return {pages,changed,skipped};
}
function renderResearch(lang){
 const t=RC[lang];return `<section id="research-effects-50" class="ts-growth50" data-growth-research-50 data-search-entry><h2>${esc(t.title)}</h2><p>${esc(t.condition)}</p>${RD.profiles.map((p,i)=>`<section><h3>${esc(p.name[lang])}</h3><p>${esc(p.description[lang])}</p>${wrap(p.name[lang],`<table${i===0?' id="ts3-data-table-0"':''}><thead><tr><th scope="col">${esc(t.level)}</th><th scope="col">${esc(t.power)}</th></tr></thead><tbody>${p.levels.map(r=>`<tr><th scope="row">${r.level}</th><td>${n(r.power,lang)}</td></tr>`).join('')}</tbody></table>`)}</section>`).join('')}</section>`;
}
module.exports={build,render,renderResearch,heroRoute,langs};if(require.main===module){const selected=process.argv.find(a=>a.startsWith('--heroes='));build({requireAll:process.argv.includes('--require-all-languages'),heroIds:selected?selected.slice(9).split(','):null,includeGearHub:!process.argv.includes('--no-gear-hub')});}
