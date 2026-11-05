'use strict';
// Static publication guard. Network receipt and account settings need live checks.
const assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const APPROVED=['G-Z2MJ6TXZHK'];
const HISTORICAL=['G-Z2MJ6TXZHK','G-TMGDGSEWW6','G-Z2MJ6TZXHK'];
const currentBootstrap=parseHTML(require('./v3-affiliate-content').transformAnalytics('<html><head></head><body></body></html>')).document.querySelector('[data-v3-ga-bootstrap]').textContent;
const legacyBootstrap=ids=>`window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.gtag('consent','default',{analytics_storage:'denied'});window.TS_V3_GA_IDS=${JSON.stringify(ids)};`;
function signature(html,{allowLegacy=false}={}){
 const d=parseHTML(html).document,boots=[...d.querySelectorAll('script[data-v3-ga-bootstrap]')],scripts=[...d.querySelectorAll('script[src]')];
 const runtime=scripts.filter(n=>/^\/js\/v3-affiliate\.js(?:\?|$)/.test(n.getAttribute('src'))),contract=scripts.filter(n=>/^\/js\/analytics-contract\.js(?:\?|$)/.test(n.getAttribute('src')));
 assert(boots.length<=1,'Duplicate GA initialization');assert(runtime.length<=1,'Duplicate analytics runtime');assert(contract.length<=1,'Duplicate analytics schema');
 assert(!scripts.some(n=>/googletagmanager\.com\/(?:gtag\/js|gtm\.js)/.test(n.getAttribute('src'))),'Google loader must remain behind runtime privacy checks');
 const ids=boots.length?JSON.parse(boots[0].textContent.match(/TS_V3_GA_IDS\s*=\s*(\[[^;]+\]);/)?.[1]||'null'):[];
 let legacy=false;
 if(boots.length){
  assert(Array.isArray(ids)&&ids[0]===APPROVED[0]&&new Set(ids).size===ids.length&&ids.every(id=>HISTORICAL.includes(id)),'Unreviewed measurement destination');
  const body=boots[0].textContent.replaceAll('\r\n','\n');legacy=allowLegacy&&body===legacyBootstrap(ids);
  assert(legacy||body===currentBootstrap,'Unreviewed analytics bootstrap');
  if(!legacy)assert.deepEqual(ids,APPROVED,'Only verified GA4 destination may run');
 }
 for(const node of d.querySelectorAll('script:not([src]):not([type="application/json"]):not([type="application/ld+json"])'))if(!node.hasAttribute('data-v3-ga-bootstrap'))assert(!/\bgtag\s*\(\s*['"](?:config|consent)['"]/.test(node.textContent),'Unreviewed additional Google initialization');
 if(runtime.length){assert.equal(boots.length,1,'Analytics runtime without GA bootstrap');assert(d.documentElement.hasAttribute('data-v3-affiliate'),'Analytics document marker missing');if(legacy){assert(d.querySelector('[data-v3-consent]'),'Legacy controls missing');}else{assert.equal(contract.length,1,'Analytics schema missing');assert(scripts.indexOf(contract[0])<scripts.indexOf(runtime[0]),'Analytics schema must load before runtime');}}
 assert.equal(contract.length,legacy?0:runtime.length,'Schema/runtime lifecycle mismatch');
 if(!legacy)assert.equal(d.querySelectorAll('[data-v3-consent],[data-v3-consent-allow],[data-v3-consent-deny],[data-v3-consent-status],[data-v3-owned="privacy"]').length,0,'Retired consent UI remains');
 return {ids,bootstrap:boots.map(n=>n.textContent.replaceAll('\r\n','\n')),runtime:runtime.length,contract:contract.length,legacy,verification:[...d.querySelectorAll('meta[name="google-site-verification"]')].map(n=>n.getAttribute('content')).sort()};
}
function preserved(before,after){
 const a=signature(before,{allowLegacy:true}),b=signature(after);
 assert.deepEqual(b.ids,a.bootstrap.length?APPROVED:[],'Approved analytics destination migration');
 assert.deepEqual(b.bootstrap,a.bootstrap.length?[currentBootstrap]:[],'Approved analytics bootstrap migration');
 assert.equal(b.runtime,a.runtime,'Preserved analytics runtime');assert.equal(b.contract,a.runtime,'One schema per analytics runtime');
 for(const token of a.verification)assert(b.verification.includes(token),'Existing Google verification meta removed');
 return true;
}
module.exports={APPROVED,signature,preserved};
