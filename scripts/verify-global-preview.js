'use strict';
const fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom');
const L=require('./lib/global-localization');
const base=process.env.TS_VERIFY_ORIGIN||'http://127.0.0.1:4173';
const candidate=process.env.TS_VERIFY_CANDIDATE==='1';
const codes=(process.argv.find(x=>x.startsWith('--locales='))?.slice(10)||'en,ko,ja,zh-tw,de,ru,zh-cn').split(',');
const stage=path.resolve(L.ROOT,'../global-language-delivery-20261104/staging');
const delivery=path.dirname(stage),groups=L.routeGroups();
const expected=groups.flatMap(group=>codes.map(code=>({route:group.routes[code],code,group}))),errors=[],rows=[];
const ids=new Map();
function resolveFile(url) {
 const target=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
 for(const dir of base===L.publicOrigin||candidate?[L.ROOT]:[stage,L.ROOT]){const file=path.resolve(dir,'.'+target);if(file.startsWith(dir+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return file;}
 return null;
}
async function check(item) {
 const start=performance.now();let response,html,transportRetry=null;
 try{response=await fetch(base+item.route,{redirect:'manual',headers:{Connection:'close'}});html=await response.text();}
 catch(error){transportRetry={message:error.message,cause:String(error.cause||'')};response=await fetch(base+item.route,{redirect:'manual',headers:{Connection:'close'}});html=await response.text();}
 const row={route:item.route,locale:item.code,status:response.status,contentType:response.headers.get('content-type'),ms:Math.round(performance.now()-start),bytes:Buffer.byteLength(html),transportRetry,issues:[]};
 const fail=(type,detail)=>{row.issues.push(type);errors.push({route:item.route,type,detail});};
 if(response.status!==200)fail('http-status',response.status);
 if(!/text\/html/i.test(row.contentType||''))fail('content-type',row.contentType);
 if(base===L.publicOrigin||candidate){
  const expectedBody=fs.readFileSync(path.join(L.ROOT,item.route.slice(1),'index.html'),'utf8');
  row.matchesCandidate=L.digest(html)===L.digest(expectedBody);
  if(!row.matchesCandidate)fail('candidate-content-hash','HTTP body differs from validated working-tree candidate');
 }
 const d=parseHTML(html).document,meta=L.byCode.get(item.code);
 const validLang=item.code==='zh-tw'?['zh-Hant','zh-TW']:item.code==='zh-cn'?['zh-Hans','zh-CN']:[item.code,meta.numberLocale];
 if(!validLang.some(x=>x.toLowerCase()===d.documentElement.lang?.toLowerCase()))fail('html-lang',d.documentElement.lang);
 if(d.querySelector('link[rel="canonical"]')?.href!==L.publicOrigin+item.route)fail('canonical',d.querySelector('link[rel="canonical"]')?.href);
 if(base.startsWith('http://127.0.0.1')&&!candidate&&!/noindex/.test(d.querySelector('meta[name="robots"]')?.content||''))fail('preview-indexing','Missing noindex');
 if((base===L.publicOrigin||candidate)&&(/noindex|nofollow/i.test(d.querySelector('meta[name="robots"]')?.content||'')||(!candidate&&/noindex/i.test(response.headers.get('x-robots-tag')||''))||d.documentElement.dataset.translationStatus==='preview-unpublished'))fail('production-indexing','Unpublished indexing flag is live');
 for(const code of codes) {
  const alt=[...d.querySelectorAll('link[rel="alternate"][hreflang]')].find(x=>x.hreflang.toLowerCase()===L.byCode.get(code).hreflang.toLowerCase());
  if(alt?.href!==L.publicOrigin+item.group.routes[code])fail('hreflang:'+code,alt?.href);
 }
 for(const script of d.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]'))try{
  const data=JSON.parse(script.textContent);
  if(script.type==='application/ld+json'){
   const walk=value=>{if(Array.isArray(value))return value.forEach(walk);if(value&&typeof value==='object')return Object.values(value).forEach(walk);if(typeof value==='string'&&value.startsWith(L.publicOrigin+'/')){let url;try{url=new URL(value);}catch{return;}if(!resolveFile(url))fail('schema-missing-route',value);}};walk(data);
  }
 }catch(e){fail('invalid-json',script.id||script.type);}
 for(const el of d.querySelectorAll('a[href],img[src],script[src],link[rel="stylesheet"][href]')) {
  const raw=el.getAttribute(el.tagName==='A'||el.tagName==='LINK'?'href':'src');if(!raw||/^(?:mailto:|tel:|javascript:|data:)/i.test(raw))continue;
  const documentBase=new URL(d.querySelector('base[href]')?.getAttribute('href')||'',L.publicOrigin+item.route);
  const url=new URL(raw,documentBase);if(url.origin!==L.publicOrigin)continue;
  if(item.code!=='en'&&el.tagName==='A'&&url.pathname.startsWith('/en/')&&!el.hasAttribute('hreflang')&&!el.closest('.ts3-language,.language-switcher'))fail('cross-locale-internal-link',raw);
  const file=resolveFile(url);if(!file){fail('missing-asset-or-route',raw);continue;}
  if(el.tagName==='A'&&url.hash&&file.endsWith('.html')) {
   if(!ids.has(file)){const target=parseHTML(fs.readFileSync(file,'utf8')).document;ids.set(file,new Set([...target.querySelectorAll('[id]')].map(x=>x.id)));}
   let id;try{id=decodeURIComponent(url.hash.slice(1));}catch{id=url.hash.slice(1);}
   if(id&&!ids.get(file).has(id))fail('missing-anchor',raw);
  }
 }
 rows.push(row);
}
(async()=>{
 let cursor=0;
 await Promise.all(Array.from({length:Number(process.env.TS_VERIFY_WORKERS||3)},async()=>{while(cursor<expected.length){const row=expected[cursor++];try{await check(row);}catch(error){errors.push({route:row.route,type:'fetch-or-parse',detail:error.message});}}}));
 rows.sort((a,b)=>a.route.localeCompare(b.route));
 const report={checkedAt:new Date().toISOString(),origin:base,locales:codes,pages:expected.length,responses:rows.length,statusCounts:rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),issues:errors,rows};
 fs.writeFileSync(path.join(delivery,'preview-http-validation.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({pages:expected.length,responses:rows.length,statusCounts:report.statusCounts,issueCount:errors.length,types:errors.reduce((a,r)=>(a[r.type]=(a[r.type]||0)+1,a),{})}));
 if(errors.length)process.exitCode=1;
})();
