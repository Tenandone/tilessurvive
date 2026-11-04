'use strict';
// Fail before any old six-language owner rewrites the reviewed global pages.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
if(fs.existsSync(path.join(root,'data/hero-atlas-publication.json'))){
 console.error('Historical generator blocked before writes: refine-content.js expects the obsolete #heroes-sea .hero-grid layout and does not preserve current 21-language owners. Use npm run build (reviewed owner pipeline). Reproduce historical work only in a disposable baseline checkout. See V4 report.');process.exitCode=1;
}
