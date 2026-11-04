(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TS_V3_SEARCH=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/\s+/gu,' ').trim();
  const categories={heroe:'heroes',hero:'heroes',building:'buildings',behemoth:'database',code:'codes',event:'events','event-helper':'events',guide:'guides',season:'seasons',tool:'tools','top-up':'topup',update:'events',about:'related',contact:'related',privacy:'related',term:'related','affiliate-disclosure':'affiliate',home:'related',search:'related'};
  const category=value=>categories[value]||value||'related';
  const aliases=item=>(item.search?.aliases||[]).map(a=>typeof a==='string'?a:a.value).filter(Boolean);
  function score(item,query){
    const q=normalize(query);if(!q)return 0;
    const title=normalize(item.search?.primaryName||item.title),full=normalize(item.title),names=aliases(item).map(normalize);
    const words=q.split(' '),body=normalize([item.description,item.aliases,item.type,item.url,item.search?.entityId,...(item.search?.contextNames||[]),...names].join(' '));
    if(!words.every(w=>title.includes(w)||full.includes(w)||body.includes(w)))return -1;
    if(title===q||full===q)return 1000;
    if(names.includes(q))return 900;
    if(title.startsWith(q)||full.startsWith(q))return 800;
    if(names.some(a=>a.startsWith(q)))return 700;
    if(title.includes(q)||full.includes(q))return 600;
    if(names.some(a=>a.includes(q)))return 500;
    if(words.every(w=>title.includes(w)||full.includes(w)||names.some(a=>a.includes(w))))return 400;
    const context=(item.search?.contextNames||[]).map(normalize);
    if(words.every(w=>title.includes(w)||full.includes(w)||names.some(a=>a.includes(w))||context.some(a=>a.includes(w))))return 300;
    return 100;
  }
  function rank(items,query,{category:filter='',sort='',limit=Infinity,locale='en'}={}){
    const q=normalize(query);if(!q&&!filter)return [];
    return items.map((item,index)=>({item,index,score:score(item,q)})).filter(r=>r.score>=0&&(!filter||category(r.item.search?.category||r.item.type)===category(filter))).sort((a,b)=>{
      if(sort==='name')return a.item.title.localeCompare(b.item.title,locale)||a.index-b.index;
      return b.score-a.score||Number(!!a.item.url?.includes('#'))-Number(!!b.item.url?.includes('#'))||a.index-b.index;
    }).slice(0,Number.isFinite(limit)?Math.max(0,Math.floor(limit)):undefined).map(r=>r.item);
  }
  function readState(location){const url=new URL(typeof location==='string'?location:location.href,'https://tilessurvive.net');return {q:url.searchParams.get('q')||'',category:url.searchParams.get('category')||'',sort:url.searchParams.get('sort')==='name'?'name':''};}
  function stateUrl(location,state){const url=new URL(typeof location==='string'?location:location.href,'https://tilessurvive.net');for(const key of ['q','category','sort']){const value=String(state[key]??'');if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);}return url.pathname+url.search+url.hash;}
  function syncLanguageLinks(document,location,locales){
    if(!locales?.resolvePageUrl)return 0;let changed=0;
    for(const anchor of document.querySelectorAll('a[hreflang]')){
      const route=locales.resolvePageUrl(anchor.getAttribute('hreflang'),{document,location,preserveState:true});
      if(route){anchor.setAttribute('href',route);changed++;}
    }
    return changed;
  }
  return Object.freeze({normalize,category,score,rank,readState,stateUrl,syncLanguageLinks});
});
