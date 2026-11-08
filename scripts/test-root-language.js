'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { rootDocument } = require('./build-global-navigation');
const { locales } = require('../data/i18n/locales.json');

const root = path.resolve(__dirname, '..');
const origin = 'https://tilessurvive.net';
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const codes = locales.filter(locale => locale.status === 'published').map(locale => locale.code);
const features = ['/ko/heroes/', '/ko/database/pet-system/', '/ko/buildings/', '/ko/tools/', '/ko/events/calendar/', '/ko/codes/'];

function visit({ preferred = null, languages, language, available, blockedStorage = false } = {}) {
  const document = parseHTML(available ? rootDocument(html, available) : html).document;
  const navigation = [], writes = [], timers = [];
  const location = {
    origin, pathname: '/', search: '', hash: '',
    get href() { return origin + '/'; },
    set href(next) { navigation.push(String(next)); },
    assign(next) { navigation.push(String(next)); },
    replace(next) { navigation.push(String(next)); },
  };
  const localStorage = {
    getItem(key) {
      if (blockedStorage) throw new Error('Storage unavailable');
      return key === 'preferred_lang' ? preferred : null;
    },
    setItem(key, value) {
      if (blockedStorage) throw new Error('Storage unavailable');
      writes.push([key, value]);
    },
  };
  const window = { document, navigator: { languages, language }, localStorage,
    setTimeout(callback) { timers.push(callback); }, clearTimeout() {} };
  const sandbox = { window, document, navigator: window.navigator, localStorage, URL, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout };
  const trackedLocation = { get: () => location, set: next => navigation.push(String(next)) };
  Object.defineProperty(window, 'location', trackedLocation);
  Object.defineProperty(sandbox, 'location', trackedLocation);
  const context = vm.createContext(sandbox);
  for (const script of document.querySelectorAll('script')) {
    if (script.type && !/^(?:application|text)\/javascript$/i.test(script.type)) continue;
    const src = script.getAttribute('src');
    if (!src) vm.runInContext(script.textContent, context, { filename: 'index.html' });
    else {
      const url = new URL(src, origin);
      if (url.origin !== origin) continue; // No external network or ad execution in this test.
      const file = path.join(root, url.pathname.slice(1));
      vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
    }
  }
  document.dispatchEvent(new document.defaultView.Event('DOMContentLoaded'));
  for (const callback of timers.slice()) callback();
  return { document, navigation, writes };
}

function selectedRecommendation(document) {
  return [...document.querySelectorAll('[data-root-locale][data-recommended]')].map(link => link.dataset.rootLocale);
}

function activate(document, code, options = {}, prevented = false) {
  const link = document.querySelector(`[data-root-locale="${code}"]`);
  const event = new document.defaultView.Event('click', { bubbles: true, cancelable: true });
  Object.assign(event, { button: 0, detail: 1, ...options });
  if (prevented) event.preventDefault();
  link.dispatchEvent(event);
  return { href: link.getAttribute('href'), defaultPrevented: event.defaultPrevented };
}

test('saved or detected languages only recommend a published anchor on load', () => {
  const scenarios = [
    [{ preferred: 'de', languages: ['ko-KR'] }, 'de'],
    [{ preferred: 'unsupported', languages: ['de-DE', 'en-US'] }, 'de'],
    [{ languages: ['my-MM', 'ms-MY'] }, 'ms'],
    [{ languages: ['no-NO'] }, 'nb'],
    [{ languages: ['zh-Hans-CN'] }, 'zh-cn'],
    [{ languages: ['zh-Hant-TW'] }, 'zh-tw'],
    [{ languages: undefined, language: 'ko-KR' }, 'ko'],
    [{ languages: ['my-MM'], language: 'my-MM' }, null],
    [{ preferred: 'fr', languages: ['fr-FR','ko-KR'], available: ['en','ko','de'] }, 'ko'],
    [{ preferred: 'de', languages: ['ko-KR'], blockedStorage: true }, 'ko'],
  ];
  for (const [inputs, recommendation] of scenarios) {
    const page = visit(inputs);
    assert.deepEqual(page.navigation, [], 'Loading the root must retain its URL');
    assert.deepEqual(page.writes, [], 'A visit must not save an automatic choice');
    assert.deepEqual(selectedRecommendation(page.document), recommendation ? [recommendation] : [], JSON.stringify(inputs));
  }
});

test('an explicit choice retains normal anchor navigation and records the exact language', () => {
  for (const [code, input] of [['zh-tw', { detail: 1 }], ['de', { detail: 0 }]]) {
    const page = visit({ preferred: 'ko', languages: ['en-US'] });
    assert.deepEqual(activate(page.document, code, input), { href: `/${code}/`, defaultPrevented: false });
    assert.deepEqual(page.writes, [['preferred_lang', code]]);
    assert.deepEqual(page.navigation, [], 'The browser should handle the activated href');
  }
  const blocked = visit({ blockedStorage: true, languages: ['ko-KR'] });
  assert.deepEqual(activate(blocked.document, 'ar'), { href: '/ar/', defaultPrevented: false });
  assert.deepEqual(blocked.navigation, []);
});

test('modified, middle and already-cancelled clicks preserve browser conventions', () => {
  for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    const page = visit();
    assert.equal(activate(page.document, 'ko', modifiers).defaultPrevented, false);
    assert.deepEqual(page.writes, []);
    assert.deepEqual(page.navigation, []);
  }
  const cancelled = visit();
  assert.equal(activate(cancelled.document, 'ko', {}, true).defaultPrevented, true);
  assert.deepEqual(cancelled.writes, []);
  assert.deepEqual(cancelled.navigation, []);
});

function staticEntry(source, expectedCodes) {
  const document = parseHTML(source).document;
  const main = document.querySelector('main');
  assert(main, 'The static entry must include its visible main content');
  assert.match(main.querySelector('h1')?.textContent || '', /타일\s*서바이벌|Tiles\s*Survive/i);
  assert(main.querySelector('p')?.textContent.trim(), 'Site introduction should be readable before JavaScript');
  assert.doesNotMatch(main.textContent, /wait a moment to be redirected|preparing language redirect/i);
  assert.equal(document.querySelectorAll('meta[http-equiv="refresh" i]').length, 0);
  assert.deepEqual([...document.querySelectorAll('link[rel="canonical"]')].map(n => n.href), [origin + '/']);
  assert(!/\b(noindex|none)\b/i.test(document.querySelector('meta[name="robots"]')?.content || ''));
  const languageLinks = [...main.querySelectorAll('.lang-grid a[data-root-locale]')];
  assert.deepEqual(languageLinks.map(a => a.dataset.rootLocale), expectedCodes);
  const expectedAlternates = expectedCodes.map(code => {
    const locale = locales.find(l => l.code === code);
    const link = languageLinks.find(a => a.dataset.rootLocale === code);
    assert.equal(link.getAttribute('href'), `/${code}/`);
    assert.equal(link.getAttribute('hreflang'), locale.hreflang);
    assert.equal(link.getAttribute('lang'), locale.htmlLang);
    assert.equal(link.textContent.trim(), locale.nativeName);
    assert(!link.closest('[hidden],[aria-hidden="true"]'));
    assert(fs.existsSync(path.join(root, code, 'index.html')));
    return [locale.hreflang, `${origin}/${code}/`];
  });
  expectedAlternates.push(['x-default', origin + '/']);
  assert.deepEqual([...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(n => [n.hreflang,n.href]).sort(), expectedAlternates.sort());
  const actualFeatures = [...main.querySelectorAll('.feature-grid a[href]')].map(link => link.getAttribute('href'));
  for (const href of features) {
    assert(actualFeatures.includes(href), 'Missing static feature link '+href);
    assert(fs.existsSync(path.join(root, href.slice(1), 'index.html')), 'Missing feature destination '+href);
  }
  assert.equal(document.querySelectorAll('script[src*="adsbygoogle.js"]').length, 1);
  const runtime = document.querySelector('script[src^="/js/root-language.js"]');
  const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'js/root-language.js'))).digest('hex').slice(0,12);
  assert.equal(runtime.getAttribute('src'), '/js/root-language.js?v=' + digest, 'Published root must reference the current language-selection runtime');
}

test('published and regenerated roots expose native links and complete localized alternates without JavaScript', () => {
  assert.equal(codes.length, 21);
  staticEntry(html, codes);
  staticEntry(rootDocument(html, codes), codes);
  staticEntry(rootDocument(html, ['en','ko','zh-tw','de']), ['en','ko','zh-tw','de']);
});
