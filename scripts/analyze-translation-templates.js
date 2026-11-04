'use strict';
// Read-only source analysis. Writes only the selected delivery JSON; no site build.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const DELIVERY = path.resolve(ROOT, '../global-language-delivery-20261104');
const args = process.argv.slice(2);
const arg = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : path.resolve(args[i + 1]); };
const INPUT = arg('--input', path.join(DELIVERY, 'active-english-inventory.json'));
const MAP = arg('--official-map', path.join(DELIVERY, 'official-english-map.json'));
const OUTPUT = arg('--output', path.join(DELIVERY, 'translation-template-analysis.json'));
const inventory = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const officialData = JSON.parse(fs.readFileSync(MAP, 'utf8'));
const official = officialData.exactEnglishValues;
const client = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/i18n/client-terms.json'), 'utf8'));
const research = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/content-60/research-phase3/model.json'), 'utf8'));
const locales = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/i18n/locales.json'), 'utf8')).locales.map(l => l.code);
const NEW = locales.filter(l => !['ko', 'en', 'ja', 'ru', 'zh-tw', 'de'].includes(l));
const rows = inventory.rows;
const words = s => s.trim() ? s.trim().split(/\s+/u).length : 0;
const digest = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const counts = values => { const c = {}; for (const v of values) c[v] = (c[v] || 0) + 1; return c; };
const officialInfo = source => official[source] ? { keys: official[source].keys, ambiguousLocales: official[source].ambiguousLocales, missingLocales: official[source].missingLocales } : null;
const usableOfficial = (source, locale) => Boolean(official[source]?.uniqueValueByLocale?.[locale]) && !official[source].ambiguousLocales.includes(locale);
const assigned = new Map();
const groups = new Map();
const leaves = new Map();
const registerLeaf = source => {
  if (!leaves.has(source)) leaves.set(source, { id: 'leaf-' + digest(source), source, official: officialInfo(source) });
  return leaves.get(source).id;
};
const templateKey = (category, template) => category + '\n' + template;
function add(row, category, template, bindings = {}, lexical = {}, notes = []) {
  assert(!assigned.has(row.id), 'duplicate assignment ' + row.id);
  const key = templateKey(category, template);
  if (!groups.has(key)) groups.set(key, { id: 'tpl-' + digest(key), category, sourceTemplate: template, notes, members: [] });
  const group = groups.get(key);
  const member = { id: row.id, source: row.source, bindings, lexicalLeaves: {}, contexts: row.contexts.slice(0, 2) };
  for (const [name, source] of Object.entries(lexical)) member.lexicalLeaves[name] = registerLeaf(source);
  const rendered = template.replace(/\{\{([^{}]+)\}\}/g, (_, name) => {
    assert(Object.hasOwn(bindings, name), 'missing binding ' + name);
    return bindings[name];
  });
  assert.equal(rendered, row.source, 'lossless reconstruction ' + row.id);
  group.members.push(member);
  assigned.set(row.id, { group, member });
}
const technicalId = s => /^(?:r|t)-[a-f0-9]{6,}$/i.test(s);
// These are display identifiers: retain them verbatim, never remove them from UI.
for (const row of rows) {
  if (technicalId(row.source)) add(row, 'verbatim_identifier', row.source);
  else if (Object.hasOwn(official, row.source)) {
    add(row, 'official_exact', '{{term}}', { term: row.source }, { term: row.source }, ['Exact source match; locale-specific ambiguity and missing values still gate reuse.']);
  }
}

// Model-bound research names prevent a generic Roman-numeral heuristic from
// treating arbitrary prose or a one-letter English word as a level identifier.
const findNamed = value => {
  const found = [];
  const visit = v => {
    if (!v || typeof v !== 'object') return;
    if (v.id && v.names?.en) found.push({ id: v.id, name: v.names.en, treeId: v.treeId || v.tree || null });
    for (const x of Object.values(v)) if (x && typeof x === 'object') visit(x);
  };
  visit(value); return found;
};
const researchTerms = findNamed(research);
const researchNames = new Map(researchTerms.filter(x => x.id.startsWith('r-')).map(x => [x.name, x]));
const treeNames = new Set((research.trees || []).map(x => x.names.en));
function researchParts(name) {
  const m = /^(.*) ([IVXLCDM]+)$/.exec(name);
  return m ? { base: m[1], ordinal: m[2] } : { base: name, ordinal: null };
}
for (const row of rows) {
  if (assigned.has(row.id)) continue;
  const s = row.source;
  let m;
  if ((m = /^(Food|Wood|Metal|Gas|Power) ([\d,]+(?:\.\d+)?)$/.exec(s))) {
    add(row, 'labeled_quantity', '{{label}} {{amount}}', { label: m[1], amount: m[2] }, { label: m[1] }, ['Amounts remain raw source lexemes. Locale number formatting is separate and must preserve the numeric value.']);
    continue;
  }
  if ((m = /^(Base time )?((?:\d+[dhms] ?)+) \(([\d,]+) s\)$/.exec(s))) {
    const template = (m[1] || '') + '{{duration}} ({{exactSeconds}} s)';
    add(row, 'duration_exact', template, { duration: m[2], exactSeconds: m[3] }, {}, ['Duration is a typed d/h/m/s formatter, not a copied English phrase. Translate unit grammar and accessible full labels; keep exact seconds.']);
    continue;
  }
  if ((m = /^Base time: ((?:\d+[dhms] ?)+) · ([\d,]+) s$/.exec(s))) {
    add(row, 'duration_exact', 'Base time: {{duration}} · {{exactSeconds}} s', { duration: m[1], exactSeconds: m[2] }, {}, ['Same value-preserving duration formatter; inline presentation is retained.']);
    continue;
  }
  if (row.contexts.some(c => c.file.startsWith('en/buildings/')) && (m = /^(.+?) · Requirements ([AB])(?: · (Lv\.)?(\d+)(–| → )(\d+))?$/.exec(s))) {
    const instance = /^(House|Lab|Barracks) (\d+)$/.exec(m[1]);
    let template = '{{building}}', bindings = { building: instance ? instance[1] : m[1], profile: m[2] }, lexical = { building: bindings.building };
    if (instance) { template += ' {{instance}}'; bindings.instance = instance[2]; }
    template += ' · Requirements {{profile}}';
    if (m[4]) { template += ' · ' + (m[3] || '') + '{{from}}' + m[5] + '{{to}}'; bindings.from = m[4]; bindings.to = m[6]; }
    add(row, 'building_requirements', template, bindings, lexical, ['A/B are profile identifiers, not interchangeable growth paths. Retain instance, endpoints and transition/range distinction.']);
    continue;
  }
  const split = s.split(' · ');
  if (researchNames.has(split[0]) && (split.length === 1 || (split.length === 2 && treeNames.has(split[1])))) {
    const p = researchParts(split[0]);
    const bindings = { research: p.base }, lexical = { research: p.base };
    let template = '{{research}}';
    if (p.ordinal) { bindings.ordinal = p.ordinal; template += ' {{ordinal}}'; }
    if (split.length === 2) { bindings.tree = split[1]; lexical.tree = split[1]; template += ' · {{tree}}'; }
    add(row, 'research_model_label', template, bindings, lexical, ['English research model names matched by stable model IDs; stem translations are new website work unless exact official-map coverage exists. Roman stage and branch identity remain separate.']);
  }
}

// Exact skeleton matching: every literal word, punctuation mark and unit stays.
// Only values differ; no summary, deletion, synonym substitution or fuzzy merge.
const numberPattern = /\d+(?:[,.]\d+)*(?:[KMB](?![a-z]))?/g;
function numericSkeleton(source) {
  const bindings = {}; let i = 0;
  const template = source.replace(/\{[^{}]+\}|\d+(?:[,.]\d+)*(?:[KMB](?![a-z]))?/g, value => {
    if (value.startsWith('{')) return value; // Existing named interpolation contract.
    const name = 'number' + (++i); bindings[name] = value; return '{{' + name + '}}';
  });
  return { template, bindings, count: i };
}
const numeric = new Map();
for (const row of rows) if (!assigned.has(row.id)) {
  const p = numericSkeleton(row.source);
  if (!p.count) continue;
  if (!numeric.has(p.template)) numeric.set(p.template, []);
  numeric.get(p.template).push({ row, ...p });
}
for (const [template, members] of numeric) if (members.length > 1) {
  for (const m of members) add(m.row, 'exact_numeric_template', template, m.bindings, {}, ['Full sentence/label is translated once with ordered typed values. Plural, gender, declension and placeholder order need locale-specific review; raw values are retained in this analysis.']);
}

// Recognize repeated short entity captions conservatively. Not counted as safe
// noun concatenation: the whole sentence template requires grammatical review.
const entityTerms = Object.keys(official).filter(s => s.length >= 4 && words(s) <= 5 && !/[.!?{}]/.test(s) && official[s].keys.some(k => /(?:name|id_survivor|id_resource|id_power)$/.test(k))).sort((a, b) => b.length - a.length || a.localeCompare(b));
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const entityRE = new RegExp('(?<![\\p{L}\\p{N}])(?:' + entityTerms.map(escape).join('|') + ')(?![\\p{L}\\p{N}])', 'gu');
const captions = new Map();
for (const row of rows) if (!assigned.has(row.id) && words(row.source) <= 12 && !/[.!?]$/.test(row.source)) {
  const bindings = {}, lexical = {}; let i = 0;
  const template = row.source.replace(entityRE, term => { const name = 'entity' + (++i); bindings[name] = term; lexical[name] = term; return '{{' + name + '}}'; });
  if (!i) continue;
  if (!captions.has(template)) captions.set(template, []);
  captions.get(template).push({ row, bindings, lexical });
}
for (const [template, members] of captions) if (members.length > 1) {
  for (const m of members) add(m.row, 'exact_entity_caption_template', template, m.bindings, m.lexical, ['Exact official names appear in repeated short captions. Locale ambiguity still applies; inflected name forms may be needed. This grouping is an analysis proposal, not ready-made translated output.']);
}

for (const row of rows) if (!assigned.has(row.id)) {
  const prose = words(row.source) >= 9 || /[.!?]$/.test(row.source);
  add(row, prose ? 'remaining_prose' : 'remaining_label', row.source);
}
assert.equal(assigned.size, rows.length);
assert.equal(new Set(rows.map(r => r.id)).size, rows.length, 'source IDs unique');

const groupList = [...groups.values()];
const translationUnits = new Map();
function unit(source, kind, key) { if (!translationUnits.has(key)) translationUnits.set(key, { key, source, kind, words: words(source.replace(/\{\{[^{}]+\}\}|\{[^{}]+\}/g, '').replace(/\s+/g, ' ')) }); }
for (const g of groupList) {
  if (g.category === 'verbatim_identifier' || g.category === 'official_exact') continue;
  if (g.category === 'research_model_label' && g.sourceTemplate === '{{research}}') continue;
  const isPlain = g.category.startsWith('remaining_');
  unit(g.sourceTemplate, isPlain ? g.category : 'template', (isPlain ? 'literal:' : 'template:') + g.sourceTemplate);
}
for (const leaf of leaves.values()) unit(leaf.source, 'lexical_leaf', 'literal:' + leaf.source);
// Four unit-format tokens are separate from templates, because English d/h/m/s
// must not leak into a locale merely because the values were grouped.
for (const name of ['day', 'hour', 'minute', 'second']) unit(name, 'duration_unit', 'duration-unit:' + name);

const units = [...translationUnits.values()];
const perLocale = NEW.map(locale => {
  const reused = units.filter(u => u.kind !== 'template' && usableOfficial(u.source, locale));
  const pending = units.filter(u => !reused.includes(u));
  const exactRows = rows.filter(r => assigned.get(r.id).group.category === 'official_exact');
  return { locale, sourceMessages: rows.length, exactOfficialMessagesUsable: exactRows.filter(r => usableOfficial(r.source, locale)).length,
    exactOfficialMessagesAmbiguous: exactRows.filter(r => official[r.source].ambiguousLocales.includes(locale)).length,
    exactOfficialMessagesMissing: exactRows.filter(r => !official[r.source].uniqueValueByLocale[locale] && !official[r.source].ambiguousLocales.includes(locale)).length,
    reusableTranslationUnits: reused.length, remainingTranslationUnits: pending.length,
    remainingSourceWordsInUnits: pending.reduce((n, u) => n + u.words, 0),
    unitReductionFromUniqueMessages: rows.length - pending.length,
    unitReductionPercent: +(100 * (rows.length - pending.length) / rows.length).toFixed(2) };
});
const categories = [...new Set(groupList.map(g => g.category))].map(category => {
  const relevant = groupList.filter(g => g.category === category), members = relevant.flatMap(g => g.members);
  return { category, sourceMessages: members.length, sourceWords: members.reduce((n, m) => n + words(m.source), 0), groups: relevant.length,
    translationTemplates: relevant.filter(g => !['verbatim_identifier', 'official_exact', 'remaining_label', 'remaining_prose'].includes(category) && g.sourceTemplate !== '{{research}}').length,
    examples: relevant.sort((a, b) => b.members.length - a.members.length).slice(0, 5).map(g => ({ template: g.sourceTemplate, count: g.members.length, sources: g.members.slice(0, 3).map(m => m.source) })) };
});
const result = {
  schemaVersion: 1, analysisDate: '2026-11-04', mode: 'static inventory analysis only; no HTML/runtime/package mutation, translation service, or site build',
  inputs: { inventory: INPUT, officialMap: MAP, researchModel: 'data/content-60/research-phase3/model.json', inventorySha256: crypto.createHash('sha256').update(fs.readFileSync(INPUT)).digest('hex'), officialMapSha256: crypto.createHash('sha256').update(fs.readFileSync(MAP)).digest('hex') },
  scope: { pages: inventory.pages, sourceMessages: rows.length, sourceWords: rows.reduce((n, r) => n + words(r.source), 0), sourceCharacters: rows.reduce((n, r) => n + r.source.length, 0), newLocales: NEW, clientTermKeys: Object.keys(client.terms).length, distinctOfficialEnglishValues: Object.keys(official).length, researchModelNamedGroups: researchNames.size, researchTreeCount: treeNames.size },
  summary: { losslessSourceReconstructionPass: rows.length, uniqueMessagesAssignedExactlyOnce: rows.length, categoryCounts: counts(rows.map(r => assigned.get(r.id).group.category)),
    structuralTranslationUnitsBeforeOfficialReuse: units.length, structuralSourceWordsInUnits: units.reduce((n, u) => n + u.words, 0), structuralUnitReduction: rows.length - units.length,
    structuralUnitReductionPercent: +(100 * (rows.length - units.length) / rows.length).toFixed(2),
    remainingUngroupedProseMessages: categories.find(c => c.category === 'remaining_prose')?.sourceMessages || 0,
    remainingUngroupedProseWords: categories.find(c => c.category === 'remaining_prose')?.sourceWords || 0,
    remainingUngroupedLabelMessages: categories.find(c => c.category === 'remaining_label')?.sourceMessages || 0,
    lexicalLeafCount: leaves.size, semanticNote: 'Reduction measures distinct translation source units, not finished translation coverage, word-count quality, project duration, or approval likelihood.' },
  categories, perLocale,
  dependencies: { lexicalLeaves: [...leaves.values()], durationUnits: ['day', 'hour', 'minute', 'second'], ambiguousExactSources: rows.filter(r => official[r.source]?.ambiguousLocales?.length).map(r => ({ id: r.id, source: r.source, ...officialInfo(r.source) })) },
  findings: [
    'Every grouped message reconstructs the exact original source string with stored bindings. Numbers, profile identifiers, Roman stages, separators and literal words are not dropped.',
    'Official 488 client keys collapse to 479 distinct English values; source-string collisions need per-locale and stable-ID disambiguation. An exact English match alone is not sufficient when the map marks ambiguity.',
    'ar/vi/nb have no retained official term translations in this map. Those leaves remain authoring work; English fallback is not counted as translated.',
    'Research names come from the retained six-language model, not from the selected 488-key glossary. Grouped Roman tiers share a stem but the target stem must be translated or sourced separately.',
    'Remaining prose/label split is a transparent length/punctuation heuristic for workload routing, not a claim that all short text is UI or all long text is editorial.',
    'Existing placeholder names remain untouched. Numeric/entity templates need per-locale plural/declension/order review, especially inflected names and Arabic RTL presentation. Use explicit typed slots, not blind global text replacement.',
    'Public HTML/static crawlable text and accessible labels must continue to contain the complete localized information after any future renderer implementation.',
    'Inventory stores at most six context examples per unique string, so this audit counts unique source messages, not all DOM occurrences.',
  ],
  translationUnits: units,
  groups: groupList.sort((a, b) => b.members.length - a.members.length || a.id.localeCompare(b.id)),
};
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output: OUTPUT, scope: result.scope, summary: result.summary, categories: categories.map(({ category, sourceMessages, groups }) => ({ category, sourceMessages, groups })), perLocale }, null, 2));
