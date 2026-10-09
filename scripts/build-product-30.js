const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),I=require('../js/platform-i18n'),C=require('../data/product-30-copy');
// The old coupon background no longer exists; avoid an otherwise hidden request.
for(const name of ['ccf261393d86b20e.css','50ebc52ad0012639.css','cd6a4623d84848b3.css']){const file=path.join(root,'css','content',name);if(fs.existsSync(file)){const old=fs.readFileSync(file,'utf8'),next=old.replace(/url\(["']?\/?img\/tilessurvive\/back\.png["']?\)/g,'none');if(next!==old)fs.writeFileSync(file,next);}}
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.html')?[path.join(d,e.name)]:[]);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const node=(d,s)=>{const t=d.createElement('template');t.innerHTML=s;return t.content;};
const pages=Object.keys(C).flatMap(lang=>walk(path.join(root,lang)).map(file=>({file,lang,route:'/'+path.relative(root,file).replaceAll('\\','/').replace(/index\.html$/,''),d:parseHTML(fs.readFileSync(file,'utf8')).document})));
const byRoute=new Map(pages.map(p=>[p.route,p]));
function label(lang,route,fallback){return byRoute.get('/'+lang+'/'+route)?.d.querySelector('h1')?.textContent.trim()||fallback;}
function home(p){const {d,lang}=p,c=C[lang],t=I[lang],base='/'+lang+'/';
 const link=(r,title,desc)=>`<a href="${base+r}"><span><strong>${esc(title)}</strong>${desc?`<small>${esc(desc)}</small>`:''}</span><span aria-hidden="true">↗</span></a>`;
 const roster=['undine','knotty','shark','lagnar','beka'].map(slug=>{const pg=byRoute.get(base+'heroes/'+slug+'/'),name=pg?.d.querySelector('h1')?.textContent.trim()||slug; const src={undine:'undine-game.webp',knotty:'knotty-game.webp'}[slug]||slug+'.webp';return `<a href="${base}heroes/${slug}/"><span class="ts3-roster-art"><img src="/img/heroes/${src}" alt="" width="256" height="256" loading="lazy" decoding="async"></span><strong>${esc(name)}</strong><span aria-hidden="true">↗</span></a>`;}).join('');
 const main=d.querySelector('main'),slot=main.querySelector('[data-lootbar-slot]');if(slot)slot.remove();
 main.innerHTML=`<section class="ts3-home-hero" aria-labelledby="homeTitle"><img class="ts3-world" src="/img/banners/official-world.webp" alt="" width="1920" height="1080" fetchpriority="high"><div class="ts3-home-intro"><span class="ts3-kicker">TILES SURVIVE · DATABASE & GUIDES</span><h1 id="homeTitle">${c.home}<span>${c.homeLine}</span></h1><p>${c.intro}</p><form class="home-search ts3-search-form" action="${base}search/" role="search"><label class="visually-hidden" for="homeSearch-${lang}">${c.find}</label><input id="homeSearch-${lang}" type="search" name="q" placeholder="${c.find}" autocomplete="off"><button type="submit">${t.search}<span aria-hidden="true"> ↗</span></button></form><nav class="ts3-hero-shortcuts" aria-label="${t.menu}">${link('heroes/',t.heroes)}${link('database/pet-system/',c.pets)}${link('buildings/',t.buildings)}${link('tools/',t.tools)}</nav></div></section>
 <div class="ts3-home-workspace"><section class="ts3-explore" aria-labelledby="exploreTitle"><div class="ts3-section-heading"><div><span class="ts3-kicker">01 / ${c.explore}</span><h2 id="exploreTitle">${c.explore}</h2><p>${c.exploreText}</p></div></div><div class="ts3-data-links">${link('buildings/',c.base,c.baseText)}${link('database/',t.database,c.material)}${link('behemoths/',c.behemoth,c.behemothText)}</div></section><section class="ts3-planning" aria-labelledby="planTitle"><div class="ts3-section-heading"><div><span class="ts3-kicker">02 / ${c.plan}</span><h2 id="planTitle">${c.plan}</h2><p>${c.planText}</p></div><a href="${base}tools/">${c.browse} ↗</a></div><div class="ts3-plan-links">${link('database/gear-exp/',c.equipment)}${link('database/skill-book/',c.skill)}${link('database/exclusive-gear/',c.exclusive)}${link('tools/speedup-calculator/',c.speed)}</div></section></div>
 <section class="ts3-home-roster" id="discovery-21" aria-labelledby="rosterTitle"><div class="ts3-section-heading"><div><span class="ts3-kicker">03 / ${t.heroes}</span><h2 id="rosterTitle">${c.roster}</h2><p>${c.rosterText}</p></div><a href="${base}heroes/">${c.browse} ↗</a></div><div class="ts3-roster">${roster}</div></section>
 <section class="ts3-home-pets"><a class="ts3-pet-art" href="${base}database/pet-system/"><img src="/img/pets/official-lineup.jpg" alt="${c.pets}" width="1080" height="1080" loading="lazy" decoding="async"></a><div><span class="ts3-kicker">04 / ${c.pets}</span><h2>${c.pets}</h2><p>${c.petsText}</p><a class="ts3-text-link" href="${base}database/pet-system/">${c.browse} ↗</a></div></section>
 <div class="ts3-home-editorial"><section><div class="ts3-section-heading"><h2>${c.updates}</h2><a href="${base}updates/">${c.browse} ↗</a></div><a class="ts3-patch" href="${base}updates/"><time datetime="2026-09-28">2026.09.28</time><strong>v2.6.200</strong><p>${c.patch}</p></a><div class="ts3-editorial-links">${link('guides/',c.guides,c.guidesText)}${link('seasons/',c.season,c.seasonText)}${link('events/',t.events)}${link('top-up/',t.topup)}</div></section><section class="ts3-codes" aria-labelledby="codesTitle"><h2 id="codesTitle">${c.codes}</h2><p>${c.codeNote}</p><div class="gift-codes"><code>TS777</code><code>TS888</code><code>TS999</code></div><a class="ts3-text-link" href="${base}codes/">${c.browse} ↗</a></section></div><p class="home-about">${c.about}</p>`;
 if(slot)main.append(slot);
 d.querySelectorAll('link[rel=preload][as=image]').forEach(n=>n.remove());d.head.append(node(d,'<link rel="preload" as="image" href="/img/banners/official-world.webp" fetchpriority="high">'));
 d.querySelector('title').textContent=c.latestTitle;d.querySelector('meta[name=description]').content=c.intro;
 for(const attr of ['property="og:title"','name="twitter:title"']){const n=d.querySelector('meta['+attr+']');if(n)n.content=c.latestTitle;}
 for(const attr of ['property="og:description"','name="twitter:description"']){const n=d.querySelector('meta['+attr+']');if(n)n.content=c.intro;}
 for(const attr of ['property="og:image"','name="twitter:image"']){const n=d.querySelector('meta['+attr+']');if(n)n.content='https://tilessurvive.net/img/banners/official-world.webp';}
 for(const [property,value]of [['og:image:width','1920'],['og:image:height','1080']])d.querySelector(`meta[property="${property}"]`)?.setAttribute('content',value);
}
for(const p of pages){const{d,lang,route}=p,c=C[lang],t=I[lang],main=d.querySelector('main');if(!main)continue;
 d.documentElement.classList.add('ts3'); d.documentElement.style.removeProperty('scroll-behavior');
 d.querySelectorAll('[data-product-30]').forEach(n=>n.remove());
 const slug=route.replace('/'+lang+'/',''),isHome=!slug;if(isHome)home(p);
 if(lang==='ko')for(const label of main.querySelectorAll('a,h2'))if(label.textContent.trim()==='성장 데이터 확장')label.textContent='성장 데이터';
 if(slug==='codes/'){
  main.classList.add('container','ts3-coupon-page');
  const sub=main.querySelector('.title #h2');if(sub?.tagName==='H2'){const text=d.createElement('p');text.id='h2';text.textContent=sub.textContent;sub.replaceWith(text);}
  const intro=main.querySelector('.introBlock');if(intro)intro.innerHTML=`<p>${c.codeNote}</p>`;
  if(!main.querySelector('.ts3-region-times')){
   const regions=[...main.querySelectorAll('section.region')];if(regions.length){const details=d.createElement('details');details.className='ts3-region-times';const summary=d.createElement('summary');summary.textContent={ko:'지역별 만료·게시 시간',en:'Expiry & publication times by region',ja:'地域別の有効期限・公開時刻',ru:'Время окончания и публикации по регионам','zh-tw':'各地區到期與發布時間'}[lang];details.append(summary);const grid=d.createElement('div');grid.className='ts3-region-grid';regions[0].before(details);regions.forEach(r=>grid.append(r));details.append(grid);}
  }
  main.querySelectorAll('.midBanner:empty,.adTriggerWrap:empty').forEach(n=>n.remove());
 }
 d.querySelector('meta[name=theme-color]')?.setAttribute('content','#17362c');
 const header=d.querySelector('.ts-header');header?.classList.add('ts3-header');
 const form=header?.querySelector('form');if(form){form.classList.add('ts3-search-form');form.querySelector('input').placeholder=c.searchHint;}
 header?.querySelectorAll('details').forEach((n,i)=>n.classList.add(i===0?'ts3-menu':'ts3-language'));
 const active=slug.startsWith('database/pet-system/')?'database/pet-system/':slug.startsWith('behemoths/')?'database/':slug.split('/')[0]+'/';
 header?.querySelectorAll('nav a:not([hreflang])').forEach(a=>{if(a.getAttribute('href')==='/'+lang+'/'+active)a.setAttribute('aria-current','page');});
 // Static section index: information remains accessible before JavaScript loads.
 const editorial=/^(guides|seasons|events|updates|top-up|about|privacy|terms|affiliate-disclosure|contact)\//.test(slug);
 if(editorial){main.classList.add('ts3-editorial');const headings=[...main.querySelectorAll('h2')].filter(h=>h.textContent.trim()&&!h.closest('[data-lootbar-slot],.ts-context-links,[data-platform-related]'));
  if(headings.length>2){let i=0;headings.forEach(h=>{if(!h.id)h.id='article-section-'+(++i);});const nav=node(d,`<nav class="ts3-contents" data-product-30 aria-label="${c.onPage}"><strong>${c.onPage}</strong>${headings.map(h=>`<a href="${route}#${esc(h.id)}">${esc(h.textContent.trim())}</a>`).join('')}</nav>`);const hero=main.querySelector('.hero-card,.page-hero,.hero,.page-header,.ts-page-heading');if(hero)hero.after(nav);else main.querySelector('h1')?.parentElement.after(nav);}
 }
 if(slug==='updates/'){
 const list=main.querySelector('.update-list');if(list&&!list.querySelector('[data-patch-26200]'))list.prepend(node(d,`<article class="update-item" data-patch-26200><time datetime="2026-09-28">2026-09-28</time><div><h3>v2.6.200</h3><p>${c.patch}</p></div><a href="https://tilesurvivegame.com/ko/blog/1193" target="_blank" rel="noopener noreferrer">Tiles Survive ↗</a></article>`));
 const old=main.querySelector('.update-list')?.previousElementSibling?.querySelector('p');if(old)old.textContent=c.updates;
 }
 // Reserved inventory is inactive until real advertising configuration is provided.
 if(/^guides\//.test(slug)&&slug.split('/').length>2&&!main.querySelector('[data-lootbar-slot]'))main.append(node(d,`<aside class="ts3-ad-slot" data-product-30 data-ad-slot="article-end" data-ad-state="inactive" hidden aria-label="${c.ad}"><span>${c.ad}</span></aside>`));
 const h1=main.querySelector('h1');if(h1&&!isHome&&!main.querySelector('.breadcrumb,.breadcrumbs,.ts3-breadcrumb'))main.prepend(node(d,`<nav class="ts3-breadcrumb" data-product-30 aria-label="${c.homeLabel}"><a href="/${lang}/">${c.homeLabel}</a><span aria-hidden="true">/</span><span>${esc(h1.textContent.trim())}</span></nav>`));
 // Real page identity only; no fabricated ratings, prices, or review schema.
 if(!/noindex/.test(d.querySelector('meta[name=robots]')?.content||'')){const canonical=d.querySelector('link[rel=canonical]')?.href;const schema={'@context':'https://schema.org','@type':'WebPage','@id':canonical+'#webpage',url:canonical,name:d.querySelector('title')?.textContent,inLanguage:lang,description:d.querySelector('meta[name=description]')?.content,isPartOf:{'@type':'WebSite',name:'TilesSurvive.net',url:'https://tilessurvive.net/'}};d.head.append(node(d,`<script type="application/ld+json" data-product-30>${JSON.stringify(schema).replaceAll('<','\\u003c')}</script>`));}
 d.head.append(node(d,'<link data-product-30 rel="stylesheet" href="/css/product-30.css?v=1">'));
 d.body.append(node(d,`<script data-product-30 type="application/json" id="ts3-copy">${JSON.stringify({allResults:c.allResults,searchHint:c.searchHint,backTop:c.backTop}).replaceAll('<','\\u003c')}</script><script data-product-30 src="/js/product-30.js?v=1" defer></script>`));
 fs.writeFileSync(p.file,('<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n').replace(/[ \t]+$/gm,''));
}
console.log('Product 3.0: shared shell, home, editorial navigation, search and inactive ad inventory on '+pages.length+' pages.');
