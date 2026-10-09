/* Reviewed UI observations. Default is a dry-run. Run --apply before the normal
 * data/character build to update only named pet roles and rarities. Run --html
 * after page generation and copy cleanup to scope the existing EXP form and
 * display the six observed level thresholds. Only the reviewed Starhorn growth
 * rows are extended; every other growth dataset and all formulas stay intact. */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const inputPath = path.join(root, 'data/foundation-40/pet-observations.json');
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const growth = require('../data/foundation-40/starhorn-growth.json');
const hatching = require('../data/foundation-40/pet-hatching.json');
const crypto = require('crypto');
const languages = ['ko', 'en', 'ja', 'ru', 'zh-tw'];
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const sources = new Map(data.sources.map(source => [source.id, source]));
assert(sources.size === data.sources.length, 'Duplicate evidence IDs');
for (const source of sources.values()) {
  assert(source.kind === 'game-screen' && /^[a-f0-9]{64}$/.test(source.sha256), `Invalid evidence: ${source.id}`);
  assert(source.gameVersion === data.gameVersion && source.build === data.build, `Version mismatch: ${source.id}`);
  assert(/^[0-9]{3}-[a-z0-9-]+\.png$/.test(source.capture), `Invalid local capture name: ${source.id}`);
}
assert(data.pets.length === new Set(data.pets.map(pet => pet.id)).size, 'Duplicate pet observations');
for (const pet of data.pets) {
  assert(pet.status === 'CONFIRMED' && ['R', 'SR', 'SSR'].includes(pet.rarity), `Unconfirmed pet rarity: ${pet.id}`);
  assert(pet.evidenceIds.length && pet.evidenceIds.every(id => sources.has(id)), `Missing pet evidence: ${pet.id}`);
  assert(pet.expObservation.status === 'CONFIRMED' && sources.has(pet.expObservation.evidenceId), `Unconfirmed EXP point: ${pet.id}`);
  assert(Number.isInteger(pet.expObservation.level) && pet.expObservation.level > 0 && pet.expObservation.threshold > 0, `Invalid EXP point: ${pet.id}`);
}
for (const correction of data.corrections) {
  const pet = data.pets.find(pet => pet.id === correction.id);
  assert(pet && correction.field === 'role' && pet.roleStatus === 'CONFIRMED' && pet.role === correction.to, `Invalid correction: ${correction.id}`);
  assert(correction.status === 'CONFIRMED' && correction.evidenceIds.every(id => sources.has(id)), `Missing role evidence: ${correction.id}`);
}
for (const lang of languages) assert(data.localizedScope[lang]?.trim(), `Missing ${lang} scope note`);
for (const correction of data.skillNameCorrections || []) {
  assert(correction.petId === 'starhorn' && correction.locale === 'ko' && correction.from === '별의 축복' && correction.to === '별빛의 축복', 'Unexpected skill-name correction');
  assert(correction.status === 'CONFIRMED' && correction.evidenceId === 'pet-ui-041' && sources.has(correction.evidenceId), 'Missing skill-name evidence');
}
assert(!data.calculatorPolicy.modifyExistingFormulas && !data.calculatorPolicy.addUnconfirmedCosts && !data.calculatorPolicy.enableOtherPetCurves, 'Unexpected calculator modification policy');
assert(data.existingExpDataset.newCurveRowsApproved && JSON.stringify(data.existingExpDataset.publicScopePetIds) === '["starhorn"]', 'Unreviewed growth-curve extension');
assert(growth.petId === 'starhorn' && growth.gameVersion === '2.6.200' && growth.build === 1512 && growth.scope === 'starhorn-only-versioned-explicit-rows', 'Unexpected growth scope');
assert(crypto.createHash('sha256').update(JSON.stringify(growth)).digest('hex') === 'c8af50e487fe29823ffe5c7ece7b723052e7793b1ec607ff0b6bcd2cc8bf2a6b', 'Reviewed Starhorn row model changed');
assert(growth.expRows.length === 99 && growth.expRows.every((r, i) => r.from === i + 1 && r.to === i + 2 && Number.isInteger(r.cost) && r.cost > 0), 'Explicit EXP transition coverage');
assert(growth.trainingRows.length === 5 && growth.trainingRows.every((r, i) => r.from === i && r.to === i + 1 && r.cost === r.stepCost * 20), 'Explicit training transition coverage');
assert(data.teamRule.sourceURL === 'https://tilesurvivegame.com/en/blog/1134' && languages.every(lang => data.teamRule.text[lang]?.trim()), 'Official one-pet team rule');
const growthSource = { url: 'https://github.com/Tenandone/tilessurvive/blob/main/data/foundation-40/starhorn-growth.json', version: 'Tiles Survive 2.6.200', kind: 'game-resource-field-validated' };
const hatchSource = { url: 'https://github.com/Tenandone/tilessurvive/blob/main/data/foundation-40/pet-hatching.json', version: 'Tiles Survive 2.6.200', kind: 'game-screen' };
const targets = ['data/companions.json', 'data/expansion-22/database.json'];
const outputs = [], plan = [];
for (const relativePath of targets) {
  const file = path.join(root, relativePath);
  const source = JSON.parse(fs.readFileSync(file, 'utf8'));
  const next = JSON.parse(JSON.stringify(source));
  for (const observed of data.pets) {
    const pet = next.pets.find(pet => pet.id === observed.id);
    assert(pet, `Unknown existing pet: ${observed.id} in ${relativePath}`);
    assert(pet.ko === observed.nameKo, `Unexpected name mismatch: ${observed.id}`);
    if (pet.rarity !== observed.rarity) {
      plan.push({ file: relativePath, pet: pet.id, field: 'rarity', from: pet.rarity, to: observed.rarity });
      pet.rarity = observed.rarity;
    }
    const correction = data.corrections.find(change => change.id === pet.id);
    if (correction) {
      assert(pet.role === correction.from || pet.role === correction.to, `Unexpected existing role: ${pet.id}`);
      if (pet.role !== correction.to) {
        plan.push({ file: relativePath, pet: pet.id, field: 'role', from: pet.role, to: correction.to });
        pet.role = correction.to;
      }
    }
  }
  if (relativePath === 'data/expansion-22/database.json') {
    // Existing non-null costs remain exact anchors; a null is not a cost.
    for (const row of source.datasets.petExp.rows) if (row.cost !== null) assert(growth.expRows.find(r => r.from === row.from && r.to === row.to)?.cost === row.cost, `Existing EXP cost changed: ${row.from}`);
    for (const row of source.datasets.petTraining.rows) {
      const approved = growth.trainingRows.find(r => r.from === row.from && r.to === row.to);
      assert(approved && approved.cost === row.cost && approved.stepCost === row.stepCost && (row.bonus === null || approved.bonus === row.bonus), `Existing training value changed: ${row.from}`);
    }
    next.sources.starhornGrowth = growthSource;
    next.sources.petHatching = hatchSource;
    for (const pet of hatching.pets) {
      const stored = next.pets.find(p => p.id === pet.id);
      assert(stored.ko === pet.nameKo && Object.entries(hatching.legacyColumnMapping).every(([key, oldKey]) => stored.eggs[oldKey] === pet[key]), `Hatch display requires a reviewed data correction: ${pet.id}`);
    }
    next.datasets.petExp = { source: 'starhornGrowth', unit: 'EXP', min: 1, max: 100, rows: growth.expRows };
    next.datasets.petTraining = { source: 'starhornGrowth', unit: 'marks', min: 0, max: 5, rows: growth.trainingRows };
    if (JSON.stringify(next.datasets) !== JSON.stringify(source.datasets)) plan.push({ file: relativePath, fields: ['datasets.petExp', 'datasets.petTraining'], pet: 'starhorn', expTransitions: 99, trainingTransitions: 5 });
  }
  // Reject unrelated changes, including previously validated stats or calculator data.
  const allowedIds = new Set(data.pets.map(pet => pet.id));
  const normalized = JSON.parse(JSON.stringify(next));
  for (const pet of normalized.pets) if (allowedIds.has(pet.id)) {
    const old = source.pets.find(old => old.id === pet.id);
    pet.role = old.role; pet.rarity = old.rarity;
  }
  if (relativePath === 'data/expansion-22/database.json') {
    normalized.datasets.petExp = source.datasets.petExp;
    normalized.datasets.petTraining = source.datasets.petTraining;
    normalized.sources = source.sources;
  }
  assert(JSON.stringify(normalized) === JSON.stringify(source), `Unrelated source change: ${relativePath}`);
  outputs.push({ file, source, next });
}
const apply = process.argv.includes('--apply');
const html = process.argv.includes('--html');
assert(!(apply && html), 'Run --apply before page generation; run --html afterward');
if (apply) for (const output of outputs) {
  if (JSON.stringify(output.source) !== JSON.stringify(output.next)) fs.writeFileSync(output.file, `${JSON.stringify(output.next, null, 2)}\n`);
}
const htmlOutputs = [];
if (html) {
  const { parseHTML } = require('linkedom');
  const copy = require('../data/foundation-40/pet-growth-copy');
  const readHTML = relativePath => {
    const file = path.join(root, relativePath), source = fs.readFileSync(file, 'utf8');
    return { file, source, next: source, document: parseHTML(source).document };
  };
  // Replace only exact existing fragments; never reserialize an entire page.
  const replace = (page, before, after) => {
    assert(before && page.next.split(before).length === 2, `Expected one exact HTML slot in ${page.file}`);
    page.next = page.next.replace(before, () => after);
  };
  const updateNode = (page, node, change) => {
    assert(node, `Missing HTML slot in ${page.file}`);
    const before = node.outerHTML;
    change(node);
    replace(page, before, node.outerHTML);
  };
  const petArtIds = ['snowball', 'dodo', 'buckler', 'hardhead', 'shadow', 'starhorn', 'fluffy'];
  const normalizeImage = node => {
    const next = node.cloneNode(true), match = next.getAttribute('src')?.match(/^\/img\/game-40\/pets\/([a-z]+)\.webp$/);
    if (match && petArtIds.includes(match[1])) {
      const mainArt = next.getAttribute('data-pet-main-art-40') === 'starhorn' && match[1] === 'starhorn';
      assert(mainArt ? next.getAttribute('style') === 'object-fit:contain;width:100%;height:100%' : /^object-fit:\s*contain;?$/.test(next.getAttribute('style') || ''), 'Approved pet artwork must use contain');
      next.setAttribute('src', `/img/pets/${match[1]}.webp`); next.removeAttribute('style');
    }
    return next.outerHTML;
  };
  const replacePetArt = page => {
    for (const id of petArtIds) {
      const dest = `/img/game-40/pets/${id}.webp`;
      assert(fs.existsSync(path.join(root, dest)), `Missing approved pet artwork: ${id}`);
      for (const node of page.document.querySelectorAll(`main img[src="/img/pets/${id}.webp"]`)) {
        assert(!node.hasAttribute('style'), `Unexpected existing pet image style: ${id}`);
        updateNode(page, node, image => { image.setAttribute('src', dest); image.setAttribute('style', 'object-fit:contain'); });
      }
    }
  };
  const invariantParts = document => JSON.stringify({
    head: document.head.outerHTML,
    scripts: [...document.querySelectorAll('script')].map(node => node.outerHTML),
    tables: [...document.querySelectorAll('table')].map(node => node.outerHTML),
    links: [...document.querySelectorAll('a:not([data-pet-team-source])')].map(node => {
      let markup = node.outerHTML;
      for (const image of node.querySelectorAll('img')) markup = markup.replace(image.outerHTML, normalizeImage(image));
      return markup;
    }),
    images: [...document.querySelectorAll('img, picture')].map(normalizeImage),
    inputs: [...document.querySelectorAll('input, select, output, button')].map(node => node.outerHTML)
  });
  for (const lang of languages) {
    const page = readHTML(`${lang}/database/pet-system/index.html`);
    const beforeInvariant = invariantParts(page.document);
    const form = page.document.querySelector('[data-growth-form="petExp"]');
    assert(form && form.closest('section')?.id === 'pet-data-22', `Missing pet EXP form: ${lang}`);
    const section = form.closest('section');
    const heading = form.previousElementSibling;
    assert(heading?.tagName === 'H3', `Unexpected pet EXP heading: ${lang}`);
    const note = section.querySelector('#pet-exp-scope-40') || [...section.children].find(node => node.tagName === 'P');
    updateNode(page, note, node => {
      node.id = 'pet-exp-scope-40';
      node.textContent = copy[lang].limits;
    });
    const beforeFormTag = form.outerHTML.slice(0, form.outerHTML.indexOf('>') + 1);
    const beforeHeading = heading.outerHTML;
    heading.textContent = copy[lang].title;
    replace(page, beforeHeading + beforeFormTag, heading.outerHTML + beforeFormTag);
    const descriptions = new Set((form.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    descriptions.add('pet-exp-scope-40');
    form.setAttribute('aria-describedby', [...descriptions].join(' '));
    const nextFormTag = form.outerHTML.slice(0, form.outerHTML.indexOf('>') + 1);
    replace(page, beforeFormTag, nextFormTag);
    const training = section.querySelector('[data-growth-form="petTraining"]');
    assert(training?.previousElementSibling?.tagName === 'H3', `Missing training heading: ${lang}`);
    updateNode(page, training.previousElementSibling, node => { node.textContent = copy[lang].training; });
    const trainingTag = training.outerHTML.slice(0, training.outerHTML.indexOf('>') + 1);
    training.setAttribute('aria-describedby', [...new Set([...(training.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean), 'pet-exp-scope-40'])].join(' '));
    replace(page, trainingTag, training.outerHTML.slice(0, training.outerHTML.indexOf('>') + 1));
    const existingRule = page.document.querySelector('[data-pet-team-rule]');
    const rule = page.document.createElement('p');
    rule.setAttribute('data-pet-team-rule', '');
    rule.append(data.teamRule.text[lang] + ' ');
    const source = page.document.createElement('a');
    source.setAttribute('data-pet-team-source', ''); source.href = data.teamRule.sourceURL; source.textContent = copy[lang].source;
    rule.append(source);
    if (existingRule) replace(page, existingRule.outerHTML, rule.outerHTML);
    else {
      const intro = page.document.querySelector('main p');
      assert(intro, `Missing pet introduction: ${lang}`);
      replace(page, intro.outerHTML, intro.outerHTML + rule.outerHTML);
    }
    replacePetArt(page);
    assert(invariantParts(parseHTML(page.next).document) === beforeInvariant, `Pet hub protected content changed: ${lang}`);
    htmlOutputs.push(page);
    for (const id of petArtIds) {
      const pet = data.pets.find(pet => pet.id === id) || { id };
      const detail = readHTML(`${lang}/database/pet-system/${pet.id}/index.html`);
      const beforeDetail = invariantParts(detail.document);
      if (pet.expObservation) {
      const point = pet.expObservation;
      const pointText = `Lv.${point.level} → ${point.level + 1}: ${point.threshold.toLocaleString('en-US')} EXP`;
      const existing = detail.document.querySelector(`[data-pet-exp-point-40="${pet.id}"]`);
      if (existing) updateNode(detail, existing, node => { node.textContent = pointText; });
      else if (pet.id === 'starhorn') {
        const foodNote = [...detail.document.querySelectorAll('main p')].find(node => node.textContent.includes('+50 / +100 / +200 / +500 EXP'));
        assert(foodNote && /120 EXP/.test(foodNote.textContent), `Missing existing Starhorn feeding data: ${lang}`);
        updateNode(detail, foodNote, node => {
          const span = detail.document.createElement('span');
          span.setAttribute('data-pet-exp-point-40', pet.id);
          span.textContent = pointText;
          node.append(' · ', span);
        });
      } else {
        const stage = detail.document.querySelector('.ts3-character-copy');
        const roleNote = stage && [...stage.children].find(node => node.tagName === 'P');
        assert(roleNote, `Missing existing pet identity text: ${lang}/${pet.id}`);
        const note = detail.document.createElement('p');
        note.setAttribute('data-pet-exp-point-40', pet.id);
        note.textContent = pointText;
        replace(detail, roleNote.outerHTML, roleNote.outerHTML + note.outerHTML);
      }
      }
      for (const correction of data.skillNameCorrections || []) if (correction.petId === pet.id && correction.locale === lang) {
        const candidates = [...detail.document.querySelectorAll('main p')].filter(node => node.textContent.includes(correction.from + ':') || node.textContent.includes(correction.to + ':'));
        assert(candidates.length === 1 && candidates[0].textContent.includes('훈련 5단계에서 펫 능력치 +10%'), 'Unexpected Starhorn skill-name slot');
        if (candidates[0].textContent.includes(correction.from + ':')) updateNode(detail, candidates[0], node => {
          node.textContent = node.textContent.replace(correction.from + ':', correction.to + ':');
        });
      }
      if (pet.id === 'starhorn') {
        const priorResource = {ko:['전용 각인','조각'],en:['exclusive imprints','fragments'],ja:['専用刻印','欠片'],ru:['особых отпечатков','фрагментов'],'zh-tw':['專屬刻印','碎片']};
        const priorDetail = copy[lang].trainingDetail.replace(...priorResource[lang]);
        const p = [...detail.document.querySelectorAll('main p')].find(node => [copy[lang].obsolete, copy[lang].trainingDetail, priorDetail].some(value => node.textContent.includes(value)));
        assert(p, `Missing precise Starhorn training limitation slot: ${lang}`);
        if (p.textContent.includes(copy[lang].obsolete)) updateNode(detail, p, node => { node.textContent = node.textContent.replace(copy[lang].obsolete, copy[lang].trainingDetail); });
        else if (p.textContent.includes(priorDetail)) updateNode(detail, p, node => { node.textContent = node.textContent.replace(priorDetail, copy[lang].trainingDetail); });
      }
      replacePetArt(detail);
      assert(invariantParts(parseHTML(detail.next).document) === beforeDetail, `Pet detail protected content changed: ${lang}/${pet.id}`);
      htmlOutputs.push(detail);
    }
  }
  // Rename the existing hatch categories, retaining all 17 probability values.
  const hatchingHTML = require('./lib/pet-hatching-40');
  const starhornPortrait = require('./lib/starhorn-portrait-40');
  for (const page of htmlOutputs) {
    const route = path.relative(root, page.file).split(path.sep), lang = route[0];
    page.next = hatchingHTML(page.next, lang, route.length === 5 ? route[3] : null);
    if (route[3] === 'starhorn') page.next = starhornPortrait(page.next, lang);
  }
  // Validate every page before writing any of them.
  for (const page of htmlOutputs) if (page.next !== page.source) fs.writeFileSync(page.file, page.next);
  const ledgerFile = path.join(root, 'data/expansion-22/ledger.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  // The upstream generator owns entry generation. Here only the Starhorn-specific
  // provenance is narrowed; unrelated item and pet statistics remain untouched.
  for (const entry of ledger.entries) {
    if (/^petExp-\d+$/.test(entry.id) || /^petTraining-\d+$/.test(entry.id) || entry.id === 'pet-training-steps') {
      entry.conditions = 'Starhorn only; game 2.6.200 explicit rows; field alignment and legacy anchors; no interpolation or cross-pet reuse';
      entry.sourceURL = growthSource.url; entry.version = growthSource.version;
      entry.sourceKind = growthSource.kind; entry.checked = growth.snapshotDate;
    } else if (/^pet-eggs-(snowball|dodo|buckler|fluffy|hardhead|shadow|starhorn)$/.test(entry.id)) {
      entry.conditions = 'Displayed egg probabilities; legacy rare/epic/legendary keys mean normal/rare/precious eggs; null means unlisted, not confirmed zero; preserve display rounding';
      entry.sourceURL = hatchSource.url; entry.version = hatchSource.version; entry.sourceKind = hatchSource.kind; entry.checked = hatching.observedAt;
    } else if (entry.id === 'starhorn-extra-skills') {
      entry.conditions = 'HP unlock unknown; pet stats at training stage 5; training costs scoped separately to Starhorn in game 2.6.200';
    }
  }
  const ledgerNext = JSON.stringify(ledger, null, 2) + '\n';
  if (ledgerNext !== fs.readFileSync(ledgerFile, 'utf8')) fs.writeFileSync(ledgerFile, ledgerNext);
}
console.log(JSON.stringify({ mode: apply ? 'applied-source-corrections' : html ? 'applied-html-observations' : 'dry-run', observedPets: data.pets.length, roleCorrections: data.corrections.length, skillNameCorrections: (data.skillNameCorrections || []).length, plannedChanges: plan, growthScope: 'starhorn-only-version-2.6.200', growthDataChanged: apply && plan.some(p => p.fields), htmlChanged: htmlOutputs.filter(page => page.next !== page.source).length, htmlReviewed: htmlOutputs.length }, null, 2));
