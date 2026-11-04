'use strict';
// Assemble a locally reviewable release. This script does not push or deploy.
// New locales enter the public tree only after every selected translation passes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const L=require('./lib/global-localization'),G=require('./build-global-locales');
const {rootDocument}=require('./build-global-navigation');
const DELIVERY=path.resolve(L.ROOT,'../global-language-delivery-20261104'),STAGE=path.join(DELIVERY,'staging');
const literal=/"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'/g;
const uiIds=new Set(['ts-global-ui','ts-locale-routes']);
const programTranslators=new Map();
function programSkeleton(code){return code.replace(literal,'__STRING__').replace(/LANG_DATA\[__STRING__\]/g,'LANG_DATA.en').replace(/(const LANG_DATA = \{\s*)__STRING__:/,'$1en:');}
function validateUI(ui,code){
  const english=L.readJSON(path.join(L.ROOT,'data/i18n/ui/en.json'));
  assert.equal(ui?.locale,code,code+' UI locale');
  for(const key of Object.keys(english.copy))assert.ok(typeof ui.copy?.[key]==='string'&&ui.copy[key].trim(),code+' UI key '+key);
  assert.ok(Array.isArray(ui.affiliate)&&ui.affiliate.length===english.affiliate.length,code+' affiliate UI count');
  for(const value of ui.affiliate)assert.ok(typeof value==='string'&&value.trim(),code+' affiliate UI value');
  return ui;
}
function expectedProgram(source,{locale,sourceLocale,route}){
  if(locale===sourceLocale)return source;
  if(locale==='zh-cn'){
    const cn=require('./build-simplified-chinese');
    if(!programTranslators.has(locale))programTranslators.set(locale,{converter:cn.createConverter(),router:cn.makeRouter(L.routeGroups())});
    const {converter,router}=programTranslators.get(locale);
    return cn.inlineConvert(source,converter.convert,router.route,route);
  }
  if(!programTranslators.has(locale))programTranslators.set(locale,L.createTranslator(locale,G.catalogFor(locale)));
  const translator=programTranslators.get(locale);
  const expected=G.inlineProgram(source,locale,translator.translate,route);
  assert.equal(translator.missing.size,0,route+' inline translation missing');
  assert.equal(translator.errors.length,0,route+' inline translation invalid');
  return expected;
}
function immutableScalars(before,after,where,stats) {
  if(Array.isArray(before)){assert.ok(Array.isArray(after),where);assert.equal(after.length,before.length,where);before.forEach((v,i)=>immutableScalars(v,after[i],where+'['+i+']',stats));return;}
  if(before&&typeof before==='object'){assert.ok(after&&typeof after==='object',where);for(const[k,v]of Object.entries(before))immutableScalars(v,after[k],where+'.'+k,stats);return;}
  if(typeof before==='number'||typeof before==='boolean'||before===null){assert.deepEqual(after,before,where);stats.scalars++;}
  else if(typeof before==='string'){
    // Quantities stored as strings are just as executable as JSON numbers.
    if(/^[+−-]?\d+(?:[.,\u00a0\u202f ]\d+)*(?:[KkMB万萬亿億]|%)?$/.test(before.trim())){assert.equal(after,before,where+' numeric string');stats.scalars++;return;}
    const key=where.split('.').at(-1);
    // A pre-existing JSON-LD cover URL has no asset. This one verified metadata
    // repair uses the same existing image already displayed in the page body.
    if(key==='image' && before===L.publicOrigin+'/img/buildings/comms-outpost-cover.webp') {
      assert.equal(after,L.publicOrigin+'/img/buildings/comms-outpost.webp',where);
      assert.ok(fs.existsSync(path.join(L.ROOT,'img/buildings/comms-outpost.webp')));
      return;
    }
    const siteURL=/^(?:https:\/\/tilessurvive\.net)?\/(?:en|zh-tw)\//.test(before);
    if(!siteURL&&L.nonDisplay.has(key)&&!/(?:\.copy\.|\.labels\.|\.messages\.|\.names\.|:(?:ts3|event-calendar)-copy\.)/.test(where)&&!['url','href','route','language','inLanguage','source'].includes(key))assert.equal(after,before,where);
  }
}
function inspectPair(source,translated,{locale,route,sourceLocale='en'}) {
  const a=parseHTML(source).document,b=parseHTML(translated).document,stats={scalars:0,programs:0};
  if(sourceLocale===locale && L.existing.has(locale)) {
    const valid=[locale,L.byCode.get(locale).htmlLang,L.byCode.get(locale).numberLocale].map(x=>x.toLowerCase());
    assert.ok(valid.includes(b.documentElement.lang.toLowerCase()),route+' existing lang');
  } else assert.equal(b.documentElement.lang,L.byCode.get(locale).htmlLang,route+' lang');
  assert.equal(b.querySelector('link[rel="canonical"]')?.href,L.publicOrigin+route,route+' canonical');
  assert.ok(b.querySelector('title')?.textContent.trim(),route+' title');
  assert.ok(b.querySelector('meta[name="description"]')?.content.trim(),route+' description');
  const jsonA=[...a.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')].filter(s=>!uiIds.has(s.id));
  const jsonB=[...b.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')].filter(s=>!uiIds.has(s.id)&&!/^event-helper-.*-data$/.test(s.id));
  assert.equal(jsonB.length,jsonA.length,route+' JSON blocks');
  jsonA.forEach((s,i)=>immutableScalars(JSON.parse(s.textContent),JSON.parse(jsonB[i].textContent),route+':'+(s.id||'schema'),stats));
  const formSignature=d=>[...d.querySelectorAll('input,select,option,button,textarea')].map(e=>[e.tagName,...['id','type','name','value','min','max','step','disabled'].map(k=>e.getAttribute(k))]);
  assert.deepEqual(formSignature(b),formSignature(a),route+' executable form values');
  const media=d=>[...d.querySelectorAll('img,iframe,video,source')].map(e=>[e.tagName,e.getAttribute('src')]);
  assert.deepEqual(media(b),media(a),route+' media');
  const ads=d=>[...d.querySelectorAll('script[src*="adsbygoogle"],script[src*="googletagmanager"]')].map(e=>e.src);
  assert.deepEqual(ads(b),ads(a),route+' advertising and analytics');
  const scripts=d=>[...d.querySelectorAll('script:not([src])')].filter(s=>!s.type?.includes('json')).map(s=>s.textContent);
  const pa=scripts(a),pb=scripts(b);assert.equal(pa.length,pb.length,route+' inline programs');
  pa.forEach((s,i)=>{assert.equal(programSkeleton(pb[i]),programSkeleton(s),route+' executable skeleton');assert.equal(pb[i],expectedProgram(s,{locale,sourceLocale,route}),route+' executable strings');new vm.Script(pb[i]);stats.programs++;});
  for(const script of b.querySelectorAll('script[type="application/ld+json"]')) {
    const visit=(value,key)=>{if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>visit(v,k));else if(key==='inLanguage')assert.ok([locale,L.byCode.get(locale).htmlLang,L.byCode.get(locale).hreflang,L.byCode.get(locale).numberLocale].includes(value),route+' JSON-LD language: '+value);};visit(JSON.parse(script.textContent));
  }
  return stats;
}
function sitemap(existing,urls) {
  assert.match(existing,/<urlset\b/);const blocks=[...existing.matchAll(/<url>\s*([\s\S]*?)\s*<\/url>/g)].map(m=>m[0]);
  const entries=new Map();
  for(const block of blocks){const url=block.match(/<loc>([^<]+)<\/loc>/)?.[1];assert.ok(url,'Sitemap URL missing');assert.ok(url.startsWith(L.publicOrigin+'/'),'Foreign sitemap origin');assert.ok(!entries.has(url),'Duplicate sitemap URL '+url);entries.set(url,block);}
  for(const url of urls)if(!entries.has(url))entries.set(url,'<url><loc>'+url+'</loc></url>');
  // Do not invent lastmod from a build timestamp. Preserve existing evidence.
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+[...entries].sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>v).join('\n')+'\n</urlset>\n';
}
function registryRuntime(source,registry) {
  const pattern=/\/\* TS_LOCALE_REGISTRY_START \*\/[\s\S]*?\/\* TS_LOCALE_REGISTRY_END \*\//;
  assert.match(source,pattern,'Runtime registry markers missing');
  return source.replace(pattern,'/* TS_LOCALE_REGISTRY_START */ '+JSON.stringify(registry)+' /* TS_LOCALE_REGISTRY_END */');
}
function prepare({locales,apply=false,rebuild=true}={}) {
  programTranslators.clear();
  const selected=locales||L.registry.locales.filter(l=>!L.existing.has(l.code)).map(l=>l.code);
  assert.ok(selected.length,'Choose at least one new locale');assert.equal(new Set(selected).size,selected.length);
  for(const code of selected)assert.ok(L.byCode.has(code)&&!L.existing.has(code),'Unknown/new-only locale '+code);
  const uiSnapshots=new Map(L.registry.locales.filter(l=>L.existing.has(l.code)||l.status==='published'||selected.includes(l.code)).map(l=>{
    const file=path.join(L.ROOT,'data/i18n/ui',l.code+'.json'),source=fs.readFileSync(file,'utf8');
    return [l.code,{file,hash:L.digest(source),ui:validateUI(JSON.parse(source),l.code)}];
  }));
  if(rebuild){const ordinary=selected.filter(c=>c!=='zh-cn');if(ordinary.length)G.build({locales:ordinary});if(selected.includes('zh-cn')){const cn=require('./build-simplified-chinese');cn.build();cn.selfTest();}}
  const groups=L.routeGroups(),available=L.registry.locales.filter(l=>L.existing.has(l.code)||l.status==='published'||selected.includes(l.code)).map(l=>l.code);
  const plans=[],validation={},newPages=new Map();
  for(const code of selected){
    const cn=code==='zh-cn',report=L.readJSON(cn?path.join(L.ROOT,'data/i18n/messages/zh-cn-review.json'):path.join(DELIVERY,'translation-build-'+code+'.json'));
    assert.ok(report,'Missing translation report '+code);
    if(cn){assert.equal(report.validation.unmatchedSourceRoutes.length,0);assert.equal(report.inheritedEnglishResidues.filter(x=>x.status==='needs-context-review').length,0);}
    else {assert.equal(report.missingMessages,0,code+' incomplete translation');assert.equal(report.errors,0,code+' inconsistent translation');assert.ok(report.uiComplete);}
    const rows=cn?report.pages:report.sources.map((s,i)=>({source:s.path,sourceSHA256:s.sha256,target:'/'+report.outputs[i].path.replace(/index\.html$/,''),outputSHA256:report.outputs[i].sha256}));
    assert.equal(rows.length,groups.length,code+' route count');let scalars=0,programs=0;
    for(const row of rows){
      const source=fs.readFileSync(path.join(L.ROOT,row.source),'utf8'),staged=fs.readFileSync(path.join(STAGE,row.target.slice(1),'index.html'),'utf8');
      assert.equal(L.digest(source),row.sourceSHA256,'Source changed after translation '+row.source);
      assert.equal(L.digest(staged),row.outputSHA256,'Stage changed after translation '+row.target);
      const stats=inspectPair(source,staged,{locale:code,route:row.target,sourceLocale:cn?'zh-tw':'en'});scalars+=stats.scalars;programs+=stats.programs;
      const d=parseHTML(staged).document;
      assert.equal(d.documentElement.dataset.translationStatus,'preview-unpublished');
      assert.equal(d.querySelector('meta[name="robots"]')?.content,'noindex,nofollow');
      delete d.documentElement.dataset.translationStatus;
      const originalRobots=parseHTML(source).document.querySelector('meta[name="robots"]')?.content;
      assert.ok(!/noindex/i.test(originalRobots||''),'Source is intentionally unindexable '+row.source);
      if(originalRobots)d.querySelector('meta[name="robots"]').content=originalRobots;else d.querySelector('meta[name="robots"]').remove();
      // Keep serialized pages, not thousands of live DOM trees, across the gate.
      newPages.set(row.target,'<!doctype html>\n'+d.documentElement.outerHTML+'\n');
    }
    validation[code]={pages:rows.length,immutableNumericBooleanNullValues:scalars,executablePrograms:programs,missing:0,errors:0,nativeSpeakerReview:false};
  }
  const nextRegistry=JSON.parse(JSON.stringify(L.registry));for(const l of nextRegistry.locales)if(selected.includes(l.code))l.status='published';
  const runtimeFile=path.join(L.ROOT,'js/site-locales.js'),runtime=registryRuntime(fs.readFileSync(runtimeFile,'utf8'),nextRegistry);
  const runtimeHash=L.digest(runtime).slice(0,12);
  for(const code of available)for(const group of groups){
    const route=group.routes[code],file=path.join(L.ROOT,route.slice(1),'index.html');
    const d=parseHTML(newPages.get(route)||fs.readFileSync(file,'utf8')).document;
    const body=G.enhance(d,code,group,available,uiSnapshots.get(code).ui).replace(/(\/js\/site-locales\.js\?v=)[a-f0-9]+/g,'$1'+runtimeHash);
    plans.push({file,body});
  }
  const root=rootDocument(fs.readFileSync(path.join(L.ROOT,'index.html'),'utf8'),available).replace(/(\/js\/site-locales\.js\?v=)[a-f0-9]+/g,'$1'+runtimeHash);
  plans.push({file:path.join(L.ROOT,'index.html'),body:root},{file:runtimeFile,body:runtime},{file:path.join(L.ROOT,'data/i18n/locales.json'),body:JSON.stringify(nextRegistry,null,2)+'\n'});
  const xml=sitemap(fs.readFileSync(path.join(L.ROOT,'sitemap.xml'),'utf8'),groups.flatMap(g=>available.map(c=>L.publicOrigin+g.routes[c])));
  plans.push({file:path.join(L.ROOT,'sitemap.xml'),body:xml});
  plans.push(...require('./refresh-global-asset-versions').legacyPlans(new Set(plans.map(p=>p.file))));
  for(const [code,snapshot]of uiSnapshots)assert.equal(L.digest(fs.readFileSync(snapshot.file,'utf8')),snapshot.hash,code+' UI changed during release preparation');
  const report={schemaVersion:1,mode:apply?'local-release-applied':'local-release-plan',deployed:false,locales:available,newLocales:selected,canonicalPages:groups.length*available.length,sitemapURLs:[...xml.matchAll(/<loc>/g)].length,validation,files:plans.map(p=>({path:path.relative(L.ROOT,p.file).replaceAll('\\','/'),sha256:L.digest(p.body)}))};
  // All validation above completes before any deployable file is written.
  if(apply){for(const p of plans)L.safeWrite(p.file,p.body);require('./build-global-search').build({locales:selected});}
  L.safeWrite(path.join(DELIVERY,'global-release-plan.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({mode:report.mode,locales:available.length,canonicalPages:report.canonicalPages,sitemapURLs:report.sitemapURLs,validation}));return report;
}
module.exports={immutableScalars,inspectPair,sitemap,registryRuntime,validateUI,expectedProgram,prepare};
if(require.main===module){const arg=process.argv.find(x=>x.startsWith('--locales='));prepare({locales:arg?.slice(10).split(','),apply:process.argv.includes('--apply'),rebuild:!process.argv.includes('--no-rebuild')});}
