'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..');
const codes=require('../data/i18n/locales.json').locales.map(l=>l.code);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function model(){return JSON.parse(fs.readFileSync(path.join(ROOT,'data/analytics-privacy-copy.json'),'utf8'));}
function validate(data=model()){
 assert.equal(data.contact,'ant79798@gmail.com');
 assert.deepEqual(Object.keys(data.locales).sort(),[...codes].sort());
 assert(/^\d{4}-\d{2}-\d{2}$/.test(data.updatedOn));
 for(const locale of codes){const c=data.locales[locale];for(const key of ['title','intro','stop','resume','stopped','active','updatedLabel'])assert(typeof c[key]==='string'&&c[key].trim(),locale+' '+key);assert.equal(c.sections.length,7);for(const section of c.sections)assert(section.heading&&section.body);}
 return {locales:codes.length,sections:7};
}
function render(locale,data=model()){
 validate(data);const c=data.locales[locale];assert(c,'Unsupported policy locale');
 return `<article class="analytics-policy" data-analytics-policy="1"><header class="hero-card"><span class="eyebrow">PRIVACY</span><h1>${escape(c.title)}</h1><p>${escape(c.intro)}</p><p>${escape(c.updatedLabel)} <time datetime="${data.updatedOn}">${data.updatedOn}</time></p></header>${c.sections.map((s,i)=>`<section class="section-card"><h2 id="article-section-${i+1}">${escape(s.heading)}</h2><p>${escape(s.body)}</p>${i===3?`<div class="analytics-controls"><button type="button" data-analytics-stop>${escape(c.stop)}</button><button type="button" data-analytics-resume>${escape(c.resume)}</button></div><p data-analytics-status data-active="${escape(c.active)}" data-stopped="${escape(c.stopped)}" role="status"></p>`:''}${i===6?`<p><a href="mailto:${data.contact}">${data.contact}</a></p>`:''}</section>`).join('')}<nav class="analytics-policy-links" aria-label="Google"><a href="https://policies.google.com/privacy" rel="noopener noreferrer">Google Privacy Policy</a><a href="https://support.google.com/analytics/answer/9976101" rel="noopener noreferrer">Google Consent Mode</a></nav></article>`;
}
function project(input,locale){
 const data=model();validate(data);const stripped=require('./build-v6-system').strip(input),d=parseHTML(stripped).document,main=d.querySelector('main');assert(main,'Privacy main missing');
 const crumb=main.querySelector('.breadcrumb')?.outerHTML||'';
 const original=stripped.match(/<main\b[^>]*>[\s\S]*?<\/main>/)?.[0];assert(original,'Privacy source main missing');
 const next=original.replace(/(<main\b[^>]*>)[\s\S]*<\/main>$/,(_,start)=>start+crumb+render(locale,data)+'</main>');
 let html=stripped.replace(original,next).replace(/<!-- TS_ANALYTICS_POLICY_ASSET_BEGIN -->[\s\S]*?<!-- TS_ANALYTICS_POLICY_ASSET_END -->/g,'');
 const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'css/analytics-policy.css'))).digest('hex').slice(0,12);
 html=html.replace('</head>',`<!-- TS_ANALYTICS_POLICY_ASSET_BEGIN --><link rel="stylesheet" href="/css/analytics-policy.css?v=${digest}" data-analytics-policy-asset><!-- TS_ANALYTICS_POLICY_ASSET_END --></head>`);
 return html;
}
function validateOwnership(html,locale){
 const d=parseHTML(require('./build-v6-system').strip(html)).document,articles=d.querySelectorAll('[data-analytics-policy]');assert.equal(articles.length,1,'Exactly one analytics policy');
 const actual=articles[0];
 const expected=parseHTML(render(locale)).document.querySelector('[data-analytics-policy]');
 assert.equal(actual.outerHTML,expected.outerHTML,'Analytics policy drift '+locale);
 const main=d.querySelector('main');assert(main,'Privacy main missing');
 const crumb=main.querySelector('.breadcrumb')?.outerHTML||'';
 const expectedMain=parseHTML('<main>'+crumb+render(locale)+'</main>').document.querySelector('main');
 assert.equal(main.innerHTML,expectedMain.innerHTML,'Unexpected privacy main content '+locale);
 const assets=d.querySelectorAll('[data-analytics-policy-asset]');assert.equal(assets.length,1,'Exactly one analytics policy stylesheet');
 const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'css/analytics-policy.css'))).digest('hex').slice(0,12);
 assert.equal(assets[0].tagName,'LINK');assert.equal(assets[0].getAttribute('rel'),'stylesheet');assert.equal(assets[0].getAttribute('href'),'/css/analytics-policy.css?v='+digest,'Privacy stylesheet drift');
 return true;
}
function build(){validate();let changed=0;for(const locale of codes){const file=path.join(ROOT,locale,'privacy/index.html'),before=fs.readFileSync(file,'utf8'),after=project(before,locale);if(before!==after){fs.writeFileSync(file,after);changed++;}}const result={locales:codes.length,changed};console.log(JSON.stringify(result));return result;}
module.exports={validate,render,project,validateOwnership,build};if(require.main===module)build();
