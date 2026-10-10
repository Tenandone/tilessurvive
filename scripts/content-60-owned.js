'use strict';
// Late builders render these sections directly in all six languages.
// Remove only their owned UI before the inherited English-to-German pass.
function strip(document) {
  document.querySelectorAll('[data-building-growth-60],[data-behemoth-exp-60],#item-synthesis,[data-building-growth-60-asset],[data-content-60-style],[data-building-phase2-card],[data-building-phase2-category],[data-pets-phase2-entry],[data-pets-phase2-hub-style]').forEach(node => node.remove());
  document.querySelectorAll('a[href="#item-synthesis"]').forEach(node => {
    if (node.parentElement?.tagName === 'P' && node.parentElement.children.length === 1) node.parentElement.remove();
    else node.remove();
  });
}
module.exports = {strip};
if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path'), {parseHTML} = require('linkedom');
  const root = path.resolve(__dirname, '..');
  const walk = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name === 'index.html' ? [path.join(dir, entry.name)] : []);
  let pages = 0;
  for (const lang of ['ko','en','ja','ru','zh-tw','de']) for (const file of walk(path.join(root, lang))) {
    const html = fs.readFileSync(file, 'utf8');
    if (!/data-(?:building-growth-60|behemoth-exp-60|content-60-style|building-phase2-card|pets-phase2-entry)/.test(html)) continue;
    const document = parseHTML(html).document;
    strip(document);
    fs.writeFileSync(file, '<!DOCTYPE html>\n'+document.documentElement.outerHTML+'\n');
    pages++;
  }
  console.log(JSON.stringify({strippedLateContent60:pages}));
}
