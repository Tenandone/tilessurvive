'use strict';
// The approved Power Plant presentation is the only consumer of this projection.
// Keep the retained public model and the shared building calculator unchanged.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),source=require('../data/client-buildings-52.json');
const langs=['ko','en','ja','ru','zh-tw','de'],pages=langs.map(l=>`${l}/buildings/power-plant/index.html`);
const building=source.buildings.find(b=>b.buildingId===800005),original=building.profiles.find(p=>p.id==='original');
const levels=original.levels.map(r=>({level:r.level,rank:r.rank,resources:[...r.resources],seconds:r.seconds,battlePower:r.battlePower,requirements:r.requirements.map(q=>({buildingId:q.buildingId,level:q.level,rank:q.rank,name:{ko:q.name.ko}}))}));
const total=rows=>({resources:source.resources.map((_,i)=>rows.reduce((n,r)=>n+r.resources[i],0)),seconds:rows.reduce((n,r)=>n+r.seconds,0)});
const model={schemaVersion:1,building:{id:800005,key:'power-plant',name:building.name.ko},game:{version:source.gameVersion,build:1512},resources:source.resources.map(r=>({id:r.id,name:r.name.ko,unit:'개'})),levels,totals:{level1To30:total(levels),upgrade1To30:total(levels.slice(1))}};
const links={800003:'/ko/buildings/lumberyard/',800007:'/ko/buildings/barracks/',800008:'/ko/buildings/barracks/',800009:'/ko/buildings/barracks/'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assetVersion=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').slice(0,12);
function render(lang){
  const locale=require('../data/power-plant-copy.json').locales[lang],L=locale.labels,M=locale.messages;
  const runtime=require('../js/power-plant-original'),options={model,locale,links,lang,range:[1,30],exact:false};
  const version=locale.source.versionTemplate.replace('{version}',model.game.version).replace('{build}',model.game.build);
  const ranges=['all','1-5','6-10','11-15','16-20','21-25','26-30','30-30'];
  const coverage=require('./build-building-ux-53').copy[lang];
  return `<section class="section power-plant-original" data-power-plant-original="" data-building-upgrade-sheet="">
<div class="sheet-heading"><h2 id="upgrade-sheet" tabindex="-1">${esc(L.requirements)}</h2><span>${esc(L.levelPrefix)}1–30</span></div>
<p class="building-range-53">${esc(coverage.known)} · Lv.1–30 · ${esc(coverage.cost)}</p>
<p class="variation">${esc(M.variation)}</p>
<div class="toolbar"><label for="range">${esc(L.level)} <select id="range">${ranges.map(r=>`<option value="${r}">${esc(r==='all'?L.allLevels:r==='30-30'?L.levelDetail:L.levelPrefix+r.replace('-','–'))}</option>`).join('')}</select></label><label class="exact-choice"><input id="exact" type="checkbox"> ${esc(L.exactValues)}</label><button id="capture" type="button">${esc(L.capture)} ↗</button></div>
<p class="number-hint">${esc(M.numberHint)} <span>${esc(M.numberLegend)}</span></p>
<div id="tables" data-load-error="${esc(M.loadError)}">${runtime.renderTables(options)}</div>
<p class="capture-basis" id="capture-basis">TilesSurvive.net · ${esc(locale.buildingName)} · ${esc(version)} · ${esc(M.verificationScope)}</p>
<details class="totals-details"><summary>${esc(L.totals)}</summary><p>${esc(M.totalsNote)}</p><div id="totals">${runtime.renderTotals(options)}</div></details>
<details class="source-details"><summary>${esc(L.source)}</summary><p><a href="https://tilessurvive.net/${lang}/buildings/power-plant/#upgrade-sheet">${esc(L.sourceLink)}</a> · <span id="source-version">${esc(version)}</span></p><p>${esc(locale.source.baseline)}</p><p>${esc(locale.source.clientScopeNote)}</p><p>${esc(M.verificationScope)}</p><p>${esc(M.constructionNote)}</p><p>${esc(M.unitNote)}</p></details>
<dialog id="number-dialog" aria-labelledby="detail-title"><form method="dialog"><button class="dialog-close" aria-label="${esc(L.close)}">×</button><p class="eyebrow">${esc(L.exactValue)}</p><h2 id="detail-title"></h2><p id="detail-value"></p><p id="detail-context"></p><button class="dialog-done" autofocus>${esc(L.done)}</button></form></dialog>
<script type="application/json" data-power-plant-model>${JSON.stringify({model,locale,links,lang}).replaceAll('<','\\u003c')}</script>
</section>`;
}
function project(html,file){
  file=file.replaceAll('\\','/').replace(root.replaceAll('\\','/')+'/','');
  if(!pages.includes(file))return html;
  const lang=file.split('/')[0],d=parseHTML(html).document;
  const prior=d.querySelector('[data-power-plant-original]');
  const old=d.querySelector('[data-client-building-52]')||d.getElementById('ts3-data-table-0');
  const target=prior||old?.closest('section.section');
  assert(target,'Power Plant requirements section '+file);
  const template=d.createElement('template');template.innerHTML=render(lang);target.replaceWith(template.content);
  d.querySelectorAll('[data-client-building-52-asset],[data-power-plant-asset]').forEach(n=>n.remove());
  require('./build-building-ux-53').detailShell(d,lang);
  for(const asset of ['css/power-plant-original.css','js/power-plant-original.js']){
    const css=asset.endsWith('.css'),n=d.createElement(css?'link':'script');
    n.setAttribute('data-power-plant-asset','');
    n.setAttribute(css?'href':'src','/'+asset+'?v='+assetVersion(asset));
    if(css)n.rel='stylesheet';else n.defer=true;d.head.append(n);
  }
  // Retain the existing cost and coal fragments, shared shell, SEO and affiliate markup.
  const table=d.querySelector('[data-power-plant-original] .data-table');
  assert(table);table.id='ts3-data-table-0';
  d.documentElement.setAttribute('data-power-plant-page','');
  return '<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
}
function build(){let changed=0;for(const file of pages){const full=path.join(root,file),before=fs.readFileSync(full,'utf8'),after=project(before,file);if(before!==after){fs.writeFileSync(full,after);changed++;}}console.log(JSON.stringify({powerPlantLanguages:6,levels:30,changed}));return changed;}
module.exports={model,links,langs,pages,render,project,build};
if(require.main===module)build();
