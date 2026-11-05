'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom');
const B=require('./build-buildings-unified'),L=require('./lib/global-localization'),G=require('./build-global-locales');
const DE=require('./build-german-50'),CN=require('./build-simplified-chinese');
const root=path.resolve(__dirname,'..'),groups=L.routeGroups();
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const model=d=>JSON.parse(d.querySelector('[data-building-system-model]').textContent);
const numeric=cfg=>cfg.buildings.map(b=>({id:b.id,profiles:b.profiles.map(p=>({id:p.id,rows:p.rows.map(r=>({level:r.level,rank:r.rank,resources:r.resources,seconds:r.seconds,battlePower:r.battlePower,calculationBlocked:r.calculationBlocked,constructionItems:r.constructionItems.map(x=>[x.id,x.quantity]),requirements:r.requirements.map(x=>[x.buildingId,x.level,x.rank])}))}))}));
const route=slug=>groups.find(g=>g.id===`buildings/${slug}/`);
const source=(locale,slug)=>B.project(read(`${locale}/buildings/${slug}/index.html`),locale,slug);
function global(html,locale,group){const t=L.createTranslator(locale,G.catalogFor(locale)),d=G.localizePage(html,locale,group,groups,t);return{d,t};}

test('all 22 unified building routes regenerate through the 14 global locale dictionaries',()=>{
 const targets=L.registry.locales.filter(l=>!L.existing.has(l.code)&&l.code!=='zh-cn').map(l=>l.code);assert.equal(targets.length,14);let projections=0;
 for(const slug of B.slugs){const html=source('en',slug),expected=numeric(model(parseHTML(html).document));for(const locale of targets){const {d,t}=global(html,locale,route(slug));assert.deepEqual([...t.missing],[],locale+'/'+slug+' missing copy');assert.deepEqual(t.errors,[],locale+'/'+slug+' translation errors');assert.deepEqual(numeric(model(d)),expected,locale+'/'+slug+' numeric preservation');assert.equal(model(d).lang,locale);assert.equal(B.validateOwnership(d.toString(),locale,slug),true);assert.equal(d.querySelector('link[rel="canonical"]').href,L.publicOrigin+route(slug).routes[locale]);projections++;}}
 assert.equal(projections,308);
});

test('German and Simplified Chinese regenerate single, multiple and profile-specific effect buildings',()=>{
 for(const slug of ['power-plant','barracks','houses','cursed-wound-stele','blessed-healing-stele','lab-2','enlistment-office']){
  const en=source('en',slug),expected=numeric(model(parseHTML(en).document));
  const de=DE.render(en,DE.createTranslator(),`buildings/${slug}/index.html`),dd=parseHTML(de).document;
  assert.deepEqual(numeric(model(dd)),expected,'de/'+slug);assert.equal(B.validateOwnership(require('./build-v6-system').strip(de),'de',slug),true);
  const cn=CN.localizePage(source('zh-tw',slug),route(slug),groups).html,cd=parseHTML(cn).document;
  assert.deepEqual(numeric(model(cd)),expected,'zh-cn/'+slug);assert.equal(B.validateOwnership(require('./build-v6-system').strip(cn),'zh-cn',slug),true);
 }
});

test('future locale generation refuses mutated owned prose, A values and B prerequisite identities',()=>{
 const slug='hospital',html=source('en',slug),group=route(slug);
 const mutations=[d=>{const p=d.createElement('p');p.textContent='Unexpected authored content';d.querySelector('[data-building-system]').append(p);},d=>{const script=d.querySelector('[data-building-system-model]'),cfg=JSON.parse(script.textContent);cfg.buildings[0].profiles[0].rows[1].resources[0]++;script.textContent=JSON.stringify(cfg);},d=>{const script=d.querySelector('[data-building-system-model]'),cfg=JSON.parse(script.textContent);cfg.buildings[0].profiles[0].rows[1].requirements[0].level++;script.textContent=JSON.stringify(cfg);}];
 for(const mutate of mutations){const d=parseHTML(html).document;mutate(d);assert.throws(()=>global(d.toString(),'fr',group));assert.throws(()=>DE.render(d.toString(),DE.createTranslator(),`buildings/${slug}/index.html`));}
 const tw=parseHTML(source('zh-tw',slug)).document,p=tw.createElement('p');p.textContent='Unexpected authored content';tw.querySelector('[data-building-system]').append(p);assert.throws(()=>CN.localizePage(tw.toString(),group,groups));
});
