'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom'),A=require('./client-truth-52-test-allowances'),B=require('./build-client-truth-52');
test('historical adapter accepts only the exact client correction, rejects numeric and SEO tampering',()=>{
 const file='ko/database/gear-exp/index.html',html=B.project(A.original(file),file),doc=()=>parseHTML(html).document;
 assert.doesNotThrow(()=>A.restore(doc(),file));
 for(const mutate of [d=>{const n=d.querySelector('form[data-growth-form] script'),x=JSON.parse(n.textContent);x.rows[0].cost++;n.textContent=JSON.stringify(x);},d=>d.querySelector('link[rel=canonical]').href='https://tilessurvive.net/ko/changed/',d=>d.querySelector('meta[name=description]').setAttribute('content','Unapproved description'),d=>d.querySelector('h1').textContent='Changed heading']){const d=doc(),before=d.documentElement.outerHTML;mutate(d);assert.notEqual(d.documentElement.outerHTML,before,'Mutation must change fixture');assert.throws(()=>A.restore(d,file),/Exact client-source correction/);}
});
test('source adapter rejects corrupted costs, units and unauthorised independent pet changes',()=>{
 const file='data/expansion-22/database.json',old=JSON.parse(A.original(file)),correct=B.sourceProjection(file,old);assert(A.assertSource(correct,old,file));
 for(const mutate of [d=>d.datasets.gear.rows[0].cost++,d=>d.datasets.gear.unit='seconds',d=>d.datasets.petExp.rows[0].cost++]){const d=structuredClone(correct);mutate(d);assert.throws(()=>A.assertSource(d,old,file),/Exact client source/);}
});
