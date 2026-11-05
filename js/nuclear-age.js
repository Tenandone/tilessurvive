(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.TS_NUCLEAR_AGE=api;api.mount(root.document);}})(typeof window==='object'?window:this,function(){
 'use strict';
 function plan(buildings,id,from,to){
  var building=buildings.find(function(b){return String(b.id)===String(id);});
  if(!building||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<from||to>building.stages.length)throw new RangeError('INVALID_RANGE');
  var stages=building.stages.slice(from,to),knownFuel=0,missing=[];
  stages.forEach(function(s){if(s.fuel===null){missing.push(s.id);return;}if(!Number.isSafeInteger(s.fuel)||s.fuel<0)throw new TypeError('INVALID_REQUIREMENT');knownFuel+=s.fuel;if(!Number.isSafeInteger(knownFuel))throw new RangeError('OVERFLOW');});
  return {buildingId:building.id,from:from,to:to,stageCount:stages.length,knownFuel:knownFuel,complete:missing.length===0,missingStages:missing};
 }
 function powerPlantCondition(buildings,id,from,to,currentSequence){
  plan(buildings,id,from,to);
  if(!Number.isInteger(currentSequence)||currentSequence<0||currentSequence>15)throw new RangeError('INVALID_POWER_PLANT_STATE');
  var building=buildings.find(function(b){return String(b.id)===String(id);}),required=null;
  building.stages.slice(from,to).forEach(function(stage){
   var q=stage.powerPlantRequirement;if(!q)return;
   if(q.buildingId!==800005||![1,2,3].includes(q.completedNuclearLevel)||q.completedSequence!==q.completedNuclearLevel*5||q.level!==30+q.completedNuclearLevel||q.rank!==0||q.sourceId!==[501054,501058,501249][q.completedNuclearLevel-1])throw new TypeError('INVALID_POWER_PLANT_REQUIREMENT');
   if(!required||q.completedSequence>required.completedSequence)required=q;
  });
  return required?{requiredLevel:required.completedNuclearLevel,requiredSequence:required.completedSequence,sourceId:required.sourceId,met:currentSequence>=required.completedSequence}:{requiredLevel:null,requiredSequence:null,sourceId:null,met:null};
 }
 function mountSummary(document){
  var host=document&&document.querySelector('[data-nuclear-fuel-summary]');if(!host||host.dataset.nuclearFuelMounted==='true')return;
  var buttons=host.querySelectorAll('[data-nuclear-fuel-mode]'),scopes=host.querySelectorAll('[data-nuclear-fuel-scope-control]'),panels=host.querySelectorAll('[data-nuclear-fuel-panel]'),downloads=host.querySelectorAll('[data-nuclear-fuel-download-scope]'),mode='incremental',scope='tree';
  function update(){buttons.forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.nuclearFuelMode===mode));});scopes.forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.nuclearFuelScopeControl===scope));});panels.forEach(function(panel){panel.hidden=panel.dataset.nuclearFuelPanel!==mode||panel.dataset.nuclearFuelScope!==scope;});downloads.forEach(function(link){link.hidden=link.dataset.nuclearFuelDownloadScope!==scope;});host.dataset.nuclearFuelMode=mode;host.dataset.nuclearFuelScope=scope;}
  buttons.forEach(function(button){button.addEventListener('click',function(){var next=button.dataset.nuclearFuelMode;if(next!=='incremental'&&next!=='cumulative')return;mode=next;update();});});
  scopes.forEach(function(button){button.addEventListener('click',function(){var next=button.dataset.nuclearFuelScopeControl;if(next!=='tree'&&next!=='all')return;scope=next;update();});});
  host.dataset.nuclearFuelMounted='true';update();
 }
 function mount(document){
  mountSummary(document);
  var host=document&&document.querySelector('[data-nuclear-planner]'),payload=document&&document.getElementById('ts-nuclear-age');if(!host||!payload)return;
  var data;try{data=JSON.parse(payload.textContent);}catch(_){return;}
  var form=host.querySelector('form'),building=form.elements.building,from=form.elements.from,to=form.elements.to,powerPlant=form.elements.powerPlant,powerPlantControl=host.querySelector('[data-nuclear-power-plant-control]'),requirement=host.querySelector('[data-nuclear-requirement]'),result=host.querySelector('[data-nuclear-result]'),status=host.querySelector('[data-nuclear-status]'),nf=new Intl.NumberFormat(data.numberLocale);
  function options(){var row=data.buildings.find(function(b){return String(b.id)===building.value;});[from,to].forEach(function(select){var value=Number(select.value);select.replaceChildren();[row.baseLabel||data.copy.baseLevels].concat(row.stages.map(function(s){return s.label;})).forEach(function(label,index){var option=document.createElement('option');option.value=String(index);option.textContent=label;select.appendChild(option);});select.value=String(Number.isInteger(value)&&value<=row.stages.length?value:0);});}
  function update(track){
   if(requirement){requirement.textContent='';requirement.hidden=true;delete requirement.dataset.met;}
   var row=data.buildings.find(function(b){return String(b.id)===building.value;}),needsPowerPlant=row&&row.stages.some(function(s){return !!s.powerPlantRequirement;});
   if(powerPlantControl)powerPlantControl.hidden=!needsPowerPlant;
   try{
    var p=plan(data.buildings,building.value,Number(from.value),Number(to.value));result.textContent=p.complete||p.knownFuel>0?nf.format(p.knownFuel):'—';status.textContent=p.complete?'':data.copy.incompletePlan;host.dataset.complete=String(p.complete);
    if(needsPowerPlant&&powerPlant&&requirement){var condition=powerPlantCondition(data.buildings,building.value,Number(from.value),Number(to.value),Number(powerPlant.value));if(condition.requiredLevel!==null){requirement.textContent=data.copy[condition.met?'powerPlantMet':'powerPlantRequired'].replace(/\{level\}/g,nf.format(condition.requiredLevel))+' '+data.copy.otherConditions;requirement.hidden=false;requirement.dataset.met=String(condition.met);}}
    if(track&&typeof window==='object'&&window.TS_V3_AFFILIATE)window.TS_V3_AFFILIATE.trackFeature('calculator','result');
   }catch(_){result.textContent='—';status.textContent=data.copy.invalidRange;host.dataset.complete='false';}
  }
  building.addEventListener('change',function(){options();update(false);});from.addEventListener('change',function(){update(false);});to.addEventListener('change',function(){update(false);});
  if(powerPlant)powerPlant.addEventListener('change',function(){update(false);});
  form.addEventListener('submit',function(event){event.preventDefault();update(true);});options();to.value=String(Math.min(5,data.buildings[0].stages.length));update(false);
 }
 return {plan:plan,powerPlantCondition:powerPlantCondition,mountSummary:mountSummary,mount:mount};
});
