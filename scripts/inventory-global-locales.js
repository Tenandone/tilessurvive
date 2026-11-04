'use strict';
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const {parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..');
const OUT=path.resolve(ROOT,'../global-language-delivery-20261104');
const clean=s=>s.replace(/\s+/gu,' ').trim();
const skipText=s=>!/[A-Za-z]/u.test(s)||/^(?:https?:\/\/|\/|#)/u.test(s)||/^(?:[\d\s.,:;()%+−–—→×/|\-]+|[+−-]?[\d,.]+[KMB]|[+−-]?[\d,.]+%?\s*(?:ATK|DEF|HP|EXP)|(?:\d+[dhms]\s*)+|(?:Lv\.?\s*)?\d+(?:\s*[→–-]\s*\d+)?|T\d+|SSR|SR|R|EXP|ATK|DEF|HP|PvP|PvE|VIP|TilesSurvive(?:\.net)?|LootBar|Discord|YouTube|Facebook|Instagram|TikTok|FunPlus|Google|Apple|iOS|Android|PayPal)$/u.test(s);
const map=new Map();
function add(raw,file,context){const text=clean(raw);if(skipText(text))return;let r=map.get(text);if(!r){r={id:crypto.createHash('sha256').update(text).digest('hex').slice(0,16),source:text,contexts:[]};map.set(text,r);}if(r.contexts.length<6&&!r.contexts.some(x=>x.file===file&&x.context===context))r.contexts.push({file,context});}
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);
const nonDisplay=new Set(['id','type','kind','unitType','category','currency','conditionCode','status','source','version','gameVersion','schemaVersion','target','href','url','src','slug','route','language','inLanguage','@type','@context','@id','internalId','skillId','role','position','image','code','key','icon','asset']);
const human=new Set(['name','title','description','headline','text','caption','alt','label','unit','invalid','missing','total','shortage','updated','scope','note','summary','condition','labelText','body','question','answer','activities','rewards']);
function walkJSON(v,file,context,key='',prose=false){
 if(Array.isArray(v)){v.forEach((x,i)=>walkJSON(x,file,context+'.'+i,key,prose));return;}
 if(v&&typeof v==='object'){
  if(Object.hasOwn(v,'en')&&(Object.hasOwn(v,'ko')||Object.hasOwn(v,'ja'))){walkJSON(v.en,file,context+'.en',key,true);return;}
  for(const[k,x]of Object.entries(v))walkJSON(x,file,context+'.'+k,k,prose||k==='copy'||k==='labels'||k==='messages');return;
 }
 if(typeof v==='string'&&!nonDisplay.has(key)&&(prose||human.has(key)))add(v,file,context);
}
const sitemap=fs.readFileSync(path.join(ROOT,'sitemap.xml'),'utf8');const enUrls=[...sitemap.matchAll(/<loc>(https:\/\/tilessurvive.net\/en\/[^<]*)<\/loc>/g)].map(x=>x[1]);
for(const url of enUrls){const rel=new URL(url).pathname.slice(1)+'index.html';const raw=fs.readFileSync(path.join(ROOT,rel),'utf8');const{document}=parseHTML(raw);const walker=document.createTreeWalker(document,4);let n;
 while((n=walker.nextNode())){if(n.parentElement?.closest('script,style,template,noscript'))continue;add(n.data,rel,'text:'+n.parentElement?.tagName);}
 for(const e of document.querySelectorAll('[alt],[title],[placeholder],[aria-label]'))for(const a of ['alt','title','placeholder','aria-label'])if(e.hasAttribute(a))add(e.getAttribute(a),rel,'attr:'+a);
 for(const e of document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]'))add(e.getAttribute('content')||'',rel,'meta');
 for(const s of document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')){try{walkJSON(JSON.parse(s.textContent),rel,'json:'+(s.id||s.type));}catch(e){throw new Error(rel+':'+e.message);}}
}
const rows=[...map.values()].sort((a,b)=>a.id.localeCompare(b.id));fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'active-english-inventory.json'),JSON.stringify({schemaVersion:1,pages:enUrls.length,rows},null,2));
console.log(JSON.stringify({pages:enUrls.length,messages:rows.length,words:rows.reduce((n,r)=>n+r.source.split(/\s+/).length,0),characters:rows.reduce((n,r)=>n+r.source.length,0)}));
module.exports={clean,skipText,walkJSON,nonDisplay,human};
