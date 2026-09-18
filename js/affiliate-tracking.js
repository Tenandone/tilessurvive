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

    const params = {
      destination: link.href,
      page: location.pathname,
      language: language(),
      placement: placement(link),
      campaign: link.dataset.affiliateCampaign || "lootbar",
      content_type: contentType()
    };

    if (typeof window.gtag === "function") {
      window.gtag("event", "affiliate_click", params);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "affiliate_click", ...params });
    }
  }, { capture: true });
})();
