'use strict';
// Static publication guard, separate from account-side GA receipt verification.
const assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const APPROVED=['G-Z2MJ6TXZHK','G-TMGDGSEWW6','G-Z2MJ6TZXHK'];
function signature(html){
 const d=parseHTML(html).document,boots=[...d.querySelectorAll('script[data-v3-ga-bootstrap]')],runtime=[...d.querySelectorAll('script[src]')].filter(n=>/^\/js\/v3-affiliate\.js(?:\?|$)/.test(n.getAttribute('src')));
 assert(boots.length<=1,'Duplicate GA initialization');assert(runtime.length<=1,'Duplicate consent runtime');
 assert(![...d.querySelectorAll('script[src]')].some(n=>/googletagmanager\.com\/(?:gtag\/js|gtm\.js)/.test(n.getAttribute('src'))),'Google loader must remain behind opt-in');
 const ids=boots.length?JSON.parse(boots[0].textContent.match(/TS_V3_GA_IDS\s*=\s*(\[[^;]+\]);/)?.[1]||'null'):[];
 if(boots.length){assert(Array.isArray(ids)&&ids[0]===APPROVED[0]&&new Set(ids).size===ids.length&&ids.every(id=>APPROVED.includes(id)),'Unreviewed measurement destination');assert.match(boots[0].textContent,/gtag\('consent','default',\{analytics_storage:'denied'\}\)/,'Consent must default to denied');}
 if(runtime.length){assert.equal(boots.length,1,'Consent runtime without GA bootstrap');assert(d.querySelector('[data-v3-consent]'),'Consent controls missing');}
 return {ids,bootstrap:boots.map(n=>n.textContent.replaceAll('\r\n','\n')),runtime:runtime.length,verification:[...d.querySelectorAll('meta[name="google-site-verification"]')].map(n=>n.getAttribute('content')).sort()};
}
function preserved(before,after){const a=signature(before),b=signature(after);for(const key of ['ids','bootstrap','runtime'])assert.deepEqual(b[key],a[key],'Preserved analytics '+key);for(const token of a.verification)assert(b.verification.includes(token),'Existing Google verification meta removed');return true;}
module.exports={APPROVED,signature,preserved};
