/* Exercise the actual index builder against isolated in-memory pages. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),target=path.join(root,'data/search-index.json'),langs=['ko','en','ja','ru','zh-tw'];
const files=new Map(langs.map(lang=>[path.join(root,lang,'index.html'),`<title>${lang} title</title><meta name="description" content="${lang} description">`]));
let writes=0,checks=0;
function run(now){
 const fakeFS={existsSync:p=>files.has(p),readFileSync:p=>{assert(files.has(p),'Fixture path '+p);return files.get(p);},writeFileSync:(p,value)=>{assert.equal(p,target);files.set(p,value);writes++;},readdirSync:p=>{assert(langs.some(l=>p===path.join(root,l)));return[{name:'index.html',isDirectory:()=>false}];}};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}}
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'build-search-index.js'),'utf8'),{__dirname,Date:Clock,console:{log(){}},require:name=>name==='node:fs'?fakeFS:name==='node:path'?path:name.endsWith('explorer.json')?{items:[]}:name.endsWith('explorer-copy.js')?{}:(()=>{throw Error(name);})()});
 return JSON.parse(files.get(target));
}
let result=run('2026-10-10T01:00:00.000Z');assert.equal(result.itemCount,5);assert.equal(result.generatedAt,'2026-10-10T01:00:00.000Z');checks++;
const first=files.get(target);writes=0;result=run('2026-10-10T02:00:00.000Z');assert.equal(files.get(target),first);assert.equal(writes,0);checks++;
files.set(path.join(root,'ko/index.html'),'<title>Changed Korean title</title><meta name="description" content="New description">');writes=0;result=run('2026-10-10T03:00:00.000Z');assert.equal(result.generatedAt,'2026-10-10T03:00:00.000Z');assert.equal(result.items.find(i=>i.language==='ko').title,'Changed Korean title');assert.equal(writes,1);checks++;
files.set(target,JSON.stringify({...result,itemCount:4}));result=run('2026-10-10T04:00:00.000Z');assert.equal(result.itemCount,5);assert.equal(result.generatedAt,'2026-10-10T04:00:00.000Z');checks++;
files.set(target,JSON.stringify({...result,generatedAt:null}));result=run('2026-10-10T05:00:00.000Z');assert.equal(result.generatedAt,'2026-10-10T05:00:00.000Z');checks++;
console.log(JSON.stringify({passed:true,checks,scope:'Actual builder; isolated fixture, content changes, unchanged bytes, count repair, missing timestamp'}));
