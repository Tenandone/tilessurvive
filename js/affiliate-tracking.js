(function () {
  "use strict";

  const LOOTBAR_HOSTS = new Set(["www.lootbar.com", "lootbar.com"]);

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
    const payload = { page: location.pathname, path: location.pathname, language: language(), page_type: pageType(), content_type: contentType(), ...params };
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
    if (link.closest("[class*='equipment']")) return "contextual_primary";
    if (location.pathname.includes("top-up") || location.pathname.includes("discount-topup")) return "topup_primary";
    if (location.pathname.includes("event")) return "contextual_primary";
    if (location.pathname.includes("season")) return "contextual_primary";
    if (location.pathname.includes("heroes")) return "contextual_primary";
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
    if (!link || (!isLootBar(link) && !link.dataset.affiliatePlacement)) return;

    const variant = link.dataset.affiliateVariant || "default";

    emit("affiliate_click", {
      destination: link.href,
      placement: placement(link),
      campaign: link.dataset.affiliateCampaign || (isLootBar(link) ? "lootbar" : "topup_hub"),
      variant: variant,
      experiment_variant: variant
    });
  }, { capture: true });

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-bookmark-cta]");
    if (!button) return;
    const variant = button.dataset.affiliateVariant || "A";
    emit("bookmark_cta_click", { placement: button.dataset.affiliatePlacement || "topup_bookmark", variant: variant, experiment_variant: variant });
    const hint = document.querySelector("[data-bookmark-hint]");
    if (hint) hint.hidden = false;
  });

  function nextDistribution(now) {
    if (now.getDate() <= 15) return new Date(now.getFullYear(), now.getMonth(), 16);
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  function updateCountdowns() {
    const now = new Date();
    const distance = Math.max(0, nextDistribution(now).getTime() - now.getTime());
    const minutes = Math.floor(distance / 60000);
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const remainingMinutes = minutes % 60;
    const value = `${days}d ${String(hours).padStart(2, "0")}h ${String(remainingMinutes).padStart(2, "0")}m`;
    document.querySelectorAll("[data-reward-countdown]").forEach(function (node) {
      node.textContent = value;
      node.setAttribute("datetime", `PT${Math.floor(distance / 1000)}S`);
    });
  }

  if (document.querySelector("[data-reward-countdown]")) {
    updateCountdowns();
    window.setInterval(updateCountdowns, 60000);
  }

  if ("IntersectionObserver" in window) {
    const seen = new WeakSet();
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || seen.has(entry.target)) return;
        seen.add(entry.target);
        const link = entry.target;
        const variant = link.dataset.affiliateVariant || "default";
        emit("affiliate_impression", {
          destination: link.href,
          placement: placement(link),
          campaign: link.dataset.affiliateCampaign || (isLootBar(link) ? "lootbar" : "topup_hub"),
          variant: variant,
          experiment_variant: variant
        });
      });
    }, { threshold: 0.6 });
    document.querySelectorAll("a[href]").forEach(function (link) {
      if (isLootBar(link) || link.dataset.affiliatePlacement) observer.observe(link);
    });

    const stepObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || seen.has(entry.target)) return;
        seen.add(entry.target);
        emit("topup_guide_step", { placement: "topup_steps", step: entry.target.dataset.topupStep || "unknown", variant: "A", experiment_variant: "A" });
      });
    }, { threshold: 0.6 });
    document.querySelectorAll("[data-topup-step]").forEach(function (step) { stepObserver.observe(step); });
  }
})();
