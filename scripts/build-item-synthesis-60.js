'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = require('../data/content-60/item-synthesis.json');
const copy = require('../data/content-60/item-synthesis-copy.js');
const languages = ['ko', 'en', 'ja', 'ru', 'zh-tw', 'de'];
const sectionStart = '<!-- c60-item-synthesis:start -->';
const sectionEnd = '<!-- c60-item-synthesis:end -->';
const jumpStart = '<!-- c60-item-synthesis-jump:start -->';
const jumpEnd = '<!-- c60-item-synthesis-jump:end -->';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function render(language) {
  const text = copy[language];
  const item = (entry, role) => `<td data-synthesis-${role}=""><span class="c60-value" data-synthesis-quantity="${entry.quantity}">${entry.quantity}</span> × <span data-synthesis-name="">${escape(entry.names[language])}</span></td>`;
  const rows = data.recipes.map((recipe, index) => `<tr data-synthesis-recipe="${recipe.slug}"><th scope="row">${escape(text.labels[index])}</th>${item(recipe.input, 'input')}${item(recipe.output, 'output')}</tr>`).join('');
  return `${sectionStart}<section id="item-synthesis" class="c60-panel" aria-labelledby="item-synthesis-heading"><h2 id="item-synthesis-heading" class="c60-heading">${escape(text.title)}</h2><p>${escape(text.intro)}</p><p id="item-synthesis-scope" class="c60-note">${escape(text.note)}</p><div class="c60-scroll" tabindex="0" role="region" aria-labelledby="item-synthesis-heading"><table class="c60-table" aria-describedby="item-synthesis-scope item-synthesis-domain-note"><thead><tr><th scope="col">${escape(text.recipe)}</th><th scope="col">${escape(text.input)}</th><th scope="col">${escape(text.output)}</th></tr></thead><tbody>${rows}</tbody></table></div><p id="item-synthesis-domain-note" class="c60-note">${escape(text.domainNote)}</p></section>${sectionEnd}`;
}

function replaceOwned(html, start, end) {
  const begin = html.indexOf(start);
  if (begin < 0) return html;
  const finish = html.indexOf(end, begin);
  if (finish < 0) throw new Error('Unclosed item synthesis marker');
  return html.slice(0, begin) + html.slice(finish + end.length);
}

function transform(html, language) {
  html = replaceOwned(replaceOwned(html, sectionStart, sectionEnd), jumpStart, jumpEnd);
  const anchor = '<section class="ts40-panel" aria-labelledby="vip-offers-heading">';
  if (!html.includes(anchor)) throw new Error(`Missing existing VIP section: ${language}`);
  html = html.replace(anchor, render(language) + anchor);
  const filter = '<form data-item-filter=';
  if (!html.includes(filter)) throw new Error(`Missing existing item list filter: ${language}`);
  html = html.replace(filter, `${jumpStart}<p><a href="#item-synthesis">${escape(copy[language].jump)} →</a></p>${jumpEnd}${filter}`);
  if (!html.includes('data-content-60-style')) {
    html = html.replace('</head>', '<link data-content-60-style="" rel="stylesheet" href="/css/content-60.css"></head>');
  }
  return html;
}

function build() {
  for (const language of languages) {
    const file = path.join(root, language, 'database/items/index.html');
    fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8'), language));
  }
  console.log('Item synthesis: 7 recipes, 14 quantity cells, 6 languages.');
}

if (require.main === module) build();
module.exports = {data, copy, languages, render, transform, build};
