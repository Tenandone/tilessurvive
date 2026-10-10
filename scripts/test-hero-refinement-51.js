'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const D=require('../data/hero-refinement-51.json'),B=require('./build-hero-refinement-51');
const root=path.resolve(__dirname,'..');
const first17=require('../data/foundation-40/hero-gear-levels-41.json').gears.map(g=>g.id);
const expected=[10,5,10,20,25,30,30,30,30,30,30,30,40,40,40];
test('19 existing published gear owners retain all independent destination costs',()=>{
 assert(B.validate());assert.deepEqual(D.gears.map(g=>g.id),[...first17,'lagnar','dave']);
 assert.equal(new Set(D.gears.map(g=>g.heroId)).size,19);assert.equal(new Set(D.gears.map(g=>g.gearId)).size,19);assert.equal(new Set(D.gears.map(g=>g.material.id)).size,19);
 for(const g of D.gears){assert.deepEqual(g.costs.map(c=>c.quantity),expected);assert.deepEqual(B.totals(g),{activation:10,upgrade:390,all:400});}
 assert.equal(D.gears.reduce((s,g)=>s+g.costs.length,0),285);
});
test('cost boundary is destination-level and activation is separate from upgrades',()=>{
 for(const g of D.gears){assert.deepEqual(g.costs[0],{fromLevel:0,toLevel:1,quantity:10});assert.deepEqual(g.costs[1],{fromLevel:1,toLevel:2,quantity:5});assert.deepEqual(g.costs[2],{fromLevel:2,toLevel:3,quantity:10});assert.deepEqual(g.costs[14],{fromLevel:14,toLevel:15,quantity:40});}
});
test('all 114 hero fragments are static, localized and cumulative without inventing levels',()=>{
 for(const l of B.langs)for(const g of D.gears){const d=parseHTML(B.render(l,g)).document,section=d.querySelector('[data-hero-refinement-51="costs"]');assert(section);assert.equal(section.id,'gear-costs-51');
  assert(section.textContent.includes(g.material.name[l]));assert(section.textContent.includes(B.copy[l].condition));assert(section.textContent.includes(B.copy[l].activation));
  const rows=[...section.querySelectorAll('[data-gear-cost-levels-51] tbody tr')];assert.equal(rows.length,15);let sum=0;
  rows.forEach((row,i)=>{assert.equal(+row.getAttribute('data-from-level'),i);assert.equal(+row.getAttribute('data-to-level'),i+1);sum+=expected[i];assert.deepEqual([...row.querySelectorAll('td')].map(n=>Number(n.textContent)),[expected[i],sum]);});
  assert.equal(section.querySelectorAll('script,iframe,button,select,img').length,0);assert.equal(section.querySelectorAll('.ts-table-wrap[tabindex="0"][role="region"][aria-label]').length,2);
  const link=section.querySelector('a');assert.equal(link.getAttribute('href'),`/${l}/database/exclusive-gear/#gear-materials-51`);assert(fs.existsSync(path.join(root,l,'database/exclusive-gear/index.html')));
 }
});
test('6 hub fragments point to exact existing localized owner paths',()=>{
 for(const l of B.langs){const d=parseHTML(B.render(l)).document,rows=[...d.querySelectorAll('[data-gear-materials-51] tbody tr')];assert.equal(rows.length,19);
  rows.forEach((row,i)=>{const g=D.gears[i],a=row.querySelector('a');assert.equal(a.textContent,g.name[l]);assert.equal(a.getAttribute('href'),B.route(l,g.id)+'#gear-costs-51');assert(fs.existsSync(path.join(root,B.route(l,g.id),'index.html')));assert.deepEqual([...row.querySelectorAll('td')].slice(1).map(n=>Number(n.textContent)),[10,390]);});
 }
});
test('invalid level boundaries, missing locales and substituted material identities fail validation',()=>{
 for(const mutate of [d=>d.gears[0].costs[1].toLevel=1,d=>d.gears[0].costs.pop(),d=>d.gears[0].costs[1].quantity=-5,d=>delete d.gears[0].material.name.de,d=>d.gears[0].material.id=null,d=>d.costBasis='current-level']){const d=structuredClone(D);mutate(d);assert.throws(()=>B.validate(d));}
});
test('public projection contains only curated typed data and translated names',()=>{
 const text=JSON.stringify(D);assert(!/tscfg:|sourceSha256|recordByteOffset|[A-Z]:\\\\|ingame-apk|privateOnly|secret|token|password/i.test(text));
 assert.deepEqual(Object.keys(D).sort(),['schemaVersion','gameVersion','scope','costBasis','gears'].sort());
 for(const g of D.gears){assert.deepEqual(Object.keys(g).sort(),['id','heroId','name','gearId','gearName','material','costs'].sort());for(const names of [g.name,g.gearName,g.material.name])assert.deepEqual(Object.keys(names),B.langs);}
});
