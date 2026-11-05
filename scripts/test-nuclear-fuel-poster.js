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
   const marked=building.levels.some(level=>level.powerPlantRequirement);
   assert.equal(values[0],(building.names[locale.code]||building.names.en)+(marked?' †':''),label+' building name');
   assert.deepEqual(values.slice(1),building.levels.map(level=>display(level[mode],nf)),label+' '+building.id+' '+mode);
  });
  assert.deepEqual([...panel.querySelectorAll('[data-nuclear-power-plant-badge]')].map(n=>Number(n.getAttribute('data-nuclear-power-plant-badge'))),expected.scope==='all'?[800152,800142,800147,800148,800149,800150]:[],label+' six marked rows only');
  assert.deepEqual(texts(panel.querySelector('[data-nuclear-fuel-total]')).slice(-3),expected.totals.map(level=>display(level[mode],nf)),label+' total '+mode);
 }
 const visible=texts(doc),note=doc.querySelectorAll('#nuclear-fuel-correction-note');
 assert.equal(note.length,1,label);assert.equal(compact(note[0].textContent),compact(c.correctionNote),label);
 assert(compact(visible.join(' ')).includes(compact(c[expected.scope+'Help'])),label+' help');
 assert(compact(visible.join(' ')).includes(compact(c.scopeNote)),label+' scope');
 assert(!visible.includes(c.knownSubtotal),label);assert(!visible.includes(c.unknown),label);
 assert(!visible.includes(c.configuredTitle),label+' no separate configured section');
 assert(!doc.querySelector('script'));assert(!svg.includes('C:\\Users\\'));assert(!/\{(?:count|level)\}/.test(visible.join(' ')));
 const free=expected.firstPowerPlantUpgrade?.buildingId===800005&&expected.firstPowerPlantUpgrade.sourceId===501051&&expected.firstPowerPlantUpgrade.nuclearFuel===0;
 assert.equal(doc.querySelectorAll('#nuclear-first-upgrade-zero').length,free?1:0,label+' exact first-step zero note');
 if(free)assert.equal(compact(doc.querySelector('#nuclear-first-upgrade-zero').textContent),compact(c.firstUpgradeFreeNote));
 assert.equal(doc.querySelectorAll('#nuclear-power-plant-note').length,expected.scope==='all'?1:0,label+' shared prerequisite note once');
 if(expected.scope==='all'){
  assert.equal(compact(doc.querySelector('#nuclear-power-plant-note').textContent),compact(c.powerPlantSharedNote));
  const flow=[...doc.querySelectorAll('[data-nuclear-power-plant-flow-level]')];assert.equal(flow.length,3);
  flow.forEach((node,i)=>{
   assert.equal(Number(node.getAttribute('data-required-sequence')),(i+1)*5);assert.equal(Number(node.getAttribute('data-required-source')),[501054,501058,501249][i]);
   assert.deepEqual(texts(node),[expected.buildings.find(b=>b.id===800005).names[locale.code],c.powerPlantCompletedStage.replace(/\{level\}/g,nf.format(i+1)),'↓','† N'+nf.format(i+1)],label+' Power Plant above the target, no reversed dependency');
  });
 }else assert.equal(doc.querySelectorAll('#nuclear-power-plant-flow').length,0);
 for(const marker of doc.querySelectorAll('[data-nuclear-level-marker]')){
  const image=marker.querySelector('use'),number=marker.querySelector('text');assert(image&&number);
  assert.equal(Number(number.getAttribute('x')),Number(image.getAttribute('x'))+Number(image.getAttribute('width'))/2);
  assert.equal(Number(number.getAttribute('y')),Number(image.getAttribute('y'))+Number(image.getAttribute('height'))/2);
  assert.equal(number.getAttribute('text-anchor'),'middle');assert.equal(number.getAttribute('dominant-baseline'),'central');
 }
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

test('poster labels retain unknown protection and exactly the one confirmed first-step zero',()=>{
 const model=project(DATA,'all'),originalIds=[800005,800007,800008,800009,800010],original=model.buildings.filter(b=>originalIds.includes(b.id));
 assert.deepEqual(original.map(b=>b.id),originalIds);
 assert.deepEqual([0,1,2].map(i=>original.reduce((sum,b)=>sum+b.levels[i].incremental.knownFuel,0)),[1840,3906,4410]);
 const powerPlant=original.find(b=>b.id===800005);assert.equal(powerPlant.levels[0].incremental.total,400);
 assert.deepEqual(powerPlant.levels.map(x=>x.cumulative.total),[400,1330,2380]);
 assert.deepEqual(powerPlant.levels.map(x=>x.cumulative.missingSourceIds),[[],[],[]]);
 assert.equal(DATA.factory.levels[0].sourceId,507644);assert.equal(DATA.factory.levels[0].nuclearFuel,null,'Factory uncertainty is not converted');
 const changed=structuredClone(model);changed.buildings[0].levels[0].incremental.knownFuel=401;changed.buildings[0].levels[0].incremental.total=401;
 const changedDoc=parse(P.render('ko',changed));assert.equal(texts(changedDoc.querySelector('[data-nuclear-fuel-panel="incremental"] [data-nuclear-fuel-building="800005"]'))[1],'401','Poster rendering must read the supplied shared model');
 for(const scope of P.SCOPES){
  const empty=structuredClone(project(DATA,scope));
  empty.firstPowerPlantUpgrade.nuclearFuel=null;
  for(const row of [...empty.buildings,{levels:empty.totals}])for(const level of row.levels)for(const mode of ['incremental','cumulative'])Object.assign(level[mode],{knownFuel:0,total:null,complete:false,missingSourceIds:[...level[mode].sourceIds]});
  const emptyDoc=parse(P.render('ko',empty)),emptyTexts=texts(emptyDoc);assert(emptyTexts.includes('?'));assert(!emptyTexts.includes('0 + ?'));assert(!emptyTexts.includes(COPY.ko.unknown));assert(!emptyDoc.querySelector('#nuclear-first-upgrade-zero'));
  for(const panel of emptyDoc.querySelectorAll('[data-nuclear-fuel-panel]'))for(const row of panel.querySelectorAll('[data-nuclear-fuel-building]'))assert.deepEqual(texts(row).slice(1),['?','?','?']);
  const zero=structuredClone(empty);
  zero.firstPowerPlantUpgrade.nuclearFuel=0;
  for(const row of [...zero.buildings,{levels:zero.totals}])for(const level of row.levels)for(const mode of ['incremental','cumulative'])Object.assign(level[mode],{knownFuel:0,total:0,complete:true,missingSourceIds:[]});
  const zeroDoc=parse(P.render('ko',zero));
  assert(zeroDoc.querySelector('#nuclear-first-upgrade-zero'));
  for(const panel of zeroDoc.querySelectorAll('[data-nuclear-fuel-panel]'))for(const row of panel.querySelectorAll('[data-nuclear-fuel-building]'))assert.deepEqual(texts(row).slice(1),['0','0','0'],'A verified zero remains distinct from unknown');
 }
});

test('all 42 in-memory poster renders preserve scope, correction note and numeric row placement',()=>{
 for(const scope of P.SCOPES){
  const model=project(DATA,scope),expected=EXPECTED[scope];assert.equal(model.scope,scope);assert.equal(model.schemaVersion,2);assert.deepEqual(model.configuredBuildings,[]);
  assert.deepEqual(model.buildings.map(b=>b.id),expected.ids,scope);
  for(const mode of ['incremental','cumulative'])assert.deepEqual(model.totals.map(level=>level[mode].knownFuel),expected[mode],scope+' '+mode);
  assert.deepEqual(model.totals.map(level=>level.cumulative.total),expected.cumulative,scope);
  assert.deepEqual(model.totals.map(level=>level.cumulative.missingSourceIds),[[],[],[]],scope);
  for(const locale of REG){const svg=P.render(locale.code,model);verify(svg,locale,model);assert.equal(P.render(locale.code,model),svg,locale.code+' deterministic repeated render');}
 }
 assert.throws(()=>P.render('ko',{...project(DATA,'all'),scope:'unreviewed'}),/Unknown Nuclear Fuel poster scope/);
});

test('poster first-zero copy follows only its exact source and missing costs do not imply free upgrades',()=>{
 const original=structuredClone(DATA);original.buildings[0].stages[0].nuclearFuel=null;
 const unknown=project(original,'all'),unknownDoc=parse(P.render('ko',unknown));
 assert(!unknownDoc.querySelector('#nuclear-first-upgrade-zero'));assert(texts(unknownDoc).includes('400 + ?'));
 for(const mutate of [x=>x.nuclearFuel=1,x=>x.nuclearFuel=null,x=>x.sourceId=507644,x=>x.buildingId=800419]){
  const model=project(DATA,'all');mutate(model.firstPowerPlantUpgrade);assert(!parse(P.render('ko',model)).querySelector('#nuclear-first-upgrade-zero'));
 }
 const reversed=project(DATA,'tree');reversed.buildings[0].levels=structuredClone(project(DATA,'all').buildings.find(b=>b.id===800150).levels);
 assert.throws(()=>P.render('ko',reversed),/Unreviewed poster prerequisite scope/);
});
