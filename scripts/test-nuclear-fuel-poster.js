'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DOMParser}=require('linkedom');
const P=require('./build-nuclear-fuel-poster'),{project}=require('./nuclear-fuel-summary');
const DATA=require('../data/nuclear-age.json'),COPY=require('../data/nuclear-fuel-copy.json').locales,REG=require('../data/i18n/locales.json').locales;
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const parse=svg=>new DOMParser().parseFromString(svg,'image/svg+xml');
const texts=node=>[...node.querySelectorAll('text')].map(n=>n.textContent);
const compact=x=>x.replace(/\s+/g,'');
const display=(amount,nf)=>amount.complete?nf.format(amount.total):amount.knownFuel>0?nf.format(amount.knownFuel)+' + ?':'?';
const EXPECTED={all:{ids:[800005,800007,800008,800009,800010,800012,800168,800016,800152,800142,800147,800148,800149,800150],incremental:[8335,15289,18315],cumulative:[8335,23624,41939]},tree:{ids:[800005,800007,800010,800012],incremental:[1480,3162,3570],cumulative:[1480,4642,8212]}};

function verify(svg,locale,expected){
 const doc=parse(svg),c=COPY[locale.code],nf=new Intl.NumberFormat(locale.numberLocale),label=locale.code+' '+expected.scope;
 assert.deepEqual(JSON.parse(doc.querySelector('#nuclear-fuel-projection').textContent),expected,label);
 assert.equal(doc.querySelector('title').textContent,c[expected.scope+'Title'],label);
 assert.equal(doc.querySelectorAll('[data-nuclear-fuel-panel]').length,2,label);
 for(const mode of ['incremental','cumulative']){
  const panel=doc.querySelector(`[data-nuclear-fuel-panel="${mode}"]`),rows=[...panel.querySelectorAll('[data-nuclear-fuel-building]')];
  assert.deepEqual(rows.map(row=>Number(row.getAttribute('data-nuclear-fuel-building'))),expected.buildings.map(b=>b.id),label+' '+mode);
  rows.forEach((row,index)=>{
   const building=expected.buildings[index],values=texts(row);
   assert.equal(values[0],building.names[locale.code]||building.names.en,label+' building name');
   assert.deepEqual(values.slice(1),building.levels.map(level=>display(level[mode],nf)),label+' '+building.id+' '+mode);
  });
  assert.deepEqual(texts(panel.querySelector('[data-nuclear-fuel-total]')).slice(-3),expected.totals.map(level=>display(level[mode],nf)),label+' total '+mode);
 }
 const visible=texts(doc),note=doc.querySelectorAll('#nuclear-fuel-correction-note');
 assert.equal(note.length,1,label);assert.equal(compact(note[0].textContent),compact(c.correctionNote),label);
 assert(compact(visible.join(' ')).includes(compact(c[expected.scope+'Help'])),label+' help');
 assert(compact(visible.join(' ')).includes(compact(c.scopeNote)),label+' scope');
 assert(!visible.includes(c.knownSubtotal),label);assert(!visible.includes(c.unknown),label);
 assert(!visible.includes(c.configuredTitle),label+' no separate configured section');
 assert(!doc.querySelector('script'));assert(!svg.includes('C:\\Users\\'));assert(!/\{(?:count|level)\}/.test(visible.join(' ')));
 for(const image of doc.querySelectorAll('image'))assert.match(image.getAttribute('href'),/^data:image\/png;base64,/,'Poster must display without external image requests');
 assert(doc.querySelectorAll('image').length>=5,label);if(locale.code!=='ko')assert(!/[가-힣]/.test(visible.join(' ')),label);
 const height=Number(doc.documentElement.getAttribute('height'));
 assert.equal(Number(doc.querySelector('#poster-background').getAttribute('height')),height,label+' background covers complete poster');
 for(const text of doc.querySelectorAll('text'))assert(Number(text.getAttribute('y'))<height,label+' unclipped text');
 return doc;
}

test('all 42 standalone posters contain their exact scoped projection and verified row values',()=>{
 for(const scope of P.SCOPES){
  const expected=project(DATA,scope);
  for(const locale of REG)verify(fs.readFileSync(path.join(P.ROOT,P.route(locale.code,scope)),'utf8'),locale,expected);
 }
});

test('poster manifest rejects drift and preserves both projections, URLs and source icon hashes',()=>{
 assert.equal(P.build({check:true}).changed,0);
 const manifest=JSON.parse(fs.readFileSync(path.join(P.ROOT,P.manifestPath),'utf8'));
 assert.equal(manifest.schemaVersion,2);assert.equal(Object.keys(manifest.outputs).length,42);
 assert.deepEqual(Object.keys(manifest.projectionSHA256).sort(),['all','tree']);
 for(const scope of P.SCOPES){
  assert.equal(manifest.projectionSHA256[scope],digest(JSON.stringify(project(DATA,scope))));
  for(const locale of REG){
   const file=P.route(locale.code,scope),entry=manifest.outputs[file],bytes=fs.readFileSync(path.join(P.ROOT,file));
   assert.equal(entry.scope,scope);assert.equal(entry.locale,locale.code);assert.equal(entry.sha256,digest(bytes));assert.equal(entry.bytes,bytes.length);
  }
 }
 for(const locale of REG){assert.equal(P.route(locale.code),`img/nuclear-age/fuel-table-${locale.code}.svg`);assert.equal(P.route(locale.code,'tree'),`img/nuclear-age/fuel-table-tree-${locale.code}.svg`);}
 assert.throws(()=>P.route('ko','unreviewed'),/Unknown Nuclear Fuel poster scope/);
 for(const [src,hash]of Object.entries(manifest.images))assert.equal(digest(fs.readFileSync(path.join(P.ROOT,src))),hash);
 const all=project(DATA,'all');
 for(const image of [DATA.stageMarker,...all.buildings.filter(b=>[800012,800168].includes(b.id)).map(b=>b.image)]){
  assert.equal(digest(fs.readFileSync(path.join(P.ROOT,image.src))),image.sourcePNG_SHA256);assert.equal(image.sha256,image.sourcePNG_SHA256);
 }
});

test('poster labels retain unknown values and the original five-building requirements',()=>{
 const model=project(DATA,'all'),originalIds=[800005,800007,800008,800009,800010],original=model.buildings.filter(b=>originalIds.includes(b.id));
 assert.deepEqual(original.map(b=>b.id),originalIds);
 assert.deepEqual([0,1,2].map(i=>original.reduce((sum,b)=>sum+b.levels[i].incremental.knownFuel,0)),[1840,3906,4410]);
 const powerPlant=original.find(b=>b.id===800005);assert.equal(powerPlant.levels[0].incremental.total,null);
 assert.deepEqual(powerPlant.levels.map(x=>x.cumulative.total),[null,null,null]);
 assert.deepEqual(powerPlant.levels.map(x=>x.cumulative.missingSourceIds),[[501051],[501051],[501051]]);
 const changed=structuredClone(model);changed.buildings[0].levels[0].incremental.knownFuel=401;
 assert.notEqual(P.render('ko',changed),P.render('ko',model),'Poster rendering must read the supplied shared model');
 for(const scope of P.SCOPES){
  const empty=structuredClone(project(DATA,scope));
  for(const row of [...empty.buildings,{levels:empty.totals}])for(const level of row.levels)for(const mode of ['incremental','cumulative'])Object.assign(level[mode],{knownFuel:0,total:null,complete:false,missingSourceIds:[...level[mode].sourceIds]});
  const emptyDoc=parse(P.render('ko',empty)),emptyTexts=texts(emptyDoc);assert(emptyTexts.includes('?'));assert(!emptyTexts.includes('0 + ?'));assert(!emptyTexts.includes(COPY.ko.unknown));
  for(const panel of emptyDoc.querySelectorAll('[data-nuclear-fuel-panel]'))for(const row of panel.querySelectorAll('[data-nuclear-fuel-building]'))assert.deepEqual(texts(row).slice(1),['?','?','?']);
  const zero=structuredClone(empty);
  for(const row of [...zero.buildings,{levels:zero.totals}])for(const level of row.levels)for(const mode of ['incremental','cumulative'])Object.assign(level[mode],{knownFuel:0,total:0,complete:true,missingSourceIds:[]});
  const zeroDoc=parse(P.render('ko',zero));
  for(const panel of zeroDoc.querySelectorAll('[data-nuclear-fuel-panel]'))for(const row of panel.querySelectorAll('[data-nuclear-fuel-building]'))assert.deepEqual(texts(row).slice(1),['0','0','0'],'A verified zero remains distinct from unknown');
 }
});

test('all 42 in-memory poster renders preserve scope, correction note and numeric row placement',()=>{
 for(const scope of P.SCOPES){
  const model=project(DATA,scope),expected=EXPECTED[scope];assert.equal(model.scope,scope);assert.equal(model.schemaVersion,2);assert.deepEqual(model.configuredBuildings,[]);
  assert.deepEqual(model.buildings.map(b=>b.id),expected.ids,scope);
  for(const mode of ['incremental','cumulative'])assert.deepEqual(model.totals.map(level=>level[mode].knownFuel),expected[mode],scope+' '+mode);
  assert.deepEqual(model.totals.map(level=>level.cumulative.total),[null,null,null],scope);
  assert.deepEqual(model.totals.map(level=>level.cumulative.missingSourceIds),[[501051],[501051],[501051]],scope);
  for(const locale of REG)verify(P.render(locale.code,model),locale,model);
 }
 assert.throws(()=>P.render('ko',{...project(DATA,'all'),scope:'unreviewed'}),/Unknown Nuclear Fuel poster scope/);
});
