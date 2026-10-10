'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const {selectedRows}=require('../js/building-refinement-51'),build=require('./build-building-refinement-51'),math=require('../js/platform-math');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw','de'];
const client52=require('./client-truth-52-test-allowances');
function historicalPage(file){return client52.restore(parseHTML(fs.readFileSync(path.join(root,file),'utf8')).document,file);}
test('deferred head script waits for body arithmetic during interactive ready state',()=>{
 const vm=require('node:vm');let registered=null,queries=0;
 const document={readyState:'interactive',addEventListener:(name,callback)=>{assert.equal(name,'DOMContentLoaded');registered=callback;},querySelectorAll:()=>{queries++;return [];}};
 const context={document,module:{exports:{}}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'js/building-refinement-51.js'),'utf8'),context);
 assert.equal(queries,0);assert.equal(typeof registered,'function');context.TS_MATH=math;registered();assert.equal(queries,1);
});
test('planner details reject reversals, fractions, missing boundaries and gaps',()=>{
 const rows=[1,2,3,4].map(level=>({level}));assert.deepEqual(selectedRows(rows,1,3),rows.slice(1,3));assert.deepEqual(selectedRows(rows,2,2),[]);
 for(const [a,b]of [[3,2],[0,4],[1,5],[1.5,3],[NaN,3]])assert.equal(selectedRows(rows,a,b),null);
 assert.equal(selectedRows([{level:1},{level:3}],1,3),null);
});
test('18 planners preserve source tables, boundaries and sums for every level range',()=>{
 let forms=0,ranges=0;
 for(const lang of langs)for(const slug of ['power-plant','barracks']){
  const d=historicalPage(`${lang}/buildings/${slug}/index.html`);
  for(const form of d.querySelectorAll('[data-building-planner]')){
   const detail=form.querySelector('[data-building-plan-steps-51]');assert(detail);assert.equal(detail.querySelector('tbody').children.length,0);assert(detail.hasAttribute('hidden'),'Progressive enhancement only');
   const table=d.getElementById(form.dataset.table),rows=[...table.querySelectorAll('tbody tr')].map(r=>({level:Number(r.children[0].textContent),cells:[...r.children].map(c=>c.getAttribute('data-ts-original-value')||c.textContent.trim())}));
   for(let from=1;from<=30;from++)for(let to=from;to<=30;to++){
    const part=selectedRows(rows,from,to);assert.equal(part.length,to-from);
    const expected=[2,3,4,5].map(col=>part.reduce((s,r)=>s+math.amount(r.cells[col]),0));
    const complete=part.every(r=>[2,3,4,5].every(col=>math.amount(r.cells[col])!==null)&&math.minutes(r.cells[Number(form.dataset.timeColumn)])!==null);
    if(complete){const sum=math.sumRange(rows,from,to,[2,3,4,5],Number(form.dataset.timeColumn));assert.deepEqual(sum.totals,expected);assert.equal(sum.time,part.reduce((s,r)=>s+math.minutes(r.cells[Number(form.dataset.timeColumn)]),0));}else assert.throws(()=>math.sumRange(rows,from,to,[2,3,4,5],Number(form.dataset.timeColumn)));
    ranges++;
   }forms++;
  }
 }assert.equal(forms,18);assert.equal(ranges,8370);
});
test('new building effects use explicit source levels and all six locale strings',()=>{
 const data=require('../data/building-refinement-51.json');assert.equal(data.gameVersion,'2.6.200');assert(data.profiles.length>=2);
 for(const profile of data.profiles){assert.equal(profile.levels.length,30);profile.levels.forEach((r,i)=>{assert.equal(r.level,i+1);assert.equal(r.values.length,profile.metrics.length);assert(r.values.every(v=>Number.isFinite(v)&&v>=0));});
  for(const lang of langs){assert(profile.metrics.every(m=>typeof m.name[lang]==='string'&&m.name[lang].length));const d=historicalPage(`${lang}/buildings/${profile.slug}/index.html`),s=d.querySelector('[data-building-refinement-51]');assert(s);const expected=parseHTML(build.effectSection(profile,lang)).document.querySelector('[data-building-refinement-51]');assert.equal(s.outerHTML,expected.outerHTML);}
 }
 const comms=data.profiles.find(p=>p.slug==='comms-outpost');assert.deepEqual(comms.levels.map(r=>r.values[0]),Array.from({length:30},(_,i)=>i+1));
 const lab=data.profiles.find(p=>p.slug==='lab');assert.equal(lab.levels[0].values[0],0.25);assert.equal(lab.levels.at(-1).values[0],12);
});
