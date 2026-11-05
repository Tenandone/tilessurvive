'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DOMParser}=require('linkedom');
const P=require('./build-nuclear-fuel-poster'),{project}=require('./nuclear-fuel-summary');
const DATA=require('../data/nuclear-age.json'),COPY=require('../data/nuclear-fuel-copy.json').locales,REG=require('../data/i18n/locales.json').locales;
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');

test('all 21 standalone posters contain the shared projection and verified visible values',()=>{
 const expected=project();
 for(const locale of REG){
  const svg=fs.readFileSync(path.join(P.ROOT,P.route(locale.code)),'utf8'),doc=new DOMParser().parseFromString(svg,'image/svg+xml');
  assert.deepEqual(JSON.parse(doc.querySelector('#nuclear-fuel-projection').textContent),expected,locale.code);
  assert.equal(doc.querySelector('title').textContent,COPY[locale.code].posterTitle);
  const texts=[...doc.querySelectorAll('text')].map(n=>n.textContent),nf=new Intl.NumberFormat(locale.numberLocale);
  for(const building of expected.buildings)for(const level of building.levels)for(const mode of ['incremental','cumulative']){
   const a=level[mode],display=nf.format(a.knownFuel)+(a.complete?'':' + ?');assert(texts.includes(display),locale.code+' '+building.id+' '+mode);
  }
  for(const level of expected.totals)for(const mode of ['incremental','cumulative']){
   const a=level[mode];assert(texts.includes(nf.format(a.knownFuel)+(a.complete?'':' + ?')),locale.code+' total');
  }
  for(const building of expected.configuredBuildings)for(const level of building.levels)assert(texts.includes(nf.format(level.incremental.total)+' / '+nf.format(level.cumulative.total)));
  assert(!doc.querySelector('script'));assert(!svg.includes('C:\\Users\\'));assert(!/\{(?:count|level)\}/.test(texts.join(' ')));
  for(const image of doc.querySelectorAll('image'))assert.match(image.getAttribute('href'),/^data:image\/png;base64,/,'Poster must display without external image requests');
  assert(doc.querySelectorAll('image').length>=5);if(locale.code!=='ko')assert(!/[가-힣]/.test(texts.join(' ')));
 }
});

test('poster manifest rejects drift and preserves source icon hashes',()=>{
 assert.equal(P.build({check:true}).changed,0);
 const manifest=JSON.parse(fs.readFileSync(path.join(P.ROOT,P.manifestPath),'utf8'));
 assert.equal(Object.keys(manifest.outputs).length,21);
 assert.equal(manifest.projectionSHA256,digest(JSON.stringify(project())));
 for(const [src,hash]of Object.entries(manifest.images))assert.equal(digest(fs.readFileSync(path.join(P.ROOT,src))),hash);
 for(const image of [DATA.stageMarker,...DATA.configuredBuildings.map(b=>b.image)]){
  assert.equal(digest(fs.readFileSync(path.join(P.ROOT,image.src))),image.sourcePNG_SHA256);
  assert.equal(image.sha256,image.sourcePNG_SHA256);
 }
});

test('poster labels retain unknown values without replacing them with complete totals',()=>{
 const model=project();assert.equal(model.totals[0].incremental.total,null);
 assert.deepEqual(model.totals.map(x=>x.cumulative.total),[null,null,null]);
 assert.deepEqual(model.totals.map(x=>x.cumulative.missingSourceIds),[[501051],[501051],[501051]]);
 assert.deepEqual(model.officialBuildingIds,[800005,800007,800008,800009,800010]);
 assert.deepEqual(model.configuredBuildings.map(x=>x.id),[800012,800168]);
 assert.deepEqual(model.totals.map(x=>x.incremental.knownFuel),[1840,3906,4410]);
 const changed=structuredClone(model);changed.buildings[0].levels[0].incremental.knownFuel=401;
 assert.notEqual(P.render('ko',changed),P.render('ko',model),'Poster rendering must read the supplied shared model');
 const empty=structuredClone(DATA);for(const b of empty.buildings)for(const s of b.stages)s.nuclearFuel=null;
 const emptyDoc=new DOMParser().parseFromString(P.render('ko',project(empty)),'image/svg+xml');
 const emptyTexts=[...emptyDoc.querySelectorAll('text')].map(x=>x.textContent);assert(emptyTexts.includes(COPY.ko.unknown));assert(!emptyTexts.includes('0 + ?'));
 const complete=structuredClone(DATA);complete.buildings[0].stages[0].nuclearFuel=0;
 const completeDoc=new DOMParser().parseFromString(P.render('ko',project(complete)),'image/svg+xml');assert([...completeDoc.querySelectorAll('text')].some(x=>x.textContent===COPY.ko.complete));
});
