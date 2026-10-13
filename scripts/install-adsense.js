'use strict';
// Static head installation only. This does not create ad units or change account settings.
const fs=require('node:fs'),path=require('node:path'),{parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..');
const PUBLISHER='ca-pub-9189957764761115';
const SRC='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+PUBLISHER;
const SNIPPET='<script async src="'+SRC+'" crossorigin="anonymous"></script>';
const excluded=new Set(['node_modules','components','scripts','data','config','img','css','js','management','private','internal','audit-results','tests','test','fixtures']);
function htmlFiles(root=ROOT){
  const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    if(entry.isSymbolicLink()||entry.name.startsWith('.')||entry.name.startsWith('_')||excluded.has(entry.name))return[];
    const file=path.join(dir,entry.name);
    return entry.isDirectory()?walk(file):entry.isFile()&&/\.html?$/i.test(entry.name)?[file]:[];
  });
  return walk(root).sort().filter(file=>/<head(?:\s|>)/i.test(fs.readFileSync(file,'utf8')));
}
function inspect(html,label='HTML'){
  if(!/<head(?:\s|>)/i.test(html))return{document:false,installed:false};
  const d=parseHTML(html).document;
  if(!/<\/head\s*>/i.test(html)||!d.head)throw Error(label+': missing closing head');
  const scripts=[...d.querySelectorAll('script[src]')].filter(n=>{
    try{return new URL(n.getAttribute('src'),'https://tilessurvive.net').pathname.endsWith('/adsbygoogle.js');}catch{return false;}
  });
  const declared=[...d.querySelectorAll('[data-ad-client],meta[name="google-adsense-account"]')].map(n=>n.getAttribute('data-ad-client')||n.getAttribute('content'));
  for(const script of scripts){
    const url=new URL(script.getAttribute('src'),'https://tilessurvive.net');
    const clients=[...url.searchParams.getAll('client'),script.getAttribute('data-ad-client')].filter(Boolean);
    if(!clients.length)throw Error(label+': AdSense loader has no publisher');
    declared.push(...clients);
    if(url.origin!=='https://pagead2.googlesyndication.com'||url.pathname!=='/pagead/js/adsbygoogle.js')throw Error(label+': unexpected AdSense loader URL');
  }
  for(const id of declared)if(id!==PUBLISHER)throw Error(label+': unexpected AdSense publisher '+id);
  if(scripts.length>1)throw Error(label+': duplicate AdSense loaders');
  if(scripts.length){
    const script=scripts[0];
    if(!script.closest('head'))throw Error(label+': AdSense loader must be in head');
    if(!script.hasAttribute('async')||script.getAttribute('crossorigin')!=='anonymous')throw Error(label+': AdSense loader must use async and crossorigin=anonymous');
  }
  return{document:true,installed:scripts.length===1};
}
function project(html,label='HTML'){
  const status=inspect(html,label);
  if(!status.document||status.installed)return html;
  // Preserve existing GA4, consent, SEO and body markup byte-for-byte.
  const newline=html.includes('\r\n')?'\r\n':'\n';
  const result=html.replace(/<\/head\s*>/i,'  '+SNIPPET+newline+'</head>');
  if(!inspect(result,label).installed)throw Error(label+': installation failed');
  return result;
}
function run({root=ROOT,apply=false,check=false}={}){
  // Validate the complete set before writing any file.
  const plans=htmlFiles(root).map(file=>{
    const before=fs.readFileSync(file,'utf8'),after=project(before,path.relative(root,file));
    return{file,before,after};
  });
  const missing=plans.filter(p=>p.before!==p.after);
  if(apply)for(const p of missing)fs.writeFileSync(p.file,p.after);
  return{publisher:PUBLISHER,pages:plans.length,installed:plans.length-missing.length+(apply?missing.length:0),missing:apply?0:missing.length,changed:apply?missing.length:0,mode:apply?'apply':check?'check':'dry-run',pass:!check||missing.length===0};
}
module.exports={PUBLISHER,SRC,SNIPPET,htmlFiles,inspect,project,run};
if(require.main===module){
  const args=process.argv.slice(2);
  if(args.some(x=>!['--apply','--check'].includes(x))||args.includes('--apply')&&args.includes('--check'))throw Error('Usage: node scripts/install-adsense.js [--apply|--check]');
  const result=run({apply:args.includes('--apply'),check:args.includes('--check')});
  console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
}
