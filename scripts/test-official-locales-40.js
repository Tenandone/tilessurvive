'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {execFileSync}=require('child_process'),{parseHTML}=require('linkedom');
const {entries,replaceLabels}=require('./lib/official-locales-40');
const root=path.resolve(__dirname,'..'),release='9a931a56a557686f84953d8854a9af2a41adf75d';
const langs=['ko','en','ja','ru','zh-tw'];
const vm=require('node:vm');
test('official labels cover existing 28 heroes and 7 pets in five locales',()=>{
 for(const lang of langs)for(const e of entries(lang)){
  const file=e.route.slice(1)+'index.html',d=parseHTML(fs.readFileSync(path.join(root,file),'utf8')).document;
  assert.equal(d.querySelector('h1').textContent,e.entity.names[lang],file);
  assert.ok(d.title.includes(e.entity.names[lang]),file+' title');
  if(e.type==='heroes')assert.deepEqual([...d.querySelectorAll('details.ts-skill summary>span')].map(n=>n.textContent),e.entity.skills.map(s=>s.name[lang]),file);
  assert.ok(![...d.querySelectorAll('details.ts-skill summary>span')].some(n=>/\{\d+\}|<color/.test(n.textContent)),file+' no unresolved game tokens');
 }
});
test('same production routes, canonical, hreflang and hero banners survive naming corrections',()=>{
 for(const lang of langs)for(const e of entries(lang)){
  const file=e.route.slice(1)+'index.html';
  const old=parseHTML(execFileSync('git',['show',release+':'+file],{cwd:root,encoding:'utf8',maxBuffer:5e6})).document;
  const current=parseHTML(fs.readFileSync(path.join(root,file),'utf8')).document;
  for(const selector of ['link[rel=canonical]','link[hreflang]','.ts-lootbar-slot'])assert.deepEqual([...current.querySelectorAll(selector)].map(n=>n.outerHTML),[...old.querySelectorAll(selector)].map(n=>n.outerHTML),file+' '+selector);
  const oldBodies=[...old.querySelectorAll('.ts-skill-body')],bodies=[...current.querySelectorAll('.ts-skill-body')];
  assert.equal(bodies.length,oldBodies.length,file+' complete skill panels');
  // Human-reviewed labels may change; every original displayed quantity must remain.
  oldBodies.forEach((body,i)=>{const numbers=s=>(s.normalize('NFKC').match(/\d+(?:[.,]\d+)*(?:%)?/g)||[]);assert.deepEqual(numbers(bodies[i].textContent),numbers(body.textContent),file+' existing skill quantities '+i);});
 }
});
test('renaming preserves old names for roster and site search',()=>{
 const index=JSON.parse(fs.readFileSync(path.join(root,'data/search-index.json'))).items;
 for(const lang of langs){
  const d=parseHTML(fs.readFileSync(path.join(root,lang,'heroes/index.html'),'utf8')).document;
  for(const e of entries(lang)){
   const indexed=index.find(i=>i.url===e.route);assert.ok(indexed, e.route);
   for(const alias of e.names)assert.ok(indexed.aliases.includes(alias),e.route+' alias '+alias);
   if(e.type==='heroes'){
    const card=d.querySelector('[data-character-id="'+e.entity.id+'"]');assert.ok(card,e.route+' roster');
    assert.ok(card.textContent.includes(e.entity.names[lang]),e.route+' official roster label');
    assert.ok(card.dataset.searchAliases.includes(e.entity.names.en),e.route+' English search alias');
   }
  }
 }
});
test('short labels never replace substrings or repeatedly expand names',()=>{
 assert.equal(replaceLabels('Roy Royal Roy42 (Roy)',[['Roy','ロイ']]),'ロイ Royal Roy42 (ロイ)');
 const pairs=[['Undine','ウンディーネ']];assert.equal(replaceLabels(replaceLabels('Undine',pairs),pairs),'ウンディーネ');
 assert.equal(replaceLabels('100.25% ATK',pairs),'100.25% ATK');
});
test('every generated changed client uses a new cache version across all five locales',()=>{
 const versions={'/js/platform.js':'5','/js/platform-search.js':'3','/js/product-30.js':'2','/js/foundation-40.js':'2'},counts=Object.fromEntries(Object.keys(versions).map(k=>[k,0]));
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
 for(const lang of langs)for(const file of walk(path.join(root,lang)).filter(f=>f.endsWith('.html'))){const d=parseHTML(fs.readFileSync(file,'utf8')).document;for(const script of d.querySelectorAll('script[src]')){const url=new URL(script.getAttribute('src'),'https://tilessurvive.net');if(versions[url.pathname]){assert.equal(url.searchParams.get('v'),versions[url.pathname],file+' '+url.pathname);counts[url.pathname]++;}}}
 for(const [file,count] of Object.entries(counts))assert.ok(count>=5,file+' used in all locales');
});
async function runSearchClient(kind,lang,items,query){
 const header=kind==='header',markup=header?'<form class="ts3-search-form"><input name="q"></form><script id="ts3-copy" type="application/json">{"allResults":"All results"}</script>':'<input id="siteSearchInput"><div id="siteSearchCount"></div><div id="siteSearchResults"></div>';
 const {document,window}=parseHTML(`<html data-lang="${lang}"><head></head><body>${markup}</body></html>`),requests=[];
 window.TS_COPY={[lang]:{results:'results',loading:'loading',noResults:'no results',error:'error',filter:'filter',sort:'sort',all:'all',original:'original',name:'name'}};
 const input=document.querySelector('input');
 vm.runInNewContext(fs.readFileSync(path.join(root,'js',header?'product-30.js':'platform-search.js'),'utf8'),{document,window,URL,URLSearchParams,location:{search:'?q='+encodeURIComponent(query)},setTimeout,clearTimeout,addEventListener:()=>{},fetch:async(url,options)=>{requests.push({url,cache:options?.cache});return{ok:true,json:async()=>({items})};}});
 if(header){input.value=query;input.dispatchEvent(new window.Event('focus'));}
 await new Promise(resolve=>setImmediate(resolve));
 const links=()=>[...document.querySelectorAll(header?'.ts3-search-results a:not(.ts3-search-all)':'#siteSearchResults a')].map(a=>a.getAttribute('href'));
 assert.deepEqual(requests,[{url:'/data/search-index.json',cache:'no-cache'}],kind+' revalidates index');
 return {document,window,input,links,requests};
}
for(const kind of ['header','page'])test(kind+' search executes alias-only matching, language filtering and empty-state recovery',async()=>{
 for(const lang of langs){
  const query='old-name-'+lang,route='/'+lang+'/heroes/freya/';
  const items=[{language:lang,title:'Current official name',description:'Current description',type:'heroes',url:route,aliases:query},{language:lang==='ko'?'en':'ko',title:'Other language',description:'',type:'heroes',url:'/other/',aliases:query}];
  const state=await runSearchClient(kind,lang,items,query);assert.deepEqual(state.links(),[route],kind+' alias-only '+lang);
  state.input.value='unmatched-search-term';state.input.dispatchEvent(new state.window.Event(kind==='header'?'focus':'input'));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(state.links(),[]);
  state.input.value=query;state.input.dispatchEvent(new state.window.Event(kind==='header'?'focus':'input'));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(state.links(),[route]);assert.equal(state.requests.length,1,'One revalidated index per document');
 }
 const actual=JSON.parse(fs.readFileSync(path.join(root,'data/search-index.json'))).items;
 const korean=await runSearchClient(kind,'ko',actual,'프레이아');assert.deepEqual(korean.links(),['/ko/heroes/freya/'],'Actual returning-user Korean alias');
});
