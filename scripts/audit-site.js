const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LANGS = new Set(["ko", "en", "ja", "ru", "zh-tw"]);
const SKIP_DIRS = new Set([".git", "node_modules", "_sources", "blue", "makeup"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function count(pattern, text) {
  return [...text.matchAll(pattern)].length;
}

function localTarget(href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean || !clean.startsWith("/") || clean.startsWith("//")) return null;
  const decoded = decodeURIComponent(clean);
  const direct = path.join(ROOT, decoded.replace(/^\//, ""));
  return path.extname(direct) ? direct : path.join(direct, "index.html");
}

function auditHtml(file) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const lang = rel.split("/")[0];
  const indexable = LANGS.has(lang) && !/name=["']robots["'][^>]+noindex/i.test(text);
  const issues = [];

  if (indexable) {
    if (!/<title>[^<]+<\/title>/i.test(text)) issues.push("missing title");
    if (!/<meta\s+name=["']description["'][^>]+content=["'][^"']+/i.test(text)) issues.push("missing description");
    if (!/<link\s+rel=["']canonical["'][^>]+href=/i.test(text)) issues.push("missing canonical");
    if (count(/<h1\b/gi, text) !== 1) issues.push(`h1 count ${count(/<h1\b/gi, text)}`);
    if (!/hreflang=["']x-default["']/i.test(text)) issues.push("missing x-default hreflang");
  }

  for (const block of text.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(block[1]); } catch { issues.push("invalid JSON-LD"); }
  }

  if (/href=["']#["']/i.test(text)) issues.push('href="#"');
  if (/\uFFFD/.test(text)) issues.push("replacement character");

  const broken = [];
  for (const match of text.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
    const target = localTarget(match[1]);
    if (target && !fs.existsSync(target)) broken.push(match[1]);
  }
  if (broken.length) issues.push(`broken local refs: ${[...new Set(broken)].join(", ")}`);

  return { rel, issues };
}

const htmlFiles = walk(ROOT).filter((file) => file.endsWith(".html"));
const results = htmlFiles.map(auditHtml);
const failures = results.filter((result) => result.issues.length);

console.log(`Audited ${htmlFiles.length} HTML files.`);
console.log(`Files with issues: ${failures.length}`);
for (const result of failures) console.log(`- ${result.rel}: ${result.issues.join("; ")}`);

if (process.argv.includes("--strict") && failures.length) process.exitCode = 1;
