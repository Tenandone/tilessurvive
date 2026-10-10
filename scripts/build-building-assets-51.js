'use strict';
// Apply reviewed art to the existing 13 building pages and their six catalogs.
// String-local edits deliberately leave calculator markup, text, and SEO untouched.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = require('../data/building-assets-51.json');
const marker = 'data-building-art-51';
const stylesheet = '/css/building-assets-51.css';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const cssVersion = hash(fs.readFileSync(path.join(root, stylesheet))).slice(0, 12);
const pages = manifest.languages.flatMap(lang => [`${lang}/buildings/index.html`, ...manifest.assets.map(a => `${lang}/buildings/${a.slug}/index.html`)]);
function attr(tag, name, value) {
  const re = new RegExp(`\\s${name}="[^"]*"`, 'g');
  return tag.replace(re, '').replace(/\s*\/?>$/, ` ${name}="${value}">`);
}
function project(html, file) {
  if (!pages.includes(file)) throw Error('Unapproved building route: ' + file);
  const parts = file.split('/');
  const catalog = parts.length === 3;
  const targets = catalog ? manifest.assets : manifest.assets.filter(a => a.slug === parts[2]);
  const seen = new Set();
  let after = html.replace(/(<(?:a|div)\b[^>]*>)(\s*)(<img\b[^>]*>)/g, (whole, parent, whitespace, image) => {
    const src = image.match(/\ssrc="([^"]+)"/)?.[1];
    const asset = targets.find(a => [a[catalog ? 'catalog' : 'detail'].previousSrc, a[catalog ? 'catalog' : 'detail'].src].includes(src));
    if (!asset) return whole;
    if (seen.has(asset.slug)) throw Error('Duplicate building image: ' + file + ' ' + asset.slug);
    seen.add(asset.slug);
    const expectedClass = catalog ? 'building-thumb' : '(?:hero-thumb|hero-media)';
    if (!new RegExp(`\\sclass="[^\"]*\\b${expectedClass}\\b[^\"]*"`).test(parent)) throw Error('Unexpected image frame: ' + file);
    const output = asset[catalog ? 'catalog' : 'detail'];
    for (const name of ['src', 'width', 'height']) image = attr(image, name, output[name]);
    image = attr(image, marker, asset.buildingId);
    image = attr(image, 'decoding', 'async');
    image = attr(image, 'loading', catalog ? 'lazy' : 'eager');
    parent = attr(parent, 'data-building-frame-51', catalog ? 'catalog' : 'detail');
    return parent + whitespace + image;
  });
  if (seen.size !== targets.length) throw Error('Missing building image: ' + file + ' ' + seen.size + '/' + targets.length);
  // Preload the same derivative the page displays; leave social metadata and all
  // other resource hints intact. Only exact approved former detail URLs migrate.
  if (!catalog) {
    const { previousSrc, src } = targets[0].detail;
    if (previousSrc !== src) after = after.replace(/<link\b[^>]*>/g, tag => {
      const attributes = Object.fromEntries([...tag.matchAll(/\s([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
      if (attributes.rel === 'preload' && attributes.as === 'image' && attributes.href === previousSrc) return tag.replace(`href="${previousSrc}"`, `href="${src}"`);
      return tag;
    });
  }
  after = after.replace(/\s*<link\b[^>]*href="\/css\/building-assets-51\.css(?:\?[^"]*)?"[^>]*>/g, '');
  const link = `<link rel="stylesheet" href="${stylesheet}?v=${cssVersion}" data-building-style-51="">`;
  if (!after.includes('</head>')) throw Error('Missing head: ' + file);
  return after.replace('</head>', link + '</head>');
}
function validateAssets() {
  if (manifest.assets.length !== 13 || manifest.languages.length !== 6) throw Error('Unexpected building manifest count');
  for (const asset of manifest.assets) {
    if (asset.stageLevel !== null || asset.imageRole !== 'representative') throw Error('Unverified building stage');
    for (const role of ['catalog', 'detail']) {
      const a = asset[role], file = path.join(root, a.src);
      if (!fs.existsSync(file) || hash(fs.readFileSync(file)) !== a.sha256) throw Error('Building asset hash mismatch: ' + a.src);
    }
  }
}
function build() {
  validateAssets();
  const changed = [];
  for (const file of pages) {
    const full = path.join(root, file), before = fs.readFileSync(full, 'utf8'), after = project(before, file);
    if (before !== after) changed.push({ full, after });
  }
  for (const { full, after } of changed) fs.writeFileSync(full, after);
  console.log(JSON.stringify({ buildings: manifest.assets.length, pages: pages.length, changed: changed.length }));
}
if (require.main === module) build();
module.exports = { project, pages, manifest, marker, validateAssets };
