const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LANGS = ["ko", "en", "ja", "ru", "zh-tw"];
const items = [];

function decode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pageType(parts) {
  if (parts.length < 2) return "home";
  return parts[1] === "guides" ? "guide" : parts[1].replace(/s$/, "");
}

for (const language of LANGS) {
  const langRoot = path.join(ROOT, language);
  const stack = [langRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === "index.html") {
        const html = fs.readFileSync(full, "utf8");
        if (/name=["']robots["'][^>]+noindex/i.test(html)) continue;
        const title = decode((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
        const description = decode((html.match(/<meta\s+name=["']description["'][^>]+content=["']([^"']+)/i) || [])[1]);
        const relative = path.relative(ROOT, full).replace(/\\/g, "/").replace(/index\.html$/, "");
        const parts = relative.split("/").filter(Boolean);
        if (title) items.push({ language, type: pageType(parts), title, description, url: `/${relative}` });
      }
    }
  }
}

items.sort((a, b) => a.language.localeCompare(b.language) || a.title.localeCompare(b.title));
const output = { generatedAt: new Date().toISOString(), itemCount: items.length, items };
fs.writeFileSync(path.join(ROOT, "data", "search-index.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Built search index with ${items.length} pages.`);
