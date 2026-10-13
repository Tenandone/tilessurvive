(function(root){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const valid=n=>Number.isSafeInteger(n)&&n>=0;
  function sumRange(rows,from,to,held=[0,0,0,0]){
    const max=Math.max(...rows.map(r=>r.level));
    if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to>max||held.length!==4||held.some(n=>!valid(n)))throw Error('invalid');
    const selected=rows.filter(r=>r.level>from&&r.level<=to);
    if(selected.length!==to-from||new Set(selected.map(r=>r.level)).size!==to-from)throw Error('missing');
    const resources=[0,0,0,0],items=new Map();let seconds=0;
    for(const r of selected){
      if(!Array.isArray(r.resources)||r.resources.length!==4||r.resources.some(n=>!valid(n))||!valid(r.seconds)||r.availability==='initial_conditions_unconfirmed')throw Error('missing');
      r.resources.forEach((n,i)=>resources[i]+=n);seconds+=r.seconds;
      if(!Array.isArray(r.constructionItems))throw Error('missing');
      for(const item of r.constructionItems){if(!valid(item.quantity))throw Error('missing');const key=item.id??item.itemId;if(key===undefined)throw Error('missing');const prior=items.get(key)||{...item,quantity:0};prior.quantity+=item.quantity;items.set(key,prior);}
    }
    if(resources.some(n=>!valid(n))||!valid(seconds)||[...items.values()].some(i=>!valid(i.quantity)))throw Error('invalid');
    return{resources,seconds,shortage:resources.map((n,i)=>Math.max(0,n-held[i])),constructionItems:[...items.values()],levels:selected.map(r=>r.level)};
  }
  function duration(seconds,units){if(seconds===null||seconds===undefined)return null;let n=seconds;return[86400,3600,60,1].map((s,i)=>{const q=Math.floor(n/s);n%=s;return q||i===3&&seconds===0?q+units[i]:'';}).filter(Boolean).join(' ');}
  function compact(n){if(n<1000)return String(n);let unit=n>=1e6?1e6:1000,rounded=Math.round(n/unit*100)/100;if(unit===1000&&rounded>=1000){unit=1e6;rounded=Math.round(n/unit*100)/100;}return rounded.toLocaleString('en-US',{maximumFractionDigits:2})+(unit===1e6?'M':'K');}
  function format(n,cfg){return n.toLocaleString(cfg.locale.numberLocale);}
  function number(n,label,cfg,type='resource'){
    if(n===null||n===undefined)return `<span class="missing">${esc(cfg.locale.labels.unknown)}</span>`;
    const raw=type==='time'?duration(n,cfg.locale.units.duration)+' ('+format(n,cfg)+cfg.locale.units.seconds+')':format(n,cfg);
    return `<button type="button" class="number ${type==='time'?'time-number':''} ${n===0?'zero':''}" data-value="${n}" data-kind="${type}" data-label="${esc(label)}" title="${esc(raw)}" aria-label="${esc(label+' '+raw)}">${esc(type==='time'?duration(n,cfg.locale.units.duration):compact(n))}</button>`;
  }
  function requirements(row,cfg){
    const L=cfg.locale.labels;
    if(row.requirements===null||row.availability==='initial_conditions_unconfirmed'&&!row.requirements.length)return esc(L.unknown);
    return row.requirements.length?'<ul class="requirements">'+row.requirements.map(q=>{
      const slug=q.slug||cfg.links[q.buildingId],name=q.name?.[cfg.lang]||cfg.names[q.buildingId]?.[cfg.lang];
      if(!name)throw Error('Missing requirement name '+q.buildingId);
      return `<li data-building-id="${q.buildingId}" data-required-level="${q.level}" data-rank="${q.rank||0}">${slug?`<a href="/${cfg.lang}/buildings/${esc(slug)}/#building-${q.buildingId}">${esc(name)}</a>`:esc(name)} <span>${esc(L.levelPrefix)}${q.level}${q.rank?' · '+esc(L.stage)+' '+q.rank:''}</span></li>`;
    }).join('')+'</ul>':esc(L.none);
  }
  function construction(row,cfg){return row.constructionItems===null||row.availability==='initial_conditions_unconfirmed'&&!row.constructionItems.length?esc(cfg.locale.labels.unknown):row.constructionItems.map(i=>esc(i.name[cfg.lang])+' × '+format(i.quantity,cfg)).join('<br>');}
  function renderProfile(b,p,cfg){
    const L=cfg.locale.labels,C=cfg.copy,key=b.id+':'+p.id,power=p.rows.some(r=>r.battlePower!==undefined&&r.battlePower!==null),items=p.rows.some(r=>r.constructionItems?.length||r.availability==='initial_conditions_unconfirmed'),label=p.id==='original'?C.original:C.d;
    const icon=i=>`<img class="resource-icon" src="/img/buildings/power-plant-resources/resource-${cfg.resources[i].id}.png" alt="" width="26" height="26">`;
    const level=r=>`${r.level}${r.availability==='initial_conditions_unconfirmed'?`<small class="missing">${esc(C.initial)}</small>`:''}${r.level===1?`<small>${esc(L.newConstruction)}</small>`:''}${r.rank?`<small>${esc(L.stage)} ${r.rank}</small>`:''}`;
    const sample=p.rows.find(r=>r.level===2),values=r=>Array.isArray(r.resources)?r.resources:[null,null,null,null];
    return `<details class="bs-profile" data-bs-profile="${key}"${p.id==='original'&&b.id===cfg.buildings[0].id?' open':''}><summary>${esc(b.name[cfg.lang])} · ${esc(label)} · ${esc(L.levelPrefix)}${p.rows[0].level}–${p.rows.at(-1).level}</summary>${sample?`<p class="variation">${esc(C.sample)}: ${values(sample).map((n,i)=>esc(cfg.resources[i].name[cfg.lang])+': '+(n===null?esc(L.unknown):format(n,cfg))).join(' · ')} · ${esc(L.time)}: ${esc(duration(sample.seconds,cfg.locale.units.duration)||L.unknown)}</p>`:''}<div class="requirements-block"><div class="desktop-table"><table class="data-table bs-table"><caption>${esc(b.name[cfg.lang]+' · '+label)}</caption><thead><tr><th scope="col">${esc(L.levelHeader)}</th><th scope="col" class="condition">${esc(L.conditions)}</th>${cfg.resources.map((x,i)=>`<th scope="col"><span class="resource-head">${icon(i)}${esc(x.name[cfg.lang])}</span></th>`).join('')}<th scope="col">${esc(L.time)}</th>${power?`<th scope="col">${esc(L.power)}</th>`:''}${items?`<th scope="col">${esc(C.items)}</th>`:''}</tr></thead><tbody>${p.rows.map(r=>`<tr data-level="${r.level}" data-rank="${r.rank||0}"><th scope="row" class="level">${level(r)}</th><td class="condition">${requirements(r,cfg)}</td>${values(r).map((n,i)=>`<td data-resource="${i}" data-raw="${n}">${number(n,cfg.resources[i].name[cfg.lang],cfg)}</td>`).join('')}<td data-seconds="${r.seconds}">${number(r.seconds,L.time,cfg,'time')}</td>${power?`<td data-power="${r.battlePower}">${number(r.battlePower,L.power,cfg,'power')}</td>`:''}${items?`<td>${construction(r,cfg)||esc(L.none)}</td>`:''}</tr>`).join('')}</tbody></table></div><div class="mobile-cards">${p.rows.map(r=>`<article class="level-card" data-level="${r.level}"><header class="card-head"><h4>${esc(L.levelPrefix)}${level(r)}</h4>${power?`<div class="power"><span>${esc(L.power)}</span>${number(r.battlePower,L.power,cfg,'power')}</div>`:''}</header><div class="resource-grid">${values(r).map((n,i)=>`<div class="resource-cell" data-resource="${i}" data-raw="${n}">${icon(i)}<div><span class="resource-name">${esc(cfg.resources[i].name[cfg.lang])}</span>${number(n,cfg.resources[i].name[cfg.lang],cfg)}</div></div>`).join('')}</div><div class="card-time" data-seconds="${r.seconds}"><span>${esc(L.time)}</span>${number(r.seconds,L.time,cfg,'time')}</div><div class="card-conditions"><span>${esc(L.conditions)}</span>${requirements(r,cfg)}</div>${items?`<div class="card-conditions"><span>${esc(C.items)}</span>${construction(r,cfg)||esc(L.none)}</div>`:''}</article>`).join('')}</div></div><details class="totals-details"><summary>${esc(L.totals)} · ${esc(label)}</summary>${[0,1].map(from=>{try{sumRange(p.rows,from,p.rows.at(-1).level);return renderTotal(b,p,cfg,from,p.rows.at(-1).level);}catch{return "";}}).join("")}</details></details>`;
  }
  function renderTotal(b,p,cfg,from,to,held){
    const C=cfg.copy,L=cfg.locale.labels;let result;
    const title=esc(b.name[cfg.lang]+' · '+(p.id==='original'?C.original:C.d)+' · '+from+' → '+to);
    try{result=sumRange(p.rows,from,to,held);}catch(error){return `<div class="bs-total" data-bs-total-status="${error.message}"><h3>${title}</h3><p>${esc(error.message==='missing'?C.missing:C.invalid)}</p></div>`;}
    return `<div class="bs-total" data-bs-total-status="complete"><h3>${title}</h3><div class="total-values">${result.resources.map((n,i)=>`<div>${esc(cfg.resources[i].name[cfg.lang])}<strong data-total-resource="${i}" data-raw="${n}">${format(n,cfg)}</strong>${held?`<small>${esc(C.shortage)}: ${format(result.shortage[i],cfg)}</small>`:''}</div>`).join('')}</div><p data-total-seconds="${result.seconds}">${esc(L.time)}: ${esc(duration(result.seconds,cfg.locale.units.duration))} · ${format(result.seconds,cfg)}${esc(cfg.locale.units.seconds)}</p>${result.constructionItems.length?`<p>${esc(C.items)}: ${result.constructionItems.map(i=>esc(i.name[cfg.lang])+' × '+format(i.quantity,cfg)).join(' · ')}</p>`:''}</div>`;
  }
  function init(d=root.document){if(!d)return;d.querySelectorAll('[data-building-system]').forEach(host=>{
    if(host.dataset.bsReady)return;
    const cfg=JSON.parse(host.querySelector('[data-building-system-model]').textContent),q=s=>host.querySelector(s),choice=q('[data-bs-choice]'),level=q('[data-bs-level]'),exact=q('[data-bs-exact]'),form=q('form'),output=q('[data-bs-result]'),dialog=q('dialog'),panels=[...host.querySelectorAll('[data-bs-profile]')];
    for(const b of cfg.buildings)for(const p of b.profiles)for(const r of p.rows){if(r.calculationBlocked)r.availability='initial_conditions_unconfirmed';delete r.calculationBlocked;}
    if(!choice)return;let trigger;
    const params=new URLSearchParams(root.location?.search||'');
    if([...choice.options].some(o=>o.value===params.get('profile')))choice.value=params.get('profile');
    const requested=params.get('level')||params.get('range');
    if([...level.options].some(o=>o.value===requested))level.value=requested;
    exact.checked=params.get('exact')==='1';
    if(params.get('capture')==='1'){if(!choice.value)choice.value=choice.options[1].value;d.documentElement.setAttribute('data-building-capture','');}
    const fields=n=>form.querySelector('[name="'+n+'"]'),num=n=>fields(n).value.trim()===''?NaN:Number(fields(n).value),get=()=>{const [id,profile]=choice.value.split(':');const b=cfg.buildings.find(x=>String(x.id)===id);return{b,p:b?.profiles.find(x=>x.id===profile)};};
    function update(){const {b,p}=get();q('[data-bs-inputs]').disabled=!p;output.innerHTML=p?renderTotal(b,p,cfg,num('from'),num('to'),[0,1,2,3].map(i=>num('held-'+i))):esc(cfg.copy.selectFirst);if(p){try{output.dataset.result=JSON.stringify(sumRange(p.rows,num('from'),num('to'),[0,1,2,3].map(i=>num('held-'+i))));}catch(e){output.dataset.result=e.message;}}else output.dataset.result='unselected';}
    function filter(){const range=level.value.split('-').map(Number);for(const panel of panels){panel.hidden=!!choice.value&&panel.dataset.bsProfile!==choice.value;if(choice.value&&!panel.hidden)panel.open=true;panel.querySelectorAll('[data-level]').forEach(r=>{const n=Number(r.dataset.level);r.hidden=level.value!=='all'&&(n<range[0]||n>(range[1]||range[0]));});}host.querySelectorAll('.bs-building').forEach(n=>n.hidden=!!choice.value&&![...n.querySelectorAll('[data-bs-profile]')].some(p=>!p.hidden));host.querySelectorAll('button.number').forEach(n=>{if(n.dataset.kind!=='time')n.textContent=exact.checked?format(Number(n.dataset.value),cfg):compact(Number(n.dataset.value));});host.classList.toggle('exact-mode',exact.checked);update();}
    function currentUrl(capture=params.get('capture')==='1'){const p=new URLSearchParams();if(choice.value)p.set('profile',choice.value);if(level.value!=='all')p.set('level',level.value);if(exact.checked)p.set('exact','1');if(capture)p.set('capture','1');return `/${cfg.lang}/buildings/${cfg.slug}/`+(p.size?'?'+p:'')+(root.location?.hash||'');}
    function languageUrl(a){const url=new URL(a.href,root.location?.href||'https://tilessurvive.net/'+cfg.lang+'/buildings/'+cfg.slug+'/');if(!new RegExp('^/(ko|en|ja|ru|zh-tw|de)/buildings/'+cfg.slug+'/$').test(url.pathname))return null;url.search=new URL(currentUrl(),'https://tilessurvive.net').search;url.hash=root.location?.hash||'';return url;}
    function updateLanguageLinks(){d.querySelectorAll('.ts3-language a[hreflang]').forEach(a=>{const url=languageUrl(a);if(url)a.setAttribute('href',url.pathname+url.search+url.hash);});}
    function remember(){root.history?.replaceState(null,'',currentUrl());updateLanguageLinks();}
    d.addEventListener('click',event=>{const a=event.target.closest?.('.ts3-language a[hreflang]');if(!a)return;const url=languageUrl(a);if(!url)return;a.setAttribute('href',url.pathname+url.search+url.hash);event.stopImmediatePropagation();if(event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&(!a.target||a.target==='_self')){event.preventDefault();root.location.assign(url.href);}},true);
    choice.addEventListener('change',()=>{const {p}=get();if(p){const max=p.rows.at(-1).level;fields('from').max=max;fields('to').max=max;fields('from').value=Math.min(num('from'),max);fields('to').value=Math.min(num('to'),max);}filter();});
    choice.addEventListener('change',remember);level.addEventListener('change',()=>{filter();remember();});exact.addEventListener('change',()=>{filter();remember();});form.addEventListener('input',update);form.addEventListener('submit',e=>e.preventDefault());
    q('[data-bs-capture]')?.addEventListener('click',()=>{root.location.href=currentUrl(true);});
    host.addEventListener('click',e=>{const n=e.target.closest('button.number');if(!n)return;trigger=n;const value=Number(n.dataset.value);q('[data-bs-dialog-title]').textContent=n.dataset.label;q('[data-bs-dialog-value]').textContent=n.dataset.kind==='time'?duration(value,cfg.locale.units.duration)+' ('+format(value,cfg)+cfg.locale.units.seconds+')':format(value,cfg);dialog.showModal();});dialog.addEventListener('close',()=>trigger?.focus());
    function openHash(){const match=(root.location?.hash||'').match(/^#building-(?:heading-)?(\d+)$/);if(!match)return;const profile=choice.value.split(':')[1];if(profile){const option=[...choice.options].find(n=>n.value===match[1]+':'+profile);if(option)choice.value=option.value;filter();}else panels.filter(n=>n.dataset.bsProfile.startsWith(match[1]+':')).forEach(n=>n.open=true);}
    host.dataset.bsReady='true';host.classList.add('bs-enhanced');filter();openHash();updateLanguageLinks();root.addEventListener?.('hashchange',openHash);
    // Later deferred shell scripts also append the current query. Normalize the
    // building links after those scripts so copy/new-tab navigation stays valid.
    if(d.readyState!=='complete')d.addEventListener('DOMContentLoaded',updateLanguageLinks,{once:true});
  });}
  const api={sumRange,duration,compact,renderProfile,renderTotal,init};if(typeof module==='object'&&module.exports)module.exports=api;if(root.document){root.BUILDING_SYSTEM=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>init());else init();}
})(typeof window==='object'?window:globalThis);
