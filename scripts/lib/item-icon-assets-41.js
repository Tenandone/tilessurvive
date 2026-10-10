'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const itemIds=['reforge-hammer','advanced-recruitment-token','stamina-10','arena-ticket','normal-recruitment-coin','wood-100k','epic-hero-fragment','hero-exp-10k'];
const keys=['bytes','entity','height','id','kind','sha256','src','version','width'];
const check=(ok,message)=>{if(!ok)throw new Error(message);};
function validateItemIcons(manifest){
 check(manifest&&Object.keys(manifest).sort().join(',')==='assets,version'&&manifest.version===1&&Array.isArray(manifest.assets),'Invalid item icon manifest');
 check(manifest.assets.length===itemIds.length,'Unexpected item icon count');
 const icons=new Map();
 for(const asset of manifest.assets){
  check(asset&&Object.keys(asset).sort().join(',')===keys.join(','),'Unexpected item icon fields');
  const id=asset.entity,size=id==='epic-hero-fragment'?256:128;
  check(itemIds.includes(id)&&!icons.has(id)&&asset.id==='item:'+id&&asset.kind==='item','Unknown or duplicate item icon');
  check(asset.src==='/img/game-41/items/'+id+'.webp'&&asset.version==='2.6.200'&&asset.width===size&&asset.height===size,'Invalid item icon identity or dimensions');
  check(Number.isSafeInteger(asset.bytes)&&asset.bytes>0&&/^[a-f0-9]{64}$/.test(asset.sha256),'Invalid item icon integrity metadata');
  const bytes=fs.readFileSync(path.join(root,asset.src));
  check(bytes.length===asset.bytes&&crypto.createHash('sha256').update(bytes).digest('hex')===asset.sha256,'Item icon bytes differ: '+id);
  icons.set(id,asset);
 }
 return icons;
}
module.exports={itemIds,validateItemIcons};
