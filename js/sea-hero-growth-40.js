(function(global){
 'use strict';
 function select(rows,level){if(!Number.isInteger(level))throw Error('Invalid level');const row=rows.find(r=>r.level===level);if(!row)throw Error('Unavailable level');return row;}
 function compareSkills(skills,from,to){return skills.map(s=>({id:s.id,from:select(s.values,from).value,to:select(s.values,to).value,unit:s.unit}));}
 function format(template,args){return template.replace(/\{(\d+)\}/g,(_,i)=>{if(typeof args[Number(i)]!=='string')throw Error('Missing effect argument');return args[Number(i)];});}
 function displayNumber(value,lang){return lang==='de'?value.split('.').map((part,i)=>i?part:part.replace(/\B(?=(\d{3})+(?!\d))/g,'.')).join(','):value;}
 function compareGear(gear,lang,from,to){const template=gear.descriptionTemplate[lang];if(typeof template!=='string')throw Error('Missing language');const args=row=>row.args.map(arg=>lang==='de'?arg.replace(/\d+(?:\.\d+)?/g,n=>displayNumber(n,lang)):arg);return{from:format(template,args(select(gear.levels,from))),to:format(template,args(select(gear.levels,to)))};}
 const api={compareSkills,compareGear,format};if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(!global.document)return;const d=global.document,node=d.getElementById('sea-hero-growth-data');if(!node)return;
 const config=JSON.parse(node.textContent),lang=config.language,value=(s,unit)=>(lang==='ru'?s.replace('.',','):displayNumber(s,lang))+(unit==='percent-atk'?'% ATK':'%');
 for(const form of d.querySelectorAll('[data-sea-growth-controls]')){const kind=form.getAttribute('data-sea-growth-controls'),table=d.getElementById(kind==='skills'?'dave-live-level-table':'sea-gear-live-table'),status=form.querySelector('[role="status"]');if(!table)continue;
 const update=()=>{try{const from=Number(form.querySelector('[name="from"]').value),to=Number(form.querySelector('[name="to"]').value);if(kind==='skills'){const rows=compareSkills(config.skills,from,to);for(const r of rows){const cells=table.querySelector('[data-dave-skill="'+r.id+'"]').querySelectorAll('td');cells[0].textContent=value(r.from,r.unit);cells[1].textContent=value(r.to,r.unit);}}else{const result=compareGear(config.gear,lang,from,to),cells=table.querySelectorAll('tbody td');cells[0].textContent=result.from;cells[1].textContent=result.to;}table.querySelectorAll('thead th')[1].textContent='Lv.'+from;table.querySelectorAll('thead th')[2].textContent='Lv.'+to;status.textContent=config.copy.updated.replace('{from}',from).replace('{to}',to);}catch{status.textContent=config.copy.invalid;}};
 form.hidden=false;form.addEventListener('change',update);form.addEventListener('submit',e=>e.preventDefault());
 }
})(typeof window==='undefined'?globalThis:window);
