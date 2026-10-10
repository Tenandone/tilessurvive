/* Build only curated, screen-scoped facts. Raw installation tables never enter this builder. */
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),D=require('../data/foundation-40/explorer.json'),C=require('../data/foundation-40/explorer-copy');
const M=require('../js/foundation-40-math'),langs=['ko','en','ja','ru','zh-tw'];
const imageAssets=require('../data/foundation-40/image-assets.json').assets;
const approvedItemIcons=new Set(['hero-skill-book','arms-medal','food-10k','wood-10k','metal-10k','speedup-5m','food-100k','undine-gear-fragment']);
const itemIcons=new Map(imageAssets.filter(asset=>asset.kind==='item'&&approvedItemIcons.has(asset.entity)).map(asset=>[asset.entity,asset]));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const node=(d,s)=>{const t=d.createElement('template');t.innerHTML=s;return t.content;};
const assert=(v,m)=>{if(!v)throw Error(m)};
assert(itemIcons.size===approvedItemIcons.size,'Missing approved item icon');
for(const [id,asset]of itemIcons)assert(asset.id==='item:'+id&&asset.src==='/img/game-40/items/'+id+'.webp'&&Number.isInteger(asset.width)&&asset.width>0&&Number.isInteger(asset.height)&&asset.height>0&&fs.existsSync(path.join(root,asset.src)),'Invalid approved item icon '+id);
const {validateItemIcons}=require('./lib/item-icon-assets-41');
for(const [id,asset]of validateItemIcons(require('../data/foundation-40/item-icons-41.json'))){assert(!itemIcons.has(id),'Duplicate item icon '+id);itemIcons.set(id,asset);}
const itemIcon=id=>{const asset=itemIcons.get(id);return asset?`<img class="ts40-item-icon" src="${asset.src}" width="${asset.width}" height="${asset.height}" alt="" aria-hidden="true" loading="lazy" decoding="async">`:'';};
const itemUseText=require('./lib/item-use-text-40');
assert(D.items.length===new Set(D.items.map(i=>i.id)).size,'Duplicate items');
const ids=new Set(D.items.map(i=>i.id));
const officialById=new Map(D.officialSources.map(source=>[source.id,source]));
assert(officialById.size===D.officialSources.length,'Duplicate official source');
for(const source of officialById.values()){const url=new URL(source.url);assert(url.protocol==='https:'&&['tilesurvivegame.com','funplus.com'].includes(url.hostname)&&/^[a-f0-9]{64}$/.test(source.sha256),'Invalid official source');}
for(const source of D.itemSources)assert(source.sourceIds.length&&source.sourceIds.every(id=>officialById.has(id)),'Unknown item relation source');
for(const item of D.items)if(item.useSourceIds)assert(item.useSourceIds.every(id=>officialById.has(id)),'Unknown item use source');
for(const benefit of D.packageBenefits)assert(benefit.sourceIds.every(id=>officialById.has(id)),'Unknown package benefit source');
function citation(sourceIds,lang){return `<small class="ts40-source">(${sourceIds.map(id=>{const source=officialById.get(id);assert(source,'Unknown citation '+id);return `<a href="${esc(source.url)}" data-explorer-official-source="${esc(id)}">${esc(source.gameVersion?'v'+source.gameVersion:C[lang].sourceNotice)}</a>`;}).join(' · ')})</small>`;}
for(const stage of D.event.stages)for(const r of stage.rewards)assert(ids.has(r.item)&&Number.isSafeInteger(r.quantity)&&r.quantity>0,'Invalid reward');
assert(D.event.troopPoints.length===10&&D.event.promotion==='difference-between-tiers','Unknown scoring semantics');
const rewardTotals=M.rewardsAt(D.event.stages,300000);
assert(Array.isArray(D.packages)&&D.packages.length===6,'Expected six screen-scoped diamond offers');
assert(D.packages.length===new Set(D.packages.map(p=>p.id)).size,'Duplicate package IDs');
for(const offer of D.packages){M.packageSummary(offer);assert(offer.currency===D.packageScope.currency&&['one-time-purchase','not-shown'].includes(offer.condition),'Unknown package currency or condition');}
for(const offer of D.offers)assert(ids.has(offer.item)&&Number.isSafeInteger(offer.cost)&&offer.cost>=0&&offer.currency==='diamonds'&&(offer.quantity===null||(Number.isSafeInteger(offer.quantity)&&offer.quantity>0)),'Invalid observed VIP offer');
if(D.vipCatalog){assert(D.vipCatalog.offerIds.length===new Set(D.vipCatalog.offerIds).size,'Duplicate observed VIP offer');for(const id of D.vipCatalog.offerIds)assert(D.offers.some(o=>o.id===id),'Unknown VIP catalog offer');}
let changes=0;
function save(file,text){if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===text)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);changes++;}
function stabilizeEventHubAnchor(d,lang){
 // The legacy expansion recreates this heading without an ID. Its later TOC
 // allocator restarts at 1 and can reuse the preserved first section's ID.
 // Give the recreated heading a deterministic anchor without renaming either title.
 const heading=d.querySelector('#database-links-22 > h2');if(!heading)return;
 const stable='database-links-22-heading',existing=d.getElementById(stable);
 assert(!existing||existing===heading,'Growth heading anchor already in use: '+lang);
 heading.id=stable;
 for(const a of d.querySelectorAll('.ts3-contents a[href]')){
   if(a.textContent.trim()!==heading.textContent.trim())continue;
   const target=new URL(a.getAttribute('href'),'https://tilessurvive.net/'+lang+'/events/');
   if(target.pathname==='/'+lang+'/events/')a.href='/'+lang+'/events/#'+stable;
 }
}
function table(head,rows,cls=''){return `<div class="ts40-scroll" tabindex="0"><table class="ts40-table ${cls}"><thead><tr>${head.map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>'<tr>'+row.map((x,i)=>i===0?`<th scope="row">${x}</th>`:`<td>${x}</td>`).join('')+'</tr>').join('')}</tbody></table></div>`;}
function eventContent(lang){
 const t=C[lang],num=n=>new Intl.NumberFormat(lang).format(n),itemLink=id=>`<a href="/${lang}/database/items/#${id}">${esc(t[id])}</a>`;
 const options=Array.from({length:10},(_,i)=>`<option value="${i+1}"${i===9?' selected':''}>${i+1}</option>`).join('');
 const startOptions='<option value="0">'+t.fresh+'</option>'+Array.from({length:9},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
 const field=(key,value)=>`<label>${t[key]}<input name="${key}" type="number" inputmode="numeric" min="0" max="1000000000" step="1" value="${value}" required></label>`;
 const rows=D.event.troopPoints.map((score,i)=>[esc(t.trainOne.replace('{n}',i+1)),num(score)]);rows.push([esc(t.oneMinute),num(D.event.pointsPerSpeedupMinute)]);
 const rewardRows=D.event.stages[0].rewards.map(r=>[itemLink(r.item),...D.event.stages.map(s=>num(s.rewards.find(x=>x.item===r.item)?.quantity||0)),num(rewardTotals[r.item])]);
 return `<section class="hero-card ts40-intro"><span class="eyebrow">TILES SURVIVE · 2.6.200</span><h1>${t.eventTitle}</h1><p>${t.eventIntro}</p><p class="ts40-original">${t.original}: <span lang="ko">${D.event.originalNameKo}</span></p></section><p class="ts40-context">${t.condition}</p>
 <section class="ts40-panel" aria-labelledby="plan-heading"><h2 id="plan-heading">${t.planner}</h2><form data-training-plan class="ts40-controls" hidden><label>${t.from}<select name="from">${startOptions}</select></label><label>${t.tier}<select name="tier">${options}</select></label>${field('amount',0)}${field('minutes',0)}${field('current',0)}<label>${t.target}<select name="target">${D.event.stages.map(s=>`<option value="${s.points}">${num(s.points)}</option>`).join('')}</select></label></form><div class="ts40-result" data-plan-result role="status" aria-live="polite" aria-atomic="true"></div><p>${t.alternatives}</p></section>
 <section class="ts40-panel" aria-labelledby="points-heading"><h2 id="points-heading">${t.points}</h2>${table([t.action,t.score],rows)}</section>
 <section class="ts40-panel" aria-labelledby="rewards-heading"><h2 id="rewards-heading">${t.rewards}</h2>${table([t.item,...D.event.stages.map(s=>num(s.points)),t.cumulative],rewardRows,'ts40-rewards')}</section>
 <section class="ts40-panel" aria-labelledby="rules-heading"><h2 id="rules-heading">${t.rules}</h2><p>${t.rulesText}</p><p>${t.claimRule}</p></section><nav class="ts40-links" aria-label="${t.related}"><a href="/${lang}/database/items/">${t.itemTitle} →</a><a href="/${lang}/database/skill-book/">${t['hero-skill-book']} →</a></nav>`;
}
function packageContent(lang){
 const t=C[lang],num=n=>new Intl.NumberFormat(lang).format(n);
 const label=offer=>num(offer.baseDiamonds)+(offer.bonusDiamonds?' + '+num(offer.bonusDiamonds):'')+' '+t.diamonds;
 const condition=offer=>offer.condition==='one-time-purchase'?t.packageOneTime:t.packageNoCondition;
 const scope=t.packageScope.replace('{version}',D.packageScope.gameVersion).replace('{date}',D.packageScope.observedAt);
 const rows=D.packages.map(offer=>{const total=M.packageSummary(offer).totalDiamonds;return [esc(label(offer)),num(offer.baseDiamonds),offer.bonusDisplay==='shown'?num(offer.bonusDiamonds):esc(t.packageNoBonus),num(total),num(offer.coinCost),esc(condition(offer))];});
 const options=selected=>D.packages.map(offer=>`<option value="${esc(offer.id)}"${offer.id===selected?' selected':''}>${esc(label(offer))} · ${num(offer.coinCost)} ${esc(t.packageCost)}</option>`).join('');
 const benefits=D.packageBenefits.map(benefit=>`<div data-package-benefit="${esc(benefit.id)}"><h3>${t.monthlyPassTitle}</h3><p>${esc(t[benefit.copyKey].replace('{multiplier}',benefit.dailyFreeHealLimitMultiplier))} ${citation(benefit.sourceIds,lang)}</p></div>`).join('');
 return `<section class="ts40-panel" aria-labelledby="packages-heading"><h2 id="packages-heading">${t.packageTitle}</h2><p>${t.packageIntro}</p><p class="ts40-context">${esc(scope)}</p>${table([t.packageOffer,t.packageBase,t.packageBonus,t.packageTotal,esc(t.packageCost),t.packageCondition],rows,'ts40-rewards')}<p class="ts40-source">${t.packageUnits}</p><h3 id="package-compare-heading">${t.packageCompare}</h3><form data-package-compare class="ts40-controls ts40-item-body" aria-labelledby="package-compare-heading" hidden><label>${t.packageFirst}<select name="first">${options(D.packages[0].id)}</select></label><label>${t.packageSecond}<select name="second">${options(D.packages[3].id)}</select></label></form><p>${t.packageRatio}</p><div data-package-result class="ts40-result ts40-item-body" role="status" aria-live="polite" aria-atomic="true"></div><p class="ts40-source">${t.packageCompareNote}</p>${benefits}</section>`;
}
function vipContent(lang){
 if(!D.vipCatalog)return '';
 const t=C[lang],num=n=>new Intl.NumberFormat(lang).format(n);
 const rows=D.vipCatalog.offerIds.map(id=>{const offer=D.offers.find(o=>o.id===id);return [`<a href="#${esc(offer.item)}">${esc(t[offer.item])}</a>`,offer.cost===0?esc(t.vipFree):`${num(offer.cost)} ${esc(t.diamonds)}`];});
 return `<section class="ts40-panel" aria-labelledby="vip-offers-heading"><h2 id="vip-offers-heading">${esc(t.vipCatalogTitle)}</h2><p class="ts40-context">${esc(t.shopCondition)}</p>${table([t.item,t.vipDisplayedPrice],rows)}</section>`;
}
function itemContent(lang){
 const t=C[lang],num=n=>new Intl.NumberFormat(lang).format(n);
 const source=item=>item.sources.map(id=>{
   if(id==='arms-race-training')return `<li><a href="/${lang}/events/arms-race/#rewards-heading">${t.eventTitle}</a><br><span class="ts40-source">${D.event.stages.map(s=>num(s.points)+' → '+num(s.rewards.find(r=>r.item===item.id)?.quantity||0)).join(' · ')}</span></li>`;
   if(id==='hero-equipment-shop')return `<li>${t.equipmentShop}<br><a href="/${lang}/database/exclusive-gear/">${t.open} →</a></li>`;
   const relation=D.itemSources.find(source=>source.id===id);
   if(relation)return `<li>${esc(t[relation.copyKey])} ${citation(relation.sourceIds,lang)}</li>`;
   const offer=D.offers.find(o=>o.id===id);assert(offer,'Unknown source '+id);
   const price=offer.cost===0?esc(t.vipFree):`${num(offer.cost)} ${t.diamonds}`;
   return `<li>${t.vip} · ${price}${offer.quantity===null?'':' / '+num(offer.quantity)}<p class="ts40-source">${t.shopCondition}</p></li>`;
 }).join('');
 return `<section class="hero-card ts40-intro"><span class="eyebrow">TILES SURVIVE · ITEMS</span><h1>${t.itemTitle}</h1><p>${t.itemIntro}</p></section><form data-item-filter class="ts40-filters" hidden role="search"><label>${t.search}<input name="query" type="search" autocomplete="off"></label><label>${t.category}<select name="category"><option value="">${t.all}</option>${['growth','resource','speedup','event'].map(v=>`<option value="${v}">${t[v]}</option>`).join('')}</select></label></form><p data-item-count role="status" aria-live="polite"></p><p class="ts40-empty" data-item-empty hidden>${t.empty}</p>
 <h2 id="items-heading">${t.itemList}</h2>${D.items.map(item=>`<details class="ts40-item" data-item-entry data-search-aliases="${esc((item.searchAliases||[]).join(' '))}" data-category="${item.category}" id="${item.id}"><summary><span class="ts40-item-label">${itemIcon(item.id)}<span>${esc(t[item.id])}${item.nameOriginal?(lang===item.sourceLocale?'':`<br><span lang="${item.sourceLocale}" class="ts40-original">${esc(item.nameOriginal)}</span>`):(lang==='ko'?'':`<br><span lang="ko" class="ts40-original">${esc(item.nameKo)}</span>`)}</span></span></summary><div class="ts40-item-body"><div><h3>${t.sources}</h3><ul>${source(item)}</ul></div><div><h3>${t.uses}</h3>${item.descriptions?.[lang]?`<p>${esc(item.descriptions[lang])}</p>`:''}${!item.descriptions?.[lang]||item.useSourceIds?`<p>${esc(itemUseText(item,lang))} ${item.useSourceIds?citation(item.useSourceIds,lang):''}</p>`:''}${item.route?`<a href="/${lang}/${item.route}">${t.open} →</a>`:''}</div></div></details>`).join('')}
 <p class="ts40-context">${t.itemRewardScope} ${t.condition}</p><p data-gear-crate-tip>${t.gearCrateTip} ${citation(D.itemRules.gearCrate.sourceIds,lang)}</p>${vipContent(lang)}${packageContent(lang)}<nav class="ts40-links" aria-label="${t.related}"><a href="/${lang}/events/arms-race/">${t.eventTitle} →</a><a href="/${lang}/database/pet-system/">${C[lang].growth} →</a></nav>`;
}
function page(lang,slug,title,description,content){
 const d=parseHTML(fs.readFileSync(path.join(root,lang,'events/index.html'),'utf8')).document;
 const url='https://tilessurvive.net/'+lang+'/'+slug+'/',route='/'+lang+'/'+slug+'/';
 d.documentElement.setAttribute('data-section',slug.split('/')[0]);
 d.querySelector('title').textContent=title+' | TilesSurvive.net';
 for(const name of ['meta[name="description"]','meta[property="og:description"]'])d.querySelector(name)?.setAttribute('content',description);
 d.querySelector('link[rel="canonical"]').href=url;d.querySelector('meta[property="og:url"]')?.setAttribute('content',url);d.querySelector('meta[property="og:title"]')?.setAttribute('content',title);
 for(const alt of d.querySelectorAll('link[hreflang]')){const l=alt.hreflang==='x-default'?'en':alt.hreflang;alt.href='https://tilessurvive.net/'+l+'/'+slug+'/';}
 for(const a of d.querySelectorAll('.ts3-language a'))a.href='/'+a.getAttribute('hreflang')+'/'+slug+'/';
 for(const a of d.querySelectorAll('header nav:not(.ts3-language nav) a[aria-current]'))a.removeAttribute('aria-current');
 for(const a of d.querySelectorAll('header nav a[href]'))if(a.href==='/'+lang+'/'+slug.split('/')[0]+'/')a.setAttribute('aria-current','page');
 d.querySelector('.ts-skip').href=route+'#main';
 const main=d.querySelector('main');main.className='container page-main ts3-data-page ts3-editorial ts40-page';main.innerHTML=content;
 d.querySelectorAll('script[type="application/ld+json"]').forEach(n=>n.remove());
 d.head.append(node(d,`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:title,url,inLanguage:lang,description,isPartOf:{'@type':'WebSite',name:'TilesSurvive.net',url:'https://tilessurvive.net/'}}).replaceAll('<','\\u003c')}</script><link rel="stylesheet" href="/css/foundation-40.css?v=1">`));
 d.body.append(node(d,`<script type="application/json" id="foundation-data">${JSON.stringify({event:D.event,copy:C[lang],packages:slug==='database/items'?D.packages:undefined}).replaceAll('<','\\u003c')}</script><script src="/js/foundation-40-math.js?v=1" defer></script><script src="/js/foundation-40.js?v=3" defer></script>`));
 save(path.join(root,lang,slug,'index.html'),'<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n');
}
const itemsOnly=process.argv.includes('--items-only');
for(const lang of langs){
 const t=C[lang];if(!itemsOnly)page(lang,'events/arms-race',t.eventTitle,t.eventIntro,eventContent(lang));page(lang,'database/items',t.itemTitle,t.itemIntro,itemContent(lang));
 if(itemsOnly)continue;
 // Existing URL and menu structures remain intact; contextual links are local to their hubs.
 for(const section of ['events','database','tools']){
   const file=path.join(root,lang,section,'index.html'),d=parseHTML(fs.readFileSync(file,'utf8')).document;
   // The product builder may already have linked this heading from the page TOC.
   // Preserve its anchor when replacing the entry, including hubs affected by an older run.
   let entryHeadingId=d.querySelector('[data-foundation-entry] h2')?.id||'';
   if(section==='events'&&!entryHeadingId){
     const tocLink=[...d.querySelectorAll('.ts3-contents a[href]')].find(a=>a.textContent.trim()===t.related);
     if(tocLink){
       const target=new URL(tocLink.getAttribute('href'),'https://tilessurvive.net/'+lang+'/events/');
       if(target.pathname==='/'+lang+'/events/'&&target.hash){
         const candidate=decodeURIComponent(target.hash.slice(1));
         assert(!d.getElementById(candidate),'Foundation TOC anchor is already used: '+lang+'/'+candidate);
         entryHeadingId=candidate;
       }
     }
   }
   d.querySelectorAll('[data-foundation-entry]').forEach(n=>n.remove());
   const links=`<section data-foundation-entry class="ts-database-22"><h2${entryHeadingId?' id="'+esc(entryHeadingId)+'"':''}>${t.related}</h2><div class="hero-actions"><a class="btn" href="/${lang}/events/arms-race/">${t.eventTitle} →</a><a class="btn" href="/${lang}/database/items/">${t.itemTitle} →</a></div></section>`;
   const main=d.querySelector('main'),references=main.querySelector('details.ts301-references');
   if(references)references.before(node(d,links));else main.append(node(d,links));
   if(section==='events')stabilizeEventHubAnchor(d,lang);
   save(file,'<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n');
 }
}
// Only add the ten intentional routes. Existing sitemap entries are preserved byte-for-byte.
const sitemapFile=path.join(root,'sitemap.xml');let xml=fs.readFileSync(sitemapFile,'utf8');
for(const lang of langs)for(const slug of ['events/arms-race','database/items']){const url='https://tilessurvive.net/'+lang+'/'+slug+'/';if(!xml.includes('<loc>'+url+'</loc>'))xml=xml.replace('</urlset>',`  <url><loc>${url}</loc></url>\n</urlset>`);}
save(sitemapFile,xml);
console.log(JSON.stringify({foundationPages:itemsOnly?5:10,items:D.items.length,packages:D.packages.length,trainingPointRows:11,rewardRows:6,changes}));
