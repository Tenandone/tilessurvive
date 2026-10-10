'use strict';
const assert=require('node:assert/strict'),chests=require('../build-item-chest-rewards-41');
function assertSearchExtension(before,after){
 const old=typeof before==='object'&&!Buffer.isBuffer(before)?before:JSON.parse(String(before)),now=typeof after==='object'&&!Buffer.isBuffer(after)?after:JSON.parse(String(after));
 const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom'),root=path.resolve(__dirname,'../..');
 const added=chests.entries();assert.equal(new Set(added.map(x=>x.url)).size,15);
 const immutable=JSON.parse(require('child_process').execFileSync('git',['show','5c5958b3d1a9c42d1ed33abe79e3fbd25b976cbe:data/search-index.json'],{cwd:root,encoding:'utf8',maxBuffer:8e6}));
 const expected=new Map([...immutable.items,...added].filter(x=>x.language!=='de').map(x=>[x.url,x]));
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name==='index.html'?[path.join(d,e.name)]:[]);
 const text=n=>(n?.textContent||'').replace(/\s+/g,' ').trim();
 for(const lang of ['ko','en','ja','ru','zh-tw','de'])for(const file of walk(path.join(root,lang))){
  const d=parseHTML(fs.readFileSync(file,'utf8')).document,url='/'+path.relative(root,file).replaceAll('\\','/').replace(/index\.html$/,'');
  if(/noindex/.test(d.querySelector('meta[name=robots]')?.content||'')||d.querySelector('link[rel=canonical]')?.href!=='https://tilessurvive.net'+url)continue;
  const type=url.split('/')[2]?.replace(/s$/,'')||'home',page={language:lang,type,title:text(d.querySelector('title')),description:d.querySelector('meta[name=description]')?.content||'',url};
  expected.set(url,{...expected.get(url),...page});
  const selector='main [data-search-entry][id],main [data-character-skills] .ts-skill[id]'+(lang==='de'?',main details[id],main section[id^="pet-skill-"]':'');
  for(const node of d.querySelectorAll(selector)){
   const title=node.dataset.searchTitle||text(node.querySelector('summary,h2,h3,h4'));if(!title||node.closest('[data-lootbar-slot]')||/ts3-data-table/.test(node.id))continue;
   expected.set(url+'#'+node.id,{language:lang,type,title,description:(node.dataset.searchDescription||text(node.querySelector('p'))||page.description).slice(0,500),url:url+'#'+node.id});
  }
 }
 const items=[...expected.values()].sort((a,b)=>a.language.localeCompare(b.language)||a.title.localeCompare(b.title));
 assert.deepEqual(Object.keys(now).sort(),Object.keys(old).sort());assert(Number.isFinite(Date.parse(now.generatedAt)));
 assert.equal(now.itemCount,items.length);assert.equal(now.items.length,items.length);assert.equal(new Set(now.items.map(i=>i.url)).size,items.length);
 assert.deepEqual(now.items,items,'Every prior source entry and exact rendered six-language page/anchor projection');
 for(const entry of old.items)assert(now.items.some(x=>x.url===entry.url),'Old searchable URL retained '+entry.url);
}
function withoutChestSearch(current){
 const urls=new Set(chests.entries().map(i=>i.url)),items=current.items.filter(i=>!urls.has(i.url));
 const prior={...current,itemCount:items.length,items};assertSearchExtension(prior,current);return prior;
}
module.exports={assertSearchExtension,withoutChestSearch};
