'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),runtime=require('../js/building-system');
const {model,evidence,langs,slugs,links,names,publicBuildings}=require('./building-data-registry');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assetVersion=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex').slice(0,12);
function pageName(slug,lang){if(slug==='houses')return require('../data/content-60/buildings-phase2-copy')[lang].houses;if(slug==='barracks')return{ko:'병영',en:'Barracks',ja:'兵舎',ru:'Казармы','zh-tw':'兵營',de:'Kasernen'}[lang];return model.buildings.find(b=>b.slug===slug).name[lang];}
function config(lang,slug){
 const old=require('../data/power-plant-copy.json').locales[lang],player=require('./building-player-labels')[lang];
 const pick=(obj,keys)=>Object.fromEntries(keys.map(key=>[key,obj[key]]));
 const copy={...require('./build-client-buildings-52').copy[lang],...require('../data/content-60/buildings-copy')[lang],...player};
 const buildings=publicBuildings(slug);
 if(!buildings.every(building=>building.profiles.every(profile=>profile.rows.some(row=>row.level===2))))copy.profileHint=player.profileHintInitial;
 const labels=pick(old.labels,['requirements','level','exactValues','capture','levelHeader','conditions','time','newConstruction','stage','none','exactValue','close','totals','levelPrefix','power']);
 labels.unknown='—';
 labels.totals={ko:'전체 성장 합계',en:'Full progression totals',ja:'全成長の合計',ru:'Итоги полного развития','zh-tw':'完整成長合計',de:'Summen der gesamten Entwicklung'}[lang];
 return {lang,slug,buildings:buildings,resources:model.resources,links,names,
 locale:{numberLocale:old.numberLocale,labels,units:old.units,messages:{numberLegend:player.numberLegend}},
 copy:pick(copy,['original','d','empty','profile','profileHint','sample','initial','sumNote','rawNote','effects','all','calculator','base','missing','selectFirst','legacyPowerNote','range','powerCondition','labCondition','from','to','inventory','invalid','shortage','items'])};
}
function publicConfig(cfg){
 const published=structuredClone(cfg);
 for(const building of published.buildings)for(const profile of building.profiles)for(const row of profile.rows){
   if(row.availability==='initial_conditions_unconfirmed')row.calculationBlocked=true;
   delete row.availability;
 }
 return published;
}
function sheet(lang,slug){const cfg=config(lang,slug),L=cfg.locale.labels,C=cfg.copy,max=Math.max(...cfg.buildings.flatMap(b=>b.profiles.flatMap(p=>p.rows.map(r=>r.level))));
 return `<section class="section building-system" data-building-system="${slug}" data-building-upgrade-sheet=""><div class="sheet-heading"><h2 id="upgrade-sheet" tabindex="-1">${esc(L.requirements)}</h2><span>${esc(L.levelPrefix)}1–${max}</span></div><p>${esc(C.rawNote)}</p><p class="variation">${esc(C.profileHint)}</p><div class="toolbar bs-controls"><label>${esc(C.profile)}<select data-bs-choice=""><option value="">${esc(C.empty)}</option>${cfg.buildings.flatMap(b=>b.profiles.map(p=>`<option value="${b.id}:${p.id}">${esc(b.name[lang]+' · '+(p.id==='original'?C.original:C.d))}</option>`)).join('')}</select></label><label>${esc(L.level)}<select data-bs-level=""><option value="all">${esc(C.all)}</option>${Array.from({length:Math.ceil(max/5)},(_,i)=>`<option value="${i*5+1}-${Math.min(max,i*5+5)}">${esc(L.levelPrefix)}${i*5+1}–${Math.min(max,i*5+5)}</option>`).join('')}${Array.from({length:max},(_,i)=>`<option value="${i+1}">${esc(L.levelPrefix)}${i+1}</option>`).join('')}</select></label><label class="exact-choice"><input type="checkbox" data-bs-exact="">${esc(L.exactValues)}</label><button type="button" data-bs-capture="">${esc(L.capture)} ↗</button></div><p class="number-hint">${esc(cfg.locale.messages.numberLegend)}</p>${cfg.buildings.map(b=>`<div id="building-${b.id}" class="bs-building">${cfg.buildings.length>1?`<h3>${esc(b.name[lang])}</h3>`:''}${b.profiles.map(p=>runtime.renderProfile(b,p,cfg)).join('')}</div>`).join('')}<details class="bs-calculator bs-controls" open><summary>${esc(C.calculator)}</summary><p>${esc(C.sumNote)}</p><form><fieldset data-bs-inputs="" disabled><legend>${esc(C.calculator)}</legend><div class="bs-fields"><label>${esc(C.from)}<input name="from" type="number" min="0" max="${max}" value="1" step="1"></label><label>${esc(C.to)}<input name="to" type="number" min="0" max="${max}" value="${Math.min(max,2)}" step="1"></label>${cfg.resources.map((r,i)=>`<label>${esc(r.name[lang]+' · '+C.inventory)}<input name="held-${i}" type="number" min="0" value="0" step="1"></label>`).join('')}</div></fieldset><output data-bs-result="" aria-live="polite">${esc(C.selectFirst)}</output></form></details><dialog aria-labelledby="bs-dialog-title"><form method="dialog"><h2 id="bs-dialog-title" data-bs-dialog-title="">${esc(L.exactValue)}</h2><p data-bs-dialog-value=""></p><button type="submit">${esc(L.close)}</button></form></dialog><script type="application/json" data-building-system-model>${JSON.stringify(publicConfig(cfg)).replaceAll('<','\\u003c')}</script></section>`;
}
function additionalEffects(lang,slug){
 const e=evidence.effects?.find(x=>x.slug===slug);if(!e)return'';const cfg=config(lang,slug),C=cfg.copy,L=cfg.locale.labels;
 return '<section class="section" data-bs-effects=""><h2 id="building-effects">'+esc(C.effects)+'</h2>'+e.profiles.map(p=>{const metrics=p.metrics||e.metrics;return '<details class="bs-effect-profile" open data-bs-effect-profile="'+p.id.toLowerCase()+'"><summary>'+esc(p.id.toLowerCase()==='original'?C.original:C.d)+'</summary><table class="bs-effect-table"><caption>'+esc(metrics.map(m=>m.name[lang]).join(' · '))+'</caption><thead><tr><th scope="col">'+esc(L.levelHeader)+'</th>'+metrics.map(m=>'<th scope="col">'+esc(m.name[lang])+(m.unit==='percent'?' (%)':'')+'</th>').join('')+'</tr></thead><tbody>'+p.rows.map(r=>'<tr data-effect-level="'+r.level+'" data-effect-rank="'+r.rank+'"><th scope="row">'+r.level+(r.rank?' · '+esc(L.stage)+' '+r.rank:'')+'</th>'+r.values.map((n,i)=>'<td data-effect-id="'+metrics[i].id+'" data-effect-value="'+n+'">'+(n===null?esc(L.unknown):n.toLocaleString(lang==='zh-tw'?'zh-TW':lang))+'</td>').join('')+'</tr>').join('')+'</tbody></table></details>';}).join('')+'</section>';
}

function project(html,lang,slug){
 const d=parseHTML(html).document,content=require('../data/building-system-copy'),entry=content.buildings[slug],T=content.labels[lang],cfg=config(lang,slug);assert(entry,slug);
 const hero=d.querySelector('main .hero');assert(hero,slug+' hero');
 // Earlier generic table builders numbered the new profile tables as well.
 // Restore the existing coal/troop fragments and every reference to those IDs.
 if(['power-plant','barracks'].includes(slug)){
   const table=[...d.querySelectorAll('main table')].find(t=>!t.closest('[data-building-system],[data-client-building-52],[data-building-growth-60]')&&t.querySelectorAll('thead th').length===3&&t.querySelectorAll('tbody tr').length===(slug==='power-plant'?30:10));
   if(table){const desired='ts3-data-table-'+(slug==='power-plant'?1:2),previous=table.id;if(previous!==desired){const alias=d.getElementById(desired);if(alias&&alias!==table)alias.remove();table.id=desired;if(previous)for(const node of d.querySelectorAll('*'))for(const attr of ['aria-controls','aria-labelledby','aria-describedby','data-table','href']){const value=node.getAttribute(attr);if(value?.includes(previous))node.setAttribute(attr,value.replaceAll(previous,desired));}}}
 }
 const name=pageName(slug,lang),category=require('../data/content-60/buildings-phase2-copy')[lang].buildings,url=`https://tilessurvive.net/${lang}/buildings/${slug}/`;
 d.querySelector('h1').textContent=name;d.querySelector('title').textContent=name+' | '+category+' | TilesSurvive.net';
 for(const n of d.querySelectorAll('meta[property="og:title"],meta[name="twitter:title"]'))n.setAttribute('content',name+' | TilesSurvive.net');
 for(const n of hero.querySelectorAll('img'))n.alt=name;
 const crumb=d.querySelector('main .breadcrumb [aria-current="page"]')||d.querySelector('main .breadcrumb span:last-child');if(crumb)crumb.textContent=name;
 const retainedAnchors=new Set([...d.querySelectorAll('[data-bs-legacy-anchor]')].map(n=>n.id));
 d.querySelectorAll('[data-bs-content],[data-bs-effects],[data-bs-related],[data-bs-legacy-anchor]').forEach(n=>n.remove());
 const targets=new Set([...d.querySelectorAll('[data-building-system],[data-power-plant-original],[data-building-growth-60]')]);
 d.querySelectorAll('[data-client-building-52]').forEach(n=>targets.add(n.closest('section.section')||n));
 d.querySelectorAll('[data-building-refinement-51]').forEach(n=>targets.add(n));
 if(['hero-academy','warbringer-monument','aegis-monument','guardian-of-life-monument','cursed-wound-stele','blessed-healing-stele'].includes(slug))d.querySelectorAll('main section.section').forEach(n=>{if(!n.hasAttribute('data-bs-content')&&!n.hasAttribute('data-bs-effects'))targets.add(n);});
 d.querySelectorAll('[data-building-upgrade-sheet]').forEach(n=>{if(!n.querySelector('table')&&!n.matches('[data-building-system]'))targets.add(n);});
 for(const target of targets){if(!target.parentNode)continue;for(const n of [target,...target.querySelectorAll('[id]')])if(n.id&&(/^(ts3-data-table-|cost$|coal$|building-\d|building-heading-|building-effects-51$)/.test(n.id)))retainedAnchors.add(n.id);target.remove();}
 d.querySelectorAll('#upgrade-sheet,.building-detail-nav-53,[data-c60-house-select]').forEach(n=>n.tagName==='SELECT'?n.parentElement.remove():n.remove());
 d.querySelectorAll('[data-power-plant-asset],[data-building-growth-60-asset],[data-building-phase2-asset],[data-client-building-52-asset],[data-building-ux-53-asset],[data-bs-asset]').forEach(n=>n.remove());
 d.documentElement.removeAttribute('data-power-plant-page');d.documentElement.removeAttribute('data-building-ux-53');d.documentElement.setAttribute('data-building-system-page',slug);
 const p=hero.querySelector('.hero-grid > div:last-child > p')||hero.querySelector('p:not(.eyebrow)');if(p)p.textContent=entry.role[lang];
 if(['power-plant','barracks','hospital','lab','aegis-monument','warbringer-monument','guardian-of-life-monument','cursed-wound-stele','blessed-healing-stele'].includes(slug))hero.querySelectorAll('.summary-grid,.hero-summary').forEach(n=>n.remove());
 if(slug==='hospital')d.querySelectorAll('main section.section').forEach(n=>{if(n.querySelector('.status-grid'))n.remove();});
 const description=d.querySelector('h1').textContent+' · '+entry.role[lang]+' '+entry.usage[lang];
 for(const n of d.querySelectorAll('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]'))n.setAttribute('content',description);
 for(const n of d.querySelectorAll('script[type="application/ld+json"]')){try{const data=JSON.parse(n.textContent);const visit=x=>{if(x&&typeof x==='object'){if(['WebPage','Article'].includes(x['@type'])){x.description=description;x.name=name+' | TilesSurvive.net';if(x.headline)x.headline=name;}if(x['@type']==='ListItem'&&x.item===url)x.name=name;Object.values(x).forEach(v=>Array.isArray(v)?v.forEach(visit):visit(v));}};visit(data);n.textContent=JSON.stringify(data).replaceAll('<','\\u003c');}catch{}}
 const nav=`<nav class="building-detail-nav-53" data-bs-content="" aria-label="${esc(T.related)}"><a href="/${lang}/buildings/">← ${esc(require('./build-building-ux-53').copy[lang].back)}</a><a href="#upgrade-sheet">${esc(cfg.locale.labels.requirements)}</a><a href="#building-use">${esc(T.usage)}</a><a href="#building-related">${esc(T.related)}</a></nav>`;
 const use=`<section class="section bs-content" data-bs-content=""><h2 id="building-use">${esc(T.usage)}</h2><p>${esc(entry.usage[lang])}</p><h3>${esc(T.checklist)}</h3><p>${esc(entry.checklist[lang])}</p></section>`;
 const insert=d.createElement('template');insert.innerHTML=nav+use+sheet(lang,slug)+additionalEffects(lang,slug);hero.after(insert.content);
 // Preserve existing incoming fragments without keeping obsolete upgrade tables.
 const sheetHost=d.querySelector('[data-building-system]');for(const id of [...retainedAnchors].sort().reverse()){if(d.getElementById(id))continue;const span=d.createElement('span');span.id=id;span.setAttribute('data-bs-legacy-anchor','');sheetHost.prepend(span);}
 if(['enlistment-office','garrison-station'].includes(slug)){hero.querySelectorAll('.summary-grid,.hero-summary').forEach(n=>n.remove());d.querySelectorAll('main section.section').forEach(n=>{if(!n.hasAttribute('data-building-system')&&!n.hasAttribute('data-bs-content')&&!n.hasAttribute('data-bs-effects'))n.remove();});}
 const player=require('./building-player-labels')[lang];
 // Build provenance is archived in the registry, never shipped as hidden HTML.
 d.documentElement.removeAttribute('data-client-truth-52');
 d.querySelectorAll('main > details[data-content301-references],main details[data-content301-references],main .hero p.c60-note').forEach(n=>n.remove());
 const replacements={...(slug==='lab'?player.legacyLabCopy:{}),...player.legacyPageCopy?.[slug]};
 for(const node of d.querySelectorAll('main p,main li,main h2,main h3,main th,main option')){
   const replacement=replacements[node.textContent.replace(/\s+/g,' ').trim()];
   if(!node.children.length&&replacement)node.textContent=replacement;
 }
 if(lang==='ru')for(const link of d.querySelectorAll('main nav[data-platform-related] a[href="/ru/buildings/lab/"]'))if(link.textContent.trim()==='Lab')link.textContent=pageName('lab',lang);
 for(const node of d.querySelectorAll('main [aria-label]'))if(replacements[node.getAttribute('aria-label')])node.setAttribute('aria-label',replacements[node.getAttribute('aria-label')]);
 const rule=d.querySelector('#rules-22 p'),conditionKey={'power-plant':'powerCondition',lab:'labCondition',hospital:'hospitalCondition','enlistment-office':'enlistmentCondition'}[slug];
 if(rule&&conditionKey)rule.textContent=player[conditionKey];
 if(slug==='lab'){
   const researchNote=d.querySelector('#research-effects-50 > p');if(researchNote)researchNote.textContent=player.researchPower;
   const researchEntry=d.querySelector('[data-research-phase3-entry] > p');if(researchEntry)researchEntry.textContent=player.legacyResearchEntry;
   d.querySelectorAll('[data-official-fact-ids] small').forEach(n=>n.remove());
 }
 if(slug==='hospital')d.querySelectorAll('main .section-head > p').forEach(n=>n.remove());
 if(slug==='power-plant'){const table=d.getElementById('ts3-data-table-1');if(table){const note=d.createElement('p');note.className='variation';note.setAttribute('data-bs-content','');note.textContent=cfg.copy.legacyPowerNote;table.before(note);}}
 const related=entry.related.map(r=>{const href=`/${lang}/${r.type==='building'?'buildings':'guides'}/${r.slug}/`,f=path.join(root,href,'index.html');assert(fs.existsSync(f),'Related page '+href);const page=parseHTML(fs.readFileSync(f,'utf8')).document;return `<li><a href="${href}">${esc(r.type==='building'?pageName(r.slug,lang):page.querySelector('h1')?.textContent||r.slug)}</a></li>`;}).join('');
 const relatedSection=d.createElement('section');relatedSection.className='section bs-content';relatedSection.setAttribute('data-bs-related','');relatedSection.innerHTML=`<h2 id="building-related">${esc(T.related)}</h2><ul>${related}</ul>`;d.querySelector('main .container').append(relatedSection);
 for(const table of d.querySelectorAll('main table:not(.bs-table)')){if(table.closest('[data-building-system]'))continue;table.classList.add('bs-effect-table');const headings=[...table.querySelectorAll('thead th')].map(n=>n.textContent.trim());for(const row of table.querySelectorAll('tbody tr'))[...row.children].forEach((cell,i)=>cell.setAttribute('data-bs-label',headings[i]||''));}
 for(const a of d.querySelectorAll('main a[href^="#"]'))a.setAttribute('href',`/${lang}/buildings/${slug}/`+a.getAttribute('href'));
 for(const f of ['css/building-system.css','js/building-system.js']){const css=f.endsWith('.css'),n=d.createElement(css?'link':'script');n.setAttribute('data-bs-asset','');n.setAttribute(css?'href':'src','/'+f+'?v='+assetVersion(f));if(css)n.rel='stylesheet';else n.defer=true;d.head.append(n);}
 return('<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n').replace(/[ \t]+$/gm,'');
}
function catalog(html,lang){const d=parseHTML(html).document,content=require('../data/building-system-copy');d.documentElement.setAttribute('data-building-system-catalog','');for(const card of d.querySelectorAll('.building-card')){const href=card.querySelector('.building-link').getAttribute('href'),slug=href.split('/').filter(Boolean).at(-1),entry=content.buildings[slug];assert(entry,slug);const heading=card.querySelector('h3');if(heading)heading.textContent=pageName(slug,lang);const image=card.querySelector('img');if(image)image.alt=pageName(slug,lang);const p=card.querySelector('.building-body > p:not(.building-range-53)');if(p)p.textContent=entry.role[lang];const rows=model.buildings.filter(b=>b.slug===slug).flatMap(b=>b.profiles.flatMap(p=>p.rows));const range=card.querySelector('.building-range-53');if(range)range.textContent=require('./building-player-labels')[lang].range+' · Lv.1–'+Math.max(...rows.map(r=>r.level));}
return('<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n').replace(/[ \t]+$/gm,'');}
function build(){let changed=0;for(const lang of langs){for(const slug of slugs){const file=path.join(root,lang,'buildings',slug,'index.html'),before=fs.readFileSync(file,'utf8'),after=project(before,lang,slug);if(before!==after){fs.writeFileSync(file,after);changed++;}}const file=path.join(root,lang,'buildings/index.html'),before=fs.readFileSync(file,'utf8'),after=catalog(before,lang);if(before!==after){fs.writeFileSync(file,after);changed++;}}console.log(JSON.stringify({buildingSystem:true,slugs:slugs.length,buildingIds:model.buildings.length,languages:langs.length,changed}));return changed;}
module.exports={model,langs,slugs,config,publicConfig,sheet,project,catalog,build};if(require.main===module)build();
