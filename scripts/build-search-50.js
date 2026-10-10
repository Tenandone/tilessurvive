'use strict';
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw','de'];
const old=JSON.parse(fs.readFileSync(path.join(ROOT,'data/search-index.json'),'utf8'));
// Preserve the original curated five-language anchors; extend only public HTML.
const entries=new Map(old.items.filter(x=>x.language!=='de').map(x=>[x.url,x]));
const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name==='index.html'?[path.join(d,e.name)]:[]):[];
const text=e=>(e?.textContent||'').replace(/\s+/g,' ').trim();
for(const lang of langs)for(const file of walk(path.join(ROOT,lang))){
 const d=parseHTML(fs.readFileSync(file,'utf8')).document;
 if(/noindex/.test(d.querySelector('meta[name=robots]')?.content||''))continue;
 const url='/'+path.relative(ROOT,file).replaceAll('\\','/').replace(/index\.html$/,'');
 if(d.querySelector('link[rel=canonical]')?.href!=='https://tilessurvive.net'+url)continue;
 const type=url.split('/')[2]?.replace(/s$/,'')||'home';
 const item={language:lang,type,title:text(d.querySelector('title')),description:d.querySelector('meta[name=description]')?.content||'',url};
 const prior=entries.get(url);entries.set(url,{...prior,...item});
 const shared='main [data-search-entry][id],main [data-character-skills] .ts-skill[id]';
 const selectors=lang==='de'?shared+',main details[id],main section[id^="pet-skill-"]':shared;
 for(const el of d.querySelectorAll(selectors)){
  const title=el.dataset.searchTitle||text(el.querySelector('summary,h2,h3,h4'));
  if(!title||el.closest('[data-lootbar-slot]')||/ts3-data-table/.test(el.id))continue;
  const description=el.dataset.searchDescription||text(el.querySelector('p'))||item.description;
  const anchor={language:lang,type,title,description:description.slice(0,500),url:url+'#'+el.id};
  entries.set(anchor.url,anchor);
 }
}
const items=[...entries.values()].sort((a,b)=>a.language.localeCompare(b.language)||a.title.localeCompare(b.title));
const generatedAt=JSON.stringify(old.items)===JSON.stringify(items)?old.generatedAt:new Date().toISOString();
fs.writeFileSync(path.join(ROOT,'data/search-index.json'),JSON.stringify({generatedAt,itemCount:items.length,items},null,2)+'\n');
fs.mkdirSync(path.join(ROOT,'data/search'),{recursive:true});
const shards={};
for(const lang of langs){const local=items.filter(x=>x.language===lang),out=JSON.stringify({itemCount:local.length,items:local});fs.writeFileSync(path.join(ROOT,'data/search',lang+'.json'),out+'\n');shards[lang]={entries:local.length,bytes:Buffer.byteLength(out)+1};}
console.log(JSON.stringify({product50:'search-shards',total:items.length,shards}));
