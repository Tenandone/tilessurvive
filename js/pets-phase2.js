/* Base level EXP only. Does not apply feeding effects or establish availability. */
(function(root){
 'use strict';
 function level(value){if(typeof value==='number')return Number.isInteger(value)?value:null;if(typeof value!=='string'||!/^\d+$/.test(value.trim()))return null;return Number(value.trim());}
 function sumExp(rows,from,to){
  const a=level(from),b=level(to);if(a===null||b===null||a<1||b>100||a>100||b<1||a>b||!Array.isArray(rows)||rows.length!==99)return null;
  let sum=0;for(let i=0;i<99;i++){const r=rows[i];if(!r||r.fromLevel!==i+1||r.toLevel!==i+2||!Number.isSafeInteger(r.exp)||r.exp<=0)return null;if(r.fromLevel>=a&&r.toLevel<=b)sum+=r.exp;}
  return Number.isSafeInteger(sum)?sum:null;
 }
 function mount(document){for(const form of document.querySelectorAll('[data-pets-phase2-exp]')){let data;try{data=JSON.parse(form.querySelector('[data-pets-phase2-data]').textContent);}catch(_){continue;}
  const output=form.querySelector('[data-pets-phase2-result]'),from=form.querySelector('[name="from"]'),to=form.querySelector('[name="to"]');
  function update(){const value=sumExp(data.expRows,from.value,to.value);output.textContent=value===null?data.invalid:value.toLocaleString(data.locale==='zh-tw'?'zh-TW':data.locale)+' EXP';}
  form.addEventListener('submit',function(event){event.preventDefault();update();});from.addEventListener('input',update);to.addEventListener('input',update);update();
 }}
 if(typeof module==='object'&&module.exports)module.exports={sumExp,mount};if(root.document)mount(root.document);
})(typeof window==='object'?window:globalThis);
