'use strict';
// Narrow projection over existing search records. No legacy search regeneration.
// Existing URLs/order and non-main-hero records are preserved exactly.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..'),ORIGIN='https://tilessurvive.net';
const read=(root,file)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const clean=value=>String(value||'').replace(/\s+/gu,' ').trim();
function atlasRoutes(root=ROOT){
 const dFile=path.join(root,'data/hero-atlas-client.json'),rFile=path.join(root,'data/hero-atlas-routes.json');
 if(!fs.existsSync(dFile)&&!fs.existsSync(rFile))return new Map();
 assert(fs.existsSync(dFile)&&fs.existsSync(rFile),'Atlas client and routes must exist together');
 const data=read(root,'data/hero-atlas-client.json'),routeData=read(root,'data/hero-atlas-routes.json'),map=new Map();
 for(const entry of routeData.heroes){
  const hero=data.heroes.find(h=>h.id===entry.id);assert(hero&&hero.variant==='base','Only explicit base identity routes are searchable');
  for(const [locale,route]of Object.entries(entry.routes)){assert(route.startsWith('/'+locale+'/heroes/'));assert(!map.has(route),'Duplicate atlas route '+route);map.set(route,{hero,locale});}
 }
 return map;
}
function collect({root=ROOT}={}){
 const routes=atlasRoutes(root),locales=read(root,'data/i18n/locales.json').locales.map(l=>l.code);
 const publication=read(root,'data/hero-atlas-publication.json');
 assert.deepEqual(publication.newPublished.map(h=>h.id),['lava'],'New identities require explicit search review');
 const updates=new Map(),newRows=new Map(),shards={},summary={locales:locales.length,mainRecords:0,mainRecordsChanged:0,recordsAdded:0,nonMainRecordsPreserved:0,shards:{}};
 for(const locale of locales){
  const input=read(root,'data/search/'+locale+'.json');assert.equal(input.itemCount,input.items.length);
  const byUrl=new Map(input.items.map(i=>[i.url,i]));assert.equal(byUrl.size,input.items.length,'Duplicate existing search URL');
  const localeUpdates=new Map(),additions=[];
  for(const [route,{hero,locale:lang}]of routes){
   if(lang!==locale)continue;
   const file=path.resolve(root,'.'+route,'index.html');assert(file.startsWith(path.resolve(root)+path.sep));
   const {document:d}=parseHTML(fs.readFileSync(file,'utf8'));
   assert.equal(new URL(d.querySelector('link[rel="canonical"]')?.getAttribute('href'),ORIGIN).href,ORIGIN+route,'Atlas canonical mismatch '+route);
   const title=clean(d.querySelector('title')?.textContent),description=clean(d.querySelector('meta[name="description"]')?.getAttribute('content'));
   assert(title&&description,'Missing atlas search metadata '+route);
   const old=byUrl.get(route);assert(old||hero.id==='lava','A retained hero main record must already exist '+route);
   const record=old?{...old,title,description}:{language:locale,type:'heroe',title,description,url:route};
   localeUpdates.set(route,record);updates.set(route,record);summary.mainRecords++;
   if(old&&JSON.stringify(old)!==JSON.stringify(record))summary.mainRecordsChanged++;
   if(!old)additions.push(record);
   if(hero.id==='lava')for(const anchor of ['lava-skills','lava-growth']){
    const section=d.getElementById(anchor);assert(section,'Missing published Lava anchor '+anchor);
    const sectionTitle=clean(section.querySelector('h2')?.textContent),sectionDescription=clean(section.querySelector('p')?.textContent);assert(sectionTitle&&sectionDescription);
    const url=route+'#'+anchor,prior=byUrl.get(url),row=prior?{...prior,title:sectionTitle,description:sectionDescription}:{language:locale,type:'heroe',title:sectionTitle,description:sectionDescription,url};
    localeUpdates.set(url,row);updates.set(url,row);if(!prior)additions.push(row);
   }
  }
  const items=input.items.map(item=>localeUpdates.get(item.url)||item).concat(additions);
  assert.deepEqual(items.slice(0,input.items.length).map(i=>i.url),input.items.map(i=>i.url),'Existing URL order');
  for(const item of input.items)if(!localeUpdates.has(item.url)){assert.deepEqual(items.find(i=>i.url===item.url),item);summary.nonMainRecordsPreserved++;}
  assert.equal(new Set(items.map(i=>i.url)).size,items.length);
  for(const row of additions){assert(row.url===`/${locale}/heroes/lava/`||row.url.startsWith(`/${locale}/heroes/lava/#lava-`));newRows.set(row.url,row);}
  shards[locale]={...input,itemCount:items.length,items};summary.recordsAdded+=additions.length;summary.shards[locale]={before:input.items.length,after:items.length,added:additions.length};
 }
 const aggregate=read(root,'data/search-index.json');assert.equal(aggregate.itemCount,aggregate.items.length);
 const oldAggregateUrls=new Set(aggregate.items.map(i=>i.url));assert.equal(oldAggregateUrls.size,aggregate.items.length);
 const allShardRows=new Map(Object.values(shards).flatMap(s=>s.items.map(i=>[i.url,i])));
 const aggregateItems=aggregate.items.map(item=>updates.get(item.url)||item);
 for(const row of newRows.values())if(!oldAggregateUrls.has(row.url))aggregateItems.push(row);
 assert.equal(aggregateItems.length,allShardRows.size,'Aggregate/shard identity parity');
 for(const row of aggregateItems)assert.deepEqual(row,allShardRows.get(row.url),'Aggregate/shard content parity '+row.url);
 assert.deepEqual(aggregateItems.slice(0,aggregate.items.length).map(i=>i.url),aggregate.items.map(i=>i.url));
 summary.aggregate={before:aggregate.items.length,after:aggregateItems.length,added:aggregateItems.length-aggregate.items.length};
 return {shards,aggregate:{...aggregate,itemCount:aggregateItems.length,items:aggregateItems},summary};
}
function build(options={}){
 const root=options.root||ROOT,result=collect(options);let changed=0;
 for(const [file,value]of [...Object.entries(result.shards).map(([locale,shard])=>['data/search/'+locale+'.json',shard]),['data/search-index.json',result.aggregate]]){
  const target=path.join(root,file),output=JSON.stringify(value,null,file==='data/search-index.json'?2:undefined)+'\n';if(fs.readFileSync(target,'utf8')!==output){fs.writeFileSync(target,output);changed++;}
 }
 console.log(JSON.stringify({...result.summary,filesChanged:changed}));return result;
}
module.exports={atlasRoutes,collect,build};if(require.main===module)build();
