/* Adds explicitly level-scoped observations without rewriting legacy skills.
 * Raw screenshots and account-specific evidence stay outside the public repo. */
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..');
const data=require('../data/foundation-40/hero-observations.json');
const languages=['ko','en','ja','ru','zh-tw'];
const audit=process.argv.includes('--audit');
const assert=(value,message)=>{if(!value)throw new Error(message);};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const clean=s=>s.replace(/\s+/g,' ').trim();
const skillText=d=>[...d.querySelectorAll('.ts-skill-body')].map(e=>clean(e.textContent));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const number=(s,lang)=>lang==='ru'?String(s).replace('.',','):String(s);
const value=(row,key,lang)=>(row.unit==='percent-bonus'?'+':'')+number(row[key],lang)+(row.unit==='percent-atk'?'% ATK':'%');
const table=(headers,rows,label)=>`<div class="ts-table-wrap" tabindex="0" role="region" aria-label="${esc(label)}"><table data-static><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const unique=new Set();
for(const hero of data.heroes){
 assert(['undine','lagnar'].includes(hero.id),'Unsupported hero');
 assert(hero.rows.length===3,'Exactly three skill comparisons expected');
 for(const row of hero.rows){
  assert(!unique.has(row.id),'Duplicate observation ID');unique.add(row.id);
  assert(['percent-atk','percent-damage','percent-bonus'].includes(row.unit),'Unknown unit');
  for(const key of ['current','next'])assert(/^\d+(?:\.\d+)?$/.test(row[key]),'Invalid numeric display');
  for(const lang of languages)assert(row.name[lang],`Missing row locale ${lang}`);
 }
}
for(const [key,localized] of Object.entries(data.copy))for(const lang of languages)assert(localized[lang],`Missing copy ${key}/${lang}`);
assert(data.context.currentSkillLevel===10&&data.context.nextSkillLevel===11&&data.context.nextLevelIsPreview===true,'Level scope mismatch');
const changed=[];
for(const hero of data.heroes)for(const lang of languages){
 const route=`${lang}/heroes/${hero.id}/index.html`,file=path.join(root,route),original=fs.readFileSync(file,'utf8'),d=parseHTML(original).document;
 const beforeSkillText=skillText(d),banners=[...d.querySelectorAll('.ts-lootbar-slot--hero')];
 assert(banners.length===1,`Expected one hero banner: ${route}`);
 const banner=banners[0],bannerHTML=banner.outerHTML,skillSection=banner.previousElementSibling,growthSection=banner.nextElementSibling;
 assert(skillSection?.querySelector('[data-character-skills]'),`Banner must follow the last skill section: ${route}`);
 assert(growthSection?.tagName==='SECTION',`Missing growth section: ${route}`);
 d.querySelectorAll('[data-hero-observations-40]').forEach(n=>n.remove());
 const block=d.createElement('div');
 block.id='skill-level-comparison-40';block.setAttribute('data-hero-observations-40','skills');
 const title=data.copy.title[lang],headers=data.copy.headers[lang];
 const rows=hero.rows.map(row=>`<tr data-game-fact-id="${esc(row.id)}"><th scope="row">${esc(row.name[lang])}</th><td>${esc(value(row,'current',lang))}</td><td>${esc(value(row,'next',lang))}</td></tr>`);
 const version=`v${data.context.gameVersion} · ${data.context.gameBuild} · ${data.context.observedDate}`;
 block.innerHTML=`<h3>${esc(title)}</h3><p><small>${esc(version)}</small></p>`+table(headers,rows,title)+`<p>${esc(data.copy.condition[lang].replace('{cap}',hero.displayedSkillCap))}</p>`+(hero.id==='undine'?`<p>${esc(data.copy.undineCondition[lang])}</p>`:'');
 skillSection.append(block);
 if(hero.gear){
  const gear=d.createElement('div');gear.id='exclusive-level-comparison-40';gear.setAttribute('data-hero-observations-40','equipment');
  const gearRows=hero.gear.rows.map(row=>`<tr><th scope="row">${esc(row.label[lang])}</th><td>${esc(number(row.current,lang))}</td><td>${esc(number(row.preview,lang))}</td></tr>`);
  gear.innerHTML=`<h3>${esc(data.copy.gearTitle[lang])}</h3>`+table(data.copy.gearHeaders[lang],gearRows,data.copy.gearTitle[lang])+`<p>${esc(data.copy.gearCondition[lang])}</p><p>${esc(data.copy.gearEffect[lang])}</p>`;
  growthSection.append(gear);
 }
 if(lang==='ko'&&hero.id==='undine'){
  // The Korean game UI names the hero 운디네. Keep the existing English alias.
  const name=s=>s.includes('운디네 (Undine)')?s:s.replace(/\bUndine\b/g,'운디네 (Undine)');
  const h1=d.querySelector('main h1');
  if(h1&&clean(h1.textContent)==='Undine')h1.textContent='운디네 (Undine)';
  const titleNode=d.querySelector('title');
  if(titleNode)titleNode.textContent=name(titleNode.textContent);
  for(const meta of d.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]')){
   const content=meta.getAttribute('content');if(content)meta.setAttribute('content',name(content));
  }
  for(const p of d.querySelectorAll('main p'))if(clean(p.textContent)==='이름은 영문 게임 표기 기준입니다.')p.remove();
  for(const script of d.querySelectorAll('script[type="application/ld+json"]')){
   const originalJSON=script.textContent,structured=JSON.parse(originalJSON);
   const update=node=>{if(Array.isArray(node))node.forEach(update);else if(node&&typeof node==='object'){
    if(node['@type']==='WebPage')for(const key of ['name','description'])if(typeof node[key]==='string')node[key]=name(node[key]);
    if(node['@graph'])update(node['@graph']);
   }};
   update(structured);const nextJSON=JSON.stringify(structured);if(nextJSON!==originalJSON)script.textContent=nextJSON;
  }
 }
 assert(banner.outerHTML===bannerHTML&&banner.previousElementSibling===skillSection&&banner.nextElementSibling===growthSection,`Banner changed: ${route}`);
 assert(same(beforeSkillText,skillText(d)),`Existing skill content changed: ${route}`);
 assert(d.querySelectorAll('#skill-level-comparison-40').length===1,`Duplicate skill comparison: ${route}`);
 assert(d.querySelectorAll('#exclusive-level-comparison-40').length===(hero.gear?1:0),`Incorrect equipment comparison: ${route}`);
 const html='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
 if(html!==original){changed.push(route);if(!audit)fs.writeFileSync(file,html);}
}
console.log(`Hero observations: ${data.heroes.length} heroes, ${languages.length} locales, ${changed.length} pages ${audit?'would change':'changed'}`);
