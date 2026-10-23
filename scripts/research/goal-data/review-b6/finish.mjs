// scripts/research/goal-data/review-b6/finish.mjs
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const output='docs/research/goal-data-batches/review-b6/command-output.txt';
const run=(cmd,args,cwd)=>{
 const result=spawnSync(cmd,args,{cwd,encoding:'utf8',windowsHide:true});
 const text=`$ ${cmd} ${args.join(' ')}\nexit_code: ${result.status}\nstdout:\n${result.stdout??''}stderr:\n${result.stderr??''}${result.error?String(result.error)+'\n':''}\n`;
 fs.appendFileSync(output,text);process.stdout.write(text);return result;
};
if(process.argv[2]==='git'){
 fs.writeFileSync(output,'T-0105 exact command output (UTF-8)\n\n');
 run('git',['add','--','docs/research/goal-data-batches/review-b6/','scripts/research/goal-data/review-b6/'],process.cwd());
 run('git',['commit','--only','docs/research/goal-data-batches/review-b6/','scripts/research/goal-data/review-b6/','-m','docs: independently review b6 mapping and validator','-m','Recompute b6 agreement, source bindings and selection.\nVerify secondary-task counterexamples and repetition guards.\nRecord primary-task procedure failures and unresolved source boundaries.\n\nNo migration, route or RPC changes.\n\nCo-Authored-By: Codex <noreply@openai.com>'],process.cwd());
}else if(process.argv[2]==='evidence'){
 const control='D:/workspace/Vocaflow-AI-Control';
 const evidence={type:'review',command_or_protocol:'T-0105 independent review @c6adb9090; node scripts/research/goal-data/review-b6/check.mjs; node scripts/research/goal-data/review-b6/write-review.mjs',result:'pass',skip_count:0,artifact_path_or_url:'docs/research/goal-data-batches/review-b6/verdict.json',observed_at:new Date().toISOString(),covers:[0,1,2,3,4]};
 fs.writeFileSync(control+'/runtime/t0105-ev.json',JSON.stringify(evidence,null,2)+'\n');
 fs.appendFileSync(output,'$ write runtime/t0105-ev.json\n'+JSON.stringify(evidence,null,2)+'\n\n');
 process.stdout.write(JSON.stringify(evidence,null,2)+'\n');
 run('node',['bin/vfc.mjs','task','evidence','T-0105','--file','runtime/t0105-ev.json','--by','goal-data-independent'],control);
 run('node',['bin/vfc.mjs','task','submit','T-0105','--by','goal-data-independent'],control);
}else throw new Error('Use git or evidence');
