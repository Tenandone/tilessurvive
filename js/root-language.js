(function (host, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else api.mount(host);
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const scriptPath = /^\/js\/(?:[\w-]+\/)*[\w.-]+\.js\?v=[a-f0-9]{12}$/;
  const plainAttributes = new Set(['aria-label', 'aria-current', 'placeholder', 'data-copy-label', 'data-copied', 'data-copy-failed', 'data-support-discord', 'target']);
  const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);
  function requireValue(value, label) {
    if (!value) throw new Error('Invalid root home '+label);
  }
  function checkManifest(manifest) {
    requireValue(manifest?.schemaVersion === 1 && manifest.baseLocale === 'en' && typeof manifest.version === 'string' && manifest.version, 'manifest');
    requireValue(manifest.locales?.en === null && Array.isArray(manifest.scripts) && manifest.scripts.length, 'assets');
    const paths = new Set();
    for (const src of manifest.scripts) {
      requireValue(typeof src === 'string' && scriptPath.test(src), 'script URL');
      const file = src.split('?')[0];
      requireValue(!paths.has(file) && !['/js/root-language.js','/js/site-locales.js','/js/home-form-state.js'].includes(file), 'duplicate script');
      paths.add(file);
    }
  }
  function checkAttribute(element, name, value, origin) {
    requireValue(value === null || typeof value === 'string', 'attribute value');
    if (plainAttributes.has(name)) return;
    if (name === 'content') {
      requireValue(element.tagName === 'META' && !element.hasAttribute('http-equiv') && !element.hasAttribute('charset'), 'metadata');
      const kind = element.getAttribute('name') || element.getAttribute('property');
      requireValue(['description','keywords','og:title','og:description','og:locale','twitter:title','twitter:description'].includes(kind), 'metadata name');
      return;
    }
    if (name === 'href' && element.tagName === 'LINK') {
      requireValue(element.getAttribute('rel') === 'stylesheet' && typeof value === 'string' && /^\/css\/content\/[a-f0-9]{16}\.css$/.test(value), 'stylesheet');
      return;
    }
    requireValue((name === 'href' && element.tagName === 'A') || (name === 'action' && element.tagName === 'FORM'), 'attribute name');
    if (value === null) return;
    const url = new URL(value, origin);
    requireValue(!url.username && !url.password && (url.origin === origin || (name === 'href' && url.protocol === 'https:')), 'link URL');
  }

  // Treat adjacent text nodes as a single node, as in the generated DOM. This
  // also covers parsers which split a text run at an HTML character reference.
  function textRuns(element) {
    const runs = [];
    for (const child of element.childNodes) {
      if (child.nodeType === 3 && child.nodeValue === '') continue;
      const previous = runs[runs.length-1];
      if (child.nodeType === 3 && previous?.[0].nodeType === 3) previous.push(child);
      else runs.push([child]);
    }
    return runs;
  }
  function patchedJSON(element, change) {
    requireValue(element.tagName === 'SCRIPT' && ['application/json','application/ld+json'].includes(element.getAttribute('type')), 'JSON element');
    let data = JSON.parse(element.textContent);
    if (change.json !== undefined) requireValue(Array.isArray(change.json), 'JSON changes');
    for (const pair of change.json || []) {
      requireValue(Array.isArray(pair) && pair.length === 2 && Array.isArray(pair[0]), 'JSON path');
      const [path, value] = pair;
      if (!path.length) { data = value; continue; }
      let parent = data;
      for (const [index,key] of path.entries()) {
        requireValue((typeof key === 'string' || Number.isSafeInteger(key)) && !unsafeKeys.has(key) && parent !== null && typeof parent === 'object' && Object.hasOwn(parent,key), 'JSON key');
        if (index === path.length-1) parent[key] = value;
        else parent = parent[key];
      }
    }
    return JSON.stringify(data).replace(/</g,'\\u003c');
  }
  function stageChanges(document, patch, manifest, locale, origin) {
    requireValue(patch?.schemaVersion === 1 && patch.version === manifest.version && patch.locale === locale.code && patch.lang === locale.htmlLang && patch.dir === locale.dir && Array.isArray(patch.changes), 'language data');
    const slots = new Map();
    for (const element of document.querySelectorAll('[data-root-slot]')) {
      const key = element.getAttribute('data-root-slot');
      requireValue(/^\d+$/.test(key) && !slots.has(key), 'slot');
      slots.set(key,element);
    }
    const used = new Set(), writes = [];
    for (const change of patch.changes) {
      requireValue(Number.isSafeInteger(change?.id) && !used.has(change.id), 'change');
      used.add(change.id);
      const element = slots.get(String(change.id));
      requireValue(element && Object.keys(change).every(k=>['id','attrs','text','json'].includes(k)), 'change target');
      if (change.attrs !== undefined) {
        requireValue(change.attrs && typeof change.attrs === 'object' && !Array.isArray(change.attrs) && element.tagName !== 'SCRIPT', 'attributes');
        for(const [name,value] of Object.entries(change.attrs)) {
          checkAttribute(element,name,value,origin);
          writes.push(() => value === null ? element.removeAttribute(name) : element.setAttribute(name,value));
        }
      }
      if (change.text !== undefined) {
        requireValue(Array.isArray(change.text) && !['SCRIPT','STYLE'].includes(element.tagName), 'text target');
        const runs = textRuns(element), indices = new Set();
        for (const pair of change.text) {
          requireValue(Array.isArray(pair) && pair.length === 2 && Number.isSafeInteger(pair[0]) && !indices.has(pair[0]) && typeof pair[1] === 'string', 'text change');
          const [index,value] = pair, run = runs[index];
          requireValue(run?.[0].nodeType === 3, 'text position');
          indices.add(index);
          writes.push(() => {run[0].nodeValue=value;for(const adjacent of run.slice(1))adjacent.remove();});
        }
      }
      if (change.json !== undefined) {
        const value = patchedJSON(element,change);
        writes.push(() => { element.textContent = value; });
      }
    }
    return () => { for (const write of writes) write(); };
  }
  async function loadLocale(host, manifest, locale) {
    const src = manifest.locales[locale.code];
    requireValue(typeof src === 'string' && src.startsWith('/data/root-home/'+locale.code+'.json?v=') && /^[a-f0-9]{12}$/.test(src.slice(src.indexOf('?v=')+3)), 'locale URL');
    const controller = new host.AbortController();
    const timeout = host.setTimeout(() => controller.abort(), 6000);
    try {
      const response = await host.fetch(src,{signal:controller.signal,credentials:'omit',redirect:'error',headers:{Accept:'application/json'}});
      requireValue(response.ok && !response.redirected, 'locale response');
      const text = await response.text();
      if (host.crypto?.subtle && host.TextEncoder) {
        const digest = await host.crypto.subtle.digest('SHA-256',new host.TextEncoder().encode(text));
        const shortHash = Array.from(new Uint8Array(digest).slice(0,6),byte=>byte.toString(16).padStart(2,'0')).join('');
        requireValue(src.endsWith('?v='+shortHash),'locale content hash');
      }
      return JSON.parse(text);
    } finally { host.clearTimeout(timeout); }
  }
  function startScripts(document, sources) {
    return Promise.all(sources.map(src => new Promise(resolve => {
      const script = document.createElement('script');
      // Non-async dynamic scripts download together and execute in insertion order.
      script.async = false;
      script.src = src;
      script.addEventListener('load', () => resolve(null), {once:true});
      script.addEventListener('error', () => resolve(src), {once:true});
      document.body.appendChild(script);
    }))).then(results => results.filter(Boolean));
  }
  async function activate(host) {
    const document = host.document, registry = host.TS_LOCALES;
    let manifest;
    try {
      manifest = JSON.parse(document.getElementById('ts-root-home').textContent);
      checkManifest(manifest);
    } catch (_) { return {locale:'en',fallback:true,failedScripts:[]}; }
    const chosen = registry?.preferredHomeLocale?.() || 'en';
    const entry = registry?.locales.find(l=>l.code===chosen);
    let locale='en';
    if (entry && chosen !== 'en') {
      try {
        const patch = await loadLocale(host,manifest,entry);
        const commit = stageChanges(document,patch,manifest,entry,host.location.origin);
        commit();
        document.documentElement.setAttribute('lang',entry.htmlLang);
        document.documentElement.setAttribute('dir',entry.dir);
        document.documentElement.dataset.lang = entry.code;
        locale=entry.code;
      } catch (_) { /* The rendered English home is the fallback for an unavailable locale. */ }
    }
    const failedScripts = await startScripts(document,manifest.scripts);
    return {locale,fallback:locale!==chosen,failedScripts};
  }
  function mount(host) {
    if (!host.document?.documentElement?.hasAttribute('data-root-home') || !['/','/index.html'].includes(host.location?.pathname)) return null;
    if (!host.TS_ROOT_HOME_READY) {
      host.TS_HOME_FORM_STATE?.prepare(host.document,host);
      host.TS_ROOT_HOME_READY = Promise.resolve().then(() => activate(host));
    }
    return host.TS_ROOT_HOME_READY;
  }
  return {mount,stageChanges};
});
