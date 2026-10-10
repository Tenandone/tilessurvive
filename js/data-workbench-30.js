/* Data presentation only. Growth and building arithmetic remain in their existing modules. */
(function (root) {
  'use strict';
  const copy = {
    de: {row:'Stufe oder Eintrag wählen',filter:'In dieser Tabelle suchen',sort:'Sortieren',original:'Ursprüngliche Reihenfolge',reset:'Zurücksetzen',selected:'Ausgewählter Eintrag',all:'Alle Daten',show:'In der Tabelle anzeigen',count:'Einträge',empty:'Keine passenden Einträge. Ändere den Suchbegriff oder setze den Filter zurück.',scroll:'Scrolle seitlich, um alle Spalten zu sehen.',step:'Kosten eines Schritts',cumulative:'Summe ab dem ersten Schritt',range:'Summe des gewählten Bereichs',current:'Aktuelle Stufe',target:'Zielstufe',held:'Vorrat',shortage:'Noch benötigt',plan:'Ressourcen für deine Aufwertung',time:'Zeit laut Tabelle',boundary:'Addiert die Tabellenwerte von der nächsten bis zur Zielstufe. Die tatsächlichen Kosten und Zeiten können je nach Entwicklungsstand und aktiven Boni abweichen.',unknown:'Für diesen Bereich fehlt eine Kosten- oder Zeitangabe. Prüfe die vollständige Tabelle unten.',invalid:'Prüfe die aktuelle Stufe und die Zielstufe. Der Vorrat darf nicht negativ sein.',reverse:'Die Zielstufe darf nicht unter der aktuellen Stufe liegen.',noUpgrade:'Aktuelle Stufe und Zielstufe sind gleich. Es werden keine zusätzlichen Materialien benötigt.',result:'Ergebnis',copy:'Ergebnis kopieren',copied:'Kopiert',copyError:'Kopieren nicht möglich. Markiere und kopiere den Ergebnistext.',live:'Das Ergebnis wird bei der Eingabe aktualisiert.',units:'K = 1.000 · M = 1.000.000 · B = 1.000.000.000',normalised:'Leere und negative Werte zählen als 0; bei Dezimalzahlen zählt der ganzzahlige Anteil.',day:'T',hour:'Std.',minute:'Min.'},
    ko: {row:'레벨·항목 선택',filter:'표 안에서 검색',sort:'정렬',original:'기본 순서',reset:'초기화',selected:'선택한 항목',all:'전체 데이터',show:'표에서 보기',count:'개 항목',empty:'검색 결과가 없습니다. 다른 검색어를 입력하거나 초기화하세요.',scroll:'표를 좌우로 스크롤하면 모든 열을 볼 수 있습니다.',step:'한 단계 비용',cumulative:'첫 구간부터 누적',range:'선택 구간 합계',current:'현재 레벨',target:'목표 레벨',held:'보유량',shortage:'부족량',plan:'목표까지 필요한 자원',time:'표 기준 시간',boundary:'현재 레벨 다음 단계부터 목표 레벨까지 표의 수치를 합산합니다. 실제 자원·시간은 성장 단계와 적용 보너스에 따라 달라질 수 있습니다.',unknown:'이 구간에 비용 또는 시간 자료가 없어 합계를 계산할 수 없습니다. 아래 표에서 확인하세요.',invalid:'현재·목표 레벨과 0 이상의 보유량을 확인하세요.',reverse:'목표 레벨은 현재 레벨 이상이어야 합니다.',noUpgrade:'현재와 목표 레벨이 같습니다. 필요한 추가 재료는 없습니다.',result:'계산 결과',copy:'결과 복사',copied:'복사됨',copyError:'복사할 수 없습니다. 결과를 선택해 복사하세요.',live:'입력하면 바로 계산됩니다.',units:'K = 1,000 · M = 1,000,000 · B = 1,000,000,000',normalised:'빈 값·음수는 0, 소수는 정수 부분으로 계산합니다.',day:'일',hour:'시간',minute:'분'},
    en: {row:'Choose level or entry',filter:'Search this table',sort:'Sort',original:'Original order',reset:'Reset',selected:'Selected entry',all:'Full data',show:'Locate in table',count:'entries',empty:'No matching entries. Try another search or reset.',scroll:'Scroll horizontally to see every column.',step:'Cost for one step',cumulative:'Cumulative from first step',range:'Selected range total',current:'Current level',target:'Target level',held:'In inventory',shortage:'Still needed',plan:'Resources for your upgrade',time:'Time from table',boundary:'Totals the table values from the next level through the target level. Actual resource costs and time may vary with growth stage and applied bonuses.',unknown:'A cost or time value is unavailable in this range. Check the full table below.',invalid:'Check the current and target levels, and enter non-negative inventory.',reverse:'Target level must be at least the current level.',noUpgrade:'Current and target levels match. No additional materials are needed.',result:'Result',copy:'Copy result',copied:'Copied',copyError:'Copy unavailable. Select the result text to copy it.',live:'Results update as you type.',units:'K = 1,000 · M = 1,000,000 · B = 1,000,000,000',normalised:'Empty and negative values count as 0; fractions use the integer part.',day:'d',hour:'h',minute:'m'},
    ja: {row:'レベル・項目を選択',filter:'表内を検索',sort:'並べ替え',original:'元の順序',reset:'リセット',selected:'選択した項目',all:'全データ',show:'表の位置へ',count:'件',empty:'該当する項目がありません。検索語を変えるかリセットしてください。',scroll:'横にスクロールするとすべての列を確認できます。',step:'1段階の必要量',cumulative:'最初の段階からの累計',range:'選択範囲の合計',current:'現在レベル',target:'目標レベル',held:'所持量',shortage:'不足量',plan:'目標までの必要資源',time:'表に基づく所要時間',boundary:'現在レベルの次から目標レベルまで、表の数値を合算します。実際の必要資源・時間は成長段階や適用ボーナスによって異なる場合があります。',unknown:'この範囲には費用または時間の不明な値があります。下の表で確認してください。',invalid:'現在・目標レベルと0以上の所持量を確認してください。',reverse:'目標レベルは現在レベル以上にしてください。',noUpgrade:'現在と目標レベルが同じです。追加の素材は不要です。',result:'計算結果',copy:'結果をコピー',copied:'コピーしました',copyError:'コピーできません。結果の文字を選択してください。',live:'入力するとすぐに計算します。',units:'K = 1,000 · M = 1,000,000 · B = 1,000,000,000',normalised:'空欄・負数は0、小数は整数部分で計算します。',day:'日',hour:'時間',minute:'分'},
    ru: {row:'Уровень или запись',filter:'Поиск в таблице',sort:'Сортировка',original:'Исходный порядок',reset:'Сбросить',selected:'Выбранная запись',all:'Все данные',show:'Найти в таблице',count:'записей',empty:'Ничего не найдено. Измените запрос или сбросьте поиск.',scroll:'Прокрутите таблицу по горизонтали, чтобы увидеть все столбцы.',step:'Стоимость одного шага',cumulative:'Накопительно с первого шага',range:'Итог выбранного диапазона',current:'Текущий уровень',target:'Целевой уровень',held:'В наличии',shortage:'Не хватает',plan:'Ресурсы для улучшения',time:'Время по таблице',boundary:'Суммируются значения таблицы со следующего уровня до целевого. Фактические затраты ресурсов и время могут зависеть от стадии развития и действующих бонусов.',unknown:'Для этого диапазона отсутствует стоимость или время. Проверьте таблицу ниже.',invalid:'Проверьте уровни и введите неотрицательный запас.',reverse:'Целевой уровень не может быть ниже текущего.',noUpgrade:'Уровни совпадают. Дополнительные материалы не нужны.',result:'Результат',copy:'Скопировать результат',copied:'Скопировано',copyError:'Не удалось скопировать. Выделите текст результата.',live:'Результат обновляется при вводе.',units:'K = 1 000 · M = 1 000 000 · B = 1 000 000 000',normalised:'Пустые и отрицательные значения считаются нулём; дроби округляются вниз.',day:'д',hour:'ч',minute:'мин'},
    'zh-tw': {row:'選擇等級或項目',filter:'搜尋此表格',sort:'排序',original:'原始順序',reset:'重設',selected:'所選項目',all:'完整資料',show:'查看表格位置',count:'筆資料',empty:'找不到符合的項目。請更換關鍵字或重設。',scroll:'左右捲動表格即可查看所有欄位。',step:'單階所需數量',cumulative:'從首階起累計',range:'所選區間合計',current:'目前等級',target:'目標等級',held:'持有數量',shortage:'尚缺數量',plan:'升級所需資源',time:'表列所需時間',boundary:'加總目前等級之後至目標等級的表列數值。實際所需資源與時間可能因成長階段及套用加成而異。',unknown:'此區間缺少費用或時間資料，無法計算合計。請查看下方表格。',invalid:'請確認目前與目標等級，並輸入0以上的持有數量。',reverse:'目標等級不可低於目前等級。',noUpgrade:'目前與目標等級相同，無需額外材料。',result:'計算結果',copy:'複製結果',copied:'已複製',copyError:'無法複製，請選取結果文字。',live:'輸入後立即計算。',units:'K = 1,000 · M = 1,000,000 · B = 1,000,000,000',normalised:'空白與負數視為0，小數取整數部分計算。',day:'天',hour:'小時',minute:'分鐘'}
  };
  function numeric(raw) {
    const s=String(raw).trim().replace(/,/g,'');
    const m=s.match(/^([+-]?\d+(?:\.\d+)?)\s*([KMB])?\s*(%)?$/i);
    return m?Number(m[1])*({K:1e3,M:1e6,B:1e9}[String(m[2]).toUpperCase()]||1):null;
  }
  function compare(a,b,lang,direction=1,parse=numeric) {
    const x=parse(a),y=parse(b);
    // Missing values stay last in either direction; they are never treated as zero.
    if(x!==null&&y===null)return -1;
    if(x===null&&y!==null)return 1;
    return direction*(x!==null&&y!==null?x-y:String(a).localeCompare(String(b),lang,{numeric:true}));
  }
  const catalogCopy={
    de:{search:'Nach Name oder Funktion suchen',category:'Kategorie',all:'Alle Kategorien',name:'Name',rows:'Zeilen',data:'Daten je Stufe',calculate:'Rechner öffnen',buildings:'Entdecke die Gebäude deiner Siedlung und gehe direkt zu Stufeneffekten, Ausbaukosten und Voraussetzungen.',list:'Suche ein Gebäude nach Namen oder grenze die Liste nach seiner Funktion ein.',tools:'Wähle die aktuelle Stufe und dein Ziel. Plane anschließend Materialien, Beschleunigungen und die Vorbereitung auf Events.'},
    ko:{search:'이름·기능으로 찾기',category:'분류',all:'모든 분류',name:'이름순',rows:'행',data:'레벨별 자료',calculate:'계산기 열기',buildings:'발전소, 병영, 연구소와 지원 건물의 기능을 살펴보고 레벨별 효과·비용 자료로 이동하세요.',list:'건물 이름으로 찾거나 기능별로 좁혀 보세요.',tools:'현재 레벨과 목표를 정하고, 성장 재료·가속 시간·이벤트 준비 자료를 확인하세요.'},
    en:{search:'Find by name or function',category:'Category',all:'All categories',name:'Name',rows:'rows',data:'Level data',calculate:'Open calculator',buildings:'Explore your settlement buildings, then go straight to level effects, upgrade costs and prerequisites.',list:'Find a building by name or narrow the list by its function.',tools:'Choose your current level and target, then plan growth materials, speedups and event preparation.'},
    ja:{search:'名前・機能で検索',category:'分類',all:'すべての分類',name:'名前順',rows:'行',data:'レベル別データ',calculate:'計算機を開く',buildings:'発電所、兵舎、研究所、支援施設の機能を確認し、レベル別の効果・費用・前提条件へ移動できます。',list:'建物の名前で検索するか、機能別に絞り込めます。',tools:'現在と目標のレベルを決め、成長素材・加速時間・イベント準備の資料を確認しましょう。'},
    ru:{search:'Поиск по названию или функции',category:'Категория',all:'Все категории',name:'По названию',rows:'строк',data:'Данные по уровням',calculate:'Открыть калькулятор',buildings:'Изучите здания поселения и переходите к эффектам уровней, стоимости улучшений и требованиям.',list:'Найдите здание по названию или отфильтруйте список по его назначению.',tools:'Выберите текущий и целевой уровни, рассчитайте материалы и ускорения и подготовьтесь к событиям.'},
    'zh-tw':{search:'依名稱或功能搜尋',category:'分類',all:'所有分類',name:'依名稱',rows:'列',data:'各級資料',calculate:'開啟計算器',buildings:'查看發電廠、兵營、研究所與支援建築的功能，直接前往各級效果、升級費用與前置條件。',list:'依建築名稱搜尋，或依功能篩選清單。',tools:'選定目前與目標等級，再規劃成長材料、加速時間與活動準備。'}
  };
  const sourceValue=cell=>cell?.getAttribute('data-ts-original-value')??cell?.textContent?.trim()??'';
  const exports={copy,catalogCopy,numeric,compare,sourceValue};
  if(typeof module==='object')module.exports=exports;
  if(!root.document)return;
  function init(){
    const d=root.document,lang=d.documentElement.dataset.lang||d.documentElement.lang||'en',t=copy[lang]||copy.en;
    const make=(tag,cls,text)=>{const n=d.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
    const format=n=>n.toLocaleString(lang);
    const field=(form,name)=>form.querySelector('[name="'+name+'"]');
    const value=(form,name)=>{const s=field(form,name).value.trim();return s===''?NaN:Number(s);};
    const reduced=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    d.querySelectorAll('[data-catalog-controls]').forEach(controls=>{
      const entries=[...d.querySelectorAll('[data-catalog-entry]')],query=controls.querySelector('input'),category=controls.querySelector('[data-catalog-category]'),sort=controls.querySelector('[data-catalog-sort]'),status=controls.querySelector('[role="status"]');
      if(!entries.length)return;controls.hidden=false;
      const parents=new Map();entries.forEach(n=>{if(!parents.has(n.parentElement))parents.set(n.parentElement,[]);parents.get(n.parentElement).push(n);});
      function render(){
        const q=query.value.normalize('NFKC').toLocaleLowerCase(lang).trim();let count=0;
        entries.forEach(n=>{const tags=JSON.parse(n.dataset.catalogTags||'[]');n.hidden=!!(q&&!n.textContent.normalize('NFKC').toLocaleLowerCase(lang).includes(q))||!!(category.value&&!tags.includes(category.value));if(!n.hidden)count++;});
        parents.forEach((list,parent)=>{const ordered=sort.value==='name'?[...list].sort((a,b)=>a.querySelector('h3').textContent.localeCompare(b.querySelector('h3').textContent,lang)):list;ordered.forEach(n=>parent.append(n));parent.closest('section')?.classList.toggle('ts3-catalog-no-match',!list.some(n=>!n.hidden));});
        status.textContent=count?format(count)+' / '+entries.length+' '+t.count:t.empty;
      }
      query.addEventListener('input',render);category.addEventListener('change',render);sort.addEventListener('change',render);
      controls.addEventListener('submit',e=>e.preventDefault());
      controls.querySelector('[data-catalog-reset]').addEventListener('click',()=>{query.value='';category.value='';sort.value='';render();});render();
    });
    function copyButton(output){
      const b=make('button','ts3-copy',t.copy);b.type='button';let timer;
      b.addEventListener('click',async()=>{clearTimeout(timer);try{await root.navigator.clipboard.writeText(output.innerText||output.textContent);b.textContent=t.copied;}catch{b.textContent=t.copyError;}timer=setTimeout(()=>b.textContent=t.copy,2200);});return b;
    }
    function resultValue(label,value,unit){const item=make('div','ts3-result-value');item.append(make('span','',label),make('strong','',value));if(unit)item.append(make('small','',unit));return item;}
    function highlight(table,from,to){table.querySelectorAll('tbody tr').forEach(row=>{const first=sourceValue(row.querySelector('td'));const pair=first.match(/(\d+)\s*→\s*(\d+)/),level=pair?+pair[2]:/^\d+$/.test(first.trim())?+first:null;row.classList.toggle('ts3-in-range',level!==null&&level>from&&level<=to);});}
    d.querySelectorAll('[data-workbench]').forEach(table=>{
      const host=table.closest('.ts3-data-workbench');if(!host||host.dataset.ready)return;host.dataset.ready='true';
      const controls=host.querySelector('.ts3-table-controls'),summary=host.querySelector('.ts3-selection'),rows=[...table.querySelectorAll('tbody tr')];
      if(!controls)return;
      const select=controls.querySelector('[data-row-select]'),query=controls.querySelector('[data-table-query]'),sort=controls.querySelector('[data-sort]'),status=host.querySelector('.ts3-table-status');
      const heads=[...table.querySelectorAll('thead tr:first-child th')].map(n=>n.textContent.trim());
      const sourceRows=rows.map((row,index)=>({row,index,text:row.textContent.normalize('NFKC').toLocaleLowerCase(lang)}));
      controls.hidden=false;
      function updateSelection(){
        if(!select)return;
        const item=sourceRows.find(x=>x.index===Number(select.value)&&!x.row.hidden);
        summary.hidden=!item;
        rows.forEach(r=>r.classList.toggle('ts3-selected',r===item?.row));
        if(!item)return;
        const dl=summary.querySelector('dl');dl.replaceChildren();
        [...item.row.querySelectorAll('td')].forEach((cell,i)=>{const pair=make('div');pair.append(make('dt','',heads[i]||String(i+1)),make('dd','',cell.textContent.trim()));dl.append(pair);});
        summary.querySelector('[data-selected-title]').textContent=t.selected+' · '+item.row.querySelector('td').textContent.trim();
      }
      function render(){
        const q=query.value.normalize('NFKC').toLocaleLowerCase(lang).trim();let count=0;
        sourceRows.forEach(x=>{x.row.hidden=!!q&&!x.text.includes(q);if(!x.row.hidden)count++;if(select?.options[x.index])select.options[x.index].disabled=x.row.hidden;});
        if(select){if(!sourceRows.some(x=>x.index===Number(select.value)&&!x.row.hidden)){const first=sourceRows.find(x=>!x.row.hidden);select.value=first?String(first.index):'';}select.disabled=count===0;}
        status.textContent=count?format(count)+' / '+format(rows.length)+' '+t.count:t.empty;status.classList.toggle('ts3-empty',count===0);
        updateSelection();
      }
      function sorting(){
        const [column,dir]=sort.value.split(':');
        const header=table.querySelectorAll('thead th')[+column],parser=header?.dataset.valueType==='time'&&root.TS_MATH?root.TS_MATH.minutes:numeric;
        const ordered=sort.value===''?sourceRows:[...sourceRows].sort((a,b)=>compare(sourceValue(a.row.children[+column]),sourceValue(b.row.children[+column]),lang,dir==='desc'?-1:1,parser)||a.index-b.index);
        ordered.forEach(x=>x.row.parentElement.append(x.row));
        table.querySelectorAll('thead th').forEach((th,i)=>{if(sort.value!==''&&i===+column)th.setAttribute('aria-sort',dir==='desc'?'descending':'ascending');else th.removeAttribute('aria-sort');});
      }
      query.addEventListener('input',render);select?.addEventListener('change',()=>{updateSelection();summary.open=true;});sort?.addEventListener('change',sorting);
      controls.querySelector('[data-table-reset]').addEventListener('click',()=>{query.value='';if(sort){sort.value='';sorting();}if(select)select.value='0';render();});
      summary?.querySelector('[data-locate-row]')?.addEventListener('click',()=>{const row=rows[+select.value];if(!row)return;const wrap=table.parentElement;wrap.scrollTo({top:Math.max(0,row.offsetTop-table.querySelector('thead').offsetHeight),behavior:reduced()?'auto':'smooth'});wrap.focus({preventScroll:true});});
      rows.forEach((row,i)=>row.addEventListener('click',event=>{if(select&&!event.target.closest('a,button,input,select')){select.value=String(i);updateSelection();summary.open=true;}}));
      render();
    });
    // Reformat the existing growth calculator's output after its own synchronous handler.
    // The original calculate() and event handlers still produce every numeric result.
    d.querySelectorAll('[data-growth-form]').forEach((form,i)=>{
      if(form.dataset.workbenchReady)return;form.dataset.workbenchReady='true';
      const cfg=JSON.parse(form.querySelector('script[type="application/json"]').textContent),out=form.querySelector('output');
      const actions=form.querySelector('.ts3-growth-actions');if(actions)actions.append(copyButton(out));
      function present(){
        const raw=out.textContent,from=value(form,'from'),to=value(form,'to'),held=value(form,'held'),error=out.dataset.result==='invalid'||out.dataset.result==='missing';
        form.querySelectorAll('input').forEach(input=>{const n=input.value.trim()===''?NaN:Number(input.value),bad=!Number.isFinite(n)||n<Number(input.min)||(input.max!==''&&n>Number(input.max))||(input.step==='1'&&!Number.isInteger(n));input.setAttribute('aria-invalid',String(bad));});
        if(to<from)field(form,'to').setAttribute('aria-invalid','true');
        out.classList.toggle('ts3-result-error',error);
        if(error){out.textContent=to<from?t.reverse:raw;}
        else{
          const total=Number(out.dataset.result),shortage=Number(out.dataset.shortage);out.replaceChildren();
          out.append(make('span','ts3-result-range',format(from)+' → '+format(to)),resultValue(t.range,format(total),cfg.unit),resultValue(t.shortage,format(shortage),cfg.unit));
          if(from===to)out.append(make('span','ts3-result-note',t.noUpgrade));
        }
        const table=d.getElementById(form.dataset.growthTable);if(table)highlight(table,error?NaN:from,error?NaN:to);
      }
      form.addEventListener('input',present);form.addEventListener('change',present);
      actions?.querySelector('[data-growth-reset]')?.addEventListener('click',()=>{form.querySelectorAll('input').forEach(n=>n.value=n.defaultValue||n.getAttribute('value')||'0');field(form,'from').dispatchEvent(new Event('input',{bubbles:true}));});
      present();
    });
    d.querySelectorAll('[data-building-planner]').forEach(form=>{
      if(!root.TS_MATH)return;
      const table=d.getElementById(form.dataset.table),headers=[...table.querySelectorAll('thead th')].map(n=>n.textContent.trim());
      const rows=[...table.querySelectorAll('tbody tr')].map(r=>({level:+sourceValue(r.children[0]),cells:[...r.children].map(sourceValue)}));
      const out=form.querySelector('output'),actions=form.querySelector('.ts3-growth-actions');actions.append(copyButton(out));
      form.hidden=false;
      function update(){
        const from=value(form,'from'),to=value(form,'to'),held=[2,3,4,5].map(c=>value(form,'held-'+c));out.replaceChildren();
        form.querySelectorAll('input,select').forEach(n=>n.setAttribute('aria-invalid','false'));
        let invalid=held.some(n=>!Number.isFinite(n)||n<0)||!Number.isInteger(from)||!Number.isInteger(to)||from<rows[0].level||to>rows[rows.length-1].level;
        [2,3,4,5].forEach((c,i)=>field(form,'held-'+c).setAttribute('aria-invalid',String(!Number.isFinite(held[i])||held[i]<0)));
        if(invalid||to<from){out.textContent=to<from?t.reverse:t.invalid;field(form,'to').setAttribute('aria-invalid',String(to<from));out.classList.add('ts3-result-error');out.dataset.result='invalid';highlight(table,NaN,NaN);return;}
        try{
          const result=root.TS_MATH.sumRange(rows,from,to,[2,3,4,5],Number(form.dataset.timeColumn));
          out.classList.remove('ts3-result-error');out.dataset.result=JSON.stringify(result);
          out.append(make('span','ts3-result-range',format(from)+' → '+format(to)+' · '+t.range));
          result.totals.forEach((n,i)=>{const item=resultValue(headers[i+2],format(n));item.append(make('small','',t.shortage+': '+format(Math.max(0,n-held[i]))));out.append(item);});
          const time=Math.floor(result.time/1440)+t.day+' '+Math.floor(result.time%1440/60)+t.hour+' '+(result.time%60)+t.minute;out.append(resultValue(t.time,time));
          if(from===to)out.append(make('span','ts3-result-note',t.noUpgrade));
          highlight(table,from,to);
          const select=table.closest('.ts3-data-workbench')?.querySelector('[data-row-select]');
          if(select){const index=rows.findIndex(r=>r.level===to);if(index>=0&&!select.options[index]?.disabled){const summary=table.closest('.ts3-data-workbench').querySelector('.ts3-selection'),open=summary.open;select.value=String(index);select.dispatchEvent(new Event('change'));summary.open=open;}}
        }catch{out.dataset.result='missing';out.textContent=t.unknown;out.classList.add('ts3-result-error');highlight(table,NaN,NaN);}
      }
      form.addEventListener('input',update);form.addEventListener('change',update);form.addEventListener('submit',e=>e.preventDefault());
      actions.querySelector('[data-building-reset]').addEventListener('click',()=>{form.querySelectorAll('input').forEach(n=>n.value='0');form.querySelectorAll('select').forEach(n=>n.value=n.dataset.default);update();});update();
    });
    const speedup=d.querySelector('[data-speedup-calculator-page]');
    if(speedup){
      const results=speedup.querySelector('.speedup-result-grid');if(results){results.setAttribute('aria-live','polite');results.setAttribute('aria-atomic','true');}
      const inputs=[...speedup.querySelectorAll('.speedup-form input')];
      const note=make('p','ts3-input-note',t.normalised);note.id='ts3-speedup-input-note';speedup.querySelector('.speedup-form')?.after(note);
      inputs.forEach(n=>{n.setAttribute('aria-describedby',note.id);n.addEventListener('input',()=>{const v=Number(n.value);n.setAttribute('aria-invalid',String(!Number.isFinite(v)||v<0));});});
    }
    // Existing event formulas are invoked rather than reimplemented.
    const events=d.getElementById('ehCalculators');
    if(events)events.addEventListener('input',e=>{
      const card=e.target.closest('.eh-card');if(!card)return;const button=card.querySelector('[data-power-button],[data-speed-button]'),out=card.querySelector('[data-power-result],[data-speed-result]');if(!button||!out)return;
      out.setAttribute('role','status');const inputs=[...card.querySelectorAll('input')];
      const valid=inputs.every(n=>n.value.trim()!==''&&Number.isFinite(Number(n.value))&&Number(n.value)>=0);inputs.forEach(n=>n.setAttribute('aria-invalid',String(n.value.trim()===''||!Number.isFinite(Number(n.value))||Number(n.value)<0)));
      if(valid){button.click();out.classList.remove('ts3-result-error');}else{out.textContent=t.invalid;out.classList.add('ts3-result-error');}
    });
  }
  // This deferred asset lives in <head>; body-deferred arithmetic loads before DOMContentLoaded.
  if(root.document.readyState!=='complete')root.document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window==='object'?window:globalThis);
