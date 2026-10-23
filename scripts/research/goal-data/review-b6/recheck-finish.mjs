// scripts/research/goal-data/review-b6/recheck-finish.mjs
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),control='D:/workspace/Vocaflow-AI-Control';
const output='scripts/research/goal-data/review-b6/recheck-command-output.local.json';
const logs=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):[];
const run=(cmd,args,cwd)=>{
 const r=spawnSync(cmd,args,{cwd,encoding:'utf8',windowsHide:true});
 const entry={command:[cmd,...args],cwd,exit_code:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?String(r.error):null};
 logs.push(entry);fs.writeFileSync(output,JSON.stringify(logs,null,2)+'\n');
 process.stdout.write(`$ ${cmd} ${args.join(' ')}\nexit_code: ${r.status}\nstdout:\n${entry.stdout}stderr:\n${entry.stderr}${entry.error??''}\n`);return r;
};
if(process.argv[2]==='git'){
 const paths=['docs/research/goal-data-batches/review-b6/recheck.json','docs/research/goal-data-batches/review-b6/recheck.md','docs/research/goal-data-batches/review-b6/recheck-metrics.json','scripts/research/goal-data/review-b6/recheck-calc.mjs','scripts/research/goal-data/review-b6/write-recheck.mjs','scripts/research/goal-data/review-b6/recheck-finish.mjs'];
 run('git',['add','--',...paths],root);
 run('git',['commit','--only',...paths,'-m','docs: recheck b6 corrections and v2.4 boundaries','-m','Recompute priority, agreement and D3 propagation against 16561e875.\nRecord item-specific judgments and preserve unclear boundaries.\nReproduce D3 acceptance of v2.4-invalid inputs with controls.\n\nNo migration, route or RPC changes.\n\nCo-Authored-By: Codex <noreply@openai.com>'],root);
}else if(process.argv[2]==='evidence'){
 const evidence={type:'review',command_or_protocol:'T-0107 independent recheck c6adb9090..16561e875; node scripts/research/goal-data/review-b6/recheck-calc.mjs; node scripts/research/goal-data/review-b6/write-recheck.mjs; pass means verification performed, not all content accepted',result:'pass',skip_count:0,artifact_path_or_url:'docs/research/goal-data-batches/review-b6/recheck.json',observed_at:new Date().toISOString(),covers:[0,1,2,3,4]};
 fs.writeFileSync(control+'/runtime/t0107-ev.json',JSON.stringify(evidence,null,2)+'\n');process.stdout.write(JSON.stringify(evidence,null,2)+'\n');
 const ev=run('node',['bin/vfc.mjs','task','evidence','T-0107','--file','runtime/t0107-ev.json','--by','goal-data-independent'],control);
 if(ev.status!==0)process.exit(1);
 const submit=run('node',['bin/vfc.mjs','task','submit','T-0107','--by','goal-data-independent'],control);
 if(submit.status!==0)process.exit(1);
}else throw new Error('Use git or evidence');
