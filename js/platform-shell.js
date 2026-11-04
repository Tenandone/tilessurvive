(function () {
  "use strict";
  const locales = window.TS_LOCALES;
  const lang = locales ? locales.current() : document.documentElement.dataset.lang || "en";
  const resolve = (l) => {
    if (locales) return locales.resolvePageUrl(l);
    const link = [...document.querySelectorAll('.ts-header a[hreflang]')]
      .find((a) => a.getAttribute("hreflang").toLowerCase() === String(l).toLowerCase());
    if (!link) return null;
    const url = new URL(link.getAttribute("href"), location.href);
    if (location.search) url.search = location.search;
    if (location.hash) url.hash = location.hash;
    return url.pathname + url.search + url.hash;
  };
  window.TS_LANG = {
    current: () => lang,
    normalize: (l) => locales ? locales.normalize(l) || locales.defaultLocale : (window.TS_COPY[l] ? l : "en"),
    url: resolve,
    apply: (l) => {
      const url = resolve(l);
      if (url) location.href = url;
      return !!url;
    },
  };
  const menus = [...document.querySelectorAll(".ts-header details")];
  function refreshLanguageLink(a) {
    const url = resolve(a.getAttribute("hreflang"));
    if (url) {
      a.href = url;
      a.removeAttribute("aria-disabled");
      a.removeAttribute("tabindex");
    } else {
      a.removeAttribute("href");
      a.setAttribute("aria-disabled", "true");
      a.tabIndex = -1;
    }
    return url;
  }
  const languageLinks = [...document.querySelectorAll(".ts-header a[hreflang]")];
  menus.forEach((menu) =>
    menu.addEventListener("toggle", () => {
      if (menu.open) {
        languageLinks.forEach(refreshLanguageLink);
        menus.filter((m) => m !== menu).forEach((m) => (m.open = false));
      }
    }),
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      menus
        .filter((m) => m.open)
        .forEach((m) => {
          m.open = false;
          m.querySelector("summary").focus();
        });
  });
  document.addEventListener("click", (e) =>
    menus
      .filter((m) => m.open && !m.contains(e.target))
      .forEach((m) => (m.open = false)),
  );
  languageLinks.forEach((a) => {
    refreshLanguageLink(a);
    // Planners and search update the URL after load. Resolve at interaction time.
    a.addEventListener("click", (event) => {
      if (!refreshLanguageLink(a)) event.preventDefault();
    });
  });
})();
