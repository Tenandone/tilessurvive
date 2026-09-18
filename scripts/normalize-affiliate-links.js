const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const affiliate = JSON.parse(fs.readFileSync(path.join(ROOT, "config", "affiliate.json"), "utf8"));
const REFERRAL_URL = affiliate.tilesSurvive.url;
const LEGACY_ORIGIN = `https://${["lootbar", "gg"].join(".")}`;
const CURRENT_ORIGIN = new URL(REFERRAL_URL).origin;
const TEXT_EXTENSIONS = new Set([".html", ".js", ".json", ".md"]);
const SKIP_DIRECTORIES = new Set([".git", "node_modules", "_sources"]);

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_DIRECTORIES.has(entry.name)) return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(target);
    return TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ? [target] : [];
  });
}

function normalizeAnchor(tag, file) {
  if (!tag.includes(`href="${REFERRAL_URL}"`)) return tag;

  let normalized = tag;
  normalized = /\starget="[^"]*"/i.test(normalized)
    ? normalized.replace(/\starget="[^"]*"/i, ' target="_blank"')
    : normalized.replace(/>$/, ' target="_blank">');
  normalized = /\srel="[^"]*"/i.test(normalized)
    ? normalized.replace(/\srel="[^"]*"/i, ' rel="nofollow sponsored noopener noreferrer"')
    : normalized.replace(/>$/, ' rel="nofollow sponsored noopener noreferrer">');

  if (!/data-affiliate-placement=/i.test(normalized)) {
    const relative = path.relative(ROOT, file).replace(/\\/g, "/");
    const placement = relative.includes("/top-up/") ? "topup_primary" : "contextual_primary";
    normalized = normalized.replace(/>$/, ` data-affiliate-placement="${placement}" data-affiliate-campaign="lootbar" data-affiliate-variant="A">`);
  }

  return normalized;
}

let changed = 0;
for (const file of filesIn(ROOT)) {
  const before = fs.readFileSync(file, "utf8");
  let after = before
    .replaceAll(`${LEGACY_ORIGIN}/shop/ten/top-up/tiles-survive`, REFERRAL_URL)
    .replaceAll(`${LEGACY_ORIGIN}/shop/ten`, REFERRAL_URL)
    .replaceAll(`${LEGACY_ORIGIN}/embed.html`, `${CURRENT_ORIGIN}/embed.html`)
    .replaceAll(LEGACY_ORIGIN, CURRENT_ORIGIN)
    .replaceAll(`//${["lootbar", "gg"].join(".")}`, `//${new URL(REFERRAL_URL).hostname}`);

  if (path.extname(file).toLowerCase() === ".html") {
    after = after.replace(/<a\b[^>]*>/gi, (tag) => normalizeAnchor(tag, file));
  }

  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    changed += 1;
  }
}

console.log(`Normalized affiliate links in ${changed} files.`);
