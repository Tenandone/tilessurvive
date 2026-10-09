/* Curated screen targets only. Installation tables and account progress stay private. */
const fs = require('fs'), path = require('path'), { parseHTML } = require('linkedom');
const root = path.resolve(__dirname, '..'), D = require('../data/foundation-40/daily-missions.json');
const C = require('../data/foundation-40/daily-missions-copy'), langs = ['ko', 'en', 'ja', 'ru', 'zh-tw'];
const { plan } = require('../js/daily-missions-40');
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const fragment = (d, html) => { const t = d.createElement('template'); t.innerHTML = html; return t.content; };
const assert = (ok, message) => { if (!ok) throw Error(message); };
assert(D.missions.length > 0 && D.milestones.join(',') === '25,60,100,140,180,235,290', 'Unexpected daily mission scope');
assert(D.missions.every(m => Number.isSafeInteger(m.target) && m.target > 0 && langs.every(lang => typeof m.names[lang] === 'string' && m.names[lang].length)), 'Missing target or translation');
plan(D.missions, D.missions.map(m => m.id), D.milestones.at(-1));
let changes = 0;
function save(file, text) { if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return; fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); changes++; }
const style = `.ts40-daily-milestones{display:flex;flex-wrap:wrap;gap:.5rem 1.25rem;list-style:none;padding:0;font-variant-numeric:tabular-nums}.ts40-daily-milestones li{padding:.3rem 0;font-weight:650}.ts40-daily-table{table-layout:fixed}.ts40-daily-table th:last-child,.ts40-daily-table td:last-child{width:5rem;text-align:right;vertical-align:middle}.ts40-daily-check{display:flex;align-items:center;gap:.75rem;min-height:44px;cursor:pointer;overflow-wrap:anywhere}.ts40-daily-check input{flex:none;width:22px;height:22px;accent-color:var(--ts3-green);margin:0}.ts40-daily-check input:focus-visible{outline:2px solid var(--ts3-green);outline-offset:4px}.ts40-daily-paid{display:block;color:var(--ts-muted);font-size:.82rem;font-weight:400}.ts40-daily-controls{grid-template-columns:minmax(0,20rem) auto;align-items:end}.ts40-daily-controls button{justify-self:start;min-height:46px;font:inherit}.ts40-daily-table th{font-weight:500}@media(max-width:420px){.ts40-daily-controls{grid-template-columns:1fr}.ts40-daily-table th:last-child,.ts40-daily-table td:last-child{width:3.5rem}.ts40-daily-check{gap:.55rem}}`;
const paidCopy = { ko:'선택 · 유료 결제', en:'Optional · paid purchase', ja:'任意・有料購入', ru:'Необязательно · платная покупка', 'zh-tw':'選填・付費購買' };
function content(lang) {
  const t = C[lang], num = n => new Intl.NumberFormat(lang).format(n);
  const scope = t.scope.replace('{version}', D.gameVersion).replace('{date}', D.observedAt);
  const rows = D.missions.map(m => `<tr data-daily-mission="${esc(m.id)}"><th scope="row"><label class="ts40-daily-check"><input type="checkbox" name="mission" value="${esc(m.id)}" hidden disabled><span>${esc(m.names[lang])}${m.paid ? `<small class="ts40-daily-paid">${paidCopy[lang]}</small>` : ''}</span></label></th><td>${num(m.points)}</td></tr>`).join('');
  return `<section class="hero-card ts40-intro"><span class="eyebrow">TILES SURVIVE</span><h1>${esc(t.title)}</h1><p>${esc(t.intro)}</p></section><p class="ts40-context">${esc(scope)}</p>
<section class="ts40-panel" aria-labelledby="milestones-heading"><h2 id="milestones-heading">${esc(t.milestones)}</h2><ol class="ts40-daily-milestones">${D.milestones.map(n => `<li>${num(n)}</li>`).join('')}</ol></section>
<section class="ts40-panel" aria-labelledby="missions-heading"><h2 id="missions-heading">${esc(t.missionHeading)}</h2><form data-daily-plan autocomplete="off" aria-describedby="daily-plan-note daily-scope-note"><div class="ts40-controls ts40-daily-controls" data-daily-enhancement hidden><label>${esc(t.target)}<select name="target">${D.milestones.map(n => `<option value="${n}">${num(n)}</option>`).join('')}</select></label><button type="button" class="btn" data-daily-clear>${esc(t.clear)}</button></div><div data-daily-result data-daily-enhancement hidden class="ts40-result" role="status" aria-live="polite" aria-atomic="true"></div><p id="daily-plan-note" data-daily-enhancement hidden>${esc(t.planning)}</p><noscript><p>${esc(t.noScript)}</p></noscript><table class="ts40-table ts40-daily-table"><thead><tr><th scope="col">${esc(t.mission)}</th><th scope="col">${esc(t.points)}</th></tr></thead><tbody>${rows}</tbody></table><p id="daily-scope-note" class="ts40-source">${esc(t.incomplete)}</p></form></section>
<nav class="ts40-links" aria-label="${esc(t.related)}"><a href="/${lang}/events/arms-race/">${esc(t.training)} →</a><a href="/${lang}/events/">${esc(t.events)} →</a></nav>`;
}
function refreshHubEntry(h, lang, hub) {
  const t = C[lang], route = `/${lang}/events/daily-missions/`;
  const previous = [...h.querySelectorAll('[data-daily-missions-entry]')];
  // Product-generated TOCs can point at an ID assigned on an earlier build.
  // Retain that anchor (and any existing heading) when replacing our own entry.
  const saved = previous.flatMap(entry => [entry, ...entry.querySelectorAll('[id]')])
    .filter(node => node.id).map(node => ({ id:node.id, heading:/^H[23]$/.test(node.tagName) ? node.cloneNode(true) : null }));
  for (const a of h.querySelectorAll('.ts3-contents a[href], .ts-toc a[href]')) {
    if (a.textContent.trim() !== t.title) continue;
    const target = new URL(a.getAttribute('href'), `https://tilessurvive.net/${lang}/${hub}/`);
    if (target.pathname === `/${lang}/${hub}/` && target.hash) {
      const id = decodeURIComponent(target.hash.slice(1));
      if (!h.getElementById(id) && !saved.some(anchor => anchor.id === id)) saved.push({ id, heading:null });
    }
  }
  previous.forEach(n => n.remove());
  const template = h.createElement('template');
  template.innerHTML = `<nav class="ts40-links" data-daily-missions-entry aria-label="${esc(t.related)}"><a href="${route}">${esc(t.title)} →</a></nav>`;
  const entry = template.content.firstElementChild, used = new Set();
  for (const anchor of saved) {
    if (used.has(anchor.id)) continue;
    assert(!h.getElementById(anchor.id), 'Daily entry anchor is already used: ' + lang + '/' + anchor.id);
    used.add(anchor.id);
    if (anchor.heading) entry.prepend(anchor.heading);
    else if (!entry.id) entry.id = anchor.id;
    else { const span = h.createElement('span'); span.id = anchor.id; span.setAttribute('aria-hidden','true'); entry.prepend(span); }
  }
  const existing = h.querySelector('[data-foundation-entry]'), references = h.querySelector('main details.ts301-references');
  if (existing) existing.after(entry); else if (references) references.before(entry); else h.querySelector('main').append(entry);
}
function build() {
changes = 0;
for (const lang of langs) {
  const t = C[lang], slug = 'events/daily-missions', route = `/${lang}/${slug}/`, url = 'https://tilessurvive.net' + route;
  const d = parseHTML(fs.readFileSync(path.join(root, lang, 'events/index.html'), 'utf8')).document;
  d.documentElement.setAttribute('data-section', 'events');
  d.querySelector('title').textContent = t.title + ' | TilesSurvive.net';
  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) d.querySelector(selector)?.setAttribute('content', t.intro);
  for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) d.querySelector(selector)?.setAttribute('content', t.title);
  d.querySelector('link[rel="canonical"]').href = url;
  d.querySelector('meta[property="og:url"]')?.setAttribute('content', url);
  for (const alt of d.querySelectorAll('link[hreflang]')) { const l = alt.hreflang === 'x-default' ? 'en' : alt.hreflang; alt.href = `https://tilessurvive.net/${l}/${slug}/`; }
  for (const a of d.querySelectorAll('.ts3-language a')) a.href = `/${a.getAttribute('hreflang')}/${slug}/`;
  for (const a of d.querySelectorAll('header nav:not(.ts3-language nav) a[aria-current]')) a.removeAttribute('aria-current');
  for (const a of d.querySelectorAll('header nav a[href]')) if (a.href === `/${lang}/events/`) a.setAttribute('aria-current', 'page');
  d.querySelector('.ts-skip').href = route + '#main';
  const main = d.querySelector('main'); main.className = 'container page-main ts3-data-page ts3-editorial ts40-page'; main.innerHTML = content(lang);
  d.querySelectorAll('script[type="application/ld+json"], #foundation-data, script[src^="/js/foundation-40.js"], script[src^="/js/foundation-40-math.js"], #daily-missions-data, script[src*="daily-missions-40"], style[data-daily-style]').forEach(n => n.remove());
  if (!d.querySelector('link[href*="/css/foundation-40.css"]')) d.head.append(fragment(d, '<link rel="stylesheet" href="/css/foundation-40.css?v=1">'));
  d.head.append(fragment(d, `<style data-daily-style>${style}</style><script type="application/ld+json">${JSON.stringify({ '@context':'https://schema.org', '@type':'WebPage', name:t.title, url, inLanguage:lang, description:t.intro, isPartOf:{ '@type':'WebSite', name:'TilesSurvive.net', url:'https://tilessurvive.net/' } }).replaceAll('<', '\\u003c')}</script>`));
  d.body.append(fragment(d, `<script type="application/json" id="daily-missions-data">${JSON.stringify({ missions:D.missions.map(({id, points}) => ({id, points})), milestones:D.milestones, copy:t }).replaceAll('<', '\\u003c')}</script><script src="/js/daily-missions-40.js?v=1" defer></script>`));
  assert(d.querySelectorAll('h1').length === 1 && d.querySelectorAll('[data-daily-mission]').length === D.missions.length, 'Incomplete daily page');
  assert(!d.querySelector('main .ts-affiliate-banner, main [data-lootbar-banner]'), 'Unexpected daily mission advertising');
  save(path.join(root, lang, slug, 'index.html'), '<!DOCTYPE html>\n' + d.documentElement.outerHTML + '\n');
  for (const hub of ['events', 'tools']) {
    const file = path.join(root, lang, hub, 'index.html'), h = parseHTML(fs.readFileSync(file, 'utf8')).document;
    refreshHubEntry(h, lang, hub);
    save(file, '<!DOCTYPE html>\n' + h.documentElement.outerHTML + '\n');
  }
}
const sitemap = path.join(root, 'sitemap.xml'); let xml = fs.readFileSync(sitemap, 'utf8');
for (const lang of langs) { const url = `https://tilessurvive.net/${lang}/events/daily-missions/`; if (!xml.includes('<loc>' + url + '</loc>')) xml = xml.replace('</urlset>', `  <url><loc>${url}</loc></url>\n</urlset>`); }
save(sitemap, xml);
console.log(JSON.stringify({ dailyMissionPages:5, missions:D.missions.length, milestones:D.milestones.length, changes }));
}
module.exports = { refreshHubEntry };
if (require.main === module) build();
