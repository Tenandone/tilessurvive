const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto'),{execFileSync}=require('child_process'),{parseHTML}=require('linkedom');
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
 // 3.0 intentionally rewrites homepage metadata and structure. The searchable
 // page, canonical identity and language graph must remain valid and stable.
 check(d.querySelectorAll('h1').length===1&&d.querySelector('h1').textContent.trim().length>0,'One meaningful H1 '+relative);
 check(d.querySelector('title')?.textContent.trim().length>0,'Title present '+relative);
 check(d.querySelector('meta[name=description]')?.content.trim().length>0,'Description present '+relative);
 check(d.querySelector('link[rel=canonical]')?.href===old.querySelector('link[rel=canonical]')?.href,'Canonical preserved '+relative);
 const alternates=doc=>[...doc.querySelectorAll('link[hreflang]')].map(x=>[x.getAttribute('hreflang'),x.href]).sort();
 check(JSON.stringify(alternates(d))===JSON.stringify(alternates(old)),'Hreflang preserved '+relative);
 if(type==='codes/'){check(!d.querySelector('.sponsorPill,#midDiscountLink,iframe[src*=lootbar]'),'Old coupon ads replaced');check(d.querySelector('#codesGrid'),'Coupon list kept');check(d.querySelector('script[data-coupon-app]').textContent===old.querySelector('script[data-coupon-app]').textContent,'Coupon script unchanged');}
 if(type==='top-up/')check(!d.querySelector('.topup-sticky'),'No fixed CTA');
 if(type==='guides/discount-topup-promotion/')check(!d.querySelector('#widget .widget-desktop,#widget .widget-mobile,#widget iframe,#widget [data-placeholder]'),'Legacy device wrappers and overlays removed');
}
for(const file of ['config/affiliate.json','data/tilessurvive-coupons.json','js/platform-affiliate.js','js/platform-math.js','robots.txt','CNAME']){
 // Keep the referral untouched while permitting the requested analytics dimensions.
 if(file==='js/platform-affiliate.js'){const tracking=JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'test-affiliate-301.js')],{cwd:root,encoding:'utf8'}));check(tracking.checks>=72&&tracking.errors.length===0,'Affiliate measurement contract');continue;}
 check(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')===execFileSync('git',['show','6f9e8cf:'+file],{cwd:root,encoding:'utf8',maxBuffer:2000000}).replace(/\r\n/g,'\n'),'Preserved '+file);
}
// Content expansion adds URLs; every pre-existing sitemap URL must survive.
const oldMap=execFileSync('git',['show','6f9e8cf:sitemap.xml'],{cwd:root,encoding:'utf8'}),newMap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
for(const url of oldMap.match(/<loc>[^<]+<\/loc>/g))check(newMap.includes(url),'Preserved sitemap URL '+url);
// The rest of each page is authorized for reconstruction. Protect the actual
// production banner subtree, slot identity, stylesheet and image bytes instead.
for(const lang of Object.keys(copy))for(const type of types){
 const relative=lang+'/'+type+'index.html',now=parseHTML(fs.readFileSync(path.join(root,relative),'utf8')).document,before=parseHTML(execFileSync('git',['show','247d481:'+relative],{cwd:root,encoding:'utf8',maxBuffer:2000000})).document;
 const slot=now.querySelector('[data-lootbar-slot]'),oldSlot=before.querySelector('[data-lootbar-slot]');
 check(now.querySelectorAll('[data-lootbar-slot]').length===1,'One original slot '+relative);
 check(slot?.getAttribute('data-lootbar-slot')===oldSlot?.getAttribute('data-lootbar-slot'),'Original slot identity '+relative);
 check(slot?.innerHTML===oldSlot?.innerHTML,'Production banner markup preserved '+relative);
 check(now.querySelector('link[data-lootbar-style]')?.href===before.querySelector('link[data-lootbar-style]')?.href,'Banner stylesheet preserved '+relative);
 check(!!slot.closest('main'),'Banner remains in document content '+relative);
}
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const name of fs.readdirSync(path.join(root,'img/banners'))){const file='img/banners/'+name;check(sha(fs.readFileSync(path.join(root,file)))===sha(execFileSync('git',['show','247d481:'+file],{cwd:root,maxBuffer:12000000})),'Production banner file preserved '+file);}
console.log(JSON.stringify({checks,pages:25,languages:5,errors:[]},null,2));
