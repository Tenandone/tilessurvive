const fs = require("node:fs");
const path = require("node:path");

const SOURCE_URL = "https://tilesurvivegame.com/en/list";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "official-updates-detected.json");

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractUpdates(html) {
  const matches = [];
  const pattern = /href="\/en\/blog\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  const seen = new Set();
  let match;

  while ((match = pattern.exec(html)) !== null) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);

    const text = stripTags(match[2]);
    if (!text) continue;

    const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
    matches.push({
      id: `official-${id}`,
      title: text.replace(/^(ANNOUNCEMENTS|GUIDE)\s*/i, "").replace(/\d{2}\/\d{2}\/\d{4}.*/, "").trim(),
      publishedLabel: dateMatch ? dateMatch[1] : null,
      url: `https://tilesurvivegame.com/en/blog/${id}`,
      status: "candidate",
      detectedFrom: SOURCE_URL
    });
  }

  return matches;
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: { "user-agent": "TilesSurvive.net update monitor/1.0" }
  });
  if (!response.ok) throw new Error(`Official source returned ${response.status}`);

  const html = await response.text();
  const items = extractUpdates(html);
  if (!items.length) throw new Error("No official update links were detected; parser review required.");

  const payload = {
    source: SOURCE_URL,
    detectedAt: new Date().toISOString(),
    reviewRequired: true,
    note: "Detection never publishes content automatically. Review candidates against the official article and in-game state before promotion.",
    items
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Detected ${items.length} official update candidates.`);
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
