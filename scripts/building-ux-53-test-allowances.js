'use strict';
// Validate the entire approved UI projection before exposing the previous DOM
// to historical structure tests. Numeric, SEO and link changes still fail closed.
const cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom'),ux=require('./build-building-ux-53');
const root=path.resolve(__dirname,'..'),cache=new Map();
function original(file){if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show','9883229:'+file],{cwd:root,encoding:'utf8',maxBuffer:12e6}));return cache.get(file);}
function restore(d,file){if(!d.documentElement.hasAttribute('data-building-ux-53'))return d;
 if(!file)file=new URL(d.querySelector('link[rel=canonical]').href).pathname.slice(1)+'index.html';if(path.isAbsolute(file))file=path.relative(root,file).replaceAll('\\','/');
 const parts=file.split('/'),lang=parts[0],slug=parts.length===4?parts[2]:'';assert(require('../data/building-assets-51.json').languages.includes(lang)&&parts[1]==='buildings','Unapproved building UI route');const before=original(file);let after;
 if(slug)after=ux.detail(before,lang,slug).html;else{const entries={};for(const a of require('../data/building-assets-51.json').assets)entries[a.slug]=ux.coverage(a.slug,parseHTML(original(`${lang}/buildings/${a.slug}/index.html`)).document);after=ux.catalog(before,lang,entries);}
 const signature=require('./client-truth-52-test-allowances').signature;assert.deepEqual(signature(d.documentElement),signature(parseHTML(after).document.documentElement),'Exact building UI projection '+file);d.replaceChild(parseHTML(before).document.documentElement.cloneNode(true),d.documentElement);return d;
}
module.exports={restore};
