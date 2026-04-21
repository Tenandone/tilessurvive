// /scripts/apply-layout.js

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_LANGS = ["ko", "en", "ja", "zh-tw", "ru"];
const LAYOUT_SCRIPT = '<script src="/js/layout.js"></script>';

function walk(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "components" ||
        entry.name === "js" ||
        entry.name === "scripts"
      ) {
        continue;
      }
      walk(fullPath, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      results.push(fullPath);
    }
  }

  return results;
}

function ensureHeaderPlaceholder(html) {
  if (html.includes('id="site-header"')) return html;

  return html.replace(
    /(<body[^>]*>\s*)(<a[^>]*class="skip-link"[\s\S]*?<\/a>)?/i,
    (match, bodyOpen, skipLink = "") => {
      return `${bodyOpen}${skipLink ? skipLink + "\n\n  " : ""}<div id="site-header"></div>\n`;
    }
  );
}

function ensureFooterPlaceholder(html) {
  if (html.includes('id="site-footer"')) return html;

  return html.replace(
    /<\/body>/i,
    '  <div id="site-footer"></div>\n</body>'
  );
}

function ensureLayoutScript(html) {
  if (html.includes(LAYOUT_SCRIPT)) return html;

  return html.replace(
    /<\/body>/i,
    `  ${LAYOUT_SCRIPT}\n</body>`
  );
}

function processFile(filePath) {
  let html = fs.readFileSync(filePath, "utf8");
  const original = html;

  html = ensureHeaderPlaceholder(html);
  html = ensureFooterPlaceholder(html);
  html = ensureLayoutScript(html);

  if (html !== original) {
    fs.writeFileSync(filePath, html, "utf8");
    console.log(`UPDATED: ${path.relative(ROOT, filePath)}`);
  } else {
    console.log(`SKIPPED: ${path.relative(ROOT, filePath)}`);
  }
}

function main() {
  for (const lang of TARGET_LANGS) {
    const langDir = path.join(ROOT, lang);

    if (!fs.existsSync(langDir)) {
      console.log(`MISSING FOLDER: ${lang}`);
      continue;
    }

    const files = walk(langDir);
    console.log(`\n[${lang}] ${files.length} html files found`);

    for (const file of files) {
      processFile(file);
    }
  }

  console.log("\nDone.");
}

main();