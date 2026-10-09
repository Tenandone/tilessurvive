const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{execFileSync}=require('child_process'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),copy=require('../data/lootbar-banners.json'),expected=require('../config/affiliate.json').tilesSurvive.url;
const types=['','codes/','top-up/','guides/discount-topup/','guides/discount-topup-promotion/'];let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
for(const [lang,c] of Object.entries(copy))for(const type of types){
 const relative=`${lang}/${type}index.html`,html=fs.readFileSync(path.join(root,relative),'utf8'),d=parseHTML(html).document;
 const old=parseHTML(execFileSync('git',['show','6f9e8cf:'+relative],{cwd:root,encoding:'utf8',maxBuffer:2000000})).document;
 check(d.querySelectorAll('.ts-lootbar').length===1,'One banner: '+relative);
 const a=d.querySelector('.ts-lootbar');check(a.href===expected,'Referral exact: '+relative);check(a.textContent.includes(c.cta),'Localized CTA');
 check(a.textContent.includes(c.title+' '+c.message),'Complete localized headline');
 check(a.rel.includes('sponsored')&&a.rel.includes('noopener'),'Affiliate safety');check(a.dataset.affiliatePlacement.startsWith('banner_'),'Tracking placement');
 check(!/\d\s*%|22|25%/.test(a.textContent),'No unverified percentage');check(a.querySelector('.ts-lootbar-world').src==='/img/banners/official-world.webp' && a.querySelector('.ts-lootbar-hero').src==='/img/banners/official-hero.webp','Original art');
 for(const selector of ['title','h1','link[rel=canonical]','meta[name=description]'])check(d.querySelector(selector).outerHTML===old.querySelector(selector).outerHTML,'SEO preserved '+selector+' '+relative);
 check(JSON.stringify([...d.querySelectorAll('link[hreflang]')].map(x=>x.outerHTML))===JSON.stringify([...old.querySelectorAll('link[hreflang]')].map(x=>x.outerHTML)),'Hreflang preserved');
 if(type==='codes/'){check(!d.querySelector('.sponsorPill,#midDiscountLink,iframe[src*=lootbar]'),'Old coupon ads replaced');check(d.querySelector('#codesGrid'),'Coupon list kept');check(d.querySelector('script[data-coupon-app]').textContent===old.querySelector('script[data-coupon-app]').textContent,'Coupon script unchanged');}
 if(type==='top-up/')check(!d.querySelector('.topup-sticky'),'No fixed CTA');
 if(type==='guides/discount-topup-promotion/')check(!d.querySelector('#widget .widget-desktop,#widget .widget-mobile,#widget iframe,#widget [data-placeholder]'),'Legacy device wrappers and overlays removed');
}
for(const file of ['config/affiliate.json','data/tilessurvive-coupons.json','js/platform-affiliate.js','js/platform-math.js','robots.txt','CNAME'])check(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')===execFileSync('git',['show','6f9e8cf:'+file],{cwd:root,encoding:'utf8',maxBuffer:2000000}).replace(/\r\n/g,'\n'),'Preserved '+file);
// Content expansion adds URLs; every pre-existing sitemap URL must survive.
const oldMap=execFileSync('git',['show','6f9e8cf:sitemap.xml'],{cwd:root,encoding:'utf8'}),newMap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
for(const url of oldMap.match(/<loc>[^<]+<\/loc>/g))check(newMap.includes(url),'Preserved sitemap URL '+url);
for(const lang of Object.keys(copy))for(const type of types){const relative=lang+'/'+type+'index.html';const now=parseHTML(fs.readFileSync(path.join(root,relative),'utf8')).document;const before=parseHTML(execFileSync('git',['show','e46a3fe:'+relative],{cwd:root,encoding:'utf8',maxBuffer:2000000})).document;for(const d of [now,before]){d.querySelector('[data-lootbar-slot]').innerHTML='';d.querySelector('link[data-lootbar-style]').remove();}check(now.documentElement.outerHTML===before.documentElement.outerHTML,'Only banner content changed '+relative);}
console.log(JSON.stringify({checks,pages:25,languages:5,errors:[]},null,2));
