/* Enhances the existing observed comparison. Explicit values are precomputed and scoped. */
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),D=require('../data/foundation-40/hero-skill-levels.json'),C=require('../data/foundation-40/hero-skill-levels-copy'),O=require('../data/foundation-40/hero-observations.json');
const G=require('../data/foundation-40/hero-gear-levels.json');
const {applyHeroAssets,removeExtractedStyle}=require('./lib/hero-assets-40');
const langs=['ko','en','ja','ru','zh-tw'],assert=(v,m)=>{if(!v)throw Error(m);};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const node=(d,s)=>{const t=d.createElement('template');t.innerHTML=s;return t.content;};
const value=(s,unit,lang)=>(unit==='percent-bonus'?'+':'')+(lang==='ru'?s.replace('.',','):s)+(unit==='percent-atk'?'% ATK':'%');
let changes=0;
for(const hero of D.heroes){
 assert(['undine','lagnar'].includes(hero.id)&&hero.skills.length===3,'Unsupported skill scope');
 for(const skill of hero.skills)assert(skill.values.length===40&&skill.values.every((r,i)=>r.level===i+1&&/^\d+\.\d{2}$/.test(r.value)),'Explicit level sequence missing');
 for(const lang of langs){
  const file=path.join(root,lang,'heroes',hero.id,'index.html'),before=fs.readFileSync(file,'utf8'),d=parseHTML(before).document,t=C[lang];
  const block=d.getElementById('skill-level-comparison-40'),banner=d.querySelector('.ts-lootbar-slot--hero');assert(block&&banner,'Build hero observations first');
  const bannerHTML=banner.outerHTML,previous=banner.previousElementSibling,next=banner.nextElementSibling;
  const skillsBefore=[...d.querySelectorAll('.ts-skill-body')].map(n=>n.textContent);
  d.querySelectorAll('[data-hero-levels-40], #hero-skill-levels-data, script[src^="/js/hero-skill-levels-40.js"], style[data-hero-levels-style]').forEach(n=>n.remove());
  const table=block.querySelector('table');assert(table,'Observed table missing');table.setAttribute('data-level-comparison-table','');
  for(const skill of hero.skills){const row=table.querySelector('[data-game-fact-id="'+skill.id+'"]');assert(row,'Observed skill row missing');row.setAttribute('data-skill-level-row',skill.id);}
  const controls=`<form data-hero-levels-40="controls" data-skill-level-compare class="ts40-skill-controls" hidden><label>${esc(t.from)}<select name="from">${hero.skills[0].values.map(r=>`<option value="${r.level}"${r.level===10?' selected':''}>Lv.${r.level}</option>`).join('')}</select></label><label>${esc(t.to)}<select name="to">${hero.skills[0].values.map(r=>`<option value="${r.level}"${r.level===11?' selected':''}>Lv.${r.level}</option>`).join('')}</select></label><span class="visually-hidden" data-level-status role="status" aria-live="polite"></span></form>`;
  table.parentElement.before(node(d,controls));
  const originalCondition=O.copy.condition[lang].replace('{cap}',hero.observedCap);
  const condition=[...block.querySelectorAll('p')].find(p=>p.textContent.trim()===originalCondition||p.hasAttribute('data-skill-level-condition'));
  assert(condition,'Observed unlock condition missing');condition.setAttribute('data-skill-level-condition','');condition.textContent=t.condition.replace('{cap}',hero.observedCap);
  const rows=hero.skills[0].values.map(r=>`<tr><th scope="row">${r.level}</th>${hero.skills.map(skill=>`<td>${esc(value(skill.values[r.level-1].value,skill.unit,lang))}</td>`).join('')}</tr>`).join('');
  block.append(node(d,`<details data-hero-levels-40="table" class="ts40-skill-levels"><summary>${esc(t.all)}</summary><div class="ts-table-wrap" role="region" tabindex="0" aria-label="${esc(t.all)}"><table data-static><thead><tr><th scope="col">${esc(t.level)}</th>${hero.skills.map(skill=>`<th scope="col">${esc(skill.name[lang])}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></details>`));
  if(hero.id===G.hero){
   const gear=d.getElementById('exclusive-level-comparison-40');assert(gear,'Observed gear panel missing');
   const number=n=>new Intl.NumberFormat(lang).format(n);
   const gearRows=G.levels.map(r=>`<tr><th scope="row">${r.level}</th>${['attack','defense','hp','power'].map(key=>`<td>${number(r[key])}</td>`).join('')}<td>+${number(r.frontDefense)}%</td><td>+${number(r.backAttack)}%</td></tr>`).join('');
   gear.append(node(d,`<details data-hero-levels-40="gear" class="ts40-skill-levels"><summary>${esc(t.gearAll)}</summary><div class="ts-table-wrap" role="region" tabindex="0" aria-label="${esc(t.gearAll)}"><table data-static><thead><tr>${[t.gearLevel,'ATK','DEF','HP',t.power,t.frontDefense,t.backAttack].map(label=>`<th scope="col">${esc(label)}</th>`).join('')}</tr></thead><tbody>${gearRows}</tbody></table></div></details>`));
  }
  d.head.append(node(d,'<style data-hero-levels-style>.ts40-skill-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem;margin:1rem 0}.ts40-skill-controls[hidden]{display:none}.ts40-skill-controls label{display:grid;gap:.4rem;font-weight:600}.ts40-skill-controls select{min-width:0;min-height:44px;padding:.6rem;color:var(--ts3-ink);background:white;border:1px solid var(--ts3-line);border-radius:6px;font:inherit}.ts40-skill-controls select:focus-visible,.ts40-skill-levels summary:focus-visible{outline:2px solid var(--ts3-green);outline-offset:3px}.ts40-skill-levels{margin-top:1rem;border-top:1px solid var(--ts3-line)}.ts40-skill-levels summary{min-height:44px;padding:.8rem 0;cursor:pointer;font-weight:600}.ts40-skill-levels table{min-width:560px;font-variant-numeric:tabular-nums}.ts40-skill-levels th{white-space:normal!important}.ts40-skill-levels td{white-space:nowrap}</style>'));
  d.body.append(node(d,`<script type="application/json" id="hero-skill-levels-data">${JSON.stringify({hero,copy:t}).replaceAll('<','\\u003c')}</script><script src="/js/hero-skill-levels-40.js?v=1" defer></script>`));
  applyHeroAssets(d,hero.id);
  removeExtractedStyle(d,d.querySelector('style[data-hero-levels-style]'));
  assert(banner.outerHTML===bannerHTML&&banner.previousElementSibling===previous&&banner.nextElementSibling===next,'Hero banner changed');
  assert(JSON.stringify(skillsBefore)===JSON.stringify([...d.querySelectorAll('.ts-skill-body')].map(n=>n.textContent)),'Legacy skill content changed');
  assert(d.querySelectorAll('[data-skill-level-compare]').length===1&&d.querySelectorAll('[data-hero-levels-40="table"]').length===1,'Duplicate skill control');
  const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';if(after!==before){fs.writeFileSync(file,after);changes++;}
 }
}
console.log(JSON.stringify({heroes:D.heroes.length,languages:langs.length,explicitSkillValues:D.heroes.reduce((n,h)=>n+h.skills.reduce((s,k)=>s+k.values.length,0),0),changes}));
