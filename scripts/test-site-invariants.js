'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const A=require('./analytics-invariants'),R=require('./reviewed-routes'),G=require('./client-release-gate'),C=require('./v3-affiliate-content'),ROOT=path.resolve(__dirname,'..');
const historical=['G-Z2MJ6TXZHK','G-TMGDGSEWW6','G-Z2MJ6TZXHK'];
const bootstrap=(ids=historical)=>'<script data-v3-ga-bootstrap>window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.gtag(\'consent\',\'default\',{analytics_storage:\'denied\'});window.TS_V3_GA_IDS='+JSON.stringify(ids)+';</script>';
const legacy=()=>'<html data-v3-affiliate><head>'+bootstrap()+'<meta name="google-site-verification" content="existing-token"></head><body><section data-v3-consent>Old controls</section><script src="/js/v3-affiliate.js?v=abc"></script></body></html>';
const page=()=>C.transformAnalytics('<html data-v3-affiliate><head><meta name="google-site-verification" content="existing-token"><script defer src="/js/analytics-contract.js?v=schema"></script><script defer src="/js/v3-affiliate.js?v=abc"></script></head><body>Retained content</body></html>');
test('analytics gate permits only the reviewed primary-only migration and preserves verification independently from cache hashes',()=>{
 const before=legacy(),after=page();assert(A.preserved(before,after));assert(A.preserved(after,after.replace('?v=abc','?v=new')));assert.deepEqual(A.signature(after).ids,['G-Z2MJ6TXZHK']);
 for(const bad of [after.replace('existing-token','other-token'),after.replace('["G-Z2MJ6TXZHK"]','["G-Z2MJ6TXZHK","G-TMGDGSEWW6"]'),after.replace("analytics_storage:'denied'","analytics_storage:'granted'"),after.replace('</head>',bootstrap()+'</head>'),after.replace('</body>','<script src="/js/v3-affiliate.js"></script></body>'),after.replace('</body>','<script src="https://www.googletagmanager.com/gtag/js?id=G-Z2MJ6TXZHK"></script></body>'),after.replace('</body>','<section data-v3-consent></section></body>'),after.replace('G-Z2MJ6TXZHK','G-UNKNOWN123')])assert.throws(()=>A.preserved(before,bad));
});
test('an unrelated inert redirect stays inert and no new tracker is silently introduced',()=>{
 assert(A.preserved('<html><head></head><body>Redirect</body></html>','<html><head><link rel="icon" href="/favicon.ico"></head><body>Redirect</body></html>'));
 assert.throws(()=>A.preserved('<html><head></head><body>Redirect</body></html>',page()),/analytics|destination/);
});
test('reviewed route registry allows exactly the nuclear age owner across existing21 locales',t=>{
 assert.equal(R.entries().length,1);const rows=R.routes();assert.equal(rows.length,21);assert.equal(new Set(rows.map(r=>r.route)).size,21);assert(rows.every(r=>r.route==='/'+r.locale+'/eras/nuclear-age/'));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ts-route-registry-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'data'),{recursive:true});const original=JSON.parse(fs.readFileSync(path.join(ROOT,'data/reviewed-routes.json'),'utf8'));
 for(const change of [x=>x.routes.push({...x.routes[0],id:'unreviewed'}),x=>x.routes[0].path='seasons/season-3/',x=>x.routes[0].owner='scripts/build-core-content.js',x=>x.routes[0].clientBuild=1531]){const bad=structuredClone(original);change(bad);fs.writeFileSync(path.join(root,'data/reviewed-routes.json'),JSON.stringify(bad));assert.throws(()=>R.entries(root),/Unreviewed route/);}
});
test('release snapshot inventory includes root/legacy documents and protected icon and verification bytes',()=>{
 const files=new Set(G.publicFiles());for(const file of ['404.html','index.html','makeup/vipcalc.html','components/banners/ko.html','favicon.ico','favicon-96x96.png','apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png','img/brand/tiles-survive-app-2.6.400.webp','naverc704fd6c935203e88cfa188739a53ddd.html'])assert(files.has(file),file);
 assert(!files.has('components/ko/header.html')&&!files.has('components/ko/footer.html'),'Headless fragments are not standalone documents');
});
