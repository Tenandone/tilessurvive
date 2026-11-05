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
  const main=doc.querySelector('main'),states=new Map(),cards=new Map(),images=new Map(),pending=new Set(),dirty=new Set(),forced=new Set();let observer,resize,frame=null,stopped=false;
  const cardSelector=cardRules.map(r=>r[0]).join(','),relevant='img[src],'+cardSelector+','+selector,excluded='[data-v5-home],[data-v61-ten]',nested=selector.split(',').map(s=>':scope '+s+' table').join(',');
  function restore(node,state){for(const [key,value]of Object.entries(state)){if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);}}
  function set(node,key,value){if(node.getAttribute(key)===value)return;if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);}
  function mark(node,key,value=''){if(node.getAttribute(key)===value)return;if(!cards.has(node))cards.set(node,{});const initial=cards.get(node);if(!Object.hasOwn(initial,key))initial[key]=node.getAttribute(key);node.setAttribute(key,value);}
  function cardLinks(card,force=false){
    if(!force&&card.hasAttribute('data-v61-card')||card.closest(excluded)||card.querySelector('[data-v61-card]'))return;
    const primary=cardRules.find(r=>card.matches(r[0]))?.[1];if(!primary)return;
    const link=card.querySelector(primary),href=link?.getAttribute('href');
    if(!href||!href.startsWith('/')||href.startsWith('//')||link.hasAttribute('download')||link.closest('button,label,summary'))return;
    mark(card,'data-v61-card');mark(link,'data-v61-link');
    const title=card.querySelector('h2,h3,h4')?.textContent.trim(),label=link.textContent.trim();
    if(title&&!link.hasAttribute('aria-label')&&!link.hasAttribute('aria-labelledby')&&!label.includes(title))mark(link,'aria-label',title+(label?' · '+label:''));
    for(let node=link.parentElement;node&&node!==card;node=node.parentElement)mark(node,'data-v61-link-path');
    for(const node of card.querySelectorAll('a[href],button,input,select,textarea,label,details,summary,[role="button"],[contenteditable="true"]'))if(node!==link&&!link.contains(node))mark(node,'data-v61-control');
  }
  function scan(root){
   const nodes=[...(root.matches?.(relevant)?[root]:[]),...root.querySelectorAll(relevant)];
   for(const n of nodes)if(n.hasAttribute('data-v61-source'))images.set(n.getAttribute('data-v61-source'),Object.fromEntries(['src','width','height','data-v61-image'].map(k=>[k,n.getAttribute(k)])));
   for(const n of nodes){
    if(n.tagName==='IMG'){const image=images.get(n.getAttribute('src'));if(image&&!n.closest(excluded))for(const [key,value]of Object.entries(image))mark(n,key,value);}
    else if(n.matches(cardSelector))cardLinks(n);
    else if(n.querySelector('table')&&!n.querySelector(nested)){if(!states.has(n)){states.set(n,Object.fromEntries(['tabindex','role','aria-label','data-v6-scroll'].map(k=>[k,n.getAttribute(k)])));resize?.observe(n);}dirty.add(n);}
   }
  }
  function flush(){
   frame=null;if(stopped)return;
   for(const n of pending)if(n.isConnected)scan(n);pending.clear();
   for(const card of forced)if(card.isConnected)cardLinks(card,true);forced.clear();
   for(const [n,s]of cards)if(!n.isConnected){restore(n,s);cards.delete(n);}
   for(const [n,s]of states)if(!n.isConnected||!n.querySelector('table')||n.querySelector(nested)){restore(n,s);resize?.unobserve(n);states.delete(n);dirty.delete(n);}
   // Read every affected table before writing attributes, avoiding layout thrash.
   const updates=[];for(const n of dirty)if(states.has(n)){const width=n.clientWidth,overflow=!n.closest('[hidden]')&&width>0&&(n.scrollWidth>width+1||n.scrollHeight>n.clientHeight+1);updates.push([n,overflow,titleFor(n)]);}dirty.clear();
   for(const [n,overflow,label]of updates){const s=states.get(n);set(n,'data-v6-scroll',overflow?'overflow':'');for(const key of ['tabindex','role','aria-label'])set(n,key,s[key]??(overflow?(key==='tabindex'?'0':key==='role'&&label?'region':key==='aria-label'&&label&&!n.hasAttribute('aria-labelledby')?label:null):null));}
  }
  function schedule(){if(frame!==null||stopped)return;frame=host.requestAnimationFrame?host.requestAnimationFrame(flush):host.setTimeout(flush,0);}
  function tables(){for(const n of states.keys())dirty.add(n);if(dirty.size)schedule();}
  function refresh(){if(stopped)return;if(frame!==null)(host.cancelAnimationFrame||host.clearTimeout)?.call(host,frame);for(const [n,s]of cards)restore(n,s);cards.clear();if(main)pending.add(main);for(const n of states.keys())dirty.add(n);flush();}
  if(host.ResizeObserver)resize=new host.ResizeObserver(entries=>{for(const e of entries)if(states.has(e.target))dirty.add(e.target);if(dirty.size)schedule();});
  refresh();
  if(host.MutationObserver){observer=new host.MutationObserver(records=>{let removed=false;for(const r of records){const target=r.target.nodeType===1?r.target:r.target.parentElement,table=target?.closest(selector);if(table){if(states.has(table))dirty.add(table);else pending.add(table);}const elements=[...r.addedNodes].filter(n=>n.nodeType===1),deleted=[...r.removedNodes].filter(n=>n.nodeType===1);if(elements.length||deleted.length){const card=target?.closest(cardSelector);if(card&&!card.closest(excluded))forced.add(card);}for(const n of elements)if(n.matches(relevant)||n.querySelector(relevant))pending.add(n);if(deleted.some(n=>n.matches(relevant)||n.querySelector(relevant)))removed=true;}if(pending.size||dirty.size||forced.size||removed)schedule();});if(main)observer.observe(main,{childList:true,subtree:true});}
  host.addEventListener?.('resize',tables);doc.addEventListener('toggle',tables,true);doc.addEventListener('change',tables,true);
  return {refresh,destroy(){stopped=true;observer?.disconnect();resize?.disconnect();host.removeEventListener?.('resize',tables);doc.removeEventListener('toggle',tables,true);doc.removeEventListener('change',tables,true);if(frame!==null)(host.cancelAnimationFrame||host.clearTimeout)?.call(host,frame);for(const [node,state]of states)restore(node,state);for(const [node,state]of cards)restore(node,state);states.clear();cards.clear();pending.clear();dirty.clear();forced.clear();}};
 }
 return {mount,titleFor,selector,cardRules};
});
