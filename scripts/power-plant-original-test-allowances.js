'use strict';
// Accept only the complete approved Power Plant projection from its immutable
// pre-change revision. Historical tests receive that revision only after the
// entire new document (not just the changed table) has matched exactly.
const cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),baseline='7bc9870c10aa0b84f7d76591cda5d289f2c38592',clientCorrectionBaseline='9883229c691148b9ee0f094aac439fd52f977c67',cache=new Map();
const route=/^(ko|en|ja|ru|zh-tw|de)\/buildings\/power-plant\/index\.html$/;
function fileOf(document,file=''){
  if(!file){const canonical=document.querySelector('link[rel="canonical"]');assert(canonical,'Exact Power Plant projection requires a route');file=new URL(canonical.href).pathname.slice(1)+'index.html';}
  return path.isAbsolute(file)?path.relative(root,file).replaceAll('\\','/'):file.replaceAll('\\','/');
}
function snapshot(file,revision){assert(route.test(file),'Exact Power Plant projection unapproved route '+file);const key=revision+':'+file;if(!cache.has(key))cache.set(key,cp.execFileSync('git',['show',key],{cwd:root,encoding:'utf8',maxBuffer:12e6}));return cache.get(key);}
function original(file){return snapshot(file,baseline);}
function clientCorrectionOriginal(file){return snapshot(file,clientCorrectionBaseline);}
function verify(document,file=''){
  file=fileOf(document,file);assert(route.test(file),'Exact Power Plant projection unapproved route '+file);
  const expected=parseHTML(require('./build-power-plant-original').project(original(file),file)).document;
  const signature=require('./client-truth-52-test-allowances').signature;
  assert.deepEqual(signature(document.documentElement),signature(expected.documentElement),'Exact Power Plant projection '+file);
  return file;
}
function restore(document,file=''){
  // Legacy documents belong to the existing phase53/client52 strict verifiers.
  // Multiple independent markers also detect removal of the primary marker.
  const marked=document.querySelector('[data-power-plant-original],[data-power-plant-model],[data-power-plant-asset],.power-plant-original,.requirements-block')||document.documentElement.hasAttribute('data-power-plant-page');
  if(!marked)return document;
  file=fileOf(document,file);
  assert(route.test(file),'Exact Power Plant projection unapproved route '+file);
  const before=parseHTML(original(file)).document;
  verify(document,file);
  document.replaceChild(before.documentElement.cloneNode(true),document.documentElement);
  return document;
}
module.exports={restore,verify,original,baseline,clientCorrectionOriginal,clientCorrectionBaseline};
