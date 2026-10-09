/* Exercise the actual analytics module without network requests or purchase events. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').join(__dirname,'../js/platform-affiliate.js'),'utf8');
let checks=0;const eq=(a,b)=>{assert.deepStrictEqual(a,b);checks++;};
function setup(route,{hostname='localhost',planner=false,banner=true}={}){
 const handlers={},events=[],analytics=[],observers=[],tasks=new Map();let next=0;
 const anchor={href:'https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive',dataset:{affiliatePlacement:'banner_hero_detail',affiliateCampaign:'lootbar',affiliateVariant:'hero-301'},isConnected:true,classList:{contains:n=>banner&&n==='ts-lootbar'},hasAttribute:n=>n==='data-affiliate-placement',matches:()=>true,querySelectorAll:()=>[]};
 const doc={documentElement:{dataset:{lang:'ko'}},body:{},hidden:false,querySelector:s=>s.includes('data-growth-form')&&planner?{}:null,querySelectorAll:s=>s==='a[href]'?[anchor]:[],addEventListener:(n,fn)=>handlers[n]=fn,dispatchEvent:e=>events.push(e.detail)};
 const context={document:doc,location:{pathname:route,hostname,origin:'https://'+hostname},window:{gtag:(...args)=>analytics.push(args)},URL,CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}},IntersectionObserver:class{constructor(callback,options){this.callback=callback;this.options=options;observers.push(this);}observe(){}unobserve(){}},MutationObserver:class{observe(){}},setTimeout:(fn,ms)=>{eq(ms,1000);tasks.set(++next,fn);return next;},clearTimeout:id=>tasks.delete(id)};
 context.window.IntersectionObserver=context.IntersectionObserver;
 vm.runInNewContext(source,context);
 return {events,analytics,doc,anchor,click:()=>handlers.click({target:{closest:()=>anchor}}),view:ratio=>observers[1].callback([{target:anchor,intersectionRatio:ratio}]),flush:()=>{for(const [id,fn]of [...tasks]){tasks.delete(id);fn();}},visibility:()=>handlers.visibilitychange(),pending:()=>tasks.size};
}
for(const [route,expected,planner]of [['/ko/','home'],['/en/heroes/shark/','hero_detail'],['/ja/database/pet-system/starhorn/','pet_detail'],['/ru/codes/','coupon'],['/zh-tw/database/gear-exp/','calculator',true],['/ko/buildings/power-plant/','calculator',true],['/ko/tools/speedup-calculator/','calculator'],['/en/top-up/','topup'],['/ko/guides/discount-topup/','guide']]){
 const a=setup(route,{planner});a.click();eq(a.events.length,1);eq(a.events[0].event,'lootbar_outbound_click');eq(a.events[0].page_type,expected);eq(a.events[0].creative_type,'banner');eq(a.events[0].destination,a.anchor.href);eq(a.analytics.length,0);
}
const a=setup('/ko/heroes/shark/',{hostname:'tilessurvive.net'});a.view(.59);eq(a.pending(),0);a.view(.6);eq(a.events.length,0);eq(a.pending(),1);a.doc.hidden=true;a.visibility();eq(a.pending(),0);a.flush();eq(a.events.length,0);a.doc.hidden=false;a.visibility();a.flush();eq(a.events.length,1);eq(a.events[0].event,'affiliate_viewable');eq(a.events[0].measurement_version,'3.0.1');a.view(1);a.flush();eq(a.events.length,1);a.click();eq(a.events.length,2);eq(a.analytics.length,2);eq(a.analytics[0][0],'event');eq(a.analytics[0][1],'affiliate_viewable');eq(a.analytics[1][1],'lootbar_outbound_click');eq(a.analytics.some(e=>e[1]==='purchase'),false);
const b=setup('/ko/top-up/',{banner:false});b.click();eq(b.events[0].creative_type,'text_link');
console.log(JSON.stringify({checks,errors:[],scope:'Actual tracking module: page categories, banner/text dimension, viewable60%+1second, hidden-tab cancellation, one view per document, click separation, production-only GA dispatch, no invented purchase event.'},null,2));
