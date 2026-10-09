const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),languages=['ko','en','ja','ru','zh-tw'];
const {expectedSkillText}=require('./ux-301-test-allowances');
const petIds=require('../data/companions.json').pets.map(p=>p.id),data=require('../data/expansion-22/database.json');
let checks=0;const errors=[];
function check(value,message){checks++;if(!value)errors.push(message);}
const norm=s=>s.trim().replace(/\s+/g,' ');
const parse=s=>parseHTML(s).document;
const load=route=>parse(fs.readFileSync(path.join(root,route,'index.html'),'utf8'));
function rows(d){return [...d.querySelectorAll('main table tr')].map(n=>[...n.querySelectorAll('th,td')].map(c=>norm(c.textContent)).join('|'));}
for(const lang of languages){
 const directory=load(lang+'/heroes');
 const cards=[...directory.querySelectorAll('.ts3-roster-card')];
 check(cards.length===27,lang+': 27 hero cards');
 check(new Set(cards.map(c=>c.dataset.characterId)).size===27,lang+': unique heroes');
 const routes=cards.map(c=>(c.matches('a')?c:c.querySelector('a[href]')).getAttribute('href').slice(1,-1));
 routes.push(...petIds.map(id=>lang+'/database/pet-system/'+id));
 for(const route of routes){
  const d=load(route),main=d.querySelector('main');
  const old=parse(execFileSync('git',['show','HEAD:'+route+'/index.html'],{cwd:root,encoding:'utf8',maxBuffer:5e6}));
  check(!!main.querySelector('.ts3-character-stage'),route+': stage');
  check(d.querySelectorAll('main h1').length===1,route+': single h1');
  check(d.querySelectorAll('link[href="/css/characters-30.css"]').length===1,route+': one stylesheet');
  check(d.querySelectorAll('script[src="/js/characters-30.js"]').length===1,route+': one enhancement');
  check(d.querySelector('link[rel=canonical]')?.href===old.querySelector('link[rel=canonical]')?.href,route+': canonical preserved');
  const currentRows=rows(d);
  for(const row of rows(old))check(currentRows.includes(row),route+': original table row '+row.slice(0,80));
  const skillText=[...main.querySelectorAll('.ts-skill-body')].map(n=>norm(n.textContent));
  for(const body of old.querySelectorAll('main .ts-skill-body'))check(skillText.some(value=>value.normalize('NFKC')===expectedSkillText(body.textContent,route+'/index.html')),route+': complete original skill effects with reviewed status captions');
  for(const picker of old.querySelectorAll('[data-stage-picker]'))check([...main.querySelectorAll('[data-stage-picker]')].some(p=>norm(p.textContent)===norm(picker.textContent)),route+': observed stage options preserved');
  for(const stat of old.querySelectorAll('main .stat-card,main .equipment-stat,main .ts-data-strip'))check([...main.querySelectorAll('.stat-card,.equipment-stat,.ts-data-strip')].some(n=>norm(n.textContent)===norm(stat.textContent)),route+': observed stat block preserved');
  const currentImages=new Set([...main.querySelectorAll('img')].map(n=>n.getAttribute('src')));
  for(const img of old.querySelectorAll('main img'))check(currentImages.has(img.getAttribute('src')),route+': source art preserved');
  const currentExternal=new Set([...main.querySelectorAll('a[href^="http"]')].map(n=>n.getAttribute('href')));
  for(const a of old.querySelectorAll('main a[href^="http"]'))check(currentExternal.has(a.getAttribute('href')),route+': original external/evidence link retained');
  for(const a of main.querySelectorAll('[data-characters-generated] a[href]')){
   const href=a.getAttribute('href');if(!href.startsWith('/'))continue;
   const [pathname,hash]=href.split('#'),target=path.join(root,pathname,'index.html');check(fs.existsSync(target),route+': local relation '+href);
   if(hash&&fs.existsSync(target))check(!!parse(fs.readFileSync(target,'utf8')).getElementById(hash),route+': section target '+href);
  }
  for(const image of main.querySelectorAll('img[src^="/"]'))check(fs.existsSync(path.join(root,image.getAttribute('src'))),route+': original image exists');
  for(const tabs of main.querySelectorAll('.ts3-skill-selector')){
   check(tabs.hasAttribute('hidden'),route+': no-JS selector hidden');
   for(const button of tabs.querySelectorAll('button'))check(!!d.getElementById(button.dataset.skillTarget),route+': skill target exists');
  }
  const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);check(ids.length===new Set(ids).size,route+': unique DOM ids');
 }
 const pets=load(lang+'/database/pet-system');
 for(const [label,doc] of [['heroes',directory],['pets',pets]]){const ids=[...doc.querySelectorAll('[id]')].map(n=>n.id);check(ids.length===new Set(ids).size,lang+': '+label+' directory IDs unique');}
 check(pets.querySelectorAll('.ts3-pet-tile').length===7,lang+': 7 pet cards');
 const matrix=[...pets.querySelectorAll('.ts3-acquisition-matrix tbody tr')];
 check(matrix.length===7,lang+': 7 probability rows');
 for(let i=0;i<matrix.length;i++){
  const actual=[...matrix[i].querySelectorAll('td')].slice(1).map(c=>c.textContent);
  const expected=['rare','epic','legendary'].map(e=>data.pets[i].eggs[e]===null?'—':data.pets[i].eggs[e]+'%');
  check(JSON.stringify(actual)===JSON.stringify(expected),lang+': sourced egg probability '+data.pets[i].id);
 }
 check(!!pets.querySelector('[data-pet-controls]'),lang+': pet search and role filters retained');
 check(!!pets.querySelector('[data-growth-form="petExp"]'),lang+': pet EXP calculator retained');
 check(!!pets.querySelector('[data-growth-form="petTraining"]'),lang+': pet training calculator retained');
}
const css=fs.readFileSync(path.join(root,'css/characters-30.css'),'utf8'),js=fs.readFileSync(path.join(root,'js/characters-30.js'),'utf8');
check(css.includes('@media(prefers-reduced-motion:reduce)'), 'Reduced motion CSS');
check(!/infinite/.test(css),'No idle loops');
check(['ArrowLeft','ArrowRight','Home','End'].every(k=>js.includes(k)),'Keyboard tab navigation');
if(errors.length){console.error(errors.join('\n'));throw Error(`${errors.length} character checks failed of ${checks}`);}
console.log(`Characters 3.0: ${checks} checks passed across 170 detail pages and 10 directories.`);
