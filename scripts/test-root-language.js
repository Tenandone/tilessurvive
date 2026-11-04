'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const {rootDocument}=require('./build-global-navigation');
const locales=require('../js/site-locales');
function rootScenario(preferred,browser,available=['en','ko','ja','ru','zh-tw','de']) {
 const html=rootDocument(fs.readFileSync(require('node:path').resolve(__dirname,'../index.html'),'utf8'),available);
 const document=parseHTML(html).document;let destination=null;const writes=[];
 const context={window:{TS_LOCALES:locales},document,location:{replace:v=>{destination=v;}},navigator:{languages:browser},localStorage:{getItem:()=>preferred,setItem:(k,v)=>writes.push([k,v])}};
 vm.runInNewContext(fs.readFileSync(require('node:path').resolve(__dirname,'../js/root-language.js'),'utf8'),context);
 return {document,destination,writes};
}
test('German browser language and saved preference reach the existing German homepage',()=>{
 assert.equal(rootScenario(null,['de-DE','en-US']).destination,'/de/');
 assert.equal(rootScenario('de',['en-US']).destination,'/de/');
});
test('unpublished languages never redirect to an unavailable locale',()=>{
 assert.equal(rootScenario('fr',['fr-FR','ko-KR']).destination,'/ko/');
 assert.equal(rootScenario(null,['my-MM']).destination,'/en/');
});
test('publication enables exact Malay, Norwegian and script-specific Chinese routes',()=>{
 const available=['en','ms','nb','zh-cn','zh-tw'];
 assert.equal(rootScenario(null,['ms-MY'],available).destination,'/ms/');
 assert.equal(rootScenario(null,['no-NO'],available).destination,'/nb/');
 assert.equal(rootScenario(null,['zh-Hans-CN'],available).destination,'/zh-cn/');
 assert.equal(rootScenario(null,['zh-Hant-TW'],available).destination,'/zh-tw/');
});
test('root links and hreflang exactly match available languages and retain original ad code',()=>{
 const out=rootScenario(null,['en']);
 assert.equal(out.document.querySelectorAll('.lang-grid a').length,6);
 assert.equal(out.document.querySelectorAll('link[hreflang="de"]').length,1);
 assert.equal(out.document.querySelector('link[hreflang="x-default"]').href,'https://tilessurvive.net/');
 assert.equal(out.document.querySelectorAll('script[src*="adsbygoogle.js"]').length,1);
});
