'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { parseHTML } = require('linkedom');
const { calculate } = require('../js/database-22');
const growth = require('../data/foundation-40/starhorn-growth.json');
const db = require('../data/expansion-22/database.json');
const observation = require('../data/foundation-40/pet-observations.json');
const copy = require('../data/foundation-40/pet-growth-copy');
const hatch = require('../data/foundation-40/pet-hatching.json');
const hatchCopy = require('../data/foundation-40/pet-hatching-copy');
const root = path.resolve(__dirname, '..'), languages = ['ko','en','ja','ru','zh-tw'];
const legacyExp = [[41,2300],[42,2400],[43,2600],[44,2600],[45,2800],[46,2900],[47,3100],[48,3200],[49,3400],[50,3500],[51,3700],[52,3900],[53,4000],[54,4200],[55,4300],[56,4600],[57,4700],[58,4900],[59,5100],[60,5300],[61,5600],[62,5700],[63,6000],[64,6200],[65,6400],[66,6500],[67,6800],[68,7100],[69,7300],[70,7500],[71,7700],[72,8100],[73,8200],[74,8600],[75,8800],[76,9100],[77,9300],[78,9700],[79,9900],[80,10100],[81,10500],[82,10700],[83,11300],[84,11300],[85,11800],[87,12500],[88,12600],[89,13100],[90,13400],[91,13600],[92,14100],[93,14300],[94,15000],[95,15000]];
const artIds = ['snowball','dodo','buckler','fluffy','hardhead','shadow','starhorn'];
const text = n => n.textContent.replace(/\s+/g,' ').trim();
test('Exact reviewed model and narrow Starhorn version scope', () => {
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(growth)).digest('hex'), 'c8af50e487fe29823ffe5c7ece7b723052e7793b1ec607ff0b6bcd2cc8bf2a6b');
  assert.equal(growth.petId,'starhorn'); assert.equal(growth.gameVersion,'2.6.200'); assert.equal(growth.build,1512);
  assert.equal(growth.scope,'starhorn-only-versioned-explicit-rows');
  assert.deepEqual(growth.trainingResource,{ko:'별뿔이 전용 각인',en:'Starhorn exclusive imprint',ja:'Starhorn専用刻印',ru:'Особый отпечаток Starhorn','zh-tw':'Starhorn專屬刻印'});
  assert.deepEqual(observation.existingExpDataset.publicScopePetIds,['starhorn']);
  assert.equal(observation.calculatorPolicy.enableOtherPetCurves,false);
  assert.equal(observation.calculatorPolicy.modifyExistingFormulas,false);
});
test('All 54 fixed production EXP costs and four training costs remain exact', () => {
  assert.equal(legacyExp.length,54);
  for(const [from,cost] of legacyExp) assert.equal(growth.expRows.find(r=>r.from===from).cost,cost);
  assert.deepEqual(growth.trainingRows.slice(0,4).map(r=>[r.cost,r.stepCost]),[[100,5],[200,10],[400,20],[600,30]]);
  assert.deepEqual(growth.trainingRows.slice(0,3).map(r=>r.bonus),[40,55,70]);
});
test('Closed EXP gap and full explicit coverage, with no terminal outgoing row', () => {
  assert.equal(growth.expRows.length,99);
  growth.expRows.forEach((r,i)=>{assert.deepEqual([r.from,r.to],[i+1,i+2]);assert.ok(Number.isInteger(r.cost)&&r.cost>0);});
  assert.equal(growth.expRows.find(r=>r.from===44).cost,2600);
  assert.deepEqual(growth.expRows.find(r=>r.from===86),{from:86,to:87,cost:11900});
  assert.equal(growth.expRows.filter(r=>!legacyExp.some(([from])=>from===r.from)).length,45);
  assert.equal(growth.expRows.some(r=>r.from===100),false);
});
test('Unchanged calculator handles full EXP, former gap, held balance and invalid ranges', () => {
  assert.deepEqual(calculate(growth.expRows,1,100),{total:513870,held:0,shortage:513870});
  assert.deepEqual(calculate(growth.expRows,86,87,900),{total:11900,held:900,shortage:11000});
  assert.deepEqual(calculate(growth.expRows,44,45,3000),{total:2600,held:3000,shortage:0});
  assert.deepEqual(calculate(growth.expRows,100,100),{total:0,held:0,shortage:0});
  for(const [from,to,held] of [[0,2,0],[99,101,0],[44,43,0],[1.5,2,0],[1,2,-1],[1,2,NaN]]) assert.equal(calculate(growth.expRows,from,to,held).error,'invalid');
  const incomplete=growth.expRows.map(r=>r.from===86?{...r,cost:null}:r);
  assert.deepEqual(calculate(incomplete,85,88),{error:'missing',missing:[86]});
});
test('Five complete training transitions retain stage bonus and fragment units', () => {
  assert.equal(growth.trainingRows.length,5);
  assert.deepEqual(growth.trainingRows.map(r=>r.bonus),[40,55,70,85,100]);
  growth.trainingRows.forEach((r,i)=>{assert.deepEqual([r.from,r.to],[i,i+1]);assert.equal(r.cost,r.stepCost*20);});
  assert.deepEqual(growth.trainingRows[4],{from:4,to:5,cost:700,stepCost:35,bonus:100});
  assert.deepEqual(calculate(growth.trainingRows,0,5),{total:2000,held:0,shortage:2000});
  assert.deepEqual(calculate(growth.trainingRows,4,5,400),{total:700,held:400,shortage:300});
  assert.equal(calculate(growth.trainingRows,5,6).error,'invalid');
});
test('Only Starhorn models feed the existing EXP and training calculators', () => {
  assert.deepEqual(db.datasets.petExp,{source:'starhornGrowth',unit:'EXP',min:1,max:100,rows:growth.expRows});
  assert.deepEqual(db.datasets.petTraining,{source:'starhornGrowth',unit:'marks',min:0,max:5,rows:growth.trainingRows});
  assert.deepEqual(db.sources.starhornGrowth,{url:'https://github.com/Tenandone/tilessurvive/blob/main/data/foundation-40/starhorn-growth.json',version:'Tiles Survive 2.6.200',kind:'game-resource-field-validated'});
  assert.equal(db.pets.find(p=>p.id==='fluffy').rarity,null);
});
test('All 17 displayed hatching percentages retain rounding, nulls and existing values', () => {
  const triples=[[22.22,10,null],[22.22,10,null],[22.22,10,null],[11.11,20,16.67],[11.11,20,16.67],[11.11,20,16.67],[null,10,50]];
  assert.deepEqual(hatch.pets.map(p=>[p.normal,p.rare,p.precious]),triples);
  assert.equal(triples.flat().filter(n=>n!==null).length,17);
  for(const [key,total]of Object.entries(hatch.displayedTotals))assert.equal(Math.round(hatch.pets.reduce((sum,p)=>sum+(p[key]||0),0)*100)/100,total);
  assert.deepEqual(hatch.displayedTotals,{normal:99.99,rare:100,precious:100.01});
  for(const pet of hatch.pets)for(const [key,oldKey]of Object.entries(hatch.legacyColumnMapping))assert.equal(db.pets.find(p=>p.id===pet.id).eggs[oldKey],pet[key]);
  assert.equal(hatch.pets.find(p=>p.id==='fluffy').nameKo,'솜솜');
});
if(!process.argv.includes('--source-only')) for(const lang of languages) test(`${lang}: static EXP/training, cumulative totals, accessible scope and seven original game portraits`, () => {
  const document=parseHTML(fs.readFileSync(path.join(root,lang,'database/pet-system/index.html'),'utf8')).document;
  const section=document.getElementById('pet-data-22');
  assert.equal(text(document.getElementById('pet-exp-scope-40')),copy[lang].limits);
  for(const [key,model,total] of [['petExp',growth.expRows,513870],['petTraining',growth.trainingRows,2000]]) {
    const form=section.querySelector(`[data-growth-form="${key}"]`),config=JSON.parse(form.querySelector('script').textContent);
    assert.deepEqual(config.rows,model);
    assert.ok(form.getAttribute('aria-describedby').split(' ').includes('pet-exp-scope-40'));
    assert.equal(form.querySelector('[name="from"]').getAttribute('min'),String(model[0].from));
    assert.equal(form.querySelector('[name="to"]').getAttribute('max'),String(model.at(-1).to));
    let following=form.nextElementSibling;while(following&&!following.querySelector('table'))following=following.nextElementSibling;
    const table=following?.querySelector('table');assert.ok(table);const rows=[...table.querySelectorAll('tbody tr')];
    assert.equal(rows.length,model.length);let sum=0;
    rows.forEach((row,i)=>{sum+=model[i].cost;assert.deepEqual([...row.children].map(text),[`${model[i].from} → ${model[i].to}`,model[i].cost.toLocaleString('en-US'),sum.toLocaleString('en-US')]);});
    assert.equal(sum,total);
  }
  const rule=document.querySelector('[data-pet-team-rule]');assert.ok(text(rule).includes(copy[lang].team));
  assert.equal(rule.querySelector('a').getAttribute('href'),'https://tilesurvivegame.com/en/blog/1134');
  for(const id of artIds) {
    const roster=document.getElementById('pet-'+id).querySelector('img');
    assert.equal(roster.getAttribute('src'),`/img/game-40/pets/${id}.webp`);assert.equal(roster.style.objectFit,'contain');assert.equal(roster.getAttribute('width'),'72');assert.equal(roster.getAttribute('height'),'72');
    const detail=parseHTML(fs.readFileSync(path.join(root,lang,'database/pet-system',id,'index.html'),'utf8')).document;
    assert.equal(detail.querySelectorAll('main img[src^="/img/game-40/pets/"]').length,id==='starhorn'?8:7);
    assert.equal(detail.querySelectorAll('main img[src^="/img/pets/"]').length,id==='starhorn'?1:0);
    for(const image of detail.querySelectorAll('main img[src^="/img/game-40/pets/"]')) assert.equal(image.style.objectFit,'contain');
    if(id==='starhorn') {
      assert.ok(text(detail.querySelector('main')).includes(copy[lang].trainingDetail));assert.ok(!text(detail.querySelector('main')).includes(copy[lang].obsolete));if(lang==='ko')assert.ok(text(detail.querySelector('main')).includes('별빛의 축복:'));
      const mainArt=detail.querySelector('.ts3-pet-stage [data-pet-main-art-40="starhorn"]'),screen=detail.querySelector('[data-starhorn-screen-40]');
      assert.equal(mainArt.getAttribute('src'),'/img/game-40/pets/starhorn.webp');assert.equal(mainArt.getAttribute('width'),'360');assert.equal(mainArt.getAttribute('height'),'492');assert.equal(mainArt.getAttribute('loading'),'eager');
      assert.equal(detail.querySelectorAll('[data-starhorn-screen-40]').length,1);assert.equal(screen.hasAttribute('open'),false);assert.equal(text(screen.querySelector('summary')),copy[lang].screenshot);assert.equal(text(screen.querySelector('p')),copy[lang].screenshotScope);
      const original=screen.querySelector('img');assert.equal(original.getAttribute('src'),'/img/pets/growth-source.webp');assert.equal(original.getAttribute('width'),'731');assert.equal(original.getAttribute('height'),'920');assert.equal(original.getAttribute('alt'),'Starhorn Lv.1 game screenshot');assert.equal(original.getAttribute('loading'),'lazy');
    }
    const hatchTable=[...detail.querySelectorAll('main table')].find(table=>[...table.querySelectorAll('tbody tr')].length===3);
    assert.deepEqual([...hatchTable.querySelectorAll('tbody tr')].map(r=>text(r.children[0])),hatchCopy[lang].eggs);
  }
  assert.deepEqual([...document.querySelectorAll('.ts3-acquisition-matrix thead th')].slice(2).map(text),hatchCopy[lang].eggs);
  assert.deepEqual([...document.querySelectorAll('[data-pet-rules-40] li')].map(text),hatchCopy[lang].rules);
  assert.equal(text(document.querySelector('[data-pet-hatching-note]')),hatchCopy[lang].note);
  assert.ok(!text(document.querySelector('main')).includes(hatchCopy[lang].namesOld));
});
