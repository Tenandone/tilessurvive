'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{parseHTML}=require('linkedom'),B=require('./build-research-navigation-60'),A=require('./content-phase3-test-allowances');
const root=path.resolve(__dirname,'..');
test('twelve existing pages add only the approved research explorer navigation',()=>{
 for(const lang of B.langs)for(const route of B.routes){const file=`${lang}/${route}/index.html`,html=fs.readFileSync(path.join(root,file),'utf8'),d=parseHTML(html).document;A.verify(d,file);assert.equal(d.querySelectorAll('[data-research-phase3-entry]').length,1);assert.equal(d.querySelector('[data-research-phase3-entry] a').href,`/${lang}/database/research/`);assert.equal(B.project(html,lang,route),html);}
});
test('research navigation allowance rejects altered numeric data, links and SEO',()=>{
 const file='en/buildings/lab/index.html',html=B.project(A.original(file),'en','buildings/lab');
 for(const edit of [d=>d.querySelector('main td').textContent='999999',d=>d.querySelector('[data-research-phase3-entry] a').href='/wrong/',d=>d.querySelector('title').textContent='Wrong']){const d=parseHTML(html).document;edit(d);assert.throws(()=>A.verify(d,file));}
});
