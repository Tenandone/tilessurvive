'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const A=require('./analytics-invariants'),V3=require('./build-v3-platform'),C=require('./v3-affiliate-content');
const ROOT=path.resolve(__dirname,'..'),REG=require('../data/i18n/locales.json').locales;
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
// Reviewed c24bf289 bootstrap fixture. Deliberately independent of generated pages,
// which must also pass after the new owner has regenerated the whole site.
const legacyBootstrap=ids=>`<script data-v3-ga-bootstrap>window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.gtag('consent','default',{analytics_storage:'denied'});window.TS_V3_GA_IDS=${JSON.stringify(ids)};</script>`;
const legacyPage=(ids=['G-Z2MJ6TXZHK'])=>`<html data-v3-affiliate><head>${legacyBootstrap(ids)}<link rel="canonical" href="https://tilessurvive.net/ko/heroes/furiosa/"><!-- TS_V3_ASSETS_BEGIN --><script defer src="/js/v3-affiliate.js?v=fixture"></script><!-- TS_V3_ASSETS_END --></head><body><main>Retained content<!-- TS_V3_PRIVACY_BEGIN --><div data-v3-owned="privacy"><section data-v3-consent>Old controls</section></div><!-- TS_V3_PRIVACY_END --></main></body></html>`;
function sample(locale='ko',relative='heroes/furiosa/'){
 const before=read(locale+'/'+relative+'index.html'),after=V3.project(before,locale,'/'+locale+'/'+relative);
 return {before,after};
}
test('all 21 projections remove legacy controls, order the schema before runtime, and migrate only approved analytics',()=>{
 for(const {code}of REG){const {before,after}=sample(code);assert.equal(A.preserved(before,after),true);const a=A.signature(after);assert.deepEqual(a.ids,['G-Z2MJ6TXZHK']);assert.equal(a.runtime,1);assert.equal(a.contract,1);assert.equal(a.legacy,false);assert(!/data-v3-consent|TS_V3_PRIVACY_BEGIN|data-v3-owned="privacy"/.test(after));assert.equal(V3.project(after,code,'/'+code+'/heroes/furiosa/'),after);}
});
test('strict invariants reject stale bootstraps, granted storage, duplicates, absent schema and retained controls',()=>{
 const before=legacyPage(),after=V3.project(before,'ko','/ko/heroes/furiosa/');assert.throws(()=>A.signature(before),/bootstrap/);assert.equal(A.preserved(before,after),true);assert.equal(A.preserved(after,V3.project(after,'ko','/ko/heroes/furiosa/')),true);
 for(const changed of [after.replace("analytics_storage:'denied'","analytics_storage:'granted'"),after.replace('</head>','<script src="https://www.googletagmanager.com/gtag/js?id=G-Z2MJ6TXZHK"></script></head>'),after.replace(/<script[^>]*src="\/js\/analytics-contract\.js[^>]*><\/script>/,''),after.replace('</main>','<section data-v3-consent></section></main>'),after.replace('</head>','<script>gtag("config","G-Z2MJ6TXZHK");</script></head>')])assert.throws(()=>A.signature(changed));
 const bootstrap=after.match(/<script\b[^>]*data-v3-ga-bootstrap[^>]*>[\s\S]*?<\/script>/)[0];assert.throws(()=>A.signature(after.replace('</head>',bootstrap+'</head>')),/Duplicate/);
});
test('historical destinations migrate narrowly and verification tokens stay protected',()=>{
 for(const id of ['G-TMGDGSEWW6','G-Z2MJ6TZXHK']){const legacy=legacyPage(['G-Z2MJ6TXZHK',id]),migrated=V3.project(legacy,'ko','/ko/heroes/furiosa/');assert.equal(A.preserved(legacy,migrated),true);assert.deepEqual(A.signature(migrated).ids,['G-Z2MJ6TXZHK']);}
 for(const [locale,relative]of [['ko','codes/'],['zh-tw',''],['zh-cn','']]){const {before,after}=sample(locale,relative);assert.equal(A.preserved(before,after),true);assert.deepEqual(A.signature(after).ids,['G-Z2MJ6TXZHK']);}
 const {before,after}=sample(),marker='<meta name="google-site-verification" content="published-verification-fixture">';assert.throws(()=>A.preserved(before.replace('</head>',marker+'</head>'),after),/verification/);
 assert.throws(()=>A.preserved(before.replace('G-Z2MJ6TXZHK','G-UNKNOWN123'),after),/destination/);
 assert.throws(()=>A.preserved(before,after.replace(/<script[^>]*src="\/js\/v3-affiliate\.js[^>]*><\/script>/,'')),/runtime/);
});
test('redirect and error documents retain bootstrap only and never acquire a second page-view runtime',()=>{
 for(const file of ['index.html','404.html']){const before=read(file),after=C.transformAnalytics(before);assert.equal(A.preserved(before,after),true);const a=A.signature(after);assert.equal(a.runtime,0);assert.equal(a.contract,0);}
});
test('runtime stamp projection updates all reviewed script assets without rewriting inline values or unrelated URLs',()=>{
 const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex').slice(0,12);
 const prefix='<script type="application/json">{"sample":"/js/growth-50.js?v=1"}</script><a href="/js/growth-50.js?v=1">Keep link</a><script src="https://outside.invalid/js/growth-50.js?v=1"></script>';
 const input=prefix+V3.runtimeFiles.map((file,i)=>'<script defer src="/'+file+(i%2?'?v=1':'')+'"></script>').join('');
 const output=V3.refreshRuntimeAssets(input);assert(output.startsWith(prefix));
 for(const file of V3.runtimeFiles)assert(output.includes('src="/'+file+'?v='+hash(file)+'"'),file);
 assert.equal(V3.refreshRuntimeAssets(output),output);
});
test('skipped alias, noindex and mainless documents refresh existing scripts without acquiring analytics',()=>{
 const body='<p>Retained redirect content</p>',script='<script defer src="/js/data-workbench-30.js?v=199806adb397"></script>';
 const cases=[
  {route:'/en/behemoths/tidal-drake/',head:'<meta name="robots" content="noindex,follow">',body:'<main>'+body+'</main>'},
  {route:'/ko/heroes/lava/',head:'',body:'<main>'+body+'</main>'},
  {route:'/en/redirect/',head:'<meta http-equiv="refresh" content="0;url=/en/">',body}
 ];
 for(const c of cases){
  const input='<html lang="en"><head>'+c.head+script+'</head><body>'+c.body+'</body></html>',expected=V3.refreshRuntimeAssets(input),actual=V3.project(input,'en',c.route);
  assert.notEqual(actual,input,'Stale retained script must be refreshed');assert.equal(actual,expected,'Only an existing script stamp may change');
  assert.equal(V3.project(actual,'en',c.route),actual);assert(!/data-v3-platform|data-v3-affiliate|analytics-contract[.]js|v3-affiliate[.]js|data-v3-ga-bootstrap/.test(actual));
 }
});

test('published analytics runtime stamps match the current source bytes in every locale',()=>{
 const stamps=new Map(V3.runtimeFiles.map(file=>['/'+file,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex').slice(0,12)]));
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):entry.name.endsWith('.html')?[path.join(dir,entry.name)]:[]);
 let references=0;const seen=new Set();
 for(const {code}of REG)for(const file of walk(path.join(ROOT,code))){const html=fs.readFileSync(file,'utf8');for(const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)){
  const [src,query]=match[1].split('?');if(!stamps.has(src))continue;
  assert.equal(query,'v='+stamps.get(src),path.relative(ROOT,file)+' stale script '+src);references++;seen.add(src);
 }}
 assert(references>2000,'Expected every public locale to participate');
 // No HTML referenced this compatibility URL at task-start c24bf289; it must stay inert and unpublished.
 const retiredUnreferenced=new Set(['js/affiliate-tracking.js']);
 for(const file of V3.runtimeFiles){
  if(retiredUnreferenced.has(file))assert(!seen.has('/'+file),'Retired compatibility shim became published: '+file);
  else assert(seen.has('/'+file),'No published coverage for '+file);
 }
});
