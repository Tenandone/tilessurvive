'use strict';
// Apply approved illustrations to existing pages without rewriting game content.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{imageSize}=require('image-size');
const root=path.resolve(__dirname,'..');
const langs=['ko','en','ja','ru','zh-tw'];
const routes=['behemoths/index.html','behemoths/legend-griffin/index.html','behemoths/marine-drake/index.html','database/behemoth-cell/index.html'];
const ids=['legend-griffin','marine-drake','behemoth-cell','behemoth-serum-partial','active-protein'];
const fields=['bytes','entity','height','id','kind','previousSrc','sha256','src','version','width'].sort();
function validate(m){
 if(m.version!==1||Object.keys(m).sort().join(',')!=='assets,version'||!Array.isArray(m.assets)||m.assets.length!==ids.length)throw Error('Invalid behemoth asset manifest');
 const seen=new Set();
 for(const a of m.assets){
  const portrait=['legend-griffin','marine-drake'].includes(a.entity),size=portrait?512:128;
  if(Object.keys(a).sort().join(',')!==fields.join(',')||!ids.includes(a.entity)||seen.has(a.entity)||a.id!==`behemoth:${a.entity}`||a.kind!==(portrait?'behemoth-portrait':'behemoth-material')||a.version!=='2.6.200'||a.previousSrc!==`/img/behemoths/${a.entity}.png`||a.src!==`/img/game-41/behemoths/${a.entity}.webp`||a.width!==size||a.height!==size||!Number.isSafeInteger(a.bytes)||a.bytes<=0||!/^[a-f0-9]{64}$/.test(a.sha256))throw Error('Invalid approved behemoth asset '+a.entity);
  seen.add(a.entity);
  const bytes=fs.readFileSync(path.join(root,a.src)),dimensions=imageSize(bytes);
  if(bytes.length!==a.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==a.sha256||dimensions.type!=='webp'||dimensions.width!==a.width||dimensions.height!==a.height)throw Error('Behemoth asset integrity mismatch: '+a.entity);
 }
 return m;
}
function setAttribute(tag,name,value){
 const re=new RegExp(`(\\s)${name}=(['"])[^'"]*\\2`);
 return re.test(tag)?tag.replace(re,(_match,space)=>`${space}${name}="${value}"`):tag.replace(/\s*\/?>$/,` ${name}="${value}">`);
}
function render(html,m){
 validate(m);
 for(const a of m.assets){
  // Full quoted paths cover image attributes and social/Article image URLs.
  for(const prefix of ['', 'https://tilessurvive.net']){
   for(const quote of ['"',"'"])html=html.split(quote+prefix+a.previousSrc+quote).join(quote+prefix+a.src+quote);
  }
 }
 return html.replace(/<img\b[^>]*>/g,tag=>{
  const src=tag.match(/\ssrc=(['"])(.*?)\1/);if(!src)return tag;
  const a=m.assets.find(a=>a.src===src[2]);if(!a)return tag;
  return setAttribute(setAttribute(tag,'width',a.width),'height',a.height);
 });
}
function apply(){
 const m=validate(JSON.parse(fs.readFileSync(path.join(root,'data/foundation-40/behemoth-assets-41.json'),'utf8')));
 let changed=0;
 for(const lang of langs)for(const route of routes){
  const p=path.join(root,lang,route),before=fs.readFileSync(p,'utf8'),after=render(before,m);
  if(before!==after){fs.writeFileSync(p,after);changed++;}
 }
 console.log(`Behemoth official assets: ${m.assets.length} images; ${changed} existing pages updated`);
}
module.exports={validate,render,langs,routes,ids};
if(require.main===module)apply();
