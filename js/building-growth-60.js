(function(root){'use strict';
function init(d){
 d.querySelectorAll('[data-building-growth-60]').forEach(host=>{
  if(host.hasAttribute('data-c60-ready'))return;host.setAttribute('data-c60-ready','');
  const select=host.querySelector('[data-c60-building-select]'),status=host.querySelector('[data-c60-building-status]'),panels=[...host.querySelectorAll('[data-c60-building-profile]')];
  function update(){const id=select.value;for(const panel of panels){panel.hidden=!!id&&panel.dataset.c60BuildingProfile!==id;panel.open=!!id&&panel.dataset.c60BuildingProfile===id;}status.textContent=id?host.dataset.c60Selected+': '+select.options[select.selectedIndex].textContent:host.dataset.c60All;}
  select.addEventListener('change',update);update();
 });
}
if(typeof module==='object')module.exports={init};
if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>init(root.document));else init(root.document);}
})(typeof window==='object'?window:globalThis);
