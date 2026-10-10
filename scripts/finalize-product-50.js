'use strict';
// Final presentation/SEO pass. Game values, source images and referral URLs stay intact.
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..'),origin='https://tilessurvive.net';
const langs=['ko','en','ja','ru','zh-tw','de'];
const labels={ko:'한국어',en:'English',ja:'日本語',ru:'Русский','zh-tw':'繁體中文',de:'Deutsch'};
const revisedScripts=new Set(['platform-i18n.js','layout.js','platform-affiliate.js','platform.js','platform-search.js','site-search.js','product-30.js','data-workbench-30.js','event-helper.js','tools-speedup-calculator.js','hero-skill-levels-40.js','sea-hero-growth-40.js','database-22.js','foundation-40.js','daily-missions-40.js','pet-growth-40.js']);
const offerCopy={
 ko:['LootBar 할인 충전 가능 여부 확인','제휴 링크 · 상품·지역별 적용 조건을 확인하세요.'],
 en:['Check top-up offers on LootBar','Affiliate link · Check the conditions for your product and region.'],
 ja:['LootBarのチャージ特典を確認','アフィリエイトリンク・商品と地域ごとの適用条件をご確認ください。'],
 ru:['Проверить предложения пополнения на LootBar','Партнёрская ссылка · Уточните условия для товара и региона.'],
 'zh-tw':['查看 LootBar 儲值優惠','聯盟行銷連結・請確認商品與地區適用條件。'],
 de:['Aufladeangebote bei LootBar prüfen','Partnerlink · Prüfe die Bedingungen für dein Produkt und deine Region.']
};
const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.html')?[path.join(d,e.name)]:[]):[];
const key=url=>new URL(url,origin).pathname.replace(/^\/(ko|en|ja|ru|zh-tw|de)\//,'/').replace('/heroes/tazan/','/heroes/tarzan/').replace('/behemoths/tidal-drake/','/behemoths/marine-drake/');
const pages=langs.flatMap(lang=>walk(path.join(ROOT,lang)).map(file=>{
 const d=parseHTML(fs.readFileSync(file,'utf8')).document;
 const route='/'+path.relative(ROOT,file).replaceAll('\\','/').replace(/index\.html$/,'');
 const canonical=d.querySelector('link[rel=canonical]')?.getAttribute('href');
 return {lang,file,d,route,canonical,indexable:!d.querySelector('meta[name=robots]')?.content.includes('noindex')&&canonical===origin+route};
}));
const groups=new Map();
for(const p of pages.filter(p=>p.indexable)){const k=key(p.canonical);if(!groups.has(k))groups.set(k,new Map());const g=groups.get(k);if(g.has(p.lang))throw Error('Duplicate canonical locale '+p.route);g.set(p.lang,p);}
let changed=0;const imageRoles={portrait:0,skill:0,'table-icon':0};
for(const p of pages){
 const {d}=p;
 for(const script of d.querySelectorAll('script[src]')){
  const u=new URL(script.getAttribute('src'),origin);
  if(u.origin===origin&&u.pathname.startsWith('/js/')&&revisedScripts.has(path.posix.basename(u.pathname))){
   const file=path.join(ROOT,u.pathname);if(!fs.existsSync(file))throw Error('Missing runtime '+u.pathname);
   u.searchParams.set('v',require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0,12));
   script.setAttribute('src',u.pathname+u.search);
  }
 }
 // Wordmark only; favicon links and content illustrations remain unchanged.
 for(const brand of d.querySelectorAll('.ts-header .ts-brand,header.site-header a.brand'))brand.textContent='TilesSurvive';
 const group=groups.get(key(p.canonical||p.route));
 if(group){
  for(const nav of d.querySelectorAll('.ts3-language nav,.ts-header nav')){
   if(!nav.querySelector('a[hreflang],a[lang]'))continue;
   nav.replaceChildren();
   for(const lang of langs){const counterpart=group.get(lang);if(!counterpart)continue;const a=d.createElement('a');a.href=counterpart.route;a.setAttribute('hreflang',lang);a.lang=lang;a.textContent=labels[lang];if(lang===p.lang)a.setAttribute('aria-current','page');nav.append(a);}
  }
 }
 d.querySelectorAll('link[rel=alternate][hreflang]').forEach(n=>n.remove());
 if(p.indexable&&group){
  for(const lang of langs){const alternate=group.get(lang);if(!alternate)continue;const l=d.createElement('link');l.rel='alternate';l.hreflang=lang;l.href=alternate.canonical;d.head.append(l);}
  const def=group.get('en');if(def){const l=d.createElement('link');l.rel='alternate';l.hreflang='x-default';l.href=def.canonical;d.head.append(l);}
 }
 if(d.querySelector('main')){
  // One compact referral after the relevant package comparison, never over a table.
  if(p.route===`/${p.lang}/database/items/`){
   const section=d.querySelector('section[aria-labelledby="packages-heading"]');
   if(section&&!d.querySelector('[data-package-offer-50]')){
    const note=d.createElement('p');note.className='ts50-package-offer';note.setAttribute('data-package-offer-50','');
    const a=d.createElement('a');a.href='https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive';a.target='_blank';a.rel='sponsored nofollow noopener';a.dataset.affiliatePlacement='package_comparison';a.dataset.affiliateCampaign='lootbar';a.textContent=offerCopy[p.lang][0];
    const small=d.createElement('small');small.textContent=offerCopy[p.lang][1];note.append(a,small);section.append(note);
   }
  }
  if(!d.querySelector('link[href="/css/product-50.css"]')){const l=d.createElement('link');l.rel='stylesheet';l.href='/css/product-50.css';d.head.append(l);}
  for(const img of d.querySelectorAll('main img')){
   if(img.closest('[data-lootbar-slot]'))continue;
   if(img.closest('.ts3-character-art,.ts3-pet-portrait'))img.setAttribute('data-image-role-50','portrait');
   else if(img.closest('.ts3-skill-selector,.ts-skill summary'))img.setAttribute('data-image-role-50','skill');
   else if(img.closest('table')&&Number(img.getAttribute('width'))<=256)img.setAttribute('data-image-role-50','table-icon');
   const role=img.getAttribute('data-image-role-50');if(Object.hasOwn(imageRoles,role))imageRoles[role]++;
   // Source dimensions never get invented; existing dimensions reserve space.
   if(!img.getAttribute('decoding'))img.setAttribute('decoding','async');
  }
 }
 const out='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
 if(out!==fs.readFileSync(p.file,'utf8')){fs.writeFileSync(p.file,out);changed++;}
}
// Compatibility component shells are kept in sync for pages which use layout.js.
for(const lang of langs){const file=path.join(ROOT,'components',lang,'header.html');if(!fs.existsSync(file))continue;const d=parseHTML(fs.readFileSync(file,'utf8')).document;for(const b of d.querySelectorAll('a.brand,.ts-brand'))b.textContent='TilesSurvive';fs.writeFileSync(file,d.toString());}
const canonical=pages.filter(p=>p.indexable).map(p=>p.canonical);
for(const route of ['/','/tiktok-live-match/']){const f=path.join(ROOT,route,'index.html');if(!fs.existsSync(f))continue;const d=parseHTML(fs.readFileSync(f,'utf8')).document;if(d.querySelector('link[rel=canonical]')?.href===origin+route&&!/noindex/.test(d.querySelector('meta[name=robots]')?.content||''))canonical.push(origin+route);}
fs.writeFileSync(path.join(ROOT,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+[...new Set(canonical)].sort().map(u=>'<url><loc>'+u+'</loc></url>').join('\n')+'\n</urlset>\n');
console.log(JSON.stringify({product50:'shared-presentation-and-SEO',pages:pages.length,changed,canonical:canonical.length,groups:groups.size,imageRoles,incompleteGroups:[...groups].filter(([,g])=>g.size!==6).map(([k,g])=>({route:k,langs:[...g.keys()]}))}));
module.exports={key};
