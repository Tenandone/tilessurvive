const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),D=require('../data/foundation-40/dave.json'),C=require('../data/foundation-40/dave-copy');
const langs=['ko','en','ja','ru','zh-tw'];let groups=0;
function check(fn){fn();groups++;}
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),clean=s=>s.replace(/\s+/g,' ').trim();
check(()=>{
 assert.equal(D.nameKo,'데이브');assert.equal(D.rarity,'SSR');assert.equal(D.comparison.displayedCap,20);
 assert.deepEqual(D.skills.slice(0,3).map(s=>[s.current,s.next]),[['109.0','110.0'],['1471.50','1485.0'],['2.18','2.20']]);
 assert.deepEqual(D.skills.slice(0,2).map(s=>s.cooldownSeconds),[1,9]);
 const combat=D.skills[1];assert.deepEqual([combat.projectiles,combat.chancePercent,combat.targetATKReductionPercent,combat.targetDEFReductionPercent,combat.durationSeconds,combat.stackable],[3,50,3,3,3,true]);
 assert.equal(D.skills[3].unlockStars,8);assert.equal(D.skills[3].allSelfAttributesBonusPercent,20);assert.equal(D.skills[3].lockedPreview,true);
 assert(!('heroMaxLevel' in D));assert(!('maxStats' in D));assert(!('costs' in D.exclusiveGear));assert(!('effects' in D.exclusiveGear));
});
check(()=>{
 const publicData=read('data/foundation-40/dave.json');
 assert(!/originals|parsed-v1|C:\\|account|3743|7183319|survivor253|rawId/i.test(publicData));
 assert(fs.existsSync(path.join(root,D.image)));assert.equal(D.imageWidth,682);assert.equal(D.imageHeight,712);
 for(const a of require('../data/foundation-40/image-assets.json').assets.filter(a=>a.entity==='dave'))assert.equal(require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,a.src))).digest('hex'),a.sha256);
});
for(const lang of langs)check(()=>{
 const route=`/${lang}/heroes/dave/`,d=parseHTML(read(lang+'/heroes/dave/index.html')).document,t=C[lang];
 assert.equal(d.querySelector('h1').textContent,t.name);assert.equal(d.querySelectorAll('h1').length,1);
 assert.equal(d.querySelector('link[rel=canonical]').href,'https://tilessurvive.net'+route);
 for(const l of langs){assert(d.querySelector(`link[hreflang="${l}"]`).href.endsWith(`/${l}/heroes/dave/`));assert.equal(d.querySelector(`.ts3-language a[hreflang="${l}"]`).href,`/${l}/heroes/dave/`);}
 const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);
 const rows=[...d.querySelectorAll('[data-dave-skill]')].map(r=>[...r.querySelectorAll('td')].map(c=>c.textContent.replace(',','.')));
 assert.deepEqual(rows,[['109.0%','110.0%'],['1471.50% ATK','1485.0% ATK'],['2.18%','2.20%']]);
 assert.equal(d.querySelectorAll('.ts-skill').length,4);assert(d.querySelector('#dave-skill-specialty').textContent.includes(t.specialty));
 assert(d.querySelector('main').textContent.includes(t.combatNote));assert(d.querySelector('main').textContent.includes(t.condition));
 const image=d.querySelector('.ts3-character-art img');assert.equal(image.src,D.image);assert.equal(image.getAttribute('loading'),'eager');
 for(const [i,panel]of [...d.querySelectorAll('.ts-skill')].entries()){assert.equal(panel.querySelector('summary').querySelectorAll('img').length,1);assert.equal(panel.querySelector('summary img').src,'/img/game-40/skills/dave-'+(i+1)+'.webp');}
 const banner=d.querySelector('.ts-lootbar-slot--hero'),source=parseHTML(read(lang+'/heroes/undine/index.html')).document.querySelector('.ts-lootbar-slot--hero');
 assert.equal(d.querySelectorAll('.ts-lootbar-slot--hero').length,1);assert.equal(banner.outerHTML,source.outerHTML);
 assert(banner.previousElementSibling.querySelector('[data-character-skills]'));assert(banner.nextElementSibling.querySelector('#dave-growth'));
 assert(!d.querySelector('#hero-skill-levels-data,script[src*="hero-skill-levels-40"],style[data-hero-levels-style]'));
 for(const a of d.querySelectorAll('main a[href^="#"]'))assert(d.getElementById(a.getAttribute('href').slice(1)));
 const h=parseHTML(read(lang+'/heroes/index.html')).document,sea=h.getElementById('heroes-sea');
 assert.equal(h.querySelectorAll('[data-dave-roster]').length,1);assert.equal(sea.querySelectorAll('.hero-item').length,5);assert.equal(h.querySelectorAll('.hero-item').length,28);
 assert.equal(h.querySelector('.ts3-directory-stats strong').textContent,'28');assert.equal(sea.querySelector('.faction-count').textContent.match(/\d+/)[0],'5');
 const sitemap=read('sitemap.xml');assert.equal(sitemap.split('<loc>https://tilessurvive.net'+route+'</loc>').length-1,1);
 const texts=[...d.querySelectorAll('.ts-skill-body')].map(n=>clean(n.textContent));
 // Linkedom does not reflect the details.open property; browsers do.
 for(const panel of d.querySelectorAll('.ts-skill'))Object.defineProperty(panel,'open',{get(){return this.hasAttribute('open');},set(value){this.toggleAttribute('open',value);}});
 const window=d.defaultView;vm.runInNewContext(read('js/characters-30.js'),{document:d,window,location:{hash:''},URL});
 const buttons=[...d.querySelectorAll('[data-skill-target]')],panels=[...d.querySelectorAll('.ts-skill')];
 assert.equal(d.querySelector('.ts3-skill-selector').hidden,false);assert.equal(buttons[1].getAttribute('aria-selected'),'true');
 buttons[3].dispatchEvent(new window.Event('click'));assert.equal(buttons[3].getAttribute('aria-selected'),'true');
 assert.equal(panels.filter(p=>!p.hidden).length,1);assert.equal(panels.find(p=>!p.hidden).id,'dave-skill-specialty');
 assert.deepEqual([...d.querySelectorAll('.ts-skill-body')].map(n=>clean(n.textContent)),texts);
});
console.log(JSON.stringify({passed:true,groups,pages:5,skillsPerPage:4,comparisonRowsPerPage:3,scope:'Static and existing skill-tab event checks; browser layout is separate'}));
