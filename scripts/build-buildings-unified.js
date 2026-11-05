'use strict';
// Locale-preserving publication of the approved A values + B prerequisites.
// The retained A/B source models are read-only; all joins use level AND rank.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..');
const registry=require('./building-data-registry');
const copy=require('../data/power-plant-unified-copy.json');
const codes=require('../data/i18n/locales.json').locales.map(l=>l.code);
const slugs=registry.slugs;
const pages=codes.flatMap(l=>slugs.map(s=>`${l}/buildings/${s}/index.html`));
const clone=v=>structuredClone(v);
const identity=r=>`${r.level}:${r.rank}`;
const requirement=q=>[q.buildingId,q.level,q.rank];
const items=row=>row.constructionItems===null?null:row.constructionItems.map(i=>[i.id,i.quantity]);
function numeric(row){return {level:row.level,rank:row.rank,resources:row.resources,seconds:row.seconds,battlePower:row.battlePower,constructionItems:items(row),calculationBlocked:row.calculationBlocked===true||row.availability==='initial_conditions_unconfirmed'};}
function index(rows,label){assert(Array.isArray(rows),label+' rows missing');const map=new Map();for(const row of rows){const key=identity(row);assert(!map.has(key),label+' duplicate level/rank '+key);map.set(key,row);}return map;}
function localizedConfig(existing,locale,slug=existing.slug){
  assert(codes.includes(locale)&&slugs.includes(slug),'Unknown building publication route');
  assert.equal(existing.lang,locale);assert.equal(existing.slug,slug);
  const canonical=registry.publicBuildings(slug),cfg=clone(existing);
  assert.deepEqual(existing.buildings.map(b=>b.id),canonical.map(b=>b.id),'Building identities changed');
  cfg.buildings=canonical.map(building=>{
    assert.deepEqual(building.profiles.map(p=>p.id),['unified'],'Canonical registry is not unified');
    const prior=existing.buildings.find(b=>b.id===building.id);
    assert.equal(prior.slug,building.slug);assert(typeof prior.name?.[locale]==='string'&&prior.name[locale].trim(),'Missing localized building name');
    assert(prior.profiles.length===1&&prior.profiles[0].id==='unified'||prior.profiles.length===2&&prior.profiles.some(p=>p.id==='original')&&prior.profiles.some(p=>p.id==='d'),'Unexpected source profiles');
    const a=index((prior.profiles.find(p=>p.id==='original')||prior.profiles.find(p=>p.id==='unified')).rows,'A '+building.id);
    const b=index((prior.profiles.find(p=>p.id==='d')||prior.profiles.find(p=>p.id==='unified')).rows,'B '+building.id);
    const expectedKeys=building.profiles[0].rows.map(identity).sort();
    assert.deepEqual([...a.keys()].sort(),expectedKeys,'A identity mismatch');assert.deepEqual([...b.keys()].sort(),expectedKeys,'B identity mismatch');
    const result=clone(building);result.name=clone(prior.name);
    result.profiles[0].rows=result.profiles[0].rows.map(row=>{
      const oldA=a.get(identity(row)),oldB=b.get(identity(row));
      assert.deepEqual(numeric(oldA),numeric(row),'A numeric values changed '+building.id+':'+identity(row));
      assert.deepEqual(oldB.requirements?.map(requirement)??null,row.requirements?.map(requirement)??null,'B prerequisites changed '+building.id+':'+identity(row));
      row.requirements=row.requirements===null?null:row.requirements.map((q,i)=>{
        const old=oldB.requirements[i],names=old.name||existing.names[q.buildingId];
        assert(typeof names?.[locale]==='string'&&names[locale].trim(),'Missing localized prerequisite '+q.buildingId);
        if(q.slug)assert.equal(old.slug||existing.links[q.buildingId],q.slug,'Prerequisite route changed');
        return {...q,name:clone(names)};
      });
      row.constructionItems=row.constructionItems===null?null:row.constructionItems.map((item,i)=>{
        const old=oldA.constructionItems[i];assert.equal(old.id,item.id);
        assert(typeof old.name?.[locale]==='string'&&old.name[locale].trim(),'Missing localized construction item '+item.id);
        return {...item,name:clone(old.name)};
      });
      return row;
    });
    return result;
  });
  for(const key of ['unified','profileHint','powerCondition','checklist','requirementsPath']){assert(copy[locale]?.[key],'Missing unified locale copy');cfg.copy[key]=copy[locale][key];}
  if(slug!=='power-plant'){const native=require('../data/content-60/buildings-phase2-copy')[locale]?.buildings||require(path.join(ROOT,'data/i18n/ui',locale+'.json')).copy.buildings;assert(typeof native==='string'&&native.trim(),'Missing building selector translation');cfg.copy.profile=native;}
  cfg.copy.sample=cfg.locale.labels.levelPrefix+'2';
  return cfg;
}
function effectProjection(section,locale,slug){
  const source=registry.evidence.effects.find(e=>e.slug===slug);
  if(!source){assert(!section,'Unexpected building effect section');return null;}
  assert(section,'Missing building effect section '+slug);
  const original=source.profiles.find(p=>p.id.toLowerCase()==='original');assert(original,'Missing A effect source');
  const metrics=original.metrics||source.metrics;
  const panels=[...section.querySelectorAll('[data-bs-effect-profile]')];
  assert.equal(section.children.length,panels.length+1,'Unexpected content in effect owner');
  assert.equal(section.firstElementChild.tagName,'H2','Missing effect heading');
  assert(panels.every(p=>p.parentElement===section),'Nested effect owner');
  assert(panels.length===1&&panels[0].getAttribute('data-bs-effect-profile')==='unified'||panels.length===2&&panels.some(p=>p.getAttribute('data-bs-effect-profile')==='original')&&panels.some(p=>p.getAttribute('data-bs-effect-profile')==='d'),'Unexpected effect profiles');
  const selected=panels.filter(p=>['original','unified'].includes(p.getAttribute('data-bs-effect-profile')));assert.equal(selected.length,1,'Missing or duplicate localized A effect');
  const panel=selected[0],rows=[...panel.querySelectorAll('tbody tr')];assert.equal(rows.length,original.rows.length,'Effect row count changed');
  assert.deepEqual([...panel.children].map(n=>n.tagName),['SUMMARY','TABLE'],'Unexpected content in effect profile');
  assert.deepEqual([...panel.querySelector('table').children].map(n=>n.tagName),['CAPTION','THEAD','TBODY'],'Unexpected content in effect table');
  rows.forEach((node,i)=>{
    const expected=original.rows[i];assert.equal(node.getAttribute('data-effect-level'),String(expected.level));assert.equal(node.getAttribute('data-effect-rank'),String(expected.rank));
    const values=[...node.querySelectorAll('[data-effect-id]')];assert.equal(values.length,metrics.length);
    values.forEach((cell,j)=>{assert.equal(cell.getAttribute('data-effect-id'),String(metrics[j].id),'Effect metric changed');assert.equal(cell.getAttribute('data-effect-value'),String(expected.values[j]),'Effect value changed');const value=expected.values[j],formats=value===null?['—']:codes.map(l=>value.toLocaleString(l==='zh-tw'?'zh-TW':l==='zh-cn'?'zh-CN':l));assert(formats.includes(cell.textContent),'Visible effect value changed');});
  });
  const heads=[...panel.querySelectorAll('thead th')].slice(1);assert.equal(heads.length,metrics.length);
  heads.forEach((head,i)=>assert.equal(head.textContent.includes('%'),metrics[i].unit==='percent','Effect unit changed'));
  const result=section.cloneNode(true),keep=[...result.querySelectorAll('[data-bs-effect-profile]')].find(p=>['original','unified'].includes(p.getAttribute('data-bs-effect-profile')));
  for(const other of result.querySelectorAll('[data-bs-effect-profile]'))if(other!==keep)other.remove();
  keep.setAttribute('data-bs-effect-profile','unified');keep.querySelector('summary').textContent=copy[locale].unified;
  return result;
}
function replaceOne(html,before,after,label){assert(before&&html.includes(before),'Missing exact owner '+label);assert.equal(html.split(before).length,2,'Ambiguous owner '+label);return before===after?html:html.replace(before,after);}
function restoreAnchors(replacement,source){
  for(const anchor of source.querySelectorAll('[data-bs-legacy-anchor]')){
    if(replacement.querySelector('[id="'+anchor.id+'"]'))continue;
    const oldParent=anchor.parentElement,index=[...oldParent.children].indexOf(anchor);let parent;
    if(oldParent===source)parent=replacement;
    else if(oldParent.id)parent=replacement.querySelector('[id="'+oldParent.id+'"]');
    if(!parent&&oldParent.className){const candidates=[...replacement.querySelectorAll('[class]')].filter(n=>n.tagName===oldParent.tagName&&n.className===oldParent.className);if(candidates.length===1)parent=candidates[0];}
    assert(parent,'Cannot preserve legacy anchor parent '+anchor.id);
    parent.insertBefore(anchor.cloneNode(true),parent.children[index]||null);
  }
  return replacement;
}
function project(html,locale,slug){
  const document=parseHTML(html).document,hosts=document.querySelectorAll('[data-building-system]');assert.equal(hosts.length,1,'Expected one building owner');
  const host=hosts[0];slug=slug||host.getAttribute('data-building-system');assert.equal(host.getAttribute('data-building-system'),slug);
  const cfg=localizedConfig(JSON.parse(host.querySelector('[data-building-system-model]').textContent),locale,slug);
  const replacement=parseHTML(require('./build-building-system').sheetFromConfig(cfg)).document.querySelector('[data-building-system]');
  restoreAnchors(replacement,host);
  let output=replaceOne(html,host.outerHTML,replacement.outerHTML,locale+'/'+slug+' sheet');
  const effects=document.querySelectorAll('[data-bs-effects]');assert(effects.length<=1,'Duplicate effect owner');
  const effect=effectProjection(effects[0],locale,slug);if(effect)output=replaceOne(output,effects[0].outerHTML,effect.outerHTML,locale+'/'+slug+' effects');
  return output;
}
function validateOwnership(html,locale,slug){
  const d=parseHTML(html).document,host=d.querySelector('[data-building-system]');assert(host,'Missing building owner');slug=slug||host.getAttribute('data-building-system');
  const projected=parseHTML(project(html,locale,slug)).document;
  assert.equal(host.outerHTML,projected.querySelector('[data-building-system]').outerHTML,'Unexpected content in unified building owner');
  assert.equal(d.querySelector('[data-bs-effects]')?.outerHTML,projected.querySelector('[data-bs-effects]')?.outerHTML,'Unexpected content in unified effect owner');
  return true;
}
function build(){
  const runtime=fs.readFileSync(path.join(ROOT,'js/building-system.js'));const version=crypto.createHash('sha256').update(runtime).digest('hex').slice(0,12);const changed=[];
  for(const file of pages){const [locale,,slug]=file.split('/'),full=path.join(ROOT,file),before=fs.readFileSync(full,'utf8');
    const after=project(before,locale,slug).replace(/(src="\/js\/building-system\.js\?v=)[^"&]+/g,'$1'+version);
    validateOwnership(after,locale,slug);if(after!==before){fs.writeFileSync(full,after);changed.push(file);}
  }
  const result={buildingsUnified:true,languages:codes.length,routes:slugs.length,pages:pages.length,changed:changed.length,files:changed,runtimeVersion:version};console.log(JSON.stringify(result));return result;
}
module.exports={localizedConfig,effectProjection,restoreAnchors,project,validateOwnership,build,codes,slugs,pages};
if(require.main===module)build();
