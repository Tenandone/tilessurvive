'use strict';
// Test-only exact 5.0 presentation projection. No game cells/formula payloads are discarded.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),origin='https://tilessurvive.net';
const langs=['ko','en','ja','ru','zh-tw'];
const offerCopy={ko:['LootBar 할인 충전 가능 여부 확인','제휴 링크 · 상품·지역별 적용 조건을 확인하세요.'],en:['Check top-up offers on LootBar','Affiliate link · Check the conditions for your product and region.'],ja:['LootBarのチャージ特典を確認','アフィリエイトリンク・商品と地域ごとの適用条件をご確認ください。'],ru:['Проверить предложения пополнения на LootBar','Партнёрская ссылка · Уточните условия для товара и региона.'],'zh-tw':['查看 LootBar 儲值優惠','聯盟行銷連結・請確認商品與地區適用條件。'],de:['Aufladeangebote bei LootBar prüfen','Partnerlink · Prüfe die Bedingungen für dein Produkt und deine Region.']};
const runtime=new Set(['platform-i18n.js','layout.js','platform-affiliate.js','platform.js','platform-search.js','site-search.js','product-30.js','data-workbench-30.js','event-helper.js','tools-speedup-calculator.js','hero-skill-levels-40.js','sea-hero-growth-40.js','database-22.js','foundation-40.js','daily-missions-40.js','pet-growth-40.js']);
function clean(s){return s.replace(/\s+/g,' ').trim();}
function normalizeDocument(d,file=''){
 require('./refinement-51-test-allowances').restore(d,file);
 require('./pet-skill-levels-test-allowances').restoreLegacyDocument(d,file);
 const canonical=d.querySelector('link[rel=canonical]')?.href,route=canonical?new URL(canonical).pathname:'/';
 const lang=(file.split('/')[0]||route.split('/')[1]||d.documentElement.lang).toLowerCase();
 const growth=d.querySelector('[data-growth-50],[data-growth-research-50]');
 if(growth){require('./product-50-test-allowances').reviewedTables(d,lang,route);d.querySelectorAll('[data-growth-50],[data-growth-research-50]').forEach(n=>n.remove());}
 for(const n of d.querySelectorAll('[data-growth50-asset]')){assert(['LINK','SCRIPT'].includes(n.tagName));assert.equal(n.getAttribute(n.tagName==='LINK'?'href':'src'),n.tagName==='LINK'?'/css/growth-50.css?v=1':'/js/growth-50.js?v=1');n.remove();}
 for(const n of d.querySelectorAll('[data-growth-exp-condition-50]')){assert.equal(route,`/${lang}/database/gear-exp/`);assert.equal(n.textContent,require('../data/product-50/growth-copy')[lang].gearExpCondition);n.remove();}
 for(const n of d.querySelectorAll('[data-package-offer-50]')){assert.equal(route,`/${lang}/database/items/`);const a=n.querySelector('a');assert.equal(a.href,require('../config/affiliate.json').tilesSurvive.url);assert.equal(a.target,'_blank');assert.equal(a.rel,'sponsored nofollow noopener');assert.equal(a.textContent,offerCopy[lang][0]);assert.equal(n.querySelector('small')?.textContent,offerCopy[lang][1]);assert.equal(n.children.length,2);assert.equal(n.className,'ts50-package-offer');assert.equal(a.dataset.affiliatePlacement,'package_comparison');assert.equal(a.dataset.affiliateCampaign,'lootbar');assert.equal(n.querySelectorAll('a').length,1);n.remove();}
 for(const n of d.querySelectorAll('link[data-editorial-50-style]')){assert(['/css/hub-pages.css','/css/foundation-40.css?v=3'].includes(n.getAttribute('href')));assert.equal(n.rel,'stylesheet');if(route.endsWith('/events/daily-missions/')&&n.getAttribute('href').startsWith('/css/foundation-40.css')){n.setAttribute('href','/css/foundation-40.css?v=1');n.removeAttribute('data-editorial-50-style');}else n.remove();}
 for(const n of d.querySelectorAll('.ts3-catalog-data')){const a=n.querySelector('a');if(a?.getAttribute('href')===`/${lang}/buildings/lab/#ts3-data-table-0`){assert.equal(route,`/${lang}/buildings/`);assert.equal(n.querySelector('span')?.textContent,{ko:'5 행',en:'5 rows',ja:'5 行',ru:'5 строк','zh-tw':'5 列'}[lang]);assert.equal(n.children.length,2);n.remove();}}
 for(const n of d.querySelectorAll('link[href="/css/product-50.css"]')){assert.equal(n.rel,'stylesheet');n.remove();}
 for(const n of d.querySelectorAll('script[src]')){const u=new URL(n.getAttribute('src'),origin);if(u.origin===origin&&runtime.has(path.posix.basename(u.pathname))){u.searchParams.delete('v');n.setAttribute('src',u.pathname+u.search);}}
 // The pre-skill-level 5.0 pet hub already includes this identical runtime twice.
 // Keep the old one-script fixture comparable; the new preservation test pins
 // the complete current production DOM independently.
 if(route===`/${lang}/database/pet-system/`){const scripts=[...d.head.querySelectorAll('script[src="/js/database-22.js"]')];assert(scripts.length<=2);if(scripts.length===2){assert.equal(scripts[0].outerHTML,scripts[1].outerHTML);scripts[1].remove();}}
 for(const b of d.querySelectorAll('.ts-header .ts-brand,header.site-header a.brand'))b.textContent='TilesSurvive';
 for(const n of d.querySelectorAll('main img')){
  if(n.hasAttribute('data-image-role-50')){const expected=n.closest('.ts3-character-art,.ts3-pet-portrait')?'portrait':n.closest('.ts3-skill-selector,.ts-skill summary')?'skill':n.closest('table')&&Number(n.getAttribute('width'))<=256?'table-icon':null;assert.equal(n.getAttribute('data-image-role-50'),expected);n.removeAttribute('data-image-role-50');}
  if(n.hasAttribute('decoding')){assert.equal(n.getAttribute('decoding'),'async');n.removeAttribute('decoding');}
 }
 for(const nav of d.querySelectorAll('.ts3-language nav,.ts-header nav')){
  const historicalCnay=file==='zh-tw/heroes/cnay/index.html'&&crypto.createHash('sha256').update(nav.outerHTML).digest('hex')==='400fb97798afad31e2ac297a84ef26353b361643fb18a191e2a1407a14826ee5';
  const links=[...nav.querySelectorAll('a[lang],a[hreflang]')];if(!links.length)continue;
  for(const a of nav.querySelectorAll('a:not([lang]):not([hreflang])')){if(a.getAttribute('href')===`/${lang}/database/pet-system/`&&route===`/${lang}/heroes/`)a.remove();}
  for(const a of links){const l=a.getAttribute('lang')||a.getAttribute('hreflang');if(/noindex/.test(d.querySelector('meta[name=robots]')?.content||'')||/^(ko|en|ja|ru|zh-tw)\/event-helper\/index.html$/.test(file)){const aliasHref=href=>href.replace(/\/heroes\/(tazan|tarzan)\//,'/heroes/'+(['en','de'].includes(l)?'tazan':'tarzan')+'/');const target=aliasHref(route.replace(/^\/(ko|en|ja|ru|zh-tw|de)\//,'/'+l+'/'));const original='/'+file.replace(/index\.html$/,'').replace(/^(ko|en|ja|ru|zh-tw|de)\//,l+'/');assert([target,aliasHref(original),...(historicalCnay?['/'+l+'/']:[])].includes(aliasHref(a.getAttribute('href'))),'Exact alias counterpart '+file+' '+a.getAttribute('href'));a.setAttribute('href',target);}assert([...langs,'de'].includes(l));if(l==='de')a.remove();else {a.removeAttribute('lang');a.setAttribute('hreflang',l);}}
 }
 const alternates=[...d.querySelectorAll('link[hreflang]')];
 const alias=/noindex/.test(d.querySelector('meta[name=robots]')?.content||'');
 for(const a of alternates)if(alias||a.hreflang==='de')a.remove();
 if(route.endsWith('/events/daily-missions/')){const css=d.querySelector('link[href="/css/foundation-40.css?v=1"]');if(css)d.head.append(css);}
 // Finalizer reserializes alternate elements in a fixed order; compare exact values, not attribute insertion order.
 for(const a of [...d.querySelectorAll('link[hreflang]')].sort((a,b)=>a.hreflang.localeCompare(b.hreflang)))d.head.append(a);
 // Generated table IDs may shift when the exact added growth blocks precede legacy tables.
 const tableIDs=new Map([...d.querySelectorAll('table[id^="ts3-data-table-"]')].map((t,i)=>[t.id,'ts3-data-table-'+i]));
 for(const n of d.querySelectorAll('[id^="ts3-table-controls-"],[aria-controls],[aria-describedby]'))for(const attr of ['id','aria-controls','aria-describedby']){const value=n.getAttribute(attr);if(!value)continue;n.setAttribute(attr,value.split(' ').map(id=>{if(tableIDs.has(id))return tableIDs.get(id);const match=id.match(/^ts3-table-controls-(\d+)$/);return match&&tableIDs.has('ts3-data-table-'+match[1])?'ts3-table-controls-'+tableIDs.get('ts3-data-table-'+match[1]).split('-').at(-1):id;}).join(' '));}
 for(const t of d.querySelectorAll('table[id^="ts3-data-table-"]'))t.id=tableIDs.get(t.id);
 for(const n of d.querySelectorAll('[data-growth-table],a[href]')){if(n.hasAttribute('data-growth-table')){const id=n.getAttribute('data-growth-table');assert(tableIDs.has(id),'Planner must target an existing retained table');n.setAttribute('data-growth-table',tableIDs.get(id));}else{const href=n.getAttribute('href'),u=new URL(href,origin+route);if(u.origin===origin&&u.pathname===route&&tableIDs.has(u.hash.slice(1)))n.setAttribute('href',href.slice(0,href.lastIndexOf('#')+1)+tableIDs.get(u.hash.slice(1)));}}
 for(const n of d.querySelectorAll('*')){const attrs=[...n.attributes].map(a=>[a.name,a.value]).sort(([a],[b])=>a.localeCompare(b));for(const a of [...n.attributes])n.removeAttribute(a.name);for(const [k,v]of attrs)n.setAttribute(k,v);}
 function removeIndentation(n){if(/^(SCRIPT|STYLE|PRE|TEXTAREA)$/.test(n.nodeName))return;for(const c of [...n.childNodes]){if(c.nodeType===3&&!c.textContent.trim())c.remove();else if(c.nodeType===1)removeIndentation(c);}}removeIndentation(d.documentElement);
 return d;
}
function html(source,file=''){
 let value=Buffer.isBuffer(source)?source.toString('utf8'):source;
 if(!/<(?:!DOCTYPE|html|header)\b/i.test(value))return value.replaceAll('\r\n','\n');
 if(/^(ko|en|ja|ru|zh-tw)\/(events|seasons|guides)\/index.html$/.test(file))value=require('./build-editorial-50').applyHub(value,file.split('/')[0],file.split('/')[1]);
 const d=normalizeDocument(parseHTML(value).document,file);
 return d.documentElement?.outerHTML||d.toString();
}
function parse(source,file=''){return normalizeDocument(parseHTML(source).document,file);}
function equal(actual,expected,file){
 const a=String(actual).replaceAll('\r\n','\n'),e=String(expected).replaceAll('\r\n','\n');
 if(file==='sitemap.xml'){const urls=x=>[...x.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);assert.deepEqual(urls(a).sort(),require('./product-50-test-allowances').expectedSitemapURLs());for(const url of urls(e))assert(urls(a).includes(url));return;}
 const approved=require('./lib/product-50-reviewed-runtime.json').entries.find(x=>x.file===file);
 if(approved&&a!==e){const hash=x=>crypto.createHash('sha256').update(x).digest('hex');assert.equal(hash(e),approved.before,file+' immutable pre5 runtime');assert.equal(hash(a),approved.after,file+' exact reviewed5 runtime');if(file==='js/database-22.js')require('./product-50-test-allowances').databasePreserved(e,a);if(file==='js/tools-speedup-calculator.js')require('./product-50-test-allowances').speedupPreserved(e,a);return;}
 assert.equal(html(a,file),html(e,file),file+' exact legacy content after reviewed 5.0 presentation');
}
module.exports={normalizeDocument,html,parse,equal};
