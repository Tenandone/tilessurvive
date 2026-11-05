'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..'),C=require('../data/v4-workbench-copy.json'),registry=require('../data/i18n/locales.json').locales;
const routes={'tools/':'workspace','heroes/':'formation','database/pet-system/':'formation','events/calendar/':'vs','buildings/power-plant/':'growth','database/research/':'growth'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=o=>JSON.stringify(o).replace(/</g,'\\u003c');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex').slice(0,12);
const block=(kind,html)=>`<!-- TS_V4_${kind}_BEGIN -->${html}<!-- TS_V4_${kind}_END -->`;
function strip(html){return html.replace(/<!-- TS_V4_(?:WORKSPACE|NAV|ASSETS)_BEGIN -->[\s\S]*?<!-- TS_V4_(?:WORKSPACE|NAV|ASSETS)_END -->/g,'');}
function kindFor(route){const parts=route.split('/').filter(Boolean);if(!registry.some(l=>l.code===parts[0]))return null;return routes[parts.slice(1).join('/')+'/']||null;}
function asset(file){const url='/'+file+'?v='+hash(file);return file.endsWith('.css')?`<link data-v4-owned="assets" rel="stylesheet" href="${url}">`:`<script data-v4-owned="assets" defer src="${url}"></script>`;}
function render(locale){
 const c=C.locales[locale],info=registry.find(l=>l.code===locale);assert(c&&info,'Unsupported V4 locale');
 const fc=require('../data/v4-formation-copy.json').locales[locale],ec=require('../data/v4-economy-copy.json').locales[locale];assert(fc&&ec,'Missing V4 feature translations');
 const X=require('./lib/xssr-catalog'),xssr={copy:X.copy(locale),heroes:X.officialHeroes().map(h=>({id:h.id,names:h.names,release:h.release.status,route:'/'+locale+'/heroes/'+h.id+'/'}))};
 assert(xssr.copy.formationNote&&xssr.heroes.every(h=>h.names[locale]?.value&&xssr.copy[h.release]),'Missing localized official hero availability '+locale);
 const config={schema:1,locale,numberLocale:info.numberLocale,copy:c,formationCopy:{...fc,guide:require('../data/hero-guide-copy.json').locales[locale],xssr},economyCopy:ec,models:{formation:'/data/v4-formation.json?v='+hash('data/v4-formation.json'),economy:'/data/v4-economy.json?v='+hash('data/v4-economy.json')}};
 return `<section class="v4-workbench" data-v4-owned="workspace" data-v4-workbench id="v4-workbench" aria-labelledby="v4-title"><header class="v4-intro"><p class="v4-eyebrow">TilesSurvive.net · V4</p><h2 id="v4-title">${esc(c.title)}</h2><p>${esc(c.lead)}</p></header><div class="v4-tabs" role="tablist" aria-label="${esc(c.title)}">${['formation','vs','growth'].map((t,i)=>`<button type="button" role="tab" id="v4-tab-${t}" aria-controls="v4-${t}" aria-selected="${!i}" tabindex="${i?-1:0}" data-v4-tab="${t}">${esc(c[t])}</button>`).join('')}</div>${['formation','vs','growth'].map((t,i)=>`<section role="tabpanel" id="v4-${t}" aria-labelledby="v4-tab-${t}" tabindex="0"${i?' hidden':''}><h3 class="v4-mode-title">${esc(c[t])}</h3><div data-v4-host="${t}" aria-busy="true"><p role="status">${esc(c.loading)}</p></div></section>`).join('')}<div class="v4-toolbar" data-v4-toolbar><button type="button" data-v4-save>${esc(c.save)}</button><button type="button" data-v4-load>${esc(c.load)}</button><button type="button" data-v4-share>${esc(c.share)}</button><button type="button" data-v4-reset>${esc(c.reset)}</button></div><p class="v4-note">${esc(c.localNote)}</p><p class="v4-status" role="status" data-v4-message></p><textarea data-v4-share-text aria-label="${esc(c.share)}" readonly hidden></textarea><p class="v4-scope">${esc(c.scope)}</p><script type="application/json" data-v4-config>${json(config)}</script></section>`;
}
function project(input,locale,route){
 const kind=kindFor(route);assert(registry.some(l=>l.code===locale),'Unknown locale');let html=strip(input);if(!kind)return html;
 const c=C.locales[locale];assert(/<main\b/.test(html),'V4 requires an existing main');
 if(kind==='workspace'){
  const d=parseHTML(html).document,main=d.querySelector('main');let intro=main.querySelector('h1');assert(intro,'V4 page needs its existing heading');while(intro.parentElement!==main)intro=intro.parentElement;
  const fragment=intro.outerHTML;assert(html.includes(fragment),'V4 introduction must have an exact retained boundary');html=html.replace(fragment,fragment+block('WORKSPACE',render(locale)));
  const files=['css/v4-workbench.css','css/hero-pet.css','js/building-system.js','js/v4-state.js','js/v4-formation-math.js','js/v4-economy-math.js','js/v4-formation-ui.js','js/v4-economy-ui.js','js/v4-workbench.js'];
  const assets=files.filter(f=>!new RegExp('(?:src|href)=["\']/'+f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:[?"\'])').test(html)).map(asset).join('');
  html=html.replace('</head>',block('ASSETS',assets)+'</head>');
 }else html=html.replace(/(<main\b[^>]*>)/,m=>m+block('NAV',`<nav class="v3-nav" data-v4-owned="navigation" aria-label="${esc(c.open)}"><a href="/${locale}/tools/#v4-${kind}">${esc(c[kind])} · ${esc(c.open)} →</a></nav>`));
 return html;
}
function validateOwnership(html,locale,route){
 const d=parseHTML(html).document,actual=[...d.querySelectorAll('[data-v4-owned]')];if(!actual.length){assert(!/TS_V4_/.test(html),'Empty V4 markers');return true;}
 assert(kindFor(route),'V4 on unrelated route');const expected=parseHTML(project(html,locale,route)).document;
 const snapshot=x=>[...x.querySelectorAll('[data-v4-owned]')].filter(n=>!n.parentElement?.closest('[data-v4-owned]')).map(n=>n.outerHTML);
 const blocks=value=>[...value.matchAll(/<!-- TS_V4_(WORKSPACE|NAV|ASSETS)_BEGIN -->([\s\S]*?)<!-- TS_V4_\1_END -->/g)].map(m=>[m[1],parseHTML('<html><body>'+m[2]+'</body></html>').document.body.innerHTML]);
 assert.deepEqual(blocks(html),blocks(project(html,locale,route)),'Unreviewed V4 marker contents '+route);
 assert.deepEqual(snapshot(d),snapshot(expected),'Unreviewed V4 owner '+route);return true;
}
function build(){let changed=0,pages=0;for(const l of registry)for(const route of Object.keys(routes)){const f=path.join(ROOT,l.code,route,'index.html'),before=fs.readFileSync(f,'utf8'),after=project(before,l.code,'/'+l.code+'/'+route);if(before!==after){fs.writeFileSync(f,after);changed++;}pages++;}const result={pages,changed,locales:registry.length,newURLs:0};console.log(JSON.stringify(result));return result;}
module.exports={ROOT,routes,kindFor,strip,render,project,validateOwnership,build};if(require.main===module)build();
