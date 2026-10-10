'use strict';
const cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),baseline='77d75b51dc472e545226e241bbc760b54ae1241f',cache=new Map();
function original(file){if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:12e6}));return cache.get(file);}
function verify(document,file=''){
 if(!file)file=new URL(document.querySelector('link[rel="canonical"]').href).pathname.slice(1)+'index.html';
 if(path.isAbsolute(file))file=path.relative(root,file).replaceAll('\\','/');
 const match=file.match(/^(ko|en|ja|ru|zh-tw|de)\/(database|buildings\/lab)\/index\.html$/);assert(match,'Unapproved research navigation route '+file);
 const expected=parseHTML(require('./build-research-navigation-60').project(original(file),match[1],match[2])).document,signature=require('./client-truth-52-test-allowances').signature;
 assert.deepEqual(signature(document.documentElement),signature(expected.documentElement),'Exact research navigation projection '+file);return file;
}
function restore(document,file=''){
 if(!document.querySelector('[data-research-phase3-entry]'))return document;
 file=verify(document,file);document.replaceChild(parseHTML(original(file)).document.documentElement.cloneNode(true),document.documentElement);return document;
}
module.exports={verify,restore,original,baseline};
