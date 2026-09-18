const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const aliases = [
  ["en/calculators", "/en/tools/", "Calculators moved to Tools"],
  ["ja/calculators", "/ja/tools/", "計算ツールはツールページに移動しました"],
  ["ko/calculators", "/ko/tools/", "계산기는 도구 페이지로 이동했습니다"],
  ["ru/calculators", "/ru/tools/", "Калькуляторы перенесены в инструменты"],
  ["zh-tw/calculators", "/zh-tw/tools/", "計算器已移至工具頁面"],
  ["en/heroes/tarzan", "/en/heroes/tazan/", "Tarzan hero page"],
  ["zh-tw/heroes/cnay", "/zh-tw/heroes/candy/", "Candy 英雄頁面"],
  ["en/behemoths/tidal-drake", "/en/behemoths/marine-drake/", "Tidal Drake page"]
];

for (const [relative, target, title] of aliases) {
  const dir = path.join(ROOT, relative);
  fs.mkdirSync(dir, { recursive: true });
  const lang = relative.split("/")[0];
  const canonical = `https://tilessurvive.net${target}`;
  const html = `<!doctype html>\n<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${canonical}"><title>${title} | TilesSurvive.net</title></head><body><main><h1>${title}</h1><p><a href="${target}">Continue</a></p></main></body></html>\n`;
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
}
console.log(`Built ${aliases.length} legacy URL aliases.`);
