const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const replacements = new Map([
  ["/img/lootbarpc.png", "/img/lootbar/brand.png"],
  ["/img/lootbarmo.png", "/img/lootbar/brand.png"],
  ["/img/heroes/equipment/mike-aegis-of-thunder.webp", "/img/heroes/equipment/mike-thunder-shield.webp"],
  ["/img/heroes/equipment/mike-thunders-might.webp", "/img/heroes/equipment/mike-exclusive-skill.webp"],
  ["/img/heroes/equipment/tarzan-thunderfist.webp", "/img/heroes/equipment/tarzan-thunder-fist.webp"],
  ["/img/heroes/cnay.webp", "/img/heroes/candy.webp"]
]);

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git","node_modules","_sources","blue","makeup"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".html")) files.push(full);
  }
}
walk(ROOT);
for (const file of files) {
  let html = fs.readFileSync(file, "utf8");
  let changed = false;
  for (const [from, to] of replacements) {
    if (!html.includes(from)) continue;
    html = html.split(from).join(to);
    changed = true;
  }
  if (changed) fs.writeFileSync(file, html, "utf8");
}

const slot = path.join(ROOT, "slot", "index.html");
let slotHtml = fs.readFileSync(slot, "utf8");
slotHtml = slotHtml.replace(/\s*<img src="\/img\/cute-event-character\.png"[^>]*>/, "");
slotHtml = slotHtml.replace(/\s*<img\s+class="gift-card-image"\s+src="\/img\/naver-gift\.png"[\s\S]*?\/?>/, "");
fs.writeFileSync(slot, slotHtml, "utf8");
console.log("Fixed known broken local asset references.");
