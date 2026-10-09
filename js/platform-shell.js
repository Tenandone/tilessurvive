(function () {
  "use strict";
  const lang = document.documentElement.dataset.lang || "en";
  window.TS_LANG = {
    current: () => lang,
    normalize: (l) => (window.TS_COPY[l] ? l : "en"),
    apply: (l) => {
      const link = document.querySelector('.ts-header a[hreflang="' + l + '"]');
      if (link) location.href = link.getAttribute("href") + location.search;
    },
  };
  const menus = [...document.querySelectorAll(".ts-header details")];
  menus.forEach((menu) =>
    menu.addEventListener("toggle", () => {
      if (menu.open)
        menus.filter((m) => m !== menu).forEach((m) => (m.open = false));
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
  document.querySelectorAll(".ts-header a[hreflang]").forEach((a) => {
    a.href = a.getAttribute("href") + location.search;
  });
})();
