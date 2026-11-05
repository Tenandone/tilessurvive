(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.TS_V61_TEN=api;function start(){api.mount(document,root);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();}})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 var CODE='#s4qU',TEN='https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive',placements=new Set(['banner','footer','guide','additional_coupon','bookmark']);
 function mount(document,host){
  if(!document.querySelector('[data-v61-ten]')||document.documentElement.hasAttribute('data-v61-ten-ready'))return null;
  document.documentElement.setAttribute('data-v61-ten-ready','');
  function where(node){var container=node.closest('[data-ten-placement]'),value=container&&container.getAttribute('data-ten-placement');return placements.has(value)?value:'guide';}
  function track(action,node){var analytics=host.TS_V3_AFFILIATE;return analytics&&typeof analytics.trackTen==='function'?analytics.trackTen(action,where(node)):false;}
  function click(event){
   var node=event.target&&event.target.nodeType===1?event.target:event.target&&event.target.parentElement;if(!node||!node.closest)return;
   var copy=node.closest('[data-ten-copy]');
   if(copy){
    var kind=copy.getAttribute('data-ten-copy');if(!['code','url'].includes(kind)||copy.disabled)return;
    var section=copy.closest('[data-v61-ten]'),status=section.querySelector('[data-ten-copy-status]');copy.disabled=true;
    Promise.resolve().then(function(){if(!host.navigator||!host.navigator.clipboard||typeof host.navigator.clipboard.writeText!=='function')throw Error('Clipboard unavailable');return host.navigator.clipboard.writeText(kind==='code'?CODE:TEN);}).then(function(){copy.textContent=copy.getAttribute('data-copied');status.textContent=copy.getAttribute('data-copied');track(kind==='code'?'code_copy':'url_copy',copy);},function(){copy.textContent=copy.getAttribute('data-copy-label');status.textContent=copy.getAttribute('data-copy-failed');var value=section.querySelector(kind==='code'?'[data-ten-code]':'[data-ten-url]');if(value){value.setAttribute('tabindex','0');value.focus();}}).finally(function(){copy.disabled=false;});
    return;
   }
   var bookmark=node.closest('[data-ten-bookmark]');
   if(bookmark){var block=bookmark.closest('[data-v61-ten]'),instructions=block.querySelector('[data-ten-bookmark-instructions]');if(instructions&&instructions.hidden){instructions.hidden=false;bookmark.setAttribute('aria-expanded','true');track('bookmark_help',bookmark);}return;}
   var link=node.closest('[data-ten-bookmark-link]');if(link){var destination=document.getElementById(link.getAttribute('href').split('#')[1]),help=destination&&destination.querySelector('[data-ten-bookmark]');if(help){var instructions=help.closest('[data-v61-ten]').querySelector('[data-ten-bookmark-instructions]');instructions.hidden=false;help.setAttribute('aria-expanded','true');track('bookmark_help',link);}}
  }
  document.addEventListener('click',click);
  return {destroy:function(){document.removeEventListener('click',click);document.documentElement.removeAttribute('data-v61-ten-ready');}};
 }
 return {CODE:CODE,TEN:TEN,mount:mount};
});
