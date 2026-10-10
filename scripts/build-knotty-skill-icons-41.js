'use strict';
// The three existing Knotty skills retain their text and tab targets.
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),manifest=require('../data/foundation-40/knotty-skill-assets-41.json');
const languages=['ko','en','ja','ru','zh-tw'];
function applyKnottySkillIcons(document){
 const workspace=document.querySelector('[data-character-skills]');
 if(!workspace || workspace.querySelectorAll('.ts-skill').length!==3)throw Error('Expected the three Knotty skill panels');
 for(const asset of manifest.assets){
  const panel=workspace.querySelector('#'+asset.panelId),button=workspace.querySelector(`[data-skill-target="${asset.panelId}"]`),summary=panel?.querySelector('summary');
  if(!panel || !button || !summary)throw Error('Missing Knotty skill target '+asset.panelId);
  const label=summary.textContent.trim(),fallback=button.querySelector('.ts3-skill-number');
  if(fallback){
   if(fallback.getAttribute('aria-hidden')!=='true' || fallback.textContent.trim()!==label)throw Error('Unexpected decorative Knotty label '+asset.panelId);
   fallback.remove();
  }
  if(button.textContent.trim()!==label)throw Error('Knotty tab and summary names differ '+asset.panelId);
  for(const parent of [button,summary]){
   const imgs=[...parent.querySelectorAll('img')];
   if(imgs.some(img=>img.getAttribute('data-game-41-skill-icon')!==asset.id))throw Error('Unexpected pre-existing Knotty icon '+asset.panelId);
   imgs.forEach(img=>img.remove());
   const img=document.createElement('img');
   for(const [key,value] of Object.entries({src:asset.src,width:asset.width,height:asset.height,alt:'',loading:'lazy',decoding:'async','aria-hidden':'true','data-game-41-skill-icon':asset.id}))img.setAttribute(key,String(value));
   parent.prepend(img);
  }
 }
 return document;
}
function build(){
 let changed=0;
 for(const lang of languages){
  const file=path.join(root,lang,'heroes/knotty/index.html'),before=fs.readFileSync(file,'utf8');
  const document=applyKnottySkillIcons(parseHTML(before).document);
  const after='<!DOCTYPE html>\n'+document.documentElement.outerHTML+'\n';
  if(after!==before){fs.writeFileSync(file,after);changed++;}
 }
 console.log(`Knotty skill icons: ${manifest.assets.length} images, ${languages.length} locales, ${changed} pages changed`);
}
if(require.main===module)build();
module.exports={applyKnottySkillIcons};
