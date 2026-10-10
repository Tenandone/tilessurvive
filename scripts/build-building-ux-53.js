'use strict';
// Coverage is derived from the same published detail rows and client profiles.
// Catalogs never embed upgrade tables or calculator payloads.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),art=require('../data/building-assets-51.json'),costs=require('../data/client-buildings-52.json'),effects=require('../data/building-refinement-51.json');
const copy={
ko:{detail:'상세 정보',sheet:'업그레이드 시트 바로가기',title:'업그레이드 시트',known:'확인된 성장 범위',cost:'비용·시간·선행 조건',effect:'레벨별 효과',unknown:'성장 수치 미확인',notice:'현재 확인된 레벨별 효과를 제공합니다. 레벨별 자원·시간·선행 조건의 전체 자료가 없어 누적 비용은 계산하지 않습니다.',missing:'레벨별 자원·시간·선행 조건과 성장 수치는 아직 확인되지 않았습니다. 게임의 건물 화면에서 확인하세요.',level:'레벨 선택',scroll:'표를 좌우로 스크롤하면 모든 열을 확인할 수 있습니다.',back:'건물 전체 목록'},
en:{detail:'Details',sheet:'Go to upgrade sheet',title:'Upgrade sheet',known:'Confirmed growth range',cost:'Costs, time and prerequisites',effect:'Level effects',unknown:'Growth values unconfirmed',notice:'Confirmed level effects are shown here. Complete resource costs, times and prerequisites are unavailable, so cumulative costs cannot be calculated.',missing:'Resource costs, time, prerequisites and growth values by level are not yet confirmed. Check the building screen in your game.',level:'Choose level',scroll:'Scroll horizontally to see all columns.',back:'All buildings'},
ja:{detail:'詳細情報',sheet:'強化シートへ',title:'強化シート',known:'確認済みの成長範囲',cost:'費用・時間・前提条件',effect:'レベル別効果',unknown:'成長数値は未確認',notice:'確認済みのレベル別効果を掲載しています。資源・時間・前提条件の全データがないため、累計費用は計算できません。',missing:'レベル別の資源・時間・前提条件と成長数値は未確認です。ゲーム内の建物画面で確認してください。',level:'レベルを選択',scroll:'横にスクロールするとすべての列を確認できます。',back:'建物一覧'},
ru:{detail:'Подробности',sheet:'К таблице улучшений',title:'Таблица улучшений',known:'Подтверждённый диапазон',cost:'Стоимость, время и требования',effect:'Эффекты уровней',unknown:'Рост не подтверждён',notice:'Здесь показаны подтверждённые эффекты уровней. Полные данные о ресурсах, времени и требованиях отсутствуют, поэтому суммарная стоимость не рассчитывается.',missing:'Ресурсы, время, требования и рост по уровням ещё не подтверждены. Проверьте экран здания в игре.',level:'Выберите уровень',scroll:'Прокрутите таблицу по горизонтали, чтобы увидеть все столбцы.',back:'Все здания'},
'zh-tw':{detail:'詳細資訊',sheet:'前往升級表',title:'升級表',known:'已確認成長範圍',cost:'費用、時間與前置條件',effect:'各級效果',unknown:'成長數值尚未確認',notice:'此處提供已確認的各級效果。各級資源、時間與前置條件的完整資料尚未確認，因此無法計算累計費用。',missing:'各級資源、時間、前置條件與成長數值尚未確認，請查看遊戲內建築畫面。',level:'選擇等級',scroll:'左右捲動表格可查看所有欄位。',back:'所有建築'},
de:{detail:'Details',sheet:'Zur Ausbautabelle',title:'Ausbautabelle',known:'Bestätigter Stufenbereich',cost:'Kosten, Zeit und Voraussetzungen',effect:'Stufeneffekte',unknown:'Wachstumswerte unbestätigt',notice:'Hier stehen bestätigte Stufeneffekte. Vollständige Ressourcen-, Zeit- und Voraussetzungstabellen fehlen, daher werden keine Gesamtkosten berechnet.',missing:'Ressourcen, Zeit, Voraussetzungen und Wachstumswerte je Stufe sind noch nicht bestätigt. Prüfe die Gebäudeansicht im Spiel.',level:'Stufe wählen',scroll:'Scrolle seitlich, um alle Spalten zu sehen.',back:'Alle Gebäude'}
};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function coverage(slug,d){
 const expanded=d.querySelector('[data-building-growth-60]');
 if(expanded){const b=require('../data/content-60/buildings.json').buildings.find(x=>x.slug===slug);if(!b)throw Error('Unknown expanded building '+slug);return {kind:'cost',range:`Lv.${b.minLevel}–${b.maxLevel}`};}
 const client=costs.buildings.filter(b=>b.slug===slug),effect=effects.profiles.find(p=>p.slug===slug);
 let levels=client.flatMap(b=>b.profiles.flatMap(p=>p.levels.map(r=>r.level)));
 if(!levels.length&&effect)levels=effect.levels.map(r=>r.level);
 if(!levels.length&&!['lab'].includes(slug)){const table=d.getElementById('ts3-data-table-0');if(table)levels=[...table.querySelectorAll('tbody tr')].map(r=>Number(r.children[0].getAttribute('data-ts-original-value')||r.children[0].textContent.trim())).filter(Number.isFinite);}
 return {kind:client.length?'cost':levels.length?'effect':'unknown',range:levels.length?`Lv.${Math.min(...levels)}–${Math.max(...levels)}`:''};
}
function asset(d,file,detail){
 d.querySelectorAll('[data-building-ux-53-asset]').forEach(n=>n.remove());
 for(const asset of ['css/building-ux-53.css',...(detail?['js/building-ux-53.js']:[])]){const n=d.createElement(asset.endsWith('.css')?'link':'script');n.setAttribute('data-building-ux-53-asset','');const url='/'+asset+'?v='+crypto.createHash('sha256').update(fs.readFileSync(path.join(root,asset))).digest('hex').slice(0,12);if(n.tagName==='LINK'){n.rel='stylesheet';n.href=url;}else{n.src=url;n.defer=true;}d.head.append(n);}
 d.documentElement.setAttribute('data-building-ux-53',detail?'detail':'catalog');
}
function detail(html,lang,slug){const d=parseHTML(html).document,t=copy[lang],c=coverage(slug,d);
 // Keep the independently scoped profile/rank sheet when the legacy UX build is rerun.
 if(d.querySelector('[data-building-growth-60]'))return {html:require('./build-building-growth-60').project(html,`${lang}/buildings/${slug}/index.html`),coverage:c};
 for(const n of d.querySelectorAll('[data-building-ux-53-anchor]')){n.removeAttribute('id');n.removeAttribute('tabindex');n.removeAttribute('data-building-ux-53-anchor');}
 d.querySelectorAll('[data-building-ux-53-generated]').forEach(n=>n.remove());
 d.querySelectorAll('[data-building-table-53]').forEach(n=>n.removeAttribute('data-building-table-53'));
 d.querySelectorAll('[data-building-upgrade-sheet]').forEach(n=>n.removeAttribute('data-building-upgrade-sheet'));
 let table=d.querySelector('[data-client-cost-table]')||d.querySelector('[data-building-refinement-51] table')||d.getElementById('ts3-data-table-0');
 let target=c.kind==='cost'?table?.closest('[data-client-building-52]')?.parentElement.closest('section'):c.kind==='effect'?table?.closest('section'):null;
 if(!target){target=d.createElement('section');target.className='section';target.setAttribute('data-building-ux-53-generated','');const hero=d.querySelector('main .hero');hero?hero.after(target):d.querySelector('main').append(target);}
 target.setAttribute('data-building-upgrade-sheet','');
 const intro=d.createElement('div');intro.setAttribute('data-building-ux-53-generated','');intro.className='building-sheet-intro-53';
 intro.innerHTML=`${c.kind==='cost'?'':`<h2 id="upgrade-sheet" tabindex="-1">${esc(t.title)}</h2>`}<p class="building-range-53">${esc(t.known)} · ${esc(c.range?c.range+' · '+t[c.kind]:t.unknown)}</p>${c.kind==='cost'?'':`<p>${esc(c.kind==='unknown'?t.missing:t.notice)}</p>`}`;
 if(c.kind==='cost'){const heading=target.querySelector('h2');heading.id='upgrade-sheet';heading.setAttribute('tabindex','-1');heading.setAttribute('data-building-ux-53-anchor','');}
 target.prepend(intro);
 const nav=d.createElement('nav');nav.className='building-detail-nav-53';nav.setAttribute('data-building-ux-53-generated','');nav.setAttribute('aria-label',t.detail);nav.innerHTML=`<a href="/${lang}/buildings/">← ${esc(t.back)}</a><a href="#upgrade-sheet">${esc(t.sheet)}</a>`;
 const hero=d.querySelector('main .hero');if(hero)hero.after(nav);
 for(const wrap of d.querySelectorAll('main .ts-table-wrap')){const table=wrap.querySelector('table');if(!table||!table.querySelector('tbody tr')||table.closest('.ts3-table-duplicate,[data-growth-research-50]'))continue;wrap.setAttribute('data-building-table-53','');const note=d.createElement('p');note.className='building-scroll-note-53';note.setAttribute('data-building-ux-53-generated','');note.textContent=t.scroll;wrap.before(note);}
 d.documentElement.setAttribute('data-building-level-label-53',t.level);asset(d,'',true);return {html:'<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n',coverage:c};
}
function catalog(html,lang,entries){const d=parseHTML(html).document,t=copy[lang];
 for(const card of d.querySelectorAll('.building-card')){const body=card.querySelector('.building-body'),link=body.querySelector('.building-link'),href=link.getAttribute('href'),slug=href.split('/').filter(Boolean).at(-1),c=entries[slug];if(!c)throw Error('Missing detail coverage '+slug);
 body.append(link);body.querySelectorAll('.ts3-catalog-data,[data-building-ux-53-generated]').forEach(n=>n.remove());
 link.textContent=t.detail;const range=d.createElement('p');range.className='building-range-53';range.setAttribute('data-building-ux-53-generated','');range.textContent=t.known+' · '+(c.range?c.range+' · '+t[c.kind]:t.unknown);body.insertBefore(range,link);
 const actions=d.createElement('div');actions.className='building-card-actions-53';actions.setAttribute('data-building-ux-53-generated','');link.before(actions);actions.append(link);const shortcut=d.createElement('a');shortcut.href=href+'#upgrade-sheet';shortcut.textContent=t.sheet;shortcut.className='building-sheet-link-53';actions.append(shortcut);
 }
 asset(d,'',false);return ('<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n').replace(/[ \t]+$/gm,'');
}
function build(){let changed=0;for(const lang of art.languages){const entries={};for(const a of art.assets){const file=path.join(root,lang,'buildings',a.slug,'index.html'),before=fs.readFileSync(file,'utf8'),result=detail(before,lang,a.slug);entries[a.slug]=result.coverage;if(before!==result.html){fs.writeFileSync(file,result.html);changed++;}}
 const file=path.join(root,lang,'buildings/index.html'),before=fs.readFileSync(file,'utf8'),after=catalog(before,lang,entries);if(before!==after){fs.writeFileSync(file,after);changed++;}}
 console.log(JSON.stringify({buildingUX:'5.3',pages:84,changed}));return changed;
}
module.exports={build,coverage,detail,catalog,copy};if(require.main===module)build();
