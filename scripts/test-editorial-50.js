const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),cp=require('child_process');
const {parseHTML}=require('linkedom');
const B=require('./build-editorial-50');
const {copy}=require('../data/product-50/editorial-copy');
const root=path.resolve(__dirname,'..'),baseline='5c5958b3d1a9c42d1ed33abe79e3fbd25b976cbe';
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const load=f=>parseHTML(fs.readFileSync(path.join(root,f),'utf8')).document;
const original=f=>parseHTML(cp.execFileSync('git',['show',baseline+':'+f],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024})).document;
const canonical=(d)=>d.documentElement.outerHTML;
function linkBase(d,route){const page=new URL(route.replace('index.html',''),'https://tilessurvive.net/');return new URL(d.querySelector('base[href]')?.getAttribute('href')||page.href,page);}
function checkContents(d,route){
 const page=new URL(route.replace('index.html',''),'https://tilessurvive.net/'),headings=[...d.querySelectorAll('main h2')];
 for(const nav of d.querySelectorAll('main nav.ts3-contents')){
  const anchors=[...nav.querySelectorAll('a[href]')];
  for(const a of anchors){const u=new URL(a.getAttribute('href'),linkBase(d,route));ok(u.origin===page.origin&&u.pathname===page.pathname&&!!u.hash,`TOC stays on its page with base: ${route}`);ok(d.getElementById(decodeURIComponent(u.hash.slice(1))),`TOC target exists: ${route} ${u.hash}`);}
  if(nav.hasAttribute('data-product-30')){ok(anchors.length===headings.length,`Derived TOC covers every heading: ${route}`);for(const [i,a] of anchors.entries()){ok(a.getAttribute('href')===`${page.pathname}#${headings[i].id}`&&a.textContent===headings[i].textContent.trim(),`Derived TOC exact heading: ${route}`);}}
 }
}
B.validate();
const langs=B.langs.filter(l=>fs.existsSync(path.join(root,l,'guides/index.html')));
if(process.argv.includes('--require-six'))assert.equal(langs.length,6);
for(const lang of langs){
 for(const type of ['events','seasons','guides']){
  const route=`${lang}/${type}/index.html`,d=load(route),html=fs.readFileSync(path.join(root,route),'utf8');
  const reapplied=parseHTML(B.applyHub(html,lang,type)).document;
  ok(reapplied.querySelector('main').outerHTML===d.querySelector('main').outerHTML,`Hub main idempotence ${route}`);
  ok(d.querySelector('link[rel="canonical"]').href===`https://tilessurvive.net/${lang}/${type}/`,'Canonical');
  ok(d.querySelectorAll('link[hreflang]').length===7,'Six locales and x-default');
  const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);ok(ids.length===new Set(ids).size,`Duplicate ID ${route}`);
  checkContents(d,route);
  if(lang!=='de'){
   const old=original(route);
   if(type==='guides'){
    const cards=[...old.querySelectorAll('main .guide-card')].map(n=>n.outerHTML);
    ok(cards.length===5,'Five inherited guides');
    ok(cards.every(s=>[...d.querySelectorAll('main .guide-card')].some(n=>n.outerHTML===s)),'All existing cards/images/URLs retained');
    ok(d.querySelectorAll('#topup-benefits .guide-card').length===2,'Benefits separated');
   }else{
    const owned=d.querySelector(`[data-editorial-50="${type}"]`);ok(owned,'Missing overlay');owned.remove();
    if(type==='events'){
     const calendar=d.querySelectorAll('[data-event-calendar-entry]');
     ok(calendar.length===1,'Exactly one calendar entry');
     ok(calendar[0].querySelectorAll('a').length===1&&calendar[0].querySelector('a').getAttribute('href')===`/${lang}/events/calendar/`,'Calendar entry preserves localized route');
     calendar[0].remove();
    }
    for(const doc of [d,old])doc.querySelectorAll('main nav.ts3-contents[data-product-30]').forEach(n=>n.remove());
    ok(d.querySelector('main').outerHTML===old.querySelector('main').outerHTML,`Inherited ${type} content preserved`);
   }
  }
 }
 const hub=load(`${lang}/events/index.html`);
 ok(hub.querySelectorAll('#event-archive-50 > article').length===9,'Archive nine public entries');
 ok(hub.querySelectorAll('#daily-task-points tbody tr').length===18,'Eighteen daily rows');
 ok(hub.querySelectorAll('#hero-phase-points tbody tr').length===5,'Five hero rules');
 ok(hub.querySelectorAll('#training-reward-links tbody tr').length===28,'Ten training tiers plus eighteen per-tier rewards');
 const dpoints=[...hub.querySelectorAll('#daily-task-points tbody tr')].map(n=>Number(n.lastElementChild.textContent));
 assert.deepEqual(dpoints,require('../data/foundation-40/daily-missions.json').missions.map(m=>m.points));checks++;
 const hpoints=[...hub.querySelectorAll('#hero-phase-points tbody tr')].map(n=>Number(n.lastElementChild.textContent));
 assert.deepEqual(hpoints,[9000,1000,150,857,60]);checks++;
 for(const g of B.guides){
  const route=`${lang}/guides/${g.id}/index.html`,d=load(route),main=d.querySelector('main');
  const skipLinks=[...d.querySelectorAll('a.ts-skip')];ok(skipLinks.length===1,'One skip link');
  ok(main.id==='main'&&skipLinks[0].getAttribute('href')===`/${lang}/guides/${g.id}/#main`,'Skip link targets this guide main');
  ok(main.querySelectorAll('h1').length===1,'One article title');
  ok(main.querySelector('#guide-steps ol').children.length===3,'Three actual steps');
  ok(main.querySelector('#guide-facts').textContent.includes(g.fact[lang]),'Fact text exact');
  ok(main.querySelector('#guide-example').textContent.includes(g.example[lang]),'Example exact');
  ok(main.querySelector('#guide-steps h2').textContent===copy.steps[lang],'Recommendations visibly labelled');
  checkContents(d,route);
  for(const a of main.querySelectorAll('a[href]')){
   const url=new URL(a.getAttribute('href'),linkBase(d,route));
   if(url.origin!=='https://tilessurvive.net')continue;
   const file=path.join(root,url.pathname,'index.html');
   ok(fs.existsSync(file),`Broken link ${route}: ${url.pathname}`);
   if(url.hash){const target=load(path.relative(root,file));ok(target.getElementById(decodeURIComponent(url.hash.slice(1))),`Missing anchor ${a.href}`);}
  }
  ok(!/C:\\Users|sourceInternalId|nativeTypeIndex|[a-f0-9]{64}/.test(main.textContent),'No private provenance in page text');
 }
}
assert.throws(()=>B.applyHub('<html><head><title>x</title></head><body></body></html>','ko','events'));checks++;
assert.throws(()=>B.applyHub('<html><head><title>x</title></head><body><main></main></body></html>','xx','events'));checks++;
assert.throws(()=>B.applyHub('<html><head><title>x</title></head><body><main></main></body></html>','ko','guides'));checks++;
console.log(`Editorial 5.0 PASS: ${checks} checks; ${langs.length} languages, 10 guides, 9 archive entries, 4 season links. No current-event inference.`);
