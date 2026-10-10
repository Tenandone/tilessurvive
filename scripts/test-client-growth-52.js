'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom');
const b=require('./build-client-growth-52'),calculate=require('../js/database-22').calculate;
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('model: gear current-level boundary and independently retained correction interval',()=>{
 assert.equal(b.model.gameVersion,'2.6.200');assert.equal(b.model.gear.rows.length,79);assert.equal(b.model.gear.profiles.length,18);
 assert.deepEqual(b.model.gear.rows.filter(r=>r.from>=39&&r.from<=49).map(r=>r.cost),[14500,15200,15900,16600,17300,18000,18700,19400,20100,20800,21700]);
 assert.equal(b.model.gear.rows[0].cost,400);assert.equal(b.model.gear.rows.at(-1).cost,59400);assert.equal(b.model.gear.rows.at(-1).sourceTotal,1592200);
 assert.deepEqual(b.model.gear.materials.map(m=>[m.id,m.expPerItem]),[[208012,100],[208013,400],[208014,2000]]);
 for(const item of b.model.gear.materials){assert.deepEqual(item.source,{gameVersion:'2.6.200',table:'itemlist',recordId:item.id,field:'Para1'});for(const lang of b.langs)assert(item.name[lang]&&item.description[lang]);}
});
test('calculator: current client EXP totals, held resources and missing-row protection',()=>{
 const rows=b.model.gear.rows;
 assert.deepEqual(calculate(rows,1,80,0),{total:1592200,held:0,shortage:1592200});
 assert.deepEqual(calculate(rows,39,50,100000),{total:198200,held:100000,shortage:98200});
 assert.deepEqual(calculate(rows,1,2,1000),{total:400,held:1000,shortage:0});
 assert.deepEqual(calculate(rows,80,80,0),{total:0,held:0,shortage:0});
 assert.equal(calculate(rows,50,39).error,'invalid');
 assert.deepEqual(calculate(rows.filter(r=>r.from!==40),39,42),{error:'missing',missing:[40]});
});
test('model: six-stage behemoth costs preserve null and separate cumulative anchor',()=>{
 const x=b.model.behemoth;assert.equal(x.itemId,206386);assert.equal(x.stagesPerStar,6);assert.equal(x.initialAcquisitionCost,null);assert.equal(x.cumulativeAnchorTotalStage,6);
 assert.deepEqual(x.profiles.map(p=>p.id),[126000006,126000008]);assert.equal(x.profiles.some(p=>p.id===126000009),false);
 assert.deepEqual(x.rows[0].steps,[null,4,4,4,4,6]);assert.equal(x.rows[0].total,null);assert.equal(x.rows[0].cumulativeFromCompleteOneStar,null);
 assert.deepEqual(x.rows[15].steps,[34,34,34,34,34,36]);assert.equal(x.rows[15].cumulativeFromCompleteOneStar,1830);
 assert.deepEqual(x.rows[24].steps,[52,52,52,52,52,56]);assert.equal(x.rows[24].total,316);
 assert.deepEqual(x.rows[59].steps,[192,192,192,192,192,200]);assert.equal(x.rows[59].total,1160);assert.equal(x.rows[59].cumulativeFromCompleteOneStar,30410);
 assert.equal(x.rows.slice(1).reduce((sum,r)=>sum+r.total,0),30410);
});
test('projection: canonical updater is pure, idempotent and confined to gear source/data',()=>{
 const input=JSON.parse(read('data/expansion-22/database.json')),snapshot=JSON.stringify(input),out=b.updateDatasets(input);
 assert.equal(JSON.stringify(input),snapshot);assert.deepEqual(out,b.updateDatasets(out));
 const originalRest=JSON.parse(snapshot),outputRest=JSON.parse(JSON.stringify(out));delete originalRest.sources.gear;delete originalRest.datasets.gear;delete outputRest.sources.gear;delete outputRest.datasets.gear;assert.deepEqual(outputRest,originalRest);
 assert.deepEqual(out.datasets.gear.rows,b.model.gear.rows);assert.deepEqual(out.sources.gear,b.source);
});
test('projection: six-language HTML keeps SEO, official images and affiliate destinations',()=>{
 for(const route of b.pages){const html=read(route),before=parseHTML(html).document,output=b.project(html,route),after=parseHTML(output).document;
  assert.equal(b.project(output,route),output,'Idempotence '+route);
  const signature=d=>({h1:[...d.querySelectorAll('h1')].map(n=>n.textContent),canonical:d.querySelector('link[rel=canonical]').outerHTML,hreflang:[...d.querySelectorAll('link[hreflang]')].map(n=>n.outerHTML),images:[...d.querySelectorAll('img')].map(n=>n.outerHTML),affiliate:[...d.querySelectorAll('a[href*="lootbar"]')].map(n=>n.outerHTML)});
  assert.deepEqual(signature(after),signature(before),route);
 }
});
test('generated: all six embedded gear calculator models match canonical client rows',()=>{
 const canonical=JSON.parse(read('data/expansion-22/database.json'));assert.deepEqual(canonical.datasets.gear.rows,b.model.gear.rows);assert.deepEqual(canonical.sources.gear,b.source);
 for(const lang of b.langs){const d=parseHTML(read(`${lang}/database/gear-exp/index.html`)).document,form=d.querySelector('[data-growth-form="gear"]'),cfg=JSON.parse(form.querySelector('script').textContent);assert.deepEqual(cfg.rows,b.model.gear.rows);assert.equal(calculate(cfg.rows,1,80).total,1592200);
  assert.equal(d.querySelector('[data-growth-exp-condition-50]').textContent,b.copy[lang].gear);
  const table=[...d.querySelectorAll('table')].find(t=>t.querySelectorAll('tbody tr').length===79);assert.deepEqual([...table.querySelectorAll('tbody tr')].map(r=>[Number(r.children[1].getAttribute('data-ts-original-value')),Number(r.children[2].getAttribute('data-ts-original-value'))]),b.model.gear.rows.map(r=>[r.cost,r.sourceTotal]));
  assert(!/1[, .\u00a0\u202f]585[, .\u00a0\u202f]500/.test(d.querySelector('main').textContent));
 }
});
test('generated: eighteen star tables match client stages and never display null as zero',()=>{
 let tables=0;for(const route of b.pages.filter(p=>p.includes('behemoth'))){const lang=route.split('/')[0],d=parseHTML(read(route)).document,table=d.querySelector('[data-client-growth-52="behemoth-stars"]');assert(table,route);const rows=[...table.querySelectorAll('tbody tr')];assert.equal(rows.length,60);rows.forEach((row,i)=>{const expected=[...b.model.behemoth.rows[i].steps,b.model.behemoth.rows[i].total,b.model.behemoth.rows[i].cumulativeFromCompleteOneStar];assert.deepEqual([...row.children].slice(1).map(c=>c.getAttribute('data-ts-original-value')===null?null:Number(c.getAttribute('data-ts-original-value'))),expected);for(let j=0;j<8;j++)if(expected[j]===null)assert.equal(row.children[j+1].textContent,'—');});assert.equal(table.querySelector('thead tr').lastElementChild.textContent,b.copy[lang].cumulative);assert.equal(d.querySelector('[data-client-growth-52="behemoth-scope"]').textContent,b.copy[lang].behemoth);tables++;}assert.equal(tables,18);
});
test('projection: every mobile star card and summary follows the corrected curve',()=>{
 for(const route of b.pages.filter(p=>p.includes('behemoth'))){const lang=route.split('/')[0],d=parseHTML(b.project(read(route),route)).document,cards=[...d.querySelectorAll('.star-card')];assert.equal(cards.length,60);cards.forEach((card,i)=>{const row=b.model.behemoth.rows[i];assert.deepEqual([...card.querySelectorAll('.star-card__item span')].map(n=>n.textContent),row.steps.map(n=>b.format(n,lang)));assert.equal(card.querySelector('.star-card__total').textContent,`${b.copy[lang].subtotal} ${b.format(row.total,lang)} / ${b.copy[lang].cumulative}: ${b.format(row.cumulativeFromCompleteOneStar,lang)}`);});
  const summaries=[...d.querySelectorAll('[data-client-growth-52="behemoth-summary"]')];assert.equal(summaries.length,route.includes('/database/')?7:2);assert(summaries.some(n=>n.querySelector('span').textContent===b.format(30410,lang)));assert(summaries.some(n=>n.querySelector('span').textContent===b.format(6166,lang)));if(route.includes('/database/'))assert.equal(summaries.filter(n=>n.querySelector('span').textContent===b.copy[lang].unknown).length,2);
  assert(![...d.querySelectorAll('main *')].some(n=>!n.children.length&&/31[, .\u00a0\u202f]?526|6[, .\u00a0\u202f]?566/.test(n.textContent)),route+' stale total');
  const table=d.querySelector('[data-client-growth-52="behemoth-stars"]'),sort=[...d.querySelectorAll('select[data-sort][aria-controls]')].find(n=>n.getAttribute('aria-controls')===table.id);assert(sort,route);assert.equal(sort.querySelector('option[value="8:asc"]').textContent,b.copy[lang].cumulative+' ↑');assert.equal(sort.querySelector('option[value="8:desc"]').textContent,b.copy[lang].cumulative+' ↓');
  assert.equal(d.querySelector('[data-client-growth-52="behemoth-scope"]').closest('.wide-table-wrap'),null,route+' scope must remain visible with mobile cards');
 }
});
test('projection: material pages change only the verified gear source anchor',()=>{
 for(const route of b.pages.filter(p=>p.includes('/growth-materials/'))){const before=parseHTML(read(route)).document,after=parseHTML(b.project(read(route),route)).document;const links=[...after.querySelectorAll('a[href]')].filter(a=>a.getAttribute('href')===b.source.url);assert.equal(links.length,1);assert.equal(links[0].textContent,'github.com · 2.6.200');
  const normalize=d=>{for(const a of d.querySelectorAll('a[href]'))if(['https://www.tilesguide.com/guides/gear-scraps',b.source.url].includes(a.getAttribute('href'))){a.setAttribute('href','SOURCE');a.textContent='SOURCE';}return d.documentElement.outerHTML;};assert.equal(normalize(before),normalize(after),route);
 }
});
