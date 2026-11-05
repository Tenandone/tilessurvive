'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('./build-hero-atlas-search'),V=require('./build-v3-search'),S=require('../js/v3-search-core');
const ROOT=path.resolve(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const routes=A.atlasRoutes(ROOT),locales=read('data/i18n/locales.json').locales.map(l=>l.code);
let projected,v3;const projection=()=>projected??=A.collect();const search=()=>v3??=V.collect();
test('atlas search joins 29 client identities and two official introductions without fabricated client IDs',()=>{
 assert.equal(routes.size,31*21);assert.equal(new Set([...routes.values()].filter(r=>Number.isSafeInteger(r.hero.clientId)).map(r=>r.hero.clientId)).size,31);assert.equal([...routes.values()].filter(r=>r.hero.catalogKind==='official-introduction').length,42);
 for(const [route,row]of routes){assert.equal(row.hero.variant,'base');assert(!row.hero.id.endsWith('-promoted'));assert.equal(route,read('data/hero-atlas-routes.json').heroes.find(h=>h.id===row.hero.id).routes[row.locale]);}
 assert.equal(routes.get('/en/heroes/tazan/').hero.id,'tarzan');
});
test('narrow projection is idempotent and leaves every existing source record in order',()=>{
 const result=projection();assert.equal(result.summary.recordsAdded,0);assert.equal(result.summary.mainRecordsChanged,0);
 for(const locale of locales)assert.deepEqual(result.shards[locale],read('data/search/'+locale+'.json'));
 assert.deepEqual(result.aggregate,read('data/search-index.json'));
});
test('Lava sections and both official introductions are indexed while held promotions have no independent routes',()=>{
 for(const locale of locales){const items=projection().shards[locale].items;const lava=items.filter(i=>i.url.startsWith('/'+locale+'/heroes/lava/'));assert.deepEqual(lava.map(i=>i.url),['/'+locale+'/heroes/lava/','/'+locale+'/heroes/lava/#lava-skills','/'+locale+'/heroes/lava/#lava-growth']);for(const id of ['furiosa','alita'])assert.equal(items.filter(i=>i.url==='/'+locale+'/heroes/'+id+'/').length,1);assert(!items.some(i=>/\/heroes\/[^/]+-promoted\//.test(i.url)));}
});
test('all main hero V3 records carry their route-bound client identity without changing source fields',()=>{
 const result=search();let total=0;
 for(const locale of locales){const input=read('data/search/'+locale+'.json');assert.deepEqual(result.shards[locale].items.map(({search,...source})=>source),input.items);for(const item of result.shards[locale].items){const joined=routes.get(new URL(item.url,'https://tilessurvive.net').pathname);if(!joined||item.url.includes('#'))continue;total++;assert.deepEqual(item.search.clientIds,Number.isSafeInteger(joined.hero.clientId)?[{kind:'hero',id:joined.hero.clientId}]:[]);assert.equal(item.search.hero.identityId,joined.hero.identityId);assert.equal(item.search.hero.formId,joined.hero.id);assert.equal(item.search.hero.nameStatus,joined.hero.names[locale].status);}}
 assert.equal(total,651);
});

test('official introductions retain cross-language names and do not invent client provenance',()=>{
 for(const id of ['furiosa','alita'])for(const locale of locales){const item=search().shards[locale].items.find(i=>i.url==='/'+locale+'/heroes/'+id+'/'),hero=routes.get('/'+locale+'/heroes/'+id+'/').hero;assert.deepEqual(item.search.clientIds,[{kind:'hero',id:hero.clientId}]);assert.equal(item.search.hero.clientId,id==='furiosa'?25300243:25300244);for(const [language,name]of Object.entries(hero.names)){const alias=item.search.aliases.find(a=>a.language===language&&a.value===name.value);assert(alias,id+':'+language);assert.equal(alias.source,name.status==='client-official'?'retained-client':name.status==='english-fallback'?'official-english-fallback':'official-announcement');const hit=S.rank(search().shards.en.items,name.value,{category:'heroes',limit:1})[0];assert.equal(hit.url,'/en/heroes/'+id+'/');}}
});
test('retained official names and the three English fallbacks have distinct provenance',()=>{
 for(const locale of locales){const item=search().shards[locale].items.find(i=>i.url==='/'+locale+'/heroes/lava/');const hero=routes.get('/'+locale+'/heroes/lava/').hero;for(const [language,name]of Object.entries(hero.names)){assert(item.search.aliases.some(a=>a.language===language&&a.value===name.value&&a.termKey===hero.nameKey&&a.source===(name.status==='client-official'?'retained-client':'retained-english-fallback')),language+' alias provenance');}}
});
test('cross-language Lava lookup resolves to its own main identity and never a promoted record',()=>{
 const en=search().shards.en.items,lava=routes.get('/en/heroes/lava/').hero;
 for(const name of Object.values(lava.names)){const hit=S.rank(en,name.value,{category:'heroes',limit:1})[0];assert.equal(hit.url,'/en/heroes/lava/');assert.equal(hit.search.clientIds[0].id,25300242);}
});
test('all retained site aliases and anchor context names survive official-name updates',()=>{
 const legacy=read('data/hero-atlas-search-legacy.json');
 for(const shard of Object.values(search().shards))for(const item of shard.items){
  const entity=item.search.entityId,group=entity.split('#')[0].replace(/^page:/,'');const saved=legacy.groups[group];if(!saved)continue;
  if(!entity.includes('#'))for(const alias of saved.mainAliases)assert(item.search.aliases.some(a=>a.value===alias.value&&a.language===alias.language),'Lost historical alias '+item.url+' '+alias.value);
  else {const expected=saved.contextByEntity?.[entity]||saved.contextNames;assert.deepEqual(item.search.contextNames.slice(0,expected.length),expected,'Historical context order '+item.url);}
 }
 const query='كيرون';const hit=S.rank(search().shards.en.items,query,{category:'heroes',limit:1})[0];assert.equal(hit.url,'/en/heroes/kiron/');
});
