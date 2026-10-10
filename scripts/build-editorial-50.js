/* Late editorial pass: existing public models only. Run after German generation. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const {langs,L,copy:C,guides}=require('../data/product-50/editorial-copy');
const {events,seasons}=require('../data/product-50/editorial-events');
const daily=require('../data/foundation-40/daily-missions.json');
const explorer=require('../data/foundation-40/explorer.json');
const explorerCopy=require('../data/foundation-40/explorer-copy');
const heroRules=require('../data/foundation-40/arms-race-hero-rules-41.json');
const petTraining=require('../data/foundation-40/pet-training-profiles-41.json');
const root=path.resolve(__dirname,'..'),marker='data-editorial-50';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text=(v,lang)=>{assert.equal(typeof v[lang],'string',`Missing ${lang}`);assert(v[lang].trim());return esc(v[lang]);};
const deDaily=['Einmal täglich anmelden','Eine Erkundungstruhe abholen','Ein kostenloses VIP-Paket abholen','3 Aufklärungsaufgaben abschließen','10 verwundete Soldaten heilen','Ein Gebäude ausbauen','Eine Technologie erforschen','15 Allianzspenden leisten','Einmal einen Helden rekrutieren','50 Soldaten ausbilden','Ein Beschleunigungsitem einsetzen','5 Timer-Hilfen leisten','Einen infizierten Boss besiegen','Einen Spieler in der Arena herausfordern','Einen Kauf tätigen','Einen fremden Entsendungsauftrag überfallen','Einen Doomsday-Express-Auftrag plündern','Insgesamt 120 Minuten Beschleunigung einsetzen'];
const deHero=['1 legendäres Heldenfragment einsetzen','1 episches Heldenfragment einsetzen','1 seltenes Heldenfragment einsetzen','1 Heldenfähigkeiten-Handbuch für ein Fertigkeitsupgrade einsetzen','1 Diamanten durch einen Paketkauf erhalten'];
const deItems={'hero-skill-book':'Heldenfähigkeiten-Handbuch','arms-medal':'Rüstungswettlauf-Medaille','food-10k':'10.000 Nahrung','wood-10k':'10.000 Holz','metal-10k':'10.000 Metall','speedup-5m':'5-Minuten-Beschleuniger'};
const section=(id,title,body)=>`<section class="ts40-panel" id="${id}" data-search-entry="" data-search-title="${esc(title)}"><h2>${esc(title)}</h2>${body}</section>`;
const href=(lang,route)=>`/${lang}/${route}`;
const docCache=new Map();
function routeLabel(lang,route){
 if(['guides/','events/','seasons/'].includes(route))return C[route.slice(0,-1)][lang];
 const guide=guides.find(g=>route===`guides/${g.id}/`);if(guide)return guide.title[lang];
 const [r,anchor]=route.split('#'),key=lang+'/'+r;
 if(!docCache.has(key)){const f=path.join(root,key,'index.html');docCache.set(key,fs.existsSync(f)?parseHTML(fs.readFileSync(f,'utf8')).document:null);}
 const d=docCache.get(key),target=anchor&&d?.getElementById(anchor);
 return target?.querySelector('summary,h2,h3')?.textContent.trim()||d?.querySelector('h1')?.textContent.trim()||r;
}
function links(lang,routes){return `<nav class="ts40-links" aria-label="${text(C.tools,lang)}">${routes.map(r=>`<a href="${href(lang,r)}">${esc(routeLabel(lang,r))}</a>`).join('')}</nav>`;}
function table(lang,headers,rows){return `<div class="ts40-scroll"><table class="ts40-table"><thead><tr>${headers.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>'<tr>'+r.map(x=>`<td>${x}</td>`).join('')+'</tr>').join('')}</tbody></table></div>`;}
function validate(){
 assert.equal(guides.length,10);assert.equal(new Set(guides.map(g=>g.id)).size,10);
 for(const g of guides){assert(/^[a-z][a-z0-9-]+$/.test(g.id));for(const l of langs){for(const k of ['category','title','goal','applies','fact','example'])text(g[k],l);assert.equal(g.steps.length,3);g.steps.forEach(s=>text(s,l));}assert(g.links.length>=3);}
 assert.equal(events.length,9);assert(events.every(e=>['recurring','published','preview','seasonal'].includes(e.kind)));
 assert.equal(daily.missions.length,18);assert.deepEqual(daily.milestones,[25,60,100,140,180,235,290]);
 assert.deepEqual(heroRules.rules.map(r=>r.points),[9000,1000,150,857,60]);
 assert.equal(petTraining.pets.find(p=>p.id==='dodo').trainingRows.filter(r=>r.from>=2).reduce((a,r)=>a+r.cost,0),1700);
 assert.equal(explorer.event.conditions.competitionBracketMin,30);assert.equal(explorer.event.conditions.competitionBracketMax,30);
 assert.deepEqual(explorer.event.stages.map(s=>s.points),[50000,150000,300000]);
 assert.equal(explorer.event.troopPoints.length,10);assert.equal(explorer.event.pointsPerSpeedupMinute,42);
}
function evidenceTables(lang){
 const dailyRows=daily.missions.map((m,i)=>[`<span id="daily-task-${m.id}" data-search-entry="" data-search-title="${esc(lang==='de'?deDaily[i]:m.names[lang])}">${esc(lang==='de'?deDaily[i]:m.names[lang])}</span>`,String(m.points)]);
 const heroRows=heroRules.rules.map((r,i)=>[esc(lang==='de'?deHero[i]:r.action[lang]),String(r.points)]);
 const condition=L('경쟁 레벨 30~30 · 영웅 강화 · 2026-10-10 표시 기준','Competition Lv.30–30 · Hero development · displayed 2026-10-10','競争Lv.30～30・英雄強化・2026-10-10表示','Уровень 30–30 · усиление героев · показано 2026-10-10','競賽等級30～30・英雄強化・2026-10-10顯示','Wettbewerbslevel 30–30 · Heldenentwicklung · Anzeige vom 10.10.2026');
 const trainingCondition=L('경쟁 레벨 30~30 · 병사 육성 · 2026-10-09 표시 기준. 아래는 단계별 보상이며 자동 누적 합계가 아닙니다.','Competition Lv.30–30 · Troop training · displayed 2026-10-09. Rewards below are per tier, not cumulative totals.','競争Lv.30～30・兵士育成・2026-10-09表示。報酬は段階別で、累計ではありません。','Уровень 30–30 · обучение войск · показано 2026-10-09. Награды за этап, не накопительные итоги.','競賽等級30～30・士兵培育・2026-10-09顯示。以下為各階獎勵，不是累計總量。','Wettbewerbslevel 30–30 · Truppenausbildung · Anzeige vom 09.10.2026. Belohnungen gelten je Stufe, nicht als Gesamtsumme.');
 const rewards=explorer.event.stages.flatMap(s=>s.rewards.map(r=>[String(s.points),`<a href="/${lang}/database/items/#${r.item}">${esc(lang==='de'?deItems[r.item]:explorerCopy[lang][r.item])}</a>`,String(r.quantity)]));
 const trainingTitle=L('병사 육성 · 점수와 보상 연결','Troop training · points and rewards','兵士育成・ポイントと報酬','Обучение войск: очки и награды','士兵培育・積分與獎勵','Truppenausbildung · Punkte und Belohnungen');
 const tier=L('병사 티어','Troop tier','兵士ティア','Уровень войск','士兵階級','Truppenrang');
 const per=L('1명 훈련 점수','Points per troop trained','兵士1人の訓練ポイント','Очки за одного обученного','每訓練1名的積分','Punkte je ausgebildetem Soldaten');
 const speed=L('가속 1분은 42점입니다. 승급은 목표 티어와 현재 티어의 점수 차이로 계산합니다.','One speedup minute gives 42 points. Promotion uses the target-minus-current tier point difference.','加速1分は42ポイント。昇格は目標と現在のティアの差で計算します。','Минута ускорения даёт 42 очка. Повышение — разница очков целевого и текущего уровня.','加速每分鐘42分，晉升依目標與目前階級的積分差計算。','Eine Beschleunigungsminute gibt 42 Punkte. Beförderungen zählen die Punktedifferenz zwischen Ziel- und Ausgangsrang.');
 return section('daily-task-points',events[0].names[lang],`<p>${esc(events[0].text[lang])}</p>${table(lang,[C.rule[lang],C.points[lang]],dailyRows)}${links(lang,['events/daily-missions/','guides/daily-progress-plan/'])}`)+
 section('hero-phase-points',guides.find(g=>g.id==='event-score-plan').title[lang],`<p class="ts40-context">${text(condition,lang)}</p>${table(lang,[C.rule[lang],C.points[lang]],heroRows)}${links(lang,['events/arms-race/#hero-growth-points-heading','guides/event-score-plan/'])}`)+
 section('training-reward-links',trainingTitle[lang],`<p class="ts40-context">${text(trainingCondition,lang)}</p>${table(lang,[tier[lang],per[lang]],explorer.event.troopPoints.map((p,i)=>['T'+(i+1),String(p)]))}<p>${text(speed,lang)}</p>${table(lang,[C.points[lang],C.reward[lang],C.quantity[lang]],rewards)}${links(lang,['events/arms-race/','database/items/'])}`);
}
function eventArchive(lang){return `<div ${marker}="events" id="event-archive-50"><h2>${text(C.events,lang)}</h2><p>${text(C.eventsIntro,lang)}</p><p class="ts40-context">${text(C.archiveNote,lang)}</p><nav class="ts3-contents" aria-label="${text(C.contents,lang)}">${events.map(e=>`<a href="#archive-${e.id}">${text(e.names,lang)}</a>`).join('')}</nav>${events.map(e=>`<article class="ts40-panel" id="archive-${e.id}" data-search-entry="" data-search-title="${text(e.names,lang)}"><span class="eyebrow">${text(C[e.kind],lang)}</span><h3>${text(e.names,lang)}</h3><p>${text(e.text,lang)}</p>${links(lang,[...(e.route?[e.route]:[]),...e.links])}${e.source?`<p class="ts40-source"><a href="${e.source}">${text(C.source,lang)} · Tiles Survive</a></p>`:''}</article>`).join('')}${evidenceTables(lang)}</div>`;}
function seasonArchive(lang){return `<div ${marker}="seasons" id="season-planning-50"><h2>${text(C.seasons,lang)}</h2><p>${text(C.seasonsIntro,lang)}</p><p class="ts40-context">${text(C.seasonalScope,lang)}</p>${seasons.map(s=>`<article class="ts40-panel" id="season-scope-${s.number}" data-search-entry="" data-search-title="${text(s.name,lang)}"><h3>${text(s.name,lang)}</h3><p>${text(s.description,lang)}</p>${links(lang,[s.route,'guides/season-preparation/','events/#archive-season-conflicts'])}${s.source?`<p><a href="${s.source}">v2.5.900 · Tiles Survive</a></p>`:''}</article>`).join('')}</div>`;}
function guideBody(g,lang){return `<nav class="breadcrumb"><a href="/${lang}/">${text(C.home,lang)}</a><span>/</span><a href="/${lang}/guides/">${text(C.back,lang)}</a></nav><article ${marker}="guide" id="guide-${g.id}"><header class="hero-card"><span class="eyebrow">${text(g.category,lang)}</span><h1>${text(g.title,lang)}</h1><p>${text(g.goal,lang)}</p></header><nav class="ts3-contents" aria-label="${text(C.contents,lang)}">${['applies','facts','steps','example','tools'].map(k=>`<a href="/${lang}/guides/${g.id}/#guide-${k}">${text(C[k],lang)}</a>`).join('')}</nav>${section('guide-applies',C.applies[lang],`<p>${text(g.applies,lang)}</p>`)}${section('guide-facts',C.facts[lang],`<p>${text(g.fact,lang)}</p>${links(lang,g.links)}`)}${section('guide-steps',C.steps[lang],`<ol>${g.steps.map(s=>`<li>${text(s,lang)}</li>`).join('')}</ol>`)}${section('guide-example',C.example[lang],`<p>${text(g.example,lang)}</p>`)}${section('guide-tools',C.tools[lang],links(lang,g.links))}</article>`;}
function guideHub(d,lang){
 const cards=[...d.querySelectorAll('main .guide-card')];assert(cards.length>=5,'Missing existing guide cards');
 const benefit=[],other=[];
 for(const card of cards){const url=card.querySelector('a[href]')?.getAttribute('href')||'';(url.includes('discount-topup')?benefit:other).push(card.outerHTML);}
 assert.equal(benefit.length,2,'Top-up guides must be preserved');
 return `<nav class="breadcrumb"><a href="/${lang}/">${text(C.home,lang)}</a><span>/</span><span>${text(C.guides,lang)}</span></nav><section class="hero-card"><h1 id="guideTitle">${text(C.guides,lang)}</h1><p>${text(C.guidesIntro,lang)}</p></section><nav class="ts3-contents" aria-label="${text(C.contents,lang)}">${guides.map(g=>`<a href="#topic-${g.id}">${text(g.category,lang)}</a>`).join('')}<a href="#topup-benefits">${text(C.benefits,lang)}</a></nav><section ${marker}="guides" aria-labelledby="guideListTitle"><h2 id="guideListTitle">${text(C.goal,lang)}</h2><div class="card-grid">${guides.map(g=>`<article class="content-card" id="topic-${g.id}" data-search-entry="" data-search-title="${text(g.title,lang)}"><span class="eyebrow">${text(g.category,lang)}</span><h3><a href="/${lang}/guides/${g.id}/">${text(g.title,lang)}</a></h3><p>${text(g.goal,lang)}</p><a class="btn" href="/${lang}/guides/${g.id}/">${text(C.read,lang)} →</a></article>`).join('')}</div></section><section class="home-section section-card" data-editorial-50-legacy="guides"><h2>${text(C.related,lang)}</h2><div class="guide-grid">${other.join('')}</div></section><section class="home-section section-card" id="topup-benefits" data-editorial-50-legacy="benefits"><h2>${text(C.benefits,lang)}</h2><p>${text(C.benefitsNote,lang)}</p><div class="guide-grid">${benefit.join('')}</div>${links(lang,['top-up/'])}</section>`;
}
function ensureCSS(d){for(const p of ['/css/hub-pages.css','/css/foundation-40.css?v=3'])if(![...d.querySelectorAll('link[rel="stylesheet"]')].some(n=>n.getAttribute('href')===p)){const n=d.createElement('link');n.rel='stylesheet';n.href=p;n.setAttribute('data-editorial-50-style','');d.head.append(n);}}
function refreshHubContents(d,lang,type){
 const main=d.querySelector('main'),headings=[...main.querySelectorAll('h2')];
 for(const [i,h] of headings.entries())if(!h.id){let id=`ts50-${type}-heading-${i+1}`,suffix=2;while(d.getElementById(id))id=`ts50-${type}-heading-${i+1}-${suffix++}`;h.id=id;}
 for(const nav of main.querySelectorAll('nav.ts3-contents[data-product-30]')){
  nav.querySelectorAll('a').forEach(a=>a.remove());
  for(const h of headings){const a=d.createElement('a');a.href=`/${lang}/${type}/#${h.id}`;a.textContent=h.textContent.trim();nav.append(a);}
 }
 for(const a of main.querySelectorAll('nav.ts3-contents a[href]'))if(a.getAttribute('href').startsWith('#'))a.href=`/${lang}/${type}/${a.getAttribute('href')}`;
}
function metadata(d,lang,route,title,description){
 for(const a of d.querySelectorAll('a.ts-skip,a[href$="#main"]'))if(a.classList.contains('ts-skip')||/^(?:\/|#)/.test(a.getAttribute('href')||''))a.setAttribute('href',`/${lang}/${route}#main`);
 d.documentElement.lang=lang;d.documentElement.setAttribute('data-lang',lang);d.documentElement.setAttribute('data-section',route.split('/')[0]);
 d.querySelector('title').textContent=title+' | TilesSurvive.net';d.querySelector('meta[name="description"]')?.setAttribute('content',description);
 d.querySelector('link[rel="canonical"]')?.setAttribute('href','https://tilessurvive.net/'+lang+'/'+route);
 for(const key of ['og:title','twitter:title'])d.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.setAttribute('content',title);
 for(const key of ['og:description','twitter:description'])d.querySelector(`meta[property="${key}"],meta[name="${key}"]`)?.setAttribute('content',description);
 d.querySelector('meta[property="og:url"]')?.setAttribute('content','https://tilessurvive.net/'+lang+'/'+route);
 d.querySelectorAll('link[rel="alternate"][hreflang]').forEach(n=>n.remove());
 for(const l of [...langs,'x-default']){const n=d.createElement('link');n.rel='alternate';n.hreflang=l;n.href='https://tilessurvive.net/'+(l==='x-default'?'en':l)+'/'+route;d.head.append(n);}
 d.querySelectorAll('script[type="application/ld+json"]').forEach(n=>{let j;try{j=JSON.parse(n.textContent)}catch{return}if(j['@type']==='WebPage'||j['@type']==='Article')n.remove();});
 const n=d.createElement('script');n.type='application/ld+json';n.setAttribute(marker,'schema');n.textContent=JSON.stringify({'@context':'https://schema.org','@type':route.startsWith('guides/')&&route!=='guides/'?'Article':'WebPage',name:title,description,inLanguage:lang,url:'https://tilessurvive.net/'+lang+'/'+route});d.head.append(n);
}
function applyHub(html,lang,type){
 const d=parseHTML(html).document,main=d.querySelector('main');assert(main);
 d.querySelectorAll(`[${marker}="events"],[${marker}="seasons"]`).forEach(n=>n.remove());
 if(type==='guides')main.innerHTML=guideHub(d,lang);
 else{const node=d.createElement('template');node.innerHTML=type==='events'?eventArchive(lang):seasonArchive(lang);const hero=main.querySelector('.hero-card,.page-hero,.hero,.page-header');if(hero)hero.after(node.content);else main.prepend(node.content);}
 refreshHubContents(d,lang,type);
 ensureCSS(d);metadata(d,lang,type+'/',C[type][lang],C[type+'Intro'][lang]);
 return '<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
}
function build(){validate();let changed=0;const written=[],deferred=[];const save=(file,html)=>{if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==html){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,html);changed++;}written.push(path.relative(root,file).replaceAll('\\','/'));};
 for(const lang of langs){const templateFile=path.join(root,lang,'events/index.html');if(!fs.existsSync(templateFile)){deferred.push(lang);continue;}
  const template=fs.readFileSync(templateFile,'utf8');
  for(const g of guides){const d=parseHTML(template).document;d.querySelector('main').innerHTML=guideBody(g,lang);ensureCSS(d);metadata(d,lang,`guides/${g.id}/`,g.title[lang],g.goal[lang]);save(path.join(root,lang,'guides',g.id,'index.html'),'<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n');}
  for(const type of ['guides','events','seasons']){const file=path.join(root,lang,type,'index.html');assert(fs.existsSync(file),`Missing inherited ${type} hub: ${lang}`);save(file,applyHub(fs.readFileSync(file,'utf8'),lang,type));}
 }
 return {changed,outputPaths:written,deferredLanguages:deferred,guides:guides.length,archiveEntries:events.length,seasonRoutes:seasons.length};
}
module.exports={build,validate,applyHub,guideBody,events,guides,langs};
if(require.main===module)console.log(JSON.stringify(build()));
