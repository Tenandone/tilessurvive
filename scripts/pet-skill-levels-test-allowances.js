'use strict';
// Legacy regression projection only. The new display is checked exactly before
// restoring its previous representation; data/interaction tests live separately.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const {parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),base='c7e2ac44a9e4e3388b0c041d4faef70212d0217d',cache=new Map();
function original(file){
 if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8',maxBuffer:8e6}));
 return parseHTML(cache.get(file)).document;
}
function semantic(node){
 if(node.nodeType===3)return node.textContent.trim()?['text',node.textContent.trim()]:null;
 if(node.nodeType!==1)return null;
 const children=[];let text='';const flush=()=>{if(text.trim())children.push(['text',text.trim()]);text='';};
 for(const child of node.childNodes){if(child.nodeType===3)text+=child.textContent;else{flush();const value=semantic(child);if(value)children.push(value);}}flush();
 return [node.tagName,[...node.attributes].map(a=>[a.name,a.value]).sort(([a],[b])=>a.localeCompare(b)),children];
}
function restoreLegacyDocument(document,file=''){
 const section=document.querySelector('[data-pet-skill-levels]'),links=[...document.querySelectorAll('[data-pet-skill-roster-levels]')];
 if(!section&&!links.length)return document;
 if(!file)file=new URL(document.querySelector('link[rel=canonical]').href).pathname.slice(1)+'index.html';
 const match=file.match(/^(ko|en|ja|ru|zh-tw|de)\/database\/pet-system\/(?:([a-z]+)\/)?index\.html$/);
 assert(match,'Skill-level changes are scoped to pet pages');
 const [,lang,id]=match,before=original(file),data=require('../data/pet-skill-levels.json'),build=require('./build-pet-skill-levels');
 if(section){
  assert(id);const pet=data.pets.find(p=>p.id===id);assert(pet);
  const expected=parseHTML(build.renderSection(pet,lang,data)).document.querySelector('[data-pet-skill-levels]');
  assert.deepEqual(semantic(section),semantic(expected),'Exact reviewed new skill section '+file);
  const old=before.querySelector('[data-pet-skills-41]');if(old)section.replaceWith(old.cloneNode(true));else section.remove();
  const heading=id==='starhorn'?'character-section-1':'pet-skills-heading-41';
  const href=`/${lang}/database/pet-system/${id}/#${heading}`;
  const nav=document.querySelector('.ts3-character-sections'),owned=[...nav.querySelectorAll('a')].filter(a=>a.getAttribute('href')===href);
  assert.equal(owned.length,1);assert.equal(owned[0].textContent,require('../data/pet-skill-levels-copy')[lang].title);
  const previous=[...before.querySelectorAll('.ts3-character-sections a')].find(a=>a.getAttribute('href')===href);
  if(previous)owned[0].replaceWith(previous.cloneNode(true));else owned[0].remove();
  const assets=[...document.querySelectorAll('[data-pet-skill-levels-asset]')];assert.equal(assets.length,2);
  for(const node of assets){
   const filename=node.tagName==='LINK'?'css/pet-skill-levels.css':'js/pet-skill-levels.js';
   const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,filename))).digest('hex').slice(0,12);
   assert.equal(node.getAttribute(node.tagName==='LINK'?'href':'src'),'/'+filename+'?v='+hash);node.remove();
  }
  const css=before.querySelector('link[data-pet-skills-style-41]');if(css)document.head.append(css.cloneNode(true));
 }
 if(links.length){
  assert(!id);assert.equal(links.length,data.pets.length);
  for(const a of links){
   const pet=a.getAttribute('data-pet-skill-roster-levels'),heading=pet==='starhorn'?'character-section-1':'pet-skills-heading-41';
   assert(data.pets.some(p=>p.id===pet));assert.equal(a.getAttribute('href'),`/${lang}/database/pet-system/${pet}/#${heading}`);
   assert.equal(a.textContent,require('../data/pet-skill-levels-copy')[lang].roster);
   const old=before.querySelector(`[data-pet-skill-roster-41="${pet}"]`);if(old)a.replaceWith(old.cloneNode(true));else a.remove();
  }
 }
 return document;
}
module.exports={restoreLegacyDocument};
