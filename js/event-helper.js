(function(){
  var SUPPORTED = ['ko','en','ja','zh-tw','ru'];
  var DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
  var DAY_LABELS = {
    ko:['월','화','수','목','금','토','일'],
    en:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    ja:['月','火','水','木','金','土','日'],
    'zh-tw':['週一','週二','週三','週四','週五','週六','週日'],
    ru:['Пн','Вт','Ср','Чт','Пт','Сб','Вс']
  };
  var UI = {
    ko:{loading:'이벤트 데이터를 불러오는 중입니다.',error:'이벤트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',empty:'표시할 이벤트가 없습니다.',all:'전체',keyword:'검색어',day:'요일',mode:'모드',activity:'활동',reward:'보상 검색어',verified:'검증됨',needsVerification:'검증 필요',reviewNeeded:'검토 필요',sourceImported:'원본 추출 데이터',sample:'샘플 데이터',partial:'부분 검토 필요',confidence:'신뢰도',scoreRules:'점수 항목',sourcePoints:'원본 참고 점수',pointsPerUnit:'확정 점수',unverifiedPoints:'점수 검증 필요',timeBasis:'시간 기준',server:'서버',local:'로컬','source-msk-reset':'원본 기준 시간',today:'오늘',future:'추가 예정',result:'결과',points:'점수',totalTime:'총 가속 시간',futureTools:'추가 예정 도구',checklist:['오늘 이벤트와 시간 기준 확인','보상 검색으로 필요한 자원 확인','기본 계산기로 필요한 수량 가늠','영웅/건물/장비 데이터 다시 확인','시즌 목표와 서버 일정 확인','자원 사용 전 게임 내 최신 정보 재확인']},
    en:{loading:'Loading event data.',error:'Could not load event data. Please try again later.',empty:'No events to show.',all:'All',keyword:'Keyword',day:'Day',mode:'Mode',activity:'Activity',reward:'Reward keyword',verified:'Verified',needsVerification:'Needs verification',reviewNeeded:'Needs review',sourceImported:'Source-imported data',sample:'Sample data',partial:'Partial review needed',confidence:'Confidence',scoreRules:'Score items',sourcePoints:'Source reference points',pointsPerUnit:'Confirmed points',unverifiedPoints:'Points need verification',timeBasis:'Time basis',server:'Server',local:'Local','source-msk-reset':'Source time basis',today:'Today',future:'Planned',result:'Result',points:'points',totalTime:'Total speedup time',futureTools:'Future Tools',checklist:['Check today’s events and time basis','Use reward finder for needed resources','Estimate amounts with basic calculators','Review hero/building/gear data','Check season goals and server schedule','Confirm latest in-game details before spending']},
    ja:{loading:'イベントデータを読み込んでいます。',error:'イベントデータを読み込めませんでした。時間をおいて再度お試しください。',empty:'表示するイベントがありません。',all:'すべて',keyword:'検索語',day:'曜日',mode:'モード',activity:'活動',reward:'報酬キーワード',verified:'検証済み',needsVerification:'検証必要',reviewNeeded:'確認必要',sourceImported:'元データ抽出',sample:'サンプルデータ',partial:'一部確認必要',confidence:'信頼度',scoreRules:'スコア項目',sourcePoints:'元データ参考点',pointsPerUnit:'確定点数',unverifiedPoints:'点数検証必要',timeBasis:'時間基準',server:'サーバー',local:'ローカル','source-msk-reset':'元データ時間基準',today:'今日',future:'追加予定',result:'結果',points:'点',totalTime:'合計加速時間',futureTools:'追加予定ツール',checklist:['今日のイベントと時間基準を確認','報酬検索で必要な資源を確認','基本計算機で必要量を確認','英雄/建物/装備データを再確認','シーズン目標とサーバー日程を確認','資源使用前にゲーム内最新情報を確認']},
    'zh-tw':{loading:'正在載入活動資料。',error:'無法載入活動資料，請稍後再試。',empty:'沒有可顯示的活動。',all:'全部',keyword:'關鍵字',day:'星期',mode:'模式',activity:'活動',reward:'獎勵關鍵字',verified:'已驗證',needsVerification:'需要驗證',reviewNeeded:'需要檢查',sourceImported:'原始資料擷取',sample:'範例資料',partial:'部分需檢查',confidence:'可信度',scoreRules:'分數項目',sourcePoints:'原始參考分數',pointsPerUnit:'確定分數',unverifiedPoints:'分數需要驗證',timeBasis:'時間基準',server:'伺服器',local:'本機','source-msk-reset':'原始資料時間基準',today:'今日',future:'預定追加',result:'結果',points:'分數',totalTime:'加速總時間',futureTools:'預定追加工具',checklist:['確認今日活動與時間基準','用獎勵搜尋確認需要的資源','用基本計算器估算數量','重新確認英雄/建築/裝備資料','確認賽季目標與伺服器時程','投入資源前再次確認遊戲內最新資訊']},
    ru:{loading:'Загрузка данных событий.',error:'Не удалось загрузить данные событий. Попробуйте позже.',empty:'Нет событий для показа.',all:'Все',keyword:'Поиск',day:'День',mode:'Режим',activity:'Активность',reward:'Ключевое слово награды',verified:'Проверено',needsVerification:'Нужна проверка',reviewNeeded:'Нужна проверка',sourceImported:'Данные из источника',sample:'Пример данных',partial:'Нужна частичная проверка',confidence:'Уверенность',scoreRules:'Строки очков',sourcePoints:'Очки из источника',pointsPerUnit:'Подтверждённые очки',unverifiedPoints:'Очки требуют проверки',timeBasis:'Время',server:'Сервер',local:'Локальное','source-msk-reset':'Время источника',today:'Сегодня',future:'Планируется',result:'Результат',points:'очков',totalTime:'Всего ускорений',futureTools:'Планируемые инструменты',checklist:['Проверь события на сегодня и время','Найди нужные ресурсы через поиск наград','Оцени количество через базовые калькуляторы','Проверь героев/здания/снаряжение','Сверь сезонные цели и расписание сервера','Перед тратой ресурсов проверь данные в игре']}
  };
  function getLang(){var raw=(document.documentElement.getAttribute('data-lang')||document.documentElement.lang||'ko').toLowerCase();if(raw==='zh_tw'||raw==='zh-tw'||raw==='zh')return 'zh-tw';return SUPPORTED.indexOf(raw)>=0?raw:'ko';}
  function pick(value,lang){return value&&typeof value==='object'&&!Array.isArray(value)?(value[lang]||value.en||value.ko||''):String(value||'');}
  function arr(value){return Array.isArray(value)?value:[];}
  function text(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function todayKey(){var jsDay=new Date().getDay();return DAYS[jsDay===0?6:jsDay-1];}
  function el(id){return document.getElementById(id);}
  function unique(items){return Array.from(new Set(items.filter(Boolean))).sort();}
  function confidenceLabel(ev,ui){if(ev.reviewNeeded)return ui.reviewNeeded;if(ev.confidence==='source-imported')return ui.sourceImported;if(ev.confidence==='partial')return ui.partial;if(ev.confidence==='sample')return ui.sample;return ev.confidence||ui.needsVerification;}
  function timeBasisLabel(value,ui){return ui[value]||value||'';}
  function ruleAction(rule,lang){return pick(rule&&rule.action,lang)||rule.sourceAction||rule.id||'';}
  function ruleSearchText(rule,lang){var tags=rule&&rule.suggestedTags||{};return [ruleAction(rule,lang),rule&&rule.sourceAction,rule&&rule.metric,rule&&rule.sourcePoints].concat(arr(tags.activities),arr(tags.rewards),arr(tags.eventType),arr(tags.scoreMetric)).join(' ');}
  function renderScoreRules(ev,lang,ui){
    var rules=arr(ev.scoreRules);
    if(!rules.length)return '';
    var items=rules.map(function(rule){
      var details=[];
      if(rule.sourcePoints!=null)details.push(text(ui.sourcePoints)+': '+text(rule.sourcePoints)+' ('+text(ui.unverifiedPoints)+')');
      if(rule.pointsPerUnit!=null)details.push(text(ui.pointsPerUnit)+': '+text(rule.pointsPerUnit));
      if(rule.reviewNeeded)details.push(text(ui.reviewNeeded));
      return '<li><strong>'+text(ruleAction(rule,lang))+'</strong>'+(details.length?' <span>'+details.join(' · ')+'</span>':'')+'</li>';
    }).join('');
    return '<details class="eh-score-rules"><summary>'+text(ui.scoreRules)+' ('+rules.length+')</summary><ul>'+items+'</ul></details>';
  }
  function eventCard(ev,lang,ui){
    var verifiedBadge=ev.verified?ui.verified:ui.needsVerification;
    var verifiedCls=ev.verified?'eh-pill':'eh-pill eh-pill-warn';
    var confidence=confidenceLabel(ev,ui);
    var confidenceCls=ev.reviewNeeded||ev.confidence==='partial'||ev.confidence==='sample'?'eh-pill eh-pill-warn':'eh-pill';
    var start=ev.startTime||'';
    var end=ev.endTime||'';
    var time=start||end?text(start)+(end?'-'+text(end):''):text(ui.empty);
    return '<article class="eh-card"><h3>'+text(pick(ev.title,lang))+'</h3><p>'+text(pick(ev.description,lang))+'</p><div class="eh-event-meta"><span class="eh-pill">'+text(pick(ev.mode,lang))+'</span><span class="eh-pill">'+time+'</span><span class="eh-pill">'+text(ui.timeBasis)+': '+text(timeBasisLabel(ev.timeBasis,ui))+'</span><span class="'+verifiedCls+'">'+text(verifiedBadge)+'</span><span class="'+confidenceCls+'">'+text(confidence)+'</span></div>'+renderScoreRules(ev,lang,ui)+'</article>';
  }
  function eventSearchText(ev,lang){
    return [pick(ev.title,lang),pick(ev.description,lang),pick(ev.mode,lang),ev.confidence,ev.dataSource,ev.sourceType].concat(arr(ev.activities),arr(ev.rewards),arr(ev.reviewReasons),arr(ev.scoreRules).map(function(rule){return ruleSearchText(rule,lang);})).join(' ').toLowerCase();
  }
  function eventRewardText(ev,lang){
    return arr(ev.rewards).concat(arr(ev.scoreRules).flatMap(function(rule){var tags=rule.suggestedTags||{};return arr(tags.rewards).concat([ruleAction(rule,lang),rule.sourceAction,rule.metric,rule.sourcePoints]);}),[pick(ev.title,lang),pick(ev.description,lang)]).join(' ').toLowerCase();
  }
  function matches(ev,lang,state){
    var hay=eventSearchText(ev,lang);
    if(state.q&&hay.indexOf(state.q)<0)return false;
    if(state.day&&arr(ev.days).indexOf(state.day)<0)return false;
    if(state.mode&&pick(ev.mode,lang)!==state.mode)return false;
    if(state.activity&&arr(ev.activities).indexOf(state.activity)<0)return false;
    return true;
  }
  function renderSelect(select,items,current,ui,labels){if(!select)return;select.innerHTML='<option value="">'+text(ui.all)+'</option>'+items.map(function(item){var label=labels?labels[item]||item:item;return '<option value="'+text(item)+'" '+(item===current?'selected':'')+'>'+text(label)+'</option>';}).join('');}
  function renderCalculators(data,lang,ui){
    var root=el('ehCalculators');if(!root)return;root.innerHTML='';
    (data.calculators||[]).forEach(function(calc){
      var labels=calc.labels&&calc.labels[lang]||calc.labels.en||{};
      var html='';
      if(calc.type==='powerScore')html='<article class="eh-card"><h3>'+text(labels.title)+'</h3><label class="eh-field"><span>'+text(labels.amount)+'</span><input type="number" min="0" step="1" data-power-amount></label><label class="eh-field"><span>'+text(labels.rate)+'</span><input type="number" min="0" step="0.01" data-power-rate></label><button class="eh-button" type="button" data-power-button>'+text(labels.button)+'</button><div class="eh-calc-result" data-power-result>'+text(ui.result)+': 0 '+text(ui.points)+'</div></article>';
      if(calc.type==='speedupSum')html='<article class="eh-card"><h3>'+text(labels.title)+'</h3><div class="eh-grid"><label class="eh-field"><span>'+text(labels.days)+'</span><input type="number" min="0" step="1" data-speed-days></label><label class="eh-field"><span>'+text(labels.hours)+'</span><input type="number" min="0" step="1" data-speed-hours></label><label class="eh-field"><span>'+text(labels.minutes)+'</span><input type="number" min="0" step="1" data-speed-minutes></label></div><button class="eh-button" type="button" data-speed-button>'+text(labels.button)+'</button><div class="eh-calc-result" data-speed-result>'+text(ui.totalTime)+': 0h 0m</div></article>';
      if(html)root.insertAdjacentHTML('beforeend',html);
    });
    var future=(data.futureTools||[]).map(function(tool){return '<div class="eh-card"><h3>'+text(pick(tool.title,lang))+'</h3><p><span class="eh-pill eh-pill-warn">'+text(ui.future)+'</span></p></div>';}).join('');
    if(future)root.insertAdjacentHTML('beforeend','<article class="eh-card"><h3>'+text(ui.futureTools||'Future Tools')+'</h3><div class="eh-list">'+future+'</div></article>');
    var powerBtn=root.querySelector('[data-power-button]');if(powerBtn)powerBtn.addEventListener('click',function(event){var card=event.currentTarget.closest('.eh-card')||root;var amount=Number((card.querySelector('[data-power-amount]')||{}).value||0);var rate=Number((card.querySelector('[data-power-rate]')||{}).value||0);var result=card.querySelector('[data-power-result]');if(result)result.textContent=ui.result+': '+Math.round(amount*rate).toLocaleString()+' '+ui.points;});
    var speedBtn=root.querySelector('[data-speed-button]');if(speedBtn)speedBtn.addEventListener('click',function(event){var card=event.currentTarget.closest('.eh-card')||root;var d=Number((card.querySelector('[data-speed-days]')||{}).value||0);var h=Number((card.querySelector('[data-speed-hours]')||{}).value||0);var m=Number((card.querySelector('[data-speed-minutes]')||{}).value||0);var total=d*24*60+h*60+m;var result=card.querySelector('[data-speed-result]');if(result)result.textContent=ui.totalTime+': '+Math.floor(total/60).toLocaleString()+'h '+(total%60)+'m';});
  }
  async function init(){
    var lang=getLang();var ui=UI[lang]||UI.ko;
    document.querySelectorAll('[data-eh-label]').forEach(function(node){node.textContent=ui[node.getAttribute('data-eh-label')]||'';});
    document.querySelectorAll('[data-eh-loading]').forEach(function(node){node.textContent=ui.loading;});
    var eventsData,calcData;
    try{
      var res=await Promise.all([fetch('/data/event-helper-events.json',{cache:'no-cache'}),fetch('/data/event-helper-calculators.json',{cache:'no-cache'})]);
      if(!res[0].ok||!res[1].ok)throw new Error('fetch failed');
      eventsData=await res[0].json();calcData=await res[1].json();
    }catch(err){
      document.querySelectorAll('[data-eh-loading],#ehEventResults,#ehWeeklyCalendar,#ehRewardResults,#ehCalculators').forEach(function(node){node.innerHTML='<div class="eh-status eh-error">'+text(ui.error)+'</div>';});
      return;
    }
    var events=arr(eventsData.events);
    if(!events.length)events=arr(eventsData.fallbackSamples);
    var state={q:'',day:'',mode:'',activity:''};
    var dayLabels=DAY_LABELS[lang]||DAY_LABELS.en;var dayMap={};DAYS.forEach(function(d,i){dayMap[d]=dayLabels[i];});
    renderSelect(el('ehDayFilter'),DAYS,'',ui,dayMap);
    renderSelect(el('ehModeFilter'),unique(events.map(function(ev){return pick(ev.mode,lang);})), '', ui);
    renderSelect(el('ehActivityFilter'),unique(events.flatMap(function(ev){return arr(ev.activities);})), '', ui);
    function renderAll(){
      var today=todayKey();
      var todayEvents=events.filter(function(ev){return arr(ev.days).indexOf(today)>=0;});
      var todayRoot=el('ehTodayEvents');if(todayRoot)todayRoot.innerHTML=todayEvents.length?todayEvents.map(function(ev){return eventCard(ev,lang,ui);}).join(''):'<div class="eh-status">'+text(ui.empty)+'</div>';
      var weekly=el('ehWeeklyCalendar');if(weekly)weekly.innerHTML=DAYS.map(function(day,i){var list=events.filter(function(ev){return arr(ev.days).indexOf(day)>=0;}).map(function(ev){var start=ev.startTime||'';var end=ev.endTime||'';return '<div class="eh-mini-event"><strong>'+text(pick(ev.title,lang))+'</strong><span>'+text(start||end?start+(end?'-'+end:''):ui.empty)+'</span></div>';}).join('')||'<div class="eh-mini-event">'+text(ui.empty)+'</div>';return '<div class="eh-day"><div class="eh-day-title">'+text(dayLabels[i])+(day===today?' · '+text(ui.today):'')+'</div>'+list+'</div>';}).join('');
      var filtered=events.filter(function(ev){return matches(ev,lang,state);});
      var results=el('ehEventResults');if(results)results.innerHTML=filtered.length?filtered.map(function(ev){return eventCard(ev,lang,ui);}).join(''):'<div class="eh-status">'+text(ui.empty)+'</div>';
    }
    ['ehSearchInput','ehDayFilter','ehModeFilter','ehActivityFilter'].forEach(function(id){var node=el(id);if(!node)return;node.addEventListener('input',function(){state.q=((el('ehSearchInput')||{}).value||'').toLowerCase().trim();state.day=(el('ehDayFilter')||{}).value||'';state.mode=(el('ehModeFilter')||{}).value||'';state.activity=(el('ehActivityFilter')||{}).value||'';renderAll();});});
    var reward=el('ehRewardInput');if(reward)reward.addEventListener('input',function(){var q=(reward.value||'').toLowerCase().trim();var found=q?events.filter(function(ev){return eventRewardText(ev,lang).indexOf(q)>=0;}):[];var rewardRoot=el('ehRewardResults');if(rewardRoot)rewardRoot.innerHTML=found.length?found.map(function(ev){return eventCard(ev,lang,ui);}).join(''):'<div class="eh-status">'+text(q?ui.empty:ui.reward)+'</div>';});
    var checklist=el('ehChecklist');if(checklist)checklist.innerHTML=ui.checklist.map(function(item){return '<li>'+text(item)+'</li>';}).join('');
    renderCalculators(calcData||{},lang,ui);renderAll();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
