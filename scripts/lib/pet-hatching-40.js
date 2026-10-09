'use strict';
const {parseHTML}=require('linkedom');
const model=require('../../data/foundation-40/pet-hatching.json'),copy=require('../../data/foundation-40/pet-hatching-copy'),oldCopy=require('../../data/expansion-22/copy');
const assert=(ok,message)=>{if(!ok)throw Error(message);};
module.exports=function(html,lang,petId=null){
 const d=parseHTML(html).document,t=copy[lang];let next=html;
 const replace=(node,change)=>{const before=node.outerHTML;change(node);assert(next.split(before).length===2,'Unique hatching slot');next=next.replace(before,()=>node.outerHTML);};
 const amount=n=>n===null?'—':n+'%';
 if(petId){
  const pet=model.pets.find(p=>p.id===petId);assert(pet,'Known hatch pet');
  const table=[...d.querySelectorAll('main table')].find(table=>{const rows=[...table.querySelectorAll('tbody tr')];return rows.length===3&&rows.every((r,i)=>r.children.length===2&&r.children[1].textContent===amount(pet[['normal','rare','precious'][i]]));});
  assert(table,'Exact existing pet probability table');
  for(const [i,row]of [...table.querySelectorAll('tbody tr')].entries()) {
   const cell=row.children[0];assert([oldCopy[lang][['rare','epic','legendary'][i]],t.eggs[i]].includes(cell.textContent),'Expected original egg category');
   replace(cell,node=>{node.textContent=t.eggs[i];});
  }
  // The existing table toolbar must reflect the renamed row labels too.
  const workbench=table.closest('.ts3-data-workbench');
  for(const [i,option]of [...workbench?.querySelectorAll('[data-row-select] option')||[]].entries())replace(option,node=>{node.textContent=t.eggs[i];});
 }else{
  const matrix=d.querySelector('.ts3-acquisition-matrix'),table=matrix?.querySelector('table');assert(table,'Existing hatch matrix');
  const rows=[...table.querySelectorAll('tbody tr')];assert(rows.length===7,'Seven matrix pets');
  rows.forEach((row,i)=>assert(JSON.stringify([...row.children].slice(2).map(n=>n.textContent))===JSON.stringify(['normal','rare','precious'].map(key=>amount(model.pets[i][key]))),'Existing percentages unchanged '+i));
  for(let i=0;i<3;i++)replace(table.querySelectorAll('thead th')[i+2],node=>{node.textContent=t.eggs[i];});
  for(let i=0;i<3;i++)for(const order of ['asc','desc']){const option=matrix.querySelector(`[data-sort] option[value="${i+2}:${order}"]`);if(option)replace(option,node=>{node.textContent=t.eggs[i]+' '+(order==='asc'?'↑':'↓');});}
  const stale=[...d.querySelectorAll('main p')].find(p=>p.textContent===t.namesOld);if(stale){assert(next.split(stale.outerHTML).length===2,'Exact obsolete Korean-name caveat');next=next.replace(stale.outerHTML,'');}
  const train=[...d.querySelectorAll('#pet-growth p')].find(p=>p.textContent===t.trainingOld||p.textContent===t.training);assert(train,'Existing narrow training summary');replace(train,node=>{node.textContent=t.training;});
  const existing=d.querySelector('[data-pet-rules-40]');
  const rules=d.createElement('ul');rules.setAttribute('data-pet-rules-40','');
  for(const rule of t.rules){const li=d.createElement('li');li.textContent=rule;rules.append(li);}
  if(existing){const before=existing.outerHTML;assert(next.split(before).length===2,'Unique pet rule list');next=next.replace(before,()=>rules.outerHTML);}
  else{const anchor=d.querySelector('[data-pet-team-rule]');assert(anchor&&next.split(anchor.outerHTML).length===2,'Official team-rule anchor');next=next.replace(anchor.outerHTML,()=>anchor.outerHTML+rules.outerHTML);}
 }
 const note=[...d.querySelectorAll('main p')].find(p=>p.textContent===oldCopy[lang].eggNote||p.textContent===t.note);assert(note,'Existing egg condition note');replace(note,node=>{node.textContent=t.note;node.setAttribute('data-pet-hatching-note','');});
 return next;
};
