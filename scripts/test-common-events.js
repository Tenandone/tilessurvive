'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const M=require('./check-common-events');
const page='<html><head><title>Official news</title></head><body><a href="/en/blog/1213">Alita preview</a></body></html>';
const bundle='const title="Jack-o\u0027-Lantern",rules="Oct 26, 2026 00:00 UTC<br>Nov 8, 2026 23:59 UTC",x={event_title:title,event_rules_description:rules},a=[{threshold:5e5,quantity:1000}],b={probability:10};';
const reply=(body,type='text/html')=>new Response(body,{status:200,headers:{'content-type':type}});

test('only explicit public page and same-origin asset URLs are allowed',()=>{
 for(const u of ['https://tilesurvivegame.com/','https://tilesurvivegame.com/en/list','https://tilesurvivegame.com/en/blog/1213','https://tilesurvivegame.com/ko/blog/1218','https://ts-halloween-web.funplus.com/assets/index-x.js'])assert(M.allowedURL(u));
 for(const u of ['http://tilesurvivegame.com/','https://tilesurvivegame.com/?uid=1','https://user:secret@tilesurvivegame.com/','https://tilesurvivegame.com/account','https://tilesurvivegame.com/en/blog/1218','https://tilesurvivegame.com/ko/blog/1213','https://tilesurvivegame.com/en/blog/1213?uid=1','repository:data/nuclear-age.json','https://example.com/','https://ts-halloween-web.funplus.com/api/account','https://127.0.0.1/'])assert.throws(()=>M.allowedURL(u));
});
test('semantic extraction ignores minifier names and bundle asset hashes, but retains rules and numeric changes',()=>{
 assert.deepEqual(M.bundleSemantic(bundle),M.bundleSemantic(bundle.replaceAll('title=','aTitle=').replaceAll(':title',':aTitle').replaceAll('rules=','aRules=').replaceAll(':rules',':aRules')));
 assert.notDeepEqual(M.bundleSemantic(bundle),M.bundleSemantic(bundle.replace('23:59','22:59')));
 assert.notDeepEqual(M.bundleSemantic(bundle),M.bundleSemantic(bundle.replace('5e5','6e5')));
 assert.deepEqual(M.bundleSemantic(bundle),M.bundleSemantic(bundle.replace('"Oct 26, 2026 00:00 UTC<br>Nov 8, 2026 23:59 UTC"','`Oct 26, 2026 00:00 UTC\nNov 8, 2026 23:59 UTC`')));
 assert.throws(()=>M.bundleSemantic('globalThis.thisMustNeverRun = true;'),/EXTRACTION_FAILED/);
 assert.equal(globalThis.thisMustNeverRun,undefined);
 const a=M.pageSemantic(page.replace('</head>','<script src="/assets/old.js"></script></head>'),'https://tilesurvivegame.com/');
 const b=M.pageSemantic(page.replace('</head>','<script src="/assets/new.js"></script></head>'),'https://tilesurvivegame.com/');
 assert.deepEqual(a.semantic,b.semantic);assert.notDeepEqual(a.assets,b.assets);
});
test('redirects are revalidated and downloads omit identity, cookies and authorization',async()=>{
 const calls=[];const r=await M.fetchPublic('https://tilesurvivegame.com/',{fetcher:async(u,o)=>{calls.push([u,o]);return calls.length===1?new Response(null,{status:302,headers:{location:'/en'}}):reply(page);}});
 assert.equal(r.finalURL,'https://tilesurvivegame.com/en');assert.equal(calls[0][1].credentials,'omit');assert(!('Authorization' in calls[0][1].headers));
 await assert.rejects(()=>M.fetchPublic('https://tilesurvivegame.com/',{fetcher:async()=>new Response(null,{status:302,headers:{location:'https://example.com/private'}})}),/URL_NOT_ALLOWED/);
});
test('response byte limits, MIME checks and timeout fail explicitly',async()=>{
 await assert.rejects(()=>M.fetchPublic('https://tilesurvivegame.com/',{maxBytes:1024,fetcher:async()=>reply('x'.repeat(1025))}),/RESPONSE_TOO_LARGE/);
 await assert.rejects(()=>M.fetchPublic('https://tilesurvivegame.com/',{fetcher:async()=>reply('{}','application/json')}),/UNEXPECTED_CONTENT_TYPE/);
 await assert.rejects(()=>M.fetchPublic('https://tilesurvivegame.com/',{timeoutMs:100,fetcher:async(u,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))}),/FETCH_TIMEOUT/);
});
test('new articles, changed content and access failures are distinct; failure never looks unchanged',async()=>{
 const fetcher=async u=>u.includes('/assets/')?reply(bundle,'text/javascript'):reply(u.includes('halloween')?'<html><title>Halloween</title><script src="/assets/index-abc.js"></script></html>':page);
 const first=await M.check({fetcher});assert.equal(first.status,'baseline-created');assert.equal(first.sources.length,M.DEFAULT_SOURCES.length+1);
 const same=await M.check({fetcher,baseline:first});assert.equal(same.status,'unchanged');
 const changed=await M.check({baseline:first,fetcher:async u=>u.includes('/en/list')?reply(page.replace('/1213','/9999')):fetcher(u)});assert.equal(changed.status,'changed');assert.deepEqual(changed.changes.newArticles,['https://tilesurvivegame.com/en/blog/9999']);assert(changed.changes.contentChanged.includes('official-news'));
 const failed=await M.check({baseline:first,fetcher:async u=>u.includes('/en/list')?new Response('Denied',{status:403}):fetcher(u)});assert.equal(failed.status,'needs-review');assert.equal(failed.changes.accessFailures[0].error,'HTTP_403');assert.deepEqual(failed.changes.removedArticles,[]);
});

test('Nuclear Age announcement changes and failures remain review candidates without changing the model',async()=>{
 const file=path.join(__dirname,'../data/nuclear-age.json'),before=fs.readFileSync(file),calls=[];
 const fetcher=async u=>{calls.push(u);return u.includes('/assets/')?reply(bundle,'text/javascript'):reply(u.includes('halloween')?'<html><title>Halloween</title><script src="/assets/index-abc.js"></script></html>':page);};
 const first=await M.check({fetcher});
 const model=first.sources.find(s=>s.id==='nuclear-client-model');
 assert.equal(model.status,'ok');assert.equal(model.reviewOnly,true);assert.equal(model.semantic.clientVersion,JSON.parse(before).client.version);
 assert(calls.includes('https://tilesurvivegame.com/en/blog/1213'));assert(calls.includes('https://tilesurvivegame.com/ko/blog/1218'));assert(calls.every(u=>u.startsWith('https://')));
 assert(calls.includes('https://tilesurvivegame.com/en/blog/1221'));assert(calls.includes('https://tilesurvivegame.com/ko/blog/1226'));
 const changed=await M.check({baseline:first,fetcher:async u=>u.endsWith('/ko/blog/1218')?reply(page.replace('Alita preview','Nuclear Age release update')):fetcher(u)});
 assert.equal(changed.status,'changed');assert.deepEqual(changed.changes.contentChanged,['nuclear-official-ko']);
 const failure=await M.check({baseline:first,fetcher:async u=>u.endsWith('/en/blog/1213')?new Response('Unavailable',{status:503}):fetcher(u)});
 assert.equal(failure.status,'needs-review');assert(failure.changes.accessFailures.some(s=>s.id==='nuclear-official-en'&&s.error==='HTTP_503'));
 assert.deepEqual(fs.readFileSync(file),before);
});

test('fixed client-model digest ignores JSON formatting but catches configuration changes without executing content',()=>{
 const source=JSON.stringify({schemaVersion:1,id:'nuclear-age',client:{version:'2.6.400',build:1546},scope:{buildingTypeIds:[800005]},stages:[{id:1,nuclearFuelRequirement:50}]});
 const plain=JSON.parse(source),a=M.clientModelSemantic(source);
 assert.deepEqual(M.clientModelSemantic(JSON.stringify({stages:plain.stages,scope:plain.scope,client:plain.client,id:plain.id,schemaVersion:1},null,4)),a);
 plain.stages[0].nuclearFuelRequirement=75;const b=M.clientModelSemantic(JSON.stringify(plain));assert.notEqual(b.modelSha256,a.modelSha256);
 const wrap=semantic=>({sources:[{id:'nuclear-client-model',status:'ok',semanticSha256:semantic.modelSha256,semantic}]});
 assert.deepEqual(M.compare(wrap(b),wrap(a)).contentChanged,['nuclear-client-model']);
 assert.throws(()=>M.clientModelSemantic('globalThis.monitorExecuted=true'),/INVALID_JSON/);assert.equal(globalThis.monitorExecuted,undefined);
 assert.throws(()=>M.clientModelSemantic('{"schemaVersion":1,"id":"other-game"}'),/CLIENT_MODEL_INVALID/);
 assert.throws(()=>M.inspectClientModel({id:'nuclear-client-model',url:'repository:../private.json'}),/SOURCE_NOT_ALLOWED/);
 assert.throws(()=>M.inspectClientModel({id:'unreviewed-model',url:'repository:data/nuclear-age.json'}),/SOURCE_NOT_ALLOWED/);
});
test('reports require an external output and refuse repository paths and baseline overwrite',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tiles-events-'));
 try{assert.equal(M.externalOutput(path.join(dir,'report.json')),path.join(fs.realpathSync(dir),'report.json'));assert.throws(()=>M.externalOutput(path.join(__dirname,'report.json')),/OUTSIDE_REPOSITORY/);assert.throws(()=>M.externalOutput(),/required/);await assert.rejects(()=>M.main(['--output',path.join(dir,'same.json'),'--baseline',path.join(dir,'same.json')]),/BASELINE_MUST_DIFFER/);}finally{fs.rmdirSync(dir);}
});
test('reviewed event distinguishes optional spending, precise publication dates and untested code redemption',()=>{
 const data=require('./common-event-content').facts,e=data.events[0];assert.equal(e.endsAt,'2026-11-08T23:59:00Z');assert.equal(e.endPrecision,'minute');assert.equal(e.dailyResetUTC,'00:00');assert.equal(e.purchaseRequired,false);assert.equal(e.tasks.find(t=>t.id==='purchase').optionalPurchase,true);assert.equal(e.minimumLightings,1);assert.equal(e.mailValidityDays,30);assert.equal(e.milestoneDistributionBusinessDays,15);assert.deepEqual(e.milestones.map(m=>m.threshold),[500000,1000000,1500000,2000000]);assert(data.codes.every(c=>c.verified&&c.redemptionTested===false&&c.verification==='official-announcement'&&c.sources.length));
});
