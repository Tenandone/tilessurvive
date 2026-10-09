/* Character presentation is derived from the existing HTML. No game values are inferred. */
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');
const root = path.resolve(__dirname, '..');
const pets = require('../data/companions.json').pets;
const database = require('../data/expansion-22/database.json');
const languages = ['ko', 'en', 'ja', 'ru', 'zh-tw'];
const words = {
  ko: { heroes:'영웅 도감', pets:'펫 도감', onPage:'이 페이지', skills:'스킬 선택', roster:'같은 진영의 영웅', petRoster:'다른 펫 살펴보기', full:'전체 도감', growth:'성장 데이터', star:'성급과 성장', gear:'전용 장비 비용', research:'연구 조건', basics:'영웅 정보', acquisition:'펫 획득 비교', egg:'알 등급', rare:'희귀', epic:'에픽', legendary:'전설', role:'역할', Support:'지원', Attacker:'공격', Defender:'방어', training:'훈련 표식', exp:'레벨 경험치', materials:'먹이와 성장 재료', compare:'역할과 획득 경로를 비교하세요.', group:'진영', all:'전체', next:'다음', previous:'이전', observed:'확인된 관측 단계', unknown:'미확인', gallery:'게임 이미지', jump:'필요한 데이터로 이동', empty:'검색 조건에 맞는 항목이 없습니다.', clear:'검색 초기화' },
  en: { heroes:'Hero directory', pets:'Pet directory', onPage:'On this page', skills:'Select a skill', roster:'More from this faction', petRoster:'Explore other pets', full:'Full directory', growth:'Growth data', star:'Stars & growth', gear:'Exclusive gear costs', research:'Research requirements', basics:'Hero profile', acquisition:'Compare pet acquisition', egg:'Egg rarity', rare:'Rare', epic:'Epic', legendary:'Legendary', role:'Role', Support:'Support', Attacker:'Attacker', Defender:'Defender', training:'Training marks', exp:'Level EXP', materials:'Feed & growth materials', compare:'Compare roles and acquisition routes.', group:'Faction', all:'All', next:'Next', previous:'Previous', observed:'Observed stages', unknown:'Unconfirmed', gallery:'Game image', jump:'Find the data you need', empty:'No entries match these filters.', clear:'Reset search' },
  ja: { heroes:'英雄図鑑', pets:'ペット図鑑', onPage:'ページ内の項目', skills:'スキルを選択', roster:'同じ陣営の英雄', petRoster:'ほかのペットを見る', full:'図鑑一覧', growth:'育成データ', star:'星と育成', gear:'専用装備の費用', research:'研究条件', basics:'英雄プロフィール', acquisition:'ペットの入手確率を比較', egg:'卵のレア度', rare:'レア', epic:'エピック', legendary:'レジェンド', role:'役割', Support:'支援', Attacker:'攻撃', Defender:'防御', training:'訓練マーク', exp:'レベル経験値', materials:'餌と育成素材', compare:'役割と入手方法を比較できます。', group:'陣営', all:'すべて', next:'次へ', previous:'前へ', observed:'確認済みの段階', unknown:'未確認', gallery:'ゲーム画像', jump:'必要なデータへ', empty:'条件に一致する項目がありません。', clear:'検索をリセット' },
  ru: { heroes:'Каталог героев', pets:'Каталог питомцев', onPage:'На этой странице', skills:'Выбрать навык', roster:'Герои той же фракции', petRoster:'Другие питомцы', full:'Весь каталог', growth:'Развитие', star:'Звёзды и развитие', gear:'Стоимость особого снаряжения', research:'Условия исследований', basics:'Профиль героя', acquisition:'Сравнение получения питомцев', egg:'Редкость яйца', rare:'Редкое', epic:'Эпическое', legendary:'Легендарное', role:'Роль', Support:'Поддержка', Attacker:'Атака', Defender:'Защита', training:'Метки тренировки', exp:'Опыт уровней', materials:'Корм и материалы', compare:'Сравните роли и способы получения.', group:'Фракция', all:'Все', next:'Далее', previous:'Назад', observed:'Проверенные этапы', unknown:'Не подтверждено', gallery:'Изображение из игры', jump:'Нужные данные', empty:'Ничего не найдено по этим условиям.', clear:'Сбросить поиск' },
  'zh-tw': { heroes:'英雄圖鑑', pets:'寵物圖鑑', onPage:'頁面內容', skills:'選擇技能', roster:'同陣營的其他英雄', petRoster:'探索其他寵物', full:'完整圖鑑', growth:'成長資料', star:'星級與成長', gear:'專屬裝備費用', research:'研究條件', basics:'英雄資料', acquisition:'寵物取得機率比較', egg:'蛋的稀有度', rare:'稀有', epic:'史詩', legendary:'傳說', role:'角色', Support:'支援', Attacker:'攻擊', Defender:'防禦', training:'訓練標記', exp:'等級經驗', materials:'飼料與成長材料', compare:'比較角色定位與取得方式。', group:'陣營', all:'全部', next:'下一個', previous:'上一個', observed:'已確認的階段', unknown:'待確認', gallery:'遊戲圖片', jump:'前往所需資料', empty:'沒有符合條件的項目。', clear:'重設搜尋' }
};
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const clean = s => String(s).trim().replace(/\s+/g,' ');
const read = route => parseHTML(fs.readFileSync(path.join(root, route, 'index.html'), 'utf8')).document;
function fragment(d, html) { const t=d.createElement('template');t.innerHTML=html;return t.content; }
function generated(d, html) { const f=fragment(d,html);for(const n of f.children)n.setAttribute('data-characters-generated','');return f; }
function prepare(d, type) {
  d.querySelectorAll('[data-characters-generated]').forEach(n=>n.remove());
  d.documentElement.classList.add('ts3-characters');
  d.documentElement.setAttribute('data-character-view',type);
  for(const [tag,attr,url] of [['link','href','/css/characters-30.css'],['script','src','/js/characters-30.js']]){
    d.querySelectorAll(`${tag}[${attr}="${url}"]`).forEach(n=>n.remove());
    const n=d.createElement(tag);n.setAttribute(attr,url);if(tag==='link')n.rel='stylesheet';else n.defer=true;d.head.append(n);
  }
}
function write(route,d){fs.writeFileSync(path.join(root,route,'index.html'),'<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n');}
function canonicalHero(lang,id){return `/${lang}/heroes/${lang==='en'&&id==='tarzan'?'tazan':id}/`;}
function readRoster(lang) {
  const d=read(lang+'/heroes');
  return [...d.querySelectorAll('main .hero-item')].map(item=>{
    const anchor=item.matches('a[href]')?item:item.querySelector('a[href]');
    const href=anchor.getAttribute('href'),id=href.split('/').filter(Boolean).pop().replace(/^tazan$/,'tarzan').replace(/^cnay$/,'candy');
    return {id, href:canonicalHero(lang,id), name:clean(item.querySelector('h3,h5')?.textContent||id), image:item.querySelector('img')?.getAttribute('src'), faction:item.closest('.faction-block')?.id||'heroes-sea', tags:[...item.querySelectorAll('.chip')].map(n=>clean(n.textContent)), description:clean(item.querySelector('.hero-body p')?.textContent||'')};
  }).filter((n,i,arr)=>arr.findIndex(a=>a.id===n.id)===i)
    // The 4.0 builder owns Dave's source model and adds its card after this pass.
    .filter(n=>n.id!=='dave');
}
function sectionNav(d,stage,t,route){
  const scopeCopy=require('../data/expansion-22/copy')[route.split('/')[0]];
  const secondary=/^(참고|출처|자료와|Sources|Notes|References|Evidence|出典|参考|注意|來源|來源與|參考|注意事項|Источники|Примечания)/i;
  const heads=[...d.querySelectorAll('main h2')].filter(n=>{
    if(n.closest('.visually-hidden-seo')||(n.closest('[data-characters-generated]')&&!n.closest('.ts3-acquisition-matrix')))return false;
    const section=n.closest('section');
    if(secondary.test(clean(n.textContent))||section?.id==='mariner-connections')return false;
    if(section?.querySelector('a[href*="lootbar"]')&&!section.querySelector('table,.ts-skill'))return false;
    if(clean(n.textContent)===scopeCopy.notice&&!section?.querySelector('table'))return false;
    return true;
  });
  if(!heads.length)return;
  let headingId=0;
  heads.forEach(n=>{if(!n.id){while(d.getElementById('character-section-'+headingId))headingId++;n.id='character-section-'+headingId++;}});
  const label=h=>clean(h.textContent)===scopeCopy.notice?scopeCopy.cooldown:clean(h.textContent);
  const nav=generated(d,`<nav class="ts3-character-sections" aria-label="${t.onPage}">${heads.map(h=>`<a href="/${route}/#${h.id}">${esc(label(h))}</a>`).join('')}</nav>`);
  stage.after(nav);
}
function skillPanels(d,t){
  const groups=new Set([...d.querySelectorAll('details.ts-skill')].map(n=>n.parentElement));
  let group=0;
  for(const parent of groups){
    const skills=[...parent.children].filter(n=>n.matches('details.ts-skill'));
    if(skills.length<2)continue;
    parent.classList.add('ts3-skill-workspace');parent.setAttribute('data-character-skills','');
    const buttons=skills.map((s,i)=>{
      s.id=`character-skill-${group}-${i}`;
      s.removeAttribute('hidden');
      const summary=s.querySelector('summary'),image=summary.querySelector('img');
      const name=clean(summary.querySelector('span')?.textContent||summary.textContent);
      const level=clean(s.querySelector('.ability-level')?.textContent||'');
      return `<button type="button" id="character-tab-${group}-${i}" data-skill-target="${s.id}">${image?`<img src="${image.getAttribute('src')}" width="44" height="44" alt="" loading="lazy">`:`<span class="ts3-skill-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span>`}<span>${esc(name)}${level?`<small>${esc(level)}</small>`:''}</span></button>`;
    }).join('');
    parent.prepend(generated(d,`<div class="ts3-skill-selector" aria-label="${t.skills}" hidden>${buttons}</div>`));group++;
  }
}
function decorateSections(d) {
  for(const h of d.querySelectorAll('main h2')){
    const section=h.closest('section');if(section&&!section.classList.contains('ts3-character-stage'))section.classList.add('ts3-character-section');
  }
}
function characterIdentity(d,stage){
  const copy=stage.querySelector('.ts3-character-copy');
  if(!copy)return;
  let identity=copy.querySelector(':scope > .ts3-character-identity');
  if(!identity){identity=d.createElement('div');identity.className='ts3-character-identity';identity.setAttribute('data-characters-wrapper','');copy.prepend(identity);}
  // Reuse actual title and metadata nodes; mobile CSS can put them beside the original art.
  const kicker=copy.querySelector(':scope > .ts3-character-kicker');if(kicker)identity.prepend(kicker);
  for(const selector of ['.hero-title-row','h1','.ts-overline','.eyebrow'])for(const n of copy.querySelectorAll(':scope > '+selector))identity.append(n);
}
function prioritizeHeroFacts(d,stage) {
  // Original nodes, tables, conditions and affiliate links are kept. Lead with actionable data.
  const host=stage.parentElement;
  if(!host.matches('main,.container'))return;
  const sections=[...host.children].filter(n=>n.tagName==='SECTION'&&n!==stage&&!n.hasAttribute('data-characters-generated'));
  const score=n=>n.id==='star-rules-22'?0:n.querySelector('.stat-grid,.attribute-grid')?1:n.querySelector('.ts-skill')?2:n.querySelector('.equipment-grid,.equipment-card')?3:n.querySelector('.info-grid')?4:n.querySelector('.story-box')?9:5;
  const original=new Map(sections.map((s,i)=>[s,i]));
  sections.sort((a,b)=>score(a)-score(b)||original.get(a)-original.get(b));
  let anchor=stage;
  for(const section of sections){anchor.after(section);anchor=section;}
}
function enrichHero(lang,hero,roster){
  const route=hero.href.slice(1,-1),d=read(route),t=words[lang];prepare(d,'hero');
  const main=d.querySelector('main');
  const stage=main.querySelector('.hero,.ts-character-intro');
  if(!stage)throw Error('Missing hero stage '+route);
  stage.classList.add('ts3-character-stage');
  // Normalize the two legacy hero layouts without cloning or replacing their facts.
  const grid=stage.querySelector(':scope > .hero-grid')||stage;
  const media=grid.querySelector(':scope > .hero-media');
  let originalImage=media?.querySelector('img')||grid.querySelector(':scope > img')||grid.querySelector(':scope > .ts3-character-art > img');
  if(originalImage){
    if(!media&&!originalImage.parentElement.classList.contains('ts3-character-art')){const wrap=d.createElement('figure');wrap.className='ts3-character-art';wrap.setAttribute('data-characters-wrapper','');originalImage.before(wrap);wrap.append(originalImage);}
    else if(media)media.classList.add('ts3-character-art');
    originalImage.setAttribute('loading','eager');originalImage.setAttribute('fetchpriority','high');
  }
  for(const child of grid.children)if(!child.matches('.ts3-character-art,[data-characters-generated]'))child.classList.add('ts3-character-copy');
  const copy=grid.querySelector('.ts3-character-copy')||grid;
  copy.prepend(generated(d,`<p class="ts3-character-kicker"><a href="/${lang}/heroes/">${t.heroes}</a><span> / ${esc(hero.tags.filter((s,i,a)=>a.indexOf(s)===i).join(' · ')||hero.description)}</span></p>`));
  const jump=generated(d,`<nav class="ts3-character-actions" aria-label="${t.growth}"><a href="/${lang}/database/hero-star/">${t.star}<span aria-hidden="true">↗</span></a><a href="/${lang}/database/exclusive-gear/">${t.gear}<span aria-hidden="true">↗</span></a></nav>`);copy.append(jump);
  characterIdentity(d,stage);prioritizeHeroFacts(d,stage);skillPanels(d,t);decorateSections(d);sectionNav(d,stage,t,route);
  const siblings=roster.filter(h=>h.faction===hero.faction&&h.id!==hero.id);
  main.append(generated(d,`<section class="ts3-roster-neighbors" aria-label="${t.roster}"><div class="ts3-character-heading"><h2>${t.roster}</h2><a href="/${lang}/heroes/">${t.full} ↗</a></div><div class="ts3-neighbor-grid">${siblings.map(h=>`<a href="${h.href}"><img src="${h.image}" alt="" width="72" height="84" loading="lazy"><span><strong>${esc(h.name)}</strong><small>${esc(h.tags.join(' · '))}</small></span></a>`).join('')}</div></section>`));
  write(route,d);
}
function heroDirectory(lang,roster){
  const route=lang+'/heroes',d=read(route),t=words[lang];prepare(d,'hero-directory');
  d.documentElement.classList.add('ts3-directory');
  const hero=d.querySelector('main .hero-card');hero.classList.add('ts3-directory-intro');
  hero.append(generated(d,`<div class="ts3-directory-stats"><span><strong>${roster.length}</strong> ${t.heroes}</span><span><strong>${new Set(roster.map(h=>h.faction)).size}</strong> ${t.group}</span></div>`));
  for(const item of d.querySelectorAll('main .hero-item')){
    const anchor=item.matches('a[href]')?item:item.querySelector('a[href]');
    const id=anchor.getAttribute('href').split('/').filter(Boolean).pop().replace(/^tazan$/,'tarzan').replace(/^cnay$/,'candy');
    const profile=roster.find(h=>h.id===id);item.classList.add('ts3-roster-card');
    item.setAttribute('data-character-id',id);
    if(profile){item.setAttribute('data-character-faction',profile.faction);for(const a of item.querySelectorAll('a[href]'))a.setAttribute('href',profile.href);if(item.matches('a'))item.setAttribute('href',profile.href);}
  }
  // The original platform search/filter/sort continues to derive its options from visible metadata.
  d.querySelector('main').append(generated(d,`<p class="ts3-directory-empty" data-character-empty hidden>${t.empty}</p>`));write(route,d);
}
function petDirectory(lang){
  const route=lang+'/database/pet-system',d=read(route),t=words[lang];prepare(d,'pet-directory');d.documentElement.classList.add('ts3-directory');
  const stage=d.querySelector('main .hero-card');stage.classList.add('ts3-directory-intro');
  stage.append(generated(d,`<div class="ts3-directory-stats"><span><strong>7</strong> ${t.pets}</span><span>${t.compare}</span></div>`));
  const list=d.querySelector('.ts-pet-list');list.classList.add('ts3-pet-gallery');
  for(const row of list.children){row.classList.add('ts3-pet-tile');const img=row.querySelector(':scope > img');if(img){img.width=72;img.height=72;}const title=row.querySelector('h3'),link=row.querySelector('a[href]');if(title&&link&&!title.querySelector('a'))title.innerHTML=`<a href="${link.getAttribute('href')}">${esc(title.textContent)}</a>`;}
  const matrix=`<section class="ts3-character-section ts3-acquisition-matrix"><h2>${t.acquisition}</h2><div class="ts-table-wrap" role="region" tabindex="0" aria-label="${t.acquisition}"><table data-static><thead><tr><th scope="col">${t.pets}</th><th scope="col">${t.role}</th>${['rare','epic','legendary'].map(e=>`<th scope="col">${t[e]}</th>`).join('')}</tr></thead><tbody>${database.pets.map(p=>`<tr><th scope="row"><a href="/${lang}/database/pet-system/${p.id}/">${esc(lang==='ko'?p.ko:p.name)}</a></th><td>${t[p.role]}</td>${['rare','epic','legendary'].map(e=>`<td>${p.eggs[e]===null?'—':p.eggs[e]+'%'}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="ts3-source-caption"><a href="${database.sources.pets.url}">TilesMania · ${database.checked}</a></p></section>`;
  d.querySelector('#pet-directory').after(generated(d,matrix));
  decorateSections(d);sectionNav(d,stage,t,route);write(route,d);
}
function petDetail(lang,pet){
  const route=lang+'/database/pet-system/'+pet.id,d=read(route),t=words[lang];prepare(d,'pet');
  const main=d.querySelector('main'),title=main.querySelector('h1');
  title.textContent=lang==='ko'?pet.ko:pet.name;
  let stage=main.querySelector('.ts3-pet-stage,.ts-character-intro');
  if(pet.id==='starhorn'){
    stage.classList.add('ts3-character-stage','ts3-pet-stage');
    stage.querySelector(':scope > div')?.classList.add('ts3-character-copy');
    const img=stage.querySelector(':scope > img');
    // Keep the complete stat screenshot as evidence, and show the original pet portrait in the stage.
    if(img){const figure=d.createElement('figure');figure.className='ts3-pet-observation';figure.setAttribute('data-characters-wrapper','');img.before(figure);figure.append(img);}
  }else if(!stage?.classList.contains('ts3-pet-stage')){
    const wrap=d.createElement('section');wrap.className='ts3-character-stage ts3-pet-stage';wrap.setAttribute('data-characters-wrapper','');title.before(wrap);
    const copy=d.createElement('div');copy.className='ts3-character-copy';copy.setAttribute('data-characters-wrapper','');wrap.append(copy);copy.append(title);
    if(stage){const img=stage.querySelector('img');if(img){const figure=d.createElement('figure');figure.className='ts3-pet-portrait';figure.setAttribute('data-characters-wrapper','');wrap.append(figure);figure.append(img);}for(const n of [...stage.childNodes])copy.append(n);stage.remove();}
    stage=wrap;
  }
  const target=stage.querySelector('.ts3-character-copy')||stage;
  target.prepend(generated(d,`<p class="ts3-character-kicker"><a href="/${lang}/database/pet-system/">${t.pets}</a><span> / ${lang==='ko'?esc(pet.name)+' · ':''}${t[pet.role]}${pet.rarity?' · '+pet.rarity:''}</span></p>`));
  target.append(generated(d,`<nav class="ts3-character-actions" aria-label="${t.growth}"><a href="/${lang}/database/pet-system/#pet-data-22">${t.exp}<span aria-hidden="true">↗</span></a><a href="/${lang}/database/pet-system/#pet-growth">${t.training}<span aria-hidden="true">↗</span></a><a href="/${lang}/database/growth-materials/">${t.materials}<span aria-hidden="true">↗</span></a></nav>`));
  characterIdentity(d,stage);decorateSections(d);sectionNav(d,stage,t,route);
  main.append(generated(d,`<section class="ts3-roster-neighbors"><div class="ts3-character-heading"><h2>${t.petRoster}</h2><a href="/${lang}/database/pet-system/">${t.full} ↗</a></div><div class="ts3-neighbor-grid ts3-pet-neighbors">${pets.filter(p=>p.id!==pet.id).map(p=>`<a href="/${lang}/database/pet-system/${p.id}/"><img src="/img/pets/${p.id}.webp" width="64" height="64" alt="" loading="lazy"><span><strong>${esc(lang==='ko'?p.ko:p.name)}</strong><small>${t[p.role]}</small></span></a>`).join('')}</div></section>`));write(route,d);
}
for(const lang of languages){const roster=readRoster(lang);if(roster.length!==27)throw Error(`${lang}: expected 27 heroes, got ${roster.length}`);for(const hero of roster)enrichHero(lang,hero,roster);heroDirectory(lang,roster);petDirectory(lang);for(const pet of pets)petDetail(lang,pet);}
console.log('3.0 characters: 27 heroes + 7 pets and both directories × 5 languages; existing game data retained.');
