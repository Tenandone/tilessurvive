'use strict';
const assert=require('node:assert/strict'),chests=require('../build-item-chest-rewards-41');
function assertSearchExtension(before,after){
 const old=typeof before==='object'&&!Buffer.isBuffer(before)?before:JSON.parse(String(before)),now=typeof after==='object'&&!Buffer.isBuffer(after)?after:JSON.parse(String(after));
 const added=chests.entries(),urls=new Set(added.map(x=>x.url));assert.equal(urls.size,15);
 assert.deepEqual(Object.keys(now).sort(),Object.keys(old).sort());assert(Number.isFinite(Date.parse(now.generatedAt)));
 assert.equal(now.itemCount,old.itemCount+15);assert.equal(now.items.length,old.items.length+15);assert.equal(new Set(now.items.map(i=>i.url)).size,now.items.length);
 assert(!old.items.some(i=>urls.has(i.url)),'Baseline already contains added chest anchors');
 assert.deepEqual(now.items.filter(i=>!urls.has(i.url)),old.items,'Every previous search object and order');
 assert.deepEqual(now.items.filter(i=>urls.has(i.url)).sort((a,b)=>a.url.localeCompare(b.url)),added.sort((a,b)=>a.url.localeCompare(b.url)),'Only exact reviewed chest entries');
}
function withoutChestSearch(current){
 const urls=new Set(chests.entries().map(i=>i.url)),items=current.items.filter(i=>!urls.has(i.url));
 const prior={...current,itemCount:items.length,items};assertSearchExtension(prior,current);return prior;
}
module.exports={assertSearchExtension,withoutChestSearch};
