(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.TS_GIFT_CODES=api;if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>api.mount(root.document,root));else api.mount(root.document,root);}})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function expiry(code){const ms=Date.parse(code?.expiresAt||code?.endsAt);return Number.isFinite(ms)?ms:null;}
 function phase(code,now){if(!code||!Number.isFinite(now))return 'unverified';const end=expiry(code);if(end!==null&&now>=end)return 'expired';const start=Date.parse(code.startAt||code.announcedAt);if(Number.isFinite(start)&&now<start)return 'upcoming';if(code.permanent===true&&end===null)return 'ongoing';if(end!==null&&code.verified===true&&code.verification==='official-announcement')return 'limited';return 'unverified';}
 function parts(ms){const s=Math.max(0,Math.ceil(ms/1000));return [Math.floor(s/86400),Math.floor(s%86400/3600),Math.floor(s%3600/60),s%60];}
 function formatDate(iso,locale,timeZone){return new Intl.DateTimeFormat(locale,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',...(timeZone?{timeZone}:{})}).format(new Date(iso));}
 function mount(document,host){const mounts=[];for(const root of document.querySelectorAll('[data-gift-codes]')){
  if(root.dataset.giftMounted==='true')continue;const config=root.querySelector('[data-gift-config]');if(!config)continue;let d;try{d=JSON.parse(config.textContent);}catch{continue;}root.dataset.giftMounted='true';const c=d.copy,nf=new Intl.NumberFormat(d.numberLocale),listeners=[];let stopped=false;
  function tick(now=Date.now()){
   const counts={limited:0,ongoing:0,expired:0,unverified:0,upcoming:0};
   for(const node of root.querySelectorAll('[data-gift-code]')){const item=d.codes.find(x=>x.code===node.dataset.giftCode);if(!item)continue;const state=phase(item,now);counts[state]++;node.dataset.giftPhase=state;node.hidden=!d.archive&&(state==='expired'||state==='upcoming');
    const label=node.querySelector('[data-gift-phase]');if(label)label.textContent=c[state==='limited'?'limitedTitle':state==='ongoing'?'ongoingTitle':state==='expired'?'expired':state==='upcoming'?'upcoming':'needsCheck'];
    const timer=node.querySelector('[data-gift-countdown]');if(timer){timer.hidden=state!=='limited';if(state==='limited'){const values=parts(expiry(item)-now);timer.querySelectorAll('[data-gift-digit]').forEach((n,i)=>n.textContent=nf.format(values[i]));}}
    const local=node.querySelector('[data-gift-local]');if(local&&item.expiresAt&&!local.dataset.formatted){local.textContent=formatDate(item.expiresAt,d.numberLocale);local.dataset.formatted='true';}
    const archived=root.querySelector('[data-gift-archive-list]');const active=root.querySelector('[data-gift-current-list]');if(d.archive&&state==='expired'&&archived&&node.parentElement!==archived)archived.appendChild(node);else if(d.archive&&state!=='expired'&&active&&node.parentElement!==active)active.appendChild(node);
   }
   const empty=root.querySelector('[data-gift-empty-limited]');if(empty)empty.hidden=counts.limited>0;
   const archive=root.querySelector('[data-gift-archive]');if(archive)archive.hidden=counts.expired===0;
   const count=root.querySelector('[data-gift-archive-count]');if(count)count.textContent=nf.format(counts.expired);
   return counts;
  }
  for(const b of root.querySelectorAll('[data-gift-copy]')){const handler=async()=>{const card=b.closest('[data-gift-code]'),output=card.querySelector('[data-gift-copy-status]');try{if(!host.navigator?.clipboard?.writeText)throw Error('Clipboard unavailable');await host.navigator.clipboard.writeText(b.dataset.giftCopy);if(stopped)return;output.textContent=c.copied;b.querySelector('span').textContent=c.copied;try{host.TS_V3_AFFILIATE?.trackLanding?.('copy','coupon');}catch{/* Analytics must not change clipboard results. */}}catch{if(stopped)return;output.textContent=c.copyFailed;b.querySelector('span').textContent=c.copy;const code=card.querySelector('samp');if(code&&document.createRange&&host.getSelection){const range=document.createRange();range.selectNodeContents(code);const selection=host.getSelection();selection.removeAllRanges();selection.addRange(range);}}};b.addEventListener('click',handler);listeners.push([b,handler]);}
  tick();const interval=host.setInterval?host.setInterval(tick,1000):null;mounts.push({root,tick,destroy(){stopped=true;listeners.forEach(([n,h])=>n.removeEventListener('click',h));if(interval!==null)host.clearInterval(interval);delete root.dataset.giftMounted;}});
 }
 return {mounts,tick(now){return mounts.map(m=>m.tick(now));},destroy(){mounts.forEach(m=>m.destroy());}};
 }
 return {expiry,phase,parts,formatDate,mount};
});
