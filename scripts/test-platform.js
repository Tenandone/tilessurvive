const fs = require("fs"),
  path = require("path"),
  assert = require("node:assert/strict"),
  crypto = require("crypto");
const { parseHTML } = require("linkedom");
const math = require("../js/platform-math");
const {exactEditorialReplacement}=require('./ux-301-test-allowances');
const root = path.resolve(__dirname, "..");
let baseline = path.resolve(process.argv[2] || "../renewal");
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
      "591c16693d67cfe8c2e02a41310ce511f35c6088",
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
// Exact legacy directory-only workflow copy intentionally replaced in 3.0.
// Building names, descriptions, art, and routes are asserted independently below.
const obsoleteBuildingWorkflow = new Set([
  "타일서바이벌의 주요 건물을 보기 쉽게 정리한 목록 페이지입니다. 현재 확정된 건물명 기준으로 먼저 구성했으며, 각 상세 페이지는 순차적으로 확장하는 구조입니다.",
  "주방, 제련공방, 정유공방, 목재공방은 요청한 기준대로 마지막 순서에 배치했습니다.",
  "This is a list page that organizes the main buildings of Tiles Survive in a clean and easy-to-browse format. It is currently structured around confirmed building names first, with each detail page expanding step by step.",
  "Following the requested order, Kitchen, Smelter Workshop, Refinery Workshop, and Lumber Workshop are placed at the end.",
  "タイルズサバイバルの主要建物を見やすく整理した一覧ページです。 現在確認できている建物名を基準に先に構成し、各詳細ページは順次拡張していく構造です。",
  "確認済みの日本語名称を基準に、一覧名のみ反映しています。",
  "Это страница со списком ключевых зданий Tiles Survive, собранных в удобном виде. Сначала структура построена на подтверждённых названиях зданий, а подробные страницы будут расширяться поэтапно.",
  "Kitchen, Smelting Workshop, Oil Refinery Workshop и Lumber Workshop размещены в конце списка в соответствии с выбранным порядком.",
  "這是一頁整理 Tiles Survive 主要建築的索引頁面。 目前先以已確認的建築名稱建立結構，詳細頁面會再逐步補齊與擴充。",
  "目前先依照截圖中確認到的日文名稱完成列表名稱對應。",
]);
const obsoleteLabWorkflow = new Set([
  "업그레이드 시트 안내", "현재 확보된 화면 기준으로 핵심 항목만 먼저 정리했습니다.",
  "Upgrade Sheet Notice", "Only the key items confirmed from currently secured screenshots are listed first.",
  "アップグレードシート案内", "現在確保できている画面基準で主要項目のみ先に整理しました。",
  "Информация о таблице улучшения", "Пока собраны только ключевые подтверждённые данные с доступных экранов.",
  "升級表說明", "目前依照已保留的畫面內容，先整理可確認的主要項目。",
]);
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
        // 3.0 removes hidden keyword lists and a superseded 2.0 warning. They
        // are editorial scaffolding, not game facts; test their replacement
        // navigation and real calculator below instead of requiring stale prose.
        if (/\/buildings\/$/.test(route) && node.closest('.visually-hidden-seo')) continue;
        if (/\/buildings\/$/.test(route) && node.localName === 'p' && !node.closest('.building-card') && obsoleteBuildingWorkflow.has(value)) continue;
        if (route.endsWith('/buildings/lab/') && node.parentNode.classList.contains('section-head') && obsoleteLabWorkflow.has(value)) continue;
        if (route.endsWith('/database/skill-book/') && node.hasAttribute('data-data-warning')) continue;
        // The 3.0.1 patch reviews exact route/text replacements only. It cannot
        // exempt an arbitrary game paragraph or numerical table from preservation.
        const replacement=exactEditorialReplacement(rel.replaceAll('\\','/'),value);
        if(replacement.matched){
          check(!replacement.value||content.normalize('NFKC').includes(replacement.value),'Reviewed editorial replacement missing '+route+' '+replacement.value);
          continue;
        }
        // Shark and Lagnar's old text-only advertisements are replaced by one
        // disclosed image banner, with the exact original outbound referral.
        const heroCTA=node.closest('section[aria-labelledby="shark-lootbar-cta"],section[aria-labelledby="lagnar-lootbar-cta"]');
        if(heroCTA&&/^\/(ko|en|ja|ru|zh-tw)\/heroes\/(shark|lagnar)\/$/.test(route)){
          const banner=d.querySelector('[data-lootbar-slot="hero_detail"]');
          check(d.querySelectorAll('[data-lootbar-slot="hero_detail"]').length===1&&banner?.querySelector('a[href]')?.href===heroCTA.querySelector('a[href]')?.href,'Legacy hero ad replaced with preserved referral '+route);
          continue;
        }
        if (value)
          check(
            content.includes(value),
            "Game text removed " + route + " " + value.slice(0, 100),
          );
      }
    }
    if (/\/buildings\/$/.test(route)) {
      const linked=new Set([...d.querySelectorAll('main a[href]')].map(a=>a.getAttribute('href')));
      for(const a of old.querySelectorAll('main a[href]'))if(new RegExp('^/'+l+'/buildings/[^/]+/$').test(a.getAttribute('href')))check(linked.has(a.getAttribute('href')),'Building detail navigation removed '+route+' '+a.getAttribute('href'));
      const entries = [...d.querySelectorAll('main [data-catalog-entry],main .building-card')];
      for (const card of old.querySelectorAll('main .building-card')) {
        const name = text(card.querySelector('h3'));
        const match = entries.find(entry => entry.querySelector('h3') && text(entry.querySelector('h3')) === name);
        check(!!match, 'Building catalog name removed ' + route + ' ' + name);
        if (!match) continue;
        for (const p of card.querySelectorAll('p'))
          check(text(match).includes(text(p)), 'Building catalog description removed ' + route + ' ' + name);
        for (const img of card.querySelectorAll('img[src]'))
          check([...match.querySelectorAll('img[src]')].some(current => current.getAttribute('src') === img.getAttribute('src')), 'Building catalog image changed ' + route + ' ' + name);
        for (const a of card.querySelectorAll('a[href]'))
          check([...match.querySelectorAll('a[href]')].some(current => current.getAttribute('href') === a.getAttribute('href')), 'Building card detail link changed ' + route + ' ' + name);
      }
    }
    if (route.endsWith('/buildings/lab/')) {
      const currentFacts = [...d.querySelectorAll('.info-card p,.priority-card p')].map(text);
      for (const p of old.querySelectorAll('.info-card p,.priority-card p'))
        check(currentFacts.includes(text(p)), 'Lab effect, level, power, or priority paragraph removed ' + route + ' ' + text(p));
    }
    if (route.endsWith('/database/skill-book/')) {
      const form=d.querySelector('[data-growth-form="skillBook"]');check(!!form,'Skill-book calculator replaces obsolete warning '+route);
      if(form){const cfg=JSON.parse(form.querySelector('script[type="application/json"]').textContent);check(cfg.rows.find(r=>r.to===30)?.cost===685,'Skill-book disputed original cost '+route);check(cfg.rows.reduce((sum,r)=>sum+r.cost,0)===23505,'Skill-book cumulative cost '+route);}
      check(text(d.querySelector('main')).includes('685')&&text(d.querySelector('main')).includes('735'),'Skill-book conflict disclosed '+route);
    }
    const originalTables=tableData(old).map(rows=>rows.map(row=>row.map(cell=>route.endsWith('/database/skill-book/')&&cell==='19,850'?'23,505':cell)));
    const currentTables=tableData(d).filter((_,i) => {
      const table=d.querySelectorAll('main table')[i];
      // Newly sourced pet acquisition and growth tables have their own 2.2/3.0
      // source parity checks. The 2.0 pet hub had no table at all.
      return !table.closest('#pet-growth,.ts-database-22') && !(route.endsWith('/database/pet-system/')&&originalTables.length===0);
    });
    // Season III's second legacy table contained only repeated unknown values.
    // Preserve its real price table exactly; keep a concise limitation instead.
    const comparable=rows=>route.endsWith('/seasons/season-3/')?rows.filter(t=>t.slice(1).some(r=>r.some(c=>/\d/.test(c)))):rows;
    check(
      JSON.stringify(comparable(originalTables)) === JSON.stringify(comparable(currentTables)),
      "Table changed " + route,
    );
    if(route.endsWith('/seasons/season-3/'))check(!!d.getElementById('promotionTitle')&&!!d.getElementById('rules-22'),'Season limits and official rules retained '+route);
    if(route.endsWith('/database/pet-system/')){
      const db=require('../data/expansion-22/database.json');
      for(const pet of db.pets)check(!!d.querySelector('a[href="/'+l+'/database/pet-system/'+pet.id+'/"]'),'Pet detail navigation '+route+' '+pet.id);
      check(!!d.querySelector('[data-growth-form="petExp"]')&&!!d.querySelector('[data-growth-form="petTraining"]'),'Pet growth calculators '+route);
    }
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
// Git for Windows may change checkout line endings. Ignore CRLF only; every
// other character in original formulas, configuration and game JSON must match.
const textHash = f => crypto.createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex');
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
    textHash(f) === textHash(path.join(root, path.relative(baseline, f))),
    "Game JSON changed " + f,
  );
check(
  textHash(path.join(root, "js/tools-speedup-calculator.js")) ===
    textHash(path.join(baseline, "js/tools-speedup-calculator.js")),
  "Existing speedup formula changed",
);
check(
  textHash(path.join(root, "config/affiliate.json")) ===
    textHash(path.join(baseline, "config/affiliate.json")),
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
for (const lang of langs) {
  const d = documents.get(`/${lang}/buildings/power-plant/`);
  const localizedRows = [...d.querySelectorAll('table:first-of-type tbody tr')]
    .filter(r => r.children.length === 8)
    .map(r => ({level: Number(r.children[0].textContent), cells: [...r.children].map(text)}));
  assert.deepEqual(math.sumRange(localizedRows, 24, 25, [2, 3, 4, 5], 6), {
    totals: [81000000, 81000000, 4000000, 16000000], time: 26422, levels: [25]
  });
  checks++;
}
for (const [route, d] of documents) if (route.includes('/buildings/')) {
  for (const r of d.querySelectorAll('tbody tr')) if (r.children.length === 8) {
    const value = text(r.children[6]);
    if (value && value !== '-') check(math.minutes(value) !== null, 'Unsupported source time '+route+' '+value);
  }
}
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
