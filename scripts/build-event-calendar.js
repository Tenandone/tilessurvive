'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const {parseHTML} = require('linkedom');
const copy = require('../data/event-calendar-copy');
const root = path.resolve(__dirname, '..');
const langs = ['ko', 'en', 'ja', 'ru', 'zh-tw', 'de'];
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const named = (value, lang) => typeof value === 'string' ? value : value?.[lang] || '';
const fmt = (value, lang) => Number(value).toLocaleString(lang === 'zh-tw' ? 'zh-TW' : lang);
const template = (value, n) => value.replace('{n}', n);
const localRoute = (route, lang) => {
  assert.equal(typeof route, 'string', 'Related route is required');
  assert(!route.startsWith('//') && !route.includes(':') && !route.includes('..'), 'Related route must be local');
  if (!route.startsWith('/')) route = '/' + route;
  if (/^\/(ko|en|ja|ru|zh-tw|de)\//.test(route)) return route.replace(/^\/(ko|en|ja|ru|zh-tw|de)\//, `/${lang}/`);
  return `/${lang}${route}`;
};
const table = (headers, rows, label) => `<div class="calendar-table-wrap" tabindex="0" role="region" aria-label="${esc(label)}"><table><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

function renderPattern(pattern, lang) {
  const t = copy[lang];
  if (pattern.kind === 'timed') {
    const slots = pattern.slots || [];
    return `<p>${esc(t.slotOffset)} · UTC</p>${table([t.day.replace('{n}', '').trim(), t.slot, t.legend], slots.map(s => {
      const from = (s.offsetSeconds % 86400) / 3600;
      const to = from + s.durationSeconds / 3600;
      return `<tr><th scope="row">${esc(template(t.day, s.day))}</th><td>${fmt(from, lang)}–${fmt(to, lang)} ${esc(t.hourUnit)}</td><td>${esc(named(s.names, lang))}</td></tr>`;
    }), t.pattern)}`;
  }
  const label = pattern.unit === 'phase' ? t.phase : t.day;
  return `<ol class="calendar-reference-list">${(pattern.days || []).map(d => `<li><strong>${esc(template(label, pattern.unit === 'phase' ? d.phase : d.day))}</strong><span>${esc(named(d.names, lang))}</span></li>`).join('')}</ol><p class="calendar-note">${esc(t.unknownTiming)}</p>`;
}

function renderReference(data, lang) {
  const t = copy[lang];
  return `<details id="calendar-reference" class="calendar-reference"><summary>${esc(t.showReference)}</summary><h2>${esc(t.allPatterns)}</h2>${data.events.map((event, eventIndex) => {
    const patterns = new Map();
    for (const profile of event.profiles) {
      const key = JSON.stringify(profile.pattern);
      if (!patterns.has(key)) patterns.set(key, []);
      patterns.get(key).push(profile);
    }
    const patternHTML = [...patterns.values()].map(profiles => `<section class="calendar-reference-pattern"><h4>${profiles.length === event.profiles.length ? esc(t.pattern) : esc(named(profiles[0].names, lang))}</h4><p>${esc(named(profiles[0].scope, lang))}</p>${renderPattern(profiles[0].pattern, lang)}</section>`).join('');
    const profilesHTML = event.profiles.filter(p => (p.rules?.length || p.rewards?.length)).map(profile => {
      const ruleRows = (profile.rules || []).map(r => `<tr><th scope="row">${esc(named(r.names, lang))}</th><td>${fmt(r.points, lang)}</td></tr>`);
      const rewardRows = (profile.rewards || []).flatMap(reward => reward.items.map(item => `<tr><th scope="row">${fmt(reward.points, lang)}</th><td>${item.route ? `<a href="${esc(localRoute(item.route, lang))}">${esc(named(item.names, lang))}</a>` : esc(named(item.names, lang))}</td><td>${fmt(item.quantity, lang)}</td></tr>`));
      const scope = named(profile.scope, lang);
      return `<section class="calendar-reference-profile"><h4>${esc(named(profile.names, lang))}</h4>${scope ? `<p>${esc(scope)}</p>` : ''}${ruleRows.length ? table([t.missions, t.points], ruleRows, t.missions) : ''}${rewardRows.length ? `<p>${esc(t.rewardNote)}</p>${table([t.target, t.rewards, t.quantity], rewardRows, t.rewards)}` : ''}</section>`;
    }).join('');
    return `<article id="calendar-reference-${eventIndex + 1}" data-search-entry data-search-title="${esc(named(event.names, lang))}"><h3>${esc(named(event.names, lang))}</h3>${patternHTML}${profilesHTML}<nav class="calendar-related" aria-label="${esc(t.related)}">${(event.links || []).map(link => `<a href="${esc(localRoute(link.route, lang))}">${esc(named(link.names, lang))}</a>`).join('')}</nav></article>`;
  }).join('')}</details>`;
}

function assetTag(d, tagName, asset) {
  const file = path.join(root, asset);
  assert(fs.existsSync(file), `Calendar asset missing: ${asset}`);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  const tag = d.createElement(tagName);
  tag.setAttribute('data-event-calendar-asset', '');
  if (tagName === 'link') {tag.rel = 'stylesheet'; tag.href = `/${asset}?v=${hash}`;}
  else {tag.src = `/${asset}?v=${hash}`; tag.defer = true;}
  d.head.append(tag);
}

function setMeta(d, selector, attr, value) {
  let node = d.querySelector(selector);
  assert(node, `Expected metadata ${selector}`);
  node.setAttribute(attr, value);
}

function appendCalendarUrls(xml) {
  assert.equal((xml.match(/<\/urlset>/g) || []).length, 1, 'Expected one sitemap urlset');
  const existing = new Set([...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(match => match[1]));
  const missing = langs.map(lang => `https://tilessurvive.net/${lang}/events/calendar/`).filter(url => !existing.has(url));
  if (!missing.length) return {xml, added:0};
  const newline = xml.includes('\r\n') ? '\r\n' : '\n';
  const additions = missing.map(url => `<url><loc>${url}</loc></url>`).join(newline) + newline;
  return {xml:xml.replace('</urlset>', additions + '</urlset>'), added:missing.length};
}

function build() {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/event-calendar.json'), 'utf8'));
  assert.equal(data.events.length, 3, 'Three event families are required');
  let changed = 0;
  for (const lang of langs) {
    const t = copy[lang];
    const sourcePath = path.join(root, lang, 'events/index.html');
    const sourceHTML = fs.readFileSync(sourcePath, 'utf8');
    const d = parseHTML(sourceHTML).document;
    const url = `https://tilessurvive.net/${lang}/events/calendar/`;
    const main = d.querySelector('main');
    assert(main, `Missing events main for ${lang}`);
    main.className = 'container page-main ts-calendar-page';
    main.id = 'main';
    main.innerHTML = `<div id="event-calendar" data-lang="${lang}"><nav class="breadcrumb" aria-label="${esc(t.events)}"><a href="/${lang}/">${esc(t.home)}</a><span aria-hidden="true">/</span><a href="/${lang}/events/">${esc(t.events)}</a><span aria-hidden="true">/</span><span>${esc(t.title)}</span></nav><header class="calendar-hero"><h1>${esc(t.title)}</h1><p>${esc(t.intro)}</p><p class="calendar-disclaimer">${esc(t.disclaimer)}</p></header><div id="calendar-app"></div><noscript><p>${esc(t.noScript)}</p></noscript>${renderReference(data, lang)}</div><script id="event-calendar-data" type="application/json">${json(data)}</script><script id="event-calendar-copy" type="application/json">${json(t)}</script>`;
    d.title = `${t.title} | TilesSurvive.net`;
    setMeta(d, 'meta[name="description"]', 'content', t.description);
    setMeta(d, 'link[rel="canonical"]', 'href', url);
    setMeta(d, 'meta[property="og:title"]', 'content', t.title);
    setMeta(d, 'meta[property="og:description"]', 'content', t.description);
    setMeta(d, 'meta[property="og:url"]', 'content', url);
    d.querySelectorAll('script[type="application/ld+json"],link[rel="alternate"]').forEach(n => n.remove());
    for (const alt of [...langs, 'x-default']) {
      const link = d.createElement('link');
      link.rel = 'alternate'; link.hreflang = alt;
      link.href = `https://tilessurvive.net/${alt === 'x-default' ? 'en' : alt}/events/calendar/`;
      d.head.append(link);
    }
    const schema = d.createElement('script');
    schema.type = 'application/ld+json';
    schema.textContent = json({'@context':'https://schema.org','@type':'WebPage', name:t.title, description:t.description, inLanguage:lang, url});
    d.head.append(schema);
    // Reuse the public shell, without event-archive-specific enhancement scripts.
    d.querySelectorAll('script[src],link[rel="stylesheet"]').forEach(node => {
      const src = node.getAttribute('src') || node.getAttribute('href');
      if (/\/(database-22|data-workbench-30)\.(js|css)(\?|$)/.test(src)) node.remove();
    });
    d.querySelector('.ts-skip')?.setAttribute('href', '#main');
    d.querySelectorAll('.ts3-language a[hreflang]').forEach(a => {
      const target = a.getAttribute('hreflang');
      assert(langs.includes(target), `Unexpected language ${target}`);
      a.href = `/${target}/events/calendar/`;
    });
    assetTag(d, 'link', 'css/event-calendar.css');
    assetTag(d, 'script', 'js/event-calendar-math.js');
    assetTag(d, 'script', 'js/event-calendar.js');
    const output = '<!DOCTYPE html>\n' + d.documentElement.outerHTML + '\n';
    const targetPath = path.join(root, lang, 'events/calendar/index.html');
    fs.mkdirSync(path.dirname(targetPath), {recursive:true});
    if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf8') !== output) {
      fs.writeFileSync(targetPath, output); changed++;
    }

    // An idempotent entry point survives the earlier event-archive builders.
    const index = parseHTML(sourceHTML).document;
    index.querySelectorAll('[data-event-calendar-entry]').forEach(node => node.remove());
    const entry = index.createElement('nav');
    entry.className = 'ts40-links'; entry.setAttribute('data-event-calendar-entry', '');
    entry.setAttribute('aria-label', t.title);
    entry.innerHTML = `<a href="/${lang}/events/calendar/">${esc(t.title)} →</a>`;
    const indexMain = index.querySelector('main');
    const hero = indexMain.querySelector('.hero-card');
    if (hero) hero.append(entry); else indexMain.prepend(entry);
    const updatedIndex = '<!DOCTYPE html>\n' + index.documentElement.outerHTML + '\n';
    if (updatedIndex !== sourceHTML) {fs.writeFileSync(sourcePath, updatedIndex); changed++;}
  }
  const sitemapPath = path.join(root, 'sitemap.xml');
  const sitemap = appendCalendarUrls(fs.readFileSync(sitemapPath, 'utf8'));
  if (sitemap.added) fs.writeFileSync(sitemapPath, sitemap.xml);
  console.log(JSON.stringify({builder:'event-calendar',languages:langs.length,eventFamilies:data.events.length,pages:langs.length,changed,sitemapAdded:sitemap.added}));
  return {changed, pages:langs.length, sitemapAdded:sitemap.added};
}

if (require.main === module) build();
module.exports = {build, renderReference, appendCalendarUrls};
