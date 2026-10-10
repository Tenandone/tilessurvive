'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const D=require('../data/product-50/growth-gear.json'),C=require('../data/product-50/growth-copy'),M=require('../js/growth-50'),B=require('./build-growth-50');
const root=path.resolve(__dirname,'..');
const RD=require('../data/product-50/growth-research.json');
test('explicit shared gear curve,17 existing identities and six complete locales',()=>{
 assert.equal(D.heroes.length,17);assert.equal(new Set(D.heroes.map(h=>h.id)).size,17);assert.equal(D.curve.length,15);
 const old=require('../data/foundation-40/hero-gear-levels-41.json');assert.deepEqual(D.heroes.map(h=>h.id),old.gears.map(h=>h.id));
 const anchor=require('../data/foundation-40/hero-gear-levels.json');for(let i=0;i<15;i++)for(const k of ['level',...M.metrics])assert.equal(D.curve[i][k],anchor.levels[i][k]);
 for(const l of B.langs){assert(C[l]?.condition);for(const h of D.heroes){assert(h.name[l]);assert(h.gearName[l]);}for(const k of ['attack','defense','hp'])assert(D.stats[k][l]);}
 const text=JSON.stringify(D);for(const forbidden of ['sourceRecord','rawType','InternalId','sourceSha256','C:\\','PlayerPrefs'])assert(!text.includes(forbidden));
});
test('growth difference uses the two explicit endpoints, not cumulative addition',()=>{
 assert.deepEqual(M.compare(D.curve,1,15),[
  {key:'attack',from:3600,to:23760,gain:20160},{key:'defense',from:720,to:4750,gain:4030},
  {key:'hp',from:240000,to:1584000,gain:1344000},{key:'power',from:98880,to:750452,gain:651572}]);
 assert.equal(M.compare(D.curve,7,15)[0].gain,11520);
 for(let level=1;level<=15;level++)assert(M.compare(D.curve,level,level).every(r=>r.gain===0));
});
test('out-of-range, fractional, reversed and damaged series fail closed',()=>{
 for(const [from,to]of [[0,15],[1,16],[2,1],[1.5,15],[1,NaN],['1',15],[Infinity,15]])assert.throws(()=>M.compare(D.curve,from,to));
 for(const edit of [c=>c.pop(),c=>c[3].level=3,c=>c[0].hp=null,c=>c[0].power=Number.MAX_SAFE_INTEGER+1,c=>c[2].attack=-1]){const c=structuredClone(D.curve);edit(c);assert.throws(()=>M.compare(c,1,15));}
});
test('rendered6locale forms, headings, labels and names are self-contained',()=>{
 for(const lang of B.langs){const d=parseHTML(B.render(lang,D.heroes[0])).document;
  assert(d.querySelector('#gear-stats-50[data-search-entry]'));if(lang==='de')assert.equal(d.querySelector('[data-growth-metric=hp] th').textContent,D.stats.hp.de+' (HP)');assert.equal(d.querySelectorAll('select').length,2);assert.equal(d.querySelectorAll('select option').length,30);assert.equal(d.querySelectorAll('[data-growth-metric]').length,4);
  assert.equal(d.querySelectorAll('[data-growth-all] tbody tr').length,15);assert(d.querySelector('form').hasAttribute('hidden'));
  assert(!d.body.textContent.includes('undefined'));assert.equal(JSON.parse(d.querySelector('[data-growth-config]').textContent).language,lang);
  const a=parseHTML(B.render(lang)).document;assert.equal(a.querySelectorAll('.ts-growth50-links a').length,17);
 }
});
test('actual browser client updates all metrics and recovers from invalid input',()=>{
 const d=parseHTML(B.render('en',D.heroes[0])).document;M.mount(d);const form=d.querySelector('form');assert.equal(form.hidden,false);
 const from=form.querySelector('[name=from]'),to=form.querySelector('[name=to]');
 // Linkedom lacks the browser select-value setter; selected options reflect real control values.
 function set(el,value){Object.defineProperty(el,'value',{configurable:true,value:String(value)});}
 set(from,7);set(to,15);form.dispatchEvent(new d.defaultView.Event('change'));assert.equal(d.querySelector('[data-growth-metric=attack] [data-value=gain]').textContent,'11,520');
 set(from,16);form.dispatchEvent(new d.defaultView.Event('change'));assert.equal(d.querySelector('[data-growth-results]').hidden,true);assert(d.querySelector('[data-growth-status]').textContent);
 set(from,15);form.dispatchEvent(new d.defaultView.Event('change'));assert.equal(d.querySelector('[data-growth-results]').hidden,false);assert.equal(d.querySelector('[data-growth-metric=power] [data-value=gain]').textContent,'0');
 M.mount(d);assert.equal(d.querySelectorAll('form').length,1);
});
test('generated pages contain exactly one additive block and keep existing gear/banner content',()=>{
 let pages=0;
 for(const lang of B.langs)for(const h of [...D.heroes,null]){
  const file=path.join(root,h?B.heroRoute(lang,h.id):`${lang}/database/exclusive-gear/index.html`);if(!fs.existsSync(file))continue;
  const d=parseHTML(fs.readFileSync(file,'utf8')).document;assert.equal(d.querySelectorAll('[data-growth-50]').length,1,file);assert.equal(d.querySelectorAll('script[data-growth50-asset]').length,1);
  if(h){assert(d.querySelector('.ts-lootbar-slot--hero'));assert(d.querySelector('[data-hero-gear-levels-41]'));assert(d.querySelector('.ts-skill-body'));}
  else assert(d.querySelector('form[data-growth-form]'),'Existing cost calculator must remain');
  assert(d.querySelector('link[rel=canonical]'));assert.equal(d.querySelectorAll('[data-growth-config]').length,1);pages++;
 }
 assert(pages>=90);
});
test('four existing research identities retain level5 and add explicit completed levels1–4',()=>{
 assert.equal(RD.scope,'completed-research-level');assert.equal(RD.gameVersion,'2.6.200');assert.equal(RD.profiles.length,4);
 assert.deepEqual(RD.profiles.map(p=>p.key),['infected-i','fiend-i','infected-ii','fiend-ii']);
 const powers=[[22200,47040,72320,98040,131100],[38760,112520,187390,267350,348340],[85410,179360,274890,372000,485560],[99960,202780,310800,424560,543120]];
 for(let i=0;i<4;i++){const p=RD.profiles[i];assert.deepEqual(p.levels.map(r=>r.level),[1,2,3,4,5]);assert.deepEqual(p.levels.map(r=>r.power),powers[i]);for(const row of p.levels)assert.deepEqual(Object.keys(row).sort(),['level','power']);for(const lang of B.langs){assert(p.name[lang]);assert(p.description[lang]);}}
 assert(!/ResourceCost|Duration|InternalId|sourceSha|rawHex|PlayerPrefs|C:\\/.test(JSON.stringify(RD)));
});
test('six research projections preserve all20 source rows, official descriptions and search anchor',()=>{
 for(const lang of B.langs){const d=parseHTML(B.renderResearch(lang)).document,block=d.querySelector('#research-effects-50[data-search-entry]');assert(block);const sections=[...block.querySelectorAll('section')];assert.equal(sections.length,4);
  for(let i=0;i<4;i++){const p=RD.profiles[i],s=sections[i];assert.equal(s.querySelector('h3').textContent,p.name[lang]);assert.equal(s.querySelector('p').textContent,p.description[lang]);const rows=[...s.querySelectorAll('tbody tr')];assert.equal(rows.length,5);assert.deepEqual(rows.map(r=>[...r.children].map(c=>Number(c.textContent.replace(/[^0-9]/g,'')))),p.levels.map(r=>[r.level,r.power]));}
  assert.equal(block.querySelectorAll('script,form').length,0,'Static research reference must not create a second cost calculator');
 }
});
test('generated laboratory pages retain four original reference cards alongside exact new model',()=>{
 let count=0;for(const lang of B.langs){const p=path.join(root,lang,'buildings/lab/index.html');if(!fs.existsSync(p))continue;const d=parseHTML(fs.readFileSync(p,'utf8')).document,block=d.querySelector('[data-growth-research-50]');assert(block);assert.equal(d.querySelectorAll('[data-growth-research-50]').length,1);assert.equal(block.outerHTML,parseHTML(B.renderResearch(lang)).document.querySelector('[data-growth-research-50]').outerHTML);assert(d.querySelector('#official-conditions-40'));const cards=[...d.querySelectorAll('.info-card')];assert(cards.length>=4);for(const value of ['131100','348340','485560','543120'])assert(cards.some(c=>lang==='de'?c.textContent.includes(new Intl.NumberFormat('de-DE').format(Number(value))):c.textContent.replace(/[,\s]/g,'').includes(value)));count++;}assert(count>=5);
});
test('gear EXP condition appears before the preserved calculator without changing data',()=>{
 let count=0;for(const lang of B.langs){assert(C[lang].gearExpCondition);const file=path.join(root,lang,'database/gear-exp/index.html');if(!fs.existsSync(file))continue;const d=parseHTML(fs.readFileSync(file,'utf8')).document,notes=d.querySelectorAll('[data-growth-exp-condition-50]');assert.equal(notes.length,1);assert.equal(notes[0].textContent,C[lang].gearExpCondition);assert(notes[0].nextElementSibling.matches('form[data-growth-form="gear"]'));assert.equal(d.querySelectorAll('form[data-growth-form="gear"]').length,1);count++;}assert(count>=5);
 const old=require('../data/expansion-22/database.json').datasets.gear;assert.equal(old.rows.length,79);assert.equal(old.rows.reduce((sum,r)=>sum+r.cost,0),1585500);assert.equal(old.rows.find(r=>r.from===39).cost,14400);assert.equal(old.rows.find(r=>r.from===49).cost,20500);
});
