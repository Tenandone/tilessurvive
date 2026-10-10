const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto'),{execFileSync}=require('node:child_process'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),release='9ab98dc28ac8cd8e8bb8dbf94b61385be8f8e9e1',languages=['ko','en','ja','ru','zh-tw'];
const allowances=require('./foundation-40-test-allowances'),starhorn=require('../data/foundation-40/starhorn-growth.json'),hatchingCopy=require('../data/foundation-40/pet-hatching-copy');
const patch41=require('./integration-41-test-allowances');
// Read immutable Git blobs in one batch. A mutable adjacent checkout cannot weaken this baseline.
const tree=execFileSync('git',['ls-tree','-r','-z',release,'--',...languages,'js/platform-math.js','js/database-22.js','js/tools-speedup-calculator.js','data/expansion-22/database.json'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).map(line=>{const [meta,file]=line.split('\t');return{file,sha:meta.split(' ')[2]};}).filter(entry=>entry.file.endsWith('.html')||entry.file.startsWith('js/')||entry.file==='data/expansion-22/database.json');
const blobs=execFileSync('git',['cat-file','--batch'],{cwd:root,input:tree.map(entry=>entry.sha).join('\n')+'\n',maxBuffer:64*1024*1024});
const baselineFiles=new Map();let cursor=0;
for(const entry of tree){const end=blobs.indexOf(10,cursor),header=blobs.subarray(cursor,end).toString('ascii').split(' ');assert.equal(header[0],entry.sha);assert.equal(header[1],'blob');const size=Number(header[2]);assert(Number.isSafeInteger(size)&&size>=0);cursor=end+1;baselineFiles.set(entry.file,blobs.subarray(cursor,cursor+size));cursor+=size;assert.equal(blobs[cursor++],10);}
assert.equal(cursor,blobs.length,'Complete immutable Git batch');
const beforeDocs=new Map(),beforeDocument=relative=>{if(!beforeDocs.has(relative))beforeDocs.set(relative,parseHTML(baselineFiles.get(relative).toString('utf8')).document);return beforeDocs.get(relative);};
const baselineDb=JSON.parse(baselineFiles.get('data/expansion-22/database.json'));
const growth=require('../js/database-22'),math=require('../js/platform-math'),ui=require('../js/data-workbench-30'),db=require('../data/expansion-22/database.json');
let checks=0,tables=0,forms=0,planners=0;
const equal=(a,b,n)=>{assert.deepEqual(a,b,n);checks++;};const ok=(v,n)=>{assert.ok(v,n);checks++;};
const read=file=>parseHTML(fs.readFileSync(file,'utf8')).document;
const values=table=>[...table.querySelectorAll('tr')].map(row=>[...row.querySelectorAll('th,td')].map(c=>c.textContent.replace(/\s+/g,' ').trim()));
function reviewedTableRows(table,relative){
 const originalRows=values(table),expected=allowances.expectedRows(originalRows,relative),lang=relative.split('/')[0];
 if(!allowances.petHub(relative))return expected;
 if(table.id==='ts3-data-table-0'){
  // Only the three egg headings change; the seven probability/identity rows remain exact.
  expected[0]=[...originalRows[0].slice(0,2),...hatchingCopy[lang].eggs];return expected;
 }
 const model=table.id==='ts3-data-table-2'?starhorn.expRows:table.id==='ts3-data-table-3'?starhorn.trainingRows:null;
 if(model){
  // expectedRows first verifies every old non-null cost. The full table then includes only explicit source rows.
  const headings=table.id==='ts3-data-table-3'?patch41.trainingHeadings[lang]:originalRows[0];
  let total=0;return[headings,...model.map(row=>{total+=row.cost;return[`${row.from} → ${row.to}`,row.cost.toLocaleString('en-US'),total.toLocaleString('en-US')];})];
 }
 if(table.id==='ts3-data-table-4')return[...expected,['5','100%']];
 return expected;
}
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
for(const lang of languages){
 equal(Object.keys(ui.copy[lang]).sort(),Object.keys(ui.copy.en).sort(),lang+' translation keys');
 equal(Object.keys(ui.catalogCopy[lang]).sort(),Object.keys(ui.catalogCopy.en).sort(),lang+' catalog translation keys');
 for(const file of walk(path.join(root,lang)).filter(f=>f.endsWith('.html'))){
  const d=read(file);if(!d.querySelector('.ts3-data-page'))continue;
  const rel=path.relative(root,file).replaceAll('\\','/');const hasOriginal=baselineFiles.has(rel);
  if(allowances.petHub(rel))patch41.assertPetSelection(d,lang);
  ok(d.querySelector('script[src^="/js/data-workbench-30.js"]'),rel+' data script');
  ok(d.querySelector('link[href^="/css/data-workbench-30.css"]'),rel+' data CSS');
  if(hasOriginal){
   const before=beforeDocument(rel),current=[...d.querySelectorAll('main table')].map(values);
   for(const table of before.querySelectorAll('main table')){
    const originalRows=values(table),placeholder=originalRows.length>1&&originalRows.slice(1).every(row=>row.length===2&&/^(미정|未定|Undecided)$/.test(row[1]));
    // Entirely empty season-3 scaffolding carries no game facts; product cleanup may remove it.
    if(placeholder&&/[\\/]seasons[\\/]season-3[\\/]/.test(rel))continue;
    const expected=reviewedTableRows(table,rel);
    ok(current.some(v=>JSON.stringify(v)===JSON.stringify(expected)),rel+' original table cells preserved with exact reviewed deltas '+table.id);
   }
   const config=n=>[...n.querySelectorAll('[data-growth-form]')].map(form=>({key:form.getAttribute('data-growth-form'),config:JSON.parse(form.querySelector('script[type="application/json"]').textContent)}));
   equal(config(d),allowances.forms(config(before),rel),rel+' calculator input data preserved with exact Starhorn rows');
  }
  const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);equal(new Set(ids).size,ids.length,rel+' unique IDs');
  for(const table of d.querySelectorAll('[data-workbench]')){
   tables++;ok(table.parentElement.classList.contains('ts3-table-scroll'),rel+' keyboard-scrollable source table');
   equal(table.parentElement.getAttribute('tabindex'),'0',rel+' table tabindex');
   ok(!table.hasAttribute('hidden'),rel+' static data visible without JavaScript');
   ok(table.querySelectorAll('thead th').length>0,rel+' column headers');
   const host=table.closest('.ts3-data-workbench'),select=host.querySelector('[data-row-select]');
   if(select)equal(select.querySelectorAll('option').length,table.querySelectorAll('tbody tr').length,rel+' every row selectable');
   for(const control of host.querySelectorAll('[aria-controls]'))ok(d.getElementById(control.getAttribute('aria-controls')),rel+' control target exists');
  }
  for(const form of d.querySelectorAll('[data-growth-form]')){
   forms++;ok(d.getElementById(form.dataset.growthTable),rel+' growth result linked to original table');
   for(const input of form.querySelectorAll('input'))ok(d.getElementById(input.getAttribute('aria-describedby')),rel+' input help linked');
   equal(form.querySelector('output').getAttribute('aria-live'),'polite',rel+' immediate accessible growth result');
  }
  for(const form of d.querySelectorAll('[data-building-planner]')){
   planners++;const table=d.getElementById(form.dataset.table);ok(table,rel+' building source table linked');
   for(const parent of [form.closest('.desktop-table'),form.closest('.desktop-only')].filter(Boolean)){ok(parent.classList.contains('ts3-table-visible'),rel+' building calculator must remain available on mobile');}
   const rows=[...table.querySelectorAll('tbody tr')].map(r=>({level:+r.children[0].textContent,cells:[...r.children].map(c=>c.textContent.trim())}));
   const from=+form.querySelector('[name="from"]').dataset.default,to=+form.querySelector('[name="to"]').dataset.default;
   const result=math.sumRange(rows,from,to,[2,3,4,5],+form.dataset.timeColumn);ok(result.totals.every(Number.isFinite),rel+' complete default range');
   equal(math.sumRange(rows,from,from,[2,3,4,5],+form.dataset.timeColumn),{totals:[0,0,0,0],time:0,levels:[]},rel+' no upgrade zero cost');
   assert.throws(()=>math.sumRange(rows,to,from,[2,3,4,5],+form.dataset.timeColumn),/range/);checks++;
  }
  const entries=[...d.querySelectorAll('[data-catalog-entry]')];
  if(entries.length){
   if(entries.length>=5)ok(d.querySelector('[data-catalog-controls]'),rel+' searchable catalog controls');
   if(hasOriginal){
    const before=beforeDocument(rel);
    for(const card of before.querySelectorAll('.building-card,.behemoth-card,.tool-card.is-linked')){
     const name=card.querySelector('h3')?.textContent,match=entries.find(n=>n.querySelector('h3')?.textContent===name);ok(match,rel+' original catalog name '+name);
     if(match){for(const p of card.querySelectorAll('p'))ok(match.textContent.includes(p.textContent),rel+' original item description preserved');const src=card.querySelector('img')?.getAttribute('src');if(src){const reviewed=require('./foundation-40-test-allowances').image(rel,src);ok(match.querySelector(`img[src="${reviewed}"]`),rel+' original or exactly reviewed item image preserved');}}
    }
   }
   for(const link of d.querySelectorAll('.ts3-catalog-data a')){
    const [route,fragment]=link.getAttribute('href').split('#'),target=path.join(root,route,'index.html');ok(fs.existsSync(target),rel+' catalog table route exists');if(fs.existsSync(target))ok(read(target).getElementById(fragment),rel+' catalog table deep link exists');
   }
  }
  if(/[\\/]tools[\\/]index\.html$/.test(file)){
   ok(!d.querySelector('#comingToolsTitle'),rel+' empty roadmap section removed');
   ok(!d.querySelector('.tool-card-disabled'),rel+' inactive placeholder tiles removed');
   ok(!d.querySelector('#eventCtaTitle'),rel+' duplicate event-helper promotion removed');
   const questions=[...d.querySelectorAll('.tool-faq summary')].map(n=>n.textContent.trim()).join(' ');
   ok(!/준비 중인 카드|준비 중.*사용|coming soon cards|準備中カード|карточки в разработке|準備中的卡片/.test(questions),rel+' obsolete roadmap FAQ removed');
  }
  if(/[\\/]buildings[\\/]lab[\\/]index\.html$/.test(file)){
   const text=d.querySelector('main').textContent;
   ok(!/소실|준비 후 순차|was lost|reorganized|一部消失|準備後|утрачены|по мере подготовки|資料曾有部分遺失|資料整理完成後/.test(text),rel+' internal recovery workflow removed');
   if(hasOriginal){const before=beforeDocument(rel);for(const node of before.querySelectorAll('.info-card p,.priority-card p'))ok(text.includes(node.textContent),rel+' every existing research effect and priority preserved');}
  }
 }
}
equal(growth.calculate(db.datasets.gear.rows,1,80,1000),{total:1585500,held:1000,shortage:1584500},'full equipment range + inventory');
equal(growth.calculate(db.datasets.skillBook.rows,29,30,100),{total:685,held:100,shortage:585},'disputed level retains 685');
equal(growth.calculate(db.datasets.skillBook.rows,1,40),{total:23505,held:0,shortage:23505},'preserved full skill book sum');
equal(growth.calculate(db.datasets.exclusive.rows,1,15,400),{total:360,held:400,shortage:0},'excess inventory never negative shortage');
equal(growth.calculate(baselineDb.datasets.petExp.rows,85,87),{error:'missing',missing:[86]},'historical missing pet transition remains blocked');
equal(db,allowances.source('data/expansion-22/database.json',baselineDb),'entire database has only the exact approved field and growth changes');
equal(baselineDb.datasets.petExp.rows.filter(row=>row.cost!==null).length,54,'all 54 legacy non-null EXP costs remain covered');
for(const [key,model]of [['petExp',starhorn.expRows],['petTraining',starhorn.trainingRows]]){
 for(const old of baselineDb.datasets[key].rows.filter(row=>row.cost!==null)){const current=db.datasets[key].rows.find(row=>row.from===old.from&&row.to===old.to);ok(current,key+' old transition retained');equal(current.cost,old.cost,key+' old non-null cost exactly preserved');}
 const withoutOne=model.map(row=>({...row}));withoutOne[0].cost=null;
 equal(growth.calculate(withoutOne,withoutOne[0].from,withoutOne[0].to),{error:'missing',missing:[withoutOne[0].from]},key+' current-row null cost is blocked rather than zero');
}
equal(growth.calculate(db.datasets.petExp.rows,85,87),{total:starhorn.expRows.filter(row=>row.from>=85&&row.to<=87).reduce((n,row)=>n+row.cost,0),held:0,shortage:starhorn.expRows.filter(row=>row.from>=85&&row.to<=87).reduce((n,row)=>n+row.cost,0)},'only the confirmed previously missing range now resolves');
equal(growth.calculate(db.datasets.petExp.rows,41,41,10),{total:0,held:10,shortage:0},'zero-step range');
equal(growth.calculate(db.datasets.petTraining.rows,0,4),{total:1300,held:0,shortage:1300},'pet training total');
for(const [from,to,held]of [[NaN,10,0],[10,9,0],[1.5,4,0],[1,4,-1],[0,80,0],[1,81,0]])equal(growth.calculate(db.datasets.gear.rows,from,to,held),{error:'invalid'},'invalid input rejected');
equal(ui.numeric('1.5K'),1500,'abbreviation parsed');equal(ui.numeric('1,200'),1200,'separator parsed');equal(ui.numeric('90%'),90,'percentage parsed');equal(ui.numeric('—'),null,'missing is not zero');
equal(['1M','200','3K'].sort((a,b)=>ui.compare(a,b,'en')),['200','3K','1M'],'numeric sort across units');
equal(['—','200','3K'].sort((a,b)=>ui.compare(a,b,'en',-1)),['3K','200','—'],'missing remains last descending');
equal(['1일','23시간','3분','—'].sort((a,b)=>ui.compare(a,b,'ko',1,math.minutes)),['3분','23시간','1일','—'],'chronological sort across localized units');
for(const file of ['js/platform-math.js','js/database-22.js','js/tools-speedup-calculator.js']){
 ok(baselineFiles.has(file),file+' immutable formula baseline exists');equal(fs.readFileSync(path.join(root,file),'utf8'),baselineFiles.get(file).toString('utf8'),file+' formula module byte preservation');
}
ok(fs.readFileSync(path.join(root,'js/platform.js'),'utf8').includes("if (table.hasAttribute('data-workbench')) return;"),'legacy explorer bypass prevents duplicate controls');
ok(fs.readFileSync(path.join(root,'css/data-workbench-30.css'),'utf8').includes('prefers-reduced-motion'),'reduced-motion override');
console.log(`Data workspace: ${checks} checks passed; ${tables} source tables, ${forms} growth forms, ${planners} building planners. Browser interactions and visual layout require browser QA.`);
