'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{parseHTML}=require('linkedom'),A=require('./content-phase2-test-allowances');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw','de'];
// Building cards are now owned by the common building-system projection. Keep
// the pet hub's historical contract intact and check the current building
// contract directly rather than restoring an obsolete building document.
function verifyBuildingCatalog(d,file){
 const B=require('./build-building-system'),lang=file.split('/')[0],prior=parseHTML(A.project(file)).document;
 assert.equal(d.querySelector('title').textContent,prior.querySelector('title').textContent);
 assert.equal(d.querySelector('meta[name="description"]').getAttribute('content'),prior.querySelector('meta[name="description"]').getAttribute('content'));
 assert.equal(d.querySelector('link[rel="canonical"]').href,`https://tilessurvive.net/${lang}/buildings/`);
 for(const language of langs)assert(d.querySelector(`link[hreflang="${language}"][href="https://tilessurvive.net/${language}/buildings/"]`));
 const cards=[...d.querySelectorAll('.building-card')];assert.equal(cards.length,B.slugs.length);
 assert.deepEqual(cards.map(n=>n.querySelector('.building-link').href).sort(),B.slugs.map(slug=>`/${lang}/buildings/${slug}/`).sort());
 assert.equal(d.querySelectorAll('main table').length,0);
 assert.equal(B.catalog('<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n',lang),'<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n','Current building copy and projection remain exact');
}
test('all twelve existing hubs retain the current building projection and reviewed pet projection',()=>{
 for(const lang of langs)for(const route of ['buildings','database/pet-system']){const file=`${lang}/${route}/index.html`,d=parseHTML(fs.readFileSync(path.join(root,file),'utf8')).document;if(route==='buildings')verifyBuildingCatalog(d,file);else A.verify(d,file);}
});
test('phase2 preservation rejects unrelated metadata edits and missing or altered entries',()=>{
 for(const route of ['buildings','database/pet-system']){const file=`en/${route}/index.html`,html=route==='buildings'?fs.readFileSync(path.join(root,file),'utf8'):A.project(file);
  for(const mutate of [d=>{d.querySelector('title').textContent='Unreviewed';},d=>{d.querySelector('[data-building-phase2-card],[data-pets-phase2-entry]').remove();},d=>{d.querySelector('[data-building-phase2-card] a,[data-pets-phase2-card]').setAttribute('href','/wrong/');}]){const d=parseHTML(html).document;mutate(d);assert.throws(()=>route==='buildings'?verifyBuildingCatalog(d,file):A.verify(d,file));}
 }
});
