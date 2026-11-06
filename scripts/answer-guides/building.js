'use strict';

// Build-only answers. Numeric values come from the same approved projection and
// range function as the existing building calculator, never from translated text.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {parseHTML} = require('linkedom');
const registry = require('../building-data-registry');
const publisher = require('../build-buildings-unified');
const calculator = require('../../js/building-system');
const locales = require('../../data/i18n/locales.json').locales;
const copy = require('../../data/answer-guide-building-copy.json');
const ROOT = path.resolve(__dirname, '../..');
const sourceFiles = ['data/client-buildings-52.json', 'data/content-60/buildings.json', 'data/content-60/buildings-phase2.json', 'data/building-system-evidence.json'];
const sourceById = new Map(sourceFiles.flatMap(file => require(path.join(ROOT, file)).buildings.map(b => [b.id ?? b.buildingId, file])));
const canonicalById = new Map(registry.slugs.flatMap(slug => registry.publicBuildings(slug)).map(b => [b.id, b]));
const idToSlug = new Map([...canonicalById].map(([id, b]) => [id, b.slug]));
const fmt = (template, values) => template.replace(/\{([a-zA-Z]+)\}/g, (_, key) => {
  assert(Object.hasOwn(values, key), 'Missing building answer placeholder: ' + key);
  return String(values[key]);
});

function localeConfig(locale, slug) {
  assert(locales.some(l => l.code === locale), 'Unknown answer locale');
  assert(registry.slugs.includes(slug), 'Unknown building answer route');
  const file = path.join(ROOT, locale, 'buildings', slug, 'index.html');
  const {document} = parseHTML(fs.readFileSync(file, 'utf8'));
  const nodes = document.querySelectorAll('script[data-building-system-model]');
  assert.equal(nodes.length, 1, 'Building answer requires one existing localized model');
  return publisher.localizedConfig(JSON.parse(nodes[0].textContent), locale, slug);
}

function rangeModel(building, from, to, resourceIds = registry.model.resources.map(r => r.id)) {
  assert(sourceById.has(building.id), 'Unknown building answer source');
  const profiles = building.profiles;
  assert.equal(profiles.length, 1); assert.equal(profiles[0].id, 'unified');
  const rows = profiles[0].rows;
  let result, missing = false;
  try { result = calculator.sumRange(rows, from, to); }
  catch (error) { if (error.message !== 'missing') throw error; missing = true; }
  const selected = rows.filter(r => r.level > from && r.level <= to);
  const rowAt = level => rows.find(r => r.level === level);
  const prerequisites = selected.map(row => ({level: row.level, rank: row.rank,
    requirements: Array.isArray(row.requirements) ? row.requirements.map(q => ({buildingId: q.buildingId, level: q.level, rank: q.rank})) : null}));
  const partial = missing || prerequisites.some(p => p.requirements === null);
  // A partial single row can still expose its individually verified fields.
  // Never sum across an incomplete range or substitute zero for an absent field.
  const single = selected.length === 1 ? selected[0] : null;
  const knownSeconds = result?.seconds ?? (single && Number.isSafeInteger(single.seconds) && single.seconds >= 0 ? single.seconds : null);
  const singleItemsValid = single && Array.isArray(single.constructionItems) && single.constructionItems.every(i =>
    Number.isSafeInteger(i.id ?? i.itemId) && (i.id ?? i.itemId) > 0 && Number.isSafeInteger(i.quantity) && i.quantity >= 0);
  const knownItems = result?.constructionItems ?? (singleItemsValid ? single.constructionItems : null);
  const zero = result && result.resources.every(n => n === 0) && result.seconds === 0 && result.constructionItems.every(i => i.quantity === 0);
  return {
    targetId: building.id,
    start: {level: from, rank: rowAt(from)?.rank ?? 0},
    target: {level: to, rank: rowAt(to)?.rank ?? 0},
    material: {id: 'building-requirements', unit: 'mixed'},
    method: to - from <= 1 ? 'incremental' : 'cumulative',
    scope: {model: 'normal-building', profile: 'unified', fromExclusive: true, toInclusive: true,
      prerequisiteCostsIncluded: false, bonusesIncluded: false, inventoryIncluded: false},
    source: {file: sourceById.get(building.id), version: registry.model.gameVersion, build: registry.evidence.gameBuild,
      recordIds: selected.flatMap(row => ['original', 'd'].map(profile => `${building.id}:${profile}:${row.level}:${row.rank}`))},
    status: partial ? 'partial' : zero ? 'confirmed-zero' : 'confirmed',
    resources: result ? result.resources.map((quantity, i) => ({id: resourceIds[i], quantity, unit: 'count'})) : null,
    seconds: knownSeconds,
    constructionItems: knownItems ? knownItems.map(i => ({id: i.id ?? i.itemId, quantity: i.quantity, unit: 'count'})) : null,
    prerequisites
  };
}

function guides(locale) {
  const localeInfo = locales.find(l => l.code === locale);
  assert(localeInfo && copy.locales[locale], 'Unknown building answer locale');
  const c = copy.locales[locale];
  const number = value => new Intl.NumberFormat(localeInfo.numberLocale, {maximumFractionDigits: 0}).format(value);
  const list = values => new Intl.ListFormat(localeInfo.numberLocale, {style: 'long', type: 'conjunction'}).format(values);
  const localizedName = names => { const value = names?.[locale] || names?.en; assert(value, 'Missing building answer name'); return value; };
  return registry.slugs.map(slug => {
    const cfg = localeConfig(locale, slug);
    const route = `/${locale}/buildings/${slug}/`;
    const prefix = cfg.locale.labels.levelPrefix;
    const levelPrefix = /[.\s]$/.test(prefix) || ['ja','zh-tw','zh-cn'].includes(locale) ? prefix : prefix + ' ';
    const level = row => row.level === 0 ? cfg.locale.labels.newConstruction :
      `${levelPrefix}${number(row.level)}${row.rank ? ` (${cfg.locale.labels.stage} ${number(row.rank)})` : ''}`;
    const duration = seconds => {
      if (seconds === null) return c.unknown;
      // Keep the existing seconds-to-duration calculation, localize only digits.
      return calculator.duration(seconds, cfg.locale.units.duration).replace(/\d+/g, digits => number(Number(digits)));
    };
    const requirementNames = new Map(cfg.buildings.flatMap(b => b.profiles[0].rows.flatMap(r => r.requirements || [])).filter(q => q.name).map(q => [q.buildingId, q.name]));
    const nameForId = id => localizedName(requirementNames.get(id) || cfg.names?.[id] || canonicalById.get(id)?.name);
    function answer(building, from, to, cumulative = false) {
      const model = rangeModel(building, from, to, cfg.resources.map(r => r.id));
      const name = localizedName(building.name);
      const variables = {building: name, start: level(model.start), target: level(model.target)};
      const startIsConstruction = from === 0 && to === 1;
      const question = fmt(cumulative ? c.cumulativeQuestion : startIsConstruction ? c.constructionQuestion : c.upgradeQuestion, variables);
      const paragraphs = [];
      const tableRows = [];
      if (model.resources) {
        const resourceParts = model.resources.map(resource => {
          const resourceName = localizedName(cfg.resources.find(r => r.id === resource.id).name);
          tableRows.push([resourceName, number(resource.quantity)]);
          return `${resourceName} ${number(resource.quantity)}`;
        });
        paragraphs.push(fmt(cumulative ? c.cumulativeAnswer : startIsConstruction ? c.constructionAnswer : c.upgradeAnswer,
          {...variables, resources: list(resourceParts), time: duration(model.seconds)}));
      } else paragraphs.push(fmt(startIsConstruction ? c.unknownConstruction : c.partial, variables));
        if (model.constructionItems?.length) {
          const itemNames = new Map(building.profiles[0].rows.flatMap(r => r.constructionItems || []).map(item => [item.id ?? item.itemId, item.name]));
          const itemParts = model.constructionItems.map(item => {
            const itemName = localizedName(itemNames.get(item.id));
            tableRows.push([itemName, number(item.quantity)]);
            return `${itemName} ${number(item.quantity)}`;
          });
          paragraphs.push(fmt(c.items, {items: list(itemParts)}));
        }
        if (model.seconds !== null) tableRows.push([cfg.locale.labels.time, duration(model.seconds)]);

      const finalPrerequisites = model.prerequisites.at(-1)?.requirements;
      if (!cumulative && finalPrerequisites) {
        paragraphs.push(finalPrerequisites.length ? fmt(c.conditions, {...variables,
          requirements: list(finalPrerequisites.map(q => `${nameForId(q.buildingId)} ${level(q)}`))}) : c.noConditions);
      }
      if (cumulative) paragraphs.push(fmt(c.rangeRule, {...variables, first: level({level: from + 1, rank: building.profiles[0].rows.find(r => r.level === from + 1)?.rank ?? 0}), last: level(model.target)}));
      paragraphs.push(c.scope);
      const links = [{label: c.openCalculator, href: route + '#upgrade-sheet'}];
      if (!cumulative && finalPrerequisites) for (const q of finalPrerequisites) {
        const prerequisiteSlug = idToSlug.get(q.buildingId);
        if (prerequisiteSlug) links.push({label: `${nameForId(q.buildingId)} ${level(q)}`, href: `/${locale}/buildings/${prerequisiteSlug}/#building-${q.buildingId}`});
      }
      if (slug === 'power-plant') {
        paragraphs.push(c.normalNote);
        links.push({label: c.openNuclear, href: `/${locale}/eras/nuclear-age/`});
      }
      return {id: `building-${building.id}-${from}-to-${to}-${cumulative ? 'total' : 'requirements'}`, question, paragraphs, model,
        ...(tableRows.length ? {table: {caption: fmt(c.tableCaption, variables), columns: [c.resource, c.quantity], rows: tableRows}} : {}), links};
    }
    const answers = cfg.buildings.flatMap(building => {
      const rows = building.profiles[0].rows;
      const max = Math.max(...rows.map(r => r.level));
      const result = [answer(building, max - 1, max)];
      if (rows[0].availability === 'initial_conditions_unconfirmed' || rows[0].calculationBlocked) result.push(answer(building, 0, 1));
      if (slug === 'power-plant') result.push(answer(building, 1, max, true));
      return result;
    });
    const guide = {route, kind: 'building', targetId: cfg.buildings.length === 1 ? cfg.buildings[0].id : slug, answers,
      basis: {text: fmt(c.basis, {version: registry.model.gameVersion})}};
    if (slug === 'power-plant') {
      const first = answers[0], name = localizedName(cfg.buildings[0].name);
      const values = {building: name, start: level(first.model.start), target: level(first.model.target)};
      guide.example = {title: fmt(c.exampleTitle, values), paragraphs: [fmt(c.exampleBody, values), first.paragraphs[0]], links: [first.links[0]]};
    }
    return guide;
  });
}

module.exports = {guides, rangeModel, localeConfig};
