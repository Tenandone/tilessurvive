/* Progressive table access and native card links. No navigation click handler,
   calculator, storage, network, tracking, or game-data ownership. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.TS_V6_SYSTEM=api;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>api.mount(document,root),{once:true});else api.mount(document,root);}})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const selector='.xssr-table-wrap,.v4-table-wrap,.r60-scroll,.pet-skill-table-wrap,.ts3-table-scroll,.ts-table-wrap,.ts50-scroll,.table-wrap,.table-scroll,[data-atlas-comparison-table],.ten-payout-table,.v5-score-table,.v6-score-table,.desktop-table';
 const cardRules=[['.hero-atlas-card','a[href]'],['.ts3-pet-tile','h3 a[href]'],['.hp-card','.hp-card-head'],['.building-card','.building-link'],['.tool-card','.tool-link'],['.guide-card','.guide-link'],['.database-card','.database-link'],['.behemoth-card','.behemoth-link'],['.content-card','h2 a[href],h3 a[href],h4 a[href],a.btn[href]'],['.v3-event-card','.v3-event-link']];
 function titleFor(node){
  const table=node.querySelector('table'),caption=table&&table.querySelector('caption');
  const heading=node.closest('section,article,details')?.querySelector('h2,h3,h4,summary')||node.closest('main')?.querySelector('h1');
  return (caption?.textContent||table?.getAttribute('aria-label')||heading?.textContent||'').replace(/\s+/g,' ').trim().slice(0,180);
 }
 function mount(doc,host){
  if(!doc.documentElement.hasAttribute('data-v6-system'))return {refresh(){},destroy(){}};
  const states=new Map(),cards=new Map(),images=new Map();let observer,resize,frame=null,stopped=false;
  function restore(node,state){for(const [key,value]of Object.entries(state)){if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);}}
  function mark(node,key,value=''){if(!cards.has(node))cards.set(node,{});const initial=cards.get(node);if(!Object.hasOwn(initial,key))initial[key]=node.getAttribute(key);node.setAttribute(key,value);}
  function cardLinks(){
   for(const [node,state]of cards)restore(node,state);cards.clear();
   for(const img of doc.querySelectorAll('main img[data-v61-source]'))images.set(img.getAttribute('data-v61-source'),Object.fromEntries(['src','width','height','data-v61-image'].map(k=>[k,img.getAttribute(k)])));
   for(const img of doc.querySelectorAll('main img[src]')){const image=images.get(img.getAttribute('src'));if(image&&!img.closest('[data-v5-home],[data-v61-ten]'))for(const [key,value]of Object.entries(image))mark(img,key,value);}
   for(const [selector,primary]of cardRules)for(const card of doc.querySelectorAll('main '+selector)){
    if(card.closest('[data-v5-home],[data-v61-ten]')||card.querySelector('[data-v61-card]'))continue;
    const link=card.querySelector(primary),href=link?.getAttribute('href');
    if(!href||!href.startsWith('/')||href.startsWith('//')||link.hasAttribute('download')||link.closest('button,label,summary'))continue;
    mark(card,'data-v61-card');mark(link,'data-v61-link');
    const title=card.querySelector('h2,h3,h4')?.textContent.trim(),label=link.textContent.trim();
    if(title&&!link.hasAttribute('aria-label')&&!link.hasAttribute('aria-labelledby')&&!label.includes(title))mark(link,'aria-label',title+(label?' · '+label:''));
    for(let node=link.parentElement;node&&node!==card;node=node.parentElement)mark(node,'data-v61-link-path');
    for(const node of card.querySelectorAll('a[href],button,input,select,textarea,label,details,summary,[role="button"],[contenteditable="true"]'))if(node!==link&&!link.contains(node))mark(node,'data-v61-control');
   }
  }
  function refresh(){
   if(stopped)return;frame=null;
   cardLinks();
   for(const node of doc.querySelectorAll('main '+selector.split(',').join(',main '))){
    if(!node.querySelector('table')||node.closest('[hidden]')||node.querySelector(selector+' table'))continue;
    if(!states.has(node)){states.set(node,Object.fromEntries(['tabindex','role','aria-label','data-v6-scroll'].map(k=>[k,node.getAttribute(k)])));resize?.observe(node);}
    const initial=states.get(node),overflow=node.clientWidth>0&&(node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1),label=titleFor(node);
    restore(node,initial);node.setAttribute('data-v6-scroll',overflow?'overflow':'');
    if(overflow){if(initial.tabindex===null)node.setAttribute('tabindex','0');if(initial.role===null&&label)node.setAttribute('role','region');if(initial['aria-label']===null&&!node.hasAttribute('aria-labelledby')&&label)node.setAttribute('aria-label',label);}
   }
   for(const [node,state]of states)if(!node.isConnected){restore(node,state);resize?.unobserve(node);states.delete(node);}
  }
  function schedule(){if(frame!==null||stopped)return;frame=host.requestAnimationFrame?host.requestAnimationFrame(refresh):host.setTimeout(refresh,0);}
  if(host.ResizeObserver)resize=new host.ResizeObserver(schedule);
  refresh();
  if(host.MutationObserver){observer=new host.MutationObserver(schedule);const main=doc.querySelector('main');if(main)observer.observe(main,{childList:true,subtree:true});}
  host.addEventListener?.('resize',schedule);doc.addEventListener('toggle',schedule,true);doc.addEventListener('change',schedule,true);
  return {refresh,destroy(){stopped=true;observer?.disconnect();resize?.disconnect();host.removeEventListener?.('resize',schedule);doc.removeEventListener('toggle',schedule,true);doc.removeEventListener('change',schedule,true);if(frame!==null)(host.cancelAnimationFrame||host.clearTimeout)?.call(host,frame);for(const [node,state]of states)restore(node,state);for(const [node,state]of cards)restore(node,state);states.clear();cards.clear();}};
 }
 return {mount,titleFor,selector,cardRules};
});
