const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LANGS = ["ko", "en", "ja", "ru", "zh-tw"];
const items = [];
const officialCharacters = require('./lib/official-locales-40');
const characterRoutes = new Map(LANGS.flatMap(lang => officialCharacters.entries(lang).map(entry => [entry.route, entry])));

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
        if (title) {
          const item={ language, type: pageType(parts), title, description, url: `/${relative}` };
          const entity=characterRoutes.get(item.url);
          if(entity)item.aliases=[...new Set(entity.names)].join(' ');
          items.push(item);
        }
      }
    }
  }
}

// Index curated item anchors as well as pages; never index the private extraction corpus.
const explorer = require('../data/foundation-40/explorer.json');
const explorerCopy = require('../data/foundation-40/explorer-copy.js');
const itemUseText = require('./lib/item-use-text-40');
for (const language of LANGS) {
  const page = path.join(ROOT, language, 'database/items/index.html');
  if (!fs.existsSync(page)) continue;
  const html = fs.readFileSync(page, 'utf8');
  for (const item of explorer.items) {
    if (!html.includes(`id="${item.id}"`)) throw new Error(`Missing item anchor: ${language}/${item.id}`);
    const t = explorerCopy[language];
    items.push({language, type: 'database', title: t[item.id], description: `${item.nameKo} · ${itemUseText(item,language)} · ${t.itemTitle}`, url: `/${language}/database/items/#${item.id}`});
  }
}
// Add exact, visible comparison destinations; keep every existing entry unchanged.
for (const item of require('./lib/search-additions-41').entries()) {
  const [route, anchor] = item.url.split('#');
  const page = path.join(ROOT, route, 'index.html');
  if (!fs.existsSync(page) || !fs.readFileSync(page, 'utf8').includes(`id="${anchor}"`)) throw new Error(`Missing reviewed search anchor: ${item.url}`);
  items.push(item);
}
// These descriptions are already visible on the six reviewed pet detail pages.
const petSkills = require('../data/foundation-40/pet-skills-41.json');
const petNames = require('../data/foundation-40/official-character-locales.json').pets;
for (const language of LANGS) for (const skill of petSkills.skills) {
  const route = `/${language}/database/pet-system/${skill.pet}/`;
  const anchor = `pet-skill-${skill.slot}-41`;
  const html = fs.readFileSync(path.join(ROOT, route, 'index.html'), 'utf8');
  if (!html.includes(`id="${anchor}"`)) throw new Error(`Missing pet skill anchor: ${route}#${anchor}`);
  const pet = petNames.find(p => p.id === skill.pet);
  if (!pet || skill.level !== 1) throw new Error('Unreviewed pet skill search record');
  items.push({ language, type: 'database', title: `${pet.names[language]} · ${skill.names[language]}`,
    description: `Lv.1 · ${skill.description[language]}`, url: `${route}#${anchor}` });
}
items.sort((a, b) => a.language.localeCompare(b.language) || a.title.localeCompare(b.title));
const output = { generatedAt: new Date().toISOString(), itemCount: items.length, items };
const target = path.join(ROOT, "data", "search-index.json");
if (fs.existsSync(target)) {
  const previous = JSON.parse(fs.readFileSync(target, "utf8"));
  // generatedAt is the content update time, not the time of a no-op rebuild.
  if (typeof previous.generatedAt === "string" && Number.isFinite(Date.parse(previous.generatedAt)) && previous.itemCount === output.itemCount && JSON.stringify(previous.items) === JSON.stringify(items)) output.generatedAt = previous.generatedAt;
}
const serialized = `${JSON.stringify(output, null, 2)}\n`;
if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== serialized) fs.writeFileSync(target, serialized, "utf8");
console.log(`Built search index with ${items.length} pages.`);
