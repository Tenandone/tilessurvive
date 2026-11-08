/* Shared locale metadata. The build replaces only the marked registry JSON. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.TS_LOCALES = api;
    const doc = root.document, listener = Symbol.for('tiles.locale.choiceListener');
    if (!doc?.addEventListener || doc[listener]) return;
    doc[listener] = true;
    // The link keeps its native navigation, including when storage is unavailable.
    doc.addEventListener('click', event => {
      if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target?.closest?.('a[data-root-locale], .ts-header a[hreflang], .site-header a[hreflang]');
      if (!link || !link.hasAttribute('href') || link.hasAttribute('download') || link.getAttribute('aria-disabled') === 'true') return;
      const code = api.normalize(link.getAttribute('data-root-locale') || link.getAttribute('hreflang'));
      let target;
      try { target = new URL(link.getAttribute('href'), root.location.href); } catch (_) { return; }
      if (target.origin === root.location.origin && target.pathname.split('/')[1] === code) api.rememberChoice(code);
    });
  }
})(typeof window === "object" ? window : globalThis, function (root) {
  "use strict";
  const registry = /* TS_LOCALE_REGISTRY_START */ {"schemaVersion":1,"defaultLocale":"en","locales":[{"code":"en","htmlLang":"en","hreflang":"en","numberLocale":"en-US","dir":"ltr","nativeName":"English","clientId":"en","aliases":["en-US"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"ko","htmlLang":"ko","hreflang":"ko","numberLocale":"ko-KR","dir":"ltr","nativeName":"한국어","clientId":"ko","aliases":["ko-KR"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"ja","htmlLang":"ja","hreflang":"ja","numberLocale":"ja-JP","dir":"ltr","nativeName":"日本語","clientId":"ja","aliases":["ja-JP"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"zh-tw","htmlLang":"zh-Hant","hreflang":"zh-TW","numberLocale":"zh-TW","dir":"ltr","nativeName":"繁體中文","clientId":"zh-TW","aliases":["zh-Hant","zh-Hant-TW","zh-TW","zh-HK","zh-MO"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"de","htmlLang":"de","hreflang":"de","numberLocale":"de-DE","dir":"ltr","nativeName":"Deutsch","clientId":"de","aliases":["de-DE"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"ru","htmlLang":"ru","hreflang":"ru","numberLocale":"ru-RU","dir":"ltr","nativeName":"Русский","clientId":"ru","aliases":["ru-RU"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"zh-cn","htmlLang":"zh-Hans","hreflang":"zh-CN","numberLocale":"zh-CN","dir":"ltr","nativeName":"简体中文","clientId":"zh-CN","aliases":["zh-Hans","zh-Hans-CN","zh-CN","zh-SG"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"ar","htmlLang":"ar","hreflang":"ar","numberLocale":"ar","dir":"rtl","nativeName":"العربية","clientId":"ar","aliases":["ar"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"nl","htmlLang":"nl","hreflang":"nl","numberLocale":"nl-NL","dir":"ltr","nativeName":"Nederlands","clientId":"nl","aliases":["nl-NL"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"fr","htmlLang":"fr","hreflang":"fr","numberLocale":"fr-FR","dir":"ltr","nativeName":"Français","clientId":"fr","aliases":["fr-FR"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"id","htmlLang":"id","hreflang":"id","numberLocale":"id-ID","dir":"ltr","nativeName":"Bahasa Indonesia","clientId":"id","aliases":["id-ID"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"it","htmlLang":"it","hreflang":"it","numberLocale":"it-IT","dir":"ltr","nativeName":"Italiano","clientId":"it","aliases":["it-IT"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"pl","htmlLang":"pl","hreflang":"pl","numberLocale":"pl-PL","dir":"ltr","nativeName":"Polski","clientId":"pl","aliases":["pl-PL"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"pt","htmlLang":"pt","hreflang":"pt","numberLocale":"pt-BR","dir":"ltr","nativeName":"Português","clientId":"pt","aliases":["pt-BR"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"es","htmlLang":"es","hreflang":"es","numberLocale":"es-ES","dir":"ltr","nativeName":"Español","clientId":"es","aliases":["es-ES"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"sv","htmlLang":"sv","hreflang":"sv","numberLocale":"sv-SE","dir":"ltr","nativeName":"Svenska","clientId":"sv","aliases":["sv-SE"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"th","htmlLang":"th","hreflang":"th","numberLocale":"th-TH","dir":"ltr","nativeName":"ไทย","clientId":"th","aliases":["th-TH"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"tr","htmlLang":"tr","hreflang":"tr","numberLocale":"tr-TR","dir":"ltr","nativeName":"Türkçe","clientId":"tr","aliases":["tr-TR"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"vi","htmlLang":"vi","hreflang":"vi","numberLocale":"vi-VN","dir":"ltr","nativeName":"Tiếng Việt","clientId":"vi","aliases":["vi-VN"],"evidence":"client-2.6.200-language-config-and-appstore","status":"published"},{"code":"ms","htmlLang":"ms","hreflang":"ms","numberLocale":"ms-MY","dir":"ltr","nativeName":"Bahasa Melayu","clientId":"my","aliases":["ms-MY"],"evidence":"client-2.6.200-config-and-Malay-corpus","status":"published"},{"code":"nb","htmlLang":"nb","hreflang":"nb","numberLocale":"nb-NO","dir":"ltr","nativeName":"Norsk bokmål","clientId":"no","aliases":["nb-NO","no","no-NO"],"evidence":"official-appstore-current-and-client-loading-only","status":"published"}]} /* TS_LOCALE_REGISTRY_END */;
  const locales = Object.freeze(registry.locales.map((entry) => Object.freeze({
    ...entry, aliases: Object.freeze((entry.aliases || []).slice()),
  })));
  const codes = Object.freeze(locales.map((entry) => entry.code));
  const aliases = new Map();
  const key = (value) => String(value || "").trim().toLowerCase().replace(/_/g, "-");
  locales.forEach((entry) => {
    [entry.code, entry.htmlLang, entry.hreflang, ...entry.aliases].forEach((name) => {
      if (name) aliases.set(key(name), entry.code);
    });
  });
  // Historical public site shorthand, never the unrelated client-only Malay ID "my".
  if (codes.includes("zh-tw")) aliases.set("tw", "zh-tw");
  function normalize(value) {
    const candidate = key(value);
    if (aliases.has(candidate)) return aliases.get(candidate);
    // Regional variants of an unambiguous language retain their base locale.
    const base = candidate.split("-")[0];
    return base !== "zh" && codes.includes(base) ? base : null;
  }
  function stripLocale(pathname) {
    const value = String(pathname || "/");
    const match = /^\/([^/]+)(\/.*)?$/.exec(value);
    return match && normalize(match[1]) ? (match[2] || "/") : value;
  }
  function current(doc = root.document, loc = root.location) {
    const html = doc && doc.documentElement;
    const declared = html && (html.getAttribute("data-lang") || html.getAttribute("lang"));
    const pathCode = String(loc && loc.pathname || "").split("/")[1];
    return (codes.includes(pathCode) && pathCode) || normalize(declared) || registry.defaultLocale;
  }
  const explicitChoiceKey = 'tiles.locale.explicit.v1';
  function rememberChoice(value) {
    if (!codes.includes(value)) return;
    try { root.localStorage.setItem(explicitChoiceKey, value); } catch (_) { /* Native links still work. */ }
  }
  function preferredHomeLocale() {
    const pathCode = String(root.location?.pathname || '').split('/')[1];
    if (codes.includes(pathCode)) return pathCode;
    try {
      const saved = root.localStorage.getItem(explicitChoiceKey);
      if (codes.includes(saved)) return saved;
    } catch (_) { /* Use browser preferences without storage. */ }
    const navigator = root.navigator || {};
    for (const language of [...(navigator.languages || []), navigator.language]) {
      let tag = key(language);
      while (tag) {
        const supported = normalize(tag);
        if (supported) return supported;
        const separator = tag.lastIndexOf('-');
        tag = separator > 0 ? tag.slice(0, separator) : '';
      }
    }
    return registry.defaultLocale;
  }
  function resolvePageUrl(value, options = {}) {
    const code = normalize(value);
    if (!code) return null;
    const doc = options.document || root.document;
    const loc = options.location || root.location;
    if (!loc) return null;
    const base = new URL(loc.href || String(loc.pathname || "/"), loc.origin || "https://tilessurvive.net");
    const origins = new Set([base.origin]);
    const canonical = doc && doc.querySelector('link[rel="canonical"][href]');
    if (canonical) {
      try { origins.add(new URL(canonical.getAttribute("href"), base).origin); } catch (_) { /* invalid metadata cannot grant a route */ }
    }
    const finish = (href) => {
      if (!href) return null;
      let url;
      try { url = new URL(href, base); } catch (_) { return null; }
      if (!/^https?:$/.test(url.protocol) || !origins.has(url.origin) || url.username || url.password) return null;
      if (normalize(url.pathname.split("/")[1]) !== code) return null;
      if (options.preserveState !== false) {
        if (base.search) url.search = base.search;
        if (base.hash) url.hash = base.hash;
      }
      return url.pathname + url.search + url.hash;
    };
    // Exact alternate routes preserve entity slugs that differ by language.
    if (doc) {
      for (const link of doc.querySelectorAll('head link[rel="alternate"][hreflang][href]')) {
        if (normalize(link.getAttribute("hreflang")) === code) {
          const result = finish(link.getAttribute("href"));
          if (result) return result;
        }
      }
    }
    let routes = options.routes;
    if (!routes && doc) {
      const payload = doc.getElementById("ts-locale-routes");
      if (payload) {
        try { routes = JSON.parse(payload.textContent); }
        catch (error) { if (root.console) root.console.error("Invalid ts-locale-routes JSON", error); }
      }
    }
    if (routes && typeof routes === "object") {
      for (const [locale, href] of Object.entries(routes)) {
        if (normalize(locale) === code && typeof href === "string") {
          const result = finish(href);
          if (result) return result;
        }
      }
      // An explicit availability map is authoritative, including absent locales.
      return null;
    }
    if (doc) {
      for (const link of doc.querySelectorAll('.ts-header a[hreflang][href], .site-header a[hreflang][href]')) {
        if (normalize(link.getAttribute("hreflang")) === code) {
          const result = finish(link.getAttribute("href"));
          if (result) return result;
        }
      }
    }
    return code === current(doc, loc) ? finish(base.href) : null;
  }
  return Object.freeze({schemaVersion: registry.schemaVersion, defaultLocale: registry.defaultLocale,
    locales, codes, normalize, current, stripLocale, resolvePageUrl, rememberChoice, preferredHomeLocale});
});
