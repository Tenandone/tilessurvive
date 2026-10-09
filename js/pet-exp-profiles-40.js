/* Species selection for the existing EXP form; Starhorn's original handler stays intact. */
(function(root){
 'use strict';
 const math=typeof module==='object'&&module.exports?require('./platform-math'):root.TS_MATH;
 function calculate(profile,from,to,held=0){
  if(!profile||!Number.isInteger(from)||!Number.isInteger(to)||from<1||to>profile.maxLevel||to<from||!Number.isFinite(held)||held<0)return {error:'invalid'};
  try{const rows=profile.expRows.map(r=>({level:r.to,cells:[r.cost]})),total=math.sumRange(rows,from,to,[0],-1).totals[0];return {total,held,shortage:Math.max(0,total-held)};}catch{return {error:'missing'};}
 }
 if(typeof module==='object'&&module.exports)module.exports={calculate};
 if(!root.document)return;
 const d=root.document,form=d.querySelector('[data-growth-form="petExp"]'),data=d.getElementById('pet-exp-profiles-40');if(!form||!data||!math)return;
 const cfg=JSON.parse(data.textContent),profiles=new Map(cfg.pets.map(p=>[p.id,p])),select=form.querySelector('[name="pet"]'),out=form.querySelector('output'),original=JSON.parse(form.querySelector('script[type="application/json"]').textContent);
 const lang=d.documentElement.dataset.lang||d.documentElement.lang||'en',format=n=>n.toLocaleString(lang);
 const number=name=>{const raw=form.querySelector(`[name="${name}"]`).value;return raw.trim()===''?NaN:Number(raw);};
 function render(){
  const from=number('from'),to=number('to'),held=number('held'),result=calculate(profiles.get(select.value),from,to,held);
  form.querySelectorAll('input').forEach(input=>{const value=input.value.trim()===''?NaN:Number(input.value);input.setAttribute('aria-invalid',String(!Number.isFinite(value)||value<Number(input.min)||(input.max!==''&&value>Number(input.max))||(input.step==='1'&&!Number.isInteger(value))));});
  if(to<from)form.querySelector('[name="to"]').setAttribute('aria-invalid','true');
  out.dataset.result=result.error||String(result.total);out.dataset.shortage=result.shortage??'';out.classList.toggle('ts3-result-error',!!result.error);out.replaceChildren();
  if(result.error){out.textContent=original[result.error];return;}
  const range=d.createElement('span');range.className='ts3-result-range';range.textContent=profiles.get(select.value).names[lang]+' · '+format(from)+' → '+format(to);out.append(range);
  for(const [label,value] of [[original.total,result.total],[original.shortage,result.shortage]]){const item=d.createElement('div');item.className='ts3-result-value';for(const [tag,text] of [['span',label],['strong',format(value)],['small','EXP']]){const node=d.createElement(tag);node.textContent=text;item.append(node);}out.append(item);}
  const legacyTable=d.getElementById(form.dataset.growthTable);legacyTable?.querySelectorAll('.ts3-in-range').forEach(row=>row.classList.remove('ts3-in-range'));
 }
 // Capture prevents the Starhorn-specific handler from overwriting another species.
 // Starhorn events pass through unchanged to both original calculation/presentation handlers.
 for(const type of ['input','change'])form.addEventListener(type,event=>{if(select.value==='starhorn')return;event.stopImmediatePropagation();render();},true);
 form.querySelector('[data-growth-reset]')?.addEventListener('click',()=>{select.value='starhorn';},true);
})(typeof window==='object'?window:globalThis);
