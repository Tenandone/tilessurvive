'use strict';
// Edit config/community.json, then run npm run build:community (or npm run build).
// Only explicitly marked site-support anchors are owned by this projection.
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');
const config = require('../config/community.json');
const ROOT = path.resolve(__dirname, '..');
const MARKER = 'data-support-discord';
const ANCHOR = /<a\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const SKIP = new Set(['node_modules', 'test-results', 'scripts', 'data', 'config', 'img', 'images', 'css', 'js', 'blue', 'makeup']);

function validateUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'discord.gg' ||
      !/^\/[A-Za-z0-9-]+$/.test(url.pathname) || url.search || url.hash ||
      url.username || url.password || url.port || url.href !== value) {
    throw Error('supportDiscordUrl must be a canonical HTTPS Discord invite URL');
  }
  return value;
}

function htmlFiles(root = ROOT) {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink() || entry.name.startsWith('.') || entry.name.startsWith('_') || SKIP.has(entry.name)) return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() && /\.html?$/i.test(entry.name) ? [file] : [];
  });
  return walk(root).sort();
}

function setAttribute(tag, name, value) {
  const attribute = new RegExp('\\s' + name + '\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)', 'i');
  const replacement = ' ' + name + '="' + value + '"';
  return attribute.test(tag) ? tag.replace(attribute, () => replacement) : tag.replace(/>$/, replacement + '>');
}

function project(html, url = config.supportDiscordUrl) {
  validateUrl(url);
  return html.replace(ANCHOR, tag => {
    const anchor = parseHTML(tag + '</a>').document.querySelector('a');
    if (!anchor.hasAttribute(MARKER)) return tag;
    const rel = new Set((anchor.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    rel.add('noreferrer');
    return setAttribute(setAttribute(setAttribute(tag, 'href', url), 'target', '_blank'), 'rel', [...rel].join(' '));
  });
}

function run({ root = ROOT, apply = false, check = false } = {}) {
  validateUrl(config.supportDiscordUrl);
  // Prepare every output before writing, and preserve all unrelated bytes.
  const plans = htmlFiles(root).map(file => {
    const before = fs.readFileSync(file, 'utf8');
    return { file, before, after: project(before) };
  });
  const changed = plans.filter(p => p.before !== p.after);
  if (apply) for (const p of changed) fs.writeFileSync(p.file, p.after);
  return { pages: plans.length, changed: apply ? changed.length : 0, pending: apply ? 0 : changed.length, pass: !check || !changed.length };
}

module.exports = { MARKER, ANCHOR, validateUrl, htmlFiles, project, run };
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--check'].includes(arg)) || args.includes('--apply') && args.includes('--check')) {
    throw Error('Usage: node scripts/sync-community-links.js [--apply|--check]');
  }
  const result = run({ apply: args.includes('--apply'), check: args.includes('--check') });
  console.log(JSON.stringify(result));
  if (!result.pass) process.exitCode = 1;
}
