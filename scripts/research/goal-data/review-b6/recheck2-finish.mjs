// scripts/research/goal-data/review-b6/recheck2-finish.mjs
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),control='D:/workspace/Vocaflow-AI-Control';
const output='scripts/research/goal-data/review-b6/recheck2-command-output.local.json';
const logs=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):[];
const run=(cmd,args,cwd=root)=>{
 const r=spawnSync(cmd,args,{cwd,encoding:'utf8',windowsHide:true});
 const entry={command:[cmd,...args],cwd,exit_code:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?String(r.error):null};
 logs.push(entry);fs.writeFileSync(output,JSON.stringify(logs,null,2)+'\n');
 process.stdout.write(`$ ${cmd} ${args.join(' ')}\nexit_code: ${r.status}\nstdout:\n${entry.stdout}stderr:\n${entry.stderr}${entry.error??''}\n`);return r;
};
if(process.argv[2]==='verify'){
 for(const p of ['recheck2-probes.mjs','write-recheck2.mjs'])if(run('node',['scripts/research/goal-data/review-b6/'+p]).status!==0)process.exit(1);
}else if(process.argv[2]==='git'){
 const paths=['docs/research/goal-data-batches/review-b6/recheck2.json','docs/research/goal-data-batches/review-b6/recheck2.md',...['recheck2-calc.mjs','recheck2-probes.mjs','write-recheck2.mjs','recheck2-finish.mjs'].map(p=>'scripts/research/goal-data/review-b6/'+p)];
 run('git',['add','--',...paths]);
 run('git',['commit','--only',...paths,'-m','docs: recheck b6 second corrections before v2.4 sealing','-m','Verify the shared D2 and D3 validator against fdde27456.\nRecompute agreement, R1 totals and D3 propagation.\nRecord the direct-single exception bypass and preserve uncertainty.\n\nNo migration, route or RPC changes.\n\nCo-Authored-By: Codex <noreply@openai.com>']);
}else if(process.argv[2]==='evidence'){
 const evidence={type:'review',command_or_protocol:'T-0108 independent recheck 16561e875..fdde27456; node scripts/research/goal-data/review-b6/recheck2-probes.mjs; node scripts/research/goal-data/review-b6/write-recheck2.mjs; pass means verification performed, not all content accepted',result:'pass',skip_count:0,artifact_path_or_url:'docs/research/goal-data-batches/review-b6/recheck2.json',observed_at:new Date().toISOString(),covers:[0,1,2,3,4]};
 fs.writeFileSync(control+'/runtime/t-0108-ev.json',JSON.stringify(evidence,null,2)+'\n');process.stdout.write(JSON.stringify(evidence,null,2)+'\n');
 if(run('node',['bin/vfc.mjs','task','evidence','T-0108','--file','runtime/t-0108-ev.json','--by','goal-data-independent'],control).status!==0)process.exit(1);
 if(run('node',['bin/vfc.mjs','task','submit','T-0108','--by','goal-data-independent'],control).status!==0)process.exit(1);
}else throw new Error('Use verify, git or evidence');
