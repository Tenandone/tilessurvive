/* Verified, contiguous transition costs only. Existing platform formulas stay untouched. */
(function(root){
 'use strict';
 function calculate(rows,from,to,held=0){
  if(!Number.isInteger(from)||!Number.isInteger(to)||to<from||!Number.isFinite(held)||held<0)return {error:'invalid'};
  if(!rows.length||from<rows[0].from||to>rows[rows.length-1].to)return {error:'invalid'};
  let total=0;const missing=[];
  for(let level=from;level<to;level++){const r=rows.find(x=>x.from===level&&x.to===level+1);if(!r||!Number.isFinite(r.cost))missing.push(level);else total+=r.cost;}
  return missing.length?{error:'missing',missing}:{total,held,shortage:Math.max(0,total-held)};
 }
 if(typeof module!=='undefined')module.exports={calculate};
 if(!root.document)return;
 document.querySelectorAll('[data-growth-form]').forEach(form=>{
  const cfg=JSON.parse(form.querySelector('script[type="application/json"]').textContent);
  function update(measure){
   const number=name=>{const v=form.elements.namedItem(name).value;return v.trim()===''?NaN:Number(v);};
   const result=calculate(cfg.rows,number('from'),number('to'),number('held'));
   const out=form.querySelector('output');
   const lang=root.TS_LOCALES?.current(),entry=root.TS_LOCALES?.locales.find(row=>row.code===lang);
   const displayLocale=document.documentElement.lang==='de'?'de':entry&&!['ko','en','ja','ru','zh-tw','de'].includes(lang)?entry.numberLocale:undefined;
   out.textContent=result.error?cfg[result.error]+(result.missing?' '+result.missing.map(x=>x+' → '+(x+1)).join(', '):''):cfg.total+': '+result.total.toLocaleString(displayLocale)+' '+cfg.unit+' · '+cfg.shortage+': '+result.shortage.toLocaleString(displayLocale)+' '+cfg.unit;
   out.dataset.result=result.error||String(result.total);out.dataset.shortage=result.shortage??'';
   if(measure===true&&!result.error){try{root.TS_ANALYTICS?.track?.('calculator_run',{feature:/^pet/.test(form.dataset.growthForm)?'pet_growth':'hero_growth',action:'result',placement:'calculator'});}catch(_){}}
  }
  form.addEventListener('input',update);form.addEventListener('change',()=>update(true));form.addEventListener('submit',e=>e.preventDefault());update();
 });
})(typeof window!=='undefined'?window:globalThis);
