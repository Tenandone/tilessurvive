'use strict';
// Private input for verify-client-images.py. Uses verified original CFG bytes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createSource}=require('./client-audit/source.cjs');
function run(corpus,output){const root=path.resolve(__dirname,'..'),out=path.resolve(output);assert(!out.startsWith(root+path.sep),'Raw field output must be private');const t=createSource(corpus).table('survivor');const rows=t.records.map(r=>r.row).filter(r=>r.Tags?.includes('hero'));const fields=rows.map(r=>Object.fromEntries(Object.entries(r).filter(([k,v])=>['InternalId','Id','Name','SurvivorRarityUp'].includes(k)||typeof v==='string'&&/sp_avatar|sp_icon|model_/.test(v))));fs.writeFileSync(out,JSON.stringify(fields,null,2)+'\n');console.log(JSON.stringify({forms:rows.length,originalCFGSHA256:t.sourceSHA256,output:out}));return fields;}
module.exports={run};if(require.main===module){const args=process.argv.slice(2);assert(args.length===2,'Usage: node scripts/export-hero-image-fields.js <private-corpus> <private-output.json>');run(...args);}
