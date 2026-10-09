const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),assets=require('../../data/foundation-40/image-assets.json').assets;
function asset(id){const a=assets.find(a=>a.id===id);if(!a||!fs.existsSync(path.join(root,a.src)))throw Error('Missing verified game asset '+id);return a;}
function image(d,id){const a=asset(id),img=d.createElement('img');for(const [key,value]of Object.entries({src:a.src,width:a.width,height:a.height,alt:'',loading:'lazy',decoding:'async','aria-hidden':'true','data-game-40-icon':id}))img.setAttribute(key,String(value));return img;}
function removeExtractedStyle(d,style){
 // build-platform extracts earlier inline styles. The late hero builders own
 // these exact rules and reinsert their source; remove only the matching hash.
 const hash=crypto.createHash('sha256').update(style.textContent).digest('hex').slice(0,16);
 d.querySelectorAll('link[rel="stylesheet"][href="/css/content/'+hash+'.css"]').forEach(n=>n.remove());
}
function applyHeroAssets(d,hero){
 d.querySelectorAll('style[data-game-40-art-style]').forEach(n=>n.remove());
 const style=d.createElement('style');style.setAttribute('data-game-40-art-style','');
 style.textContent='html.ts-platform.ts3-characters .ts3-character-stage h1{word-break:keep-all}@media(max-width:420px){html.ts-platform.ts3-characters .ts3-character-stage h1{font-size:24px}}';d.head.append(style);
 removeExtractedStyle(d,style);
 const art=asset('hero:'+hero),portrait=d.querySelector('.ts3-character-art img');
 if(!portrait)throw Error('Missing character portrait '+hero);
 for(const key of ['src','width','height'])portrait.setAttribute(key,String(art[key]));
 portrait.setAttribute('alt',d.querySelector('main h1').textContent.trim());portrait.setAttribute('data-game-40-art',hero);
 d.querySelectorAll('[data-game-40-icon]').forEach(n=>n.remove());
 for(const [i,panel]of [...d.querySelectorAll('[data-character-skills] .ts-skill')].entries()){
  const id='skill:'+hero+'-'+(i+1),button=d.querySelector('[data-skill-target="'+panel.id+'"]');
  if(button){button.querySelector('.ts3-skill-number')?.remove();button.querySelectorAll('img').forEach(n=>n.remove());button.prepend(image(d,id));}
  const summary=panel.querySelector('summary');summary.querySelectorAll('img').forEach(n=>n.remove());summary.prepend(image(d,id));
 }
 const gear=d.querySelector('#exclusive-level-comparison-40 > h3');
 if(hero==='undine'&&gear){const img=image(d,'gear:undine');img.style.cssText='width:44px;height:44px;object-fit:contain;vertical-align:middle;margin-inline-end:.6rem';gear.prepend(img);}
}
module.exports={applyHeroAssets,removeExtractedStyle};
