'use strict';
// Replace the two existing image nodes per approved skill; never rebuild a panel.
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),manifest=require('../data/foundation-40/hero-skill-assets-41.json');
const names=require('../data/foundation-40/official-character-locales.json');
const languages=['ko','en','ja','ru','zh-tw'],marker='data-game-41-skill-art';
const entities=[...new Set(manifest.assets.map(a=>a.entity))];
const routeFor=(lang,entity)=>`${lang}/heroes/${lang==='en'&&entity==='tarzan'?'tazan':entity}/index.html`;
const pages=entities.flatMap(entity=>languages.map(lang=>routeFor(lang,entity)));
function assetsFor(file){return manifest.assets.filter(a=>languages.some(lang=>routeFor(lang,a.entity)===file));}
function applyHeroSkillImages(document,file){
 const assets=assetsFor(file),lang=file.split('/')[0];
 if(!assets.length)throw Error('Unapproved hero skill route: '+file);
 const workspaces=[...document.querySelectorAll('[data-character-skills]')];
 if(workspaces.length!==1 || workspaces[0].querySelectorAll('.ts-skill').length!==assets.length)throw Error('Unexpected skill workspace: '+file);
 const workspace=workspaces[0],updates=[];
 for(const asset of assets){
  const panels=workspace.querySelectorAll('#'+asset.panelId),buttons=workspace.querySelectorAll(`[data-skill-target="${asset.panelId}"]`);
  if(panels.length!==1 || buttons.length!==1)throw Error('Missing or duplicate skill target: '+asset.id);
  const summary=panels[0].querySelector('summary'),button=buttons[0],slot=Number(asset.panelId.split('-').at(-1))+1;
  const expected=names.heroes.find(h=>h.id===asset.entity)?.skills.find(s=>s.index===slot)?.name[lang];
  const label=button.querySelector(':scope > span')?.cloneNode(true);label?.querySelectorAll('small').forEach(n=>n.remove());
  if(!expected || summary?.querySelector(':scope > span')?.textContent.trim()!==expected || label?.textContent.trim()!==expected)throw Error('Unexpected localized skill name: '+asset.id);
  for(const parent of [summary,button]){
   const images=[...parent.querySelectorAll('img')];
   if(images.length!==1 || images[0].parentElement!==parent)throw Error('Expected one direct skill image: '+asset.id);
   const image=images[0],src=image.getAttribute('src'),owned=image.getAttribute(marker);
   if(![asset.previousSrc,asset.src].includes(src) || (owned!==null && (owned!==asset.id || src!==asset.src)))throw Error('Unexpected skill image source or identity: '+asset.id);
   updates.push({image,asset});
  }
 }
 // Validate the entire page before changing any image.
 for(const {image,asset} of updates){
  for(const key of ['src','width','height'])image.setAttribute(key,String(asset[key]));
  image.setAttribute('loading','lazy');image.setAttribute('decoding','async');image.setAttribute(marker,asset.id);
 }
 return document;
}
function build(){
 const changes=[];
 for(const file of pages){
  const full=path.join(root,file),before=fs.readFileSync(full,'utf8'),d=applyHeroSkillImages(parseHTML(before).document,file);
  const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
  if(after!==before)changes.push({full,after});
 }
 for(const {full,after} of changes)fs.writeFileSync(full,after);
 console.log(`Hero skill images: ${manifest.assets.length} assets, ${pages.length} pages, ${changes.length} changed`);
}
if(require.main===module)build();
module.exports={applyHeroSkillImages,assetsFor,pages,routeFor,marker};
