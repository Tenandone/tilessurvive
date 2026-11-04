'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {execFileSync}=require('node:child_process');
const {parseHTML}=require('linkedom');
const L=require('./lib/global-localization'),G=require('./build-global-locales');
const renderer=require('./build-building-system').sheetFromConfig;
const {inspectPair}=require('./build-global-release');
const copy=require('../data/power-plant-unified-copy.json');
const root=path.resolve(__dirname,'..'),groups=L.routeGroups();
const group=groups.find(g=>g.id==='buildings/power-plant/');
const source=fs.readFileSync(path.join(root,group.file),'utf8');
const targets=L.registry.locales.filter(l=>!L.existing.has(l.code)&&l.code!=='zh-cn').map(l=>l.code);
const model=document=>JSON.parse(document.querySelector('[data-building-system-model]').textContent);
const numeric=cfg=>cfg.buildings.map(b=>({id:b.id,profiles:b.profiles.map(p=>({id:p.id,rows:p.rows.map(r=>({level:r.level,rank:r.rank,resources:r.resources,seconds:r.seconds,battlePower:r.battlePower,constructionItems:r.constructionItems.map(i=>({id:i.id,quantity:i.quantity})),requirements:r.requirements.map(q=>({buildingId:q.buildingId,level:q.level,rank:q.rank}))}))}))}));
const original=parseHTML(source).document,expected=numeric(model(original));
function translate(html,locale,route=group,engine=G){const t=L.createTranslator(locale,G.catalogFor(locale));return {document:engine.localizePage(html,locale,route,groups,t),t};}

test('full global rebuild translates every unified Power Plant composition in all 14 ordinary new locales',()=>{
  assert.equal(targets.length,14);
  for(const locale of targets){
    const {document,t}=translate(source,locale),cfg=model(document),host=document.querySelector('[data-building-system]');
    assert.deepEqual([...t.missing],[],locale+' missing messages');assert.deepEqual(t.errors,[],locale+' translation errors');
    assert.deepEqual(numeric(cfg),expected,locale+' retained numeric identities and all prerequisites');
    for(const key of Object.keys(copy.en))assert.equal(cfg.copy[key],copy[locale][key],locale+' maintained copy '+key);
    assert.equal(cfg.lang,locale);assert.equal(cfg.copy.sample,cfg.locale.labels.levelPrefix+'2');
    const rendered=parseHTML(renderer(cfg)).document.querySelector('[data-building-system]');
    const clean=host.cloneNode(true);clean.querySelectorAll('[data-bs-legacy-anchor]').forEach(n=>n.remove());
    assert.equal(clean.outerHTML,rendered.outerHTML,locale+' all labels, samples, totals and shortage use the shared renderer');
    const caption=host.querySelector('caption').textContent;
    assert.equal(caption,cfg.buildings[0].name[locale]+' · '+copy[locale].unified);
    assert(!host.textContent.includes('Unified requirements'));assert(!host.textContent.includes('Still needed:'));
    const result=host.querySelector('[data-bs-result]');assert.deepEqual([...result.querySelectorAll('[data-total-resource]')].map(n=>Number(n.dataset.raw)),[14800,14800,0,0]);
    assert.equal(Number(result.querySelector('[data-total-seconds]').dataset.totalSeconds),3);
    assert.equal(host.querySelector('[data-bs-inputs]').hasAttribute('disabled'),false);
    for(const anchor of original.querySelectorAll('[data-building-system] [data-bs-legacy-anchor]'))assert(document.getElementById(anchor.id),locale+' retained fragment '+anchor.id);
    assert.equal(document.querySelector('link[rel="canonical"]').href,L.publicOrigin+group.routes[locale]);
    const executable=d=>[...d.querySelectorAll('script:not([src])')].filter(n=>!n.type?.includes('json')).map(n=>n.textContent);
    assert.deepEqual(executable(document),executable(original),locale+' executable scripts unchanged');
    assert.deepEqual(inspectPair(source,document.toString(),{locale,route:group.routes[locale]}),{scalars:437,programs:2});
  }
});

test('renderer ownership rejects extra prose and leaves missing model labels visible to the translation gate',()=>{
  const edited=parseHTML(source).document,host=edited.querySelector('[data-building-system]');
  const extra=edited.createElement('p');extra.textContent='Additional authored instructions';host.prepend(extra);
  assert.throws(()=>translate(edited.toString(),'fr'),/Unexpected content in unified Power Plant renderer owner/);
  const changed=parseHTML(source).document,old=changed.querySelector('[data-building-system]'),cfg=model(changed);
  cfg.copy.shortage='Previously unknown shortage label';
  old.replaceWith(parseHTML(renderer(cfg)).document.querySelector('[data-building-system]'));
  const {t}=translate(changed.toString(),'fr');
  assert(t.missing.has('Previously unknown shortage label'),'JSON presentation inputs cannot bypass the translation gate');
  const wrongRoute={...group,id:'guides/not-power-plant/'};
  assert(translate(source,'fr',wrongRoute).t.missing.has('Power Plant · Unified requirements'),'the DOM selector alone must not enable this route-specific owner');
});

test('all other 119 frozen pre-V3 English routes retain byte-identical localization output across the same 14 locales',()=>{
  const filename=path.join(root,'scripts','baseline-global-locales-readonly.js');
  const baseline=new Module(filename,module);baseline.filename=filename;baseline.paths=Module._nodeModulePaths(path.dirname(filename));
  baseline._compile(execFileSync('git',['show','f487f7317ac12fdcfc3a8d8179b4ea4a6cb0e198:scripts/build-global-locales.js'],{cwd:root,encoding:'utf8'}),filename);
  const others=groups.filter(g=>g.id!==group.id);assert.equal(others.length,119);
  // New V3 renderer-owned features are verified separately in test-v3-platform.
  // This invariant keeps the same c1d9151 input in both engines, so authorized
  // new features cannot weaken the older content/translation regression gate.
  const frozen=require('./test-v3-platform').batch(others.map(route=>route.file));
  let compared=0;
  for(const route of others){
    const input=frozen.get(route.file);
    for(const locale of targets){
      const before=translate(input,locale,route,baseline.exports),after=translate(input,locale,route);
      assert.equal(after.document.toString(),before.document.toString(),locale+' '+route.id+' changed outside Power Plant');
      assert.deepEqual([...after.t.missing],[...before.t.missing],locale+' '+route.id+' missing gate');
      assert.deepEqual(after.t.errors,before.t.errors,locale+' '+route.id+' validation gate');compared++;
    }
  }
  assert.equal(compared,1666);
});
