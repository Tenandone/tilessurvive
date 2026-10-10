'use strict';
// Historical tests may use the old DOM only after the entire current combat
// projection matches the fixed pre-change baseline plus the approved additions.
const cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),baseline='927a28668ea8a0d4afa3c7d55b7611b06790c82f',cache=new Map();
const E=require('./build-behemoth-exp-60'),G=require('./build-growth-50'),gear=require('../data/product-50/growth-gear.json');
function original(file){if(!cache.has(file))cache.set(file,cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:12e6}));return cache.get(file);}
function kind(file){const [lang,group,id,end]=file.split('/');if(!E.langs.includes(lang)||end!=='index.html'||file.split('/').length!==4)return null;if(group==='behemoths'&&E.ids.includes(id))return 'behemoth';if(group==='heroes'&&['lagnar','dave'].includes(id))return 'hero';if(group==='database'&&id==='exclusive-gear')return 'hub';return null;}
function project(file){
 const type=kind(file);assert(type,'Unapproved combat projection '+file);const [lang,,id]=file.split('/');
 const d=parseHTML(original(file)).document;
 if(type==='hub')d.querySelector('.ts-growth50-links').replaceWith(parseHTML(G.render(lang)).document.querySelector('.ts-growth50-links'));
 else {
  const template=d.createElement('template');
  if(type==='behemoth'){
   template.innerHTML=E.render(lang,E.model.profiles.find(p=>p.id===id));
   const host=d.querySelector('main > .container')||d.querySelector('main'),stars=host.querySelector('.star-grid')?.closest('section');
   if(stars)stars.before(template.content);else host.append(template.content);
  }else{
   template.innerHTML=G.render(lang,gear.heroes.find(h=>h.id===id));
   const host=d.querySelector('.equipment-grid')?.closest('section')||d.querySelector('[data-hero-observations-40="equipment"]')?.closest('section')||d.querySelector('[data-sea-growth="gear"]')?.closest('section');assert(host);host.append(template.content);
   const style=d.createElement('link');style.setAttribute('data-growth50-asset','');style.rel='stylesheet';style.href='/css/growth-50.css?v=1';d.head.append(style);
   const js=d.createElement('script');js.setAttribute('data-growth50-asset','');js.src='/js/growth-50.js?v=1';js.defer=true;d.body.append(js);
  }
  const style=d.createElement('link');style.setAttribute('data-content-60-style','');style.rel='stylesheet';style.href='/css/content-60.css?v=1';d.head.append(style);
 }
 return d;
}
function signature(n){if(n.nodeType===3)return n.textContent.trim()?['text',n.textContent.trim()]:null;if(n.nodeType!==1)return null;const children=[];let text='';const flush=()=>{if(text.trim())children.push(['text',text.trim()]);text='';};for(const child of n.childNodes){if(child.nodeType===3)text+=child.textContent;else{flush();const value=signature(child);if(value)children.push(value);}}flush();return [n.tagName,[...n.attributes].map(a=>[a.name,a.value]).sort(([a],[b])=>a.localeCompare(b)),children];}
function restore(document,file=''){
 require('./asset-cache-test-allowances').restore(document);
 if(!file)file=new URL(document.querySelector('link[rel="canonical"]').href).pathname.slice(1)+'index.html';
 if(path.isAbsolute(file))file=path.relative(root,file).replaceAll('\\','/');
 if(!kind(file)){assert(!document.querySelector('[data-behemoth-exp-60]'),'Unapproved behemoth EXP route '+file);return document;}
 assert.deepEqual(signature(document.documentElement),signature(project(file).documentElement),'Exact phase60 combat projection '+file);
 document.replaceChild(parseHTML(original(file)).document.documentElement.cloneNode(true),document.documentElement);return document;
}
module.exports={restore,project,original,kind,baseline};
