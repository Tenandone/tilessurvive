'use strict';
// Presentation only: preserve every byte outside this owner's head block and
// two root attributes. No game records, routing, metadata or scripts are parsed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const locales=require('../data/i18n/locales.json').locales.map(l=>l.code);
const ASSETS=['css/v6-system.css','js/v6-system.js'];
const digest=value=>crypto.createHash('sha256').update(value).digest('hex').slice(0,12);
function strip(html){return html.replace(/<!-- TS_V6_SYSTEM_BEGIN -->[\s\S]*?<!-- TS_V6_SYSTEM_END -->/g,'').replace(/(<html\b[^>]*?)\sdata-v6-system=""/i,'$1').replace(/(<html\b[^>]*?)\sdata-v6-page="[a-z-]+"/i,'$1');}
function pageKind(route,locale){
 const rel=route.replace(new RegExp('^/'+locale+'/'),'').replace(/index\.html$/,'');
 if(!rel)return 'home';
 if(rel==='heroes/')return 'hero-atlas';
 if(rel.startsWith('heroes/'))return 'hero-detail';
 if(rel==='database/pet-system/')return 'pet-atlas';
 if(rel.startsWith('database/pet-system/'))return 'pet-detail';
 if(rel.startsWith('tools/'))return 'tools';
 if(rel.startsWith('buildings/'))return rel==='buildings/'?'buildings':'building-detail';
 if(rel.startsWith('database/research/'))return 'research';
 if(rel.startsWith('database/'))return 'database';
 if(rel.startsWith('codes/'))return 'codes';
 if(rel.startsWith('top-up/'))return 'topup';
 return 'content';
}
function assets(root=ROOT){return ASSETS.map(file=>{const url='/'+file+'?v='+digest(fs.readFileSync(path.join(root,file)));return file.endsWith('.css')?'<link data-v6-owned="system-assets" rel="stylesheet" href="'+url+'">':'<script data-v6-owned="system-assets" defer src="'+url+'"></script>';}).join('');}
function project(input,locale,route='/'+locale+'/',options={}){
 if(!locales.includes(locale))throw Error('Unsupported V6 locale: '+locale);
 const html=strip(input);
 if(!route.startsWith('/'+locale+'/')||!/<main\b/i.test(html)||!/<\/head>/i.test(html)||/<meta\b[^>]*http-equiv=["']refresh["']/i.test(html))return html;
 const block='<!-- TS_V6_SYSTEM_BEGIN -->'+(options.assets||assets(options.root))+'<!-- TS_V6_SYSTEM_END -->';
 return html.replace(/<html\b/i,'<html data-v6-system="" data-v6-page="'+pageKind(route,locale)+'"').replace(/<\/head>/i,block+'</head>');
}
function validateOwnership(input,locale,route,options={}){
 if(!/TS_V6_SYSTEM|data-v6-(?:system|page|owned)/.test(input))return false;
 assert.equal(input.replaceAll('\r\n','\n'),project(input,locale,route,options).replaceAll('\r\n','\n'),'Unreviewed V6 presentation owner '+route);
 return true;
}
function walk(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.isFile()&&e.name==='index.html'?[path.join(dir,e.name)]:[]);}
function build({root=ROOT,apply=true}={}){
 const report={owner:'v6-system',locales:locales.length,pages:0,eligible:0,changed:0,applied:apply,counts:{},deployed:false},bundle=assets(root);
 for(const locale of locales){report.counts[locale]=0;for(const file of walk(path.join(root,locale))){
  const input=fs.readFileSync(file,'utf8'),route='/'+path.relative(root,file).replaceAll('\\','/').replace(/index\.html$/,''),output=project(input,locale,route,{assets:bundle});
  report.pages++;if(output.includes('data-v6-system=""')){report.eligible++;report.counts[locale]++;}
  if(input!==output){report.changed++;if(apply)fs.writeFileSync(file,output);}
 }}
 console.log(JSON.stringify(report));return report;
}
module.exports={ROOT,ASSETS,locales,digest,strip,pageKind,assets,project,validateOwnership,build,walk};
if(require.main===module)build({apply:!process.argv.includes('--check')});
