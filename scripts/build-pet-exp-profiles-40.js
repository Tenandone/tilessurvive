/* Species-specific EXP rows. Keep the existing Starhorn calculator JSON intact. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),D=require('../data/foundation-40/pet-exp-profiles.json'),G=require('../data/foundation-40/starhorn-growth.json');
const langs=['ko','en','ja','ru','zh-tw'],ids=['snowball','dodo','buckler','fluffy','hardhead','shadow','starhorn'];
const C={
 ko:{title:'펫별 목표 경험치 계산',pet:'펫 선택',scope:'게임 2.6.200 · 1→100레벨. 기본 선택은 별뿔이입니다. 선택한 펫의 경험치를 현재 레벨부터 목표 레벨까지 합산합니다. 아래 훈련 비용은 별뿔이 전용입니다.',table:'펫별 레벨 경험치 비교',step:'레벨',needed:'필요 경험치',note:'각 행은 왼쪽 레벨에서 오른쪽 레벨로 성장하는 데 필요한 경험치입니다. 이름을 함께 표시한 펫은 이 버전에서 경험치가 같습니다.'},
 en:{title:'Pet target EXP calculator',pet:'Pet',scope:'Game 2.6.200 · Levels 1→100. Starhorn is selected by default. Adds the selected pet’s EXP from the current level to the target. Training costs below apply only to Starhorn.',table:'Compare pet EXP by level',step:'Level',needed:'Required EXP',note:'Each row is the EXP needed to move from the left level to the right. Pets listed together have identical EXP costs in this version.'},
 ja:{title:'ペット別の目標経験値計算',pet:'ペット',scope:'ゲーム2.6.200・レベル1→100。初期選択はStarhornです。選択したペットの現在レベルから目標レベルまでの経験値を合算します。下の訓練費用はStarhorn専用です。',table:'ペット別のレベル経験値比較',step:'レベル',needed:'必要経験値',note:'各行は左のレベルから右のレベルへ成長するための経験値です。併記されたペットの必要経験値は、このバージョンでは同じです。'},
 ru:{title:'Расчёт опыта питомцев',pet:'Питомец',scope:'Версия игры 2.6.200 · Уровни 1→100. По умолчанию выбран Starhorn. Сумма опыта выбранного питомца от текущего до целевого уровня. Стоимость тренировки ниже относится только к Starhorn.',table:'Опыт питомцев по уровням',step:'Уровень',needed:'Нужный опыт',note:'Каждая строка показывает опыт для перехода с левого уровня на правый. У перечисленных вместе питомцев одинаковые затраты опыта в этой версии.'},
 'zh-tw':{title:'各寵物目標經驗計算',pet:'選擇寵物',scope:'遊戲2.6.200・1→100級。預設選擇Starhorn。加總所選寵物從目前等級到目標等級所需的經驗。下方訓練費用僅適用於Starhorn。',table:'各寵物等級經驗比較',step:'等級',needed:'所需經驗',note:'每列顯示從左側等級升至右側等級所需的經驗。本版本中，並列名稱的寵物所需經驗相同。'}
};
assert.deepEqual(D.pets.map(p=>p.id),ids);assert.equal(D.gameVersion,'2.6.200');
for(const pet of D.pets){assert.equal(pet.maxLevel,100);assert.equal(pet.expRows.length,99);pet.expRows.forEach((r,i)=>assert(r.from===i+1&&r.to===i+2&&Number.isSafeInteger(r.cost)&&r.cost>0));for(const l of langs)assert(pet.names[l]);}
assert.deepEqual(D.pets.find(p=>p.id==='starhorn').expRows,G.expRows);
const groups=[];for(const pet of D.pets){const key=JSON.stringify(pet.expRows),g=groups.find(g=>g.key===key);if(g)g.pets.push(pet);else groups.push({key,pets:[pet],rows:pet.expRows});}assert.equal(groups.length,3);
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let changed=0;
for(const lang of langs){
 const t=C[lang],file=path.join(root,lang,'database/pet-system/index.html'),before=fs.readFileSync(file,'utf8');let out=before;
 const d=parseHTML(before).document,form=d.querySelector('[data-growth-form="petExp"]');assert(form);const originalForm=form.outerHTML,originalJSON=form.querySelector('script[type="application/json"]').textContent;
 assert.deepEqual(JSON.parse(originalJSON).rows,G.expRows);
 const oldSelector=form.querySelector('[data-pet-exp-selector-40]');if(oldSelector)oldSelector.remove();
 const label=d.createElement('label');label.setAttribute('data-pet-exp-selector-40','');label.innerHTML=`${esc(t.pet)}<select name="pet" aria-describedby="pet-exp-scope-40">${D.pets.map(p=>`<option value="${p.id}"${p.id==='starhorn'?' selected':''}>${esc(p.names[lang])}</option>`).join('')}</select>`;form.prepend(label);
 out=out.replace(originalForm,()=>form.outerHTML);assert.equal(form.querySelector('script[type="application/json"]').textContent,originalJSON);
 const heading=form.previousElementSibling,note=d.querySelector('#pet-exp-scope-40');assert(heading?.tagName==='H3'&&note);
 out=out.replace(heading.outerHTML,`<h3${heading.id?` id="${esc(heading.id)}"`:''}>${esc(t.title)}</h3>`);
 const starName=D.pets.find(p=>p.id==='starhorn').names[lang],scope=t.scope.replaceAll('Starhorn',starName).replaceAll('별뿔이',starName);
 const clone=note.cloneNode(true);clone.textContent=scope;out=out.replace(note.outerHTML,()=>clone.outerHTML);
 const table=`<details class="ts3-selection" data-pet-exp-profiles-table=""><summary>${esc(t.table)}</summary><p>${esc(t.note)}</p><div class="ts-table-wrap" tabindex="0" role="region" aria-label="${esc(t.table)}"><table><caption>${esc(t.needed)} · EXP · 2.6.200</caption><thead><tr><th scope="col">${esc(t.step)}</th>${groups.map(g=>`<th scope="col">${g.pets.map(p=>esc(p.names[lang])).join(' / ')}</th>`).join('')}</tr></thead><tbody>${Array.from({length:99},(_,i)=>`<tr><th scope="row">${i+1} → ${i+2}</th>${groups.map(g=>`<td>${g.rows[i].cost.toLocaleString('en-US')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
 const oldTable=d.querySelector('[data-pet-exp-profiles-table]');if(oldTable)out=out.replace(oldTable.outerHTML,()=>table);else out=out.replace(form.outerHTML,()=>form.outerHTML+table);
 const payload=`<script data-pet-exp-profiles-40="" type="application/json" id="pet-exp-profiles-40">${JSON.stringify({pets:D.pets,labels:t}).replaceAll('<','\\u003c')}</script><script data-pet-exp-profiles-40="" src="/js/pet-exp-profiles-40.js" defer></script>`;
 for(const old of d.querySelectorAll('script[data-pet-exp-profiles-40]'))out=out.replace(old.outerHTML,'');out=out.replace('</body>',()=>payload+'</body>');
 const after=parseHTML(out).document;assert.equal(after.querySelectorAll('[data-pet-exp-selector-40]').length,1);assert.equal(after.querySelectorAll('[data-pet-exp-profiles-table] tbody tr').length,99);assert.equal(after.querySelector('[data-growth-form="petExp"] script').textContent,originalJSON);
 if(out!==before){fs.writeFileSync(file,out);changed++;}
}
console.log(JSON.stringify({petProfiles:7,explicitTransitions:693,comparisonGroups:3,pages:5,changed}));
