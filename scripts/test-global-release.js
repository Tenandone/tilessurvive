'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {immutableScalars,inspectPair,sitemap,registryRuntime,validateUI,expectedProgram}=require('./build-global-release');
test('localized display keys are allowed while model enums and quantities are immutable',()=>{
 const source={id:'hero-1',kind:'research',target:'r-1',amount:12000,ratio:0.125,copy:{kind:'Reference type',target:'Reference target'}};
 const localized={...source,copy:{kind:'Type de référence',target:'Cible de référence'}};
 const stats={scalars:0};immutableScalars(source,localized,'model',stats);assert.equal(stats.scalars,2);
 for(const bad of [{...localized,amount:12001},{...localized,target:'r-2'},{...localized,kind:'recherche'}])assert.throws(()=>immutableScalars(source,bad,'model',{scalars:0}));
});
test('release retains old sitemap URLs and dates, adds unique canonical URLs without fabricated dates',()=>{
 const old='<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://tilessurvive.net/en/</loc><lastmod>2026-10-13</lastmod></url></urlset>';
 const out=sitemap(old,['https://tilessurvive.net/en/','https://tilessurvive.net/fr/']);
 assert.equal([...out.matchAll(/<loc>/g)].length,2);assert.equal([...out.matchAll(/<lastmod>/g)].length,1);assert.match(out,/2026-10-13/);
 assert.equal(sitemap(out,['https://tilessurvive.net/fr/']),out);
 assert.throws(()=>sitemap(old.replace('https://tilessurvive.net','http://development.local'),[]));
});
test('embedded locale registry is replaced only at explicit markers',()=>{
 const input='before /* TS_LOCALE_REGISTRY_START */ {} /* TS_LOCALE_REGISTRY_END */ after';
 assert.equal(registryRuntime(input,{schemaVersion:1}),'before /* TS_LOCALE_REGISTRY_START */ {"schemaVersion":1} /* TS_LOCALE_REGISTRY_END */ after');
 assert.throws(()=>registryRuntime('unrelated code',{}));
});

test('only the verified broken JSON-LD cover reference may change',()=>{
 const before={image:'https://tilessurvive.net/img/buildings/comms-outpost-cover.webp'};
 immutableScalars(before,{image:'https://tilessurvive.net/img/buildings/comms-outpost.webp'},'schema',{scalars:0});
 assert.throws(()=>immutableScalars(before,{image:'https://example.org/other.webp'},'schema',{scalars:0}));
 assert.throws(()=>immutableScalars({image:'/img/valid.webp'},{image:'/img/other.webp'},'schema',{scalars:0}));
});
test('release gate rejects changed form bounds, media and executable formulas',()=>{
 const base='<html lang="en"><head><title>Cost</title><meta name="description" content="Cost"><link rel="canonical" href="https://tilessurvive.net/en/tools/"></head><body><input type="number" id="n" min="1" max="10"><img src="/img/example.png"><script>const factor=60;function total(n){return n*factor;}</script></body></html>';
 const translated=base.replace('lang="en"','lang="fr"').replaceAll('Cost','Coût').replace('/en/tools/','/fr/tools/');
 assert.equal(inspectPair(base,translated,{locale:'fr',route:'/fr/tools/'}).programs,1);
 for(const bad of [translated.replace('max="10"','max="11"'),translated.replace('example.png','other.png'),translated.replace('factor=60','factor=61')])assert.throws(()=>inspectPair(base,bad,{locale:'fr',route:'/fr/tools/'}));
});

test('numeric strings and executable string constants cannot hide behind localization',()=>{
 assert.throws(()=>immutableScalars({amount:'12000'},{amount:'99999'},'model',{scalars:0}));
 for(const value of ['20%','750.45K','1,000,000','-0.2','2.6.200'])assert.throws(()=>immutableScalars({args:[value]},{args:['99%']},'model',{scalars:0}));
 const base='<html lang="en"><head><title>Cost</title><meta name="description" content="Cost"><link rel="canonical" href="https://tilessurvive.net/en/tools/"></head><body><script>const factor="60",unit="minutes";function total(n){return n*Number(factor);}</script></body></html>';
 const translated=base.replace('lang="en"','lang="fr"').replaceAll('Cost','Coût').replace('/en/tools/','/fr/tools/');
 assert.equal(inspectPair(base,translated,{locale:'fr',route:'/fr/tools/'}).programs,1);
 for(const bad of [translated.replace('"60"','"600"'),translated.replace('"minutes"','"hours"')])assert.throws(()=>inspectPair(base,bad,{locale:'fr',route:'/fr/tools/'}));
});

test('release requires every shared UI key and affiliate label in a matching locale',()=>{
 const good=require('../data/i18n/ui/fr.json');
 assert.equal(validateUI(good,'fr'),good);
 for(const bad of [{...good,copy:{}},{...good,affiliate:[]},{...good,locale:'en'},{...good,copy:{...good.copy,search:''}}])assert.throws(()=>validateUI(bad,'fr'));
});

test('legacy documents refresh only local JavaScript cache versions and retain redirect behavior',()=>{
 const {refresh}=require('./refresh-global-asset-versions');
 const old='<meta http-equiv="refresh" content="0; url=/ko/tools/"><script src="/js/platform.js?v=old&other=1"></script><script src="https://external.test/x.js?v=old"></script><script>location.replace("/ko/tools/")</script>';
 const result=refresh(old),hash=require('./lib/global-localization').digest(require('fs').readFileSync(require('path').join(__dirname,'../js/platform.js'))).slice(0,12);
 assert.equal(result,old.replace('/js/platform.js?v=old&other=1','/js/platform.js?v='+hash+'&other=1'));
 assert.equal(refresh(result),result);
});
