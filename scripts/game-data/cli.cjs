#!/usr/bin/env node
'use strict';
const {normalize}=require('./normalize.cjs');
const {diffSnapshots}=require('./diff.cjs');
const {publicationPreview}=require('./publication.cjs');
const help=`Local approved-input pipeline (Node 22.13+ with node:sqlite). No network or ADB collection.
  node scripts/game-data/cli.cjs normalize --source-dir <manifest directory> --output-dir <new private snapshot> [--tables pet_base,pet_level] [--previous-dir <prior private snapshot>]
  node scripts/game-data/cli.cjs diff --before-dir <snapshot> --after-dir <snapshot> --output-dir <new private diff>
  node scripts/game-data/cli.cjs publication --source-dir <snapshot> --output-dir <new private preview> [--registry <JSON>] [--evidence-dir <directory>]
All raw inputs, snapshots, diffs and previews must be outside the public repository and its linked worktrees. There is no deploy command.`;
async function main(argv) {
  const command=argv[0]; if(!command || command==='--help') { console.log(help); return; }
  const allowed={normalize:['source-dir','output-dir','tables','previous-dir'],diff:['before-dir','after-dir','output-dir'],publication:['source-dir','output-dir','registry','evidence-dir']};
  if(!allowed[command]) throw Error('Unknown command\n'+help);
  const args={};
  for(let i=1;i<argv.length;i+=2) {
    const name=argv[i].replace(/^--/,'');
    if(!argv[i].startsWith('--') || !allowed[command].includes(name) || Object.hasOwn(args,name) || !argv[i+1] || argv[i+1].startsWith('--')) throw Error('Unknown, duplicate or missing CLI argument');
    args[name]=argv[i+1];
  }
  const required=command==='diff'?['before-dir','after-dir','output-dir']:['source-dir','output-dir'];
  if(required.some(name=>!args[name])) throw Error('Required path arguments missing\n'+help);
  let result;
  if(command==='normalize') result=normalize({sourceDir:args['source-dir'],outputDir:args['output-dir'],tables:args.tables?.split(','),previousDir:args['previous-dir']});
  else if(command==='diff') result=diffSnapshots({beforeDir:args['before-dir'],afterDir:args['after-dir'],outputDir:args['output-dir']});
  else result=await publicationPreview({sourceDir:args['source-dir'],outputDir:args['output-dir'],registryFile:args.registry,evidenceDir:args['evidence-dir']});
  const {results,scope,...compact}=result; console.log(JSON.stringify(compact,null,2));
  if(result.blockedTables) process.exitCode=1;
}
if(require.main===module) main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main};
