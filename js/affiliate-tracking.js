(function () {
  "use strict";

  const LOOTBAR_HOSTS = new Set(["lootbar.gg", "www.lootbar.com", "lootbar.com"]);

  function language() {
    const raw = (document.documentElement.getAttribute("lang") || "en").toLowerCase();
    return raw === "zh-tw" ? "zh-tw" : raw.split("-")[0];
  }

  function contentType() {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts[1] || "home";
  }

  function pageType() {
    if (location.pathname.includes("/top-up/") || location.pathname.includes("discount-topup")) return "affiliate";
    return "information";
  }

  function emit(name, params) {
    const payload = { page: location.pathname, language: language(), page_type: pageType(), content_type: contentType(), ...params };
    if (typeof window.gtag === "function") {
      window.gtag("event", name, payload);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, ...payload });
    }
  }

  function placement(link) {
    if (link.dataset.affiliatePlacement) return link.dataset.affiliatePlacement;
    if (link.closest(".hero-card")) return "hero_primary";
    if (link.closest(".site-footer")) return "footer";
    if (link.closest("[class*='equipment']")) return "gear_inline";
    if (location.pathname.includes("top-up") || location.pathname.includes("discount-topup")) return "topup_primary";
    if (location.pathname.includes("event")) return "event_bottom";
    if (location.pathname.includes("season")) return "season_prepare";
    if (location.pathname.includes("heroes")) return "hero_inline";
    return "content_inline";
  }

  function isLootBar(link) {
    try {
      const url = new URL(link.href, location.href);
      return LOOTBAR_HOSTS.has(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  document.addEventListener("click", function (event) {
    const link = event.target.closest("a[href]");
    if (!link || !isLootBar(link)) return;

    emit("affiliate_click", {
      destination: link.href,
      placement: placement(link),
      campaign: link.dataset.affiliateCampaign || "lootbar",
      variant: link.dataset.affiliateVariant || "default"
    });
  }, { capture: true });

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-bookmark-cta]");
    if (!button) return;
    emit("bookmark_cta_click", { placement: button.dataset.affiliatePlacement || "topup_bookmark" });
    const hint = document.querySelector("[data-bookmark-hint]");
    if (hint) hint.hidden = false;
  });

  if ("IntersectionObserver" in window) {
    const seen = new WeakSet();
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || seen.has(entry.target)) return;
        seen.add(entry.target);
        const link = entry.target;
        emit("affiliate_impression", {
          destination: link.href,
          placement: placement(link),
          campaign: link.dataset.affiliateCampaign || "lootbar",
          variant: link.dataset.affiliateVariant || "default"
        });
      });
    }, { threshold: 0.6 });
    document.querySelectorAll("a[href]").forEach(function (link) {
      if (isLootBar(link)) observer.observe(link);
    });

    const stepObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || seen.has(entry.target)) return;
        seen.add(entry.target);
        emit("topup_guide_step", { step: entry.target.dataset.topupStep || "unknown" });
      });
    }, { threshold: 0.6 });
    document.querySelectorAll("[data-topup-step]").forEach(function (step) { stepObserver.observe(step); });
  }
})();
