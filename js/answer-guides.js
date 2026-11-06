(function(){'use strict';
 var canonical=document.querySelector('link[rel="canonical"]'),host=document.querySelector('[data-answer-guide]');
 if(!host||!canonical||!navigator.clipboard?.writeText)return;
 var base;try{base=new URL(canonical.href);if(base.origin!=='https://tilessurvive.net')return;}catch(_){return;}
 host.querySelectorAll('[data-answer-copy]').forEach(function(button){button.hidden=false;button.addEventListener('click',async function(){var id=button.getAttribute('data-answer-copy'),answer=document.getElementById(id),status=host.querySelector('[data-answer-copy-status]');if(!answer||!host.contains(answer))return;var url=new URL(base.href);url.hash=id;try{await navigator.clipboard.writeText(url.href);if(status)status.textContent=status.getAttribute('data-copied');}catch(_){if(status)status.textContent=status.getAttribute('data-failed');}});});
})();
