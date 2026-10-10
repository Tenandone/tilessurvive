'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const D=require('../data/client-heroes-52.json'),source=require('../data/hero-refinement-51.json'),B=require('./build-client-heroes-52'),{calculate}=require('../js/database-22');
const root=path.resolve(__dirname,'..'),expected=[5,10,20,25,30,30,30,30,30,30,30,40,40,40];
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const doc=h=>parseHTML(h).document;
test('all 19 independently identified gear profiles use retained destination-level costs',()=>{
 assert(B.validate());assert.deepEqual(D.transitions.map(r=>r.cost),expected);
 assert.deepEqual(D.profiles,source.gears.map(g=>({id:g.id,heroId:g.heroId,gearId:g.gearId,materialId:g.material.id})));
 for(const p of D.profiles){const s=source.gears.find(g=>g.gearId===p.gearId);assert.deepEqual(s.costs.slice(1).map(c=>({from:c.fromLevel,to:c.toLevel,cost:c.quantity})),D.transitions);assert.deepEqual(s.costs[0],{fromLevel:0,toLevel:1,quantity:10});}
});
test('every valid calculator range sums independently, activation remains outside level 1–15',()=>{
 for(let from=1;from<=15;from++)for(let to=from;to<=15;to++)for(const held of [0,20,500]){
  const total=expected.slice(from-1,to-1).reduce((s,v)=>s+v,0);assert.deepEqual(calculate(D.transitions,from,to,held),{total,held,shortage:Math.max(0,total-held)});
 }
 assert.equal(calculate(D.transitions,1,15).total,390);assert.equal(calculate(D.transitions,12,15).total,120);assert.equal(calculate(D.transitions,13,15).total,80);
 assert.deepEqual(calculate(D.transitions,0,15),{error:'invalid'});assert.deepEqual(calculate(D.transitions,1,16),{error:'invalid'});
});
test('canonical dataset update is pure and preserves every unrelated dataset and source',()=>{
 const database=require('../data/expansion-22/database.json'),before=JSON.stringify(database),next=B.updateDatasets(database);
 assert.equal(JSON.stringify(database),before);assert.deepEqual(next.datasets.exclusive.rows,D.transitions);assert.equal(next.datasets.exclusive.source,'client-exclusive-52');
 assert.equal(next.sources['client-exclusive-52'].url,'https://tilessurvive.net/data/client-heroes-52.json');
 assert.equal(next.sources['client-exclusive-52'].version,'2.6.200 / 1512');assert.equal(next.sources['client-exclusive-52'].kind,'client-configuration');
 assert.deepEqual(next.datasets.skillBook.rows,D.skillBook.rows);assert.equal(next.datasets.skillBook.source,'client-skill-book-52');assert.equal(next.datasets.skillBook.comparison,undefined);
 assert.deepEqual(next.conflicts.map(c=>[c.id,c.status,c.value]),[['skill-book-30','resolved-client-2.6.200',735],['pet-exp-86','resolved-client-2.6.200',11800],['pet-training-bonus-4','resolved-client-2.6.200',85],['pet-training-5','resolved-client-2.6.200',700]]);
 const clean=structuredClone(next);clean.datasets.exclusive=database.datasets.exclusive;clean.datasets.skillBook=database.datasets.skillBook;clean.conflicts=database.conflicts;for(const key of ['client-exclusive-52','client-skill-book-52'])if(database.sources[key])clean.sources[key]=database.sources[key];else delete clean.sources[key];assert.deepEqual(clean,database);
 assert.deepEqual(B.updateDatasets(next),next);
});
test('six localized hubs publish the same corrected table, summary and cumulative calculator',()=>{
 for(const l of B.langs){const f=`${l}/database/exclusive-gear/index.html`,out=B.project(read(f),f),d=doc(out),form=d.querySelector('form[data-growth-form="exclusive"]');assert.equal(B.project(out,f),out);
  const rows=[...d.querySelector('#tableTitle').closest('section').querySelectorAll('table tbody tr')];assert.deepEqual(rows.slice(0,14).map(r=>Number(r.children[1].textContent)),expected);assert.equal(Number(rows[14].children[1].textContent),390);
  assert.equal(d.querySelector('.quick-stats .quick-stat:nth-child(4) span').textContent,'390');assert.equal(d.querySelector('.hero-meta .meta-pill:nth-child(2)').textContent,B.copy[l].band);
  assert.deepEqual(JSON.parse(form.querySelector('script[type="application/json"]').textContent).rows,D.transitions);
  assert.equal(form.getAttribute('data-growth-table'),'ts3-data-table-3');const wb=d.getElementById('ts3-data-table-3').closest('.ts3-data-workbench');assert.equal(wb.querySelector('.ts3-table-controls').id,'ts3-table-controls-3');for(const n of wb.querySelectorAll('[aria-controls]'))assert.equal(n.getAttribute('aria-controls'),'ts3-data-table-3');
  const derived=[...d.getElementById(form.getAttribute('data-growth-table')).querySelectorAll('tbody tr')];let sum=0;
  assert.equal(derived.length,14);derived.forEach((r,i)=>{sum+=expected[i];assert.deepEqual([...r.children].slice(1).map(n=>Number(n.textContent)),[expected[i],sum]);});
  assert.equal(d.querySelectorAll('[data-hero-refinement-51^="legacy-"]').length,0);assert.equal(d.querySelectorAll('[data-client-heroes-52]').length,2);
  for(const n of d.querySelectorAll('[data-client-heroes-52]'))assert.equal(n.textContent,B.copy[l].scope);
 }
});
test('Maddy active ally effect and removal of Mike unsupported stack cap use exact official text',()=>{
 assert(D.unlockDescriptions[0].descriptions.en.includes('Active Skill'));assert(D.unlockDescriptions[0].descriptions.en.includes("all allies' Attack by +7.5%"));
 assert.equal(D.unlockDescriptions[1].descriptions.en,'Health +5%. Gain 1% Active Skill Damage Reduction for every 10% of Health lost.');
 for(const u of D.unlockDescriptions)for(const l of B.langs){const f=`${l}/heroes/${u.id}/index.html`,before=doc(read(f)),out=B.project(read(f),f),after=doc(out);assert.equal(B.project(out,f),out);
  const n=after.querySelector('[data-client-heroes-52="gear-unlock"]');assert(n);assert.equal(n.textContent,u.descriptions[l]);assert.equal(n.closest('.step-note').querySelector('h4').textContent.match(/\d+/)[0],String(u.level));
  const oldNotes=[...before.querySelectorAll('.equipment-skill-card .step-note')],newNotes=[...after.querySelectorAll('.equipment-skill-card .step-note')];assert.equal(oldNotes.length,newNotes.length);
  oldNotes.forEach((old,i)=>{if(old.querySelector('h4')?.textContent.match(/\d+/)?.[0]!==String(u.level))assert.equal(newNotes[i].outerHTML,old.outerHTML);});
 }
});
test('24 route projections preserve SEO, images, all links and unrelated skill/growth models',()=>{
 assert.equal(B.pages.length,24);assert.equal(new Set(B.pages).size,24);
 for(const f of B.pages){const before=doc(read(f)),after=doc(B.project(read(f),f));assert.equal(after.head.outerHTML,before.head.outerHTML);
  for(const selector of ['img','picture','[data-lootbar-banner]','script[data-growth-config]','[data-hero-refinement-51="costs"]','[data-hero-refinement-51="materials"]','[data-hero-skill-levels-40]'])assert.deepEqual([...after.querySelectorAll(selector)].map(n=>n.outerHTML),[...before.querySelectorAll(selector)].map(n=>n.outerHTML),f+' '+selector);
  const isCostPage=f.includes('/database/'),links=d=>[...d.querySelectorAll('a')].filter(a=>!a.closest('[data-hero-refinement-51^="legacy-"]')&&!(isCostPage&&a.closest('details[data-content301-references]'))).map(a=>a.getAttribute('href'));assert.deepEqual(links(after),links(before));
  if(isCostPage){const references=[...after.querySelectorAll('details[data-content301-references] a')];assert.equal(references.length,1);assert.equal(references[0].getAttribute('href'),'https://tilessurvive.net/data/client-heroes-52.json');assert.equal(references[0].textContent,'tilessurvive.net · 2.6.200 / 1512');}
 }
});
test('unrecognized routes, source identities and corrupted cost boundaries fail closed',()=>{
 assert.throws(()=>B.project(read(B.pages[0]),'ko/heroes/shark/index.html'));
 for(const mutate of [m=>m.transitions[13].from=13,m=>m.activation.cost=0,m=>m.profiles[0].materialId=m.profiles[1].materialId,m=>delete m.unlockDescriptions[0].descriptions.de,m=>m.unlockDescriptions[0].descriptions.ko='{0}',m=>m.costBasis='current-level']){const m=structuredClone(D);mutate(m);assert.throws(()=>B.validate(m));}
 const f=B.pages[0],d=doc(read(f));d.querySelector('#tableTitle').closest('section').querySelector('tbody tr td:nth-child(2)').textContent='999';assert.throws(()=>B.project(d.documentElement.outerHTML,f));
});
test('public model is curated and contains no raw records, private paths, keys or credentials',()=>{
 assert(!/tscfg:|sourceSha256|recordByteOffset|[A-Z]:\\|ingame-apk|privateOnly|secret|token|password/i.test(JSON.stringify(D)));
 assert.deepEqual(Object.keys(D).sort(),['schemaVersion','gameVersion','gameBuild','unit','costBasis','activation','transitions','profiles','unlockDescriptions','skillBook'].sort());
 for(const p of D.profiles)assert.deepEqual(Object.keys(p).sort(),['id','heroId','gearId','materialId'].sort());
 for(const u of D.unlockDescriptions)assert.deepEqual(Object.keys(u).sort(),['id','level','descriptions'].sort());
});
test('skill-book top tables, complete rows, summaries and calculators agree in six languages',()=>{
 const num=n=>Number(n.textContent.replace(/[,\.\s\u00a0]/g,''));
 for(const l of B.langs){const f=`${l}/database/skill-book/index.html`,out=B.project(read(f),f),d=doc(out),top=d.querySelector('#tableTitle').closest('section').querySelector('table');assert.equal(B.project(out,f),out);
  const rows=[...top.querySelectorAll('tbody tr')];assert.equal(rows.length,40);rows.slice(0,39).forEach((r,i)=>{assert.deepEqual(r.children[0].textContent.match(/\d+/g).map(Number),[i+1,i+2]);assert.equal(num(r.children[1]),D.skillBook.rows[i].cost);});assert.equal(num(rows[39].children[1]),23555);
  const options=[...top.closest('.ts3-data-workbench').querySelectorAll('select[data-row-select] option')];assert.deepEqual(options.map(o=>[o.value,o.textContent]),rows.map((r,i)=>[String(i),r.children[0].textContent.trim()]));
  assert.deepEqual([...d.querySelectorAll('.quick-stats .quick-stat span')].map(num),[40,1650,2460,23555]);
  const form=d.querySelector('form[data-growth-form="skillBook"]');assert.deepEqual(JSON.parse(form.querySelector('script[type="application/json"]').textContent).rows,D.skillBook.rows);
  const table=d.getElementById(form.getAttribute('data-growth-table'));let sum=0;const derived=[...table.querySelectorAll('tbody tr')];assert.equal(derived.length,39);derived.forEach((r,i)=>{sum+=D.skillBook.rows[i].cost;assert.deepEqual([...r.children].slice(1).map(num),[D.skillBook.rows[i].cost,sum]);});
  assert.equal(d.querySelectorAll('[data-data-warning]').length,0);assert.equal(d.querySelector('[data-client-heroes-52="skill-costs"]').textContent,B.copy[l].skillScope);assert(!/685|TilesGuide/.test(d.querySelector('main').textContent));
 }
 for(let from=1;from<=40;from++)for(let to=from;to<=40;to++){const total=D.skillBook.rows.filter(r=>r.from>=from&&r.to<=to).reduce((s,r)=>s+r.cost,0);assert.deepEqual(calculate(D.skillBook.rows,from,to,50),{total,held:50,shortage:Math.max(0,total-50)});}
 assert.equal(calculate(D.skillBook.rows,29,30).total,735);assert.equal(calculate(D.skillBook.rows,1,40).total,23555);assert.equal(calculate(D.skillBook.rows,1,41).error,'invalid');
});
