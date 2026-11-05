(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TS_COMMON_EVENTS=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function valid(event){return !!event&&event.verified===true&&typeof event.id==='string'&&Number.isFinite(Date.parse(event.startsAt))&&Number.isFinite(Date.parse(event.endsAt))&&Date.parse(event.startsAt)<Date.parse(event.endsAt)&&/^https:\/\//.test(event.officialURL);}
 function phase(event,now){if(!valid(event)||!Number.isFinite(now))return 'unverified';if(now<Date.parse(event.startsAt))return 'upcoming';if(now>=Date.parse(event.endsAt))return 'ended';return 'active';}
 function select(events,now){const rows=events.filter(valid),active=rows.filter(e=>phase(e,now)==='active').sort((a,b)=>(b.priority||0)-(a.priority||0)||Date.parse(b.startsAt)-Date.parse(a.startsAt));if(active.length)return {event:active[0],phase:'active'};const next=rows.filter(e=>phase(e,now)==='upcoming').sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));return next.length?{event:next[0],phase:'upcoming'}:{event:null,phase:'news'};}
 function countdown(ms){const s=Math.max(0,Math.ceil(ms/1000));return [Math.floor(s/86400),Math.floor(s%86400/3600),Math.floor(s%3600/60),s%60];}
 function availableCodes(codes,now){return codes.filter(c=>c.verified&&c.verification==='official-announcement'&&Date.parse(c.announcedAt)<=now&&now<Date.parse(c.endsAt));}
 function previewScore(rule,quantity,target){if(!rule||!Number.isFinite(rule.points)||rule.points<0||!Number.isSafeInteger(quantity)||quantity<0||!Number.isSafeInteger(target)||target<0)return null;const score=rule.points*quantity;if(!Number.isSafeInteger(score))return null;return {score,remaining:Math.max(0,target-score)};}
 function formatTime(value,locale,options={}){return new Intl.DateTimeFormat(locale,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',...options}).format(new Date(value));}
 return {valid,phase,select,countdown,availableCodes,previewScore,formatTime};
});
