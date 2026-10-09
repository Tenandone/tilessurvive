const fs = require("fs"),
  path = require("path"),
  assert = require("node:assert/strict"),
  crypto = require("crypto");
const { parseHTML } = require("linkedom");
const math = require("../js/platform-math");
const root = path.resolve(__dirname, "..");
let baseline = path.resolve(process.argv[2] || "../audit-source");
if (!fs.existsSync(baseline)) {
  const { execFileSync } = require("child_process");
  baseline = path.join(root, "test-results", "baseline");
  fs.mkdirSync(baseline, { recursive: true });
  const archive = path.join(root, "test-results", "baseline.tar");
  execFileSync(
    "git",
    [
      "archive",
      "--format=tar",
      "--output=" + archive,
      "a4766e36c00c12932ea5d4aceb9e7d323668f77f",
      "ko",
      "en",
      "ja",
      "ru",
      "zh-tw",
      "img",
      "data",
      "config",
      "CNAME",
      "js/tools-speedup-calculator.js",
    ],
    { cwd: root },
  );
  execFileSync("tar", ["-xf", archive, "-C", baseline]);
}
let checks = 0,
  errors = [];
const langs = ["ko", "en", "ja", "ru", "zh-tw"];
function check(condition, message) {
  checks++;
  if (!condition) errors.push(message);
}
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.name === ".git" || e.name === "node_modules"
        ? []
        : e.isDirectory()
          ? walk(path.join(d, e.name))
          : [path.join(d, e.name)],
    );
const text = (n) => n.textContent.replace(/\s+/g, " ").trim();
const tableData = (d) =>
  [...d.querySelectorAll("main table")].map((t) =>
    [...t.querySelectorAll("tr")].map((r) =>
      [...r.querySelectorAll("th,td")].map(text),
    ),
  );
const urls = new Set(),
  refs = [],
  languageEdges = [],
  documents = new Map();
let tables = 0;
for (const l of langs)
  for (const original of walk(path.join(baseline, l)).filter((f) =>
    f.endsWith(".html"),
  )) {
    const rel = path.relative(baseline, original),
      file = path.join(root, rel),
      route = "/" + rel.replaceAll("\\", "/").replace(/index\.html$/, "");
    urls.add(route);
    check(fs.existsSync(file), "URL removed " + route);
    if (!fs.existsSync(file)) continue;
    const old = parseHTML(fs.readFileSync(original, "utf8")).document,
      d = parseHTML(fs.readFileSync(file, "utf8")).document;
    const compact = (value) => value.replace(/\s+/g, "").trim();
    const currentScripts = [...d.querySelectorAll("script:not([src])")].map(
      (s) => compact(s.textContent),
    );
    for (const script of old.querySelectorAll("script:not([src])")) {
      if (script.type === "application/ld+json") continue;
      if (
        /function openDrawer|function updateBottomNavActive|var LANGS\s*=|const LANGS\s*=/.test(
          script.textContent,
        )
      )
        continue;
      check(
        currentScripts.includes(compact(script.textContent)),
        "Inline feature script removed " + route,
      );
    }
    if (/\/(codes|guides\/gift-code-how-to-use)\/$/.test(route)) {
      const app = d.querySelector("script[data-coupon-app]")?.textContent || "";
      check(
        app.includes("loadCoupons") &&
          app.includes("tilessurvive-coupons.json") &&
          app.length > 5000,
        "Coupon application missing " + route,
      );
      try {
        new (require("node:vm").Script)(app);
        check(true, "");
      } catch {
        check(false, "Coupon script syntax " + route);
      }
    }
    if (/\/(heroes|buildings|database|behemoths)\//.test(route)) {
      const content = text(d.querySelector("main"));
      for (const node of old.querySelectorAll(
        "main p,main li,main h2,main h3",
      )) {
        const value = text(node);
        if (value)
          check(
            content.includes(value),
            "Game text removed " + route + " " + value.slice(0, 100),
          );
      }
    }
    check(
      JSON.stringify(tableData(old)) === JSON.stringify(tableData(d)),
      "Table changed " + route,
    );
    tables += d.querySelectorAll("main table").length;
    documents.set(route, d);
    for (const a of d.querySelectorAll("link[rel=alternate][hreflang]"))
      languageEdges.push({
        from: route,
        to: new URL(a.href).pathname,
        lang: a.hreflang || a.getAttribute("hreflang"),
      });
    check(d.querySelectorAll("h1").length === 1, "H1 " + route);
    check(!!d.querySelector("title")?.textContent, "Title " + route);
    check(
      d.querySelector("link[rel=canonical]")?.href ===
        old.querySelector("link[rel=canonical]")?.href,
      "Canonical changed " + route,
    );
    if (!/noindex/.test(d.querySelector("meta[name=robots]")?.content || ""))
      check(
        !!d.querySelector("meta[name=description]")?.content,
        "Description " + route,
      );
    for (const a of d.querySelectorAll("a[href]")) {
      let u;
      try {
        u = new URL(a.getAttribute("href"), "https://tilessurvive.net" + route);
      } catch {
        continue;
      }
      if (u.hostname.includes("lootbar.com"))
        check(
          u.href === "https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive",
          "Affiliate mismatch " + route + " " + u.href,
        );
      if (u.hostname === "tilessurvive.net")
        refs.push({ from: route, to: u.pathname, hash: u.hash });
    }
    for (const el of d.querySelectorAll(
      "script[src],link[rel=stylesheet],img[src]",
    )) {
      const raw = el.getAttribute("src") || el.getAttribute("href");
      if (!raw.startsWith("/")) continue;
      const p = new URL(raw, "https://tilessurvive.net").pathname;
      check(
        fs.existsSync(path.join(root, p)),
        "Missing resource " + route + " " + p,
      );
    }
    for (const meta of d.querySelectorAll(
      'meta[property="og:image"],meta[name="twitter:image"]',
    )) {
      const value = meta.getAttribute("content");
      if (value?.startsWith("https://tilessurvive.net/"))
        check(
          fs.existsSync(path.join(root, new URL(value).pathname)),
          "Social image missing " + route,
        );
    }
    check(
      d.querySelectorAll(".ts-header").length === 1,
      "Shell count " + route,
    );
  }
for (const ref of refs)
  check(
    urls.has(ref.to) || fs.existsSync(path.join(root, ref.to)),
    "Internal URL " + ref.from + " " + ref.to,
  );
for (const e of languageEdges) {
  check(urls.has(e.to), "Hreflang missing " + e.to);
  if (e.lang !== "x-default") {
    const target = documents.get(e.to);
    check(
      !!target &&
        [...target.querySelectorAll("link[rel=alternate][hreflang]")].some(
          (a) => new URL(a.href).pathname === e.from,
        ),
      "Nonreciprocal " + e.from + " " + e.to,
    );
  }
}
const hash = (f) =>
  crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
for (const f of walk(path.join(baseline, "img"))) {
  check(
    fs.existsSync(path.join(root, path.relative(baseline, f))) &&
      hash(f) === hash(path.join(root, path.relative(baseline, f))),
    "Image asset changed " + f,
  );
}
for (const f of walk(path.join(baseline, "data")).filter(
  (f) => f.endsWith(".json") && !f.endsWith("search-index.json"),
))
  check(
    hash(f) === hash(path.join(root, path.relative(baseline, f))),
    "Game JSON changed " + f,
  );
check(
  hash(path.join(root, "js/tools-speedup-calculator.js")) ===
    hash(path.join(baseline, "js/tools-speedup-calculator.js")),
  "Existing speedup formula changed",
);
check(
  hash(path.join(root, "config/affiliate.json")) ===
    hash(path.join(baseline, "config/affiliate.json")),
  "Affiliate config changed",
);
check(
  hash(path.join(root, "CNAME")) === hash(path.join(baseline, "CNAME")),
  "Domain changed",
);
assert.equal(math.amount("81M"), 81000000);
assert.equal(math.amount("1.8K"), 1800);
assert.equal(math.amount("-"), null);
assert.equal(math.minutes("18일 8시간 22분"), 26422);
assert.equal(math.minutes("unknown"), null);
const power = parseHTML(
  fs.readFileSync(
    path.join(root, "ko/buildings/power-plant/index.html"),
    "utf8",
  ),
).document;
const rows = [...power.querySelectorAll("table:first-of-type tbody tr")]
  .filter((r) => r.children.length === 8)
  .map((r) => ({
    level: Number(r.children[0].textContent),
    cells: [...r.children].map(text),
  }));
assert.deepEqual(math.sumRange(rows, 24, 25, [2, 3, 4, 5], 6), {
  totals: [81000000, 81000000, 4000000, 16000000],
  time: 26422,
  levels: [25],
});
assert.deepEqual(math.sumRange(rows, 25, 25, [2, 3, 4, 5], 6), {
  totals: [0, 0, 0, 0],
  time: 0,
  levels: [],
});
assert.throws(() => math.sumRange(rows, 26, 25, [2, 3], 6));
assert.throws(() => math.sumRange(rows, 1, 2, [2, 3], 6));
checks += 9;
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
check(sitemap.includes("/en/heroes/tazan/"), "Missing canonical in sitemap");
check(!sitemap.includes("/en/heroes/tarzan/"), "Noindex alias in sitemap");
check(sitemap.includes('<loc>https://tilessurvive.net/</loc>'), 'Root entry missing from sitemap');
check(sitemap.includes('/tiktok-live-match/'), 'Existing non-language page missing from sitemap');
const css = fs.readFileSync(path.join(root, "css/platform.css"), "utf8");
check(
  /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css),
  "Reduced motion rule missing",
);
const result = { checks, pages: urls.size, tables, errors };
const out = process.env.TS_TEST_RESULT;
if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exitCode = errors.length ? 1 : 0;
