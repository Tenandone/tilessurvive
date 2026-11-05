'use strict';
// Memory-only regeneration. The historical publication guard is never bypassed.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom'),S=require('./build-v6-system'),G=require('./build-global-locales'),DE=require('./build-german-50'),CN=require('./build-simplified-chinese'),L=require('./lib/global-localization');
const codes=L.registry.locales.map(l=>l.code),groups=L.routeGroups(),read=(locale,route)=>fs.readFileSync(path.join(S.ROOT,locale,route,'index.html'),'utf8');
const doc=html=>parseHTML(html).document;
function presentation(html,locale,route){
 const d=doc(html),css=[...d.querySelectorAll('link[rel="stylesheet"]')];
 assert.equal(d.querySelectorAll('link[href^="/css/v6-system.css"]').length,1,route+' CSS');
 assert.equal(d.querySelectorAll('script[src^="/js/v6-system.js"]').length,1,route+' JS');
 assert(css.at(-1).href.startsWith('/css/v6-system.css?v='),route+' final style precedence');
 assert.equal(d.documentElement.getAttribute('data-v6-page'),S.pageKind(route,locale));
 assert.equal(S.project(html,locale,route),html,route+' finalizer stability');
 return d;
}
function numeric(value){
 const out=[];function walk(v,p){if(typeof v==='number'||typeof v==='boolean'||v===null||typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v))out.push([p,v]);else if(Array.isArray(v))v.forEach((x,i)=>walk(x,p+'['+i+']'));else if(v&&typeof v==='object')for(const k of Object.keys(v).sort())walk(v[k],p+'.'+k);}walk(value,'$');return out;
}
const ads=d=>[...d.querySelectorAll('script,ins')].filter(n=>/adsbygoogle|googlesyndication|fundingchoices|__tcfapi|__gpp/.test(n.outerHTML)).map(n=>n.outerHTML);
const ten=d=>[...d.querySelectorAll('a[href*="lootbar"]')].map(n=>[n.href,n.getAttribute('rel'),n.getAttribute('data-v3-placement')]);
function models(d){return [...d.querySelectorAll('script[type="application/json"]')].filter(n=>n.id!=='ts-global-ui'&&n.id!=='ts-locale-routes').map(n=>[n.id||[...n.attributes].find(a=>a.name.startsWith('data-'))?.name||'',numeric(JSON.parse(n.textContent))]);}
function seo(d,locale,group,expectedLang=L.byCode.get(locale).htmlLang){
 assert.equal(d.documentElement.lang,expectedLang);
 assert.equal(d.documentElement.getAttribute('dir')||'ltr',L.byCode.get(locale).dir);
 assert.equal(d.querySelector('link[rel="canonical"]').href,L.publicOrigin+group.routes[locale]);
 const alternatives=[...d.querySelectorAll('link[rel="alternate"][hreflang]')];assert.equal(alternatives.length,22);
 for(const code of codes)assert.equal(d.querySelector('link[hreflang="'+L.byCode.get(code).hreflang+'"]').href,L.publicOrigin+group.routes[code]);
 assert.deepEqual(JSON.parse(d.getElementById('ts-locale-routes').textContent),Object.fromEntries(codes.map(code=>[code,group.routes[code]])));
}

test('all 21 locales finalize new pages and inherited V6 pages without changing data, IDs, formulas, ads or SEO',()=>{
 const group={id:'v6-fixture/',file:'en/v6-fixture/index.html',routes:Object.fromEntries(codes.map(l=>[l,'/'+l+'/v6-fixture/']))};
 for(const locale of codes)for(const inherited of [false,true]){
  const info=L.byCode.get(locale),url=group.routes[locale];
  let source='<html lang="'+info.htmlLang+'" dir="'+info.dir+'"><head><title>Fixture</title><link rel="canonical" href="'+L.publicOrigin+url+'"><meta name="description" content="Fixture"><link rel="stylesheet" href="/css/platform.css?v=5"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9189957764761115" crossorigin="anonymous"></script></head><body><main id="fixture"><h1>Fixture</h1><input id="level" type="number" value="17" min="1" max="50"><table><tr><th>Cost</th><td>3049</td></tr></table><script id="fixture-data" type="application/json">{"heroId":25300243,"cost":[3049,650,null],"ratio":0.125,"verified":true}</script><script id="fixture-formula">const total = 17 * 650;</script><a href="https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive" rel="sponsored noopener noreferrer">TEN</a><ins class="adsbygoogle" data-ad-client="ca-pub-9189957764761115" data-ad-slot="fixture"></ins></main></body></html>';
  if(inherited)source=S.project(source,locale,url);const before=doc(source),result=G.enhance(doc(source),locale,group,codes,require('../data/i18n/ui/'+locale+'.json'),{preview:false}),after=presentation(result,locale,url);
  assert.equal(after.querySelector('main').outerHTML,before.querySelector('main').outerHTML);assert.deepEqual(models(after),models(before));assert.deepEqual(ads(after),ads(before));assert.deepEqual(ten(after),ten(before));seo(after,locale,group);
  assert.equal(after.querySelectorAll('script[src^="/js/site-locales.js"]').length,1,'V6 block must not consume shared runtime');
  assert.equal(after.querySelectorAll('script[src^="/js/platform-i18n.js"]').length,1,'V6 block must not consume calculator dictionary');
  assert.equal(G.enhance(doc(result),locale,group,codes,require('../data/i18n/ui/'+locale+'.json'),{preview:false}),result);
 }
});

test('existing hero, tool, research and top-up pages retain all locale models and commercial markup through regeneration',()=>{
 for(const locale of codes)for(const id of ['heroes/lava/','tools/','database/research/','top-up/']){
  const group=groups.find(g=>g.id===id);assert(group,id);const source=read(locale,id),before=doc(source),output=G.enhance(doc(source),locale,group,codes,require('../data/i18n/ui/'+locale+'.json'),{preview:false}),after=presentation(output,locale,group.routes[locale]);
  assert.deepEqual(models(after),models(before),locale+id+' numeric models');assert.deepEqual(ads(after),ads(before),locale+id+' ads');assert.deepEqual(ten(after),ten(before),locale+id+' TEN');seo(after,locale,group,before.documentElement.lang);
  assert.deepEqual([...after.querySelectorAll('[id]')].map(n=>n.id).sort(),[...before.querySelectorAll('[id]')].map(n=>n.id).sort(),locale+id+' anchors');
 }
});

test('German and Simplified Chinese owners finish freshly reviewed source pages with one V6 bundle and preserved numeric content',()=>{
 for(const id of ['','heroes/lava/','tools/','top-up/']){
  const group=groups.find(g=>g.id===id);assert(group,id);
  // Simulate the preceding reviewed V3 release step in memory. Stale published
  // affiliate prose must continue to fail the German source validator.
  const english=require('./build-v3-platform').project(read('en',id),'en',group.routes.en),beforeDE=doc(english),german=DE.render(english,s=>s,id+'index.html'),de=presentation(german,'de',group.routes.de);
  assert.deepEqual(models(de),models(beforeDE),'DE '+id+' numeric models');assert.deepEqual(ads(de),ads(beforeDE),'DE '+id+' ads');assert.deepEqual(ten(de),ten(beforeDE),'DE '+id+' TEN');
  // The DE renderer intentionally leaves reciprocal SEO completion to enhance.
  const completeDE=G.enhance(de,'de',group,codes,require('../data/i18n/ui/de.json'),{preview:false});seo(presentation(completeDE,'de',group.routes.de),'de',group);
  const traditional=require('./build-v3-platform').project(read('zh-tw',id),'zh-tw',group.routes['zh-tw']),beforeCN=doc(traditional),simplified=CN.localizePage(traditional,group,groups,{available:codes}).html,cn=presentation(simplified,'zh-cn',group.routes['zh-cn']);
  assert.deepEqual(models(cn),models(beforeCN),'CN '+id+' numeric models');assert.deepEqual(ads(cn),ads(beforeCN),'CN '+id+' ads');assert.deepEqual(ten(cn),ten(beforeCN),'CN '+id+' TEN');seo(cn,'zh-cn',group);
  assert.equal(cn.querySelector('meta[name="robots"]').content,'noindex,nofollow','CN staging remains private');
  if(id==='top-up/'){
   assert.equal(cn.querySelectorAll('[data-v3-owned="affiliate"]').length,1,'Preview must not discard the reviewed affiliate owner');
   const repeated=G.enhance(doc(simplified),'zh-cn',group,codes,require('../data/i18n/ui/zh-cn.json'),{preview:true}),again=presentation(repeated,'zh-cn',group.routes['zh-cn']);
   assert.equal(again.querySelectorAll('[data-v3-owned="affiliate"]').length,1);assert.deepEqual(ten(again),ten(cn));assert.equal(again.querySelector('meta[name="robots"]').content,'noindex,nofollow');
  }
 }
});

test('fragment compatibility and historical publication guard remain intact',()=>{
 const fragment='<html lang="en"><head></head><body><p>Unknown text</p></body></html>',out=DE.render(fragment,s=>s,'about/index.html');assert(!out.includes('data-v6-owned'));assert(doc(out).querySelector('p'));
 const detailFixture='<html lang="en"><head></head><body><main><p>Details</p></main></body></html>',detail=DE.render(detailFixture,s=>s.replace('Details','Einzelheiten'),'heroes/lagnar/index.html');
 assert.equal(doc(detail).querySelector('main p').textContent,'Einzelheiten');assert.equal(doc(detail).querySelector('[data-hero-atlas-owned]'),null,'A translation fragment must not acquire invented hero content');
 assert.throws(()=>DE.render(detailFixture.replace('<p>Details</p>','<div data-hero-atlas-owned="profile">Forged</div>'),s=>s,'heroes/lagnar/index.html'),/Missing original hero stage|ownership mismatch/,'Malformed owned pages still fail the source validator');
 const guard=fs.readFileSync(path.join(S.ROOT,'scripts/guard-historical-build.js'),'utf8');assert.match(guard,/throw|exit/);assert.match(require('../package.json').scripts['build:legacy'],/^node scripts\/guard-historical-build\.js/);
});
