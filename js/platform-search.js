(function () {
  "use strict";
  const input = document.getElementById("siteSearchInput"),
    results = document.getElementById("siteSearchResults"),
    count = document.getElementById("siteSearchCount");
  if (!input || !results) return;
  const lang = window.TS_LOCALES ? window.TS_LOCALES.current() : document.documentElement.dataset.lang || "en",
    t = window.TS_I18N ? window.TS_I18N.require(lang) : window.TS_COPY[lang];
  if (!t) throw new Error("Missing search translation for " + lang);
  const searchCore = window.TS_V3_SEARCH;
  const initialState = searchCore ? searchCore.readState(location) : {q:new URLSearchParams(location.search).get("q")||"",category:"",sort:""};
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
    let matches = searchCore ? searchCore.rank(index,input.value,{category:filter.value,sort:sort.value,locale:lang}) : index.filter(
      (i) =>
        (!filter.value || i.type === filter.value) &&
        terms.every((v) =>
          normalize(
            i.title + " " + i.description + " " + (i.aliases || '') + " " + i.type + " " + i.url,
          ).includes(v),
        ),
    );
    if (!q && !filter.value) matches = [];
    if(!searchCore)matches.sort((a, b) =>
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
      const r = await fetch(`/data/${searchCore?'v3-search':'search'}/${lang}.json`, { cache: "no-cache" });
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
      if(searchCore){filter.value=[...filter.options].some(o=>o.value===initialState.category)?initialState.category:"";sort.value=initialState.sort;}
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
  function remember(){if(!searchCore)return;const next=searchCore.stateUrl(location,{q:input.value,category:filter.value,sort:sort.value});window.history?.replaceState(null,"",next);searchCore.syncLanguageLinks(document,location,window.TS_LOCALES);}
  function changed(){search();remember();}
  input.value = initialState.q;
  input.addEventListener("input", changed);
  filter.addEventListener("change", changed);
  sort.addEventListener("change", changed);
  if(searchCore){
    document.addEventListener('DOMContentLoaded',()=>searchCore.syncLanguageLinks(document,location,window.TS_LOCALES),{once:true});
    window.addEventListener('popstate',()=>{const state=searchCore.readState(location);input.value=state.q;filter.value=state.category;sort.value=state.sort;search();searchCore.syncLanguageLinks(document,location,window.TS_LOCALES);});
  }
  load();
})();
