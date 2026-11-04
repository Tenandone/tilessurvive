'use strict';
// One shared relation model; existing URLs and calculator payloads are retained.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {parseHTML}=require('linkedom'),M=require('../data/hero-pet-relations.json'),A=require('../data/hero-atlas-client.json'),R=require('../data/hero-atlas-routes.json');
const ROOT=path.resolve(__dirname,'..'),locales=require('../data/i18n/locales.json').locales.map(x=>x.code);
const C=require('../data/hero-pet-copy.json');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pets=new Map(M.pets.map(p=>[p.id,p])),heroById=new Map(A.heroes.map(h=>[h.id,h]));
const petRoute=(id,l)=>`/${l}/database/pet-system/${id}/`,heroRoute=(id,l)=>R.heroes.find(h=>h.id===id).routes[l];
function validate(data=M){
 require('./build-hero-pet-relations').validate(data);
 const reference=C.locales.en;assert(reference,'Missing English relation copy');
 for(const l of locales){assert(C.locales[l],'Missing relation copy '+l);for(const group of ['ui','reasons','conditions','cautions']){
  assert.deepEqual(Object.keys(C.locales[l][group]).sort(),Object.keys(reference[group]).sort(),l+' '+group+' keys');
  for(const [k,v]of Object.entries(reference[group])){const translated=C.locales[l][group][k];assert(typeof translated==='string'&&translated.trim(),l+':'+k);if(group!=='ui')assert.deepEqual(translated.match(/\d+%?/g)||[],v.match(/\d+%?/g)||[],l+':'+k+' numeric conditions');}
 }
 for(const r of data.rules){assert(C.locales[l].reasons[r.reasonKey],r.reasonKey);for(const k of r.conditionKeys)assert(C.locales[l].conditions[k],k);for(const k of r.cautionKeys)assert(C.locales[l].cautions[k],k);}
 }
 return true;
}
function name(item,l){assert(item?.names?.[l]?.value,'Missing localized game name');return item.names[l].value;}
function fallback(l){return M.localePolicy.englishFallbackLocales.includes(l)?`<p class="hp-note" data-hp-fallback>${esc(C.locales[l].ui.fallback)}</p>`:'';}
function state(r,l){return C.locales[l].ui[r.status==='data-based'?'dataBased':'practical'];}
function sources(l){const c=C.locales[l].ui;return `<details class="hp-evidence"><summary>${esc(c.source)}</summary><p>${esc(c.scope)}</p><p>${esc(c.petRule)}</p><p><a href="/data/hero-pet-relations.json">${esc(c.version)} ${M.version.game}</a> · ${esc(c.checked)} ${M.version.reviewedOn}</p></details>`;}
function skills(ids,l,kind,pet){const c=C.locales[l].ui;return `<div class="hp-skills"><strong>${esc(c[kind])}</strong><ul>${ids.map(id=>{const s=M.skills[id],ps=pet?.skills.find(x=>x.clientId===id);assert(s,'Unresolved skill '+id);return `<li data-hp-skill-id="${id}">${esc(name(s,l))}${ps?` <small>· ${esc(c.unlockStage)} ${ps.unlockStage}</small>`:''}</li>`;}).join('')}</ul></div>`;}
function card(r,l){const c=C.locales[l],p=pets.get(r.petId),alternatives=r.alternatePetIds.map(id=>pets.get(id));return `<article class="hp-card" data-hp-rule="${r.id}" data-hp-status="${r.status}" data-hp-pet="${p.clientId}"><p class="hp-status hp-${r.status}">${esc(state(r,l))}</p><h4><a href="${petRoute(p.id,l)}">${esc(name(p,l))}</a></h4><p class="hp-reason"><strong>${esc(c.ui.reason)}:</strong> ${esc(c.reasons[r.reasonKey])}</p><h5>${esc(c.ui.conditions)}</h5><ul class="hp-conditions">${r.conditionKeys.map(k=>`<li data-hp-condition="${k}">${esc(c.conditions[k])}</li>`).join('')}</ul><details class="hp-skill-details"><summary>${esc(c.ui.skills)}</summary>${skills(r.heroSkillIds,l,'heroSkill')}${skills(r.petSkillIds,l,'petSkill',p)}</details><details><summary>${esc(c.ui.cautions)}</summary><ul>${r.cautionKeys.map(k=>`<li>${esc(c.cautions[k])}</li>`).join('')}</ul></details><p class="hp-alternatives"><strong>${esc(c.ui.alternatives)}:</strong> ${alternatives.length?alternatives.map(a=>`<a href="${petRoute(a.id,l)}">${esc(name(a,l))}</a>`).join(' · '):esc(c.ui.noAlternative)}</p></article>`;}
function renderHero(id,l){const h=M.heroes.find(h=>h.id===id);if(!h||h.publication!=='published')return '';const c=C.locales[l].ui,rules=h.candidateRuleIds.map(id=>M.rules.find(r=>r.id===id));assert(rules.length<=3);return `<section class="hero-pet-panel" data-hero-pet-owned="hero" data-hp-hero="${id}" id="hero-pet-connections"><h3>${esc(c.title)}</h3><p>${esc(c.intro)}</p>${fallback(l)}${rules.length?`<div class="hp-grid">${rules.map(r=>card(r,l)).join('')}</div>`:`<p class="hp-empty" data-hp-no-evidence>${esc(c.noEvidence)}</p>`}<p><a href="/${l}/database/pet-system/#hero-pet-reference">${esc(c.petDirectory)}</a></p>${sources(l)}</section>`;}
function renderPet(p,l){const c=C.locales[l].ui,rules=M.rules.filter(r=>r.petId===p.id);return `<article class="hp-pet" data-hp-pet="${p.clientId}"><h3><a href="${petRoute(p.id,l)}">${esc(name(p,l))}</a></h3><p class="hp-note">${esc(c[p.availability.state==='existing-catalog'?'existing':'configured'])}</p><details><summary>${esc(c.skills)} · ${p.skills.length}</summary><ul>${p.skills.map(s=>`<li data-hp-skill-id="${s.clientId}">${esc(name(s,l))} · ${esc(c.unlockStage)} ${s.unlockStage}</li>`).join('')}</ul></details>${rules.length?`<ul class="hp-hero-links">${rules.map(r=>`<li><a href="${heroRoute(r.heroId,l)}#hero-pet-connections">${esc(name(heroById.get(r.heroId),l))}</a> · ${esc(state(r,l))}</li>`).join('')}</ul>`:''}</article>`;}
function renderPets(l,id){const c=C.locales[l].ui,list=id?[pets.get(id)]:M.pets;assert(list.every(Boolean));return `<section class="hero-pet-panel" data-hero-pet-owned="pets" id="hero-pet-reference"><h2>${esc(c.petDirectory)}${id?'':' · '+list.length}</h2><p>${esc(c.intro)}</p>${fallback(l)}<div class="hp-grid">${list.map(p=>renderPet(p,l)).join('')}</div>${sources(l)}</section>`;}
function strip(html){return html.replace(/<!-- TS_HERO_PET_BEGIN -->[\s\S]*?<!-- TS_HERO_PET_END -->/g,'').replace(/<!-- TS_HERO_PET_ASSETS_BEGIN -->[\s\S]*?<!-- TS_HERO_PET_ASSETS_END -->/g,'');}
function asset(){const bytes=fs.readFileSync(path.join(ROOT,'css/hero-pet.css'));return `<link data-hero-pet-owned="assets" rel="stylesheet" href="/css/hero-pet.css?v=${crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12)}">`;}
function project(html,l,heroId){
 assert(locales.includes(l));const d=parseHTML(strip(html)).document;
 if(heroId){const panel=d.querySelector('[data-hero-atlas-owned="profile"]');assert(panel,'Missing hero profile');panel.querySelectorAll('[data-hero-pet-owned="hero"]').forEach(n=>n.remove());panel.insertAdjacentHTML('beforeend',renderHero(heroId,l));}
 else{const route=new URL(d.querySelector('link[rel="canonical"]').href).pathname,match=route.match(/^\/[^/]+\/database\/pet-system\/(?:([^/]+)\/)?$/);if(!match)return html;const main=d.querySelector('main');assert(main);main.insertAdjacentHTML('beforeend','<!-- TS_HERO_PET_BEGIN -->'+renderPets(l,match[1])+'<!-- TS_HERO_PET_END -->');}
 if(!d.querySelector('link[href^="/css/hero-pet.css"]'))d.head.insertAdjacentHTML('beforeend','<!-- TS_HERO_PET_ASSETS_BEGIN -->'+asset()+'<!-- TS_HERO_PET_ASSETS_END -->');
 return '<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
}
function build(){validate();let changed=0;const outputs=[];for(const l of locales){for(const id of [null,...M.pets.map(p=>p.id)]){const file=path.join(ROOT,l,'database/pet-system',id||'','index.html'),before=fs.readFileSync(file,'utf8'),after=project(before,l);assert.equal(project(after,l),after,'Non-idempotent pet projection');outputs.push({file,before,after});}}
 for(const x of outputs)if(x.before!==x.after){fs.writeFileSync(x.file,x.after);changed++;}const result={locales:locales.length,petPages:outputs.length,changed,heroPages:'owned by build-hero-atlas'};console.log(JSON.stringify(result));return result;}
function validateOwnership(html,l){const d=parseHTML(html).document;if(!d.querySelector('[data-hero-pet-owned="pets"]'))return;const next=parseHTML(project(html,l)).document;assert.equal(d.querySelector('[data-hero-pet-owned="pets"]').outerHTML,next.querySelector('[data-hero-pet-owned="pets"]').outerHTML,'Unreviewed pet content '+l);}
module.exports={validate,project,renderHero,renderPets,strip,asset,build,validateOwnership};if(require.main===module)build();
