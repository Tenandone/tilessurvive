/* Dave uses the existing character shell and affiliate placement. No account state is published. */
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),D=require('../data/foundation-40/dave.json'),C=require('../data/foundation-40/dave-copy');
const {applyHeroAssets}=require('./lib/hero-assets-40');
const langs=['ko','en','ja','ru','zh-tw'],assert=(v,m)=>{if(!v)throw Error(m);};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fragment=(d,s)=>{const t=d.createElement('template');t.innerHTML=s;return t.content;};
let changes=0;
function save(file,text){if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===text)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);changes++;}
function shown(value,lang){return lang==='ru'?value.replace('.',','):value;}
function content(lang,banner){
 const t=C[lang],name=i=>lang==='ko'?D.skills[i].nameKo:t.types[i];
 const labels=D.skills.map((s,i)=>name(i));
 const panels=D.skills.map((s,i)=>`<details id="dave-skill-${s.id}" class="ts-skill"${i===1?' open':''}><summary><span>${esc(labels[i])}</span></summary><div class="ts-skill-body">${lang==='ko'?'':`<p class="ts-evidence-label">${esc(t.original)}: <span lang="ko">${esc(s.nameKo)}</span></p>`}<p>${esc(t[s.id])}</p>${s.cooldownSeconds?`<p>${esc(t.cooldown)}: ${s.cooldownSeconds} ${esc(t.seconds)}</p>`:''}${i===1?`<p>${esc(t.combatNote)}</p>`:''}</div></details>`).join('');
 const rows=D.skills.slice(0,3).map((s,i)=>`<tr data-dave-skill="${s.id}"><th scope="row">${esc(labels[i])}</th><td>${shown(s.current,lang)}%${s.unit==='percent-atk'?' ATK':''}</td><td>${shown(s.next,lang)}%${s.unit==='percent-atk'?' ATK':''}</td></tr>`).join('');
 return `<section class="ts-character-intro ts3-character-stage"><div class="ts3-character-copy"><div class="ts3-character-identity"><p class="ts3-character-kicker"><a href="/${lang}/heroes/">${esc(t.directory)}</a><span> / ${esc(t.sea)} · SSR</span></p><h1>${esc(t.name)}</h1><p class="ts-overline">${esc(t.sea)} / SSR / ${esc(t.role)}</p></div><p>${esc(t.intro)}</p><nav class="ts3-character-sections" aria-label="${esc(t.skills)}"><a href="#dave-skills">${esc(t.skills)}</a><a href="#dave-growth">${esc(t.growth)}</a></nav></div><figure class="ts3-character-art"><img fetchpriority="high" decoding="async" loading="eager" src="${D.image}" width="${D.imageWidth}" height="${D.imageHeight}" alt="${esc(t.name)}"></figure></section>
<section class="ts-expansion ts3-character-section" aria-labelledby="dave-skills"><h2 id="dave-skills">${esc(t.skills)}</h2><p class="ts-evidence-label">v${D.gameVersion} · ${D.observedAt}</p><div data-character-skills class="ts-skill-list ts3-skill-workspace"><div class="ts3-skill-selector" aria-label="${esc(t.select)}" hidden>${D.skills.map((s,i)=>`<button type="button" id="dave-tab-${s.id}" data-skill-target="dave-skill-${s.id}"><span class="ts3-skill-number" aria-hidden="true">0${i+1}</span><span>${esc(labels[i])}</span></button>`).join('')}</div>${panels}</div><h3 id="dave-comparison">${esc(t.compare)}</h3><p>${esc(t.condition)}</p><div class="ts-table-wrap" role="region" tabindex="0" aria-label="${esc(t.compare)}"><table data-static><thead><tr><th scope="col">${esc(t.metric)}</th><th scope="col">Lv.10</th><th scope="col">Lv.11</th></tr></thead><tbody>${rows}</tbody></table></div></section>
${banner}
<section class="ts-expansion ts3-character-section" aria-labelledby="dave-growth"><h2 id="dave-growth">${esc(t.growth)}</h2><h3>${esc(t.gear)}</h3><p>${esc(t.gearNote)}</p><nav class="ts-context-links" aria-label="${esc(t.related)}"><a href="/${lang}/heroes/undine/">${esc(t.undine)}</a><a href="/${lang}/heroes/lagnar/">${esc(t.lagnar)}</a><a href="/${lang}/database/hero-star/">${esc(t.star)}</a><a href="/${lang}/database/exclusive-gear/">${esc(t.equipment)}</a></nav></section>`;
}
function updateRoster(d,lang){
 const t=C[lang],sea=d.getElementById('heroes-sea'),grid=sea?.querySelector('.hero-grid');assert(grid,'Sea roster missing');
 d.querySelectorAll('[data-dave-roster], [data-character-id="dave"]').forEach(n=>n.remove());
 const card=`<article data-dave-roster data-character-faction="heroes-sea" data-character-id="dave" class="hero-item ts3-roster-card"><a class="hero-thumb" href="/${lang}/heroes/dave/"><img width="${D.imageWidth}" height="${D.imageHeight}" decoding="async" loading="lazy" src="${D.image}" alt="${esc(t.name)}"></a><div class="hero-body"><h3>${esc(t.name)}</h3><p>${esc(t.sea)} · SSR · ${esc(t.role)}</p><div class="hero-meta-row"><span class="chip chip-sea">${esc(t.sea)}</span><span class="chip chip-ssr">SSR</span><span class="chip chip-range">${esc(t.role)}</span></div><a class="hero-link" href="/${lang}/heroes/dave/">${esc(t.details)}</a></div></article>`;
 grid.append(fragment(d,card));
 const count=sea.querySelectorAll('.hero-item').length,total=d.querySelectorAll('.hero-item').length;
 const countNode=sea.querySelector('.faction-count');if(countNode)countNode.textContent=countNode.textContent.replace(/\d+/,String(count));
 const chip=d.querySelector('.hero-card .chip-sea');if(chip)chip.textContent=chip.textContent.replace(/\d+/,String(count));
 const totalNode=d.querySelector('.ts3-directory-stats strong');if(totalNode)totalNode.textContent=total;
 assert(count===5&&total===28,'Unexpected hero roster counts');
}
function build(){
 assert(fs.existsSync(path.join(root,D.image)),'Publish the verified Dave artwork before building');
 changes=0;
 for(const lang of langs){
  const t=C[lang],route=`/${lang}/heroes/dave/`,url='https://tilessurvive.net'+route;
  const d=parseHTML(fs.readFileSync(path.join(root,lang,'heroes/undine/index.html'),'utf8')).document;
  const banner=d.querySelector('.ts-lootbar-slot--hero')?.outerHTML;assert(banner,'Missing existing hero banner');
  d.querySelector('main').innerHTML=content(lang,banner);
  applyHeroAssets(d,'dave');
  d.querySelector('title').textContent=t.title+' | TilesSurvive.net';
  for(const sel of ['meta[name="description"]','meta[property="og:description"]','meta[name="twitter:description"]'])d.querySelector(sel)?.setAttribute('content',t.intro);
  for(const sel of ['meta[property="og:title"]','meta[name="twitter:title"]'])d.querySelector(sel)?.setAttribute('content',t.title);
  for(const sel of ['meta[property="og:image"]','meta[name="twitter:image"]'])d.querySelector(sel)?.setAttribute('content','https://tilessurvive.net'+D.image);
  d.querySelector('link[rel="canonical"]').href=url;d.querySelector('meta[property="og:url"]')?.setAttribute('content',url);
  for(const a of d.querySelectorAll('link[hreflang]'))a.href=`https://tilessurvive.net/${a.hreflang==='x-default'?'en':a.hreflang}/heroes/dave/`;
  for(const a of d.querySelectorAll('.ts3-language a'))a.href=`/${a.getAttribute('hreflang')}/heroes/dave/`;
  d.querySelector('.ts-skip').href=route+'#main';
  d.querySelectorAll('script[type="application/ld+json"],#hero-skill-levels-data,script[src^="/js/hero-skill-levels-40.js"],style[data-hero-levels-style]').forEach(n=>n.remove());
  d.head.append(fragment(d,`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:t.title,url,inLanguage:lang,description:t.intro,image:'https://tilessurvive.net'+D.image,isPartOf:{'@type':'WebSite',name:'TilesSurvive.net',url:'https://tilessurvive.net/'}}).replaceAll('<','\\u003c')}</script>`));
  assert(d.querySelectorAll('h1').length===1&&d.querySelectorAll('.ts-skill').length===4,'Incomplete Dave page');
  assert(d.querySelectorAll('.ts-lootbar-slot--hero').length===1&&d.querySelector('.ts-lootbar-slot--hero').outerHTML===banner,'Hero affiliate changed');
  save(path.join(root,lang,'heroes/dave/index.html'),'<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n');
  const file=path.join(root,lang,'heroes/index.html'),h=parseHTML(fs.readFileSync(file,'utf8')).document;
  updateRoster(h,lang);save(file,'<!DOCTYPE html>\n'+h.documentElement.outerHTML+'\n');
 }
 const file=path.join(root,'sitemap.xml');let xml=fs.readFileSync(file,'utf8');
 for(const lang of langs){const url=`https://tilessurvive.net/${lang}/heroes/dave/`;if(!xml.includes('<loc>'+url+'</loc>'))xml=xml.replace('</urlset>',`  <url><loc>${url}</loc></url>\n</urlset>`);}
 save(file,xml);console.log(JSON.stringify({davePages:5,skills:4,comparisonRows:3,changes}));
}
module.exports={content,updateRoster};if(require.main===module)build();
