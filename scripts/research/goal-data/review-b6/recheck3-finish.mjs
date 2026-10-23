// scripts/research/goal-data/review-b6/recheck3-finish.mjs
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),control='D:/workspace/Vocaflow-AI-Control';
const output='scripts/research/goal-data/review-b6/recheck3-command-output.local.json';
const logs=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):[];
const run=(cmd,args,cwd=root)=>{
 const r=spawnSync(cmd,args,{cwd,encoding:'utf8',windowsHide:true});
 const entry={command:[cmd,...args],cwd,exit_code:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?String(r.error):null};
 logs.push(entry);fs.writeFileSync(output,JSON.stringify(logs,null,2)+'\n');
 process.stdout.write(`$ ${cmd} ${args.join(' ')}\nexit_code: ${r.status}\nstdout:\n${entry.stdout}stderr:\n${entry.stderr}${entry.error??''}\n`);return r;
};
if(process.argv[2]==='verify'){
 for(const p of ['recheck3-probes.mjs','recheck3-detail.mjs','write-recheck3.mjs'])if(run('node',['scripts/research/goal-data/review-b6/'+p]).status!==0)process.exit(1);
}else if(process.argv[2]==='git'){
 const paths=['docs/research/goal-data-batches/review-b6/recheck3.json','docs/research/goal-data-batches/review-b6/recheck3.md',...['recheck3-calc.mjs','recheck3-probes.mjs','recheck3-detail.mjs','write-recheck3.mjs','recheck3-finish.mjs'].map(p=>'scripts/research/goal-data/review-b6/'+p)];
 run('git',['add','--',...paths]);
 run('git',['commit','--only',...paths,'-m','docs: recheck b6 third corrections before v2.4 sealing','-m','Verify the shared D2 and D3 validator against 78ff7df39.\nRecompute agreement, R1 totals and D3 propagation.\nConfirm the direct-single guard and document the locus-count exception.\n\nNo migration, route or RPC changes.\n\nCo-Authored-By: Codex <noreply@openai.com>']);
}else if(process.argv[2]==='evidence'){
 const evidence={type:'review',command_or_protocol:'T-0109 independent recheck fdde27456..78ff7df39; node scripts/research/goal-data/review-b6/recheck3-probes.mjs; node scripts/research/goal-data/review-b6/recheck3-detail.mjs; node scripts/research/goal-data/review-b6/write-recheck3.mjs; pass means verification performed, not all content accepted',result:'pass',skip_count:0,artifact_path_or_url:'docs/research/goal-data-batches/review-b6/recheck3.json',observed_at:new Date().toISOString(),covers:[0,1,2]};
 fs.writeFileSync(control+'/runtime/t-0109-ev.json',JSON.stringify(evidence,null,2)+'\n');process.stdout.write(JSON.stringify(evidence,null,2)+'\n');
 if(run('node',['bin/vfc.mjs','task','evidence','T-0109','--file','runtime/t-0109-ev.json','--by','goal-data-independent'],control).status!==0)process.exit(1);
 if(run('node',['bin/vfc.mjs','task','submit','T-0109','--by','goal-data-independent'],control).status!==0)process.exit(1);
}else throw new Error('Use verify, git or evidence');
