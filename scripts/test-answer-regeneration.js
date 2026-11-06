'use strict';
// Pure projections only: this suite never writes generated pages or assets.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom'),A=require('./answer-guide-content'),S=require('./build-v6-system'),N=require('./build-nuclear-age');
const G=require('./build-global-locales'),DE=require('./build-german-50'),CN=require('./build-simplified-chinese'),L=require('./lib/global-localization');
const locales=L.registry.locales.map(x=>x.code),groups=L.routeGroups(),doc=s=>parseHTML(s).document;
const group=id=>{const g=groups.find(x=>x.id===id);assert(g,id);return g;};
function source(locale,g){
 let s=fs.readFileSync(path.join(L.ROOT,g.routes[locale],'index.html'),'utf8');s=S.strip(s);
 if(g.id==='eras/nuclear-age/')s=N.project(s,locale,g.routes[locale]);
 if(N.linkRoutes(locale).includes(g.routes[locale]))s=N.projectLinks(s,locale,g.routes[locale]);
 return S.project(A.project(s,locale,g.routes[locale]),locale,g.routes[locale]);
}
function check(html,locale,g){
 const clean=S.strip(html);A.validateAndStrip(clean,locale,g.routes[locale],{required:true});
 const d=doc(clean),guide=A.guide(locale,g.routes[locale]);assert(guide);
 assert.equal(d.querySelectorAll('[data-answer-guide]').length,1);assert.equal(d.querySelectorAll('[data-answer-basis]').length,1);
 assert.deepEqual([...d.querySelectorAll('[data-answer-id]')].map(n=>n.id),guide.answers.map(a=>a.id));
 for(const a of guide.answers){assert.equal(d.getElementById(a.id).querySelector('h3').textContent,a.question);for(const link of d.getElementById(a.id).querySelectorAll('a[href^="/"]'))assert(link.getAttribute('href').startsWith('/'+locale+'/'));}
 assert.equal(d.querySelectorAll('script[data-answer-asset]').length,1);assert.equal(d.querySelectorAll('link[data-answer-asset]').length,1);
 return d;
}
function generic(s,locale,g){
 const real=L.createTranslator(locale,G.catalogFor(locale)),seen=[],t={...real,translate:(text,where)=>{seen.push(String(text).trim());return real.translate(text,where);}};
 const d=G.localizePage(s,locale,g,groups,t);
 assert.equal(d.querySelectorAll('[data-answer-guide],[data-answer-basis],[data-answer-asset]').length,0,'Source answers must be removed before translation');
 assert.deepEqual([...real.missing],[],locale+' missing translation');assert.deepEqual(real.errors,[],locale+' translation errors');
 const html=G.enhance(d,locale,g,locales,L.readJSON(path.join(L.ROOT,'data/i18n/ui',locale+'.json')),{preview:false});
 check(html,locale,g);return{html,seen};
}
test('generic locale rebuilds remove verified English answers and restore exact native answers',()=>{
 const g=group('eras/nuclear-age/'),s=source('en',g);
 for(const locale of locales.filter(l=>!L.existing.has(l)&&l!=='zh-cn')){
  const out=generic(s,locale,g);for(const a of A.guide('en',g.routes.en).answers)assert(!out.seen.includes(a.question));
  assert(N.validateOwnership(out.html,locale));assert.deepEqual(JSON.parse(doc(out.html).getElementById('ts-nuclear-age').textContent),N.calculatorConfig(locale));
 }
});
test('German and Chinese rebuilds restore native answers after source-owner projections',()=>{
 for(const id of ['eras/nuclear-age/','heroes/lava/']){
  const g=group(id),en=source('en',g),seen=[];
  const de=DE.render(en,s=>{seen.push(String(s).trim());return s;},id+'index.html');check(de,'de',g);
  for(const a of A.guide('en',g.routes.en).answers)assert(!seen.includes(a.question));
  const tw=source('zh-tw',g),converter=CN.createConverter(),calls=[],convert=converter.convert.bind(converter);
  converter.convert=(s,where)=>{calls.push(String(s).trim());return convert(s,where);};
  const cn=CN.localizePage(tw,g,groups,{converter,available:locales}).html;check(cn,'zh-cn',g);
  for(const a of A.guide('zh-tw',g.routes['zh-tw']).answers)assert(!calls.includes(a.question));
  assert.match(doc(cn).querySelector('meta[name="robots"]').content,/noindex/);
 }
});
test('all translation paths reject mutated, duplicate, orphaned and injected answer blocks before translation',()=>{
 const g=group('eras/nuclear-age/');
 const mutations=[
  s=>{const d=doc(s);d.querySelector('[data-answer-id] p').textContent='An unverified free upgrade';return d.toString();},
  s=>s.replace('<!-- TS_ANSWER_BODY_END -->','<aside>Unreviewed sibling</aside><!-- TS_ANSWER_BODY_END -->'),
  s=>s.replace('<!-- TS_ANSWER_BODY_END -->',s.match(/<!-- TS_ANSWER_BODY_BEGIN -->[\s\S]*?<!-- TS_ANSWER_BODY_END -->/)[0]+'<!-- TS_ANSWER_BODY_END -->'),
  s=>s.replace(/<!-- TS_ANSWER_BASIS_BEGIN -->[\s\S]*?<!-- TS_ANSWER_BASIS_END -->/,''),
  s=>s.replace(/(\/js\/answer-guides.js\?v=)[a-f0-9]+/,'$1000000000000')
 ];
 for(const mutate of mutations){
  let calls=0;const en=mutate(S.strip(source('en',g))),tw=mutate(S.strip(source('zh-tw',g)));
  const unexpected=()=>{calls++;throw Error('Translation must not run');};
  assert.throws(()=>G.localizePage(en,'fr',g,groups,{translate:unexpected}),assert.AssertionError);
  assert.throws(()=>DE.render(en,unexpected,g.id+'index.html'),assert.AssertionError);
  assert.throws(()=>CN.localizePage(tw,g,groups,{converter:{convert:unexpected},available:locales}),assert.AssertionError);
  assert.equal(calls,0);
 }
});
test('source protection still rejects unrelated prose and preserves ads, analytics and TEN services',()=>{
 const g=group('eras/nuclear-age/'),s=source('en',g),out=generic(s,'fr',g).html;
 const serviceSignature=html=>{const d=doc(html);return{ads:[...d.querySelectorAll('script')].filter(n=>/adsbygoogle|googlesyndication|fundingchoices|__tcfapi|__gpp/.test(n.outerHTML)).map(n=>n.outerHTML),ten:[...d.querySelectorAll('a[href]')].map(n=>n.href).filter(h=>h.includes('lootbar.com')),analytics:require('./analytics-invariants').signature(html)};};
 assert.deepEqual(serviceSignature(out),serviceSignature(s));
 const d=doc(S.strip(s)),probe='Unreviewed body text outside every source owner';d.body.insertAdjacentHTML('beforeend','<p>'+probe+'</p>');
 const t=L.createTranslator('fr',G.catalogFor('fr'));G.localizePage(d.toString(),'fr',g,groups,t);assert(t.missing.has(probe));
});
