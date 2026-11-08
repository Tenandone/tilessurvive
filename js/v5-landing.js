(function (root, factory) {
 'use strict';
 if (typeof module === 'object' && module.exports) {
  module.exports = factory(require('./common-events'), require('./home-form-state'));
  return;
 }
 function start(state) {
  const api = factory(root.TS_COMMON_EVENTS,state);
  root.TS_V5_LANDING = api;
  const mount = () => api.mount(root.document,root);
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
 }
 if (root.TS_HOME_FORM_STATE) start(root.TS_HOME_FORM_STATE);
 else {
  // A cached older home may not yet reference the new shared state script.
  const script = root.document.createElement('script');
  script.src = '/js/home-form-state.js';
  script.addEventListener('load',() => start(root.TS_HOME_FORM_STATE),{once:true});
  root.document.head.appendChild(script);
 }
})(typeof window !== 'undefined' ? window : globalThis, function (common, formState) {
 'use strict';
 const {KEY,PREF_KEY,hydrate,preferences} = formState;
 function mount(document,host){const root=document.querySelector('[data-v5-home]'),payload=document.querySelector('[data-v5-config]');if(!root||!payload||root.dataset.mounted)return null;const data=JSON.parse(payload.textContent),c=data.copy,s=data.seasonCopy,facts=data.commonEvents,nf=new Intl.NumberFormat(data.numberLocale),digits=new Intl.NumberFormat(data.numberLocale,{minimumIntegerDigits:2,useGrouping:false}),nodes=new Map(),groups=new Map(),get=q=>{if(!nodes.has(q))nodes.set(q,root.querySelector(q));return nodes.get(q);},all=q=>{if(!groups.has(q))groups.set(q,Array.from(root.querySelectorAll(q)));return groups.get(q);};const state=formState.take(document)||formState.read(host,data.profiles);let {saved,prefs}=state,displayOffset=state.displayOffset??prefs.offset;
  const track=(action,section)=>host.TS_V3_AFFILIATE?.trackLanding?.(action,section);
  const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const persist=(key,value)=>formState.persist(host,key,value);
  function save(){persist(KEY,saved);}
  const clockOptions={hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'},serverClock=new Intl.DateTimeFormat(data.numberLocale,{...clockOptions,timeZone:'UTC'}),localClock=new Intl.DateTimeFormat(data.numberLocale,clockOptions),times=new Map();
  const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;},hide=(node,value)=>{if(node.hidden!==value)node.hidden=value;};
  const time=(value,local=false)=>{const key=String(value)+'|'+local;if(!times.has(key))times.set(key,common.formatTime(value,data.numberLocale,local?{}:{timeZone:'UTC'}));return times.get(key);};
  let signature=null,lastViewed=null;
  function tick(){const now=Date.now(),selection=common.select(facts.events,now),event=selection.event,ec=event?s.events[event.id]:null,next=facts.events.filter(e=>common.phase(e,now)==='upcoming').sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt))[0],nextSig=(event?.id||'news')+':'+selection.phase;
   const offsetLabel='UTC'+(displayOffset>=0?'+':'−')+String(Math.floor(Math.abs(displayOffset)/60)).padStart(2,'0')+':'+String(Math.abs(displayOffset)%60).padStart(2,'0');text(get('[data-v6-server-clock]'),serverClock.format(now+displayOffset*60000)+' '+offsetLabel);text(get('[data-v6-local-clock]'),localClock.format(now));
   if(signature!==nextSig){get('#v5-today').dataset.phase=selection.phase;get('[data-common-phase]').textContent=event?s[selection.phase]:s.latestNews;get('[data-common-season]').textContent=ec?.season||'TILES SURVIVE';get('#homeTitle').textContent=ec?.eventTitle||s.fallbackTitle;get('[data-common-summary]').textContent=ec?.eventSummary||s.fallbackSummary;get('[data-common-art]').src=event?.art||'/img/v6/world.webp';if(event?.artSrcset)get('[data-common-art]').setAttribute('srcset',event.artSrcset);else get('[data-common-art]').removeAttribute('srcset');get('[data-common-wordmark]').textContent=ec?.season||'';get('[data-common-timing]').hidden=!event;get('[data-common-guide]').hidden=!event;get('[data-common-free]').hidden=!event;get('.v6-season-mark').hidden=!event;const join=get('[data-common-join]');join.textContent=event?s.join+' ↗':s.latestNews+' ↗';join.href=event?.officialURL||homeAnchor('v5-news');join.target=event?'_blank':'_self';get('[data-common-guide]').href=event?homeAnchor('event-guide-'+event.id):homeAnchor('v5-news');all('[data-common-body]').forEach(n=>n.hidden=n.dataset.commonBody!==event?.id);get('[data-common-fallback]').hidden=!!event;const ended=facts.events.filter(e=>common.phase(e,now)==='ended').sort((a,b)=>Date.parse(b.endsAt)-Date.parse(a.endsAt))[0];get('[data-common-ended]').textContent=ended?s.events[ended.id].expiredNote:'';
    if(event){get('[data-common-period]').textContent=time(event.startsAt)+' — '+time(event.endsAt);get('[data-common-local]').textContent=time(event.startsAt,true)+' — '+time(event.endsAt,true);get('[data-common-countdown-label]').textContent=selection.phase==='active'?s.endsIn:s.startsIn;}
    signature=nextSig;
   }
   if(event){common.countdown(Date.parse(selection.phase==='active'?event.endsAt:event.startsAt)-now).forEach((n,i)=>text(get('[data-common-digit="'+i+'"]'),digits.format(n)));if(lastViewed!==event.id&&track('view','common_event'))lastViewed=event.id;}
   text(get('[data-common-next]'),next?s.events[next.id].eventTitle+' · '+time(next.startsAt)+' UTC':s.noNext);
   let visible=0;all('[data-common-schedule]').forEach(n=>{const e=facts.events.find(e=>e.id===n.dataset.commonSchedule),phase=common.phase(e,now);hide(n,!['active','upcoming'].includes(phase));if(!n.hidden){visible++;text(get('[data-common-schedule="'+e.id+'"] [data-common-schedule-phase]'),s[phase]);text(get('[data-common-schedule="'+e.id+'"] [data-common-schedule-local]'),s.localTime+' · '+time(e.startsAt,true)+' — '+time(e.endsAt,true));}});hide(get('[data-common-schedule-empty]'),visible>0);
  }
  function scoreOptions(day,saveScore){const select=get('[data-v6-score-rule]'),before=select.value;select.replaceChildren();if(!day){select.append(make('option',c.chooseStage));}else day.rules.forEach((r,i)=>{const option=make('option',r.name+' · '+nf.format(r.points));option.value=String(i);select.append(option);});select.disabled=!day;get('[data-v6-quantity]').disabled=!day;get('[data-v6-target]').disabled=!day;if(day)select.value=day.rules[Number(before)]?before:'0';preview(saveScore);}
  function preview(saveScore=false){const profile=data.profiles.find(p=>p.id===saved.profile),day=profile.days.find(d=>d.day===saved.day),quantity=get('[data-v6-quantity]').value,target=get('[data-v6-target]').value,rule=day?.rules[Number(get('[data-v6-score-rule]').value)],result=quantity!==''&&target!==''?common.previewScore(rule,Number(quantity),Number(target)):null;get('[data-v6-score-output]').textContent=result?nf.format(result.score):'—';get('[data-v6-score-remaining]').textContent=result?nf.format(result.remaining):'—';if(result&&saveScore){prefs.quantity=Number(quantity);prefs.target=Number(target);persist(PREF_KEY,prefs);}}
  function homeAnchor(id) { return (document.documentElement.hasAttribute('data-root-home') ? '/' : '/' + data.locale + '/') + '#' + id; }
  function points(saveScore=false){const profile=data.profiles.find(p=>p.id===saved.profile),day=profile.days.find(d=>d.day===saved.day),rows=get('[data-v5-score-rows]'),rewards=get('[data-v5-rewards]'),actions=get('[data-v5-duel-actions]');get('[data-v5-profile]').value=saved.profile;all('[data-v5-day]').forEach(b=>{b.setAttribute('aria-pressed',String(Number(b.dataset.v5Day)===saved.day));b.querySelector('span').textContent=profile.days.find(d=>d.day===Number(b.dataset.v5Day)).name;});rows.replaceChildren();rewards.replaceChildren();actions.replaceChildren();get('[data-v5-stage-title]').textContent=day?day.name:c.chooseStage;get('[data-v5-stage-current]').textContent=day?nf.format(day.day)+' · '+day.name:c.chooseStage;
   if(!day){const tr=make('tr'),td=make('td',c.stageNote);td.colSpan=2;tr.append(td);rows.append(tr);scoreOptions(null,saveScore);return;}
   for(const rule of day.rules){const tr=make('tr'),name=make('th',rule.name);name.scope='row';tr.append(name,make('td',nf.format(rule.points)));rows.append(tr);}
   for(const rule of day.rules.slice(0,4)){const line=make('p');line.append(make('span',rule.name),make('strong',nf.format(rule.points)+' '+data.economyCopy.points));actions.append(line);}for(const stage of day.stages.slice(0,3)){const card=make('article',undefined,'v5-reward');card.append(make('p',c.rewardPreview,'v5-note'),make('strong',nf.format(stage.points)+' '+data.economyCopy.points));const ul=make('ul');for(const r of stage.rewards.slice(0,3))ul.append(make('li',r.name+' × '+nf.format(r.quantity)));card.append(ul);rewards.append(card);}
   scoreOptions(day,saveScore);
  }

  if(!state.prepared){get('[data-v6-quantity]').value=String(prefs.quantity);get('[data-v6-target]').value=String(prefs.target);}
  get('[data-v5-profile]').addEventListener('change',event=>{saved.profile=event.target.value;save();points();track('change','duel');});
  all('[data-v5-day]').forEach(b=>b.addEventListener('click',()=>{saved.day=Number(b.dataset.v5Day);save();points();track('select','duel');}));
  get('[data-v6-score-form]').addEventListener('submit',event=>event.preventDefault());all('[data-v6-score-rule],[data-v6-quantity],[data-v6-target]').forEach(n=>n.addEventListener('input',()=>preview(true)));get('[data-v6-score-rule]').addEventListener('change',()=>{preview(true);track('change','score_preview');});
  const offset=get('[data-v6-offset]');if(!state.prepared)offset.value=String(prefs.offset/60);offset.addEventListener('input',()=>{displayOffset=formState.offsetMinutes(offset.value)??displayOffset;tick();});offset.addEventListener('change',()=>{displayOffset=formState.commitOffset(offset,{prefs},host);tick();});
  root.addEventListener('click',event=>{const a=event.target.closest('a[data-v5-track]');if(a){if(a.hasAttribute('data-common-guide')){const detail=get(new URL(a.href,host.location?.href||'https://tilessurvive.net/'+data.locale+'/').hash);if(detail)detail.open=true;}track('open',a.dataset.v5Track);}});
  // Embla.measure reads geometry and previously forced a full-page layout during
  // script evaluation. Enhance only as the existing native scroller approaches
  // the viewport or receives keyboard/control intent; links stay usable first.
  const carousels=[],records=[],byViewport=new Map();let destroyed=false,nearby;
  function initialize(record,startIndex=0){
   if(destroyed||record.api||typeof host.EmblaCarousel!=='function')return record.api;
   const {viewport,prev,next,bar}=record,api=host.EmblaCarousel(viewport,{align:'start',containScroll:'trimSnaps',startIndex,direction:document.documentElement.dir==='rtl'?'rtl':'ltr',duration:host.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:20});record.api=api;
   const update=()=>{prev.disabled=!api.canScrollPrev();next.disabled=!api.canScrollNext();bar.style.width=((api.selectedScrollSnap()+1)/Math.max(1,api.scrollSnapList().length)*100)+'%';};api.on('select',update).on('reInit',update);update();carousels.push(api);viewport.dataset.carouselReady='true';viewport.style.touchAction=record.touchAction;nearby?.unobserve(viewport);return api;
  }
  all('[data-v6-carousel]').forEach(viewport=>{
   const controls=viewport.nextElementSibling,record={viewport,prev:controls.querySelector('[data-v6-prev]'),next:controls.querySelector('[data-v6-next]'),bar:controls.querySelector('[data-v6-carousel-progress]'),api:null,touchAction:viewport.style.touchAction||'',tabindex:viewport.getAttribute('tabindex')};records.push(record);byViewport.set(viewport,record);viewport.tabIndex=0;viewport.style.touchAction='auto';
   record.focus=event=>{const slide=event.target.closest('.v6-carousel-slide'),slides=viewport.querySelector('.v6-carousel-track').children;initialize(record,slide?Math.max(0,Array.from(slides).indexOf(slide)):0);};
   record.move=direction=>()=>{const api=initialize(record);if(api)direction<0?api.scrollPrev():api.scrollNext();else viewport.scrollBy?.({left:direction*(document.documentElement.dir==='rtl'?-1:1)*viewport.clientWidth,behavior:host.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});track(direction<0?'previous':'next','guides');};record.previous=record.move(-1);record.forward=record.move(1);
   viewport.addEventListener('focusin',record.focus);controls.addEventListener('focusin',record.focus);record.prev.addEventListener('click',record.previous);record.next.addEventListener('click',record.forward);
  });
  if(typeof host.IntersectionObserver==='function'&&typeof host.EmblaCarousel==='function'){nearby=new host.IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)initialize(byViewport.get(entry.target));},{rootMargin:'300px 0px',threshold:0});records.forEach(r=>nearby.observe(r.viewport));}

  function sync(event){if(event.key===KEY){saved=hydrate(event.newValue,data.profiles);points();}if(event.key===PREF_KEY){prefs=preferences(event.newValue);displayOffset=prefs.offset;offset.value=String(prefs.offset/60);tick();}}
  host.addEventListener('storage',sync);const interval=host.setInterval(()=>{if(!document.hidden)tick();},1000),visible=()=>{if(!document.hidden)tick();};document.addEventListener('visibilitychange',visible);root.dataset.mounted='true';points(state.scoreEdited);tick();return {refresh(){points();tick();},destroy(){destroyed=true;host.clearInterval(interval);host.removeEventListener('storage',sync);document.removeEventListener('visibilitychange',visible);nearby?.disconnect();carousels.forEach(c=>c.destroy());for(const r of records){r.viewport.removeEventListener('focusin',r.focus);r.viewport.nextElementSibling.removeEventListener('focusin',r.focus);r.prev.removeEventListener('click',r.previous);r.next.removeEventListener('click',r.forward);r.viewport.style.touchAction=r.touchAction;delete r.viewport.dataset.carouselReady;if(r.tabindex===null)r.viewport.removeAttribute('tabindex');else r.viewport.setAttribute('tabindex',r.tabindex);}}};
 }
 return {KEY,PREF_KEY,hydrate,preferences,mount};
});
