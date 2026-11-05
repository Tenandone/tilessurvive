'use strict';
// In-memory owner projections only: no generated HTML, source facts or assets are written.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{parseHTML}=require('linkedom');
const N=require('./build-nuclear-age'),S=require('./build-v6-system'),G=require('./build-global-locales'),DE=require('./build-german-50'),CN=require('./build-simplified-chinese'),L=require('./lib/global-localization'),V4=require('./v4-workbench-content');
const registry=require('../data/i18n/locales.json').locales,M=require('../data/nuclear-age.json'),TEN=require('../data/ten-benefits-policy.json').tenUrl;
const locales=registry.map(x=>x.code),groups=L.routeGroups(),guide=groups.find(g=>g.id==='eras/nuclear-age/'),tools=groups.find(g=>g.id==='tools/');
const documentOf=html=>parseHTML(html).document,read=(l,g=guide)=>fs.readFileSync(path.join(N.ROOT,g.routes[l],'index.html'),'utf8');
const fresh=(l,g=guide)=>S.project(g===guide?N.project(read(l,g),l,g.routes[l]):N.projectLinks(read(l,g),l,g.routes[l]),l,g.routes[l]);
const numeric=cfg=>cfg.buildings.map(b=>({id:b.id,stages:b.stages.map(s=>({id:s.id,fuel:s.fuel}))}));
const originalIds=[800005,800007,800008,800009,800010,800419],configuredIds=[800012,800168,800016,800152,800142,800147,800148,800149,800150];
const expectedBuildingIds=[...originalIds.slice(0,5),...configuredIds,800419];
const expectedNumeric=[...[...M.buildings,...M.configuredBuildings].map(b=>({id:b.id,stages:b.stages.map(s=>({id:s.sourceId,fuel:s.nuclearFuel}))})),{id:M.factory.id,stages:M.factory.levels.map(s=>({id:s.sourceId,fuel:s.nuclearFuel}))}];
const digest=rows=>crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const ui=l=>require('../data/i18n/ui/'+l+'.json');
const ads=d=>[...d.querySelectorAll('script')].filter(n=>/adsbygoogle|googlesyndication|fundingchoices|__tcfapi|__gpp/i.test(n.outerHTML)).map(n=>n.outerHTML);
const slots=d=>[...d.querySelectorAll('[data-ad-client],[data-ad-slot]')].map(n=>[n.getAttribute('data-ad-client'),n.getAttribute('data-ad-slot')]);

function checkGuide(html,l,source){
 const d=documentOf(html),before=documentOf(source),c=N.copy(l),cfg=JSON.parse(d.getElementById('ts-nuclear-age').textContent);
 assert(N.validateOwnership(html,l));const language=L.byCode.get(l);assert([language.htmlLang,...language.aliases].map(x=>x.toLowerCase()).includes(d.documentElement.lang.toLowerCase()),l+' has an unregistered language tag');assert.equal(d.documentElement.dir||'ltr',language.dir);
 assert.equal(d.querySelector('[data-nuclear-owned="guide"] h1').textContent,c.title);assert.equal(d.querySelector('meta[name="description"]').content,c.description);
 assert.deepEqual(cfg,N.calculatorConfig(l));assert.deepEqual(numeric(cfg),expectedNumeric,l+' source IDs, fuel requirements and unknown values');
 assert.deepEqual(cfg.buildings.map(b=>b.id),expectedBuildingIds);assert.equal(cfg.buildings.flatMap(b=>b.stages).length,222);
 const original=numeric(cfg).filter(b=>originalIds.includes(b.id)),configured=numeric(cfg).filter(b=>configuredIds.includes(b.id));
 // Exact original 87 rows from 90b72553e and 135 rows from the pinned client extraction.
 assert.equal(original.flatMap(b=>b.stages).length,87);assert.equal(digest(original),'d13a68dc32d7823cd1fe1d787343ff5241340826d01b1e07ff4fa3af12d59fe3');
 assert.equal(configured.flatMap(b=>b.stages).length,135);assert.equal(digest(configured),'3a26eadfd2970a906508352209a1ae9ac1f6285ebff67395205e943504b889b3');
 assert.equal(cfg.buildings[0].stages[0].fuel,null);assert.equal(cfg.buildings[14].stages[0].fuel,null);assert.equal(cfg.buildings[1].stages.reduce((n,s)=>n+s.fuel,0),1944);
 const nf=new Intl.NumberFormat(L.byCode.get(l).numberLocale),rows=[...d.querySelectorAll('tr[data-stage-id]')],stages=expectedNumeric.flatMap(b=>b.stages);
 assert.equal(rows.length,222);assert.equal(new Set(rows.map(row=>row.dataset.stageId)).size,222);rows.forEach((row,i)=>{assert.equal(Number(row.dataset.stageId),stages[i].id);assert.equal(row.querySelector('td').textContent,stages[i].fuel===null?c.unknownValue:nf.format(stages[i].fuel));});
 const options=[...d.querySelectorAll('[data-nuclear-planner] select[name="building"] option')];assert.deepEqual(options.map(n=>Number(n.value)),expectedBuildingIds);
 for(const b of [...M.buildings,...M.configuredBuildings,M.factory]){assert(d.querySelector('[data-nuclear-owned="guide"]').textContent.includes(b.names[l]),l+' lost native building name '+b.id);assert.equal(options.find(n=>Number(n.value)===b.id).textContent,b.names[l],l+' option name '+b.id);}
 assert.equal(d.querySelector('link[rel="canonical"]').href,L.publicOrigin+N.route(l));assert.equal(d.querySelectorAll('link[rel="alternate"][hreflang]').length,22);
 for(const x of registry)assert.equal(d.querySelector('link[hreflang="'+x.hreflang+'"]').href,L.publicOrigin+N.route(x.code));
 assert.deepEqual(JSON.parse(d.getElementById('ts-locale-routes').textContent),Object.fromEntries(locales.map(x=>[x,N.route(x)])));
 assert.deepEqual(ads(d),ads(before));assert.deepEqual(slots(d),slots(before));assert.equal(d.querySelectorAll('a[href="'+TEN+'"]').length,before.querySelectorAll('a[href="'+TEN+'"]').length);
 assert(d.querySelector('[data-v3-owned="privacy"]'));assert.equal(d.querySelectorAll('script[src^="/js/nuclear-age.js"]').length,1);assert.equal(d.querySelectorAll('link[href^="/css/nuclear-age.css"]').length,1);
 return d;
}
function checkLinks(html,l,g,source){
 const d=documentOf(html);assert(N.validateLinks(html,l,g.routes[l]));assert(V4.validateOwnership(html,l,g.routes[l]));
 assert.equal(d.querySelector('[data-nuclear-owned="link"]').outerHTML,documentOf(N.renderEntry(l,{compact:true})).querySelector('section').outerHTML);
 assert.equal(d.querySelector('[data-nuclear-owned="link"] a').getAttribute('href'),N.route(l));assert.equal(d.querySelectorAll('[data-nuclear-owned="link"]').length,1);
 assert.equal(d.querySelectorAll('link[href^="/css/nuclear-age.css"]').length,1);assert.deepEqual(ads(d),ads(documentOf(source)));assert.deepEqual(slots(d),slots(documentOf(source)));
 return d;
}
function generic(source,l,g,{preview=false}={}){
 const real=L.createTranslator(l,G.catalogFor(l)),seen=[],translator={...real,translate:(text,context)=>{seen.push(String(text).trim());return real.translate(text,context);}};
 const d=G.localizePage(source,l,g,groups,translator);assert.deepEqual([...real.missing],[],l+' '+g.id+' missing generic dictionary');assert.deepEqual(real.errors,[],l+' '+g.id+' generic errors');
 return {html:G.enhance(d,l,g,locales,ui(l),{preview}),intermediate:d,seen};
}

test('14 generic locale rebuilds retain the exact source owner before applying native Nuclear Age copy',()=>{
 assert(guide);const source=fresh('en'),owned=documentOf(S.strip(source)).querySelector('[data-nuclear-owned="guide"]').outerHTML,targets=locales.filter(l=>!L.existing.has(l)&&l!=='zh-cn');assert.equal(targets.length,14);
 for(const l of targets){const out=generic(source,l,guide);assert.equal(out.intermediate.querySelector('[data-nuclear-owned="guide"]').outerHTML,owned,l+' generic translation modified the source owner');for(const key of ['intro','fuelPlannerIntro','fuelNote','serverNote','returnWarning'])assert(!out.seen.includes(N.copy('en')[key]),l+' translated owned '+key);assert(!out.seen.some(s=>s.includes('"knownFuel"')||s.includes('"buildingId"')));checkGuide(out.html,l,source);}
});

test('German and Simplified Chinese guide and tools regeneration use their exact native owners',()=>{
 for(const g of [guide,tools]){
  const source=fresh('en',g),seen=[],de=DE.render(source,text=>{seen.push(String(text).trim());return text;},g.id+'index.html'),projected=G.enhance(documentOf(de),'de',g,locales,ui('de'),{preview:false});
  for(const key of ['intro','fuelPlannerIntro','fuelNote','serverNote'])assert(!seen.includes(N.copy('en')[key]),'German translated Nuclear '+key);
  (g===guide?checkGuide:checkLinks)(projected,'de',...(g===guide?[source]:[g,source]));
  const traditional=fresh('zh-tw',g),converter=CN.createConverter(),calls=[],convert=converter.convert.bind(converter);converter.convert=(text,context)=>{calls.push(String(text).trim());return convert(text,context);};
  const cn=CN.localizePage(traditional,g,groups,{converter,available:locales}).html;
  for(const key of ['intro','fuelPlannerIntro','fuelNote','serverNote'])assert(!calls.includes(N.copy('zh-tw')[key]),'Chinese converter touched Nuclear '+key);
  (g===guide?checkGuide:checkLinks)(cn,'zh-cn',...(g===guide?[traditional]:[g,traditional]));assert.match(documentOf(cn).querySelector('meta[name="robots"]').content,/noindex/,'CN staging remains noindex');
 }
 assert(CN.validateRouteManifest(groups));assert.throws(()=>CN.validateRouteManifest(groups.filter(g=>g!==guide)),/Nuclear|nuclear|reviewed/i);
});

test('all 21 native projections share the same 222 source rows and preserve the original 87 while remaining idempotent',()=>{
 for(const l of locales){const before=read(l),after=fresh(l);checkGuide(after,l,before);assert.equal(S.project(N.project(after,l),l,N.route(l)),after,l+' native reprojection');}
});

test('related cards are validated and removed before translation, then restored after V4 in every generic locale',()=>{
 const source=fresh('en',tools),targets=locales.filter(l=>!L.existing.has(l)&&l!=='zh-cn');
 for(const l of targets){const out=generic(source,l,tools);assert.equal(out.intermediate.querySelectorAll('[data-nuclear-owned="link"]').length,0);assert(!out.seen.includes(N.copy('en').description));checkLinks(out.html,l,tools,source);}
 for(const r of N.linkRoutes('en')){const g=groups.find(g=>g.routes.en===r);assert(g);const source=fresh('en',g),out=generic(source,'fr',g);checkLinks(out.html,'fr',g,source);}
});

test('all three regeneration paths reject forged guide content, metadata, routes and assets before translating',()=>{
 const mutations=[
  d=>{d.querySelector('[data-nuclear-owned="guide"] h1').textContent='Unreviewed era';},
  d=>{d.querySelector('main').insertAdjacentHTML('beforeend','<p>Unreviewed sibling promise</p>');},
  d=>{const n=d.getElementById('ts-nuclear-age'),cfg=JSON.parse(n.textContent);cfg.buildings[0].stages[0].fuel=0;n.textContent=JSON.stringify(cfg);},
  d=>{d.querySelector('meta[name="description"]').content='Unreviewed SEO';},
  d=>{d.querySelector('link[hreflang="fr"]').href=L.publicOrigin+'/fr/seasons/';},
  d=>{const n=d.getElementById('ts-locale-routes'),routes=JSON.parse(n.textContent);routes.fr='/fr/seasons/';n.textContent=JSON.stringify(routes);},
  d=>{d.querySelector('script[src^="/js/nuclear-age.js"]').setAttribute('src','/js/unreviewed-era.js');}
 ];
 for(const [i,mutate] of mutations.entries()){
  const en=documentOf(S.strip(fresh('en')));mutate(en);const bad=en.toString();let calls=0;
  assert.throws(()=>G.localizePage(bad,'fr',guide,groups,{translate:()=>{calls++;throw Error('Translator must not run');}}),assert.AssertionError,'Generic forged guide '+i);assert.equal(calls,0);
  assert.throws(()=>DE.render(bad,()=>{calls++;throw Error('Translator must not run');},guide.id+'index.html'),assert.AssertionError,'DE forged guide '+i);assert.equal(calls,0);
  const tw=documentOf(S.strip(fresh('zh-tw')));mutate(tw);assert.throws(()=>CN.localizePage(tw.toString(),guide,groups,{converter:{convert:()=>{calls++;throw Error('Converter must not run');}},available:locales}),assert.AssertionError,'CN forged guide '+i);assert.equal(calls,0);
 }
});

test('missing, duplicated and forged related cards or owned assets are rejected by all three paths',()=>{
 const mutations=[
  s=>N.stripLinks(s),
  s=>s.replace('<!-- TS_NUCLEAR_LINK_END -->','<p>Unreviewed card sibling</p><!-- TS_NUCLEAR_LINK_END -->'),
  s=>s.replace('<!-- TS_NUCLEAR_LINK_END -->',N.renderEntry('en',{compact:true})+'<!-- TS_NUCLEAR_LINK_END -->'),
  s=>s.replace('<!-- TS_NUCLEAR_LINK_ASSETS_END -->','<script src="/js/unreviewed-era.js"></script><!-- TS_NUCLEAR_LINK_ASSETS_END -->'),
  s=>{const d=documentOf(s);d.querySelector('[data-nuclear-owned="link"] a').href='/en/unreviewed/';return d.toString();}
 ];
 for(const [i,mutate] of mutations.entries()){
  const bad=mutate(S.strip(fresh('en',tools)));
  assert.throws(()=>G.localizePage(bad,'fr',tools,groups,L.createTranslator('fr',G.catalogFor('fr'))),assert.AssertionError,'Generic forged card '+i);
  assert.throws(()=>DE.render(bad,s=>s,'tools/index.html'),assert.AssertionError,'DE forged card '+i);
  assert.throws(()=>CN.localizePage(mutate(S.strip(fresh('zh-tw',tools))),tools,groups,{available:locales}),assert.AssertionError,'CN forged card '+i);
 }
});

test('native guide SEO bypass is route scoped and staging noindex survives native projection',()=>{
 const source=fresh('en'),out=generic(source,'fr',guide,{preview:true});checkGuide(out.html,'fr',source);assert.match(documentOf(out.html).querySelector('meta[name="robots"]').content,/noindex/);
 const d=documentOf(S.strip(source)),probe='Unreviewed text outside the Nuclear Age owner';d.body.insertAdjacentHTML('beforeend','<p>'+probe+'</p>');
 const t=L.createTranslator('fr',G.catalogFor('fr'));G.localizePage(d.toString(),'fr',guide,groups,t);assert(t.missing.has(probe),'Unowned prose must still require a reviewed translation');
 const de=DE.createTranslator(require('../data/product-50/german.json'));DE.render(d.toString(),de.translate,guide.id+'index.html');assert(de.missing.has(probe),'German unowned prose must still require a reviewed translation');
});

test('German regeneration accepts only exact current TEN runtime assets on the reviewed top-up route',()=>{
 const P=require('./build-v3-platform'),g=groups.find(g=>g.id==='top-up/'),source=S.strip(P.project(read('en',g),'en',g.routes.en));
 assert.doesNotThrow(()=>DE.prepareV3Source(source,'en','top-up/index.html'));
 for(const selector of ['link[href^="/css/v61-ten.css"]','script[src^="/js/v61-ten.js"]']){
  const d=documentOf(source),asset=d.querySelector(selector);assert(asset);const attribute=asset.tagName==='SCRIPT'?'src':'href';asset.setAttribute(attribute,asset.getAttribute(attribute).replace(/v=[a-f0-9]{12}/,'v=000000000000'));
  assert.throws(()=>DE.prepareV3Source(d.toString(),'en','top-up/index.html'),/Unreviewed V3 asset/,'Unreviewed TEN asset hashes must not pass');
 }
 const d=documentOf(source);d.querySelector('script[src^="/js/v61-ten.js"]').setAttribute('data-unreviewed','true');assert.throws(()=>DE.prepareV3Source(d.toString(),'en','top-up/index.html'),/Unreviewed V3 asset/);
});
