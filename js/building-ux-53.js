/* Read-only level view of the actual table. Calculators keep their shared math. */
(function(){'use strict';
function init(){
 const label=document.documentElement.getAttribute('data-building-level-label-53');
 document.querySelectorAll('[data-building-table-53]').forEach((wrap,index)=>{
 const table=wrap.querySelector('table'),rows=[...table.querySelectorAll('tbody tr')],heads=[...table.querySelectorAll('thead th')].map(n=>n.textContent.trim());
 if(!rows.length)return;const box=document.createElement('div');box.className='building-level-view-53';const select=document.createElement('select');select.id='building-level-view-'+index;const title=document.createElement('label');title.htmlFor=select.id;title.textContent=label;
 rows.forEach((row,i)=>{const option=document.createElement('option');option.value=i;option.textContent=heads[0]+' '+row.children[0].textContent.trim();select.append(option);});
 const values=document.createElement('dl');values.setAttribute('aria-live','polite');function update(){values.replaceChildren();[...rows[Number(select.value)].children].forEach((cell,i)=>{const pair=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=heads[i];dd.innerHTML=cell.innerHTML;pair.append(dt,dd);values.append(pair);});}select.addEventListener('change',update);box.append(title,select,values);wrap.before(box);update();
 });
 function locate(){if(!location.hash)return;let target;try{target=document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{return;}if(!target)return;for(let n=target.parentElement;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;requestAnimationFrame(()=>{target.scrollIntoView({block:'start'});if(target.id==='upgrade-sheet')target.focus({preventScroll:true});});}
 window.addEventListener('hashchange',locate);locate();
}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
