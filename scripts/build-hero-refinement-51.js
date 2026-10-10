'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{parseHTML}=require('linkedom');
const D=require('../data/hero-refinement-51.json'),root=path.resolve(__dirname,'..');
const langs=['ko','en','ja','ru','zh-tw','de'];
const copy={
 ko:{title:'전용 장비 강화 재료',condition:'게임 2.6.200 · 각 목표 레벨에 도달할 때 필요한 조각 수입니다. 최초 활성화와 Lv.1 이후 강화를 구분합니다. 실제 사용 가능한 레벨은 장비 해금 상태에 따라 다릅니다.',material:'강화 재료',activation:'최초 활성화 → Lv.1',upgrade:'Lv.1 → Lv.15',allTotal:'활성화 포함 Lv.15까지',all:'레벨별 소모량',transition:'단계',quantity:'필요 조각',cumulative:'활성화 포함 누적',hero:'영웅',gear:'전용 장비',other:'다른 영웅의 강화 재료',unit:'개'},
 en:{title:'Exclusive gear upgrade materials',condition:'Game 2.6.200 · Fragments required to reach each destination level. Initial activation is separate from upgrades after Lv.1. Available levels depend on gear unlock progress.',material:'Upgrade material',activation:'Initial activation → Lv.1',upgrade:'Lv.1 → Lv.15',allTotal:'Through Lv.15, including activation',all:'Cost by level',transition:'Step',quantity:'Fragments required',cumulative:'Total including activation',hero:'Hero',gear:'Exclusive gear',other:'Upgrade materials for other heroes',unit:'fragments'},
 ja:{title:'専用装備の強化素材',condition:'ゲーム2.6.200。各目標レベルに到達するために必要な欠片数です。初回の有効化とLv.1以降の強化を分けて表示します。使用できるレベルは装備の解放状況によって異なります。',material:'強化素材',activation:'初回有効化 → Lv.1',upgrade:'Lv.1 → Lv.15',allTotal:'有効化を含むLv.15まで',all:'レベル別の消費量',transition:'段階',quantity:'必要な欠片',cumulative:'有効化を含む累計',hero:'ヒーロー',gear:'専用装備',other:'ほかのヒーローの強化素材',unit:'個'},
 ru:{title:'Материалы улучшения особого снаряжения',condition:'Версия 2.6.200. Фрагменты, необходимые для достижения каждого целевого уровня. Первая активация указана отдельно от улучшений после ур.1. Доступные уровни зависят от прогресса разблокировки снаряжения.',material:'Материал улучшения',activation:'Первая активация → ур.1',upgrade:'Ур.1 → ур.15',allTotal:'До ур.15, включая активацию',all:'Стоимость по уровням',transition:'Этап',quantity:'Нужно фрагментов',cumulative:'Всего с активацией',hero:'Герой',gear:'Особое снаряжение',other:'Материалы для других героев',unit:'фрагм.'},
 'zh-tw':{title:'專屬裝備強化材料',condition:'遊戲2.6.200。各目標等級所需的碎片數；首次啟用與Lv.1之後的強化分開顯示。可使用的等級依裝備解鎖進度而定。',material:'強化材料',activation:'首次啟用 → Lv.1',upgrade:'Lv.1 → Lv.15',allTotal:'升至Lv.15（含啟用）',all:'各等級消耗',transition:'階段',quantity:'所需碎片',cumulative:'累計（含啟用）',hero:'英雄',gear:'專屬裝備',other:'其他英雄的強化材料',unit:'個'},
 de:{title:'Materialien für exklusive Ausrüstung',condition:'Spielversion 2.6.200 · Benötigte Fragmente zum Erreichen der jeweiligen Zielstufe. Die erste Aktivierung wird getrennt von Aufwertungen nach Stufe 1 angezeigt. Verfügbare Stufen hängen von der Freischaltung der Ausrüstung ab.',material:'Aufwertungsmaterial',activation:'Erste Aktivierung → St.1',upgrade:'St.1 → St.15',allTotal:'Bis St.15 einschließlich Aktivierung',all:'Kosten nach Stufe',transition:'Schritt',quantity:'Benötigte Fragmente',cumulative:'Summe einschließlich Aktivierung',hero:'Held',gear:'Exklusive Ausrüstung',other:'Aufwertungsmaterialien anderer Helden',unit:'Fragmente'}
};
const legacyCopy={
 ko:{calculator:'이 계산기는 Lv.1→15 합계 360개인 비용표를 사용합니다. v2.6.200의 390개 표와 다르므로 적용 비용을 확인하세요.',table:'이 강화표는 Lv.1→15 합계 360개인 비용표입니다. v2.6.200의 영웅별 표는 390개로 별도 표시합니다.',link:'v2.6.200 영웅별 강화 재료'},
 en:{calculator:'This calculator uses a cost table totaling 360 fragments from Lv.1 to Lv.15. The v2.6.200 table totals 390; check which costs apply.',table:'This table totals 360 fragments from Lv.1 to Lv.15. The v2.6.200 hero-specific table totals 390 and is shown separately.',link:'v2.6.200 materials by hero'},
 ja:{calculator:'この計算機はLv.1→15の合計が360個の費用表を使用します。v2.6.200の表は390個のため、適用される費用を確認してください。',table:'この強化表はLv.1→15の合計が360個です。v2.6.200のヒーロー別の表は390個で、別に表示します。',link:'v2.6.200のヒーロー別強化素材'},
 ru:{calculator:'Калькулятор использует таблицу с итогом 360 фрагментов с ур.1 до ур.15. В таблице v2.6.200 итог равен 390; проверьте применимые затраты.',table:'В этой таблице итог с ур.1 до ур.15 составляет 360 фрагментов. Таблица v2.6.200 по героям с итогом 390 приведена отдельно.',link:'Материалы по героям в v2.6.200'},
 'zh-tw':{calculator:'此計算器使用Lv.1→15合計360個碎片的費用表。v2.6.200的表為390個，請確認適用的費用。',table:'此強化表的Lv.1→15合計為360個碎片。v2.6.200的英雄專屬表合計390個，另行列出。',link:'v2.6.200各英雄的強化材料'},
 de:{calculator:'Dieser Rechner verwendet eine Kostentabelle mit insgesamt 360 Fragmenten von St.1 bis St.15. Die Tabelle für v2.6.200 ergibt 390; prüfe die für dich geltenden Kosten.',table:'Diese Tabelle ergibt von St.1 bis St.15 insgesamt 360 Fragmente. Die Tabelle für v2.6.200 mit 390 Fragmenten wird nach Helden getrennt aufgeführt.',link:'Materialien nach Held in v2.6.200'}
};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const route=(lang,id)=>`/${lang}/heroes/${['en','de'].includes(lang)&&id==='tarzan'?'tazan':id}/`;
const wrap=(label,table)=>`<div class="ts-table-wrap" role="region" tabindex="0" aria-label="${esc(label)}">${table}</div>`;
function validate(model=D){
 assert.equal(model.gameVersion,'2.6.200');assert.equal(model.costBasis,'destination-level');assert.equal(model.gears.length,19);assert.equal(new Set(model.gears.map(g=>g.id)).size,19);
 for(const select of [g=>g.heroId,g=>g.gearId,g=>g.material.id])assert.equal(new Set(model.gears.map(select)).size,19);
 for(const g of model.gears){assert(Number.isSafeInteger(g.heroId)&&Number.isSafeInteger(g.gearId)&&Number.isSafeInteger(g.material.id));assert.equal(g.costs.length,15);
  for(const l of langs)for(const v of [g.name,g.gearName,g.material.name])assert(typeof v[l]==='string'&&v[l].length&&!/\{\d+\}/.test(v[l]));
  g.costs.forEach((c,i)=>{assert.equal(c.fromLevel,i);assert.equal(c.toLevel,i+1);assert(Number.isSafeInteger(c.quantity)&&c.quantity>0);});
 }return true;
}
function totals(gear){return{activation:gear.costs[0].quantity,upgrade:gear.costs.slice(1).reduce((sum,r)=>sum+r.quantity,0),all:gear.costs.reduce((sum,r)=>sum+r.quantity,0)};}
function render(lang,gear=null){const t=copy[lang];assert(t);const n=v=>v.toLocaleString(lang==='zh-tw'?'zh-TW':lang);
 if(gear){const total=totals(gear);let sum=0;
 return `<section id="gear-costs-51" data-hero-refinement-51="costs" data-search-entry><h3>${esc(t.title)}</h3><p>${esc(gear.gearName[lang])} · <strong>${esc(t.material)}: ${esc(gear.material.name[lang])}</strong></p><p>${esc(t.condition)}</p>${wrap(t.title,`<table data-gear-cost-summary-51><thead><tr><th scope="col">${esc(t.transition)}</th><th scope="col">${esc(t.quantity)}</th></tr></thead><tbody><tr><th scope="row">${esc(t.activation)}</th><td>${n(total.activation)}</td></tr><tr><th scope="row">${esc(t.upgrade)}</th><td>${n(total.upgrade)}</td></tr><tr><th scope="row">${esc(t.allTotal)}</th><td>${n(total.all)}</td></tr></tbody></table>`)}<details><summary>${esc(t.all)}</summary>${wrap(t.all,`<table data-gear-cost-levels-51><thead><tr><th scope="col">${esc(t.transition)}</th><th scope="col">${esc(t.quantity)}</th><th scope="col">${esc(t.cumulative)}</th></tr></thead><tbody>${gear.costs.map(c=>{sum+=c.quantity;return `<tr data-from-level="${c.fromLevel}" data-to-level="${c.toLevel}"><th scope="row">${c.fromLevel===0?esc(t.activation):`Lv.${c.fromLevel} → Lv.${c.toLevel}`}</th><td>${n(c.quantity)}</td><td>${n(sum)}</td></tr>`;}).join('')}</tbody></table>`)}</details><p><a href="/${lang}/database/exclusive-gear/#gear-materials-51">${esc(t.other)}</a></p></section>`;
 }
 return `<section id="gear-materials-51" data-hero-refinement-51="materials" data-search-entry><h2>${esc(t.title)}</h2><p>${esc(t.condition)}</p>${wrap(t.title,`<table data-gear-materials-51><thead><tr><th scope="col">${esc(t.hero)}</th><th scope="col">${esc(t.material)}</th><th scope="col">${esc(t.activation)}</th><th scope="col">${esc(t.upgrade)}</th></tr></thead><tbody>${D.gears.map(g=>{const total=totals(g);return `<tr><th scope="row"><a href="${route(lang,g.id)}#gear-costs-51">${esc(g.name[lang])}</a></th><td>${esc(g.material.name[lang])}</td><td>${n(total.activation)}</td><td>${n(total.upgrade)}</td></tr>`;}).join('')}</tbody></table>`)}</section>`;
}
function build(){validate();let pages=0,changed=0;
 for(const lang of langs)for(const gear of [...D.gears,null]){
  const rel=gear?route(lang,gear.id).slice(1)+'index.html':`${lang}/database/exclusive-gear/index.html`,file=path.join(root,rel);assert(fs.existsSync(file),'Missing existing route '+rel);
  const before=fs.readFileSync(file,'utf8'),d=parseHTML(before).document;d.querySelectorAll('[data-hero-refinement-51]').forEach(n=>n.remove());const baseline=d.documentElement.outerHTML;
  const section=gear?(d.querySelector('.equipment-grid')?.closest('section')||d.querySelector('[data-hero-observations-40="equipment"]')?.closest('section')||d.querySelector('#sea-exclusive-gear-levels')?.parentElement):(d.querySelector('.ts-database-22')||d.querySelector('main'));assert(section,'Missing gear host '+rel);
  const template=d.createElement('template');template.innerHTML=render(lang,gear);section.append(template.content);
  if(!gear){
   const form=d.querySelector('form[data-growth-form="exclusive"]');assert(form,'Missing preserved exclusive-gear calculator '+rel);
   const legacyTable=d.querySelector('#tableTitle')?.closest('section');assert(legacyTable,'Missing preserved cost table '+rel);
   for(const [kind,host] of [['calculator',form],['table',legacyTable.querySelector('.table-wrap')]]){assert(host);const note=d.createElement('p');note.setAttribute('data-hero-refinement-51','legacy-'+kind);note.innerHTML=esc(legacyCopy[lang][kind])+` <a href="#gear-materials-51">${esc(legacyCopy[lang].link)}</a>`;host.before(note);}
  }
  const after='<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n',check=parseHTML(after).document;check.querySelectorAll('[data-hero-refinement-51]').forEach(n=>n.remove());assert.equal(check.documentElement.outerHTML,baseline,'Unexpected non-owned change '+rel);
  if(after!==before){fs.writeFileSync(file,after);changed++;}pages++;
 }
 const result={builder:'hero-refinement-51',heroes:19,costRows:285,activationRows:19,upgradeTransitions:266,languages:6,pages,changed};console.log(JSON.stringify(result));return result;
}
module.exports={build,render,route,validate,totals,copy,legacyCopy,langs};if(require.main===module)build();
