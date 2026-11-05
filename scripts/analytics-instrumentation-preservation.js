'use strict';
const assert=require('node:assert/strict');
// Reverse only the reviewed success notifications. Historical guards still
// compare every remaining source byte, including calculation and UI behavior.
const replacements={
 'js/tools-speedup-calculator.js':[
  ["calc.addEventListener('click',function(){render();var inputs=['speedupDays','speedupHours','speedupMinutes'].map(el),valid=inputs.every(function(n){return n&&(n.value.trim()===''||Number.isSafeInteger(Number(n.value))&&Number(n.value)>=0);});if(valid&&Number.isSafeInteger(numberValue('speedupDays')*1440+numberValue('speedupHours')*60+numberValue('speedupMinutes'))){try{window.TS_ANALYTICS?.track?.('calculator_run',{feature:'speedup',action:'result',placement:'calculator'});}catch(_){}}});","calc.addEventListener('click',render);"]
 ],
 'js/database-22.js':[
  ['function update(measure){','function update(){'],
  ["\n   if(measure===true&&!result.error){try{root.TS_ANALYTICS?.track?.('calculator_run',{feature:/^pet/.test(form.dataset.growthForm)?'pet_growth':'hero_growth',action:'result',placement:'calculator'});}catch(_){}}",''],
  ["form.addEventListener('change',()=>update(true));","form.addEventListener('change',update);"]
 ],
 'js/pet-exp-profiles-40.js':[
  ['function render(measure){','function render(){'],
  ["\n  if(measure===true){try{root.TS_ANALYTICS?.track?.('calculator_run',{feature:'pet_growth',action:'result',placement:'calculator'});}catch(_){}}",''],
  ["event.stopImmediatePropagation();render(type==='change');","event.stopImmediatePropagation();render();"]
 ],
 'js/pet-training-profiles-41.js':[
  ['function render(measure){','function render(){'],
  ["\n  if(measure===true){try{root.TS_ANALYTICS?.track?.('calculator_run',{feature:'pet_growth',action:'result',placement:'calculator'});}catch(_){}}",''],
  ["render(type==='change'&&event.target!==trainingSelect);","render();"]
 ]
};
function strip(file,source){
 let out=source.replaceAll('\r\n','\n');
 if(!out.includes('TS_ANALYTICS'))return out;
 assert(replacements[file],'Unreviewed instrumentation owner '+file);
 for(const [before,after]of replacements[file]){assert.equal(out.split(before).length-1,1,'Exact analytics addition: '+file);out=out.replace(before,after);}
 assert(!out.includes('TS_ANALYTICS'),'Unexpected additional analytics call '+file);
 return out;
}
module.exports={strip};
