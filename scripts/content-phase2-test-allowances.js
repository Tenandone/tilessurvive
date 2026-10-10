'use strict';
// Phase 2 additions are accepted only as complete, deterministic projections
// from the independently deployed Phase 1 commit.
const cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),baseline='bbe712d5242a65fa1fff7aaf8e53f17bdb492ed6',cache=new Map();
function original(file){if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:12e6}));return cache.get(file);}
function fileOf(document,file){if(!file)file=new URL(document.querySelector('link[rel="canonical"]').href).pathname.slice(1)+'index.html';return path.isAbsolute(file)?path.relative(root,file).replaceAll('\\','/'):file;}
function project(file){
  const lang=file.split('/')[0],before=original(file);
  if(/^(ko|en|ja|ru|zh-tw|de)\/buildings\/index\.html$/.test(file))return require('./build-building-phase2-60').projectCatalog(before,lang);
  if(/^(ko|en|ja|ru|zh-tw|de)\/database\/pet-system\/index\.html$/.test(file))return require('./build-pets-phase2').projectHub(before,lang);
  throw Error('Unapproved phase2 existing route '+file);
}
function verify(document,file){
  file=fileOf(document,file);
  const expected=parseHTML(project(file)).document,signature=require('./client-truth-52-test-allowances').signature;
  assert.deepEqual(signature(document.documentElement),signature(expected.documentElement),'Exact phase2 existing-page projection '+file);
  return file;
}
function restore(document,file=''){
  if(!document.querySelector('[data-building-phase2-card],[data-pets-phase2-entry]'))return document;
  file=verify(document,file);
  document.replaceChild(parseHTML(original(file)).document.documentElement.cloneNode(true),document.documentElement);
  return document;
}
module.exports={restore,verify,project,original,baseline};
