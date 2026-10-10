'use strict';
// Replace only the hero-stage portrait. Skill evidence and game values stay intact.
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),manifest=require('../data/foundation-40/hero-portrait-assets-41.json');
const langs=['ko','en','ja','ru','zh-tw'];let changed=0;
for(const asset of manifest.assets)for(const lang of langs){
 const slug=lang==='en'&&asset.entity==='tarzan'?'tazan':asset.entity;
 const file=path.join(root,lang,'heroes',slug,'index.html'),before=fs.readFileSync(file,'utf8'),d=parseHTML(before).document;
 const portraits=[...d.querySelectorAll('.ts3-character-art img')];
 if(portraits.length!==1)throw Error('Expected one hero portrait: '+file);
 const img=portraits[0];for(const key of ['src','width','height'])img.setAttribute(key,String(asset[key]));
 img.setAttribute('alt',d.querySelector('main h1').textContent.trim());
 img.setAttribute('data-game-41-portrait',asset.entity);
 const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
 if(after!==before){fs.writeFileSync(file,after);changed++;}
}
console.log(`Hero portraits: ${manifest.assets.length} artworks, ${langs.length} locales, ${changed} pages changed`);
