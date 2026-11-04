'use strict';
// DOM/VM tests are deterministic code tests, not a claim of browser rendering.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {parseHTML}=require('linkedom'),S=require('../js/v3-search-core'),B=require('./build-v3-search');
const ROOT=path.resolve(__dirname,'..'),codes=require('../data/i18n/locales.json').locales.map(r=>r.code),terms=require('../data/i18n/client-terms.json'),contextual=require('../data/i18n/contextual-terms.json').entries;
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8'),digest=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex');
const sourceFiles=codes.map(code=>'data/search/'+code+'.json').concat(['data/i18n/client-terms.json','data/i18n/contextual-terms.json']);
const before=Object.fromEntries(sourceFiles.map(file=>[file,digest(file)]));
const result=B.collect(),shards=result.shards;
const atlasRoutes=require('./build-hero-atlas-search').atlasRoutes();
function verifyNameProvenance(item,alias){
  assert(['site-label','site-alias','retained-client','retained-english-fallback'].includes(alias.source));
  if(!['retained-client','retained-english-fallback'].includes(alias.source))return false;
  const hero=atlasRoutes.get(item.url)?.hero;
  if(hero){
    assert.deepEqual(item.search.clientIds,[{kind:'hero',id:hero.clientId}],'Route-bound hero client identity');
    assert.equal(item.search.hero?.clientId,hero.clientId);assert.equal(item.search.hero?.nameKey,hero.nameKey);
    assert.equal(alias.termKey,hero.nameKey,'A hero name must use its exact retained key');
    const name=hero.names[alias.language];assert(name,'Missing retained/fallback name record');assert.equal(alias.value,name.value,'Exact client name or explicit English fallback');
    const fallback=['ar','vi','nb'].includes(alias.language);
    assert.equal(name.status,fallback?'english-fallback':'client-official');
    assert.equal(alias.source,fallback?'retained-english-fallback':'retained-client','Never claim an authored locale is a retained official translation');
    if(fallback)assert.equal(alias.value,hero.names.en.value,'Fallback must retain the exact English game name');
    else assert(terms.locales[alias.language]?.cohort,'Official language requires a retained corpus');
    return !fallback;
  }
  assert.equal(alias.source,'retained-client','English fallback is scoped to an exact reviewed hero name');
  assert(terms.locales[alias.language]?.cohort);assert(!['ar','vi','nb'].includes(alias.language));
  const context=contextual.find(row=>row.clientKey===alias.termKey);
  assert.equal(alias.value,terms.terms[alias.termKey]?.[alias.language]??context?.names[alias.language]?.value);
  return true;
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(code,{header=false,query='',payload=shards[code],fetcher}={}){
  const {window,document}=parseHTML(read(code+'/search/index.html'));
  let url=new URL('http://localhost:4173/'+code+'/search/'+query);
  const location={};
  for(const key of ['href','origin','pathname','search','hash','hostname'])Object.defineProperty(location,key,{get:()=>url[key],set:value=>{if(key==='href')url=new URL(value,url);else url[key]=value;}});
  window.location=location;window.history={replaceState(_a,_b,next){location.href=next;}};
  // linkedom intentionally omits browser select.value setters. Supply the
  // browser's selection semantics only; no production search behavior is mocked.
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this._selectedValue??this.querySelector('option')?.value??'';},set(value){this._selectedValue=[...this.options].some(o=>o.value===String(value))?String(value):'';}});
  const timers=new Map();let timerId=0;const requests=[];
  const context=vm.createContext({window,document,location,URL,URLSearchParams,console,
    setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},
    addEventListener:window.addEventListener.bind(window),
    fetch:async endpoint=>{requests.push(endpoint);return fetcher?fetcher(endpoint):{ok:true,json:async()=>payload};}});
  const run=name=>vm.runInContext(read('js/'+name),context,{filename:name});
  run('site-locales.js');run('platform-i18n.js');run('v3-search-core.js');
  if(header)run('product-30.js');else run('platform-search.js');
  document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return {window,document,location,requests,context,run,
    event(node,type,properties={}){const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,properties);node.dispatchEvent(e);return e;},
    flush(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());},
    input:header?document.querySelector('.ts3-search-form input[name=q]'):document.getElementById('siteSearchInput')};
}

test('derived collection preserves every original record, field, URL, anchor and source byte',()=>{
  assert.equal(result.summary.locales,21);
  for(const code of codes){
    const source=JSON.parse(read('data/search/'+code+'.json'));
    assert.deepEqual(shards[code].items.map(({search,...item})=>item),source.items,code);
    assert.equal(shards[code].itemCount,source.itemCount);
    for(const item of shards[code].items){
      assert.match(item.search.entityId,/^page:/);assert(item.url.startsWith('/'+code+'/'));
      if(item.url.includes('#'))assert(item.search.entityId.endsWith(item.url.slice(item.url.indexOf('#'))));
    }
  }
  assert.equal(result.summary.originalRecords,result.summary.outputRecords);
  for(const file of sourceFiles)assert.equal(digest(file),before[file],file);
});

test('all 21 languages resolve Korean and English entity names to the same canonical entity',()=>{
  for(const code of codes)for(const [query,entity] of [['발전소','page:buildings/power-plant/'],['Power Plant','page:buildings/power-plant/'],['샤크','page:heroes/shark/'],['Shark','page:heroes/shark/'],['타잔','page:heroes/tazan/'],['Tarzan','page:heroes/tazan/']]){
    const hit=S.rank(shards[code].items,query)[0];assert(hit,code+':'+query);assert.equal(hit.search.entityId,entity,code+':'+query);assert(!hit.url.includes('#'));
  }
  assert.equal(S.rank(shards.ko.items,'Tarzan')[0].url,'/ko/heroes/tarzan/');
  assert.equal(S.rank(shards.en.items,'타잔')[0].url,'/en/heroes/tazan/');
});

test('skill searches retain working exact anchors, owner context and distinct historical aliases',()=>{
  const en=shards.en.items.find(i=>i.url==='/en/heroes/shark/#character-skill-0-0');
  const ko=en.search.aliases.find(a=>a.language==='ko'&&a.source==='retained-client').value;
  for(const code of codes)for(const query of ['Crashing Wave',ko]){
    const hit=S.rank(shards[code].items,query)[0];assert.equal(hit.search.entityId,en.search.entityId,code+':'+query);assert(hit.url.endsWith('#character-skill-0-0'));
  }
  for(const code of codes){
    const hits=S.rank(shards[code].items,'Shark Crashing Wave');assert.equal(hits[0].search.entityId,en.search.entityId);
    const undine=S.rank(shards[code].items,'Pelagic Resonance')[0];assert.equal(undine.search.entityId,'page:heroes/undine/#character-skill-0-2');
    assert(!undine.search.aliases.some(a=>a.termKey?.startsWith('survivor_travis_')));
  }
});

test('official provenance is exact and entity-scoped; authored locales never masquerade as retained client terms',()=>{
  const seen=new Set();
  for(const item of shards.en.items)for(const alias of item.search.aliases){
    if(verifyNameProvenance(item,alias))seen.add(alias.language);
  }
  assert.equal(seen.size,18);
  const hero=shards.en.items.find(item=>item.url==='/en/heroes/beka/'),fallback=hero.search.aliases.find(a=>a.language==='ar'&&a.source==='retained-english-fallback');assert(fallback);
  for(const mutation of [{...fallback,source:'retained-client'},{...fallback,language:'fr'},{...fallback,value:'Invented localized name'},{...fallback,termKey:'survivor_ray_name'}])assert.throws(()=>verifyNameProvenance(hero,mutation));
  const wrongIdentity=structuredClone(hero);wrongIdentity.search.clientIds[0].id++;assert.throws(()=>verifyNameProvenance(wrongIdentity,fallback));
  assert.throws(()=>verifyNameProvenance({...hero,url:'/en/heroes/beka/#unreviewed-skill'},fallback));
  const keys=url=>new Set(shards.en.items.find(i=>i.url===url).search.aliases.map(a=>a.termKey).filter(Boolean));
  assert.deepEqual(keys('/en/heroes/candy/'),new Set(['survivor_candy_name']));
  assert.deepEqual(keys('/en/database/pet-system/snowball/'),new Set(['pet_seal_normal_name']));
  assert.deepEqual(keys('/en/buildings/lookout-tower/'),new Set(['watchtower_name']));
  assert(!keys('/en/heroes/ray/#character-skill-0-3').has('research_troop_attack_name_8'));
  assert(!keys('/en/heroes/freya/#character-skill-0-3').has('pet_fox_skill_3_name'));
  const power=shards.en.items.find(i=>i.url==='/en/buildings/power-plant/');assert.deepEqual(power.search.clientIds,[{kind:'building',id:800005}]);
});

test('relevance orders exact names, exact aliases, prefixes and body matches without mutating records',()=>{
  const rows=[
    {title:'Article',description:'Power Plant upgrade',type:'guide',url:'/en/guides/x/'},
    {title:'Plant engineering',type:'building',url:'/en/buildings/alias-prefix/',search:{aliases:[{value:'Power Plant extended'}]}},
    {title:'Power Plant extended',type:'building',url:'/en/buildings/prefix/'},
    {title:'Localized name',type:'building',url:'/en/buildings/alias/',search:{aliases:[{value:'Power Plant'}]}},
    {title:'Power Plant',type:'building',url:'/en/buildings/exact/'}];
  const snapshot=JSON.stringify(rows);
  assert.deepEqual(S.rank(rows,'  Ｐｏｗｅｒ   Plant ').map(r=>r.url),[4,3,2,1,0].map(i=>rows[i].url));
  assert.equal(S.rank(rows,'Power Plant',{category:'buildings'}).length,4);
  assert.equal(S.rank(rows,'Power Plant',{category:'guides'})[0],rows[0]);
  assert.deepEqual(S.rank(rows,'Power Plant',{sort:'name'}).map(r=>r.title),rows.map(r=>r.title).sort((a,b)=>a.localeCompare(b,'en')));
  assert.equal(S.rank(rows,'',{category:'buildings'}).length,4);assert.deepEqual(S.rank(rows,''),[]);
  assert.equal(S.rank(rows,'Power Plant',{limit:2}).length,2);assert.deepEqual(S.rank(rows,'unfindable'),[]);
  assert.equal(JSON.stringify(rows),snapshot);
});

test('URL state preserves unrelated fields and fragments, resets cleanly and propagates to every language',()=>{
  const state={q:'발전소 & Power',category:'buildings',sort:'name'};
  const next=S.stateUrl('/ko/search/?origin=test#results',state),url=new URL(next,'https://tilessurvive.net');
  assert.deepEqual(S.readState(next),state);assert.equal(url.searchParams.get('origin'),'test');assert.equal(url.hash,'#results');
  assert.equal(S.stateUrl(next,{q:'',category:'',sort:''}),'/ko/search/?origin=test#results');
  assert.deepEqual(S.readState('/ko/search/?sort=invalid'),{q:'',category:'',sort:''});
  const {document}=parseHTML(read('ko/search/index.html')),loc={href:url.href,origin:url.origin};
  assert.equal(S.syncLanguageLinks(document,loc,require('../js/site-locales')),21);
  for(const a of document.querySelectorAll('a[hreflang]')){
    const href=new URL(a.getAttribute('href'),url);assert.deepEqual(S.readState(href.href),state);assert.equal(href.hash,'#results');assert.equal(href.searchParams.get('origin'),'test');
  }
});

test('full-search DOM loads all 21 correct shards, ranks cross-language names and preserves q/category/sort in navigation',async()=>{
  for(const code of codes){
    const b=harness(code,{query:'?q='+encodeURIComponent('발전소')+'&category=buildings&sort=name#results'});await tick();
    assert.deepEqual(b.requests,['/data/v3-search/'+code+'.json']);
    const controls=b.document.querySelectorAll('.ts-controls select');assert.equal(controls[0].value,'buildings');assert.equal(controls[1].value,'name');
    const links=[...b.document.querySelectorAll('#siteSearchResults article a')];assert(links.some(a=>a.getAttribute('href').includes('/buildings/power-plant/')));
    assert(links.every(a=>a.getAttribute('href').startsWith('/'+code+'/')));
    controls[0].value='heroes';controls[1].value='';b.input.value='Shark';b.event(b.input,'input');
    assert.equal(b.document.querySelector('#siteSearchResults article a').getAttribute('href'),'/'+code+'/heroes/shark/');
    assert.deepEqual(S.readState(b.location),{q:'Shark',category:'heroes',sort:''});assert.equal(b.location.hash,'#results');
    for(const a of b.document.querySelectorAll('a[hreflang]'))assert.deepEqual(S.readState(a.getAttribute('href')),{q:'Shark',category:'heroes',sort:''});
    b.location.href='/'+code+'/search/?q=Power+Plant&category=buildings';b.window.dispatchEvent(new b.window.Event('popstate'));
    assert.equal(b.input.value,'Power Plant');assert.equal(controls[0].value,'buildings');assert(b.document.querySelector('#siteSearchResults article a').getAttribute('href').endsWith('/buildings/power-plant/'));
  }
});

test('header suggestions use the same ranking in all 21 locales and keep keyboard selection / all-results state',async()=>{
  for(const code of codes){
    const b=harness(code,{header:true,query:'?category=heroes&sort=name'});b.input.value='샤크';b.event(b.input,'input');b.flush();await tick();
    assert.deepEqual(b.requests,['/data/v3-search/'+code+'.json']);
    const box=b.document.querySelector('.ts3-search-results'),options=[...box.querySelectorAll('[role=option]')];assert(!box.hidden);assert(options.length<=7);assert.equal(options[0].getAttribute('href'),'/'+code+'/heroes/shark/');
    options.forEach(a=>a.scrollIntoView=()=>{});
    const down=b.event(b.input,'keydown',{key:'ArrowDown'});assert(down.defaultPrevented);assert.equal(b.input.getAttribute('aria-activedescendant'),options[0].id);
    b.event(b.input,'keydown',{key:'ArrowUp'});assert.equal(b.input.getAttribute('aria-activedescendant'),options.at(-1).id);
    assert.deepEqual(S.readState(options.at(-1).getAttribute('href')),{q:'샤크',category:'heroes',sort:'name'});
    b.event(b.input,'keydown',{key:'Escape'});assert(box.hidden);assert.equal(b.input.getAttribute('aria-expanded'),'false');assert(!b.input.hasAttribute('aria-activedescendant'));
    b.event(b.input,'focus');await tick();options[0].scrollIntoView=()=>{};box.querySelector('[role=option]').scrollIntoView=()=>{};
    b.event(b.input,'keydown',{key:'ArrowDown'});const enter=b.event(b.input,'keydown',{key:'Enter'});assert(enter.defaultPrevented);assert.equal(b.location.pathname,'/'+code+'/heroes/shark/');
  }
});

test('full-search handles failed loads with localized retry and never renders foreign-locale injection',async()=>{
  let attempts=0;const b=harness('fr',{query:'?q=Shark',fetcher:async()=>++attempts===1?{ok:false}:{ok:true,json:async()=>({items:[...shards.fr.items,{language:'en',title:'Shark English only',url:'/en/evil/',type:'hero'}]})}});await tick();
  const retry=b.document.querySelector('#siteSearchResults button');assert(retry);assert.equal(retry.textContent,b.window.TS_I18N.require('fr').retry);retry.onclick();await tick();
  assert.equal(attempts,2);assert(!b.document.querySelector('#siteSearchResults').textContent.includes('English only'));assert(b.document.querySelector('#siteSearchResults article'));
});

test('late suggestion responses cannot reopen Escape-dismissed results or replace newer input',async()=>{
  let resolve;const b=harness('fr',{header:true,fetcher:()=>new Promise(done=>resolve=done)});
  b.input.value='Shark';b.event(b.input,'input');b.flush();b.event(b.input,'keydown',{key:'Escape'});
  resolve({ok:true,json:async()=>shards.fr});await tick();assert(b.document.querySelector('.ts3-search-results').hidden);
  b.input.value='Power Plant';b.event(b.input,'input');b.flush();await tick();assert(b.document.querySelector('.ts3-search-results a').getAttribute('href').endsWith('/power-plant/'));
  const form=b.document.querySelector('.ts3-search-form');b.event(form,'submit');assert.deepEqual(S.readState(b.location),{q:'Power Plant',category:'',sort:''});
});
