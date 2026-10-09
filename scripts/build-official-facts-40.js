/* Public patch facts on existing pages. The input keeps source/version/conditions;
 * HTML contains concise game rules and citations. --data-only leaves HTML alone. */
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'data/foundation-40');
const input = JSON.parse(fs.readFileSync(path.join(directory, 'official-sources-input.json'), 'utf8'));
const languages = ['ko', 'en', 'ja', 'ru', 'zh-tw'];
const dataOnly = process.argv.includes('--data-only');
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const byId = (rows, name) => {
  const map = new Map();
  for (const row of rows) {
    assert(/^[a-z0-9][a-z0-9-]*$/.test(row.id), `Invalid ${name} ID: ${row.id}`);
    assert(!map.has(row.id), `Duplicate ${name}: ${row.id}`);
    map.set(row.id, row);
  }
  return map;
};
const sources = byId(input.sources, 'source');
const facts = byId(input.facts, 'fact');
const blocks = byId(input.blocks, 'block');
for (const source of sources.values()) {
  const url = new URL(source.url);
  assert(url.protocol === 'https:' && ['tilesurvivegame.com', 'funplus.com'].includes(url.hostname), `Non-primary source: ${source.url}`);
  assert(/^[a-f0-9]{64}$/.test(source.sha256), `Missing source capture hash: ${source.id}`);
}
for (const fact of facts.values()) {
  assert(fact.status === 'CONFIRMED', `Unconfirmed publication: ${fact.id}`);
  const source = sources.get(fact.sourceId);
  assert(source && source.url === fact.sourceURL && source.gameVersion === fact.gameVersion, `Source mismatch: ${fact.id}`);
}
const localized = (values, label) => {
  for (const lang of languages) assert(typeof values[lang] === 'string' && values[lang].trim(), `Missing ${lang}: ${label}`);
};
for (const block of blocks.values()) {
  localized(block.text, block.id);
  assert(block.factIds.length > 0 && block.factIds.every(id => facts.has(id)), `Unknown fact: ${block.id}`);
}
const routes = new Set();
for (const page of input.pages) {
  assert(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(page.route) && !routes.has(page.route), `Invalid/duplicate route: ${page.route}`);
  routes.add(page.route);
  localized(page.sectionTitle, page.route);
  assert(page.blockIds.length && page.blockIds.every(id => blocks.has(id)), `Unknown block: ${page.route}`);
}
assert(facts.has(input.arcadia.durationFactId), 'Missing Arcadia duration fact');
for (const route of [...routes, input.arcadia.route]) for (const lang of languages) {
  assert(fs.existsSync(path.join(root, lang, route, 'index.html')), `Existing page missing: ${lang}/${route}`);
}

// Keep data stable across repeated builds; the checked date belongs to the input.
const publicFacts = input.facts.map(({ status, releaseScope, ...fact }) => fact);
const output = {
  schemaVersion: input.schemaVersion,
  checkedAt: input.checkedAt,
  localizationKind: input.localizationKind,
  sources: input.sources,
  facts: publicFacts,
  blocks: input.blocks,
  pages: input.pages,
  arcadia: input.arcadia
};
const save = (file, text) => {
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
};
save(path.join(directory, 'official-facts.json'), JSON.stringify(output, null, 2) + '\n');
if (dataOnly) {
  console.log(`Official facts: ${facts.size} facts, ${blocks.size} blocks, ${sources.size} sources; data only`);
  process.exit(0);
}

const citation = factIds => [...new Set(factIds.map(id => facts.get(id).sourceId))].map(id => {
  const source = sources.get(id);
  return `<a href="${esc(source.url)}" data-official-source="${esc(id)}">v${esc(source.gameVersion)}</a>`;
}).join(' · ');
const load = (lang, route) => {
  const file = path.join(root, lang, route, 'index.html');
  const original = fs.readFileSync(file, 'utf8');
  const document = parseHTML(original).document;
  assert(document.querySelector('main'), `Missing main: ${file}`);
  document.querySelectorAll('[data-official-facts-40]').forEach(node => node.remove());
  return { file, original, document };
};
const changes = [];
const write = ({file, document, original}) => {
  const html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML + '\n';
  if (html !== original) { save(file, html); changes.push(path.relative(root, file).replaceAll('\\', '/')); }
};
for (const lang of languages) for (const page of input.pages) {
  const loaded = load(lang, page.route);
  const { document: d } = loaded;
  const main = d.querySelector('main');
  const section = d.createElement('section');
  section.id = 'official-conditions-40';
  section.className = 'ts-database-22';
  section.setAttribute('data-official-facts-40', page.route);
  section.setAttribute('aria-labelledby', 'official-conditions-40-heading');
  section.innerHTML = `<h2 id="official-conditions-40-heading">${esc(page.sectionTitle[lang])}</h2>` + page.blockIds.map(id => {
    const block = blocks.get(id);
    return `<p data-official-fact-ids="${esc(block.factIds.join(' '))}">${esc(block.text[lang])} <small>(${citation(block.factIds)})</small></p>`;
  }).join('');
  // Respect the original constrained containers; place added rules after core
  // data, before the existing related-links/reference tail where there is one.
  const stack = [...main.children].find(node => node.classList.contains('section-stack'));
  const container = [...main.children].find(node => node.classList.contains('container'));
  if (stack) stack.append(section);
  else if (container) container.append(section);
  else {
    const tail = [...main.children].find(node => node.matches('nav[data-platform-related],[data-content301-references]'));
    if (tail) tail.before(section); else main.append(section);
  }
  write(loaded);
}
for (const lang of languages) {
  const loaded = load(lang, input.arcadia.route);
  const d = loaded.document;
  const body = d.querySelector('main > section.ts-database-22');
  assert(body, `Missing Arcadia rules: ${lang}`);
  const p = d.createElement('p');
  p.setAttribute('data-official-facts-40', input.arcadia.route);
  p.setAttribute('data-official-fact-ids', input.arcadia.durationFactId);
  p.innerHTML = `<small>${citation([input.arcadia.durationFactId])}</small>`;
  body.append(p);
  write(loaded);
}
// The expansion builder has one mixed Arcadia ledger record. Its new duration
// comes from the patch; all other quantities remain attributed to the old guide.
const ledgerPath = path.join(root, 'data/expansion-22/ledger.json');
if (fs.existsSync(ledgerPath)) {
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const entry = ledger.entries.find(row => row.id === 'arcadia-rules');
  assert(entry, 'Missing legacy Arcadia ledger entry');
  const duration = facts.get(input.arcadia.durationFactId);
  entry.value = require('../data/expansion-22/copy').ko.arcadiaText;
  entry.sourceURL = duration.sourceURL;
  entry.version = duration.gameVersion;
  entry.checked = input.checkedAt;
  entry.sourceKind = 'official';
  entry.factIds = [duration.id];
  entry.conditions = 'Contest duration: 2 hours from v2.5.600. Other occupation/scoring/reward quantities are historical values from the 2026-01-07 guide; the later patch does not reconfirm them. Check the current in-game event rules.';
  entry.sources = [
    { url: duration.sourceURL, version: duration.gameVersion, scope: '2-hour contest duration' },
    { url: input.arcadia.historicalGuideURL, publishedDate: input.arcadia.historicalGuideDate, version: null, scope: 'Historical occupation, scoring and reward rules; current applicability unconfirmed' }
  ];
  save(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
}
console.log(`Official facts: ${facts.size} facts, ${blocks.size} blocks, ${changes.length} pages changed`);
