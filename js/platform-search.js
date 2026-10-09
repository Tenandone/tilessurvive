(function () {
  "use strict";
  const input = document.getElementById("siteSearchInput"),
    results = document.getElementById("siteSearchResults"),
    count = document.getElementById("siteSearchCount");
  if (!input || !results) return;
  const lang = document.documentElement.dataset.lang || "en",
    t = window.TS_COPY[lang] || window.TS_COPY.en;
  let index = [],
    loaded = false;
  const controls = document.createElement("div");
  controls.className = "ts-controls";
  const filter = document.createElement("select"),
    sort = document.createElement("select");
  filter.setAttribute("aria-label", t.filter);
  sort.setAttribute("aria-label", t.sort);
  function opt(value, text) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = text;
    return o;
  }
  filter.append(opt("", t.all));
  sort.append(opt("", t.original), opt("name", t.name));
  controls.append(filter, sort);
  results.before(controls);
  if (count) count.setAttribute("role", "status");
  const normalize = (s) =>
    String(s || "")
      .normalize("NFKC")
      .toLocaleLowerCase(lang);
  function search() {
    if (!loaded) return;
    const q = normalize(input.value).trim(),
      terms = q.split(/\s+/).filter(Boolean);
    let matches = index.filter(
      (i) =>
        (!filter.value || i.type === filter.value) &&
        terms.every((v) =>
          normalize(
            i.title + " " + i.description + " " + (i.aliases || '') + " " + i.type + " " + i.url,
          ).includes(v),
        ),
    );
    if (!q && !filter.value) matches = [];
    matches.sort((a, b) =>
      sort.value === "name"
        ? a.title.localeCompare(b.title, lang)
        : Number(normalize(b.title).includes(q)) -
          Number(normalize(a.title).includes(q)),
    );
    results.replaceChildren();
    if (count)
      count.textContent =
        q || filter.value
          ? matches.length + " " + t.results
          : input.dataset.idle || "";
    for (const item of matches) {
      const article = document.createElement("article"),
        link = document.createElement("a"),
        title = document.createElement("strong"),
        description = document.createElement("span");
      article.className = "search-result";
      link.href = item.url;
      title.textContent = item.title;
      description.textContent = item.description || item.type;
      link.append(title, description);
      article.append(link);
      results.append(article);
    }
    if ((q || filter.value) && !matches.length) {
      const p = document.createElement("p");
      p.textContent = t.noResults;
      results.append(p);
    }
  }
  async function load() {
    if (count) count.textContent = t.loading;
    try {
      const r = await fetch("/data/search-index.json");
      if (!r.ok) throw Error("index");
      const data = await r.json();
      index = (data.items || [])
        .filter((i) => i.language === lang)
        .map((i) => ({
          ...i,
          type:
            {
              heroe: "heroes",
              building: "buildings",
              behemoth: "database",
              code: "codes",
              event: "events",
              "event-helper": "events",
              guide: "guides",
              season: "seasons",
              tool: "tools",
              "top-up": "topup",
              update: "events",
              about: "related",
              contact: "related",
              privacy: "related",
              term: "related",
              "affiliate-disclosure": "affiliate",
              home: "related",
            }[i.type] || i.type,
        }));
      [...new Set(index.map((i) => i.type))]
        .sort()
        .forEach((v) =>
          filter.append(
            opt(
              v,
              {
                heroe: t.heroes,
                building: t.buildings,
                behemoth: t.database,
                code: t.codes,
                event: t.events,
                "event-helper": t.events,
                guide: t.guides,
                season: t.seasons,
                tool: t.tools,
                "top-up": t.topup,
                update: t.events,
                about: t.related,
                contact: t.related,
                privacy: t.related,
                term: t.related,
                "affiliate-disclosure": t.affiliate,
                home: "TilesSurvive",
              }[v] ||
                t[v] ||
                v,
            ),
          ),
        );
      loaded = true;
      search();
    } catch {
      if (count) count.textContent = t.error;
      const retry = document.createElement("button");
      retry.textContent = t.retry;
      retry.type = "button";
      retry.onclick = () => {
        retry.remove();
        load();
      };
      results.append(retry);
    }
  }
  input.value = new URLSearchParams(location.search).get("q") || "";
  input.addEventListener("input", search);
  filter.addEventListener("change", search);
  sort.addEventListener("change", search);
  load();
})();
