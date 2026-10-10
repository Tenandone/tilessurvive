'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const D=require('../data/client-heroes-52.json'),root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw','de'];
const legacyCosts=[5,10,20,25,30,30,30,30,30,30,30,30,30,30];
const copy={
 ko:{band:'Lv.13~15 목표 단계: 각 40개',scope:'게임 2.6.200 · 아래 19종 전용 장비는 Lv.1→15 강화에 390개가 필요합니다. 최초 활성화 10개는 별도입니다.',legacyBand:'6레벨부터 15레벨까지 30 고정'},
 en:{band:'Reaching Lv.13–15: 40 fragments per level',scope:'Game 2.6.200 · The 19 exclusive gears listed below require 390 fragments from Lv.1 to Lv.15. Initial activation costs 10 additional fragments.',legacyBand:'Fixed at 30 from Lv.6 to Lv.15'},
 ja:{band:'Lv.13～15への強化：各40個',scope:'ゲーム2.6.200。下記19種類の専用装備はLv.1→15の強化に390個必要です。初回の有効化には別途10個必要です。',legacyBand:'Lv.6からLv.15までは30固定'},
 ru:{band:'Повышение до ур.13–15: по 40 фрагментов',scope:'Версия 2.6.200. Для 19 видов особого снаряжения ниже требуется 390 фрагментов с ур.1 до ур.15. Первая активация требует ещё 10 фрагментов.',legacyBand:'С 6 до 15 уровня стоимость фиксирована: 30'},
 'zh-tw':{band:'升至Lv.13～15：每級40個',scope:'遊戲2.6.200。下列19種專屬裝備從Lv.1升至Lv.15需要390個碎片；首次啟用另需10個。',legacyBand:'Lv.6 ～ Lv.15 固定 30'},
 de:{band:'Aufwertung auf St.13–15: je 40 Fragmente',scope:'Spielversion 2.6.200 · Die 19 unten aufgeführten exklusiven Ausrüstungen benötigen von St.1 bis St.15 insgesamt 390 Fragmente. Die erste Aktivierung kostet zusätzlich 10 Fragmente.',legacyBand:'Fix bei 30 von Lv.6 nach Lv.15'}
};
Object.assign(copy.ko,{skillScope:'게임 2.6.200 · 전투 스킬 Lv.1→40에 스킬북 23,555권이 필요하며, Lv.29→30 비용은 735권입니다.'});
Object.assign(copy.en,{skillScope:'Game 2.6.200 · Combat skills require 23,555 skill books from Lv.1 to Lv.40; Lv.29 to Lv.30 costs 735 books.'});
Object.assign(copy.ja,{skillScope:'ゲーム2.6.200。戦闘スキルのLv.1→40にはスキルブック23,555冊、Lv.29→30には735冊が必要です。'});
Object.assign(copy.ru,{skillScope:'Версия 2.6.200. Для боевых навыков с ур.1 до ур.40 нужно 23 555 книг навыков; с ур.29 до ур.30 — 735 книг.'});
Object.assign(copy['zh-tw'],{skillScope:'遊戲2.6.200。戰鬥技能從Lv.1升至Lv.40需要23,555本技能書，Lv.29→30需要735本。'});
Object.assign(copy.de,{skillScope:'Spielversion 2.6.200 · Kampffertigkeiten benötigen von St.1 bis St.40 insgesamt 23.555 Fähigkeiten-Handbücher; St.29 auf St.30 kostet 735 Bücher.'});
const pages=langs.flatMap(l=>[`${l}/database/exclusive-gear/index.html`,`${l}/database/skill-book/index.html`,...D.unlockDescriptions.map(u=>`${l}/heroes/${u.id}/index.html`)]);
function validate(model=D){assert.equal(model.costBasis,'destination-level');assert.equal(model.gameVersion,'2.6.200');assert.equal(model.gameBuild,1512);assert.equal(model.profiles.length,19);assert.equal(model.transitions.length,14);model.transitions.forEach((r,i)=>{assert.equal(r.from,i+1);assert.equal(r.to,i+2);assert(Number.isSafeInteger(r.cost)&&r.cost>0);});assert.equal(model.transitions.reduce((s,r)=>s+r.cost,0),390);assert.deepEqual(model.activation,{from:0,to:1,cost:10});for(const key of ['id','heroId','gearId','materialId'])assert.equal(new Set(model.profiles.map(p=>p[key])).size,19);for(const p of model.profiles)for(const key of ['heroId','gearId','materialId'])assert(Number.isSafeInteger(p[key]));assert.deepEqual(model.unlockDescriptions.map(u=>[u.id,u.level]),[['maddy',10],['mike',15]]);for(const u of model.unlockDescriptions){assert.deepEqual(Object.keys(u.descriptions),langs);for(const l of langs)assert(typeof u.descriptions[l]==='string'&&u.descriptions[l].length&&!/\{\d+\}/.test(u.descriptions[l]));}assert.equal(model.skillBook.itemId,201725);assert.equal(model.skillBook.costBasis,'destination-level');assert.equal(model.skillBook.rows.length,39);model.skillBook.rows.forEach((r,i)=>{assert.equal(r.from,i+1);assert.equal(r.to,i+2);assert(Number.isSafeInteger(r.cost)&&r.cost>0);});assert.equal(model.skillBook.rows.reduce((s,r)=>s+r.cost,0),23555);assert.equal(model.skillBook.rows[28].cost,735);return true;}
function updateDatasets(database){validate();const out=structuredClone(database),old=out.datasets.exclusive;assert(old&&old.rows.length===14);old.rows.forEach((r,i)=>{assert.equal(r.from,D.transitions[i].from);assert.equal(r.to,D.transitions[i].to);assert([legacyCosts[i],D.transitions[i].cost].includes(r.cost));});
 out.sources['client-exclusive-52']={url:'https://tilessurvive.net/data/client-heroes-52.json',version:'2.6.200 / 1512',kind:'client-configuration'};
 out.datasets.exclusive={...old,source:'client-exclusive-52',unit:'parts',min:1,max:15,rows:structuredClone(D.transitions)};
 const skill=out.datasets.skillBook;assert.equal(skill.rows.length,39);skill.rows.forEach((r,i)=>{assert.equal(r.from,D.skillBook.rows[i].from);assert.equal(r.to,D.skillBook.rows[i].to);assert(r.cost===D.skillBook.rows[i].cost||(r.to===30&&r.cost===685));});
 out.sources['client-skill-book-52']={url:'https://tilessurvive.net/data/client-heroes-52.json',version:'2.6.200 / 1512',kind:'client-configuration'};
 out.datasets.skillBook={...skill,source:'client-skill-book-52',rows:structuredClone(D.skillBook.rows)};delete out.datasets.skillBook.comparison;
 const resolution={'skill-book-30':{value:735,from:29,to:30,unit:'books',source:'client-skill-book-52'},'pet-exp-86':{value:11800,from:85,to:86,unit:'EXP',profile:'starhorn',source:'data/foundation-40/pet-exp-profiles.json'},'pet-training-5':{value:700,from:4,to:5,unit:'species-marks',source:'data/foundation-40/pet-training-profiles-41.json'},'pet-training-bonus-4':{value:85,stage:4,unit:'percent',source:'data/foundation-40/pet-training-profiles-41.json'}};
 out.conflicts=out.conflicts.map(c=>resolution[c.id]?{id:c.id,status:'resolved-client-2.6.200',...resolution[c.id]}:c);return out;
}
function transition(row){const nums=row.children[0].textContent.match(/\d+/g);assert(nums&&nums.length===2);return nums.map(Number);}
function setNumber(node,value){assert(node&&node.children.length===0);node.textContent=String(value);if(node.hasAttribute('data-ts-original-value'))node.setAttribute('data-ts-original-value',String(value));}
function sourceAnchors(d,kind){
 const url='https://tilessurvive.net/data/client-heroes-52.json',allowed=new Set([url,'https://github.com/Tenandone/tilessurvive/tree/ef10abdc2b2bbcd98b2f5574faa0683769f94024',...(kind==='skillBook'?['https://www.tilesguide.com/guides/hero-skill-manuals']:[])]);
 const details=d.querySelectorAll('details[data-content301-references]');assert.equal(details.length,1);const links=[...details[0].querySelectorAll('a[href]')];assert(links.length>=1&&links.length<=(kind==='skillBook'?3:2));assert.equal(new Set(links.map(a=>a.getAttribute('href'))).size,links.length);
 links.forEach((a,i)=>{assert(allowed.has(a.getAttribute('href')),'Unknown cost source URL');assert.equal(a.parentElement.tagName,'LI');assert.equal(a.parentElement.children.length,1);if(i)a.parentElement.remove();else{a.setAttribute('href',url);a.textContent='tilessurvive.net · 2.6.200 / 1512';}});
}
function project(html,file){validate();assert(pages.includes(file),'Unapproved hero client-data route '+file);const lang=file.split('/')[0],d=parseHTML(html).document;
 if(file.includes('/database/'))for(const note of d.querySelectorAll('#growth-22 p[data-content301-version]')){assert.equal(note.textContent,{ko:'게임 버전 미확인',en:'Game version unknown',ja:'ゲームのバージョン不明',ru:'Версия игры неизвестна','zh-tw':'遊戲版本未確認',de:'Spielversion unbekannt'}[lang]);note.remove();}
 if(file.includes('/database/exclusive-gear/')){
  sourceAnchors(d,'exclusive');
  const top=d.querySelector('#tableTitle')?.closest('section')?.querySelector('table');assert(top);const rows=[...top.querySelectorAll('tbody tr')];assert.equal(rows.length,15);
  rows.slice(0,14).forEach((row,i)=>{assert.deepEqual(transition(row),[D.transitions[i].from,D.transitions[i].to]);assert([legacyCosts[i],D.transitions[i].cost].includes(Number(row.children[1].textContent)));setNumber(row.children[1],D.transitions[i].cost);});assert.equal(rows[14].children.length,2);assert([360,390].includes(Number(rows[14].children[1].textContent)));setNumber(rows[14].children[1],390);
  const stat=d.querySelector('.quick-stats .quick-stat:nth-child(4) span');assert(stat&&[360,390].includes(Number(stat.textContent)));setNumber(stat,390);
  const band=d.querySelector('.hero-meta .meta-pill:nth-child(2)');assert(band&&[copy[lang].legacyBand,copy[lang].band].includes(band.textContent));band.textContent=copy[lang].band;
  const form=d.querySelector('form[data-growth-form="exclusive"]');assert(form);const cfgNode=form.querySelector('script[type="application/json"]'),cfg=JSON.parse(cfgNode.textContent);assert.equal(cfg.rows.length,14);cfg.rows.forEach((row,i)=>{assert.equal(row.from,D.transitions[i].from);assert.equal(row.to,D.transitions[i].to);assert([legacyCosts[i],D.transitions[i].cost].includes(row.cost));});cfg.rows=structuredClone(D.transitions);cfgNode.textContent=JSON.stringify(cfg);
  const table=d.getElementById(form.getAttribute('data-growth-table'));assert(table);const calcRows=[...table.querySelectorAll('tbody tr')];assert.equal(calcRows.length,14);let sum=0;
  const previousTableId=table.id;assert(['ts3-data-table-1','ts3-data-table-3'].includes(previousTableId));const workbench=table.closest('.ts3-data-workbench');assert(workbench);const controls=workbench.querySelector('.ts3-table-controls');assert(controls);assert.equal(controls.id,previousTableId.replace('data-table','table-controls'));assert(!d.getElementById('ts3-data-table-3')||d.getElementById('ts3-data-table-3')===table);
  for(const element of workbench.querySelectorAll('[aria-controls]')){assert.equal(element.getAttribute('aria-controls'),previousTableId);element.setAttribute('aria-controls','ts3-data-table-3');}table.id='ts3-data-table-3';controls.id='ts3-table-controls-3';form.setAttribute('data-growth-table','ts3-data-table-3');
  calcRows.forEach((row,i)=>{assert.deepEqual(transition(row),[D.transitions[i].from,D.transitions[i].to]);assert.equal(row.children.length,3);sum+=D.transitions[i].cost;setNumber(row.children[1],D.transitions[i].cost);setNumber(row.children[2],sum);});
  d.querySelectorAll('[data-hero-refinement-51="legacy-table"],[data-hero-refinement-51="legacy-calculator"],[data-client-heroes-52]').forEach(n=>n.remove());
  for(const [kind,host]of [['table',top.closest('.table-wrap')],['calculator',form]]){assert(host);const p=d.createElement('p');p.setAttribute('data-client-heroes-52','cost-'+kind);p.textContent=copy[lang].scope;host.before(p);}
 }else if(file.includes('/database/skill-book/')){
  sourceAnchors(d,'skillBook');
  const number=(node,value)=>{assert(node&&node.children.length===0);node.textContent=value.toLocaleString(lang==='de'?'de':'en');if(node.hasAttribute('data-ts-original-value'))node.setAttribute('data-ts-original-value',value.toLocaleString('en'));};
  const top=d.querySelector('#tableTitle')?.closest('section')?.querySelector('table');assert(top);const body=top.querySelector('tbody'),rows=[...body.children].filter(r=>!r.classList.contains('final-row'));
  if(lang==='zh-tw'&&rows.length===39&&transition(rows[35])[1]===36){assert.deepEqual(transition(rows[34]),[35,36]);assert.equal(Number(rows[35].children[1].textContent.replaceAll(',','')),1650);rows[35].children[0].textContent='Lv.36 → 37';}
  const byTo=new Map(rows.map(r=>{const [from,to]=transition(r);assert.equal(to,from+1);assert(!D.skillBook.rows.every(x=>x.to!==to));return[to,r];}));assert.equal(byTo.size,rows.length);
  assert.equal(rows.length,lang==='ru'&&rows.length===38?38:39);
  for(const source of D.skillBook.rows){let row=byTo.get(source.to);if(!row){assert.equal(lang,'ru');assert.equal(source.to,37);row=byTo.get(36).cloneNode(true);row.children[0].textContent='Lv.36 → 37';byTo.get(38).before(row);byTo.set(37,row);}number(row.children[1],source.cost);}
  const total=body.querySelector('.final-row');assert(total);number(total.children[1],23555);
  const rowSelect=top.closest('.ts3-data-workbench')?.querySelector('select[data-row-select]');assert(rowSelect);rowSelect.replaceChildren();[...body.children].forEach((row,i)=>{const option=d.createElement('option');option.value=String(i);option.textContent=row.children[0].textContent.trim();rowSelect.append(option);});
  const stats=[...d.querySelectorAll('.quick-stats .quick-stat span')];assert.equal(stats.length,4);number(stats[1],1650);number(stats[2],2460);number(stats[3],23555);
  const form=d.querySelector('form[data-growth-form="skillBook"]');assert(form);const cfgNode=form.querySelector('script[type="application/json"]'),cfg=JSON.parse(cfgNode.textContent);assert.equal(cfg.rows.length,39);cfg.rows=structuredClone(D.skillBook.rows);cfgNode.textContent=JSON.stringify(cfg);
  const table=d.getElementById(form.getAttribute('data-growth-table'));assert(table);const calcRows=[...table.querySelectorAll('tbody tr')];assert.equal(calcRows.length,39);let sum=0;calcRows.forEach((row,i)=>{assert.deepEqual(transition(row),[D.skillBook.rows[i].from,D.skillBook.rows[i].to]);sum+=D.skillBook.rows[i].cost;number(row.children[1],D.skillBook.rows[i].cost);number(row.children[2],sum);});
  d.querySelectorAll('[data-data-warning]').forEach(n=>{assert(/685|735/.test(n.textContent));n.remove();});
  for(const p of [...form.closest('section').querySelectorAll('p')])if(/685/.test(p.textContent)&&/TilesGuide/.test(p.textContent))p.remove();
  d.querySelectorAll('[data-client-heroes-52="skill-costs"]').forEach(n=>n.remove());const p=d.createElement('p');p.setAttribute('data-client-heroes-52','skill-costs');p.textContent=copy[lang].skillScope;form.before(p);
 }else{
  const id=file.split('/')[2],u=D.unlockDescriptions.find(u=>u.id===id);assert(u);const notes=[...d.querySelectorAll('.equipment-skill-card .step-note')],note=notes.find(n=>n.querySelector('h4')?.textContent.match(/\d+/)?.[0]===String(u.level));assert(note,'Missing owned unlock level '+file);const p=note.querySelector('p');assert(p);p.textContent=u.descriptions[lang];p.setAttribute('data-client-heroes-52','gear-unlock');
 }
 return '<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
}
function build(){validate();let changed=0;for(const file of pages){const full=path.join(root,file),before=fs.readFileSync(full,'utf8'),after=project(before,file);assert.equal(project(after,file),after,'Client projection must be idempotent');if(before!==after){fs.writeFileSync(full,after);changed++;}}const result={builder:'client-heroes-52',pages:pages.length,changed,calculationRows:14,correctedTransitions:3,upgradeTotal:390,activation:10,unlockDescriptions:2,localizedUnlockDescriptions:12};console.log(JSON.stringify(result));return result;}
module.exports={build,project,pages,affectedRoutes:pages,updateDatasets,copy,langs,validate};if(require.main===module)build();
