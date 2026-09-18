(function () {
  "use strict";

  const input = document.getElementById("siteSearchInput");
  const results = document.getElementById("siteSearchResults");
  const count = document.getElementById("siteSearchCount");
  if (!input || !results) return;

  const lang = (document.documentElement.dataset.lang || document.documentElement.lang || "en").toLowerCase();
  let index = [];

  function normalize(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase(lang);
  }

  function render(items, query) {
    results.replaceChildren();
    if (!query) {
      if (count) count.textContent = input.dataset.idle || "";
      return;
    }

    if (count) count.textContent = `${items.length} ${input.dataset.results || "results"}`;
    for (const item of items.slice(0, 30)) {
      const article = document.createElement("article");
      article.className = "search-result";
      const link = document.createElement("a");
      link.href = item.url;
      const title = document.createElement("strong");
      title.textContent = item.title;
      const description = document.createElement("span");
      description.textContent = item.description || item.type;
      link.append(title, description);
      article.append(link);
      results.append(article);
    }
  }

  function search() {
    const query = normalize(input.value).trim();
    if (!query) return render([], "");
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = index.filter((item) => {
      const haystack = normalize(`${item.title} ${item.description} ${item.type} ${item.url}`);
      return terms.every((term) => haystack.includes(term));
    });
    render(matches, query);
  }

  fetch("/data/search-index.json", { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Search index ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      index = (payload.items || []).filter((item) => item.language === lang);
      const query = new URLSearchParams(location.search).get("q") || "";
      input.value = query;
      search();
    })
    .catch(() => {
      if (count) count.textContent = input.dataset.error || "Search is temporarily unavailable.";
    });

  input.addEventListener("input", search);
})();
