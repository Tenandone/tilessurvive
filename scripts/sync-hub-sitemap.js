const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const file = path.join(ROOT, "sitemap.xml");
let xml = fs.readFileSync(file, "utf8");
const langs = ["ko","en","ja","zh-tw","ru"];
const slugs = ["updates","top-up","search","contact","terms","affiliate-disclosure","about","privacy","events","seasons/season-4"];
const urls = langs.flatMap((lang) => slugs.map((slug) => `https://tilessurvive.net/${lang}/${slug}/`));

for (const url of urls) {
  if (xml.includes(`<loc>${url}</loc>`)) continue;
  xml = xml.replace(/\s*<\/urlset>\s*$/, `\n  <url>\n    <loc>${url}</loc>\n  </url>\n</urlset>\n`);
}

fs.writeFileSync(file, xml, "utf8");
console.log(`Ensured ${urls.length} hub URLs in sitemap.xml.`);
