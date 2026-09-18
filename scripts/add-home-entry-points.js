const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const content = {
  ko: {
    hero:["타일서바이벌 데이터·공략 허브","영웅, 시즌, 이벤트, 장비, 가이드와 도구를 빠르게 찾고 공식 업데이트의 핵심 변화를 확인하세요."], title:"빠른 탐색", search:["사이트 검색","영웅, 이벤트, 시즌, 장비와 가이드를 한 번에 찾습니다.","검색하기"], updates:["최신 업데이트","공식 패치노트와 개발자 피드백의 핵심 변경사항을 확인합니다.","업데이트 보기"], topup:["충전 가이드","충전 전 계정, 패키지 효율, 이벤트 시점과 최종 가격을 확인합니다.","가이드 보기"],
    offerLabel:"파트너 혜택", offerTitle:"타일서바이벌 충전 최대 22% 혜택", offerIntro:"월 2회 쿠폰 지급 주기와 누적 충전 리워드를 확인하세요.", period1:"1~15일 충전 → 16일 지급", period2:"16일~말일 충전 → 다음 달 1일 지급", rewards:"월 누적 리워드", countdown:"다음 쿠폰 지급까지", bookmark:"다음 충전 전에 이 페이지를 즐겨찾기해 두세요.", caveat:"할인과 리워드는 패키지, 지역, 통화, 프로모션 및 이용 조건에 따라 달라질 수 있습니다.", offerCta:"충전 리워드 보기"
  },
  en: {
    hero:["The Tiles Survive Data and Guide Hub","Find heroes, seasons, events, gear, guides, and tools quickly, with verified signals from official updates."], title:"Quick access", search:["Site Search","Find heroes, events, seasons, gear, guides, and tools in one place.","Search"], updates:["Latest Updates","Review verified signals from official patch notes and developer feedback.","View Updates"], topup:["Top-Up Guide","Check your account, package value, event timing, and final price before paying.","Read Guide"],
    offerLabel:"Partner Offer", offerTitle:"Save up to 22% on Tile Survive top-ups", offerIntro:"Check the twice-monthly coupon schedule and monthly cumulative rewards.", period1:"Top up days 1-15 → distribution on day 16", period2:"Top up day 16-month end → distribution on the 1st of the next month", rewards:"Monthly cumulative rewards", countdown:"Next coupon distribution", bookmark:"Bookmark our Top-Up page for future rewards.", caveat:"Discounts and rewards vary by package, region, currency, promotion, and eligibility.", offerCta:"View Tile Survive Top-Up Rewards"
  },
  ja: {
    hero:["Tiles Survive データ・攻略ハブ","英雄、シーズン、イベント、装備、ガイド、ツールをすばやく探し、公式アップデートの重要な変更を確認できます。"], title:"クイックアクセス", search:["サイト検索","英雄、イベント、シーズン、装備、ガイドをまとめて検索できます。","検索する"], updates:["最新アップデート","公式パッチノートと開発者フィードバックの重要な変更を確認できます。","更新を見る"], topup:["チャージガイド","支払い前にアカウント、パッケージ価値、イベント時期、最終価格を確認します。","ガイドを見る"],
    offerLabel:"パートナー特典", offerTitle:"Tiles Survive チャージで最大22%お得", offerIntro:"月2回のクーポン配布日程と月間累計特典を確認できます。", period1:"1～15日のチャージ → 16日に配布", period2:"16日～月末のチャージ → 翌月1日に配布", rewards:"月間累計特典", countdown:"次回クーポン配布まで", bookmark:"次回のチャージに備えてこのページをブックマークしてください。", caveat:"割引と特典はパッケージ、地域、通貨、キャンペーン、適用条件により異なります。", offerCta:"チャージ特典を見る"
  },
  "zh-tw": {
    hero:["Tiles Survive 資料與攻略中心","快速查找英雄、賽季、活動、裝備、指南與工具，並掌握官方更新的重要變更。"], title:"快速入口", search:["網站搜尋","一次搜尋英雄、活動、賽季、裝備、指南與工具。","開始搜尋"], updates:["最新更新","查看官方更新公告與開發者回饋的重要變更。","查看更新"], topup:["儲值指南","付款前確認帳號、禮包價值、活動時間與最終價格。","查看指南"],
    offerLabel:"合作夥伴優惠", offerTitle:"Tiles Survive 儲值最高可省22%", offerIntro:"查看每月兩次的優惠券發放週期與月累積獎勵。", period1:"1～15日儲值 → 16日發放", period2:"16日～月底儲值 → 次月1日發放", rewards:"月累積獎勵", countdown:"距離下次優惠券發放", bookmark:"將儲值頁加入書籤，方便下次查看獎勵。", caveat:"折扣與獎勵會依禮包、地區、幣別、活動及適用條件而異。", offerCta:"查看 Tiles Survive 儲值獎勵"
  },
  ru: {
    hero:["Центр данных и руководств Tiles Survive","Быстро находите героев, сезоны, события, снаряжение, руководства и инструменты, а также проверенные официальные обновления."], title:"Быстрый доступ", search:["Поиск по сайту","Ищите героев, события, сезоны, снаряжение, руководства и инструменты.","Искать"], updates:["Последние обновления","Проверяйте подтверждённые изменения из патчноутов и ответов разработчиков.","Обновления"], topup:["Руководство по пополнению","Проверьте аккаунт, набор, время события и итоговую цену перед оплатой.","Открыть"],
    offerLabel:"Предложение партнёра", offerTitle:"Экономия до 22% на пополнении Tile Survive", offerIntro:"Проверьте график выдачи купонов дважды в месяц и накопительные награды.", period1:"Пополнение 1–15 числа → выдача 16 числа", period2:"Пополнение 16–конец месяца → выдача 1 числа следующего месяца", rewards:"Ежемесячные накопительные награды", countdown:"До следующей выдачи купона", bookmark:"Добавьте страницу пополнения в закладки для будущих наград.", caveat:"Скидки и награды зависят от набора, региона, валюты, акции и условий участия.", offerCta:"Посмотреть награды за пополнение"
  }
};

const styles = `<style data-home-affiliate-styles>
.home-affiliate{margin-top:18px;border:1px solid #99d5cd;background:#f4fbfa;box-shadow:0 14px 34px rgba(15,118,110,.08)}
.home-affiliate__head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.home-affiliate__label{display:inline-flex;padding:5px 9px;border-radius:999px;background:#0f766e;color:#fff;font-size:12px;font-weight:900}.home-affiliate h2{margin:9px 0 5px;font-size:clamp(23px,3.5vw,32px);line-height:1.2}.home-affiliate__intro,.home-affiliate__note,.home-affiliate__bookmark{margin:0;color:#475569}.home-affiliate__grid{display:grid;grid-template-columns:1.15fr .85fr;gap:14px;margin-top:18px}.home-affiliate__panel{padding:15px;border:1px solid #c9e7e2;border-radius:14px;background:#fff}.home-affiliate__periods{display:grid;gap:8px;margin-bottom:12px}.home-affiliate__period{font-size:14px;font-weight:800}.home-affiliate__rewards{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.home-affiliate__rewards span{padding:5px 9px;border-radius:9px;background:#ecfdf5;color:#065f46;font-weight:900}.home-affiliate__countdown{display:block;margin-top:5px;font-size:24px;color:#0f766e;font-weight:900;font-variant-numeric:tabular-nums}.home-affiliate__actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px}.home-affiliate__cta{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 17px;border-radius:10px;background:#0f172a;color:#fff;font-weight:900}.home-affiliate__note{margin-top:12px;font-size:12px}.home-affiliate__bookmark{font-size:13px}
@media(max-width:680px){.home-affiliate__head{display:block}.home-affiliate__grid{grid-template-columns:1fr}.home-affiliate__countdown{font-size:21px}.home-affiliate__cta{width:100%}}
</style>`;

function offer(lang, t) {
  return `<section class="home-section section-card home-affiliate" data-home-affiliate data-affiliate-surface="home_top_affiliate" aria-labelledby="homeAffiliateTitle"><div class="home-affiliate__head"><div><span class="home-affiliate__label">${t.offerLabel}</span><h2 id="homeAffiliateTitle">${t.offerTitle}</h2><p class="home-affiliate__intro">${t.offerIntro}</p></div></div><div class="home-affiliate__grid"><div class="home-affiliate__panel"><div class="home-affiliate__periods"><div class="home-affiliate__period">${t.period1}</div><div class="home-affiliate__period">${t.period2}</div></div><strong>${t.rewards}</strong><div class="home-affiliate__rewards" aria-label="${t.rewards}"><span>$4.9</span><span>$9.9</span><span>$99</span></div></div><div class="home-affiliate__panel"><span>${t.countdown}</span><strong class="home-affiliate__countdown" data-reward-countdown>--d --h --m</strong><p class="home-affiliate__bookmark">${t.bookmark}</p></div></div><div class="home-affiliate__actions"><a class="home-affiliate__cta" href="/${lang}/top-up/" data-affiliate-placement="home_top_affiliate" data-affiliate-campaign="topup_hub" data-affiliate-variant="A">${t.offerCta}</a></div><p class="home-affiliate__note">${t.caveat}</p></section>`;
}

function hero(lang, t) {
  return `<section class="hero-card" data-hub-hero><span class="eyebrow">TilesSurvive.net</span><h1>${t.hero[0]}</h1><p>${t.hero[1]}</p><div class="hero-actions"><a class="pill-link" href="/${lang}/search/">${t.search[2]}</a></div></section>`;
}

for (const [lang, t] of Object.entries(content)) {
  const file = path.join(ROOT, lang, "index.html");
  let html = fs.readFileSync(file, "utf8");
  const heroCard = hero(lang, t);
  if (html.includes("data-hub-hero")) html = html.replace(/<section class="hero-card" data-hub-hero>[\s\S]*?<\/section>/, heroCard);
  else html = html.replace(/(<main\b[^>]*>)/, `$1\n    ${heroCard}`);
  if (!html.includes("data-home-affiliate-styles")) html = html.replace("</head>", `${styles}\n</head>`);
  const affiliateCard = offer(lang, t);
  if (/<section[^>]+data-home-affiliate(?:\s|>)/.test(html)) {
    html = html.replace(/<section class="home-section section-card home-affiliate"[\s\S]*?<\/section>/, affiliateCard);
  } else {
    html = html.replace(/(<section class="hero-card" data-hub-hero>[\s\S]*?<\/section>)/, `$1\n    ${affiliateCard}`);
  }
  const card = (slug, item, image) => `<article class="category-card"><a class="category-thumb" href="/${lang}/${slug}/"><img src="${image}" alt="${item[0]}" loading="lazy"></a><div class="category-body"><h3>${item[0]}</h3><p>${item[1]}</p><div class="category-actions"><a class="pill-link" href="/${lang}/${slug}/">${item[2]}</a></div></div></article>`;
  const section = `<section class="home-section section-card" data-hub-entry-points aria-labelledby="hubEntryTitle"><div class="section-head"><div><h2 id="hubEntryTitle">${t.title}</h2></div></div><div class="category-grid">${card("search",t.search,"/img/home/database.png")}${card("updates",t.updates,"/img/home/seasons.png")}${card("top-up",t.topup,"/img/home/guides.png")}</div></section>`;
  if (html.includes("data-hub-entry-points")) html = html.replace(/<section class="home-section section-card" data-hub-entry-points[\s\S]*?<\/section>/, section);
  else html = html.replace("\n  </main>", `\n    ${section}\n\n  </main>`);
  fs.writeFileSync(file, html, "utf8");
}
console.log("Added multilingual home entry points and affiliate offer cards.");
