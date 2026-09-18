// /js/layout.js

(function () {
  const SUPPORTED_LANGS = ["ko", "en", "ja", "ru", "zh-tw"];

  const LANG_LABELS = {
    ko: "KO",
    en: "EN",
    ja: "JA",
    ru: "RU",
    "zh-tw": "TW",
  };

  function getCurrentLang() {
    const html = document.documentElement;
    const raw = (html.getAttribute("data-lang") || html.getAttribute("lang") || "ko")
      .trim()
      .toLowerCase();

    if (raw === "zh_tw" || raw === "tw") return "zh-tw";
    if (SUPPORTED_LANGS.includes(raw)) return raw;
    return "ko";
  }

  function normalizeLang(code) {
    const value = String(code || "").trim().toLowerCase();
    if (value === "zh_tw" || value === "tw") return "zh-tw";
    if (SUPPORTED_LANGS.includes(value)) return value;
    return "ko";
  }

  function getPathWithoutLang() {
    const pathname = window.location.pathname || "/";
    const stripped = pathname.replace(/^\/(ko|en|ja|ru|zh-tw)(\/|$)/i, "/");
    return stripped || "/";
  }

  function buildLangPath(lang) {
    const cleanLang = normalizeLang(lang);
    const currentPath = getPathWithoutLang();
    return `/${cleanLang}${currentPath}`;
  }

  function applyLang(lang) {
    window.location.href = buildLangPath(lang);
  }

  async function fetchPartial(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load: ${url} (${response.status})`);
    }
    return response.text();
  }

  function getComponentPaths(lang) {
    return {
      header: `/components/${lang}/header.html`,
      footer: `/components/${lang}/footer.html`,
    };
  }

  // 기존 헤더/푸터를 찾는다.
  // 단, JS가 넣을 placeholder 내부에 있는 것은 제외하기 위해
  // #site-header, #site-footer 바깥쪽에 있는 기존 요소만 대상으로 본다.
  function findLegacyHeader() {
    const headers = Array.from(document.querySelectorAll("header.site-header"));
    return headers.find((el) => !el.closest("#site-header")) || null;
  }

  function findLegacyFooter() {
    const footers = Array.from(document.querySelectorAll("footer.site-footer"));
    return footers.find((el) => !el.closest("#site-footer")) || null;
  }

  function findLegacyCountdown() {
    const bars = Array.from(document.querySelectorAll(".countdown-bar-wrap"));
    return bars.find((el) => !el.closest("#site-header")) || null;
  }

  function findLegacyBackdrop() {
    const backdrops = Array.from(document.querySelectorAll("#backdrop, .backdrop"));
    return backdrops.find((el) => !el.closest("#site-header")) || null;
  }

  function findLegacyDrawer() {
    const drawers = Array.from(document.querySelectorAll("#mobileDrawer, .drawer"));
    return drawers.find((el) => !el.closest("#site-header")) || null;
  }

  function findLegacyBottomNav() {
    const navs = Array.from(document.querySelectorAll(".mobile-bottom-nav"));
    return navs.find((el) => !el.closest("#site-footer")) || null;
  }

  // 기존 구조 제거
  function removeLegacyLayout() {
    const legacyHeader = findLegacyHeader();
    const legacyCountdown = findLegacyCountdown();
    const legacyBackdrop = findLegacyBackdrop();
    const legacyDrawer = findLegacyDrawer();
    const legacyFooter = findLegacyFooter();
    const legacyBottomNav = findLegacyBottomNav();

    if (legacyHeader) legacyHeader.remove();
    if (legacyCountdown) legacyCountdown.remove();
    if (legacyBackdrop) legacyBackdrop.remove();
    if (legacyDrawer) legacyDrawer.remove();
    if (legacyFooter) legacyFooter.remove();
    if (legacyBottomNav) legacyBottomNav.remove();
  }

  // placeholder가 없으면 자동 생성
  function ensureMountTargets() {
    let headerTarget = document.getElementById("site-header");
    let footerTarget = document.getElementById("site-footer");
    const main = document.getElementById("main") || document.querySelector("main");

    if (!headerTarget) {
      headerTarget = document.createElement("div");
      headerTarget.id = "site-header";

      if (main) {
        main.parentNode.insertBefore(headerTarget, main);
      } else {
        document.body.insertBefore(headerTarget, document.body.firstChild);
      }
    }

    if (!footerTarget) {
      footerTarget = document.createElement("div");
      footerTarget.id = "site-footer";

      if (main && main.parentNode) {
        if (main.nextSibling) {
          main.parentNode.insertBefore(footerTarget, main.nextSibling);
        } else {
          main.parentNode.appendChild(footerTarget);
        }
      } else {
        document.body.appendChild(footerTarget);
      }
    }

    return { headerTarget, footerTarget };
  }

  function renderLangButtons(root, currentLang) {
    if (!root) return;

    root.innerHTML = SUPPORTED_LANGS.map((lang) => {
      const label = LANG_LABELS[lang] || lang.toUpperCase();
      const isCurrent = lang === currentLang ? "true" : "false";

      return `
        <button
          type="button"
          class="lang-pill"
          data-lang="${lang}"
          aria-current="${isCurrent}"
        >
          ${label}
        </button>
      `;
    }).join("");
  }

  function bindLangButtons(root) {
    if (!root) return;

    root.addEventListener("click", function (event) {
      const button = event.target.closest(".lang-pill[data-lang]");
      if (!button) return;

      event.preventDefault();
      applyLang(button.getAttribute("data-lang"));
    });
  }

  function getDrawerElements() {
    return {
      html: document.documentElement,
      body: document.body,
      drawer: document.getElementById("mobileDrawer"),
      backdrop: document.getElementById("backdrop"),
      openButton: document.getElementById("menuToggle"),
      closeButton: document.getElementById("btnClose"),
    };
  }

  function openDrawer(elements) {
    const { html, body, drawer, backdrop, openButton } = elements;
    if (!drawer || !backdrop) return;

    html.classList.add("is-open");
    body.classList.add("no-scroll");
    backdrop.hidden = false;
    drawer.setAttribute("aria-hidden", "false");
    drawer.removeAttribute("inert");

    if (openButton) openButton.setAttribute("aria-expanded", "true");
  }

  function closeDrawer(elements) {
    const { html, body, drawer, backdrop, openButton } = elements;
    if (!drawer || !backdrop) return;

    html.classList.remove("is-open");
    body.classList.remove("no-scroll");
    backdrop.hidden = true;
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("inert", "");

    if (openButton) openButton.setAttribute("aria-expanded", "false");
  }

  function setupDrawer() {
    const elements = getDrawerElements();
    const { drawer, backdrop, openButton, closeButton } = elements;

    if (!drawer) return;
    drawer.setAttribute("inert", "");

    if (openButton) {
      openButton.addEventListener("click", function () {
        openDrawer(elements);
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", function () {
        closeDrawer(elements);
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", function () {
        closeDrawer(elements);
      });
    }

    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeDrawer(elements);
      }
    });

    const drawerLinks = drawer.querySelectorAll("a");
    drawerLinks.forEach((link) => {
      link.addEventListener("click", function () {
        closeDrawer(elements);
      });
    });
  }

  function setupLanguageSelectors(currentLang) {
    const headerRoot = document.getElementById("langDropdownHeader");
    const drawerRoot = document.getElementById("langDropdownDrawer");

    renderLangButtons(headerRoot, currentLang);
    renderLangButtons(drawerRoot, currentLang);

    bindLangButtons(headerRoot);
    bindLangButtons(drawerRoot);
  }

  function updateBottomNavActive(currentLang) {
    const pathname = (window.location.pathname || "").toLowerCase();
    const items = document.querySelectorAll(".mobile-bottom-nav__item");

    items.forEach((item) => {
      item.classList.remove("is-active");
      item.removeAttribute("aria-current");

      const key = item.getAttribute("data-mobile-nav");
      let active = false;

      if (key === "home") {
        active = pathname === `/${currentLang}/` || pathname === `/${currentLang}`;
      } else if (key === "database") {
        active = pathname.indexOf(`/${currentLang}/database`) === 0;
      } else if (key === "guides") {
        active = pathname.indexOf(`/${currentLang}/guides`) === 0;
      } else if (key === "seasons") {
        active = pathname.indexOf(`/${currentLang}/seasons`) === 0;
      }

      if (active) {
        item.classList.add("is-active");
        item.setAttribute("aria-current", "page");
      }
    });
  }

  async function loadLayout() {
    const currentLang = getCurrentLang();
    const paths = getComponentPaths(currentLang);

    try {
      const legacyHeader = findLegacyHeader();
      const legacyFooter = findLegacyFooter();

      // Most legacy content pages already contain a complete header and footer.
      // Replacing them after first paint caused a large layout shift, so keep the
      // static shell and only wire up its interactive controls.
      if (legacyHeader && legacyFooter) {
        const headerTarget = document.getElementById("site-header");
        const footerTarget = document.getElementById("site-footer");
        if (headerTarget && !headerTarget.textContent.trim()) headerTarget.remove();
        if (footerTarget && !footerTarget.textContent.trim()) footerTarget.remove();
        setupLanguageSelectors(currentLang);
        setupDrawer();
        updateBottomNavActive(currentLang);
        return;
      }

      removeLegacyLayout();

      // placeholder가 없어도 자동 생성
      const { headerTarget, footerTarget } = ensureMountTargets();

      const [headerHtml, footerHtml] = await Promise.all([
        fetchPartial(paths.header),
        fetchPartial(paths.footer),
      ]);

      headerTarget.innerHTML = headerHtml;
      footerTarget.innerHTML = footerHtml;

      setupLanguageSelectors(currentLang);
      setupDrawer();
      updateBottomNavActive(currentLang);
    } catch (error) {
      console.error("layout.js error:", error);
    }
  }

  function loadAffiliateTracking() {
    if (document.querySelector('script[src="/js/affiliate-tracking.js"]')) return;
    const script = document.createElement("script");
    script.src = "/js/affiliate-tracking.js";
    script.defer = true;
    document.head.appendChild(script);
  }

  function injectInformationAffiliate(lang) {
    const main = document.querySelector("main");
    if (!main || main.querySelector("[data-info-affiliate]")) return;

    const parts = location.pathname.split("/").filter(Boolean);
    const section = parts[1] || "";
    const eligible = new Set(["heroes", "buildings", "research", "items", "events", "seasons", "guides", "tools", "database", "behemoths", "codes"]);
    if (!eligible.has(section)) return;
    if (main.querySelector('a[href*="/top-up/"]') || main.querySelector('a[href*="lootbar.gg"],a[href*="lootbar.com"]')) return;

    const copy = {
      ko: ["충전 혜택을 확인해 보세요", "패키지별 할인과 월 2회 쿠폰 지급 조건을 결제 전에 비교할 수 있습니다.", "타일서바이벌 최대 22% 할인 충전 확인"],
      en: ["Check current top-up benefits", "Compare package savings and twice-monthly coupon conditions before paying.", "Check Tile Survive Top-Up Savings"],
      ja: ["チャージ特典を確認", "支払い前にパッケージ別の割引と月2回のクーポン条件を比較できます。", "Tiles Survive のチャージ特典を確認"],
      "zh-tw": ["查看目前的儲值優惠", "付款前比較禮包折扣與每月兩次的優惠券發放條件。", "查看 Tiles Survive 儲值優惠"],
      ru: ["Проверьте текущие бонусы пополнения", "Сравните скидки на наборы и условия выдачи купонов дважды в месяц до оплаты.", "Проверить выгоду пополнения Tile Survive"]
    };
    const text = copy[lang] || copy.en;
    const style = document.createElement("style");
    style.id = "infoAffiliateStyles";
    style.textContent = ".info-affiliate-card{margin-top:24px;padding:18px 20px;border:1px solid #cbd5e1;border-left:4px solid #2f6e5d;border-radius:8px;background:#f8faf8}.info-affiliate-card h2{margin:0 0 5px;font-size:20px}.info-affiliate-card p{margin:0;color:#475569}.info-affiliate-card a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;margin-top:13px;padding:0 14px;border:1px solid #17211b;border-radius:8px;background:#17211b;color:#fff;font-weight:800;text-decoration:none}.info-affiliate-card a:focus-visible{outline:3px solid #d4a83f;outline-offset:3px}";
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    const card = document.createElement("section");
    card.className = "info-affiliate-card";
    card.dataset.infoAffiliate = "";
    card.setAttribute("aria-labelledby", "infoAffiliateTitle");
    card.innerHTML = `<h2 id="infoAffiliateTitle">${text[0]}</h2><p>${text[1]}</p><a href="/${lang}/top-up/" data-affiliate-placement="info_bottom_affiliate" data-affiliate-campaign="topup_hub" data-affiliate-variant="A">${text[2]}</a>`;
    main.appendChild(card);
  }

  window.TS_LANG = {
    normalize: normalizeLang,
    apply: applyLang,
    current: getCurrentLang,
  };

  document.addEventListener("DOMContentLoaded", function () {
    injectInformationAffiliate(getCurrentLang());
    loadAffiliateTracking();
    loadLayout();
  });
})();
