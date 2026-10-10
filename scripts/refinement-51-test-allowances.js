'use strict';
// Test-only migration view. Validate each complete owned change before restoring
// the previous representation for historical regression fixtures.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),base='296cd9e6b61f444f54ed6b10d128ae8d4b21d5bb',cache=new Map();
function original(file){if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8',maxBuffer:8e6}));return parseHTML(cache.get(file)).document;}
function sig(n){if(n.nodeType===3)return n.textContent.trim()?['text',n.textContent.trim()]:null;if(n.nodeType!==1)return null;const children=[];let text='';const flush=()=>{if(text.trim())children.push(['text',text.trim()]);text='';};for(const child of n.childNodes){if(child.nodeType===3)text+=child.textContent;else{flush();const v=sig(child);if(v)children.push(v);}}flush();return[n.tagName,[...n.attributes].map(a=>[a.name,a.value]).sort(([a],[b])=>a.localeCompare(b)),children];}
function restore(d,file=''){
 require('./client-truth-52-test-allowances').restore(d,file);
 if(!d.querySelector('[data-building-art-51],[data-building-refinement-51],[data-building-plan-steps-51],[data-hero-refinement-51],[data-growth-refinement-51]'))return d;
 if(!file)file=new URL(d.querySelector('link[rel=canonical]').href).pathname.slice(1)+'index.html';
 const lang=file.split('/')[0],route='/'+file.replace(/index\.html$/,'');assert(['ko','en','ja','ru','zh-tw','de'].includes(lang));
 const check=(actual,expected)=>{const want=parseHTML(expected).document.querySelector(actual.tagName.toLowerCase());assert.deepEqual(sig(actual),sig(want),'Exact 5.1 section '+file);actual.remove();};
 const hero=require('./build-hero-refinement-51');
 for(const node of d.querySelectorAll('[data-hero-refinement-51]')){
  const kind=node.getAttribute('data-hero-refinement-51');
  if(kind.startsWith('legacy-')){assert.equal(route,`/${lang}/database/exclusive-gear/`);const type=kind.slice(7),copy=hero.legacyCopy[lang];assert(['calculator','table'].includes(type));const e=d.createElement('p');e.setAttribute('data-hero-refinement-51',kind);e.textContent=copy[type]+' ';const a=d.createElement('a');a.href='#gear-materials-51';a.textContent=copy.link;e.append(a);check(node,e.outerHTML);}
  else{const gear=require('../data/hero-refinement-51.json').gears.find(g=>hero.route(lang,g.id)===route);assert(gear||route===`/${lang}/database/exclusive-gear/`);check(node,hero.render(lang,gear));}
 }
 const growth=require('./build-growth-refinement-51'),data=require('../data/growth-refinement-51.json');
 for(const node of d.querySelectorAll('[data-growth-refinement-51]')){
  if(node.getAttribute('data-growth-refinement-51')==='gear-materials'){assert.equal(route,`/${lang}/database/gear-exp/`);check(node,growth.renderGear(lang));}
  else{assert(data.behemothTargets.some(id=>route===`/${lang}/behemoths/${id}/`));const item=data.materials.find(i=>i.id===Number(node.getAttribute('data-growth-material-id')));assert(item&&item.system==='behemoth');assert.equal(node.closest('.material-card').querySelector('img').getAttribute('src'),data.behemothMaterialImages[String(item.id)]);const line=growth.copy[lang].per.replace('{n}',item.expPerItem.toLocaleString(lang==='zh-tw'?'zh-TW':lang));assert.equal(node.textContent,line);assert.equal(node.getAttribute('aria-label'),item.name[lang]+': '+line);node.remove();}
 }
 const building=require('./build-building-refinement-51');
 for(const node of d.querySelectorAll('[data-building-plan-steps-51]'))check(node,building.steps(node.closest('form'),d,lang));
 for(const node of d.querySelectorAll('[data-building-refinement-51]')){const p=require('../data/building-refinement-51.json').profiles.find(p=>route===`/${lang}/buildings/${p.slug}/`);assert(p);check(node,building.effectSection(p,lang));}
 for(const n of d.querySelectorAll('[data-building-refinement-51-asset]')){const f=n.tagName==='LINK'?'css/building-refinement-51.css':'js/building-refinement-51.js',hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex').slice(0,12);assert.equal(n.getAttribute(n.tagName==='LINK'?'href':'src'),'/'+f+'?v='+hash);n.remove();}
 if(d.querySelector('[data-building-art-51]')){
  const art=require('./build-building-assets-51'),old=original(file),expected=parseHTML(art.project(cache.get(file),file)).document;
  const detail=art.manifest.assets.find(a=>file===`${lang}/buildings/${a.slug}/index.html`)?.detail;
  if(detail&&detail.src!==detail.previousSrc){
   const selector='link[rel="preload"][as="image"]';
   assert.deepEqual([...d.querySelectorAll(selector)].map(sig),[...expected.querySelectorAll(selector)].map(sig),'Exact image preload migration '+file);
   for(const n of d.querySelectorAll(selector))if(n.getAttribute('href')===detail.src)n.setAttribute('href',detail.previousSrc);
  }
  for(const n of d.querySelectorAll('[data-building-art-51]')){const id=n.getAttribute('data-building-art-51'),e=expected.querySelector(`[data-building-art-51="${id}"]`);assert(e);assert.deepEqual(sig(n),sig(e),'Exact mapped image '+file);const role=n.parentElement.getAttribute('data-building-frame-51');assert.equal(role,e.parentElement.getAttribute('data-building-frame-51'));n.parentElement.removeAttribute('data-building-frame-51');const m=art.manifest.assets.find(a=>String(a.buildingId)===id);const prior=old.querySelector(`main img[src="${m[role].previousSrc}"]`);assert(prior);n.replaceWith(prior.cloneNode(true));}
  const styles=[...d.querySelectorAll('[data-building-style-51]')];assert.equal(styles.length,1);assert.deepEqual(sig(styles[0]),sig(expected.querySelector('[data-building-style-51]')));styles[0].remove();
 }
 return d;
}
module.exports={restore};
