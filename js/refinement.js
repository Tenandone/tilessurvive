(function(){
 'use strict';
 const form=document.querySelector('[data-pet-controls]');
 if(form){
  const input=form.elements.q,role=form.elements.role,rows=[...document.querySelectorAll('[data-pet-role]')],count=form.querySelector('[data-pet-count]');
  const render=()=>{const q=input.value.normalize('NFKC').toLocaleLowerCase();let visible=0;for(const row of rows){row.hidden=!(row.dataset.petName.normalize('NFKC').toLocaleLowerCase().includes(q)&&(!role.value||row.dataset.petRole===role.value));if(!row.hidden)visible++;}count.textContent=visible+' / '+rows.length;};
  form.addEventListener('input',render);form.addEventListener('change',render);
  form.addEventListener('submit',e=>e.preventDefault());
  form.addEventListener('reset',()=>{input.value='';role.value='';render();});render();
 }
 for(const picker of document.querySelectorAll('[data-stage-picker]')){
  const select=picker.querySelector('select'),results=[...picker.querySelectorAll('[data-stage-result]')];
  const render=()=>results.forEach(p=>{p.hidden=p.dataset.stageResult!==select.value;});
  picker.setAttribute('aria-live','polite');select.addEventListener('change',render);render();
 }
})();
