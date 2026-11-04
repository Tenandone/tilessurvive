'use strict';
const fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom');
const L=require('./lib/global-localization');
const clean=node=>(node?.textContent||'').replace(/\s+/g,' ').trim();
function build({locales,preview=false}={}) {
 const root=preview?path.resolve(L.ROOT,'../global-language-delivery-20261104/staging'):L.ROOT;
 const groups=L.routeGroups(),selected=locales||L.registry.locales.filter(l=>!L.existing.has(l.code)&&l.status==='published').map(l=>l.code),shards={};
 const original=L.readJSON(path.join(L.ROOT,'data/search-index.json'),{items:[]});
 for(const locale of selected) {
  const entries=new Map();
  for(const group of groups) {
   const route=group.routes[locale],file=path.join(root,route.slice(1),'index.html');
   if(!fs.existsSync(file))throw Error('Missing translated search destination: '+route);
   const d=parseHTML(fs.readFileSync(file,'utf8')).document;
   if(!preview&&(/noindex/.test(d.querySelector('meta[name="robots"]')?.content||'')||d.documentElement.dataset.translationStatus==='preview-unpublished'))throw Error('Cannot index unpublished page: '+route);
   const type=route.split('/')[2]?.replace(/s$/,'')||'home',english=original.items.find(x=>x.url===group.routes.en);
   const base={language:locale,type,title:clean(d.querySelector('title')),description:d.querySelector('meta[name="description"]')?.content||'',url:route};
   if(english?.aliases)base.aliases=english.aliases;
   entries.set(route,base);
   for(const el of d.querySelectorAll('main [data-search-entry][id],main [data-character-skills] .ts-skill[id],main details[id],main section[id^="pet-skill-"],main [data-hero-gear-levels-41][id],main [data-pet-training-block-41][id]')) {
    let heading=el.querySelector('summary,h2,h3,h4');
    if(!heading&&el.hasAttribute('data-pet-training-block-41')){let sibling=el.previousElementSibling;while(sibling&&!/^H[2-4]$/.test(sibling.tagName))sibling=sibling.previousElementSibling;heading=sibling;}
    let title=el.dataset.searchTitle||clean(heading);
    if(el.hasAttribute('data-hero-gear-levels-41'))title=clean(d.querySelector('main h1'))+' · '+title;
    if(!title||el.closest('[data-lootbar-slot]')||/ts3-data-table/.test(el.id))continue;
    entries.set(route+'#'+el.id,{language:locale,type,title,description:(el.dataset.searchDescription||clean(el.querySelector('p'))||base.description).slice(0,500),url:route+'#'+el.id});
   }
   for(const item of original.items.filter(x=>x.language==='en'&&x.url.startsWith(group.routes.en+'#'))){const fragment=item.url.slice(group.routes.en.length);if(!entries.has(route+fragment))throw Error('Missing localized search detail: '+route+fragment);}
  }
  const items=[...entries.values()].sort((a,b)=>a.url.localeCompare(b.url));
  L.safeWrite(path.join(root,'data/search',locale+'.json'),JSON.stringify({itemCount:items.length,items})+'\n');shards[locale]=items;
 }
 if(!preview&&selected.length) {
  const items=[...original.items.filter(x=>!selected.includes(x.language)),...Object.values(shards).flat()].sort((a,b)=>a.language.localeCompare(b.language)||a.title.localeCompare(b.title));
  const generatedAt=JSON.stringify(original.items)===JSON.stringify(items)?original.generatedAt:new Date().toISOString();
  L.safeWrite(path.join(root,'data/search-index.json'),JSON.stringify({generatedAt,itemCount:items.length,items},null,2)+'\n');
 }
 const result={mode:preview?'private-preview':'published-routes',shards:Object.fromEntries(Object.entries(shards).map(([code,items])=>[code,items.length]))};console.log(JSON.stringify(result));return result;
}
module.exports={build};
if(require.main===module){const arg=process.argv.find(x=>x.startsWith('--locales='));build({locales:arg?arg.slice(10).split(','):undefined,preview:process.argv.includes('--preview')});}
