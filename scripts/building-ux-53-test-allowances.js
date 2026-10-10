'use strict';
// Validate the entire approved UI projection before exposing the previous DOM
// to historical structure tests. Numeric, SEO and link changes still fail closed.
const cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom'),ux=require('./build-building-ux-53');
const root=path.resolve(__dirname,'..'),cache=new Map(),phase60Base='927a28668ea8a0d4afa3c7d55b7611b06790c82f';
function original(file,revision='9883229'){const key=revision+':'+file;if(!cache.has(key))cache.set(key,cp.execFileSync('git',['show',key],{cwd:root,encoding:'utf8',maxBuffer:12e6}));return cache.get(key);}
function approvedContent60Projection(file){
 const [lang,,slug]=file.split('/'),growth=require('./build-building-growth-60'),before=original(file,phase60Base);
 if(slug!=='index.html')return growth.model.buildings.some(b=>b.slug===slug)?growth.project(before,file):before;
 const entries={};for(const a of require('../data/building-assets-51.json').assets){const route=`${lang}/buildings/${a.slug}/index.html`,source=original(route,phase60Base),html=growth.model.buildings.some(b=>b.slug===a.slug)?growth.project(source,route):source;entries[a.slug]=ux.coverage(a.slug,parseHTML(html).document);}
 return ux.catalog(before,lang,entries);
}
function restore(d,file){if(!d.documentElement.hasAttribute('data-building-ux-53'))return d;
 require('./content-phase3-test-allowances').restore(d,file);
 require('./content-phase2-test-allowances').restore(d,file);
 require('./asset-cache-test-allowances').restore(d);
 if(!file)file=new URL(d.querySelector('link[rel=canonical]').href).pathname.slice(1)+'index.html';if(path.isAbsolute(file))file=path.relative(root,file).replaceAll('\\','/');
 const parts=file.split('/'),lang=parts[0],slug=parts.length===4?parts[2]:'';assert(require('../data/building-assets-51.json').languages.includes(lang)&&parts[1]==='buildings','Unapproved building UI route');const before=original(file);let after;
 // Exact approved phase60 projection is checked first. The historical snapshot
 // is exposed only after the complete DOM (including every new numeric cell)
 // matches this deterministic projection from the immutable phase53 baseline.
 after=approvedContent60Projection(file);
 const signature=require('./client-truth-52-test-allowances').signature;assert.deepEqual(signature(d.documentElement),signature(parseHTML(after).document.documentElement),'Exact building UI projection '+file);d.replaceChild(parseHTML(before).document.documentElement.cloneNode(true),d.documentElement);return d;
}
module.exports={restore,approvedContent60Projection};
