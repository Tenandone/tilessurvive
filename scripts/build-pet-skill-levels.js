'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('node:assert/strict');
const {parseHTML} = require('linkedom');
const copy = require('../data/pet-skill-levels-copy');
const root = path.resolve(__dirname, '..');
const langs = ['ko', 'en', 'ja', 'ru', 'zh-tw', 'de'];
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const format = (value, params) => Object.entries(params).reduce((text, [key, entry]) => text.replaceAll(`{${key}}`, String(entry)), value);
const localized = (value, lang) => typeof value === 'string' ? value : value?.[lang] || '';
const headingId = pet => pet === 'starhorn' ? 'character-section-1' : 'pet-skills-heading-41';

function validatedSkill(skill, lang) {
  assert(Number.isInteger(skill.slot) && skill.slot > 0, 'Skill slot is required');
  assert(Number.isInteger(skill.maxLevel) && skill.maxLevel > 0, 'A real skill maximum is required');
  assert(localized(skill.names, lang), `Missing ${lang} skill name`);
  const levels = (skill.levels || []).map(level => {
    assert(Number.isInteger(level.level) && level.level >= 1 && level.level <= skill.maxLevel, 'Invalid skill level');
    const description = localized(level.description, lang);
    assert(description, `Missing ${lang} skill description`);
    return {level: level.level, description, trainingStage: Number.isInteger(level.trainingStage) ? level.trainingStage : null};
  }).sort((a, b) => a.level - b.level);
  assert.equal(new Set(levels.map(level => level.level)).size, levels.length, 'Duplicate skill level');
  const highest = levels.at(-1)?.level ?? null;
  assert.equal(skill.highestVerifiedLevel, highest, 'Highest verified level must match published descriptions');
  if (skill.defaultLevel != null) assert.equal(skill.defaultLevel, highest, 'Default must be the highest verified level');
  return {slot: skill.slot, maxLevel: skill.maxLevel, highestVerifiedLevel: highest, levels};
}

function renderSkill(skill, pet, lang) {
  const t = copy[lang], model = validatedSkill(skill, lang), highest = model.levels.at(-1), first = model.levels[0];
  const name = localized(skill.names, lang), petName = localized(pet.names, lang) || pet.id;
  const src = skill.src || skill.image;
  if (src) assert(src.startsWith('/') && !src.startsWith('//') && !src.includes('..'), 'Skill image must be a local asset');
  const stage = skill.unlockStage ?? skill.unlockTrainingStage;
  const unlock = Number.isInteger(stage) && stage > 0 ? format(t.unlock, {stage}) : t.basic;
  const limit = localized(skill.additionalLimit || skill.note, lang);
  const selectedLabel = highest ? format(t.selected, {level: highest.level}) : t.unavailable;
  const range = highest ? format(highest.level === model.maxLevel ? t.maximum : t.highest, {level: highest.level}) : t.unavailableMax;
  const maxNote = !highest || highest.level !== model.maxLevel ? ` · ${format(t.configuredMax, {level: model.maxLevel})}` : '';
  const search = highest ? `Lv.${highest.level} · ${highest.description}` : limit || t.unavailable;
  const options = selected => model.levels.map(level => `<option value="${level.level}"${level.level === selected ? ' selected' : ''}>Lv.${level.level}</option>`).join('');
  const controls = model.levels.length > 1 ? `<div class="pet-skill-controls" data-skill-controls hidden><label class="pet-skill-select-label" for="pet-skill-${skill.slot}-level">${esc(t.level)}<select id="pet-skill-${skill.slot}-level" data-skill-level>${options(highest.level)}</select></label><label class="pet-skill-compare-toggle" for="pet-skill-${skill.slot}-compare"><input type="checkbox" id="pet-skill-${skill.slot}-compare" data-skill-compare-toggle aria-controls="pet-skill-${skill.slot}-comparison">${esc(t.compare)}</label><label class="pet-skill-select-label" for="pet-skill-${skill.slot}-compare-level">${esc(t.compareLevel)}<select id="pet-skill-${skill.slot}-compare-level" data-skill-compare-level disabled>${options(first.level)}</select></label></div>` : '';
  const training = value => Number.isInteger(value) ? esc(`${t.training}: ${value}`) : '';
  const effects = highest ? `<div class="pet-skill-effects" data-skill-effects><div class="pet-skill-effect-panel" aria-live="polite" aria-atomic="true"><p class="pet-skill-effect-label" data-skill-level-label>${esc(selectedLabel)}</p><p class="ts3-pet-skill-description" data-skill-effect>${esc(highest.description)}</p><p class="pet-skill-training" data-skill-training${Number.isInteger(highest.trainingStage) ? '' : ' hidden'}>${training(highest.trainingStage)}</p></div>${model.levels.length > 1 ? `<div class="pet-skill-effect-panel" data-skill-comparison id="pet-skill-${skill.slot}-comparison" aria-live="polite" aria-atomic="true" hidden><p class="pet-skill-effect-label" data-skill-comparison-label>${esc(format(t.comparison, {level: first.level}))}</p><p data-skill-comparison-effect>${esc(first.description)}</p><p class="pet-skill-training" data-skill-comparison-training${Number.isInteger(first.trainingStage) ? '' : ' hidden'}>${training(first.trainingStage)}</p></div>` : ''}</div>` : `<p class="ts3-pet-skill-description" data-skill-unavailable>${esc(t.unavailable)}</p>`;
  const reference = model.levels.length > 1 ? `<details class="pet-skill-reference" data-skill-level-reference><summary>${esc(t.reference)}</summary><div class="pet-skill-table-wrap" tabindex="0" role="region" aria-label="${esc(name + ' · ' + t.reference)}"><table><thead><tr><th scope="col">${esc(t.level)}</th><th scope="col">${esc(t.effect)}</th><th scope="col">${esc(t.training)}</th></tr></thead><tbody>${model.levels.map(level => `<tr data-skill-reference-level="${level.level}"><th scope="row">Lv.${level.level}</th><td data-skill-reference-effect>${esc(level.description)}</td><td>${Number.isInteger(level.trainingStage) ? level.trainingStage : '—'}</td></tr>`).join('')}</tbody></table></div></details>` : '';
  return `<article class="pet-level-skill" id="pet-skill-${skill.slot}-41" data-pet-skill-slot="${skill.slot}" data-search-entry data-search-title="${esc(petName + ' · ' + name)}" data-search-description="${esc(search)}"><div class="pet-skill-heading">${src ? `<img src="${esc(src)}" width="128" height="128" alt="" loading="lazy" decoding="async">` : ''}<div><h3>${esc(name)}</h3><p class="ts3-pet-skill-unlock">${esc(unlock)}</p></div></div><p class="pet-skill-range">${esc(range + maxNote)}</p>${controls}${effects}${limit ? `<p class="ts3-pet-skill-limit">${esc(limit)}</p>` : ''}${model.maxLevel === 1 && highest ? `<p class="pet-skill-training">${esc(t.single)}</p>` : ''}${reference}</article>`;
}

function asset(document, tag, file) {
  const node = document.createElement(tag);
  const version = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 12);
  node.setAttribute('data-pet-skill-levels-asset', '');
  if (tag === 'link') { node.rel = 'stylesheet'; node.href = `/${file}?v=${version}`; }
  else { node.src = `/${file}?v=${version}`; node.setAttribute('defer', ''); }
  document.head.append(node);
}

function renderSection(pet, lang, data) {
  const t = copy[lang], heading = headingId(pet.id);
  const payload = {copy: {selected: t.selected, comparison: t.comparison, training: t.training}, skills: pet.skills.map(skill => validatedSkill(skill, lang))};
  return `<section class="ts3-character-section pet-skill-levels" data-pet-skills-41="${esc(pet.id)}" data-pet-skill-levels="${esc(pet.id)}" data-characters-generated="" aria-labelledby="${heading}"><h2 id="${heading}">${esc(t.title)}</h2><p class="pet-skill-scope">${esc(t.scope)} ${esc(format(t.gameVersion, {version: data.gameVersion}))}</p><div class="pet-skill-list">${pet.skills.map(skill => renderSkill(skill, pet, lang)).join('')}</div><script type="application/json" data-pet-skill-levels-data>${json(payload)}</script></section>`;
}

function applyPetSkillLevels(document, pet, lang, data) {
  assert(langs.includes(lang), 'Unsupported language');
  const t = copy[lang], main = document.querySelector('main'), nav = main?.querySelector('.ts3-character-sections');
  assert(main && nav && main.querySelector('.ts3-pet-stage'), 'Expected current pet detail structure');
  assert(pet.skills.length > 0, 'Pet skill inventory is required');
  assert.equal(new Set(pet.skills.map(skill => skill.slot)).size, pet.skills.length, 'Duplicate skill slot');
  const existing = document.querySelectorAll('[data-pet-skills-41], [data-pet-skill-levels]');
  existing.forEach(section => section.remove());
  document.querySelectorAll('[data-pet-skill-levels-asset], link[data-pet-skills-style-41]').forEach(node => node.remove());
  const heading = headingId(pet.id), fragment = document.createElement('div');
  fragment.innerHTML = renderSection(pet, lang, data);
  const section = fragment.firstElementChild;
  nav.after(section);
  const href = `/${lang}/database/pet-system/${pet.id}/#${heading}`;
  const links = [...nav.querySelectorAll('a')].filter(node => node.getAttribute('href') === href);
  assert(links.length <= 1, 'Duplicate existing skill navigation');
  links.forEach(node => node.remove());
  const link = document.createElement('a'); link.href = href; link.textContent = t.title; nav.prepend(link);
  asset(document, 'link', 'css/pet-skill-levels.css');
  asset(document, 'script', 'js/pet-skill-levels.js');
  return document;
}

function applyPetSkillRoster(document, lang, data) {
  for (const pet of data.pets) {
    const card = document.querySelector(`main #pet-${pet.id}.ts-pet-row`);
    assert(card, `Missing ${pet.id} roster card`);
    const existing = card.querySelectorAll('[data-pet-skill-roster-41], [data-pet-skill-roster-levels]');
    assert(existing.length <= 1, 'Duplicate skill roster link');
    const link = existing[0] || document.createElement('a');
    link.setAttribute('data-pet-skill-roster-levels', pet.id);
    link.setAttribute('href', `/${lang}/database/pet-system/${pet.id}/#${headingId(pet.id)}`);
    link.textContent = copy[lang].roster;
    if (!existing.length) card.append(link);
  }
  return document;
}

// The legacy German builder translates the shared source before this overlay is reapplied.
function stripOwnedSections(document, lang = 'en') {
  for (const section of document.querySelectorAll('[data-pet-skill-levels]')) {
    const pet = section.getAttribute('data-pet-skill-levels'), heading = headingId(pet);
    const nav = document.querySelector('.ts3-character-sections');
    nav?.querySelectorAll('a').forEach(link => {
      if (link.getAttribute('href')?.endsWith(`/database/pet-system/${pet}/#${heading}`)) link.remove();
    });
    section.remove();
  }
  document.querySelectorAll('[data-pet-skill-levels-asset]').forEach(node => node.remove());
  const legacyCopy = require('../data/foundation-40/pet-skills-copy-41');
  for (const link of document.querySelectorAll('[data-pet-skill-roster-levels]')) {
    if (link.hasAttribute('data-pet-skill-roster-41')) {
      // Preserve entity tokenization for the historical German text-node catalog.
      link.innerHTML = esc((legacyCopy[lang]?.title || copy[lang].title) + ' · Lv.1');
      link.removeAttribute('data-pet-skill-roster-levels');
    } else link.remove();
  }
  return document;
}

function build() {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/pet-skill-levels.json'), 'utf8'));
  let changed = 0;
  const write = (file, document, before) => {
    const after = '<!DOCTYPE html>\n' + document.documentElement.outerHTML + '\n';
    if (after !== before) { fs.writeFileSync(file, after); changed++; }
  };
  for (const lang of langs) {
    for (const pet of data.pets) {
      const file = path.join(root, lang, 'database/pet-system', pet.id, 'index.html'), before = fs.readFileSync(file, 'utf8');
      write(file, applyPetSkillLevels(parseHTML(before).document, pet, lang, data), before);
    }
    const file = path.join(root, lang, 'database/pet-system/index.html'), before = fs.readFileSync(file, 'utf8');
    write(file, applyPetSkillRoster(parseHTML(before).document, lang, data), before);
  }
  console.log(JSON.stringify({petSkillPages: data.pets.length * langs.length, petRosterPages: langs.length, changed}));
}

if (require.main === module) build();
module.exports = {build, applyPetSkillLevels, applyPetSkillRoster, stripOwnedSections, renderSection, renderSkill, validatedSkill, langs};
