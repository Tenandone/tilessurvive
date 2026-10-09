/* Static enhancement. Existing article text, tables, assets and URLs remain the source. */
const fs = require("fs"),
  path = require("path");
const { parseHTML } = require("linkedom");
const I = require("../js/platform-i18n.js");
const root = path.resolve(__dirname, ".."),
  langs = Object.keys(I),
  origin = "https://tilessurvive.net";
const crypto = require("crypto");
fs.mkdirSync(path.join(root, "css", "content"), { recursive: true });
const { imageSize } = require("image-size");
const dimensions = new Map();
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? walk(path.join(d, e.name))
        : e.name.endsWith(".html")
          ? [path.join(d, e.name)]
          : [],
    );
const files = langs.flatMap((l) => walk(path.join(root, l)));
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
const pages = files.map((file) => {
  const html = fs.readFileSync(file, "utf8"),
    { document } = parseHTML(html);
  const route =
    "/" +
    path
      .relative(root, file)
      .replaceAll("\\", "/")
      .replace(/index\.html$/, "");
  return { file, document, route, lang: route.split("/")[1] };
});
const routes = new Set(pages.map((p) => p.route));
const canonical = (p) =>
  p.document.querySelector("link[rel=canonical]")?.getAttribute("href") ||
  origin + p.route;
const routeFor = (route, lang) => {
  let p = route.replace(/^\/(ko|en|ja|ru|zh-tw)\//, "/" + lang + "/");
  if (p.includes("/heroes/tarzan/") && lang === "en")
    p = p.replace("/tarzan/", "/tazan/");
  if (p.includes("/heroes/tazan/") && lang !== "en")
    p = p.replace("/tazan/", "/tarzan/");
  if (p.includes("/behemoths/tidal-drake/"))
    p = p.replace("/tidal-drake/", "/marine-drake/");
  return routes.has(p) ? p : `/${lang}/`;
};
const footerLabels = {
  ko: ["소개", "문의", "개인정보 처리방침", "이용약관", "제휴 공개"],
  en: ["About", "Contact", "Privacy", "Terms", "Affiliate disclosure"],
  ja: ["紹介", "お問い合わせ", "プライバシー", "利用規約", "広告について"],
  ru: ["О сайте", "Контакты", "Конфиденциальность", "Условия", "Партнёрство"],
  "zh-tw": ["關於", "聯絡", "隱私", "條款", "聯盟揭露"],
};
const navKeys = [
  "heroes",
  "buildings",
  "database",
  "tools",
  "guides",
  "seasons",
  "codes",
  "events",
];
for (const p of pages) {
  const d = p.document,
    t = I[p.lang],
    main = d.querySelector("main");
  if (!main) continue;
  const noindex = /noindex/.test(
    d.querySelector("meta[name=robots]")?.content || "",
  );
  d.documentElement.classList.add("ts-platform");
  d.documentElement.setAttribute("data-lang", p.lang);
  function make(s) {
    const e = d.createElement("template");
    e.innerHTML = s;
    return e.content;
  }
  // Consolidate duplicate layout code only; retain page-specific data/feature scripts.
  for (const s of [...d.querySelectorAll("script:not([src])")]) {
    if (s.type === "application/ld+json") continue;
    if (
      /function openDrawer|function updateBottomNavActive|var LANGS\s*=|const LANGS\s*=/.test(
        s.textContent,
      )
    )
      s.remove();
  }
  d.querySelectorAll(
    "header.site-header,.ts-header,.ts-footer,footer.site-footer,.countdown-bar-wrap,#backdrop,#mobileDrawer,.mobile-bottom-nav,#site-header,#site-footer,.ts-skip,.skip-link",
  ).forEach((n) => n.remove());
  const active = p.route.split("/")[2] || "";
  const header = `<a class="ts-skip" href="${p.route}#main">${t.choose}: ${d.querySelector("h1")?.textContent.trim() || "TilesSurvive"}</a><header class="ts-header"><div class="ts-header-inner"><a class="ts-brand" href="/${p.lang}/"><img src="/img/logo-tilessurvive.png" alt="" width="32" height="32">TilesSurvive<span aria-hidden="true">.</span></a><form class="ts-header-search" action="/${p.lang}/search/" role="search"><input name="q" type="search" aria-label="${t.search}" placeholder="${t.search}" autocomplete="off"><button>${t.search}</button></form><details><summary>${t.menu}</summary><nav class="ts-dropdown" aria-label="${t.menu}">${navKeys.map((k) => `<a href="/${p.lang}/${k}/">${t[k]}</a>`).join("")}<a href="/${p.lang}/top-up/">${t.topup}</a></nav></details><details><summary>${p.lang.toUpperCase()}</summary><nav class="ts-dropdown" aria-label="${t.language}">${langs.map((l) => `<a hreflang="${l}" lang="${l}" href="${routeFor(p.route, l)}" ${l === p.lang ? 'aria-current="page"' : ""}>${{ ko: "한국어", en: "English", ja: "日本語", ru: "Русский", "zh-tw": "繁體中文" }[l]}</a>`).join("")}</nav></details></div><nav class="ts-nav" aria-label="${t.menu}">${navKeys.map((k) => `<a href="/${p.lang}/${k}/" ${active === k ? 'aria-current="page"' : ""}>${t[k]}</a>`).join("")}</nav></header>`;
  d.body.insertBefore(make(header), d.body.firstChild);
  main.id = "main";
  const research = d.createElement("a");
  research.href = `/${p.lang}/buildings/lab/`;
  research.textContent = t.research;
  d.querySelector(".ts-dropdown")?.appendChild(research);
  main.querySelectorAll("[data-platform-related]").forEach((n) => n.remove());
  if (/\/(heroes|buildings|behemoths|database)\//.test(p.route)) {
    const related = d.createElement("nav");
    related.className = "ts-toc";
    related.setAttribute("data-platform-related", "");
    related.setAttribute("aria-label", t.related);
    const targets = [
      ["buildings/lab", t.research],
      ["database/hero-star", t.heroes],
      ["database/exclusive-gear", t.database],
      ["behemoths", t.related],
      ["tools/speedup-calculator", t.tools],
    ];
    for (const [slug, label] of targets) {
      if (routes.has(`/${p.lang}/${slug}/`)) {
        const a = d.createElement("a");
        a.href = `/${p.lang}/${slug}/`;
        a.textContent =
          pages
            .find((x) => x.route === a.getAttribute("href"))
            ?.document.querySelector("h1")
            ?.textContent.trim() || label;
        related.appendChild(a);
      }
    }
    main.appendChild(related);
  }
  const community =
    p.lang === "ko"
      ? ["https://open.kakao.com/o/gako89Wh", "KakaoTalk"]
      : ["https://discord.gg/tiles-survive", "Discord"];
  // Preserve the actual community destination from the existing language component.
  const footerSource = fs.readFileSync(
    path.join(root, "components", p.lang, "footer.html"),
    "utf8",
  );
  const oldDiscord = footerSource.match(
    /https:\/\/(?:discord\.gg|discord\.com)[^"'\s<]+/,
  );
  if (oldDiscord) community[0] = oldDiscord[0];
  d.body.appendChild(
    make(
      `<footer class="ts-footer"><div class="ts-footer-inner"><strong>TilesSurvive.net</strong><a href="/${p.lang}/search/">${t.search}</a><a href="/${p.lang}/codes/">${t.codes}</a><a href="/${p.lang}/top-up/">${t.topup}</a><a href="${community[0]}" rel="noopener noreferrer">${community[1]}</a>${["about", "contact", "privacy", "terms", "affiliate-disclosure"].map((k, i) => `<a href="/${p.lang}/${k}/">${footerLabels[p.lang][i]}</a>`).join("")}</div><small>© 2026 TilesSurvive.net · ${t.affiliate}: LootBar</small></footer>`,
    ),
  );
  // Explicit page fragments coexist with the legacy base element.
  d.querySelectorAll('a[href^="#"]').forEach((a) =>
    a.setAttribute("href", p.route + a.getAttribute("href")),
  );
  d.querySelectorAll(
    'script[src="/js/layout.js"],script[src="/js/site-search.js"],script[src="/js/affiliate-tracking.js"],link[href^="/css/platform.css"],script[data-platform]',
  ).forEach((n) => n.remove());
  d.head.appendChild(
    make('<link rel="stylesheet" href="/css/platform.css?v=3">'),
  );
  for (const style of [...d.querySelectorAll("style")]) {
    const css = style.textContent;
    const hash = crypto
      .createHash("sha256")
      .update(css)
      .digest("hex")
      .slice(0, 16);
    fs.writeFileSync(path.join(root, "css", "content", hash + ".css"), css);
    style.replaceWith(
      make(`<link rel="stylesheet" href="/css/content/${hash}.css">`),
    );
  }
  for (const name of [
    "platform-i18n",
    "platform-math",
    "platform-shell",
    "platform",
    "platform-search",
    "platform-affiliate",
  ])
    d.body.appendChild(
      make(`<script data-platform src="/js/${name}.js?v=2" defer></script>`),
    );
  // Replace unavailable social image references with an existing page image.
  for (const meta of d.querySelectorAll(
    'meta[property="og:image"],meta[name="twitter:image"]',
  )) {
    const value = meta.getAttribute("content");
    if (
      value &&
      value.startsWith(origin) &&
      !fs.existsSync(path.join(root, new URL(value).pathname))
    ) {
      const img = [...main.querySelectorAll("img[src]")].find((n) =>
        fs.existsSync(path.join(root, n.getAttribute("src"))),
      );
      meta.setAttribute(
        "content",
        origin + (img?.getAttribute("src") || "/img/logo-tilessurvive.png"),
      );
    }
  }
  for (const img of main.querySelectorAll("img")) {
    if (!img.hasAttribute("loading"))
      img.setAttribute(
        "loading",
        img.closest(".hero-media,.home-world-hero") ? "eager" : "lazy",
      );
    img.setAttribute("decoding", "async");
    const src = img.getAttribute("src");
    if (
      src?.startsWith("/") &&
      (!img.hasAttribute("width") || !img.hasAttribute("height"))
    ) {
      try {
        if (!dimensions.has(src))
          dimensions.set(src, imageSize(fs.readFileSync(path.join(root, src))));
        const size = dimensions.get(src);
        img.setAttribute("width", size.width);
        img.setAttribute("height", size.height);
      } catch {}
    }
  }
  for (const table of main.querySelectorAll("table")) {
    table
      .querySelectorAll("thead th")
      .forEach((th) => th.setAttribute("scope", "col"));
    if (!table.parentElement.classList.contains("ts-table-wrap")) {
      const wrap = d.createElement("div");
      wrap.className = "ts-table-wrap";
      wrap.tabIndex = 0;
      wrap.setAttribute("role", "region");
      wrap.setAttribute(
        "aria-label",
        table.closest("section")?.querySelector("h2")?.textContent || t.table,
      );
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    }
    table.setAttribute("data-explore", "");
  }
  if (p.route.includes("/tools/speedup-calculator/"))
    main.setAttribute("data-speedup-calculator-page", "");
  if (
    p.route.includes("/database/skill-book/") &&
    !d.querySelector("[data-data-warning]")
  ) {
    const warning = d.createElement("p");
    warning.className = "ts-warning";
    warning.setAttribute("data-data-warning", "");
    warning.textContent = t.conflict;
    main.insertBefore(warning, main.firstChild);
  }
  // Benefits lack current partner confirmation: remove unconditional discount claims.
  const benefits =
    p.route.includes("/top-up/") || p.route.includes("discount-topup");
  if (benefits) {
    for (const el of [...main.querySelectorAll("*")]) {
      if (el.children.length || ["SCRIPT", "STYLE"].includes(el.tagName))
        continue;
      if (/22\s*%/.test(el.textContent)) el.textContent = t.offer;
    }
    if (p.route.endsWith("/top-up/")) {
      main.querySelector("h1").textContent = t.topup;
      for (const block of [
        ...main.querySelectorAll(".offer-grid,.reward-cycle,.coupon-values"),
      ]) {
        const section = block.closest("section");
        if (section) section.remove();
      }
      for (const faq of [...main.querySelectorAll("details")])
        if (/22\s*%|\$4\.9|\$9\.9|\$99|1.?15|16.?/.test(faq.textContent))
          faq.remove();
    }
    for (const el of d.querySelectorAll("[aria-label]"))
      if (/22\s*%/.test(el.getAttribute("aria-label")))
        el.setAttribute("aria-label", t.topup);
    for (const script of [
      ...d.querySelectorAll('script[type="application/ld+json"]'),
    ]) {
      try {
        const value = JSON.parse(script.textContent);
        if (value["@type"] === "FAQPage") {
          script.remove();
          continue;
        }
        if (value["@type"] === "WebPage") {
          value.name = t.topup;
          value.description = t.offer;
        }
        if (
          value["@type"] === "BreadcrumbList" &&
          value.itemListElement?.length
        )
          value.itemListElement[value.itemListElement.length - 1].name =
            t.topup;
        script.textContent = JSON.stringify(value);
      } catch {}
    }
    for (const m of d.querySelectorAll("meta[content]"))
      if (/22\s*%/.test(m.getAttribute("content")))
        m.setAttribute("content", t.topup + " | TilesSurvive.net");
    if (/22\s*%/.test(d.title)) d.title = t.topup + " | TilesSurvive.net";
    if (p.route.endsWith("/top-up/")) {
      const intro = main.querySelector(".hero-sub,.hero-card p");
      if (intro) intro.textContent = t.offer;
      for (const a of main.querySelectorAll(
        'a[href="https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive"]',
      ))
        a.textContent = "LootBar →";
      for (const detail of main.querySelectorAll("details"))
        if (detail.querySelector("summary")?.textContent === t.offer)
          detail.remove();
      for (const crumb of main.querySelectorAll(
        ".breadcrumb span:last-child,.breadcrumb li:last-child",
      ))
        crumb.textContent = t.topup;
    }
    for (const m of d.querySelectorAll(
      'meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]',
    ))
      m.setAttribute("content", t.offer);
    if (!main.querySelector(".ts-offer-note")) {
      const note = d.createElement("p");
      note.className = "ts-warning ts-offer-note";
      note.textContent = t.offer;
      main.insertBefore(note, main.firstChild);
    }
  }
  for (const timer of main.querySelectorAll("[data-reward-countdown]")) {
    timer.removeAttribute("data-reward-countdown");
    timer.textContent = t.offer;
  }
  // Compact homepage task navigation and move the affiliate surface behind useful content.
  if (p.route === `/${p.lang}/`) {
    if (!main.querySelector(".ts-quick")) {
      const hero = main.querySelector(".home-world-hero");
      hero?.after(
        make(
          `<nav class="ts-quick" aria-label="${t.menu}">${["heroes", "buildings", "database", "tools"].map((k) => `<a href="/${p.lang}/${k}/">${t[k]}</a>`).join("")}</nav>`,
        ),
      );
    }
    const promo = main.querySelector("[data-home-affiliate]");
    if (promo) {
      promo.innerHTML = `<span class="ts-affiliate-label">${t.affiliate} · LootBar</span><h2>${t.topup}</h2><p>${t.offer}</p><a class="ts-affiliate-action" href="/${p.lang}/top-up/" data-affiliate-placement="home_details">${t.topup}</a>`;
      main.appendChild(promo);
    }
  }
  for (const h of main.querySelectorAll(".hero-body h5")) {
    const n = d.createElement("h3");
    n.innerHTML = h.innerHTML;
    h.replaceWith(n);
  }
  // Existing skill text is moved, not rewritten. It remains in the static HTML.
  if (/\/heroes\/[^/]+\/$/.test(p.route)) {
    for (const card of [...main.querySelectorAll(".ability-card")]) {
      const details = d.createElement("details");
      details.className = "ts-skill";
      details.open = true;
      const summary = d.createElement("summary");
      const image = card.querySelector("img");
      if (image) summary.appendChild(image);
      const title = card.querySelector("h3");
      const span = d.createElement("span");
      span.textContent = title?.textContent || t.choose;
      if (title) title.remove();
      summary.appendChild(span);
      const body = d.createElement("div");
      body.className = "ts-skill-body";
      while (card.firstChild) body.appendChild(card.firstChild);
      details.append(summary, body);
      card.replaceWith(details);
    }
  }
  // Stable reciprocal links use canonical destinations; aliases remain available.
  d.querySelectorAll("link[rel=alternate][hreflang]").forEach((n) =>
    n.remove(),
  );
  const self = canonical(p);
  const canonicalPath = new URL(self).pathname;
  for (const l of langs) {
    const r = routeFor(canonicalPath, l);
    const target = pages.find((x) => x.route === r);
    if (target && r.replace(/^\/(ko|en|ja|ru|zh-tw)/, "") !== "/")
      d.head.appendChild(
        make(
          `<link rel="alternate" hreflang="${l}" href="${canonical(target)}">`,
        ),
      );
    else if (canonicalPath === `/${p.lang}/`)
      d.head.appendChild(
        make(`<link rel="alternate" hreflang="${l}" href="${origin}/${l}/">`),
      );
  }
  const en = pages.find((x) => x.route === routeFor(canonicalPath, "en"));
  if (en)
    d.head.appendChild(
      make(
        `<link rel="alternate" hreflang="x-default" href="${canonical(en)}">`,
      ),
    );
  if (canonicalPath !== p.route)
    d.querySelectorAll("link[rel=alternate][hreflang]").forEach((n) =>
      n.remove(),
    );
  fs.writeFileSync(
    p.file,
    "<!DOCTYPE html>\n" + d.documentElement.outerHTML + "\n",
  );
}
const canonicalPages = pages.filter(
  (p) =>
    !/noindex/.test(
      p.document.querySelector("meta[name=robots]")?.content || "",
    ) && canonical(p) === origin + p.route,
);
fs.writeFileSync(
  path.join(root, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    canonicalPages
      .map((p) => `<url><loc>${origin + p.route}</loc></url>`)
      .join("\n") +
    "\n</urlset>\n",
);
console.log(
  `Platform: ${pages.length} pages preserved; ${canonicalPages.length} canonical sitemap URLs.`,
);
