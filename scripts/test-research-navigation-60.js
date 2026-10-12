'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{parseHTML}=require('linkedom'),B=require('./build-research-navigation-60'),A=require('./content-phase3-test-allowances');
const root=path.resolve(__dirname,'..');
function verifyLab(d,file){
 const C=require('./build-building-system'),signature=require('./client-truth-52-test-allowances').signature,lang=file.split('/')[0];
 const priorHtml=B.project(A.original(file),lang,'buildings/lab'),prior=parseHTML(priorHtml).document,expected=parseHTML(C.project(priorHtml,lang,'lab')).document;
 // The common building projection adds responsive labels to the existing
 // research table; its original text, numbers, links and other attributes stay exact.
 const researchSignature=document=>{const node=document.querySelector('[data-growth-research-50]').cloneNode(true);for(const table of node.querySelectorAll('table.bs-effect-table')){table.classList.remove('bs-effect-table');if(!table.className)table.removeAttribute('class');}for(const cell of node.querySelectorAll('[data-bs-label]'))cell.removeAttribute('data-bs-label');return signature(node);};
 assert.deepEqual(researchSignature(d),researchSignature(prior),'Existing research block stays exact '+file);
 assert.deepEqual(signature(d.querySelector('[data-research-phase3-entry]')),signature(prior.querySelector('[data-research-phase3-entry]')),'Research explorer navigation stays exact '+file);
 const metadata=document=>[...document.querySelectorAll('title,meta[name="description"],meta[property^="og:"],meta[name^="twitter:"],link[rel="canonical"],link[rel="alternate"]')].map(signature);
 assert.deepEqual(metadata(d),metadata(expected),'Current lab SEO projection '+file);
 const html='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
 assert.equal(C.project(html,lang,'lab'),html,'Current lab data and copy projection '+file);
}
test('twelve existing pages retain approved research navigation with the current lab building projection',()=>{
 for(const lang of B.langs)for(const route of B.routes){const file=`${lang}/${route}/index.html`,html=fs.readFileSync(path.join(root,file),'utf8'),d=parseHTML(html).document;if(route==='buildings/lab')verifyLab(d,file);else A.verify(d,file);assert.equal(d.querySelectorAll('[data-research-phase3-entry]').length,1);assert.equal(d.querySelector('[data-research-phase3-entry] a').href,`/${lang}/database/research/`);assert.equal(B.project(html,lang,route),html);}
});
test('research navigation allowance rejects altered numeric data, links and SEO',()=>{
 const file='en/buildings/lab/index.html',html=B.project(A.original(file),'en','buildings/lab');
 for(const edit of [d=>d.querySelector('main td').textContent='999999',d=>d.querySelector('[data-research-phase3-entry] a').href='/wrong/',d=>d.querySelector('title').textContent='Wrong']){const d=parseHTML(html).document;edit(d);assert.throws(()=>A.verify(d,file));}
});
test('current lab projection rejects altered research, building data, navigation and metadata',()=>{
 const file='en/buildings/lab/index.html',html=fs.readFileSync(path.join(root,file),'utf8');
 for(const edit of [d=>d.querySelector('[data-growth-research-50] td').textContent='999999',d=>d.querySelector('[data-building-system] td[data-resource]').setAttribute('data-raw','999999'),d=>d.querySelector('[data-research-phase3-entry] a').href='/wrong/',d=>d.querySelector('title').textContent='Wrong',d=>d.querySelector('meta[name="description"]').content='Wrong',d=>d.querySelector('link[rel="canonical"]').href='https://example.com/wrong/']){const d=parseHTML(html).document;edit(d);assert.throws(()=>verifyLab(d,file));}
});
