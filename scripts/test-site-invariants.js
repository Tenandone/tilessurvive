'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const A=require('./analytics-invariants'),R=require('./reviewed-routes'),G=require('./client-release-gate'),ROOT=path.resolve(__dirname,'..');
const bootstrap=(ids=A.APPROVED.slice(0,1))=>'<script data-v3-ga-bootstrap>window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.gtag(\'consent\',\'default\',{analytics_storage:\'denied\'});window.TS_V3_GA_IDS='+JSON.stringify(ids)+';</script>';
const page=(head=bootstrap())=>'<html><head>'+head+'</head><body><input data-v3-consent><script src="/js/v3-affiliate.js?v=abc"></script></body></html>';
test('analytics gate preserves destinations and existing verification independently from an asset cache hash',()=>{
 const before=page(bootstrap(A.APPROVED)+'<meta name="google-site-verification" content="existing-token">');
 assert(A.preserved(before,before.replace('?v=abc','?v=new')));
 for(const after of [before.replace('existing-token','other-token'),before.replace('"G-TMGDGSEWW6",',''),before.replace("analytics_storage:'denied'","analytics_storage:'granted'"),before.replace('</head>',bootstrap()+'</head>'),before.replace('</body>','<script src="/js/v3-affiliate.js"></script></body>'),before.replace('</body>','<script src="https://www.googletagmanager.com/gtag/js?id=G-Z2MJ6TXZHK"></script></body>'),before.replace('data-v3-consent','data-removed'),before.replace('G-Z2MJ6TZXHK','G-UNKNOWN123')])assert.throws(()=>A.preserved(before,after));
});
test('an unrelated inert redirect stays inert and no new tracker is silently introduced',()=>{
 assert(A.preserved('<html><head></head><body>Redirect</body></html>','<html><head><link rel="icon" href="/favicon.ico"></head><body>Redirect</body></html>'));
 assert.throws(()=>A.preserved('<html><head></head><body>Redirect</body></html>',page()),/Preserved analytics/);
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
