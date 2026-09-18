const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const content = {
  ko: { hero:["타일서바이벌 데이터·공략 허브","영웅, 시즌, 이벤트, 장비, 가이드와 도구를 빠르게 찾고 공식 업데이트의 핵심 변화를 확인하세요."], title:"빠른 탐색", search:["사이트 검색","영웅, 이벤트, 시즌, 장비와 가이드를 한 번에 찾습니다.","검색하기"], updates:["최신 업데이트","공식 패치노트와 개발자 피드백의 핵심 변경사항을 확인합니다.","업데이트 보기"], topup:["충전 가이드","충전 전 계정, 패키지 효율, 이벤트 시점과 최종 가격을 확인합니다.","가이드 보기"] },
  en: { hero:["The Tiles Survive Data and Guide Hub","Find heroes, seasons, events, gear, guides, and tools quickly, with verified signals from official updates."], title:"Quick access", search:["Site Search","Find heroes, events, seasons, gear, guides, and tools in one place.","Search"], updates:["Latest Updates","Review verified signals from official patch notes and developer feedback.","View Updates"], topup:["Top-Up Guide","Check your account, package value, event timing, and final price before paying.","Read Guide"] },
  ja: { hero:["Tiles Survive データ・攻略ハブ","英雄、シーズン、イベント、装備、ガイド、ツールをすばやく探し、公式アップデートの重要な変更を確認できます。"], title:"クイックアクセス", search:["サイト検索","英雄、イベント、シーズン、装備、ガイドをまとめて検索できます。","検索する"], updates:["最新アップデート","公式パッチノートと開発者フィードバックの重要な変更を確認できます。","更新を見る"], topup:["チャージガイド","支払い前にアカウント、パッケージ価値、イベント時期、最終価格を確認します。","ガイドを見る"] },
  "zh-tw": { hero:["Tiles Survive 資料與攻略中心","快速查找英雄、賽季、活動、裝備、指南與工具，並掌握官方更新的重要變更。"], title:"快速入口", search:["網站搜尋","一次搜尋英雄、活動、賽季、裝備、指南與工具。","開始搜尋"], updates:["最新更新","查看官方更新公告與開發者回饋的重要變更。","查看更新"], topup:["儲值指南","付款前確認帳號、禮包價值、活動時間與最終價格。","查看指南"] },
  ru: { hero:["Центр данных и руководств Tiles Survive","Быстро находите героев, сезоны, события, снаряжение, руководства и инструменты, а также проверенные официальные обновления."], title:"Быстрый доступ", search:["Поиск по сайту","Ищите героев, события, сезоны, снаряжение, руководства и инструменты.","Искать"], updates:["Последние обновления","Проверяйте подтверждённые изменения из патчноутов и ответов разработчиков.","Обновления"], topup:["Руководство по пополнению","Проверьте аккаунт, набор, время события и итоговую цену перед оплатой.","Открыть"] }
};

for (const [lang, t] of Object.entries(content)) {
  const file = path.join(ROOT, lang, "index.html");
  let html = fs.readFileSync(file, "utf8");
  if (!html.includes("data-hub-hero")) {
    html = html.replace(/(<main\b[^>]*>)/, `$1\n    <section class="hero-card" data-hub-hero><span class="eyebrow">TilesSurvive.net</span><h1>${t.hero[0]}</h1><p>${t.hero[1]}</p></section>`);
  }
  if (html.includes("data-hub-entry-points")) {
    fs.writeFileSync(file, html, "utf8");
    continue;
  }
  const card = (slug, item, image) => `<article class="category-card"><a class="category-thumb" href="/${lang}/${slug}/"><img src="${image}" alt="${item[0]}" loading="lazy"></a><div class="category-body"><h3>${item[0]}</h3><p>${item[1]}</p><div class="category-actions"><a class="pill-link" href="/${lang}/${slug}/">${item[2]}</a></div></div></article>`;
  const section = `\n    <section class="home-section section-card" data-hub-entry-points aria-labelledby="hubEntryTitle"><div class="section-head"><div><h2 id="hubEntryTitle">${t.title}</h2></div></div><div class="category-grid">${card("search",t.search,"/img/home/database.png")}${card("updates",t.updates,"/img/home/seasons.png")}${card("top-up",t.topup,"/img/home/guides.png")}</div></section>\n`;
  html = html.replace("\n  </main>", `${section}\n  </main>`);
  fs.writeFileSync(file, html, "utf8");
}
console.log("Added multilingual home entry points.");
