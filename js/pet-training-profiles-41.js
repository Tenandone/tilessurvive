(function(root){
 'use strict';
 function calculate(profile,from,to,held=0){
  if(!profile||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to>profile.maxStage||to<from||!Number.isSafeInteger(held)||held<0)return {error:'invalid'};
  let total=0;
  for(let stage=from;stage<to;stage++){const rows=profile.trainingRows.filter(r=>r.from===stage&&r.to===stage+1);if(rows.length!==1||!Number.isSafeInteger(rows[0].cost)||rows[0].cost<=0)return{error:'missing'};total+=rows[0].cost;}
  return {total,held,shortage:Math.max(0,total-held)};
 }
 if(typeof module==='object'&&module.exports)module.exports={calculate};
 if(!root.document)return;
 const d=root.document,data=d.getElementById('pet-training-profiles-41'),form=d.querySelector('[data-growth-form="petTraining"]'),exp=d.querySelector('[data-growth-form="petExp"]');if(!data||!form||!exp)return;
 const cfg=JSON.parse(data.textContent),profiles=new Map(cfg.pets.map(p=>[p.id,p])),select=exp.querySelector('[name="pet"]'),out=form.querySelector('output'),original=JSON.parse(form.querySelector('script[type="application/json"]').textContent),lang=d.documentElement.dataset.lang||d.documentElement.lang||'en',format=n=>n.toLocaleString(lang);
 const trainingSelect=form.querySelector('[name="pet"]');if(!select||!trainingSelect)return;
 const defaults=new Map([...form.querySelectorAll('input')].map(input=>[input,input.getAttribute('value')]));
 const number=name=>{const value=form.querySelector(`[name="${name}"]`).value;return value.trim()===''?NaN:Number(value);};
 function render(){
  const profile=profiles.get(select.value),from=number('from'),to=number('to'),held=number('held'),result=calculate(profile,from,to,held);
  trainingSelect.value=select.value;
  const resource=profile?.resourceNames[lang]||'';form.querySelector('[data-pet-training-unit-41]').textContent=resource?' · '+resource:'';
  form.querySelectorAll('input').forEach(input=>{const value=input.value.trim()===''?NaN:Number(input.value);input.setAttribute('aria-invalid',String(!Number.isFinite(value)||value<Number(input.min)||(input.max!==''&&value>Number(input.max))||(input.step==='1'&&!Number.isInteger(value))));});
  if(to<from)form.querySelector('[name="to"]').setAttribute('aria-invalid','true');
  out.dataset.result=result.error||String(result.total);out.dataset.shortage=result.shortage??'';out.classList.toggle('ts3-result-error',!!result.error);out.replaceChildren();
  const table=d.getElementById(form.dataset.growthTable);table?.querySelectorAll('tbody tr').forEach((row,i)=>row.classList.toggle('ts3-in-range',!result.error&&i>=from&&i<to));
  if(result.error){out.textContent=cfg.labels[result.error];return;}
  const range=d.createElement('span');range.className='ts3-result-range';range.textContent=profile.names[lang]+' · '+format(from)+' → '+format(to);out.append(range);
  for(const [label,value] of [[original.total,result.total],[original.shortage,result.shortage]]){const group=d.createElement('div');group.className='ts3-result-value';for(const [tag,text] of [['span',label],['strong',format(value)],['small',resource]]){const node=d.createElement(tag);node.textContent=text;group.append(node);}out.append(group);}
 }
 for(const type of ['input','change']){
  form.addEventListener(type,event=>{
   event.stopImmediatePropagation();
   if(event.target===trainingSelect){select.value=trainingSelect.value;select.dispatchEvent(new root.Event('change',{bubbles:true}));}
   render();
  },true);
  // Document capture sees species changes before the EXP form's existing capture handler.
  d.addEventListener(type,event=>{if(exp.contains(event.target))render();},true);
 }
 form.querySelector('[data-growth-reset]')?.addEventListener('click',event=>{event.stopImmediatePropagation();for(const input of form.querySelectorAll('input'))input.value=defaults.get(input);render();},true);
 // The EXP client resets species during capture without emitting a change event.
 // This script loads after that client, so refresh after its reset handler runs.
 exp.querySelector('[data-growth-reset]')?.addEventListener('click',render,true);
 render();
 // Existing calculator initialization runs at DOMContentLoaded after deferred scripts.
 if(d.readyState!=='complete')d.addEventListener('DOMContentLoaded',render,{once:true});
})(typeof window==='object'?window:globalThis);
