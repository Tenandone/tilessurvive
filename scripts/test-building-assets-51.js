'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');
const { project, pages, manifest, validateAssets } = require('./build-building-assets-51');
const root = path.resolve(__dirname, '..');
function dimensions(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WEBP');
  for (let p = 12; p + 8 <= b.length;) {
    const id = b.toString('ascii', p, p + 4), length = b.readUInt32LE(p + 4), offset = p + 8;
    if (id === 'VP8X') return [b.readUIntLE(offset + 4, 3) + 1, b.readUIntLE(offset + 7, 3) + 1];
    if (id === 'VP8L') {
      const bits = b.readUInt32LE(offset + 1);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    if (id === 'VP8 ') return [b.readUInt16LE(offset + 6) & 0x3fff, b.readUInt16LE(offset + 8) & 0x3fff];
    p += 8 + length + (length % 2);
  }
  throw Error('Missing image size: ' + file);
}
function preservedDOM(html, file) {
  const d = parseHTML(html).document;
  const asset = manifest.assets.find(a => file === `${file.split('/')[0]}/buildings/${a.slug}/index.html`);
  if (asset && asset.detail.src !== asset.detail.previousSrc) {
    for (const link of d.querySelectorAll('link[rel="preload"][as="image"]')) {
      if (link.getAttribute('href') === asset.detail.src) link.setAttribute('href', asset.detail.previousSrc);
    }
  }
  d.querySelectorAll('link[href^="/css/building-assets-51.css"]').forEach(n => n.remove());
  d.querySelectorAll('[data-building-frame-51]').forEach(n => n.removeAttribute('data-building-frame-51'));
  d.querySelectorAll('img').forEach(n => n.remove());
  return d.documentElement.outerHTML.replace(/>\s+</g, '><');
}
test('13 approved building identities, representative role, six localized names', () => {
  const expected = { 'power-plant': 'stronghold', 'comms-outpost': 'embassy', barracks: 'barracks', lab: 'university', hospital: 'hospital', 'enlistment-office': 'conscription', 'garrison-station': 'garrison', 'hero-academy': 'hero_skill_book', 'warbringer-monument': 'hero_buff_attack', 'guardian-of-life-monument': 'hero_buff_hp', 'aegis-monument': 'hero_buff_defence', 'blessed-healing-stele': 'pvp_buff_wounded', 'cursed-wound-stele': 'pvp_debuff_wounded' };
  assert.equal(manifest.assets.length, 13);
  assert.deepEqual(Object.fromEntries(manifest.assets.map(a => [a.slug, a.buildingId])), expected);
  for (const a of manifest.assets) {
    assert.equal(a.stageLevel, null);
    assert.equal(a.imageRole, 'representative');
    for (const lang of manifest.languages) assert.ok(a.names[lang]?.trim(), a.slug + ' ' + lang);
  }
});
test('all selected asset hashes and decoded dimensions match; retained details never downsampled', () => {
  validateAssets();
  for (const a of manifest.assets) {
    assert.deepEqual(dimensions(path.join(root, a.catalog.src)), [240, 240]);
    for (const kind of ['catalog', 'detail']) assert.deepEqual(dimensions(path.join(root, a[kind].src)), [a[kind].width, a[kind].height]);
    assert.deepEqual(dimensions(path.join(root, a.detail.previousSrc)), [a.detail.width, a.detail.height]);
    assert.ok(a.detail.width >= 240 && a.detail.height >= 240);
    assert.ok(fs.existsSync(path.join(root, a.catalog.previousSrc)), 'Original catalog retained');
  }
});
test('all 84 pages apply idempotently, preserve all text, links, calculators and SEO', () => {
  assert.equal(pages.length, 84);
  for (const file of pages) {
    const before = fs.readFileSync(path.join(root, file), 'utf8'), after = project(before, file);
    assert.equal(project(after, file), after, file);
    assert.equal(preservedDOM(after, file), preservedDOM(before, file), file);
    const d = parseHTML(after).document, catalog = file.split('/').length === 3;
    assert.equal(d.querySelectorAll('[data-building-art-51]').length, catalog ? 13 : 1, file);
    assert.equal(d.querySelectorAll('link[href^="/css/building-assets-51.css"]').length, 1, file);
    for (const image of d.querySelectorAll('[data-building-art-51]')) {
      assert.ok(image.getAttribute('alt')?.trim());
      assert.equal(image.getAttribute('decoding'), 'async');
      assert.equal(image.getAttribute('loading'), catalog ? 'lazy' : 'eager');
      assert.equal(image.parentElement.getAttribute('data-building-frame-51'), catalog ? 'catalog' : 'detail');
    }
  }
});
test('only exact derivative detail image preloads migrate; social images and other hints are preserved', () => {
  for (const a of manifest.assets) {
    if (a.detail.src === a.detail.previousSrc) continue;
    for (const lang of manifest.languages) {
      const file = `${lang}/buildings/${a.slug}/index.html`;
      const html = fs.readFileSync(path.join(root, file), 'utf8');
      const fixture = `<link rel="preload" as="image" href="${a.detail.previousSrc}" fetchpriority="high">` +
        `<link rel="prefetch" as="image" href="${a.detail.previousSrc}">` +
        `<link rel="preload" as="image" href="${a.detail.previousSrc}?variant=other">` +
        `<meta property="og:image" content="${a.detail.previousSrc}">` +
        `<meta name="twitter:image" content="${a.detail.previousSrc}">`;
      const after = project(html.replace('</head>', fixture + '</head>'), file), d = parseHTML(after).document;
      const migrated = [...d.querySelectorAll('link[rel="preload"][as="image"]')].filter(l => l.getAttribute('href') === a.detail.src);
      assert.ok(migrated.length >= 1, file);
      assert.ok(migrated.some(l => l.getAttribute('fetchpriority') === 'high'), file);
      assert.ok(![...d.querySelectorAll('link[rel="preload"][as="image"]')].some(l => l.getAttribute('href') === a.detail.previousSrc), file);
      assert.ok([...d.querySelectorAll('link[rel="prefetch"]')].some(l => l.getAttribute('href') === a.detail.previousSrc), file);
      assert.ok([...d.querySelectorAll('link[rel="preload"]')].some(l => l.getAttribute('href') === a.detail.previousSrc + '?variant=other'), file);
      assert.ok([...d.querySelectorAll('meta[property="og:image"]')].some(l => l.getAttribute('content') === a.detail.previousSrc), file);
      assert.ok([...d.querySelectorAll('meta[name="twitter:image"]')].some(l => l.getAttribute('content') === a.detail.previousSrc), file);
      assert.equal(project(after, file), after, file);
    }
  }
});
test('unknown route, missing image, duplicate art and unexpected frame fail closed', () => {
  const file = 'ko/buildings/power-plant/index.html', html = fs.readFileSync(path.join(root, file), 'utf8');
  assert.throws(() => project(html, 'ko/heroes/shark/index.html'), /Unapproved/);
  assert.throws(() => project(html.replace(/<img\b[^>]*>/g, ''), file), /Missing/);
  const changed = project(html, file), image = changed.match(/<img\b[^>]*data-building-art-51[^>]*>/)[0];
  assert.throws(() => project(changed.replace('</body>', `<div class="hero-thumb">${image}</div></body>`), file), /Duplicate/);
  assert.throws(() => project(changed.replace('class="hero-thumb"', 'class="unapproved-frame"'), file), /Unexpected/);
});
test('catalog/detail geometry is contained and catalog does not upscale source', () => {
  const css = fs.readFileSync(path.join(root, 'css/building-assets-51.css'), 'utf8');
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /object-position:\s*center/);
  assert.match(css, /max-width:\s*192px/);
  assert.match(css, /width:\s*74px;\s*height:\s*74px/);
  assert.doesNotMatch(css, /object-fit:\s*cover|scale\(/);
});
