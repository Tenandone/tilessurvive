'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const {parseHTML}=require('linkedom'),{imageSize}=require('image-size');
const root=path.resolve(__dirname,'..'),M=require('../data/foundation-40/hero-portrait-assets-41.json'),base='eff8b08fcc9d111f7ce6beae4de488156111ca6f';
const ids='beka candy chef-ken eva freya ghost jacob kiki kiron knotty laila light lucky maddy mike nikola ray rosie rusty sarge shark tara tarzan tony travis'.split(' '),langs=['ko','en','ja','ru','zh-tw'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),extract=(d,s)=>[...d.querySelectorAll(s)].map(n=>n.outerHTML);
test('25 released portrait identities pin dimensions, hashes and a minimal public manifest',()=>{
 assert.deepEqual(Object.keys(M).sort(),['assets','version']);assert.equal(M.version,1);assert.deepEqual(M.assets.map(a=>a.entity),ids);
 assert.deepEqual(fs.readdirSync(path.join(root,'img/game-41/heroes')).sort(),ids.map(id=>id+'.webp').sort());
 for(const a of M.assets){assert.deepEqual(Object.keys(a).sort(),['bytes','entity','height','id','kind','sha256','src','version','width']);assert.equal(a.id,'hero-portrait:'+a.entity);assert.equal(a.src,'/img/game-41/heroes/'+a.entity+'.webp');assert.equal(a.version,'2.6.200');assert.equal(a.kind,'hero-portrait');const b=fs.readFileSync(path.join(root,a.src)),im=imageSize(b);assert.equal(sha(b),a.sha256);assert.equal(b.length,a.bytes);assert.equal(im.type,'webp');assert.deepEqual([im.width,im.height],[a.width,a.height]);assert.equal(a.height,712);}
});
test('125 hero pages change the stage portrait while preserving all game data, SEO, skill media and affiliate placement',()=>{
 for(const a of M.assets)for(const l of langs){
  const slug=l==='en'&&a.entity==='tarzan'?'tazan':a.entity,file=`${l}/heroes/${slug}/index.html`;
  const d=parseHTML(fs.readFileSync(path.join(root,file),'utf8')).document,old=parseHTML(execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8',maxBuffer:8e6})).document;
  require('./foundation-40-test-allowances').reviewedHeroSkillImages(old,file);
  const img=d.querySelector('.ts3-character-art img');assert.equal(d.querySelectorAll('[data-game-41-portrait]').length,1);assert.equal(img.getAttribute('src'),a.src);assert.equal(img.getAttribute('width'),String(a.width));assert.equal(img.getAttribute('height'),String(a.height));assert.equal(img.getAttribute('loading'),'eager');assert.equal(img.getAttribute('fetchpriority'),'high');assert.equal(img.getAttribute('alt'),d.querySelector('main h1').textContent.trim());
  const preservedImages=a.entity==='knotty'?'main img:not(.ts3-character-art img):not([data-game-41-skill-icon])':'main img:not(.ts3-character-art img)';
  for(const selector of ['title,meta[name="description"],link[rel="canonical"],link[hreflang]','main table,.ts-skill-body,[data-growth-form]',preservedImages,'.ts-lootbar-slot--hero'])assert.deepEqual(extract(d,selector),extract(old,selector),file+' '+selector);
 }
});
