'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom'),G=require('./client-release-gate'),B=require('./build-building-system');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const registry=require('../data/i18n/locales.json').locales,groups=require('./lib/global-localization').routeGroups();
const data=require('../data/hero-atlas-client.json'),publication=require('../data/hero-atlas-publication.json'),routes=require('../data/hero-atlas-routes.json');
test('reviewed client rows and release decisions remain separate; new or unheld rows fail closed',()=>{
 assert.equal(G.validatePublication(data,publication,routes).held,6);
 const extra=structuredClone(data);extra.heroes.push({...extra.heroes[0],id:'unverified',clientId:999});assert.throws(()=>G.validatePublication(extra,publication,routes),/publication review/);
 const released=structuredClone(publication);released.heldForms.pop();assert.throws(()=>G.validatePublication(data,released,routes),/Promotion release policy/);
 const fabricated=structuredClone(publication);fabricated.newPublished[0].releaseEvidence=['https://example.org/guide'];assert.throws(()=>G.validatePublication(data,fabricated,routes),/official evidence/);
});
test('all 21 current home and Lava pages retain reciprocal language navigation and exact current-page maps',()=>{
 for(const group of groups.filter(g=>['','heroes/lava/'].includes(g.id)))for(const locale of registry){const route=group.routes[locale.code];assert(G.validateDocument(read(route.slice(1)+'index.html'),{locale:locale.code,route,routes:group.routes,registry}));}
});
test('a six-language finalizer regression, stale route map and copied managed TOC all block publication',()=>{
 const group=groups.find(g=>g.id===''),route=group.routes.en,html=read('en/index.html'),options={locale:'en',route,routes:group.routes,registry};
 const d=parseHTML(html).document;[...d.querySelectorAll('link[rel="alternate"][hreflang]')].slice(7).forEach(n=>n.remove());assert.throws(()=>G.validateDocument(d.toString(),options),/complete hreflang/);
 const broken=html.replace('"nb":"/nb/"','"nb":"/en/"');assert.notEqual(broken,html);assert.throws(()=>G.validateDocument(broken,options),/current-page language map/);
 const toc=html.replace('</main>','<nav class="ts3-contents"><a href="#v3-privacy">Optional usage analytics</a></nav></main>');assert.throws(()=>G.validateDocument(toc,options),/legacy TOC/);
});
test('numeric model strings, old table values, executable programs, ads and TEN links cannot drift',()=>{
 const html='<script type="application/json" id="costs">{"cost":"100","time":3}</script><script>window.answer=7;</script><table><tr><td>100</td><td>3</td></tr></table><script src="https://pagead2.googlesyndication.com/adsbygoogle.js"></script><a href="https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive">TEN</a>';
 G.verifyPreserved(html,html,'fixture');
 for(const [a,b]of [['"100"','"101"'],['window.answer=7','window.answer=8'],['<td>100</td>','<td>101</td>'],['adsbygoogle.js','adsbygoogle-removed.js'],['/shop/ten/','/shop/other/']])assert.throws(()=>G.verifyPreserved(html,html.replace(a,b),'fixture'),/protected|numeric table/);
});
test('Aegis keeps exact published bytes while real source changes are regenerated',()=>{
 const html=read('ko/buildings/aegis-monument/index.html');assert.equal(B.project(html,'ko','aegis-monument'),html);
 const d=parseHTML(html).document;const cfg=d.querySelector('[data-building-system-model]');const model=JSON.parse(cfg.textContent);model.buildings[0].profiles[0].rows[0].resources[0]++;
 cfg.textContent=JSON.stringify(model);const altered=d.toString();const fixed=B.project(altered,'ko','aegis-monument');assert.notEqual(fixed,altered);assert.deepEqual(JSON.parse(parseHTML(fixed).document.querySelector('[data-building-system-model]').textContent),JSON.parse(parseHTML(html).document.querySelector('[data-building-system-model]').textContent));
});
test('building projection never treats a V3 trust paragraph as its own building introduction',()=>{
 const html=read('ko/buildings/lab/index.html'),before=parseHTML(html).document.querySelector('[data-v3-owned="trust"]')?.outerHTML;assert(before);const projected=B.project(html,'ko','lab');assert.equal(parseHTML(projected).document.querySelector('[data-v3-owned="trust"]').outerHTML,before);assert.equal(projected,html);
});
test('existing legacy anchors keep their precise parent and accessibility attributes',()=>{
 const html=read('ko/buildings/artifact-workshop/index.html'),d=parseHTML(html).document;assert(d.querySelector('.sheet-heading #ts3-data-table-0'));assert.equal(B.project(html,'ko','artifact-workshop'),html);
});
