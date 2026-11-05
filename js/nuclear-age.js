(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.TS_NUCLEAR_AGE=api;api.mount(root.document);}})(typeof window==='object'?window:this,function(){
 'use strict';
 function plan(buildings,id,from,to){
  var building=buildings.find(function(b){return String(b.id)===String(id);});
  if(!building||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to>building.stages.length)throw new RangeError('INVALID_RANGE');
  var stages=building.stages.slice(from,to),knownFuel=0,missing=[];
  stages.forEach(function(s){if(s.fuel===null){missing.push(s.id);return;}if(!Number.isSafeInteger(s.fuel)||s.fuel<0)throw new TypeError('INVALID_REQUIREMENT');knownFuel+=s.fuel;if(!Number.isSafeInteger(knownFuel))throw new RangeError('OVERFLOW');});
  return {buildingId:building.id,from:from,to:to,stageCount:stages.length,knownFuel:knownFuel,complete:missing.length===0,missingStages:missing};
 }
 function mountSummary(document){
  var host=document&&document.querySelector('[data-nuclear-fuel-summary]');if(!host||host.dataset.nuclearFuelMounted==='true')return;
  var buttons=host.querySelectorAll('[data-nuclear-fuel-mode]'),panels=host.querySelectorAll('[data-nuclear-fuel-panel]');
  function select(mode){if(mode!=='incremental'&&mode!=='cumulative')return;buttons.forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.nuclearFuelMode===mode));});panels.forEach(function(panel){panel.hidden=panel.dataset.nuclearFuelPanel!==mode;});host.dataset.nuclearFuelMode=mode;}
  buttons.forEach(function(button){button.addEventListener('click',function(){select(button.dataset.nuclearFuelMode);});});
  host.dataset.nuclearFuelMounted='true';select('incremental');
 }
 function mount(document){
  mountSummary(document);
  var host=document&&document.querySelector('[data-nuclear-planner]'),payload=document&&document.getElementById('ts-nuclear-age');if(!host||!payload)return;
  var data;try{data=JSON.parse(payload.textContent);}catch(_){return;}
  var form=host.querySelector('form'),building=form.elements.building,from=form.elements.from,to=form.elements.to,result=host.querySelector('[data-nuclear-result]'),status=host.querySelector('[data-nuclear-status]'),nf=new Intl.NumberFormat(data.numberLocale);
  function options(){var row=data.buildings.find(function(b){return String(b.id)===building.value;});[from,to].forEach(function(select){var value=Number(select.value);select.replaceChildren();[row.baseLabel||data.copy.baseLevels].concat(row.stages.map(function(s){return s.label;})).forEach(function(label,index){var option=document.createElement('option');option.value=String(index);option.textContent=label;select.appendChild(option);});select.value=String(Number.isInteger(value)&&value<=row.stages.length?value:0);});}
  function update(track){try{var p=plan(data.buildings,building.value,Number(from.value),Number(to.value));result.textContent=p.complete||p.knownFuel>0?nf.format(p.knownFuel):'—';status.textContent=p.complete?'':data.copy.incompletePlan;host.dataset.complete=String(p.complete);if(track&&typeof window==='object'&&window.TS_V3_AFFILIATE)window.TS_V3_AFFILIATE.trackFeature('calculator','result');}catch(_){result.textContent='—';status.textContent=data.copy.invalidRange;host.dataset.complete='false';}}
  building.addEventListener('change',function(){options();update(false);});from.addEventListener('change',function(){update(false);});to.addEventListener('change',function(){update(false);});
  form.addEventListener('submit',function(event){event.preventDefault();update(true);});options();to.value=String(Math.min(5,data.buildings[0].stages.length));update(false);
 }
 return {plan:plan,mountSummary:mountSummary,mount:mount};
});
