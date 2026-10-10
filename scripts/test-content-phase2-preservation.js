'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{parseHTML}=require('linkedom'),A=require('./content-phase2-test-allowances');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw','de'];
test('all twelve existing hubs exactly match their reviewed additive projections',()=>{
 for(const lang of langs)for(const route of ['buildings','database/pet-system']){const file=`${lang}/${route}/index.html`;A.verify(parseHTML(fs.readFileSync(path.join(root,file),'utf8')).document,file);}
});
test('phase2 preservation rejects unrelated metadata edits and missing or altered entries',()=>{
 for(const route of ['buildings','database/pet-system']){const file=`en/${route}/index.html`,html=A.project(file);
  for(const mutate of [d=>{d.querySelector('title').textContent='Unreviewed';},d=>{d.querySelector('[data-building-phase2-card],[data-pets-phase2-entry]').remove();},d=>{d.querySelector('[data-building-phase2-card] a,[data-pets-phase2-card]').setAttribute('href','/wrong/');}]){const d=parseHTML(html).document;mutate(d);assert.throws(()=>A.verify(d,file));}
 }
});
