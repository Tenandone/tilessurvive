(function () {
  "use strict";
  const expected = "https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive",
    lang = document.documentElement.dataset.lang || "en";
  function pageType() {
    const route = location.pathname.replace(/^\/(ko|en|ja|ru|zh-tw)(?=\/)/, "");
    if (/^\/(?:index\.html)?$/.test(route)) return "home";
    if (/^\/heroes\/[^/]+\//.test(route)) return "hero_detail";
    if (/^\/database\/pet-system\/[^/]+\//.test(route)) return "pet_detail";
    if (/^\/codes\//.test(route)) return "coupon";
    if (document.querySelector('[data-growth-form], [data-building-planner]') ||
        /^\/tools\/speedup-calculator\//.test(route)) return "calculator";
    if (/^\/top-up\//.test(route)) return "topup";
    if (/^\/guides\//.test(route)) return "guide";
    return "content";
  }
  function kind(a) {
    if (a.href === expected) return "external";
    if (
      a.hasAttribute("data-affiliate-placement") &&
      new URL(a.href).origin === location.origin
    )
      return "internal";
    return "";
  }
  function emit(event, a) {
    const payload = {
      page: location.pathname,
      page_type: pageType(),
      language: lang,
      placement: a.dataset.affiliatePlacement || "content",
      creative_type: a.classList.contains("ts-lootbar") ? "banner" : "text_link",
      campaign: a.dataset.affiliateCampaign || "lootbar",
      creative_variant: a.dataset.affiliateVariant || "text",
      destination_type: kind(a),
      destination: a.href,
      measurement_version: "3.0.1",
    };
    document.dispatchEvent(
      new CustomEvent("ts-affiliate-event", { detail: { event, ...payload } }),
    );
    if (
      location.hostname === "tilessurvive.net" &&
      typeof window.gtag === "function"
    )
      window.gtag("event", event, payload);
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const k = kind(a);
    if (k)
      emit(k === "external" ? "lootbar_outbound_click" : "topup_guide_open", a);
  });
  document.querySelectorAll("[data-bookmark-cta]").forEach((b) =>
    b.addEventListener("click", () => {
      const hint = document.querySelector("[data-bookmark-hint]");
      if (hint) hint.hidden = false;
    }),
  );
  if (!("IntersectionObserver" in window)) return;
  const steps = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.intersectionRatio >= 0.6) {
          const payload = {
            page: location.pathname,
            language: lang,
            step: e.target.dataset.topupStep,
            measurement_version: "2",
          };
          if (
            location.hostname === "tilessurvive.net" &&
            typeof window.gtag === "function"
          )
            window.gtag("event", "topup_guide_step", payload);
          steps.unobserve(e.target);
        }
      }),
    { threshold: 0.6 },
  );
  document
    .querySelectorAll("[data-topup-step]")
    .forEach((s) => steps.observe(s));
  const observed = new WeakSet(),
    seen = new WeakSet(),
    timers = new Map(),
    ratios = new Map();
  function stop(a) {
    clearTimeout(timers.get(a));
    timers.delete(a);
  }
  function start(a) {
    if (
      document.hidden ||
      seen.has(a) ||
      timers.has(a) ||
      (ratios.get(a) || 0) < 0.6
    )
      return;
    timers.set(
      a,
      setTimeout(() => {
        timers.delete(a);
        if (
          !document.hidden &&
          a.isConnected &&
          (ratios.get(a) || 0) >= 0.6 &&
          !seen.has(a)
        ) {
          seen.add(a);
          emit("affiliate_viewable", a);
          observer.unobserve(a);
          ratios.delete(a);
        }
      }, 1000),
    );
  }
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        ratios.set(e.target, e.intersectionRatio);
        if (e.intersectionRatio >= 0.6) start(e.target);
        else stop(e.target);
      }),
    { threshold: [0, 0.6, 1] },
  );
  function scan(root) {
    const nodes = root.matches?.("a[href]")
      ? [root, ...root.querySelectorAll("a[href]")]
      : [...root.querySelectorAll("a[href]")];
    nodes.forEach((a) => {
      if (kind(a) && !observed.has(a)) {
        observed.add(a);
        observer.observe(a);
      }
    });
  }
  scan(document);
  new MutationObserver((records) => {
    records.forEach((r) =>
      r.addedNodes.forEach((n) => {
        if (n.nodeType === 1) scan(n);
      }),
    );
    for (const a of ratios.keys())
      if (!a.isConnected) {
        stop(a);
        ratios.delete(a);
        observer.unobserve(a);
      }
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) timers.forEach((_, a) => stop(a));
    else ratios.forEach((_, a) => start(a));
  });
})();
