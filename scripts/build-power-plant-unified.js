'use strict';
// Publish the one approved projection into existing localized Power Plant pages.
// Keep every other page byte-for-byte, except the shared runtime cache key.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..');
const codes=require('../data/i18n/locales.json').locales.map(row=>row.code);
const copy=require('../data/power-plant-unified-copy.json');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function replaceOne(html,before,after,label){assert(before&&html.includes(before),'Missing exact source: '+label);if(before===after)return html;assert.equal(html.split(before).length,2,'Ambiguous replacement: '+label);return html.replace(before,after);}
function localizedConfig(existing,code){
  const published=require('./building-data-registry').publicBuildings('power-plant');
  assert.equal(published.length,1);assert.equal(published[0].id,800005);
  assert.equal(existing.slug,'power-plant');assert.equal(existing.lang,code);
  assert.equal(existing.buildings.length,1);assert.equal(existing.buildings[0].id,800005);
  const config=structuredClone(existing),building=structuredClone(published[0]);
  const priorConditions=existing.buildings[0].profiles.find(p=>p.id==='d')||existing.buildings[0].profiles.find(p=>p.id==='unified');
  assert(priorConditions,'Missing localized prerequisite source '+code);
  building.name=structuredClone(existing.buildings[0].name);
  assert(building.name[code],'Missing Power Plant name '+code);
  for(const row of building.profiles[0].rows){
    for(const requirement of row.requirements){
      const priorRow=priorConditions.rows.find(r=>r.level===row.level&&r.rank===row.rank);
      const prior=priorRow?.requirements?.find(q=>q.buildingId===requirement.buildingId&&q.level===requirement.level&&q.rank===requirement.rank);
      assert(prior,'Missing original localized prerequisite '+code+':'+row.level+':'+requirement.buildingId);
      const names=prior.name||existing.names[requirement.buildingId];
      assert(typeof names?.[code]==='string'&&names[code].trim(),'Missing prerequisite name '+code+':'+requirement.buildingId);
      requirement.name=structuredClone(names);
      const target=prior.slug||existing.links[requirement.buildingId];
      if(target)assert(fs.existsSync(path.join(ROOT,code,'buildings',target,'index.html')),'Missing prerequisite page '+code+':'+requirement.buildingId);
    }
    for(const item of row.constructionItems){
      // The approved A rows currently contain no construction items. A future
      // addition needs a complete localized item name, never an English fallback.
      assert(typeof item.name?.[code]==='string'&&item.name[code].trim(),'Missing item name '+code+':'+item.id);
    }
  }
  config.buildings=[building];
  for(const key of ['unified','profileHint','powerCondition','checklist','requirementsPath']){
    assert(typeof copy[code]?.[key]==='string'&&copy[code][key].trim(),'Missing UI copy '+code+':'+key);
    config.copy[key]=copy[code][key];
  }
  config.copy.sample=config.locale.labels.levelPrefix+'2';
  return config;
}
function project(html,code){
  const document=parseHTML(html).document,host=document.querySelector('[data-building-system="power-plant"]');
  assert(host,'Missing current Power Plant owner '+code);
  const config=localizedConfig(JSON.parse(host.querySelector('[data-building-system-model]').textContent),code);
  const replacement=parseHTML(require('./build-building-system').sheetFromConfig(config)).document.querySelector('section');
  for(const anchor of [...host.querySelectorAll('[data-bs-legacy-anchor]')].reverse()){
    if(!replacement.querySelector('[id="'+anchor.id+'"]'))replacement.prepend(anchor.cloneNode(true));
  }
  let output=replaceOne(html,host.outerHTML,replacement.outerHTML,code+' sheet');
  const use=document.querySelector('#building-use')?.closest('section');
  const checklist=use?.querySelector('h3')?.nextElementSibling;
  assert.equal(checklist?.tagName,'P',code+' checklist paragraph');
  const newChecklist=checklist.cloneNode(true);newChecklist.textContent=copy[code].checklist;
  output=replaceOne(output,checklist.outerHTML,newChecklist.outerHTML,code+' checklist');
  const rule=document.querySelector('#rules-22 p');
  if(rule){const next=rule.cloneNode(true);next.textContent=copy[code].powerCondition;output=replaceOne(output,rule.outerHTML,next.outerHTML,code+' upgrade guidance');}
  return output;
}
function htmlFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?htmlFiles(path.join(dir,entry.name)):entry.isFile()&&entry.name.endsWith('.html')?[path.join(dir,entry.name)]:[]);}
function build(){
  require('./build-power-plant-unified-data').build();
  const runtimePath=path.join(ROOT,'js/building-system.js');
  const runtime=fs.readFileSync(runtimePath,'utf8');
  assert(!runtime.includes('\r'),'Runtime must use LF before generating committed cache keys');
  const version=digest(runtime).slice(0,12),changed=[];
  for(const code of codes){
    const file=path.join(ROOT,code,'buildings/power-plant/index.html'),before=fs.readFileSync(file,'utf8');
    const after=project(before,code);
    if(before!==after){fs.writeFileSync(file,after);changed.push(path.relative(ROOT,file).replaceAll('\\','/'));}
  }
  let cacheReferences=0,cacheFiles=0;
  for(const code of codes)for(const file of htmlFiles(path.join(ROOT,code))){
    const before=fs.readFileSync(file,'utf8');
    const after=before.replace(/(src="\/js\/building-system\.js\?v=)[^"&]+/g,(_,prefix)=>{cacheReferences++;return prefix+version;});
    if(before!==after){fs.writeFileSync(file,after);cacheFiles++;}
  }
  const result={powerPlantUnified:true,languages:codes.length,levels:30,pagesChanged:changed.length,changed,sharedRuntimeVersion:version,cacheReferences,cacheFiles};
  console.log(JSON.stringify(result));return result;
}
module.exports={localizedConfig,project,build};
if(require.main===module)build();
