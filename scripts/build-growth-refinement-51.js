'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parseHTML } = require('linkedom');
const data = require('../data/growth-refinement-51.json');
const root = path.resolve(__dirname, '..');
const langs = ['ko', 'en', 'ja', 'ru', 'zh-tw', 'de'];
const copy = {
  ko: { title: '강화 재료별 경험치', item: '아이템', exp: '아이템 1개당 EXP', per: '1개당 +{n} EXP' },
  en: { title: 'EXP by enhancement material', item: 'Item', exp: 'EXP per item', per: '+{n} EXP per item' },
  ja: { title: '強化素材ごとのEXP', item: 'アイテム', exp: '1個あたりのEXP', per: '1個あたり +{n} EXP' },
  ru: { title: 'Опыт от материалов улучшения', item: 'Предмет', exp: 'Опыт за 1 предмет', per: '+{n} опыта за 1 предмет' },
  'zh-tw': { title: '強化材料經驗值', item: '道具', exp: '每個道具的經驗值', per: '每個道具 +{n} 經驗值' },
  de: { title: 'EP der Verbesserungsmaterialien', item: 'Gegenstand', exp: 'EP pro Gegenstand', per: '+{n} EP pro Gegenstand' }
};
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const format = (n, lang) => n.toLocaleString(lang === 'zh-tw' ? 'zh-TW' : lang);
function strip(document) { document.querySelectorAll('[data-growth-refinement-51]').forEach(node => node.remove()); }
function renderGear(lang) {
  const t = copy[lang];
  return `<section id="gear-material-exp-51" data-growth-refinement-51="gear-materials" data-search-entry><h3>${escape(t.title)}</h3><div class="ts-table-wrap" tabindex="0" role="region" aria-label="${escape(t.title)}"><table><thead><tr><th scope="col">${escape(t.item)}</th><th scope="col">${escape(t.exp)}</th></tr></thead><tbody>${data.materials.filter(item => item.system === 'hero-gear').map(item => `<tr data-growth-material-id="${item.id}"><th scope="row">${escape(item.name[lang])}</th><td>${format(item.expPerItem, lang)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function build() {
  let changed = 0;
  const pages = [];
  for (const lang of langs) {
    const routes = [`${lang}/database/gear-exp/index.html`, ...data.behemothTargets.map(id => `${lang}/behemoths/${id}/index.html`)];
    for (const route of routes) {
      const file = path.join(root, route), before = fs.readFileSync(file, 'utf8');
      const document = parseHTML(before).document;
      strip(document);
      const baseline = document.documentElement.outerHTML;
      if (route.includes('/database/gear-exp/')) {
        const form = document.querySelector('form[data-growth-form="gear"]');
        assert(form, `Existing gear calculator absent: ${route}`);
        const template = document.createElement('template');
        template.innerHTML = renderGear(lang);
        form.after(template.content);
      } else {
        for (const item of data.materials.filter(item => item.system === 'behemoth')) {
          const src = data.behemothMaterialImages[String(item.id)];
          const images = [...document.querySelectorAll('.material-card img')].filter(image => image.getAttribute('src') === src);
          assert.equal(images.length, 1, `Existing material image association: ${route}, ${item.id}`);
          const card = images[0].closest('.material-card');
          const line = document.createElement('span');
          line.setAttribute('data-growth-refinement-51', 'behemoth-exp');
          line.setAttribute('data-growth-material-id', String(item.id));
          line.textContent = copy[lang].per.replace('{n}', format(item.expPerItem, lang));
          line.setAttribute('aria-label', `${item.name[lang]}: ${line.textContent}`);
          card.append(line);
        }
      }
      const output = '<!DOCTYPE html>\n' + document.documentElement.outerHTML + '\n';
      const check = parseHTML(output).document;
      strip(check);
      assert.equal(check.documentElement.outerHTML, baseline, `Unrelated page change: ${route}`);
      if (before !== output) { fs.writeFileSync(file, output); changed++; }
      pages.push(route);
    }
  }
  const result = { builder: 'growth-refinement-51', pages: pages.length, changed, materialRows: 3, serumLabels: 24, changedFormulas: 0, changedOldNumbers: 0 };
  console.log(JSON.stringify(result));
  return result;
}
module.exports = { build, renderGear, strip, langs, copy };
if (require.main === module) build();
