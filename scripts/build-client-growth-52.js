'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const model=require('../data/client-growth-52.json');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw','de'];
const source={url:'https://github.com/Tenandone/tilessurvive/blob/main/data/client-growth-52.json',version:'2.6.200',kind:'game-client-version-scoped'};
const copy={
 ko:{gear:'게임 2.6.200 · 일반 영웅 장비 Lv.1→80의 강화 경험치입니다. 누적값은 Lv.1부터 합산합니다.',behemoth:'게임 2.6.200 · 전설 그리핀·마린 드레이크의 성급별 6단계 세포 비용입니다. 획득부터 1성 완료까지의 전체 비용은 미확인입니다. 누적값은 1성 완료 후부터 합산합니다.',cumulative:'누적 · 1성 완료 후'},
 en:{gear:'Game 2.6.200 · Enhancement EXP for standard hero gear, Lv.1→80. Cumulative EXP starts at Lv.1.',behemoth:'Game 2.6.200 · Cell costs for the six stages of each star, for Legendary Griffin and Tidal Drake. The full cost from acquisition to a completed 1★ is unknown. Cumulative costs start after completing 1★.',cumulative:'Cumulative · after 1★'},
 ja:{gear:'ゲーム2.6.200。通常の英雄装備Lv.1→80の強化EXPです。累計はLv.1から集計しています。',behemoth:'ゲーム2.6.200。巨獣グリフォン・海洋亜竜の各星6段階に必要な細胞数です。獲得から1★完成までの総費用は未確認です。累計は1★完成後から集計しています。',cumulative:'累計・1★完成後'},
 ru:{gear:'Версия 2.6.200. Опыт улучшения обычного снаряжения героев, ур.1→80. Накопленный опыт считается с ур.1.',behemoth:'Версия 2.6.200. Расход клеток на шесть этапов каждой звезды для Легендарного грифона и Марин Дрейка. Полная стоимость от получения до завершённой 1★ неизвестна. Накопленный расход считается после завершения 1★.',cumulative:'Накоплено · после 1★'},
 'zh-tw':{gear:'遊戲2.6.200。一般英雄裝備Lv.1→80的強化經驗，累計從Lv.1開始加總。',behemoth:'遊戲2.6.200。橘光獅鷲獸與海洋亞龍每星6個階段所需的細胞數。從取得到完成1★的總費用尚未確認，累計從完成1★後開始加總。',cumulative:'累計・完成1★後'},
 de:{gear:'Spielversion 2.6.200. Verbesserungs-EP für gewöhnliche Heldenausrüstung, Stufe 1→80. Die Summe beginnt bei Stufe 1.',behemoth:'Spielversion 2.6.200. Zellkosten der sechs Stufen jedes Sterns für Legendären Greif und Gezeiten-Drachen. Die Gesamtkosten vom Erhalt bis zum abgeschlossenen 1★ sind unbekannt. Die Summe beginnt nach Abschluss von 1★.',cumulative:'Summe · nach 1★'}
};
for(const [lang,labels] of Object.entries({ko:['합계','미확인'],en:['Subtotal','Unknown'],ja:['合計','未確認'],ru:['Всего','Неизвестно'],'zh-tw':['合計','未確認'],de:['Zwischensumme','Unbekannt']}))Object.assign(copy[lang],{subtotal:labels[0],unknown:labels[1]});
function updateDatasets(database){
 const result=JSON.parse(JSON.stringify(database));
 result.sources.gear={...source};
 result.datasets.gear={...result.datasets.gear,source:'gear',unit:model.gear.unit,min:model.gear.min,max:model.gear.max,rows:JSON.parse(JSON.stringify(model.gear.rows))};
 return result;
}
const format=(n,lang)=>n===null?'—':n.toLocaleString(lang==='zh-tw'?'zh-TW':lang);
function setNumeric(cell,value,lang){cell.textContent=format(value,lang);if(value===null)cell.removeAttribute('data-ts-original-value');else cell.setAttribute('data-ts-original-value',String(value));}
function replaceStaleGearTotal(document){
 const replace=s=>s.replace(/1([, .\u00a0\u202f])585\1?500/g,(_m,sep)=>`1${sep}592${sep}200`);
 function walk(node){if(node.nodeType===3)node.textContent=replace(node.textContent);else if(!['SCRIPT','STYLE'].includes(node.tagName))for(const child of [...node.childNodes])walk(child);}
 walk(document.documentElement);
 for(const meta of document.querySelectorAll('meta[content]'))meta.setAttribute('content',replace(meta.getAttribute('content')));
 for(const script of document.querySelectorAll('script[type="application/ld+json"]'))script.textContent=replace(script.textContent);
}
function normalizeSource(document){for(const link of document.querySelectorAll('a[href]'))if(['https://www.tilesguide.com/guides/gear-scraps',source.url].includes(link.getAttribute('href'))){link.href=source.url;link.textContent='github.com · 2.6.200';}}
const pages=langs.flatMap(lang=>['database/gear-exp','database/growth-materials','database/behemoth-cell',...model.behemoth.profiles.map(p=>'behemoths/'+p.slug)].map(slug=>`${lang}/${slug}/index.html`));
function project(html,file){
 const route=(path.isAbsolute(file)?path.relative(root,file):String(file)).replaceAll('\\','/');assert(pages.includes(route),'Unexpected growth route '+route);const lang=route.split('/')[0];
 if(route.includes('/database/growth-materials/')){const d=parseHTML(html).document;normalizeSource(d);return '<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';}
 else if(route.includes('/database/gear-exp/')){
  const d=parseHTML(html).document;
  const form=d.querySelector('form[data-growth-form="gear"]');assert(form,route);
  const cfg=form.querySelector('script[type="application/json"]');const config=JSON.parse(cfg.textContent);config.rows=JSON.parse(JSON.stringify(model.gear.rows));cfg.textContent=JSON.stringify(config).replaceAll('<','\\u003c');
  const table=[...d.querySelectorAll('table')].find(t=>t.querySelectorAll('tbody tr').length===79);assert(table,route);
  [...table.querySelectorAll('tbody tr')].forEach((row,i)=>{setNumeric(row.children[1],model.gear.rows[i].cost,lang);setNumeric(row.children[2],model.gear.rows[i].sourceTotal,lang);});
  let note=d.querySelector('[data-growth-exp-condition-50]');if(!note){note=d.createElement('p');note.setAttribute('data-growth-exp-condition-50','');form.before(note);}note.setAttribute('data-client-growth-52','gear-scope');note.textContent=copy[lang].gear;
  normalizeSource(d);
  replaceStaleGearTotal(d);
  return '<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
 }else{
   const doc=parseHTML(html).document;
   doc.querySelectorAll('[data-client-growth-52="behemoth-card-wrap"]').forEach(n=>n.remove());const style=doc.createElement('link');style.rel='stylesheet';style.setAttribute('data-client-growth-52','behemoth-card-wrap');style.href='/css/client-growth-52.css?v='+require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'css/client-growth-52.css'))).digest('hex').slice(0,12);doc.head.append(style);
   const tables=[...doc.querySelectorAll('table')].filter(t=>t.querySelectorAll('tbody tr').length===60&&t.querySelector('tbody tr').children.length===9);assert.equal(tables.length,1,route);const stars=tables[0];
   stars.setAttribute('data-client-growth-52','behemoth-stars');stars.setAttribute('data-game-version','2.6.200');
   const profile=model.behemoth.profiles.find(p=>route.endsWith('/'+p.slug+'/index.html'));stars.setAttribute('data-client-profile-52',profile?String(profile.id):model.behemoth.profiles.map(p=>p.id).join(','));
   [...stars.querySelectorAll('tbody tr')].forEach((row,i)=>{const values=[...model.behemoth.rows[i].steps,model.behemoth.rows[i].total,model.behemoth.rows[i].cumulativeFromCompleteOneStar];row.setAttribute('data-star-52',String(i+1));values.forEach((value,j)=>setNumeric(row.children[j+1],value,lang));});
   stars.querySelector('thead tr').lastElementChild.textContent=copy[lang].cumulative;
   const sort=[...doc.querySelectorAll('select[data-sort][aria-controls]')].find(n=>n.getAttribute('aria-controls')===stars.id);assert(sort,route+' star table sort');
   for(const [value,arrow] of [['8:asc','↑'],['8:desc','↓']]){const option=sort.querySelector(`option[value="${value}"]`);assert(option,route+' cumulative sort '+value);option.textContent=copy[lang].cumulative+' '+arrow;}
   const cards=[...doc.querySelectorAll('.star-card')];assert.equal(cards.length,60,route+' mobile cards');cards.forEach((card,i)=>{const row=model.behemoth.rows[i],cells=[...card.querySelectorAll('.star-card__item span')];assert.equal(cells.length,6);cells.forEach((cell,j)=>setNumeric(cell,row.steps[j],lang));card.querySelector('.star-card__total').textContent=`${copy[lang].subtotal} ${format(row.total,lang)} / ${copy[lang].cumulative}: ${format(row.cumulativeFromCompleteOneStar,lang)}`;card.setAttribute('data-client-growth-52','behemoth-card');});
   const writeSummary=(box,label,value)=>{assert(box);box.querySelector('strong').textContent=label;box.querySelector('span').textContent=value===null?copy[lang].unknown:format(value,lang);box.setAttribute('data-client-growth-52','behemoth-summary');};
   const summaries=[...doc.querySelectorAll('.summary-box')];assert.equal(summaries.length,3,route+' summaries');const star30=model.behemoth.rows.find(r=>r.star===30),star60=model.behemoth.rows.find(r=>r.star===60);assert(star30&&star60);
   if(route.includes('/database/behemoth-cell/')){const stats=[...doc.querySelectorAll('.quick-stat')];assert.equal(stats.length,4);writeSummary(stats[0],'1★ → 30★',star30.cumulativeFromCompleteOneStar);writeSummary(stats[1],'1★ → 60★',star60.cumulativeFromCompleteOneStar);writeSummary(stats[2],`1★ ${copy[lang].subtotal}`,null);writeSummary(stats[3],`60★ ${copy[lang].subtotal}`,star60.total);writeSummary(summaries[0],`1★ ${copy[lang].subtotal}`,null);writeSummary(summaries[1],'1★ → 30★',star30.cumulativeFromCompleteOneStar);writeSummary(summaries[2],'1★ → 60★',star60.cumulativeFromCompleteOneStar);}
   else{writeSummary(summaries[0],'1★ → 30★',star30.cumulativeFromCompleteOneStar);writeSummary(summaries[1],'1★ → 60★',star60.cumulativeFromCompleteOneStar);}
   doc.querySelectorAll('[data-client-growth-52="behemoth-scope"]').forEach(n=>n.remove());const scope=doc.createElement('p');scope.setAttribute('data-client-growth-52','behemoth-scope');scope.textContent=copy[lang].behemoth;(stars.closest('.wide-table-wrap')||stars.closest('.ts3-data-workbench')||stars.closest('.ts-table-wrap')).before(scope);
   return '<!DOCTYPE html>\n'+doc.documentElement.outerHTML+'\n';
 }
}
function build(){
 const database=JSON.parse(fs.readFileSync(path.join(root,'data/expansion-22/database.json'),'utf8'));
 assert.deepEqual(database.datasets.gear.rows,model.gear.rows,'Apply updateDatasets(database) before legacy generation');
 assert.deepEqual(database.sources.gear,source,'Canonical gear source must reference client 2.6.200');
 let changed=0;
 for(const route of pages){const file=path.join(root,route),before=fs.readFileSync(file,'utf8'),after=project(before,route);if(after!==before){fs.writeFileSync(file,after);changed++;}}
 const result={builder:'client-growth-52',version:model.gameVersion,pages:pages.length,changed,gearTransitions:79,gearChangedCosts:11,gearTotal:1592200,behemothRows:60,behemothChangedKnownStageCosts:269,behemothInitialCost:null,behemothCompleteOneToSixty:30410};console.log(JSON.stringify(result));return result;
}
module.exports={build,project,pages,updateDatasets,copy,source,model,langs,format};
if(require.main===module)build();
