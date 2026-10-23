// scripts/research/goal-data/review-b8/finalize.mjs
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const cwd=process.cwd(),central='D:/workspace/Vocaflow-AI-Control';
const output='scripts/research/goal-data/review-b8/command-output.local.json',records=[];
const run=(cmd,args,dir=cwd)=>{
 const r=spawnSync(cmd,args,{cwd:dir,encoding:'utf8',maxBuffer:30e6});
 const record={command:[cmd,...args],cwd:dir,exit_code:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null};
 records.push(record);fs.writeFileSync(output,JSON.stringify(records,null,2)+'\n');
 console.log(JSON.stringify(record,null,2));return record;
};
for(const file of ['check.mjs','supplement.mjs','write-review.mjs']){
 const r=run('node',['scripts/research/goal-data/review-b8/'+file]);if(r.exit_code!==0)process.exit(1);
}
const verdict=JSON.parse(fs.readFileSync('docs/research/goal-data-batches/review-b8/verdict.json','utf8'));
if(verdict.acceptance.length!==5||verdict.reviews.length!==20||verdict.skip_count!==0)throw Error('incomplete report');
run('git',['diff','--check']);
run('git',['check-ignore','scripts/research/goal-data/review-b8/packets.local.json','scripts/research/goal-data/review-b8/command-output.local.json']);
const paths=['docs/research/goal-data-batches/review-b8','scripts/research/goal-data/review-b8'];
run('git',['add','--',...paths]);
const commit=run('git',['commit','--only',...paths,'-m','docs: independently review b8 data and v2.5 validation','-m','Recalculate b8 agreement, exclusions and D2/D3 regression.\nVerify snapshot preservation and mutation detection.\nReview source samples and require unseen validation before v2.5 sealing.\n\nCo-Authored-By: Codex <noreply@openai.com>']);
if(commit.exit_code!==0){
 fs.appendFileSync('docs/research/goal-data-batches/review-b8/review.md','\nGit add/commit 시도 실패. 커밋·통합 미완료. 정확한 exit code·오류 원문은 scripts/research/goal-data/review-b8/command-output.local.json에 보존했다.\n');
}
const ev={type:'review',command_or_protocol:'node scripts/research/goal-data/review-b8/check.mjs; node scripts/research/goal-data/review-b8/supplement.mjs; source review at 1fa75b9cc (pass means review completed, findings retained)',result:'pass',skip_count:0,artifact_path_or_url:'docs/research/goal-data-batches/review-b8/verdict.json',observed_at:new Date().toISOString(),covers:[0,1,2,3,4]};
fs.mkdirSync(central+'/runtime',{recursive:true});fs.writeFileSync(central+'/runtime/t-0113-ev.json',JSON.stringify(ev,null,2)+'\n');
run('node',['bin/vfc.mjs','task','evidence','T-0113','--file','runtime/t-0113-ev.json','--by','goal-data-independent'],central);
run('node',['bin/vfc.mjs','task','submit','T-0113','--by','goal-data-independent'],central);
