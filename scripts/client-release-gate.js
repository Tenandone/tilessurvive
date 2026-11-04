'use strict';
// Read-only postconditions for the retained 21-language release. A successful
// historical six-language build is deliberately not a publication decision.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const {parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..'),ORIGIN='https://tilessurvive.net';
const BASELINE='6549f506e5ea7eec36c9598d850dbc630a54791a';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=(root,file)=>fs.readFileSync(path.join(root,file),'utf8');
const json=(root,file)=>JSON.parse(read(root,file));
const urls=xml=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
function walk(root,relative){const dir=path.join(root,relative);return fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(root,path.posix.join(relative,e.name)):[path.posix.join(relative,e.name)]):[];}
function publicFiles(root=ROOT){const codes=json(root,'data/i18n/locales.json').locales.map(x=>x.code);return [...codes.flatMap(c=>walk(root,c).filter(f=>f.endsWith('.html'))),...walk(root,'data').filter(f=>/\.(json|js)$/.test(f)),...['js','css'].flatMap(dir=>walk(root,dir).filter(f=>/\.(js|css)$/.test(f))),...['index.html','tiktok-live-match/index.html','sitemap.xml','robots.txt'].filter(f=>fs.existsSync(path.join(root,f)))].sort();}
function snapshot(root=ROOT,backup){const files={};for(const file of publicFiles(root)){const bytes=fs.readFileSync(path.join(root,file));files[file]=sha(bytes);if(backup){const to=path.join(backup,file);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,bytes);}}return {schemaVersion:1,files};}
const immutable=file=>['robots.txt','sitemap.xml'].includes(file)||/^(?:js|css)\//.test(file)||file.startsWith('data/')&&!/^data\/(?:search\/|v3-search\/|search-index\.json$)/.test(file);
function verifyStableFiles(root,before){for(const [file,hash]of Object.entries(before.files))if(immutable(file))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,'Immutable release input changed: '+file);for(const file of publicFiles(root))if(immutable(file))assert(Object.hasOwn(before.files,file),'Unvalidated new public input: '+file);}
function validatePublication(data,publication,routes){
 assert.equal(data.heroes.length,35,'A new client row requires an explicit publication review');
 assert.equal(new Set(data.heroes.map(h=>h.clientId)).size,35,'Duplicate client identity');
 assert.equal(routes.heroes.length,29,'Only reviewed identity routes may be published');
 assert.deepEqual([...publication.heldForms].sort(),['chef-ken-promoted','freya-promoted','eva-promoted','travis-promoted','lucky-promoted','sarge-promoted'].sort(),'Promotion release policy changed without review');
 assert.deepEqual(publication.newPublished.map(h=>h.id),['lava'],'New release needs evidence and route review');
 for(const p of publication.newPublished){assert(data.heroes.some(h=>h.id===p.id&&h.clientId===p.clientId));assert(p.releaseEvidence?.length&&p.releaseEvidence.every(u=>new URL(u).hostname==='tilesurvivegame.com'),'New release lacks official evidence');}
 for(const h of data.heroes){assert(h.sourceId&&h.nameKey,'Missing source identity');if(h.variant==='promoted')assert(publication.heldForms.includes(h.id),'Unreviewed promoted form');else assert(routes.heroes.some(r=>r.id===h.id),'Unreviewed base identity');}
 for(const id of ['furiosa','alita'])assert(!data.heroes.some(h=>h.id===id),'Missing core data cannot become a fabricated client row');
 return {forms:35,identities:29,held:6};
}
function validateDocument(html,{locale,route,routes,registry}){
 const head=parseHTML(html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0]||'').document;
 assert.equal(head.querySelector('link[rel="canonical"]')?.getAttribute('href'),ORIGIN+route,route+' canonical');
 assert(!/noindex/i.test(head.querySelector('meta[name="robots"]')?.getAttribute('content')||''),route+' indexability');
 const lang=html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i)?.[1];
 const l=registry.find(x=>x.code===locale);assert([l.code,l.htmlLang,l.numberLocale].some(x=>x?.toLowerCase()===lang?.toLowerCase()),route+' document language');
 const alternatives=[...head.querySelectorAll('link[rel="alternate"][hreflang]')];assert.equal(alternatives.length,registry.length+1,route+' complete hreflang');
 for(const other of registry){const found=alternatives.filter(n=>n.getAttribute('hreflang').toLowerCase()===other.hreflang.toLowerCase());assert.equal(found.length,1,route+' unique hreflang '+other.code);assert.equal(found[0].getAttribute('href'),ORIGIN+routes[other.code],route+' equivalent destination');}
 assert.equal(alternatives.find(n=>n.getAttribute('hreflang')==='x-default')?.getAttribute('href'),ORIGIN+(routes.en==='/en/'?'/':routes.en),route+' x-default');
 const payload=JSON.parse(head.getElementById('ts-locale-routes')?.textContent||'null');assert.deepEqual(payload,routes,route+' current-page language map');
 const ui=JSON.parse(head.getElementById('ts-global-ui')?.textContent||'null');assert.equal(ui?.locale,locale,route+' UI locale');const required=Object.keys(require('../data/i18n/ui/en.json').copy);assert.deepEqual(Object.keys(ui.copy||{}).sort(),required.sort(),route+' UI key inventory');assert(Object.values(ui.copy).every(x=>typeof x==='string'&&x.trim()),route+' complete UI');assert(ui.affiliate?.length===4&&ui.affiliate.every(x=>typeof x==='string'&&x.trim()),route+' affiliate UI');
 const menus=[...html.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi)].map(m=>m[0]).filter(s=>/hreflang=/.test(s));assert(menus.length,route+' static language navigation');
 for(const menu of menus){const links=[...parseHTML(menu).document.querySelectorAll('a[hreflang]')];assert.equal(links.length,registry.length,route+' language menu count');for(const other of registry)assert(links.some(a=>a.getAttribute('href')===routes[other.code]),route+' language menu destination '+other.code);}
 // Later owners supply their own navigation. Legacy TOCs must not copy their
 // headings into unowned text which the global translator cannot classify.
 for(const nav of [...html.matchAll(/<nav\b[^>]*class=["'][^"']*ts3-contents[^"']*["'][^>]*>[\s\S]*?<\/nav>/gi)])assert(!/href=["'][^"']*#(?:v3-|growth-plan|hero-atlas|hero-pet)/.test(nav[0]),route+' legacy TOC captured a managed owner');
 return true;
}
function preservedContent(html){
 const programs=[],models=[],tables=[];
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  const attrs=m[1],id=attrs.match(/\bid=["']([^"']+)["']/)?.[1];
  if(/\bsrc=/.test(attrs))continue;
  if(/application\/json/.test(attrs)){if(['ts-global-ui','ts-locale-routes'].includes(id)||/data-(?:v3-|hero-pet)/.test(attrs))continue;models.push(sha(m[2]));}
  else if(!/application\/ld\+json/.test(attrs)&&!/data-(?:v3-|hero-pet)/.test(attrs))programs.push(sha(m[2]));
 }
 for(const m of html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)){const values=m[0].replace(/<[^>]*>/g,' ').match(/\d+(?:[.,]\d+)*(?:%|[KMB])?/g)||[];if(values.length)tables.push(sha(JSON.stringify(values)));}
 const ads=[...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(m=>m[0]).filter(s=>/adsbygoogle|googlesyndication|fundingchoices|__tcfapi|__gpp/i.test(s));
 const ten=[...html.matchAll(/<a\b[^>]*href=["']([^"']*lootbar[^"']*)["'][^>]*>/gi)].map(m=>m[1]);
 return {programs,models,tables,ads,ten};
}
function verifyPreserved(before,after,file){const a=preservedContent(before),b=preservedContent(after);for(const key of ['programs','models','ads','ten'])assert.deepEqual(b[key],a[key],file+' protected '+key);let at=0;for(const value of a.tables){at=b.tables.indexOf(value,at);assert(at>=0,file+' original numeric table removed or changed');at++;}}
function hook(root=ROOT){const script='scripts/build-hero-pet-pages.js',data='data/hero-pet-relations.json',hasScript=fs.existsSync(path.join(root,script)),hasData=fs.existsSync(path.join(root,data));assert.equal(hasScript,hasData,'Hero/pet renderer and validated data must enter the release together');if(!hasScript)return null;const owner=require(path.join(root,script));assert.equal(typeof owner.validate,'function','Hero/pet model validator is required');assert.equal(typeof owner.project,'function','Hero/pet pure projection is required');owner.validate(json(root,data));return script;}
function validate(root=ROOT,{before,backup}={}){
 const registry=json(root,'data/i18n/locales.json').locales;assert.equal(registry.length,21,'The published locale set must not shrink');
 const model=validatePublication(json(root,'data/hero-atlas-client.json'),json(root,'data/hero-atlas-publication.json'),json(root,'data/hero-atlas-routes.json'));hook(root);
 const expected=urls(cp.execFileSync('git',['show',BASELINE+':sitemap.xml'],{cwd:root,encoding:'utf8'}));const actual=urls(read(root,'sitemap.xml'));assert.equal(new Set(actual).size,actual.length,'Duplicate sitemap URL');assert.deepEqual([...actual].sort(),[...expected].sort(),'Published sitemap routes must be retained exactly');
 const expectedSet=new Set(expected);for(const file of publicFiles(root).filter(f=>f.endsWith('.html'))){const html=read(root,file),head=parseHTML(html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0]||'').document,canonical=head.querySelector('link[rel="canonical"]')?.getAttribute('href'),own=ORIGIN+'/'+file.replace(/index\.html$/,'');if(canonical===own&&!/noindex/i.test(head.querySelector('meta[name="robots"]')?.getAttribute('content')||''))assert(expectedSet.has(own),'Unreviewed canonical route from a legacy builder: '+own);}
 const groups=require(path.join(root,'scripts/lib/global-localization')).routeGroups(root);assert.equal(groups.length,121,'Canonical route inventory changed');let pages=0;
 for(const group of groups)for(const l of registry){const route=group.routes[l.code];assert(route,'Missing locale counterpart '+group.id+'/'+l.code);const file=route.slice(1)+'index.html',html=read(root,file);validateDocument(html,{locale:l.code,route,routes:group.routes,registry});if(before&&backup&&before.files[file])verifyPreserved(read(backup,file),html,file);pages++;}
 const index=json(root,'data/search-index.json');assert.equal(index.itemCount,index.items.length);assert.equal(new Set(index.items.map(i=>i.url)).size,index.items.length);const indexed=new Set(index.items.map(i=>i.url));
 for(const l of registry){const raw=json(root,'data/search/'+l.code+'.json'),derived=json(root,'data/v3-search/'+l.code+'.json');assert.equal(raw.items.length,raw.itemCount);assert.equal(derived.items.length,raw.itemCount);assert.deepEqual(derived.items.map(({search,...item})=>item),raw.items,l.code+' search source preservation');for(const item of raw.items){assert(indexed.has(item.url),'Missing aggregate record');assert(item.url.startsWith('/'+l.code+'/'),'Cross-language search record');}}
 if(before)verifyStableFiles(root,before);
 return {status:'PASS',locales:registry.length,canonicalPages:pages,sitemapURLs:actual.length,routeGroups:groups.length,searchRecords:index.itemCount,...model};
}
module.exports={ROOT,BASELINE,publicFiles,snapshot,validatePublication,validateDocument,preservedContent,verifyPreserved,verifyStableFiles,hook,validate};
if(require.main===module)console.log(JSON.stringify(validate()));
