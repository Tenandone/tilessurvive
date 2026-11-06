'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom'),A=require('./answer-guide-content'),REG=require('../data/i18n/locales.json').locales;
const read=f=>fs.readFileSync(path.join(A.ROOT,f),'utf8');
test('every language has identical answer identities, states, calculations and evidence',()=>{
 const shape=locale=>A.guides(locale).map(g=>({route:g.route.replace('/'+locale+'/','/'),kind:g.kind,models:g.answers.map(a=>({id:a.id,model:a.model})),example:g.example?.model}));
 const en=shape('en');assert(en.length>=37);
 for(const l of REG)assert.deepEqual(shape(l.code),en,l.code);
});
test('static answer markup contains visible questions, contextual numbers and accessible tables in all languages',()=>{
 for(const l of REG)for(const g of A.guides(l.code)){
  const html=A.render(g,l.code),d=parseHTML('<main>'+html+'</main>').document;
  assert.equal(d.querySelectorAll('[data-answer-id]').length,g.answers.length);
  assert.equal(d.querySelectorAll('script,img,style,[data-nosnippet],[hidden]:not(button)').length,0);
  for(const a of g.answers){const node=d.getElementById(a.id);assert(node.querySelector('h3').textContent===a.question);for(const p of a.paragraphs)assert(node.textContent.includes(p));}
  for(const t of d.querySelectorAll('table')){assert(t.querySelector('caption')?.textContent);assert(t.querySelector('thead th[scope="col"]'));assert(t.querySelector('tbody th[scope="row"]'));}
  assert(html.length<180000,'Avoid large per-page answer dumps');
 }
});
test('reviewed answer projection is idempotent and unknown modifications are rejected',()=>{
 for(const l of ['ko','en','de','ar'])for(const g of A.guides(l)){
  const before=read(g.route.slice(1)+'index.html'),html=A.project(before,l,g.route);assert.equal(A.project(html,l,g.route),html);
  const clean=A.validateAndStrip(html,l,g.route,{required:true});assert(!clean.includes('TS_ANSWER_'));
  const tampered=parseHTML(html).document;tampered.querySelector('[data-answer-id] p').textContent+=' injected';
  assert.throws(()=>A.validateAndStrip(tampered.documentElement.outerHTML,l,g.route,{required:true}));
  assert.throws(()=>A.validateAndStrip(html.replace('data-answer-asset','data-answer-asset extra="1"'),l,g.route,{required:true}));
  assert.throws(()=>A.validateAndStrip(html.replace('<!-- TS_ANSWER_BODY_END -->','<!-- TS_ANSWER_BODY_END --><!-- TS_ANSWER_BODY_BEGIN -->extra<!-- TS_ANSWER_BODY_END -->'),l,g.route,{required:true}));
 }
});
test('answer rendering retains canonical, hreflang, original executable scripts, ads and TEN links',()=>{
 const snapshot=html=>{const d=parseHTML(html).document;return {canonical:d.querySelector('link[rel="canonical"]')?.outerHTML,alternates:[...d.querySelectorAll('link[hreflang]')].map(n=>n.outerHTML),scripts:[...d.querySelectorAll('script:not([data-answer-asset])')].map(n=>n.outerHTML),ten:[...d.querySelectorAll('a[href*="lootbar"]')].map(n=>n.getAttribute('href'))};};
 for(const g of A.guides('ko')){const before=read(g.route.slice(1)+'index.html'),after=A.project(before,'ko',g.route);assert.deepEqual(snapshot(after),snapshot(before),g.route);}
});
test('answers stay outside narrow Power Plant and new-pet hero columns',()=>{
 for(const route of ['/ko/buildings/power-plant/','/ko/database/pet-system/chompy/','/ko/database/pet-system/hopper/','/ko/database/pet-system/snowy/']){
  const file=route.slice(1)+'index.html';assert(fs.existsSync(path.join(A.ROOT,file)),route);const d=parseHTML(A.project(read(file),'ko',route)).document,answer=d.querySelector('[data-answer-guide]');assert(answer,route);assert(!answer.closest('.hero,.hero-grid,.p60-identity,.ts3-character-stage'),route+' must not be squeezed into hero text');assert(d.querySelector('main').contains(answer));
 }
});
test('answer links remain local or explicitly referenced official pages and never fabricate calculators',()=>{
 const ids=new Map();for(const l of REG)for(const g of A.guides(l.code))for(const link of [...g.answers.flatMap(a=>a.links||[]),...(g.example?.links||[])]){
  const u=new URL(link.href,A.ORIGIN);assert.equal(u.origin,A.ORIGIN);assert(u.pathname.startsWith('/'+l.code+'/'));const file=u.pathname.slice(1)+'index.html';assert(fs.existsSync(path.join(A.ROOT,file)),link.href);if(u.hash){if(!ids.has(file))ids.set(file,new Set([...parseHTML(read(file)).document.querySelectorAll('[id]')].map(n=>n.id)));assert(ids.get(file).has(decodeURIComponent(u.hash.slice(1))),link.href);}
 }
});
test('sitemap updates only actual answer pages with a fixed content revision and preserves every URL',()=>{
 const B=require('./build-answer-guides'),xml=read('sitemap.xml'),after=B.projectSitemap(xml),urls=s=>[...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);assert.deepEqual(urls(after),urls(xml));assert.equal(B.projectSitemap(after),after);
 const sample='<urlset><url><loc>https://tilessurvive.net/ko/eras/nuclear-age/</loc><lastmod>2020-01-01</lastmod></url><url><loc>https://tilessurvive.net/ko/privacy/</loc><lastmod>2020-01-01</lastmod></url></urlset>';
 assert.equal(B.projectSitemap(sample),sample.replace('<lastmod>2020-01-01</lastmod>','<lastmod>'+B.CONTENT_REVISION+'</lastmod>'));
});
test('copy action uses only the canonical answer URL, without query, calculation inputs or storage',async()=>{
 const g=A.guides('ko').find(g=>g.kind==='nuclear'),{document}=parseHTML('<html><head><link rel="canonical" href="https://tilessurvive.net'+g.route+'"></head><body>'+A.render(g,'ko')+'</body></html>');let copied;const listeners=[];
 for(const b of document.querySelectorAll('[data-answer-copy]'))b.addEventListener=(name,fn)=>listeners.push([b,name,fn]);
 vm.runInNewContext(read('js/answer-guides.js'),{document,navigator:{clipboard:{writeText:async s=>{copied=s;}}},URL});
 assert(listeners.length);await listeners[0][2]();assert.equal(copied,'https://tilessurvive.net'+g.route+'#power-plant-n1-fuel');assert(!copied.includes('?'));assert(document.querySelector('[data-answer-copy-status]').textContent);
});
test('all published answer blocks and generated question search aliases match their source',()=>{
 for(const l of REG){const shard=JSON.parse(read('data/v3-search/'+l.code+'.json'));for(const g of A.guides(l.code)){const html=read(g.route.slice(1)+'index.html');A.validateAndStrip(html,l.code,g.route,{required:true});const item=shard.items.find(i=>i.url===g.route);assert(item,'Missing existing answer route in search '+g.route);for(const a of g.answers)assert(item.search.aliases.some(x=>x.source==='site-question'&&x.language===l.code&&x.value===a.question),'Missing exact localized question alias '+a.id);}}
});
