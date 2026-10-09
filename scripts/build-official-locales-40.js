/* Curated official labels only. Numeric values, IDs, URLs and game formulas are untouched. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{parseHTML}=require('linkedom');
const {entries,replaceLabels}=require('./lib/official-locales-40');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw'];
const obsoleteNames={ko:'이름은 영문 게임 표기 기준입니다.',en:'Names follow the English game version.',ja:'名前は英語版ゲームの表記です。',ru:'Имена соответствуют английской версии игры.','zh-tw':'名稱採用英文版遊戲的表記。'};
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
function textNodes(node,pairs){
  if(node.nodeType===3){node.textContent=replaceLabels(node.textContent,pairs);return;}
  if(node.nodeType!==1&&node.nodeType!==9)return;
  if(['SCRIPT','STYLE','CODE','PRE'].includes(node.tagName))return;
  if(node.matches?.('.ts3-character-kicker'))return;
  node.normalize(); // A decoded entity such as &amp; may split one label into adjacent text nodes.
  for(const attr of ['alt','title','aria-label'])if(node.hasAttribute?.(attr))node.setAttribute(attr,replaceLabels(node.getAttribute(attr),pairs));
  for(const child of node.childNodes)textNodes(child,pairs);
}
function jsonLabels(value,pairs){
  if(typeof value==='string')return /^(https?:|\/)/.test(value)?value:replaceLabels(value,pairs);
  if(Array.isArray(value))return value.map(x=>jsonLabels(x,pairs));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,jsonLabels(v,pairs)]));
  return value;
}
let pages=0,details=0;
for(const lang of langs){
  const index=entries(lang),byRoute=new Map(index.map(x=>[x.route,x]));
  for(const file of walk(path.join(root,lang)).filter(f=>f.endsWith('index.html'))){
    const before=fs.readFileSync(file,'utf8'),d=parseHTML(before).document;
    const route='/'+path.relative(root,file).replaceAll('\\','/').replace(/index\.html$/,'');
    const own=byRoute.get(route),main=d.querySelector('main');if(!main)continue;
    const urls=[...d.querySelectorAll('[href],[src]')].map(n=>[n.getAttribute('href'),n.getAttribute('src')]);
    const banners=[...d.querySelectorAll('.ts-lootbar-slot')].map(n=>n.outerHTML);
    // Entity links carry context, so a short name such as Roy never changes an unrelated word.
    for(const a of main.querySelectorAll('a[href]')){
      const entity=byRoute.get(a.getAttribute('href').split('#')[0]);if(!entity)continue;
      const card=a.closest('.hero-item,.ts-pet-list>li,.ts3-pet-tile')||a;
      textNodes(card,entity.namePairs);
      if(card.matches('.hero-item'))card.setAttribute('data-search-aliases',[...new Set(entity.names)].join(' '));
    }
    if(own){
      for(const p of main.querySelectorAll('p'))if(p.textContent.trim()===obsoleteNames[lang])p.remove();
      textNodes(main,own.pairs);
      const h1=main.querySelector('h1');assert(h1,'Character H1 missing');h1.textContent=own.entity.names[lang];
      // Preserve the concise English alias already shown above Korean pet names.
      if(lang==='ko'&&own.type==='pets'){
        const kicker=main.querySelector('.ts3-character-kicker span');
        if(kicker)kicker.textContent=kicker.textContent.replace('/ '+own.entity.names.ko+' ·','/ '+own.entity.names.en+' ·');
      }
      const skills=[...main.querySelectorAll('details.ts-skill')];
      if(own.type==='heroes'){
        assert.equal(skills.length,own.entity.skills.length,'Existing skill panels must stay intact: '+route);
        own.entity.skills.forEach((skill,i)=>{
          const label=skills[i].querySelector('summary>span');assert(label,'Skill label missing');label.textContent=skill.name[lang];
          const button=main.querySelector('[data-skill-target="'+skills[i].id+'"]>span');
          if(button){const small=button.querySelector('small')?.outerHTML||'';button.textContent=skill.name[lang];if(small)button.insertAdjacentHTML('beforeend',small);}
        });
      }
      d.title=replaceLabels(d.title,own.pairs);
      for(const meta of d.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]'))meta.content=replaceLabels(meta.content,own.pairs);
      for(const script of d.querySelectorAll('script[type="application/ld+json"],#hero-skill-levels-data'))script.textContent=JSON.stringify(jsonLabels(JSON.parse(script.textContent),own.pairs)).replaceAll('<','\\u003c');
      details++;
    }
    assert.deepEqual([...d.querySelectorAll('[href],[src]')].map(n=>[n.getAttribute('href'),n.getAttribute('src')]),urls,'No URL changes');
    assert.deepEqual([...d.querySelectorAll('.ts-lootbar-slot')].map(n=>n.outerHTML),banners,'No banner changes');
    const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
    if(after!==before){fs.writeFileSync(file,after);pages++;}
  }
}
console.log(JSON.stringify({officialCharacterDetails:details,changedPages:pages,languages:langs.length}));
