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

    if (openButton) openButton.setAttribute("aria-expanded", "true");
  }

  function closeDrawer(elements) {
    const { html, body, drawer, backdrop, openButton } = elements;
    if (!drawer || !backdrop) return;

    html.classList.remove("is-open");
    body.classList.remove("no-scroll");
    backdrop.hidden = true;
    drawer.setAttribute("aria-hidden", "true");

    if (openButton) openButton.setAttribute("aria-expanded", "false");
  }

  function setupDrawer() {
    const elements = getDrawerElements();
    const { drawer, backdrop, openButton, closeButton } = elements;

    if (!drawer) return;

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
      // 기존 헤더/푸터가 있더라도 제거 후 공통 템플릿으로 강제 통일
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

  window.TS_LANG = {
    normalize: normalizeLang,
    apply: applyLang,
    current: getCurrentLang,
  };

  document.addEventListener("DOMContentLoaded", loadLayout);
})();