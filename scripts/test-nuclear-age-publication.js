'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{parseHTML}=require('linkedom');
const N=require('./build-nuclear-age'),S=require('./build-v6-system');
const REG=require('../data/i18n/locales.json').locales,M=require('../data/nuclear-age.json');
const ORIGIN='https://tilessurvive.net';
const file=r=>path.join(N.ROOT,r,'index.html');
const read=r=>fs.readFileSync(file(r),'utf8');
const documentOf=html=>parseHTML(html).document;
const numericConfig=cfg=>cfg.buildings.map(b=>({id:b.id,stages:b.stages.map(s=>({id:s.id,fuel:s.fuel}))}));
const originalIds=[800005,800007,800008,800009,800010,800419],configuredIds=[800012,800168,800016,800152,800142,800147,800148,800149,800150];
const expectedBuildingIds=[...originalIds.slice(0,5),...configuredIds,800419];
const canonicalNumeric=[...[...M.buildings,...M.configuredBuildings].map(b=>({id:b.id,stages:b.stages.map(s=>({id:s.sourceId,fuel:s.nuclearFuel}))})),{id:M.factory.id,stages:M.factory.levels.map(s=>({id:s.sourceId,fuel:s.nuclearFuel}))}];
const digest=rows=>crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const allSourceRows=[...[...M.buildings,...M.configuredBuildings].flatMap(b=>b.stages),...M.factory.levels];
const expectedRows=allSourceRows.map(s=>s.sourceId);

test('the original 87 numeric rows and the independently extracted 135 configured rows remain exact',()=>{
 const original=canonicalNumeric.filter(b=>originalIds.includes(b.id)),configured=canonicalNumeric.filter(b=>configuredIds.includes(b.id));
 assert.deepEqual(original.map(b=>b.id),originalIds);assert.equal(original.flatMap(b=>b.stages).length,87);
 // Original IDs, ordered stage IDs and nullable fuel values from commit 90b72553e.
 assert.equal(digest(original),'d13a68dc32d7823cd1fe1d787343ff5241340826d01b1e07ff4fa3af12d59fe3');
 // Independent pinned 2.6.400 extraction: configured-nuclear-buildings.json.
 assert.deepEqual(configured.map(b=>b.id),configuredIds);assert.equal(configured.flatMap(b=>b.stages).length,135);
 assert.equal(digest(configured),'3a26eadfd2970a906508352209a1ae9ac1f6285ebff67395205e943504b889b3');
 assert.deepEqual(allSourceRows.filter(s=>s.nuclearFuel===null).map(s=>s.sourceId),[501051,507644]);
});

test('21 generated guides retain native copy, 222 static rows and exact canonical/hreflang metadata',()=>{
 assert.equal(REG.length,21);assert.equal(expectedRows.length,222);assert.equal(new Set(expectedRows).size,222);
 for(const {code:l,htmlLang,aliases,numberLocale} of REG){
  const html=read(N.route(l)),d=documentOf(html),guide=d.querySelector('[data-nuclear-owned="guide"]');
  assert(N.validateOwnership(html,l));assert([htmlLang,...aliases].map(v=>v.toLowerCase()).includes(d.documentElement.lang.toLowerCase()),l+' has an unregistered language tag');
  assert.equal(guide.querySelector('h1').textContent,N.copy(l).title);
  assert.equal(d.querySelector('meta[name="description"]').content,N.copy(l).description);
  assert.equal(d.querySelector('link[rel="canonical"]').href,ORIGIN+N.route(l));
  const alternate=[...d.querySelectorAll('link[rel="alternate"][hreflang]')].map(n=>[n.getAttribute('hreflang'),n.href]);
  assert.equal(alternate.length,22);assert.equal(new Set(alternate.map(x=>x[0])).size,22);
  assert.deepEqual(alternate.sort(),[...REG.map(x=>[x.hreflang,ORIGIN+N.route(x.code)]),['x-default',ORIGIN+N.route('en')]].sort());
  const rows=[...guide.querySelectorAll('tbody tr[data-stage-id]')];assert.deepEqual(rows.map(n=>Number(n.dataset.stageId)),expectedRows);
  const nf=new Intl.NumberFormat(numberLocale);
  rows.forEach((row,i)=>assert.equal(row.querySelector('td').textContent,allSourceRows[i].nuclearFuel===null?N.copy(l).unknownValue:nf.format(allSourceRows[i].nuclearFuel),l+' stage '+expectedRows[i]));
  assert(guide.querySelector('noscript'));const options=[...guide.querySelectorAll('select[name="building"] option')];assert.equal(options.length,15);assert.deepEqual(options.map(n=>Number(n.value)),expectedBuildingIds);
  for(const b of [...M.buildings,...M.configuredBuildings,M.factory])assert.equal(options.find(n=>Number(n.value)===b.id).textContent,b.names[l],l+' building option '+b.id);
  const visible=[...guide.querySelectorAll('p,h1,h2,h3,th,td,label,button,option')].map(n=>n.textContent).join(' ');
  assert(!/\{[A-Za-z0-9_]+\}/.test(visible),'Unresolved text template '+l);
  if(l!=='ko')assert(!/[가-힣]/.test(visible),'Korean text leaked into '+l);
 }
});

test('all 21 embedded calculators preserve identical source IDs, requirements and nulls',()=>{
 const expected=numericConfig(N.calculatorConfig('en'));
 assert.deepEqual(expected,canonicalNumeric);assert.deepEqual(expected.map(b=>b.id),expectedBuildingIds);
 assert.deepEqual(expected.map(b=>b.stages.length),[...Array(14).fill(15),12]);
 assert.equal(expected[0].stages[0].fuel,null);assert.equal(expected[14].stages[0].fuel,null);
 for(const {code:l,numberLocale}of REG){
  const d=documentOf(read(N.route(l))),scripts=d.querySelectorAll('#ts-nuclear-age');assert.equal(scripts.length,1);
  const cfg=JSON.parse(scripts[0].textContent);assert.deepEqual(cfg,N.calculatorConfig(l));assert.equal(cfg.locale,l);assert.equal(cfg.numberLocale,numberLocale);
  assert.deepEqual(numericConfig(cfg),expected,l+' numeric model differs');
 }
});

test('every guide is discoverable in both search indexes, sitemap and locale switching',()=>{
 const global=JSON.parse(fs.readFileSync(path.join(N.ROOT,'data/search-index.json'),'utf8')).items;
 const sitemap=fs.readFileSync(path.join(N.ROOT,'sitemap.xml'),'utf8'),locs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 for(const{code:l}of REG){
  const expected=N.searchRecords(l)[0],local=JSON.parse(fs.readFileSync(path.join(N.ROOT,'data/search',l+'.json'),'utf8')).items;
  for(const index of [global,local]){const rows=index.filter(r=>r.url===N.route(l));assert.equal(rows.length,1,l+' search row count');for(const[k,v]of Object.entries(expected))assert.deepEqual(rows[0][k],v,l+' search '+k);}
  assert.equal(locs.filter(u=>u===ORIGIN+N.route(l)).length,1,l+' sitemap occurrence');
  const d=documentOf(read(N.route(l))),routePayload=d.getElementById('ts-locale-routes');assert(routePayload,l+' locale routes missing');
  assert.deepEqual(JSON.parse(routePayload.textContent),Object.fromEntries(REG.map(x=>[x.code,N.route(x.code)])));
 }
});

test('336 related-route entries preserve their exact owned blocks and reject injected siblings',()=>{
 let count=0;
 for(const{code:l}of REG)for(const r of N.linkRoutes(l)){
  count++;const html=read(r);assert(N.validateLinks(html,l,r));
  const d=documentOf(S.strip(html)),entry=d.querySelector('[data-nuclear-owned="link"]');
  assert.equal(entry.querySelector('h2 a').getAttribute('href'),N.route(l));
  assert.equal(entry.querySelector('h2 a').textContent,N.copy(l).title);
  const injected=html.replace('<!-- TS_NUCLEAR_LINK_END -->','<aside data-unreviewed="true">unexpected sibling</aside><!-- TS_NUCLEAR_LINK_END -->');
  assert.throws(()=>N.validateLinks(injected,l,r),/Unreviewed|era entry/,r+' accepted unowned block addition');
 }
 assert.equal(count,336);
});

test('Nuclear Ray uses the locale percentage formatter exactly once, including Arabic, Vietnamese and Norwegian',()=>{
 for(const{code:l,numberLocale}of REG){
  const d=documentOf(read(N.route(l))),skill=d.querySelector('.nuclear-skill'),text=skill.querySelector('p').textContent;
  const formatted=new Intl.NumberFormat(numberLocale,{style:'percent'}).format(0.05);
  assert(text.includes(formatted),l+' missing native formatted 5%');
  assert.equal((text.match(/[%\u066A]/g)||[]).length,1,l+' has repeated percent signs');
  assert(!/\{(?:percent|star|0)\}/.test(text),l+' unresolved skill value');
  assert(skill.textContent.includes(new Intl.NumberFormat(numberLocale).format(9)));
 }
 for(const l of ['ar','vi','nb']){const text=documentOf(read(N.route(l))).querySelector('.nuclear-skill p').textContent;assert(text.includes('Nuclear Ray'));assert(!text.includes('Fire a Nuclear Ray'),'Untranslated fallback prose '+l);}
});

test('guide ownership rejects appended main siblings, duplicate guides and altered fuel data',()=>{
 for(const l of ['en','ko','ar']){
  const html=read(N.route(l));assert(N.validateOwnership(html,l));
  const sibling=documentOf(html);sibling.querySelector('main').insertAdjacentHTML('beforeend','<section data-unreviewed="true"><p>Unexpected nuclear rule</p></section>');
  assert.throws(()=>N.validateOwnership(sibling.toString(),l),'Appended sibling accepted '+l);
  const duplicate=documentOf(html),guide=duplicate.querySelector('[data-nuclear-owned="guide"]');guide.parentNode.appendChild(guide.cloneNode(true));
  assert.throws(()=>N.validateOwnership(duplicate.toString(),l),'Duplicate guide accepted '+l);
  const changed=documentOf(html),payload=changed.getElementById('ts-nuclear-age'),cfg=JSON.parse(payload.textContent);cfg.buildings[0].stages[0].fuel=0;payload.textContent=JSON.stringify(cfg);
  assert.throws(()=>N.validateOwnership(changed.toString(),l),'Unknown fuel converted to zero '+l);
 }
});

test('guide reprojection remains idempotent in memory without writing publication files',()=>{
 for(const{code:l}of REG){const html=read(N.route(l)),first=N.project(html,l),second=N.project(first,l);assert.equal(first,second,l+' non-idempotent projection');assert(N.validateOwnership(second,l));}
});
