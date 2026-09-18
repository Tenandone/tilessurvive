const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const copy = {
  ko: "할인·리워드가 정리된 충전 허브 보기",
  en: "Open the top-up discount and rewards hub",
  ja: "割引・リワードのチャージハブを見る",
  "zh-tw": "查看儲值折扣與獎勵中心",
  ru: "Открыть центр скидок и наград за пополнение"
};

for (const [lang, label] of Object.entries(copy)) {
  for (const slug of ["discount-topup", "discount-topup-promotion"]) {
    const file = path.join(ROOT, lang, "guides", slug, "index.html");
    let html = fs.readFileSync(file, "utf8");
    if (html.includes("data-topup-hub-link")) continue;

    const link = `<a data-topup-hub-link class="${slug === "discount-topup-promotion" ? "pill" : "btn"}" href="/${lang}/top-up/">${label}</a>`;
    if (html.includes('<div class="related">')) {
      html = html.replace('<div class="related">', `<div class="related">\n          ${link}`);
    } else {
      html = html.replace("</main>", `    <div class="cta-row" data-topup-hub-entry>${link}</div>\n  </main>`);
    }
    fs.writeFileSync(file, html, "utf8");
  }
}

console.log("Linked high-intent top-up guides to the top-up hub.");
