'use strict';

// Shared page and interaction copy. Calendar calculations always use UTC.
module.exports = {
  ko: {
    title:'이벤트 캘린더', description:'군비 경쟁·동맹 대결·거북이 경주의 반복 패턴, 미션 점수와 보상을 비교하고 UTC 기준 개인 참고 일정을 만드세요.',
    intro:'주간 패턴과 미션을 살펴보고, 시작 기준을 알고 있다면 개인 참고 일정으로 연결하세요.',
    disclaimer:'이벤트 일정은 매주 반복되는 패턴을 기준으로 제공하며, 서버 및 게임 운영 상황에 따라 실제 일정이 달라질 수 있습니다.',
    home:'홈', events:'이벤트', event:'이벤트', profile:'참고 프로필', timezone:'시간 표시', utc:'UTC', korea:'한국시간 · UTC+9', local:'내 현지 시간',
    pattern:'반복 패턴', day:'{n}일차', slot:'구간', personalAnchor:'개인 참고 일정 설정', anchorHelp:'게임에서 확인한 패턴 1일차 시작 요일·시각을 UTC로 입력하세요. 이 브라우저에 저장되며 공식 서버 일정으로 사용되지 않습니다.', weekday:'시작 요일 · UTC', hour:'시작 시각 · UTC', apply:'참고 일정 적용', reset:'기준값 삭제',
    weekdays:['일요일','월요일','화요일','수요일','목요일','금요일','토요일'],
    today:'오늘', tomorrow:'내일', sevenDays:'7일 미리보기', current:'현재 구간', next:'다음 구간', countdown:'남은 시간', startsIn:'시작까지', endsIn:'종료까지',
    noAnchor:'시작 기준이 설정되지 않아 1일차~7일차 패턴을 표시합니다.', referenceSchedule:'개인 참고 일정', unknownTiming:'이 프로필은 단계별 시각이 확정되지 않아 날짜·카운트다운을 제공하지 않습니다.',
    missions:'미션', points:'점수', rewards:'보상', quantity:'수량', total:'합계 점수', calculator:'점수 계산', related:'관련 공략·계산기', allPatterns:'패턴·미션 자료', details:'상세 보기', sourcePattern:'게임 데이터의 패턴 순서',
    anchorSaved:'개인 참고 일정을 적용했습니다.', anchorRemoved:'기준값을 삭제했습니다. 날짜 없는 패턴을 표시합니다.', errorAnchor:'UTC 요일과 00:00~23:59 시각을 입력하세요.', errorQuantity:'수량은 0 이상의 정수로 입력하세요.',
    tier:'등급', season:'시즌', level:'경쟁 레벨', firstCycle:'첫 회차', repeatCycle:'반복 회차', duration:'길이', hours:'{n}시간', minutes:'{n}분', phase:'단계', target:'목표 점수', remaining:'남은 점수',
    profileNote:'실제 적용되는 등급·시즌·보상은 게임의 해당 이벤트에서 확인하세요.', rewardNote:'선택한 프로필의 단계별 보상입니다. 단계 간 자동 누적 합계가 아닙니다.',
    empty:'해당 구간에 표시할 일정이 없습니다.', noRewards:'이 프로필에 연결된 보상표는 아직 제공하지 않습니다.', noCalculator:'이 프로필의 점수 계산은 아직 제공하지 않습니다.', noMission:'이 단계에 연결된 미션 표는 아직 제공하지 않습니다.',
    schedule:'일정', start:'시작', end:'종료', action:'행동', unit:'단위', scorePerUnit:'단위당 점수', calculated:'계산 결과', guide:'공략', eventDetails:'이벤트 상세', patternOnly:'날짜 없는 패턴', noScript:'날짜 연결과 계산기는 JavaScript가 필요합니다. 아래 패턴과 미션 자료는 바로 읽을 수 있습니다.',
    anchorScope:'기준값은 이벤트별로 저장됩니다. 시간대 선택은 표시만 바꾸며 계산은 UTC를 따릅니다.', unordered:'순서나 단계별 지속시간이 확정되지 않은 항목은 일정에 배치하지 않습니다.', selected:'선택됨', showReference:'패턴과 점수표 전체 보기', rewardsAt:'{n}점 보상', archived:'참고 자료', localStorageUnavailable:'브라우저 저장을 사용할 수 없어 이 페이지에서만 적용됩니다.', weekly:'주간 반복', profileScope:'적용 범위', important:'안내',
    legend:'활동', zeroDuration:'전환 단계', futureUnavailable:'기준 시각을 설정하면 날짜별 미리보기가 열립니다.', elapsed:'지남', remove:'삭제', resetQuantities:'수량 초기화', amountNeeded:'필요 수량'
  },
  en: {
    title:'Event calendar', description:'Compare weekly Power Play, Alliance Duel and Turbo Turtle patterns, mission points and rewards, and build a personal reference schedule in UTC.',
    intro:'Explore weekly patterns and missions. If you know when a pattern starts, connect it to your personal reference schedule.',
    disclaimer:'Event schedules follow weekly repeating patterns. Actual schedules may vary by server and game operations.',
    home:'Home', events:'Events', event:'Event', profile:'Reference profile', timezone:'Display time zone', utc:'UTC', korea:'Korea · UTC+9', local:'My local time',
    pattern:'Repeating pattern', day:'Day {n}', slot:'Slot', personalAnchor:'Personal reference schedule', anchorHelp:'Enter the UTC weekday and time when Day 1 begins in your game. This is saved in this browser and is not an official server schedule.', weekday:'Start weekday · UTC', hour:'Start time · UTC', apply:'Apply reference schedule', reset:'Clear start setting',
    weekdays:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
    today:'Today', tomorrow:'Tomorrow', sevenDays:'Next 7 days', current:'Current phase', next:'Next phase', countdown:'Time remaining', startsIn:'Starts in', endsIn:'Ends in',
    noAnchor:'No start setting is saved. Showing the Day 1–7 pattern.', referenceSchedule:'Personal reference schedule', unknownTiming:'Phase times for this profile are not established, so dated previews and countdowns are unavailable.',
    missions:'Missions', points:'Points', rewards:'Rewards', quantity:'Quantity', total:'Total points', calculator:'Point calculator', related:'Related guides and calculators', allPatterns:'Patterns and missions', details:'View details', sourcePattern:'Pattern order from game data',
    anchorSaved:'Personal reference schedule applied.', anchorRemoved:'Start setting cleared. Showing the undated pattern.', errorAnchor:'Choose a UTC weekday and a time from 00:00 to 23:59.', errorQuantity:'Enter a whole number of 0 or more.',
    tier:'Rank', season:'Season', level:'Competition level', firstCycle:'First cycle', repeatCycle:'Repeat cycle', duration:'Duration', hours:'{n} hours', minutes:'{n} minutes', phase:'Phase', target:'Target points', remaining:'Points remaining',
    profileNote:'Check the event in your game for the applicable rank, season and rewards.', rewardNote:'Rewards are shown for each threshold in the selected profile, not as a cumulative total.',
    empty:'No scheduled phase to show in this window.', noRewards:'A reward table is not yet available for this profile.', noCalculator:'Point calculations are not yet available for this profile.', noMission:'A mission table is not yet available for this phase.',
    schedule:'Schedule', start:'Start', end:'End', action:'Action', unit:'Unit', scorePerUnit:'Points per unit', calculated:'Result', guide:'Guide', eventDetails:'Event details', patternOnly:'Undated pattern', noScript:'Dated previews and calculators require JavaScript. You can read the patterns and missions below without it.',
    anchorScope:'Start settings are saved for each event. Time zone selection changes the display only; calculations use UTC.', unordered:'Entries without an established order or phase duration are not placed on the timeline.', selected:'Selected', showReference:'View all patterns and point tables', rewardsAt:'Rewards at {n} points', archived:'Reference', localStorageUnavailable:'Browser storage is unavailable. The setting applies only to this page session.', weekly:'Weekly repeat', profileScope:'Applies to', important:'Note',
    legend:'Activity', zeroDuration:'Transition', futureUnavailable:'Set a start time to enable dated previews.', elapsed:'Elapsed', remove:'Remove', resetQuantities:'Reset quantities', amountNeeded:'Quantity needed'
  },
  ja: {
    title:'イベントカレンダー', description:'軍備競争・同盟対決・走るカメさんの週間パターン、ミッションのポイントと報酬を比較し、UTC基準の参考スケジュールを設定できます。',
    intro:'週間パターンとミッションを確認できます。開始基準が分かる場合は、個人用の参考スケジュールに日付を設定してください。',
    disclaimer:'イベント日程は毎週繰り返されるパターンに基づいています。実際の日程はサーバーやゲーム運営の状況によって異なる場合があります。',
    home:'ホーム', events:'イベント', event:'イベント', profile:'参考プロフィール', timezone:'表示タイムゾーン', utc:'UTC', korea:'韓国時間 · UTC+9', local:'現在地の時間',
    pattern:'繰り返しパターン', day:'{n}日目', slot:'時間枠', personalAnchor:'個人用の参考スケジュール', anchorHelp:'ゲームで確認した1日目の開始曜日と時刻をUTCで入力してください。このブラウザーに保存されます。公式のサーバー日程ではありません。', weekday:'開始曜日 · UTC', hour:'開始時刻 · UTC', apply:'参考日程を適用', reset:'開始設定を削除',
    weekdays:['日曜日','月曜日','火曜日','水曜日','木曜日','金曜日','土曜日'],
    today:'今日', tomorrow:'明日', sevenDays:'7日間プレビュー', current:'現在の段階', next:'次の段階', countdown:'残り時間', startsIn:'開始まで', endsIn:'終了まで',
    noAnchor:'開始基準が未設定のため、1〜7日目のパターンを表示しています。', referenceSchedule:'個人用の参考日程', unknownTiming:'このプロフィールは各段階の時刻が確定していないため、日付とカウントダウンを表示できません。',
    missions:'ミッション', points:'ポイント', rewards:'報酬', quantity:'数量', total:'合計ポイント', calculator:'ポイント計算', related:'関連攻略・計算ツール', allPatterns:'パターン・ミッション資料', details:'詳細を見る', sourcePattern:'ゲームデータに基づくパターン順序',
    anchorSaved:'個人用の参考日程を適用しました。', anchorRemoved:'開始設定を削除しました。日付なしのパターンを表示します。', errorAnchor:'UTCの曜日と00:00〜23:59の時刻を入力してください。', errorQuantity:'数量は0以上の整数で入力してください。',
    tier:'ランク', season:'シーズン', level:'競争レベル', firstCycle:'初回', repeatCycle:'繰り返し回', duration:'所要時間', hours:'{n}時間', minutes:'{n}分', phase:'段階', target:'目標ポイント', remaining:'残りポイント',
    profileNote:'適用されるランク・シーズン・報酬はゲーム内の該当イベントで確認してください。', rewardNote:'選択したプロフィールの各段階の報酬です。段階をまたぐ累計ではありません。',
    empty:'この期間に表示できる段階はありません。', noRewards:'このプロフィールの報酬表はまだ提供していません。', noCalculator:'このプロフィールのポイント計算はまだ提供していません。', noMission:'この段階のミッション表はまだ提供していません。',
    schedule:'日程', start:'開始', end:'終了', action:'行動', unit:'単位', scorePerUnit:'単位あたりのポイント', calculated:'計算結果', guide:'攻略', eventDetails:'イベント詳細', patternOnly:'日付なしのパターン', noScript:'日付の設定と計算にはJavaScriptが必要です。以下のパターンとミッション資料はそのまま読めます。',
    anchorScope:'開始設定はイベントごとに保存されます。タイムゾーンは表示のみを変更し、計算はUTCに従います。', unordered:'順序や各段階の長さが確定していない項目は日程に配置しません。', selected:'選択中', showReference:'全パターンとポイント表を見る', rewardsAt:'{n}ポイントの報酬', archived:'参考資料', localStorageUnavailable:'ブラウザーに保存できないため、このページでのみ適用されます。', weekly:'毎週繰り返し', profileScope:'適用範囲', important:'ご案内',
    legend:'活動', zeroDuration:'移行段階', futureUnavailable:'開始時刻を設定すると日付別プレビューを利用できます。', elapsed:'経過', remove:'削除', resetQuantities:'数量をリセット', amountNeeded:'必要数量'
  },
  ru: {
    title:'Календарь событий', description:'Сравнивайте недельные схемы Игры по-крупному, Дуэли союза и Турбочерепашки, задания, очки и награды. Настройте личное справочное расписание по UTC.',
    intro:'Изучайте недельные схемы и задания. Если время начала известно, привяжите схему к личному справочному расписанию.',
    disclaimer:'Расписание основано на еженедельно повторяющихся схемах. Фактические сроки могут отличаться в зависимости от сервера и решений администрации игры.',
    home:'Главная', events:'События', event:'Событие', profile:'Справочный профиль', timezone:'Часовой пояс отображения', utc:'UTC', korea:'Корея · UTC+9', local:'Моё местное время',
    pattern:'Повторяющаяся схема', day:'День {n}', slot:'Интервал', personalAnchor:'Личное справочное расписание', anchorHelp:'Введите день недели и время начала первого дня по UTC, сверившись с игрой. Настройка сохраняется в этом браузере и не является официальным расписанием сервера.', weekday:'День начала · UTC', hour:'Время начала · UTC', apply:'Применить расписание', reset:'Сбросить время начала',
    weekdays:['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'],
    today:'Сегодня', tomorrow:'Завтра', sevenDays:'Ближайшие 7 дней', current:'Текущий этап', next:'Следующий этап', countdown:'Осталось', startsIn:'До начала', endsIn:'До конца',
    noAnchor:'Время начала не задано. Показана схема дней 1–7.', referenceSchedule:'Личное справочное расписание', unknownTiming:'Время этапов этого профиля не установлено: предпросмотр по датам и обратный отсчёт недоступны.',
    missions:'Задания', points:'Очки', rewards:'Награды', quantity:'Количество', total:'Всего очков', calculator:'Калькулятор очков', related:'Гайды и калькуляторы', allPatterns:'Схемы и задания', details:'Подробнее', sourcePattern:'Порядок этапов из данных игры',
    anchorSaved:'Личное справочное расписание применено.', anchorRemoved:'Время начала сброшено. Показана схема без дат.', errorAnchor:'Выберите день недели по UTC и время от 00:00 до 23:59.', errorQuantity:'Введите целое число не меньше 0.',
    tier:'Ранг', season:'Сезон', level:'Уровень соревнования', firstCycle:'Первый цикл', repeatCycle:'Повторный цикл', duration:'Длительность', hours:'{n} ч', minutes:'{n} мин', phase:'Этап', target:'Цель по очкам', remaining:'Осталось очков',
    profileNote:'Действующие ранг, сезон и награды проверяйте в соответствующем событии в игре.', rewardNote:'Показаны награды за каждый порог выбранного профиля, а не их накопленная сумма.',
    empty:'В этом периоде нет этапов для отображения.', noRewards:'Таблица наград для этого профиля пока недоступна.', noCalculator:'Расчёт очков для этого профиля пока недоступен.', noMission:'Таблица заданий для этого этапа пока недоступна.',
    schedule:'Расписание', start:'Начало', end:'Конец', action:'Действие', unit:'Единица', scorePerUnit:'Очки за единицу', calculated:'Результат', guide:'Гайд', eventDetails:'О событии', patternOnly:'Схема без дат', noScript:'Для привязки к датам и расчётов нужен JavaScript. Схемы и задания ниже доступны без него.',
    anchorScope:'Время начала сохраняется для каждого события. Часовой пояс меняет только отображение; расчёты идут по UTC.', unordered:'Записи без установленного порядка или длительности этапов не размещаются на шкале времени.', selected:'Выбрано', showReference:'Все схемы и таблицы очков', rewardsAt:'Награды за {n} очков', archived:'Справка', localStorageUnavailable:'Хранилище браузера недоступно. Настройка действует только на этой странице.', weekly:'Еженедельный повтор', profileScope:'Область применения', important:'Примечание',
    legend:'Активность', zeroDuration:'Переход', futureUnavailable:'Задайте время начала, чтобы открыть предпросмотр по датам.', elapsed:'Прошло', remove:'Удалить', resetQuantities:'Сбросить количество', amountNeeded:'Нужное количество'
  },
  'zh-tw': {
    title:'活動行事曆', description:'比較軍備競賽、聯盟對決與小龜快跑的每週模式、任務積分及獎勵，並以UTC設定個人參考日程。',
    intro:'查看每週模式與任務。若已知模式的開始時間，即可設定個人參考日程。',
    disclaimer:'活動日程依每週重複模式提供；實際日程可能因伺服器及遊戲營運狀況而異。',
    home:'首頁', events:'活動', event:'活動', profile:'參考設定', timezone:'顯示時區', utc:'UTC', korea:'韓國時間 · UTC+9', local:'我的當地時間',
    pattern:'重複模式', day:'第{n}天', slot:'時段', personalAnchor:'個人參考日程', anchorHelp:'請輸入在遊戲中確認的第1天開始星期與時間，以UTC為準。設定會儲存在此瀏覽器，不代表官方伺服器日程。', weekday:'開始星期 · UTC', hour:'開始時間 · UTC', apply:'套用參考日程', reset:'清除開始設定',
    weekdays:['星期日','星期一','星期二','星期三','星期四','星期五','星期六'],
    today:'今天', tomorrow:'明天', sevenDays:'未來7天', current:'目前階段', next:'下一階段', countdown:'剩餘時間', startsIn:'距離開始', endsIn:'距離結束',
    noAnchor:'尚未設定開始基準，目前顯示第1～7天的模式。', referenceSchedule:'個人參考日程', unknownTiming:'此設定的各階段時間尚未確定，因此不提供日期預覽與倒數。',
    missions:'任務', points:'積分', rewards:'獎勵', quantity:'數量', total:'總積分', calculator:'積分計算', related:'相關攻略與計算工具', allPatterns:'模式與任務資料', details:'查看詳情', sourcePattern:'遊戲資料中的模式順序',
    anchorSaved:'已套用個人參考日程。', anchorRemoved:'已清除開始設定，顯示不含日期的模式。', errorAnchor:'請選擇UTC星期及00:00～23:59的時間。', errorQuantity:'數量請輸入0以上的整數。',
    tier:'段位', season:'賽季', level:'競賽等級', firstCycle:'首次循環', repeatCycle:'重複循環', duration:'持續時間', hours:'{n}小時', minutes:'{n}分鐘', phase:'階段', target:'目標積分', remaining:'尚需積分',
    profileNote:'實際適用的段位、賽季與獎勵，請查看遊戲內的該活動。', rewardNote:'以下為所選設定各門檻的獎勵，並非跨階段的累計總量。',
    empty:'此期間沒有可顯示的階段。', noRewards:'此設定尚未提供獎勵表。', noCalculator:'此設定尚未提供積分計算。', noMission:'此階段尚未提供任務表。',
    schedule:'日程', start:'開始', end:'結束', action:'行動', unit:'單位', scorePerUnit:'每單位積分', calculated:'計算結果', guide:'攻略', eventDetails:'活動詳情', patternOnly:'不含日期的模式', noScript:'日期設定與計算工具需要JavaScript。下方模式與任務資料可直接閱讀。',
    anchorScope:'開始設定依活動分別儲存。時區選項只改變顯示，計算仍以UTC為準。', unordered:'順序或階段持續時間尚未確定的項目不會排入時間表。', selected:'已選取', showReference:'查看全部模式與積分表', rewardsAt:'{n}積分獎勵', archived:'參考資料', localStorageUnavailable:'無法使用瀏覽器儲存空間，設定僅在此頁面生效。', weekly:'每週重複', profileScope:'適用範圍', important:'說明',
    legend:'活動', zeroDuration:'轉換階段', futureUnavailable:'設定開始時間後即可查看日期預覽。', elapsed:'已過', remove:'移除', resetQuantities:'重設數量', amountNeeded:'所需數量'
  },
  de: {
    title:'Eventkalender', description:'Vergleiche Wochenmuster, Aufgaben, Punkte und Belohnungen für Rüstungswettlauf, Allianzkampf und Turbo-Schildkröte. Erstelle einen persönlichen Referenzplan auf UTC-Basis.',
    intro:'Entdecke Wochenmuster und Aufgaben. Wenn du den Beginn kennst, kannst du das Muster mit deinem persönlichen Referenzplan verknüpfen.',
    disclaimer:'Die Eventtermine basieren auf wöchentlich wiederkehrenden Mustern. Tatsächliche Termine können je nach Server und Spielbetrieb abweichen.',
    home:'Startseite', events:'Events', event:'Event', profile:'Referenzprofil', timezone:'Anzeigezeitzone', utc:'UTC', korea:'Korea · UTC+9', local:'Meine Ortszeit',
    pattern:'Wiederkehrendes Muster', day:'Tag {n}', slot:'Zeitfenster', personalAnchor:'Persönlicher Referenzplan', anchorHelp:'Gib den im Spiel bestätigten Wochentag und die Startzeit von Tag 1 in UTC ein. Die Einstellung wird in diesem Browser gespeichert und ist kein offizieller Serverplan.', weekday:'Startwochentag · UTC', hour:'Startzeit · UTC', apply:'Referenzplan anwenden', reset:'Startwert löschen',
    weekdays:['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'],
    today:'Heute', tomorrow:'Morgen', sevenDays:'Nächste 7 Tage', current:'Aktuelle Phase', next:'Nächste Phase', countdown:'Verbleibende Zeit', startsIn:'Beginnt in', endsIn:'Endet in',
    noAnchor:'Kein Startwert gespeichert. Das Muster für Tag 1–7 wird angezeigt.', referenceSchedule:'Persönlicher Referenzplan', unknownTiming:'Die Phasenzeiten dieses Profils stehen nicht fest. Daher sind keine datierten Vorschauen oder Countdowns verfügbar.',
    missions:'Aufgaben', points:'Punkte', rewards:'Belohnungen', quantity:'Menge', total:'Gesamtpunkte', calculator:'Punkterechner', related:'Passende Guides und Rechner', allPatterns:'Muster und Aufgaben', details:'Details ansehen', sourcePattern:'Musterreihenfolge aus den Spieldaten',
    anchorSaved:'Persönlicher Referenzplan angewendet.', anchorRemoved:'Startwert gelöscht. Das Muster ohne Datum wird angezeigt.', errorAnchor:'Wähle einen UTC-Wochentag und eine Uhrzeit von 00:00 bis 23:59.', errorQuantity:'Gib eine ganze Zahl ab 0 ein.',
    tier:'Rang', season:'Saison', level:'Wettbewerbsstufe', firstCycle:'Erster Durchlauf', repeatCycle:'Wiederholter Durchlauf', duration:'Dauer', hours:'{n} Std.', minutes:'{n} Min.', phase:'Phase', target:'Zielpunkte', remaining:'Fehlende Punkte',
    profileNote:'Prüfe den geltenden Rang, die Saison und die Belohnungen im jeweiligen Event im Spiel.', rewardNote:'Gezeigt werden die Belohnungen jeder Schwelle im gewählten Profil, keine kumulierte Summe.',
    empty:'Für diesen Zeitraum ist keine Phase verfügbar.', noRewards:'Für dieses Profil ist noch keine Belohnungstabelle verfügbar.', noCalculator:'Für dieses Profil ist noch keine Punkteberechnung verfügbar.', noMission:'Für diese Phase ist noch keine Aufgabentabelle verfügbar.',
    schedule:'Zeitplan', start:'Beginn', end:'Ende', action:'Aktion', unit:'Einheit', scorePerUnit:'Punkte je Einheit', calculated:'Ergebnis', guide:'Guide', eventDetails:'Eventdetails', patternOnly:'Muster ohne Datum', noScript:'Datierte Vorschauen und Rechner benötigen JavaScript. Die Muster und Aufgaben unten sind auch ohne JavaScript lesbar.',
    anchorScope:'Startwerte werden pro Event gespeichert. Die Zeitzone ändert nur die Anzeige; Berechnungen erfolgen in UTC.', unordered:'Einträge ohne feststehende Reihenfolge oder Phasendauer werden nicht im Zeitplan platziert.', selected:'Ausgewählt', showReference:'Alle Muster und Punktetabellen ansehen', rewardsAt:'Belohnungen bei {n} Punkten', archived:'Referenz', localStorageUnavailable:'Der Browserspeicher ist nicht verfügbar. Die Einstellung gilt nur auf dieser Seite.', weekly:'Wöchentliche Wiederholung', profileScope:'Geltungsbereich', important:'Hinweis',
    legend:'Aktivität', zeroDuration:'Übergang', futureUnavailable:'Lege eine Startzeit fest, um datierte Vorschauen zu öffnen.', elapsed:'Vergangen', remove:'Entfernen', resetQuantities:'Mengen zurücksetzen', amountNeeded:'Benötigte Menge'
  }
};

const scheduleCopy = {
  ko: {utcDates:'날짜 탭은 UTC 기준이며 표시 시간대만 바뀝니다.',personalOnly:'설정한 UTC 기준점으로 계산한 개인 참고 일정입니다.',noCurrent:'현재 표시할 구간이 없습니다.',noNext:'다음 구간이 없습니다.',noRules:'이 프로필의 계산 가능한 미션은 아직 제공하지 않습니다.',scoreScope:'선택한 프로필의 행동만 합산합니다. 다른 단계의 점수는 섞지 마세요.',elapsed:'기준 시작 후',showCalendar:'캘린더 열기',anchorUnavailable:'단계별 시각이 확정되지 않아 시작 기준을 설정할 수 없습니다.'},
  en: {utcDates:'Date tabs use UTC. The display time zone does not change their boundaries.',personalOnly:'This personal reference schedule is calculated from your UTC start setting.',noCurrent:'No current phase to show.',noNext:'No next phase to show.',noRules:'Calculable missions are not yet available for this profile.',scoreScope:'Only actions in the selected profile are added. Do not mix points from other phases.',elapsed:'After pattern start',showCalendar:'Open calendar',anchorUnavailable:'A start setting is unavailable because phase times are not established.'},
  ja: {utcDates:'日付タブはUTC基準です。タイムゾーンの選択では表示時刻のみが変わります。',personalOnly:'設定したUTC開始基準から計算した個人用の参考日程です。',noCurrent:'現在表示できる段階はありません。',noNext:'表示できる次の段階はありません。',noRules:'このプロフィールには計算可能なミッションがまだありません。',scoreScope:'選択したプロフィールの行動のみを合算します。他の段階のポイントは混ぜないでください。',elapsed:'パターン開始から',showCalendar:'カレンダーを開く',anchorUnavailable:'各段階の時刻が確定していないため、開始基準は設定できません。'},
  ru: {utcDates:'Даты вкладок определяются по UTC. Выбор часового пояса меняет только отображение времени.',personalOnly:'Личное справочное расписание рассчитано по заданному вами времени начала в UTC.',noCurrent:'Нет текущего этапа для отображения.',noNext:'Нет следующего этапа для отображения.',noRules:'Задания для расчёта этого профиля пока недоступны.',scoreScope:'Суммируются только действия выбранного профиля. Не смешивайте очки разных этапов.',elapsed:'От начала схемы',showCalendar:'Открыть календарь',anchorUnavailable:'Время начала нельзя задать, пока не установлено время этапов.'},
  'zh-tw': {utcDates:'日期分頁以UTC為準；選擇時區只會改變時間的顯示。',personalOnly:'這是依您設定的UTC開始基準計算的個人參考日程。',noCurrent:'目前沒有可顯示的階段。',noNext:'沒有可顯示的下一階段。',noRules:'此設定尚未提供可計算的任務。',scoreScope:'僅加總所選設定的行動，請勿混入其他階段的積分。',elapsed:'模式開始後',showCalendar:'開啟行事曆',anchorUnavailable:'各階段時間尚未確定，因此無法設定開始基準。'},
  de: {utcDates:'Die Datumsauswahl verwendet UTC. Die Zeitzone ändert nur die angezeigte Uhrzeit.',personalOnly:'Dieser persönliche Referenzplan wird aus deinem UTC-Startwert berechnet.',noCurrent:'Keine aktuelle Phase verfügbar.',noNext:'Keine nächste Phase verfügbar.',noRules:'Für dieses Profil sind noch keine berechenbaren Aufgaben verfügbar.',scoreScope:'Nur Aktionen des gewählten Profils werden addiert. Mische keine Punkte aus anderen Phasen.',elapsed:'Seit Musterbeginn',showCalendar:'Kalender öffnen',anchorUnavailable:'Ein Startwert ist erst möglich, wenn die Phasenzeiten feststehen.'}
};
for (const lang of Object.keys(module.exports)) Object.assign(module.exports[lang], scheduleCopy[lang]);
const finalCopy = {
  ko:{phase:'{n}단계',slotOffset:'각 일차 시작 후 경과 시간',hourUnit:'시간',savedLocal:'이 브라우저에 저장됩니다.',invalidData:'이벤트 자료를 불러오지 못했습니다. 아래 자료를 확인해 주세요.'},
  en:{phase:'Phase {n}',slotOffset:'Time elapsed from the start of each day',hourUnit:'hours',savedLocal:'Saved in this browser.',invalidData:'Event data could not be loaded. Please use the reference below.'},
  ja:{phase:'第{n}段階',slotOffset:'各日開始からの経過時間',hourUnit:'時間',savedLocal:'このブラウザーに保存されます。',invalidData:'イベント資料を読み込めませんでした。下の資料をご覧ください。'},
  ru:{phase:'Этап {n}',slotOffset:'Время от начала каждого дня',hourUnit:'ч',savedLocal:'Сохраняется в этом браузере.',invalidData:'Не удалось загрузить данные события. Используйте справочные таблицы ниже.'},
  'zh-tw':{phase:'第{n}階段',slotOffset:'各天開始後的經過時間',hourUnit:'小時',savedLocal:'儲存在此瀏覽器。',invalidData:'無法載入活動資料，請參閱下方資料。'},
  de:{phase:'Phase {n}',slotOffset:'Vergangene Zeit seit Beginn des jeweiligen Tages',hourUnit:'Std.',savedLocal:'Wird in diesem Browser gespeichert.',invalidData:'Die Eventdaten konnten nicht geladen werden. Bitte nutze die Referenz unten.'}
};
for (const lang of Object.keys(module.exports)) Object.assign(module.exports[lang], finalCopy[lang]);
