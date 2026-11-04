(function(){'use strict';function init(){
 const lang=window.TS_LOCALES?window.TS_LOCALES.current():document.documentElement.dataset.lang||'en',t=window.TS_I18N?window.TS_I18N.require(lang):window.TS_COPY[lang],c=JSON.parse(document.getElementById('ts3-copy')?.textContent||'{}');
 if(!t)throw Error('Missing product UI translation for '+lang);
 const searchCore=window.TS_V3_SEARCH;
 let indexPromise;
 const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase(lang);
 function loadIndex(){if(!indexPromise)indexPromise=fetch('/data/'+(searchCore?'v3-search':'search')+'/'+lang+'.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('search');return r.json();}).then(data=>(data.items||[]).filter(i=>i.language===lang)).catch(e=>{indexPromise=null;throw e;});return indexPromise;}
 document.querySelectorAll('.ts3-search-form').forEach((form,number)=>{
  const input=form.querySelector('input[name=q]');if(!input)return;
  const box=document.createElement('div');box.className='ts3-search-results';box.id='ts3-suggestions-'+number;box.hidden=true;box.setAttribute('role','listbox');box.setAttribute('aria-label',t.results);form.append(box);
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',box.id);
  let selected=-1,request=0,timer;
  function close(){box.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');selected=-1;}
  function open(){box.hidden=false;input.setAttribute('aria-expanded','true');}
  function searchUrl(q){const state=searchCore&&location.pathname.endsWith('/search/')?searchCore.readState(location):{category:'',sort:''};return searchCore?searchCore.stateUrl('/'+lang+'/search/',{...state,q}):'/'+lang+'/search/?q='+encodeURIComponent(q);}
  function allLink(q){const a=document.createElement('a');a.href=searchUrl(q);a.className='ts3-search-all';a.textContent=c.allResults+' ↗';a.setAttribute('role','option');a.id=box.id+'-all';a.tabIndex=-1;return a;}
  async function search(){const q=input.value.trim(),id=++request;if(!q){close();return;}box.replaceChildren();selected=-1;input.removeAttribute('aria-activedescendant');const status=document.createElement('div');status.setAttribute('role','status');status.textContent=t.loading;box.append(status);open();
   try{const items=await loadIndex();if(id!==request||input.value.trim()!==q)return;const terms=normalize(q).split(/\s+/).filter(Boolean);let matches=searchCore?searchCore.rank(items,q,{limit:6,locale:lang}):items.filter(i=>terms.every(w=>normalize(i.title+' '+i.description+' '+(i.aliases||'')+' '+i.url).includes(w)));if(!searchCore)matches.sort((a,b)=>Number(normalize(b.title).includes(normalize(q)))-Number(normalize(a.title).includes(normalize(q))));box.replaceChildren();
    matches.slice(0,6).forEach((item,i)=>{const a=document.createElement('a'),title=document.createElement('strong'),desc=document.createElement('small');a.href=item.url;a.id=box.id+'-'+i;a.setAttribute('role','option');a.setAttribute('aria-selected','false');a.tabIndex=-1;title.textContent=item.title.replace(/\s*[|·]\s*TilesSurvive\.net.*$/,'');desc.textContent=(item.description||'').slice(0,95);a.append(title,desc);box.append(a);});
    if(!matches.length){status.textContent=t.noResults;box.append(status);}box.append(allLink(q));
   }catch{if(id!==request)return;box.replaceChildren();status.textContent=t.error;box.append(status,allLink(q));}
  }
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,80);});
  input.addEventListener('focus',()=>{if(input.value.trim())search();else loadIndex().catch(()=>{});});
  if(searchCore)form.addEventListener('submit',e=>{e.preventDefault();location.href=searchUrl(input.value.trim());});
  input.addEventListener('keydown',e=>{const options=[...box.querySelectorAll('[role=option]')];if(e.key==='Escape'){request++;close();e.stopPropagation();return;}if(!box.hidden&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();if(!options.length)return;selected=(selected+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options.forEach((a,i)=>a.setAttribute('aria-selected',String(i===selected)));input.setAttribute('aria-activedescendant',options[selected].id);options[selected].scrollIntoView({block:'nearest'});}else if(e.key==='Enter'&&!box.hidden&&selected>=0&&options[selected]){e.preventDefault();location.href=options[selected].href;}});
  document.addEventListener('click',e=>{if(!form.contains(e.target)){request++;close();}});
  form.addEventListener('focusout',()=>setTimeout(()=>{if(!form.contains(document.activeElement)){request++;close();}},0));
 });
 const toc=document.querySelector('.ts3-contents');if(toc&&'IntersectionObserver'in window){const links=[...toc.querySelectorAll('a')],map=new Map(links.map(a=>[new URL(a.href).hash.slice(1),a]));const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){links.forEach(a=>a.removeAttribute('aria-current'));map.get(entry.target.id)?.setAttribute('aria-current','location');}},{rootMargin:'-170px 0px -60% 0px'});map.forEach((_,id)=>{const h=document.getElementById(id);if(h)observer.observe(h);});}
 // Browser history restores filter/input state naturally; no artificial page delay.
 addEventListener('pageshow',()=>document.documentElement.classList.remove('is-leaving'));
}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();})();
