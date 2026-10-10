'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom'),D=require('../data/product-50/growth-gear.json'),B=require('./build-growth-50'),M=require('../js/growth-50');
const root=path.resolve(__dirname,'..');
test('Ragnar and Dave reuse the existing curve without adding costs or effects',()=>{
  assert.deepEqual(D.heroes.slice(17).map(h=>h.id),['lagnar','dave']);assert.equal(D.heroes.length,19);
  const old=require('../data/foundation-40/hero-gear-levels-41.json');assert.deepEqual(D.heroes.slice(0,17).map(h=>h.id),old.gears.map(h=>h.id));
  for(const h of D.heroes.slice(17)){assert.deepEqual(Object.keys(h).sort(),['gearName','id','name']);for(const lang of B.langs){assert(h.name[lang]);assert(h.gearName[lang]);}}
});
test('twelve enhanced detail pages each have one exact comparison and their previous effect/cost blocks',()=>{
  let levelRows=0;
  for(const lang of B.langs)for(const h of D.heroes.slice(17)){
    const d=parseHTML(fs.readFileSync(path.join(root,B.heroRoute(lang,h.id)),'utf8')).document;
    assert.equal(d.querySelectorAll('[data-growth-50]').length,1);
    assert.equal(d.querySelector('[data-growth-50]').outerHTML,parseHTML(B.render(lang,h)).document.querySelector('[data-growth-50]').outerHTML);
    assert.equal(d.querySelectorAll('[data-growth-all] tbody tr').length,15);levelRows+=15;
    assert.equal(d.querySelectorAll('#gear-costs-51').length,1);assert.equal(d.querySelectorAll('[data-sea-growth="gear"]').length,1);
    assert.equal(d.querySelectorAll('[data-growth-metric]').length,4);assert(d.querySelector('.ts-lootbar-slot--hero'));
    assert.equal(d.querySelectorAll('link[data-content-60-style]').length,1);assert(d.querySelector('link[rel="canonical"]'));
  }
  assert.equal(levelRows,180);
});
test('six existing gear hubs link all19 profiles without duplicating the curve',()=>{
  for(const lang of B.langs){const d=parseHTML(fs.readFileSync(path.join(root,lang,'database/exclusive-gear/index.html'),'utf8')).document;
    assert.equal(d.querySelectorAll('[data-growth-50]').length,1);const links=[...d.querySelectorAll('.ts-growth50-links a')];assert.equal(links.length,19);
    for(const h of D.heroes)assert.equal(links.filter(a=>a.getAttribute('href')===`/${B.heroRoute(lang,h.id).replace('index.html','')}#gear-stats-50`).length,1);
    assert.equal(d.querySelectorAll('[data-growth-all] tbody tr').length,15);assert(d.querySelector('form[data-growth-form]'));
  }
});
test('all120 valid endpoint ranges retain exact stat differences for each new mapping',()=>{
  let comparisons=0;for(const h of D.heroes.slice(17))for(let from=1;from<=15;from++)for(let to=from;to<=15;to++){
    const values=M.compare(D.curve,from,to);for(const v of values)assert.equal(v.gain,D.curve[to-1][v.key]-D.curve[from-1][v.key]);comparisons++;
  }
  assert.equal(comparisons,240);
});
test('historical combat allowance verifies the full projection and rejects tampering',()=>{
  const A=require('./content-combat-60-test-allowances');let checked=0;
  for(const lang of B.langs)for(const suffix of ['heroes/lagnar','heroes/dave','behemoths/legend-griffin','behemoths/marine-drake','database/exclusive-gear']){
    const file=`${lang}/${suffix}/index.html`,d=parseHTML(fs.readFileSync(path.join(root,file),'utf8')).document;
    A.restore(d,file);assert.equal(d.documentElement.outerHTML,parseHTML(A.original(file)).document.documentElement.outerHTML);checked++;
  }
  assert.equal(checked,30);
  for(const [file,selector]of [['en/behemoths/legend-griffin/index.html','[data-exp-transition] td'],['en/heroes/dave/index.html','[data-growth-metric] td'],['en/database/exclusive-gear/index.html','.ts-growth50-links a']]){
    const d=parseHTML(fs.readFileSync(path.join(root,file),'utf8')).document;d.querySelector(selector).textContent='999999';assert.throws(()=>A.restore(d,file));
  }
  const d=parseHTML(fs.readFileSync(path.join(root,'en/heroes/dave/index.html'),'utf8')).document;d.querySelector('link[rel=canonical]').href='https://invalid.example/';assert.throws(()=>A.restore(d,'en/heroes/dave/index.html'));
});
