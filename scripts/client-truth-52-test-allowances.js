'use strict';
// Historical regression view: validate the complete approved client projection
// before restoring its previous DOM for tests of unrelated structure and content.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),baseline='fc54f4b18e1196e5a5ad2facb0a22455ac1ab48f',cache=new Map();
function original(file){if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:12e6}));return cache.get(file);}
function signature(n){if(n.nodeType===3)return n.textContent.trim()?['text',n.textContent.trim()]:null;if(n.nodeType!==1)return null;const children=[];let text='';const flush=()=>{if(text.trim())children.push(['text',text.trim()]);text='';};for(const child of n.childNodes){if(child.nodeType===3)text+=child.textContent;else{flush();const value=signature(child);if(value)children.push(value);}}flush();return[n.tagName,[...n.attributes].map(a=>[a.name,a.value]).sort(([a],[b])=>a.localeCompare(b)),children];}
function restore(document,file=''){
 require('./asset-cache-test-allowances').restore(document);
 require('./content-combat-60-test-allowances').restore(document,file);
 require('./building-ux-53-test-allowances').restore(document,file);
 if(!document.documentElement.hasAttribute('data-client-truth-52'))return document;
 if(!file)file=new URL(document.querySelector('link[rel=canonical]').href).pathname.slice(1)+'index.html';
 if(path.isAbsolute(file))file=path.relative(root,file).replaceAll('\\','/');
 const builder=require('./build-client-truth-52');assert(builder.pages().includes(file),'Unapproved client-correction route '+file);
 const before=original(file),expected=parseHTML(builder.project(before,file)).document;
 const actualSignature=JSON.stringify(signature(document.documentElement)),expectedSignature=JSON.stringify(signature(expected.documentElement));if(actualSignature!==expectedSignature){let at=0;while(actualSignature[at]===expectedSignature[at])at++;throw new Error('Exact client-source correction '+file+' differs at '+at+'; expected '+expectedSignature.slice(Math.max(0,at-90),at+220)+'; actual '+actualSignature.slice(Math.max(0,at-90),at+220));}
 const old=parseHTML(before).document;document.replaceChild(old.documentElement.cloneNode(true),document.documentElement);return document;
}
function assertSource(actual,before,file){const updated=require('./build-client-truth-52').sourceProjection(file,typeof before==='string'?JSON.parse(before):before);assert.deepEqual(typeof actual==='string'?JSON.parse(actual):actual,updated,'Exact client source/provenance projection '+file);return true;}
module.exports={restore,assertSource,signature,original,baseline};
