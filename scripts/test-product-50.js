'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto'),{execFileSync}=require('child_process'),{parseHTML}=require('linkedom');
const R=path.resolve(__dirname,'..'),base='5c5958b3d1a9c42d1ed33abe79e3fbd25b976cbe',langs=['ko','en','ja','ru','zh-tw','de'];
const read=f=>fs.readFileSync(path.join(R,f),'utf8'),text=n=>(n?.textContent||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name==='index.html'?[path.join(d,e.name)]:[]):[];
const git=(...args)=>execFileSync('git',args,{cwd:R,encoding:'utf8',maxBuffer:64e6});
const baselineFiles=git('ls-tree','-r','--name-only',base).trim().split('\n');
const selected=baselineFiles.filter(f=>/^(ko|en|ja|ru|zh-tw)\/.*\.html$/.test(f)||/^(data\/(foundation-40|expansion-22)\/.*\.json|js\/(platform-math|foundation-40-math)\.js|config\/affiliate\.json|sitemap\.xml|robots\.txt|CNAME)$/.test(f));
const batch=execFileSync('git',['cat-file','--batch'],{cwd:R,input:selected.map(f=>base+':'+f).join('\n')+'\n',maxBuffer:80e6});
const old=new Map();let pos=0;
for(const f of selected){let end=batch.indexOf(10,pos);const [sha,type,size]=batch.subarray(pos,end).toString().split(' ');assert.equal(type,'blob');pos=end+1;old.set(f,batch.subarray(pos,pos+Number(size)).toString('utf8'));pos+=Number(size)+1;}
assert.equal(pos,batch.length);
let checks=0,rowsPreserved=0,pages=0;const check=(value,msg)=>{assert.ok(value,msg);checks++;};
const buildings=require('./build-building-system'),buildingBase='7a82e23b3d2184673ed60dc6898813f74b4d9b79';
const buildingFiles=langs.flatMap(lang=>['',...buildings.slugs].map(slug=>lang+'/buildings/'+(slug?slug+'/':'')+'index.html'));
const buildingBatch=execFileSync('git',['cat-file','--batch'],{cwd:R,input:buildingFiles.map(f=>buildingBase+':'+f).join('\n')+'\n',maxBuffer:100e6});
const buildingOld=new Map();let buildingPos=0;
for(const file of buildingFiles){const end=buildingBatch.indexOf(10,buildingPos),header=buildingBatch.subarray(buildingPos,end).toString().split(' ');assert.equal(header[1],'blob');buildingPos=end+1;buildingOld.set(file,buildingBatch.subarray(buildingPos,buildingPos+Number(header[2])).toString('utf8'));buildingPos+=Number(header[2])+1;}
assert.equal(buildingPos,buildingBatch.length);
const numericBuildingModel=cfg=>cfg.buildings.map(b=>({id:b.id,slug:b.slug,profiles:b.profiles.map(p=>({id:p.id,rows:p.rows.map(r=>({level:r.level,rank:r.rank,resources:r.resources,seconds:r.seconds,battlePower:r.battlePower,requirements:r.requirements.map(q=>({buildingId:q.buildingId,level:q.level,rank:q.rank})),constructionItems:r.constructionItems.map(q=>({id:q.id??q.key,quantity:q.quantity??q.value}))}))}))}));
const numericBuildingCells=d=>[...d.querySelectorAll('main [data-level],main [data-effect-level],main [data-total-resource],main [data-total-seconds]')].map(n=>[n.tagName,n.closest('[data-bs-profile]')?.getAttribute('data-bs-profile'),n.closest('[data-bs-effect-profile]')?.getAttribute('data-bs-effect-profile'),...[n,...n.querySelectorAll('[data-raw],[data-seconds],[data-power],[data-effect-id],[data-value],[data-building-id]')].map(c=>['data-level','data-rank','data-effect-level','data-effect-rank','data-total-resource','data-total-seconds','data-resource','data-raw','data-seconds','data-power','data-effect-id','data-effect-value','data-value','data-kind','data-building-id','data-required-level'].map(a=>[a,c.getAttribute(a)]))]);
function verifyCurrentBuilding(d,file){
 const prior=parseHTML(buildingOld.get(file)).document,lang=file.split('/')[0],slug=file.split('/')[2],html='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
 // The common owner replaces obsolete tables, but verified game numbers and
 // existing analytics remain tied to the fixed deployed baseline.
 const analytics=document=>[...document.querySelectorAll('script')].filter(n=>/googletagmanager|gtag\(|consent|__tcfapi|fundingchoices/i.test(n.outerHTML)).map(n=>n.outerHTML);
 assert.deepEqual(analytics(d),analytics(prior),'Existing analytics/consent remain exact '+file);checks++;
 const seo=document=>[...document.querySelectorAll('link[rel="canonical"],link[rel="alternate"],meta[property="og:url"]')].map(n=>[n.tagName,...[...n.attributes].map(a=>[a.name,a.value]).sort()]);
 assert.deepEqual(seo(d),seo(prior),'Existing building SEO URLs '+file);checks++;
 if(slug==='index.html'){
  assert.deepEqual([...d.querySelectorAll('.building-link')].map(n=>n.href).sort(),[...prior.querySelectorAll('.building-link')].map(n=>n.href).sort(),'Existing building catalog destinations '+file);checks++;
  assert.equal(buildings.catalog(html,lang),html,'Current building catalog projection '+file);checks++;return;
 }
 const payload=document=>JSON.parse(document.querySelector('[data-building-system-model]').textContent);
 assert.deepEqual(numericBuildingModel(payload(d)),numericBuildingModel(payload(prior)),'Fixed building resources, times, requirements and effects '+file);checks++;
 assert.deepEqual(numericBuildingCells(d),numericBuildingCells(prior),'Fixed static numeric building attributes '+file);checks++;
 const legacy=document=>[...document.querySelectorAll('main table')].filter(n=>!n.closest('[data-building-system],[data-bs-effects]')).map(n=>[n.id,[...n.querySelectorAll('tbody tr')].map(r=>[...r.children].map(c=>c.textContent.match(/-?\d+(?:[.,]\d+)*/g)||[]))]);
 assert.deepEqual(legacy(d),legacy(prior),'Existing research, production and troop numeric cells '+file);checks++;
 assert.equal(buildings.project(html,lang,slug),html,'Current owned building projection '+file);checks++;
}
const rowSignature=row=>[...row.querySelectorAll(':scope > th,:scope > td')].map(text).join('\u001f');
const counted=arr=>{const m=new Map();for(const x of arr)m.set(x,(m.get(x)||0)+1);return m;};
for(const [file,before]of old){
 check(fs.existsSync(path.join(R,file)),'Existing URL/file retained '+file);
 if(!file.endsWith('.html')){
  if(file==='sitemap.xml')continue;
  if(['data/expansion-22/database.json','data/expansion-22/ledger.json','data/expansion-22/manifest.json'].includes(file)){require('./client-truth-52-test-allowances').assertSource(read(file),before,file);checks++;continue;}
  check(read(file).replaceAll('\r\n','\n')===before.replaceAll('\r\n','\n'),'Source models/formulas/affiliate unchanged '+file);continue;
 }
 const a=parseHTML(before).document,b=parseHTML(read(file)).document;
 // Validate the one new head loader before removing only it from the historical
 // comparison DOM. Existing body, analytics and consent markup stay untouched.
 const adsense=require('./install-adsense');
 check(adsense.inspect(read(file),file).installed,'Official AdSense head loader '+file);
 const loader=b.head.querySelector('script[src="'+adsense.SRC+'"]');
 check(Boolean(loader),'Exact official AdSense loader URL '+file);loader.remove();
 if(!buildingOld.has(file))require('./client-truth-52-test-allowances').restore(b,file);
 check(a.querySelector('link[rel=canonical]')?.href===b.querySelector('link[rel=canonical]')?.href,'Canonical preserved '+file);
 check(JSON.stringify([...a.querySelectorAll('head link[rel*="icon"]')].map(n=>n.href))===JSON.stringify([...b.querySelectorAll('head link[rel*="icon"]')].map(n=>n.href)),'Existing favicon preserved '+file);
 // All current building routes are independently checked against their fixed
 // deployed numeric fixture and current owner below. Non-building history keeps
 // the original exact restoration and row-preservation contract.
 if(buildingOld.has(file))continue;
 const beforeRows=[...a.querySelectorAll('main table tr')].filter(r=>r.querySelector('td')&&/\d/.test(text(r))).map(rowSignature);
 const current=counted([...b.querySelectorAll('main table tr')].map(rowSignature));
 for(const [sig,n]of counted(beforeRows)){check((current.get(sig)||0)>=n,'Existing numeric data row preserved '+file+' '+sig.slice(0,140));rowsPreserved+=n;}
 if(a.querySelector('[data-lootbar-slot="hero_detail"]')){
  check(b.querySelectorAll('[data-lootbar-slot="hero_detail"]').length===1,'Exactly one hero banner '+file);
  check(b.querySelector('[data-lootbar-slot="hero_detail"] a.ts-lootbar')?.href===JSON.parse(old.get('config/affiliate.json')).tilesSurvive.url,'Hero referral preserved '+file);
 }
}
const sitemap=read('sitemap.xml');
for(const match of old.get('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g))check(sitemap.includes('<loc>'+match[1]+'</loc>'),'Old sitemap URL retained '+match[1]);
for(const lang of langs)for(const file of walk(path.join(R,lang))){
 const rel=path.relative(R,file).replaceAll('\\','/'),d=parseHTML(fs.readFileSync(file,'utf8')).document,url='https://tilessurvive.net/'+rel.replace(/index\.html$/,'');
 pages++;
 if(buildingOld.has(rel))verifyCurrentBuilding(d,rel);
 if(/noindex/.test(d.querySelector('meta[name=robots]')?.content||'')||d.querySelector('link[rel=canonical]')?.href!==url)continue;
 check(d.documentElement.getAttribute('data-lang')===lang,'Page locale '+rel);
 check(d.querySelectorAll('h1').length===1,'One H1 '+rel);
 check(Boolean(text(d.querySelector('title')))&&Boolean(d.querySelector('meta[name=description]')?.content),'Metadata '+rel);
 check(d.querySelector('.ts-header .ts-brand')?.textContent==='TilesSurvive','Text wordmark '+rel);
 check(!d.querySelector('.ts-header .ts-brand img,.ts-header .ts-brand span'),'No header bear/dot '+rel);
 const alternates=[...d.querySelectorAll('head link[rel=alternate][hreflang]')];
 for(const l of [...langs,'x-default'])check(alternates.filter(a=>a.hreflang===l).length===1,'Six-language alternate '+l+' '+rel);
 for(const a of alternates){const target=new URL(a.href).pathname;check(fs.existsSync(path.join(R,target,'index.html')),'Alternate target '+a.href);}
 const switcher=d.querySelector('.ts3-language nav');check(Boolean(switcher),'Language menu '+rel);
 check(switcher.querySelectorAll('a').length===6,'Exactly six language choices '+rel);
 for(const l of langs){const choices=[...switcher.querySelectorAll('a')].filter(a=>a.getAttribute('lang')===l);check(choices.length===1,'No duplicate language '+l+' '+rel);check(choices[0].getAttribute('href')===new URL(alternates.find(a=>a.hreflang===l).href).pathname,'Language menu exact counterpart '+l+' '+rel);}
 for(const img of d.querySelectorAll('main img[src]')){
  const src=img.getAttribute('src');if(!src.startsWith('/'))continue;
  check(fs.existsSync(path.join(R,src.split('?')[0])),'Image exists '+src);
  check(Number(img.getAttribute('width'))>0&&Number(img.getAttribute('height'))>0,'Image reserves dimensions '+rel+' '+src);
 }
 const html=fs.readFileSync(file,'utf8');check(require('./install-adsense').inspect(html,rel).installed,'Exactly one official AdSense publisher loader in head '+rel);
 if(rel===lang+'/database/items/index.html'){
  check(d.querySelectorAll('[data-package-offer-50]').length===1,'One package comparison referral '+lang);
  const a=d.querySelector('[data-package-offer-50] a');
  check(a?.href===JSON.parse(old.get('config/affiliate.json')).tilesSurvive.url,'Package referral exact '+lang);
  check(a?.rel.includes('sponsored')&&Boolean(text(d.querySelector('[data-package-offer-50] small'))),'Affiliate relation disclosed '+lang);
 }
 check(!/C:\\Users\\|tscfg:|client\.sqlite|main-payload-decoded|BEGIN (RSA |EC )?PRIVATE KEY/.test(html),'No private data in page '+rel);
 check(sitemap.includes('<loc>'+url+'</loc>'),'Canonical in sitemap '+rel);
}
const copy=require('../js/platform-i18n');assert.deepEqual(Object.keys(copy.de).sort(),Object.keys(copy.en).sort());
const combined=JSON.parse(read('data/search-index.json'));let shardTotal=0;
for(const lang of langs){const shard=JSON.parse(read('data/search/'+lang+'.json'));check(shard.itemCount===shard.items.length,'Shard count '+lang);check(shard.items.every(x=>x.language===lang),'Only requested language '+lang);check(shard.items.length>80,'Substantive locale search '+lang);shardTotal+=shard.items.length;for(const item of shard.items){const [url,anchor]=item.url.split('#');const f=path.join(R,url,'index.html');check(fs.existsSync(f),'Search URL '+item.url);if(anchor){const d=parseHTML(fs.readFileSync(f,'utf8')).document;check(Boolean(d.getElementById(anchor)),'Search anchor '+item.url);}}}
check(shardTotal===combined.itemCount,'Shard union count');
for(const f of ['js/platform-search.js','js/product-30.js','js/site-search.js'])check(!read(f).includes('fetch("/data/search-index.json"')&&!read(f).includes("fetch('/data/search-index.json'"),'Language-scoped search loading '+f);
console.log(JSON.stringify({status:'PASS_PRODUCT_50_SEMANTIC_AND_STATIC_GATES',baseline:base,checks,pages,historicalRowsCheckedWithExactClientCorrections:rowsPreserved,searchEntries:combined.itemCount,fieldPerformanceMeasured:false,browserChecksSeparate:true}));
