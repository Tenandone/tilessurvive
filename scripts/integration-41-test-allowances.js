/* Exact reviewed 4.1 additions. Existing rows/formulas are never exempted. */
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const gear=require('../data/foundation-40/hero-gear-levels-41.json'),pets=require('../data/foundation-40/pet-training-profiles-41.json'),names=require('../data/foundation-40/official-character-locales.json'),seaCopy=require('../data/foundation-40/sea-hero-growth-copy');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(hash(gear),'c45eb15c9e7647879e9318473dcbd4cf00b8bdaa5bbd8ae1535dc540a5870028');
assert.equal(hash(pets),'d4fca81b17a8d49bd5e5488e1c49db58ef6867bf63b8d78a4e9f4f16cfc7c779');
const expScope={
 ko:'게임 2.6.200 · 1→100레벨. 선택한 펫의 경험치를 현재 레벨부터 목표 레벨까지 합산합니다. 같은 펫의 훈련 비용을 아래에서 계산할 수 있습니다.',
 en:'Game 2.6.200 · Levels 1→100. Adds the selected pet’s EXP from the current level to the target. Calculate training costs for the same pet below.',
 ja:'ゲーム2.6.200・レベル1→100。選択したペットの現在レベルから目標レベルまでの経験値を合算します。同じペットの訓練費用を下で計算できます。',
 ru:'Версия 2.6.200 · Уровни 1→100. Суммируется опыт выбранного питомца от текущего до целевого уровня. Ниже можно рассчитать тренировку того же питомца.',
 'zh-tw':'遊戲2.6.200・1→100級。加總所選寵物從目前等級到目標等級所需經驗。下方可計算同一隻寵物的訓練費用。'
};
const trainingScope={
 ko:'게임 2.6.200 · 경험치 계산기와 펫 선택이 연동됩니다. 각 단계의 진행률 0%부터 계산하며, 이미 진행한 훈련 비용은 차감하지 않습니다. 펫마다 자신의 각인을 사용합니다.',
 en:'Game 2.6.200 · Pet selection is shared with the EXP calculator. Counts from 0% progress in the current stage; completed training steps are not deducted. Each pet uses its own imprints.',
 ja:'ゲーム2.6.200。経験値計算とペットの選択が連動します。現在の段階の進捗0%から計算し、完了済みの訓練分は差し引きません。各ペット専用のアイテムが必要です。',
 ru:'Версия 2.6.200. Выбор питомца связан с калькулятором опыта. Расчёт начинается с 0% текущего этапа; уже выполненные шаги не вычитаются. Для каждого питомца нужен свой материал.',
 'zh-tw':'遊戲2.6.200。寵物選擇與經驗計算同步。從目前階段進度0%起算，不扣除已完成的訓練步驟。各寵物使用自己的專用材料。'
};
const trainingHeadings={ko:['훈련 단계','필요 각인','누적 각인'],en:['Training stage','Required imprints','Cumulative imprints'],ja:['訓練段階','必要数','累計必要数'],ru:['Этап тренировки','Нужно материалов','Всего материалов'],'zh-tw':['訓練階段','所需材料','累計材料']};
const effectHeading={ko:'주요 효과',en:'Primary effect',ja:'基本効果',ru:'Основной эффект','zh-tw':'主要效果'};
const clean=s=>s.replace(/\s+/g,' ').trim();
function assertPetSelection(document,lang){
 const idList=['snowball','dodo','buckler','fluffy','hardhead','shadow','starhorn'];assert.deepEqual(pets.pets.map(p=>p.id),idList);
 for(const kind of ['petExp','petTraining']){const select=document.querySelector(`[data-growth-form="${kind}"] [name="pet"]`);assert(select);assert.deepEqual([...select.querySelectorAll('option')].map(n=>[n.value,clean(n.textContent)]),pets.pets.map(p=>[p.id,p.names[lang]]));assert.equal(select.querySelector('option[selected]').value,'starhorn');}
 assert.deepEqual([...document.querySelectorAll('#pet-training-items-41 tbody tr')].map(row=>[...row.children].map(n=>clean(n.textContent))),pets.pets.map(p=>[p.names[lang],p.resourceNames[lang]]));
 const icons=[...document.querySelectorAll('img[data-pet-imprint-41]')];assert.equal(icons.length,7);
 icons.forEach((img,i)=>{assert.equal(img.getAttribute('data-pet-imprint-41'),idList[i]);assert.equal(img.getAttribute('src'),`/img/game-41/pet-imprints/${idList[i]}.webp`);assert.equal(img.getAttribute('width'),'32');assert.equal(img.getAttribute('height'),'32');assert.equal(img.getAttribute('alt'),'');assert.equal(img.getAttribute('loading'),'lazy');assert(img.closest('#pet-training-items-41'));});
 assert.equal(clean(document.getElementById('pet-training-scope-41').textContent),trainingScope[lang]);
}
function reviewedGearTables(document,lang,route){
 const blocks=[...document.querySelectorAll('[data-hero-gear-levels-41]')],profile=gear.gears.find(g=>route===`/${lang}/heroes/${lang==='en'&&g.id==='tarzan'?'tazan':g.id}/`);
 if(!profile){assert.equal(blocks.length,0,'Unapproved route received a gear-table exemption');return new Set();}
 assert.equal(blocks.length,1,'Each approved hero retains exactly one new comparison block');
 const block=blocks[0],tables=[...block.querySelectorAll('table')];assert.equal(block.id,'hero-primary-gear-levels-41');assert.equal(tables.length,2);
 const rows=t=>[...t.querySelectorAll('tr')].map(r=>[...r.children].map(n=>clean(n.textContent)));
 const format=args=>clean(profile.descriptionTemplate[lang].replace(/\{(\d+)\}/g,(_,i)=>{assert.equal(typeof args[+i],'string');return args[+i];}));
 assert.deepEqual(rows(tables[0]),[[effectHeading[lang],'Lv.1','Lv.15'],[names.heroes.find(h=>h.id===profile.id).gear.skillName[lang],format(profile.levels[0].args),format(profile.levels[14].args)]]);
 assert.deepEqual(rows(tables[1]),[[seaCopy[lang].level,effectHeading[lang]],...profile.levels.map(r=>[String(r.level),format(r.args)])]);
 assert.deepEqual(JSON.parse(document.getElementById('sea-hero-growth-data').textContent).gear,profile);
 return new Set(tables);
}
module.exports={expScope,trainingScope,trainingHeadings,assertPetSelection,reviewedGearTables};
