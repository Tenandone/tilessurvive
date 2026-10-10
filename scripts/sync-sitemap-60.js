'use strict';
// Add indexable canonical routes after late content builders, preserving every
// previously published sitemap URL. Alias pages do not create duplicate entries.
const fs=require('node:fs'),path=require('node:path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),origin='https://tilessurvive.net';
const langs=['ko','en','ja','ru','zh-tw','de'];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name==='index.html'?[path.join(dir,e.name)]:[]);}
function build(){
  const file=path.join(root,'sitemap.xml'),before=fs.readFileSync(file,'utf8');
  const urls=new Set([...before.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1])),old=urls.size;
  for(const lang of langs)for(const file of walk(path.join(root,lang))){
    const d=parseHTML(fs.readFileSync(file,'utf8')).document;
    if(/noindex/i.test(d.querySelector('meta[name="robots"]')?.content||''))continue;
    const url=origin+'/'+path.relative(root,file).replaceAll('\\','/').replace(/index\.html$/,'');
    if(d.querySelector('link[rel="canonical"]')?.href===url)urls.add(url);
  }
  const after='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+[...urls].sort().map(url=>'<url><loc>'+url+'</loc></url>').join('\n')+'\n</urlset>\n';
  if(after!==before)fs.writeFileSync(file,after);
  const result={sitemapURLs:urls.size,added:urls.size-old};console.log(JSON.stringify(result));return result;
}
module.exports={build};if(require.main===module)build();
