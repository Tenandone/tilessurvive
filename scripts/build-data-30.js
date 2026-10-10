/* Preserve source HTML and arithmetic; build a static, progressively enhanced data workspace. */
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const {copy,catalogCopy,numeric}=require('../js/data-workbench-30');
const math=require('../js/platform-math');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw'];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const walk=p=>fs.existsSync(p)?fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]):[];
function element(d,s){const n=d.createElement('template');n.innerHTML=s;return n.content;}
let pages=0,tables=0,planners=0,growthForms=0;
for(const lang of langs){
 const t=copy[lang],catalog=catalogCopy[lang];
 const files=['buildings','database','behemoths','tools','event-helper','events','seasons'].flatMap(section=>walk(path.join(root,lang,section))).filter(f=>f.endsWith('index.html')&&!/[\\/]pet-system[\\/][^\\/]+[\\/]index.html$/.test(f));
 for(const file of files){
  const d=parseHTML(fs.readFileSync(file,'utf8')).document,main=d.querySelector('main');if(!main)continue;
  const route='/'+path.relative(root,file).replaceAll('\\','/').replace(/index\.html$/,'');
  // Repeated builds retain source sections and regenerate only this enhancement's nodes.
  d.querySelectorAll('[data-ui30-generated]').forEach(n=>n.remove());
  for(const host of [...d.querySelectorAll('.ts3-data-workbench')]){const wrap=host.querySelector('.ts-table-wrap');if(wrap)host.replaceWith(wrap);}
  for(const asset of d.querySelectorAll('[data-data30-asset]'))asset.remove();
  const dataVersion=/\/buildings\/(power-plant|barracks)\/$/.test(route)?2:1;
  d.head.append(element(d,`<link data-data30-asset rel="stylesheet" href="/css/data-workbench-30.css?v=1"><script data-data30-asset src="/js/data-workbench-30.js?v=${dataVersion}" defer></script>`));
  main.classList.add('ts3-data-page');
  const catalogType=route==='/'+lang+'/buildings/'?'buildings':route==='/'+lang+'/behemoths/'?'behemoths':route==='/'+lang+'/tools/'?'tools':null;
  if(catalogType){
   const cardSelector=catalogType==='buildings'?'.building-card':catalogType==='behemoths'?'.behemoth-card':'.tool-card.is-linked';
   if(catalogType==='tools'){
    // These two formerly disabled cards now have real, published calculators.
    const pending=[...main.querySelectorAll('.tool-card-disabled')];
    const available=main.querySelector('.tool-grid');
    const upgrades=[{index:3,route:'database/gear-exp',image:'/img/database/legend-gear-star-guide.webp'},{index:5,route:'database/skill-book',image:'/img/database/skill-book-guide.webp'}];
    for(const item of upgrades){
     if(main.querySelector(`[data-catalog-promoted="${item.route}"]`)||pending.length!==7)continue;
     const card=pending[item.index];if(!card||!available||!fs.existsSync(path.join(root,lang,item.route,'index.html')))continue;
     // The seven-card legacy template and a real calculator are both required.
     const target=parseHTML(fs.readFileSync(path.join(root,lang,item.route,'index.html'),'utf8')).document;
     if(!target.querySelector('[data-growth-form]'))continue;
     card.classList.remove('tool-card-disabled');card.classList.add('is-linked');card.removeAttribute('aria-disabled');card.dataset.catalogPromoted=item.route;
     const title=card.querySelector('h3').textContent;card.querySelector('.tool-placeholder')?.replaceWith(element(d,`<a class="tool-thumb" href="/${lang}/${item.route}/"><img src="${item.image}" alt="${esc(title)}" loading="lazy" width="160" height="160"></a>`));
     card.querySelector('.tool-pill')?.remove();card.querySelector('.tool-body').append(element(d,`<a class="tool-link" href="/${lang}/${item.route}/">${catalog.calculate}</a>`));available.append(card);
    }
    for(const item of upgrades){
     if(!available)continue;
     const href='/'+lang+'/'+item.route+'/',existing=[...main.querySelectorAll('.tool-card.is-linked')].find(card=>[...card.querySelectorAll('a')].some(a=>a.getAttribute('href').split('#')[0]===href));
     if(existing){available.append(existing);continue;}
     const targetPath=path.join(root,lang,item.route,'index.html');if(!fs.existsSync(targetPath))continue;
     const target=parseHTML(fs.readFileSync(targetPath,'utf8')).document;if(!target.querySelector('[data-growth-form]'))continue;
     const title=target.querySelector('h1').textContent;
     available.append(element(d,`<article class="tool-card is-linked" data-catalog-promoted="${item.route}"><a class="tool-thumb" href="${href}"><img src="${item.image}" alt="${esc(title)}" loading="lazy" width="160" height="160"></a><div class="tool-body"><h3>${esc(title)}</h3><p>${t.current} → ${t.target} · ${t.held} · ${t.shortage}</p><a class="tool-link" href="${href}">${catalog.calculate}</a></div></article>`));
    }
    const intro=main.querySelector('.hero-card>p');if(intro)intro.textContent=catalog.tools;
    const heroNote=main.querySelector('.hero-note');if(heroNote)heroNote.textContent=t.live;
    // Retired roadmap tiles contain no operating tool, game fact or destination.
    const roadmap=main.querySelector('#comingToolsTitle')?.closest('section');
    if(roadmap&&roadmap.querySelector('.tool-card-disabled')&&!roadmap.querySelector('a[href],table,[data-growth-form]'))roadmap.remove();
    const obsoleteQuestion={ko:'아직 준비 중인 카드도 사용할 수 있나요',en:'Can I use the coming soon cards?',ja:'準備中カードは使えますか',ru:'Можно ли использовать карточки в разработке','zh-tw':'準備中的卡片可以使用嗎'}[lang];
    for(const detail of main.querySelectorAll('.tool-faq details'))if(detail.querySelector('summary')?.textContent.trim()===obsoleteQuestion)detail.remove();
    for(const script of d.querySelectorAll('script[type="application/ld+json"]')){
     try{const json=JSON.parse(script.textContent);if(json['@type']==='FAQPage'&&Array.isArray(json.mainEntity)){json.mainEntity=json.mainEntity.filter(entry=>entry.name!==obsoleteQuestion);script.textContent=JSON.stringify(json);}}catch{}
    }
    const repeated=main.querySelector('#eventCtaTitle')?.closest('section'),promo=repeated?.querySelector('.tool-cta[href]');
    if(promo){const href=promo.getAttribute('href'),description=promo.querySelector('span')?.textContent.trim();const duplicate=[...main.querySelectorAll('.tool-card.is-linked')].some(card=>[...card.querySelectorAll('a[href]')].some(a=>a.getAttribute('href').split('#')[0]===href)&&[...card.querySelectorAll('p')].some(p=>p.textContent.trim()===description));if(duplicate&&!repeated.querySelector('[data-affiliate-campaign],table'))repeated.remove();}
   }
   const entries=[...main.querySelectorAll(cardSelector)];
   const tags=new Set();
   for(const entry of entries){
    entry.setAttribute('data-catalog-entry','');entry.classList.add('ts3-catalog-entry');entry.parentElement.classList.add('ts3-data-catalog');
    const meta=[...entry.querySelectorAll('.chip')].map(n=>n.textContent.trim());entry.dataset.catalogTags=JSON.stringify(meta);meta.forEach(n=>tags.add(n));
    const href=entry.querySelector('a[href]')?.getAttribute('href');
    if(href?.startsWith('/'+lang+'/')&&!href.includes('#')){
     const targetPath=path.join(root,href,'index.html');
     if(fs.existsSync(targetPath)){
      const target=parseHTML(fs.readFileSync(targetPath,'utf8')).document,table=[...target.querySelectorAll('main table')].find(t=>t.querySelector('tbody tr')),calc=target.querySelector('[data-growth-form]');
      if(table){const rows=table.querySelectorAll('tbody tr').length,anchor=table.id||'ts3-data-table-0';entry.querySelector('.building-body,.behemoth-body,.tool-body')?.append(element(d,`<p class="ts3-catalog-data" data-ui30-generated><a href="${href}#${anchor}">${catalog.data}</a><span>${rows} ${catalog.rows}</span></p>`));}
      if(calc&&catalogType==='tools'){const a=entry.querySelector('.tool-link');if(a){a.href=href+'#'+(calc.id||'ts3-growth-0');a.textContent=catalog.calculate;}}
     }
    }
   }
   if(entries.length>=5){
    const first=entries[0].closest('section');first.before(element(d,`<form data-ui30-generated data-catalog-controls class="ts3-catalog-controls" hidden><label>${catalog.search}<input type="search" autocomplete="off"></label><label>${catalog.category}<select data-catalog-category><option value="">${catalog.all}</option>${[...tags].map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label><label>${t.sort}<select data-catalog-sort><option value="">${t.original}</option><option value="name">${catalog.name}</option></select></label><button type="button" data-catalog-reset>${t.reset}</button><p role="status"></p></form>`));
   }
   if(catalogType==='buildings'){const intro=main.querySelector('.hero-card>p'),note=main.querySelector('#building-list .section-head>p');if(intro)intro.textContent=catalog.buildings;if(note)note.textContent=catalog.list;}
  }
  if(route.endsWith('/buildings/lab/')){
   main.querySelectorAll('.priority-box,.info-grid').forEach(n=>n.classList.add('ts3-research-list'));
   const wording={
    ko:{scope:'자료 범위',summary:'연구 효과·우선순위',heading:'연구 비용과 조건',notice:'이 페이지는 연구 효과와 우선순위를 다룹니다. 연구 노드별 비용·선행 조건의 전체 표는 제공하지 않으므로 게임 내 연구 화면을 함께 확인하세요.',values:'효과와 전투력은 각 항목에 표시된 레벨·조건을 기준으로 합니다.',rules:'v2.6.200의 연구 화면은 가속·보너스 적용 전 원래 시간을 표시합니다. 연구소 건물 비용과 연구 자체 비용은 구분합니다. 연구 노드별 비용·최대 레벨·선행 트리의 전체 표는 이 페이지에서 제공하지 않습니다.'},
    en:{scope:'Data coverage',summary:'Research effects and priorities',heading:'Research costs and requirements',notice:'This page covers research effects and priorities. A complete table of node costs and prerequisites is not provided; check the in-game research screen for those requirements.',values:'Effects and power correspond to the level and conditions stated for each entry.',rules:'The v2.6.200 research screen shows original time before speedups and bonuses. Lab building costs and individual research costs are separate. A complete table of research-node costs, maximum levels and prerequisite trees is not provided here.'},
    ja:{scope:'掲載範囲',summary:'研究効果・優先順位',heading:'研究費用と条件',notice:'このページでは研究効果と優先順位を紹介しています。研究ノードごとの費用・前提条件の完全な表は掲載していないため、ゲーム内の研究画面も確認してください。',values:'効果と戦闘力は、各項目に記載したレベル・条件に対応しています。',rules:'v2.6.200の研究画面には、加速・ボーナス適用前の本来の時間が表示されます。研究所の建築費用と個々の研究費用は別です。研究ノードごとの費用・最大レベル・前提ツリーの完全な表は、このページには掲載していません。'},
    ru:{scope:'Содержание данных',summary:'Эффекты и приоритеты исследований',heading:'Стоимость и требования исследований',notice:'Здесь приведены эффекты и приоритеты исследований. Полной таблицы стоимости узлов и предварительных условий нет; эти требования следует проверять на экране исследований в игре.',values:'Эффекты и сила соответствуют уровню и условиям, указанным для каждого пункта.',rules:'Экран исследований v2.6.200 показывает исходное время без ускорений и бонусов. Стоимость здания лаборатории и отдельных исследований различается. Полная таблица стоимости узлов, максимальных уровней и дерева требований здесь не приводится.'},
    'zh-tw':{scope:'資料範圍',summary:'研究效果與優先順序',heading:'研究費用與條件',notice:'本頁介紹研究效果與優先順序，未提供各研究節點費用及前置條件的完整表格，請同時查看遊戲內的研究畫面。',values:'效果與戰鬥力以各項標示的等級及條件為準。',rules:'v2.6.200的研究畫面顯示加速與加成套用前的原始時間。研究所建築費用與個別研究費用須分開看待。本頁未提供各研究節點費用、最高等級與前置樹的完整表格。'}
   }[lang];
   const scope=main.querySelectorAll('.hero-summary-card')[1];if(scope){const label=scope.querySelector('.k'),value=scope.querySelector('.v');if(label)label.textContent=wording.scope;if(value)value.textContent=wording.summary;}
   const notice=main.querySelector('.notice-box');if(notice){notice.textContent=wording.notice;const heading=notice.closest('section')?.querySelector('h2');if(heading)heading.textContent=wording.heading;}
   const reference=main.querySelector('.info-grid')?.closest('section')?.querySelector('.section-head>p');if(reference)reference.textContent=wording.values;
   const rule=main.querySelector('#rules-22>p:not(.ts-source-note)');if(rule)rule.textContent=wording.rules;
  }
  if(route.includes('/database/skill-book/')){
   const warning={ko:'29→30레벨은 이 사이트의 685권과 TilesGuide의 735권이 다릅니다. 계산기는 기존 685권을 사용합니다. 레벨별 값과 출처 차이를 함께 확인하세요.',en:'Level 29→30 differs between this site (685 books) and TilesGuide (735). The calculator uses the existing 685. Check the level costs and source note together.',ja:'29→30レベルは本サイトの685冊とTilesGuideの735冊で異なります。計算機は従来の685冊を使用します。レベル別の値と出典の注記を確認してください。',ru:'Для уровня 29→30 указано 685 книг на этом сайте и 735 у TilesGuide. Калькулятор использует прежнее значение 685. Сверяйте стоимость и примечание об источнике.','zh-tw':'29→30級在本站為685本，TilesGuide為735本。計算器沿用685本。請一併參考各級費用與來源說明。'};
   const note=d.querySelector('[data-data-warning]');if(note)note.textContent=warning[lang];
  }
  let tableIndex=0;
  for(const table of main.querySelectorAll('table')){
   const clientBuilding=table.closest('[data-client-building-52]');if(clientBuilding){tableIndex=Math.max(tableIndex,Number(clientBuilding.getAttribute('data-client-building-52'))+1);continue;}
   const heads=[...table.querySelectorAll('thead tr:first-child th')],rows=[...table.querySelectorAll('tbody tr')];
   if(!heads.length||!rows.length)continue;
   table.setAttribute('data-workbench','');table.removeAttribute('data-explore');if(!table.id||table.id.startsWith('ts3-data-table-'))table.id='ts3-data-table-'+tableIndex;
   table.classList.add('ts3-data-table');
   heads.forEach(h=>h.setAttribute('scope','col'));
   const rectangular=rows.every(r=>r.children.length===heads.length&&!r.querySelector('[rowspan],[colspan]'));
   if(rectangular)for(let col=1;col<heads.length;col++){
    const vals=rows.map(r=>r.children[col].textContent.trim()).filter(s=>s&&!/^[-—–]$/.test(s));
    if(vals.length&&vals.filter(s=>numeric(s)!==null).length/vals.length>=.8){heads[col].classList.add('ts3-numeric');rows.forEach(r=>r.children[col].classList.add('ts3-numeric'));}
    else if(vals.length&&vals.filter(s=>math.minutes(s)!==null).length/vals.length>=.8){heads[col].dataset.valueType='time';heads[col].classList.add('ts3-numeric');rows.forEach(r=>r.children[col].classList.add('ts3-numeric'));}
   }
   let wrap=table.parentElement;
   if(!wrap.classList.contains('ts-table-wrap')){wrap=d.createElement('div');wrap.className='ts-table-wrap';table.before(wrap);wrap.append(table);}
   wrap.classList.add('ts3-table-scroll');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',wrap.getAttribute('aria-label')||t.all);
   table.closest('.desktop-only')?.classList.add('ts3-table-visible');
   const host=d.createElement('div');host.className='ts3-data-workbench';wrap.before(host);host.append(wrap);
   const title=table.closest('section')?.querySelector('h2,h3')?.textContent.trim()||d.querySelector('h1')?.textContent.trim()||t.all;
   if(rectangular&&(rows.length>=8||(heads.length>=5&&rows.length>=4))){
    const id='ts3-table-controls-'+tableIndex;
    const options=rows.map((r,i)=>`<option value="${i}">${esc(r.children[0].textContent.trim())}</option>`).join('');
    const order=heads.map((h,i)=>`<option value="${i}:asc">${esc(h.textContent.trim())} ↑</option><option value="${i}:desc">${esc(h.textContent.trim())} ↓</option>`).join('');
    host.prepend(element(d,`<div class="ts3-table-controls" id="${id}" hidden><label>${t.row}<select data-row-select aria-controls="${table.id}">${options}</select></label><label>${t.filter}<input type="search" data-table-query aria-controls="${table.id}" autocomplete="off"></label><label>${t.sort}<select data-sort aria-controls="${table.id}"><option value="">${t.original}</option>${order}</select></label><button type="button" data-table-reset>${t.reset}</button></div><p class="ts3-table-status" role="status"></p><details class="ts3-selection" hidden><summary data-selected-title>${t.selected}</summary><dl></dl><button type="button" data-locate-row>${t.show}</button></details>`));
   }
   host.append(element(d,`<p class="ts3-table-note">${heads.length>3?t.scroll:''}${/[\d.]\s*[KMB]\b/i.test(table.textContent)?' '+t.units:''}</p>`));
   const timeColumn=route.includes('/buildings/power-plant/')&&heads.length===8?6:route.includes('/buildings/barracks/')&&heads.length===7?1:-1;
   if(timeColumn>=0&&rectangular&&rows.every(r=>/^\d+$/.test(r.children[0].textContent.trim()))){
    const desktop=table.closest('.desktop-table');
    if(desktop){
     desktop.classList.add('ts3-table-visible');
     const mobile=desktop.nextElementSibling;
     if(mobile?.classList.contains('mobile-card-list'))mobile.classList.add('ts3-table-duplicate');
    }
    const levels=rows.map(r=>Number(r.children[0].textContent));
    const opt=selected=>levels.map(n=>`<option value="${n}"${n===selected?' selected':''}>${n}</option>`).join('');
    const complete=rows.findIndex((r,i)=>i>0&&[2,3,4,5].every(c=>math.amount(r.children[c].textContent)!==null)&&math.minutes(r.children[timeColumn].textContent)!==null);
    const target=levels[complete>=1?complete:Math.min(1,levels.length-1)],start=levels[Math.max(0,levels.indexOf(target)-1)];
    host.before(element(d,`<form data-ui30-generated data-building-planner data-table="${table.id}" data-time-column="${timeColumn}" class="ts3-building-planner" hidden><h3>${t.plan}</h3><p class="ts3-input-note" id="ts3-plan-note-${tableIndex}">${t.boundary}</p><div class="ts3-level-inputs"><label>${t.current}<select name="from" data-default="${start}" aria-describedby="ts3-plan-note-${tableIndex}">${opt(start)}</select></label><span aria-hidden="true">→</span><label>${t.target}<select name="to" data-default="${target}" aria-describedby="ts3-plan-note-${tableIndex}">${opt(target)}</select></label></div><details class="ts3-inventory"><summary>${t.held}</summary><div>${[2,3,4,5].map(col=>`<label>${esc(heads[col].textContent.trim())}<input name="held-${col}" type="number" inputmode="numeric" value="0" min="0" step="1"></label>`).join('')}</div></details><output aria-live="polite" aria-atomic="true"></output><div class="ts3-growth-actions"><button data-building-reset type="button">${t.reset}</button><span>${t.live}</span></div></form>`));planners++;
   }
   tables++;tableIndex++;
  }
  // Mobile source cards duplicate the full original tables; the tables now remain visible at every width.
  main.querySelectorAll('.mobile-upgrade-list,.mobile-skill-levels').forEach(n=>{if(n.closest('section')?.querySelector('[data-workbench]'))n.classList.add('ts3-table-duplicate');});
  for(const [index,form]of [...main.querySelectorAll('[data-growth-form]')].entries()){
   form.classList.add('ts3-growth-workbench');form.id=form.id||'ts3-growth-'+index;
   const cfg=JSON.parse(form.querySelector('script[type="application/json"]').textContent),table=form.nextElementSibling?.querySelector('table');
   form.querySelectorAll('input').forEach(n=>{n.setAttribute('inputmode','numeric');n.setAttribute('aria-describedby',form.id+'-note');});
   form.append(element(d,`<p data-ui30-generated class="ts3-input-note" id="${form.id}-note">${t.live}</p><div data-ui30-generated class="ts3-growth-actions"><button data-growth-reset type="button">${t.reset}</button></div>`));
   const out=form.querySelector('output');out.setAttribute('aria-atomic','true');out.setAttribute('aria-label',t.result);
   if(table){form.dataset.growthTable=table.id;const h=table.querySelectorAll('thead th');h[1]?.setAttribute('title',t.step);h[2]?.setAttribute('title',t.cumulative+' · '+cfg.rows[0].from);const n=d.createElement('p');n.setAttribute('data-ui30-generated','');n.className='ts3-table-context';n.textContent=t.step+' · '+t.cumulative+' '+cfg.rows[0].from;form.nextElementSibling.before(n);}
   growthForms++;
  }
  fs.writeFileSync(file,'<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n');pages++;
 }
}
console.log(`3.0 data workspace: ${pages} pages, ${tables} tables, ${planners} building planners, ${growthForms} growth calculators`);
