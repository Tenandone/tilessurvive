/* Progressive table access. Native scrolling keeps browser/RTL key behavior;
   no calculator, storage, network, tracking, or game-data ownership. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.TS_V6_SYSTEM=api;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>api.mount(document,root),{once:true});else api.mount(document,root);}})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const selector='.xssr-table-wrap,.v4-table-wrap,.r60-scroll,.pet-skill-table-wrap,.ts3-table-scroll,.ts-table-wrap,.ts50-scroll,.table-wrap,.table-scroll,[data-atlas-comparison-table],.ten-payout-table,.v5-score-table,.v6-score-table,.desktop-table';
 function titleFor(node){
  const table=node.querySelector('table'),caption=table&&table.querySelector('caption');
  const heading=node.closest('section,article,details')?.querySelector('h2,h3,h4,summary')||node.closest('main')?.querySelector('h1');
  return (caption?.textContent||table?.getAttribute('aria-label')||heading?.textContent||'').replace(/\s+/g,' ').trim().slice(0,180);
 }
 function mount(doc,host){
  if(!doc.documentElement.hasAttribute('data-v6-system'))return {refresh(){},destroy(){}};
  const states=new Map();let observer,resize,frame=null,stopped=false;
  function restore(node,state){for(const [key,value]of Object.entries(state)){if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);}}
  function refresh(){
   if(stopped)return;frame=null;
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
  return {refresh,destroy(){stopped=true;observer?.disconnect();resize?.disconnect();host.removeEventListener?.('resize',schedule);doc.removeEventListener('toggle',schedule,true);doc.removeEventListener('change',schedule,true);if(frame!==null)(host.cancelAnimationFrame||host.clearTimeout)?.call(host,frame);for(const [node,state]of states)restore(node,state);states.clear();}};
 }
 return {mount,titleFor,selector};
});
