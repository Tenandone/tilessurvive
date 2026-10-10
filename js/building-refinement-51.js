/* Read-only detail for the existing building planner. No cost or bonus formula. */
(function(root){
  'use strict';
  function selectedRows(rows,from,to){
    if(!Number.isInteger(from)||!Number.isInteger(to)||to<from||!rows.some(r=>r.level===from)||!rows.some(r=>r.level===to))return null;
    const result=rows.filter(r=>r.level>from&&r.level<=to);
    return result.length===to-from?result:null;
  }
  function init(){
    document.querySelectorAll('[data-building-plan-steps-51]').forEach(box=>{
      const form=box.closest('[data-building-planner]'),table=document.getElementById(form.dataset.table);
      if(!table||!root.TS_MATH)return;
      const rows=[...table.querySelectorAll('tbody tr')].map(row=>({level:Number(row.children[0].getAttribute('data-ts-original-value')||row.children[0].textContent.trim()),row}));
      const target=box.querySelector('tbody'),state=box.querySelector('[data-plan-step-state]');
      function update(){
        const from=Number(form.querySelector('[name=from]').value),to=Number(form.querySelector('[name=to]').value),chosen=selectedRows(rows,from,to);
        target.replaceChildren();
        if(!chosen){state.textContent=box.dataset.invalid;box.querySelector('.ts-table-wrap').hidden=true;return;}
        state.textContent=chosen.length?box.dataset.note:box.dataset.empty;
        box.querySelector('.ts-table-wrap').hidden=!chosen.length;
        for(const entry of chosen){const row=entry.row.cloneNode(true);row.removeAttribute('id');row.removeAttribute('class');row.removeAttribute('hidden');row.removeAttribute('aria-selected');row.style.removeProperty('display');for(const node of row.querySelectorAll('[id]'))node.removeAttribute('id');target.append(row);}
      }
      form.addEventListener('input',update);form.addEventListener('change',update);
      form.querySelector('[data-building-reset]')?.addEventListener('click',update);
      update();box.hidden=false;
    });
  }
  if(typeof module==='object'&&module.exports)module.exports={selectedRows};
  if(root.document){if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',init);else init();}
})(typeof window==='object'?window:globalThis);
