(function(root){
  'use strict';
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Display-only formatting and inclusive target-level totals from the approved preview.
  // The existing shared client mathematics is not changed.
  function compact(n){if(n===null||n===undefined)return null;if(!Number.isSafeInteger(n)||n<0)throw new Error('invalid display value');if(n<1000)return String(n);let unit=n>=1000000?1000000:1000;let rounded=Math.round(n/(unit/100))/100;if(unit===1000&&rounded>=1000){unit=1000000;rounded=Math.round(n/(unit/100))/100;}return rounded.toLocaleString('en-US',{maximumFractionDigits:2})+(unit===1000000?'M':'K');}
  function exact(n,locale){return n===null||n===undefined?null:n.toLocaleString(locale);}
  function duration(seconds,units){let n=seconds;return[86400,3600,60,1].map((s,i)=>{const q=Math.floor(n/s);n%=s;return q||i===3&&seconds===0?`${q}${units[i]}`:'';}).filter(Boolean).join(' ');}
  function totals(rows){const resources=[0,0,0,0];let seconds=0;for(const r of rows){r.resources.forEach((v,i)=>{resources[i]=resources[i]===null||v===null?null:resources[i]+v});seconds=seconds===null||r.seconds===null?null:seconds+r.seconds;}return{resources,seconds};}
  const formatting={compact,exact,duration,totals};
  function view(options){
    const {model,locale,links={},lang,range=[1,30],exact:showExact=false}=options;
    const [min,max]=range,labels=locale.labels,rows=model.levels.filter(r=>r.level>=min&&r.level<=max);
    const nfmt=n=>exact(n,locale.numberLocale),time=n=>n===null?labels.unknown:duration(n,locale.units.duration);
    const version=locale.source.versionTemplate.replace('{version}',model.game.version).replace('{build}',model.game.build);
    const context=r=>`${locale.buildingName} · ${labels.levelPrefix}${r.level}`;
    function icon(i){const resource=model.resources[i],src='/img/buildings/power-plant-resources/resource-'+resource.id+'.png';return `<img class="resource-icon" src="${esc(src)}" alt="" width="26" height="26" data-resource-id="${resource.id}">`;}
    function number(n,label,ctx,type='resource'){
      if(n===null||n===undefined)return `<span class="missing">${esc(labels.unknown)}</span>`;
      const raw=type==='time'?`${time(n)} (${nfmt(n)}${locale.units.seconds})`:nfmt(n)+(type==='resource'?locale.units.resourceSuffix:'');
      const shown=type==='time'?time(n):showExact?nfmt(n):compact(n);
      return `<button type="button" class="number ${type==='time'?'time-number':''} ${n===0?'zero':''}" title="${esc(raw)}" data-value="${n}" data-kind="${type}" data-label="${esc(label)}" data-context="${esc(ctx)}" aria-label="${esc(label+' '+shown+', '+labels.showExactValue)}">${esc(shown)}</button>`;
    }
    function requirements(row){return row.requirements.length?'<ul class="requirements">'+row.requirements.map(r=>{
      const target=links[r.buildingId],href=target?.replace(/^\/(ko|en|ja|ru|zh-tw|de)\//,`/${lang}/`),name=locale.buildingNames[r.buildingId];
      if(!name)throw new Error('Missing localized building '+r.buildingId);
      return `<li data-building-id="${r.buildingId}" data-required-level="${r.level}" data-rank="${r.rank||0}">${href?`<a href="https://tilessurvive.net${esc(href)}" target="_blank" rel="noopener">${esc(name)} ↗</a>`:esc(name)}<span>${esc(labels.levelPrefix)}${r.level}${r.rank?' · '+esc(labels.stage)+' '+r.rank:''}</span></li>`;
    }).join('')+'</ul>':`<ul class="requirements"><li class="no-req">${esc(labels.none)}</li></ul>`;}
    return {model,locale,lang,min,max,labels,rows,nfmt,time,version,context,icon,number,requirements};
  }
  function renderTables(options){
    const {locale,min,max,labels:L,rows,version,context:ctx,icon,number,requirements}=view(options);
    return `<section class="requirements-block"><header class="requirements-title"><div><h3>${esc(locale.buildingName)} · ${esc(L.requirements)}</h3><p>TilesSurvive.net · ${esc(version)}</p></div><span class="level-range">${esc(L.levelPrefix)}${min}${min===max?'':'–'+max}</span></header><div class="desktop-table"><table class="data-table" id="ts3-data-table-0"><caption hidden>${esc(locale.buildingName)} · ${esc(L.requirements)}</caption><colgroup>${'<col>'.repeat(8)}</colgroup><thead><tr><th scope="col">${esc(L.levelHeader)}</th><th scope="col" class="condition">${esc(L.conditions)}</th>${locale.resources.map((s,j)=>`<th scope="col"><span class="resource-head">${icon(j)}${esc(s)}</span></th>`).join('')}<th scope="col">${esc(L.time)}</th><th scope="col">${esc(L.power)}</th></tr></thead><tbody>${rows.map(r=>`<tr data-level="${r.level}"><td class="level">${r.level}${r.level===1?`<small>${esc(L.newConstruction)}</small>`:''}${r.rank?`<small>${esc(L.stage)} ${r.rank}</small>`:''}</td><td class="condition">${requirements(r)}</td>${r.resources.map((v,j)=>`<td data-resource="${j}" data-raw="${v}">${number(v,locale.resources[j],ctx(r))}</td>`).join('')}<td data-seconds="${r.seconds}">${number(r.seconds,L.time,ctx(r),'time')}</td><td data-power="${r.battlePower}">${number(r.battlePower,L.power,ctx(r),'power')}</td></tr>`).join('')}</tbody></table></div><div class="mobile-cards">${rows.map(r=>`<article class="level-card" data-level="${r.level}"><header class="card-head"><h4>${esc(L.levelPrefix)}${r.level}${r.rank?`<small>${esc(L.stage)} ${r.rank}</small>`:''}${r.level===1?`<small>${esc(L.newConstruction)}</small>`:''}</h4><div class="power" data-power="${r.battlePower}"><span>${esc(L.power)}</span>${number(r.battlePower,L.power,ctx(r),'power')}</div></header><div class="resource-grid">${r.resources.map((v,j)=>`<div class="resource-cell" data-resource="${j}" data-raw="${v}">${icon(j)}<div><span class="resource-name">${esc(locale.resources[j])}</span>${number(v,locale.resources[j],ctx(r))}</div></div>`).join('')}</div><div class="card-time" data-seconds="${r.seconds}"><span>${esc(L.time)}</span>${number(r.seconds,L.time,ctx(r),'time')}</div><div class="card-conditions"><span>${esc(L.conditions)}</span>${requirements(r)}</div></article>`).join('')}</div><div class="requirements-foot"><span>${esc(locale.messages.numberHint)}</span><span>${esc(L.resourceUnit)}</span></div></section>`;
  }
  function renderTotals(options){
    const {locale,min,max,labels:L,rows,nfmt,time}=view(options),sum=totals(rows);
    return `<div class="totals-grid"><div class="total-row"><h3>${esc(locale.buildingName)} · ${esc(L.levelPrefix)}${min}${min===max?'':'–'+max}</h3><div class="total-values">${sum.resources.map((v,j)=>`<div>${esc(locale.resources[j])}<strong data-total-resource="${j}" data-raw="${v}">${v===null?esc(L.unknown):esc(nfmt(v)+locale.units.resourceSuffix)}</strong></div>`).join('')}</div><p data-total-seconds="${sum.seconds}">${esc(time(sum.seconds))}${sum.seconds===null?'':' · '+esc(nfmt(sum.seconds)+locale.units.seconds)}</p></div></div>`;
  }
  function init(document=root.document){
    if(!document)return;
    document.querySelectorAll('[data-power-plant-original]').forEach(wrapper=>{
      if(wrapper.dataset.powerPlantReady)return;
      const q=selector=>wrapper.querySelector(selector);
      let model,locale,links,lang,range='all',showExact=false,lastTrigger;
      try{
        ({model,locale,links,lang}=JSON.parse(q('script[data-power-plant-model]').textContent));
        if(!locale||!model||model.levels.length!==30)throw new Error('Incomplete page data');
        const rangeSelect=q('#range'),exactControl=q('#exact'),dialog=q('#number-dialog');
        const params=new URLSearchParams(root.location.search);
        if([...rangeSelect.options].some(o=>o.value===params.get('range')))range=params.get('range');
        showExact=params.get('exact')==='1';rangeSelect.value=range;exactControl.checked=showExact;
        wrapper.classList.toggle('capture-mode',params.get('capture')==='1');
        document.documentElement.toggleAttribute('data-power-plant-capture',wrapper.classList.contains('capture-mode'));
        const selected=()=>range==='all'?[1,30]:range.split('-').map(Number);
        function currentUrl(capture=wrapper.classList.contains('capture-mode')){const params=new URLSearchParams();if(range!=='all')params.set('range',range);if(showExact)params.set('exact','1');if(capture)params.set('capture','1');return `/${lang}/buildings/power-plant/`+(params.size?'?'+params.toString():'');}
        function languageUrl(a){
          const url=new URL(a.href,root.location.href);
          if(url.origin!==root.location.origin||!/^\/(ko|en|ja|ru|zh-tw|de)\/buildings\/power-plant\/$/.test(url.pathname))return null;
          url.search=new URL(currentUrl(),root.location.href).search;
          return url;
        }
        function updateLanguageLinks(){document.querySelectorAll('.ts3-language a[hreflang]').forEach(a=>{const url=languageUrl(a);if(url)a.setAttribute('href',url.pathname+url.search+url.hash);});}
        // The shared language handler appends location.search to href. These links
        // already carry the sheet state, including for opening a new tab.
        document.addEventListener('click',event=>{
          const a=event.target.closest?.('.ts3-language a[hreflang]');if(!a)return;
          const url=languageUrl(a);if(!url)return;
          a.setAttribute('href',url.pathname+url.search+url.hash);
          event.stopImmediatePropagation();
          if(event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&!a.hasAttribute('download')&&(!a.target||a.target==='_self')){
            event.preventDefault();root.location.assign(url.href);
          }
        },true);
        function render(){
          const options={model,locale,links,lang,range:selected(),exact:showExact},state=view(options);
          wrapper.classList.toggle('exact-mode',showExact);
          q('#tables').innerHTML=renderTables(options);q('#totals').innerHTML=renderTotals(options);
          if(q('#source-version'))q('#source-version').textContent=state.version;
          if(q('#capture-basis'))q('#capture-basis').textContent=`TilesSurvive.net · ${locale.buildingName} · ${state.version} · ${locale.messages.verificationScope}`;
          updateLanguageLinks();
          root.DOT_VIEW={range:options.range,raw:model,language:lang,render,version:3,totals:totals(state.rows)};
        }
        q('#tables').addEventListener('click',event=>{
          const button=event.target.closest('button.number');if(!button)return;lastTrigger=button;
          const n=Number(button.dataset.value),type=button.dataset.kind;
          q('#detail-title').textContent=button.dataset.label;
          q('#detail-value').textContent=type==='time'?duration(n,locale.units.duration):exact(n,locale.numberLocale)+(type==='resource'?locale.units.resourceSuffix:'');
          q('#detail-context').textContent=button.dataset.context+(type==='time'?' · '+exact(n,locale.numberLocale)+locale.units.seconds:'');
          dialog.showModal();
        });
        dialog.addEventListener('close',()=>lastTrigger?.focus());
        rangeSelect.addEventListener('change',event=>{range=event.target.value;render();root.history.replaceState(null,'',currentUrl());});
        exactControl.addEventListener('change',event=>{showExact=event.target.checked;render();root.history.replaceState(null,'',currentUrl());});
        q('#capture')?.addEventListener('click',event=>{event.preventDefault();root.location.href=currentUrl(true);});
        q('#language')?.addEventListener('change',event=>{root.location.href=currentUrl().replace(`/${lang}/`,`/${event.target.value}/`);});
        wrapper.dataset.powerPlantReady='true';render();
      }catch(error){
        if(q('#tables'))q('#tables').textContent=locale?.messages.loadError||q('#tables').dataset.loadError||'';
        wrapper.dataset.loadError='true';document.documentElement.dataset.loadError='true';
        if(root.console)root.console.error(error);
      }
    });
  }
  const api={renderTables,renderTotals,formatting,init};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root.document){root.POWER_PLANT_ORIGINAL=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>init());else init();}
})(typeof window==='object'?window:globalThis);
