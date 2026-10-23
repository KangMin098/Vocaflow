// scripts/research/goal-data/review-b7/finish.mjs
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=process.cwd(),control='D:/workspace/Vocaflow-AI-Control';
const output='scripts/research/goal-data/review-b7/command-output.local.json';
const logs=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):[];
const run=(cmd,args,cwd=root)=>{const r=spawnSync(cmd,args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:10*1024*1024});const entry={command:[cmd,...args],cwd,exit_code:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?String(r.error):null};logs.push(entry);fs.writeFileSync(output,JSON.stringify(logs,null,2)+'\n');process.stdout.write(`$ ${cmd} ${args.join(' ')}\nexit_code: ${r.status}\nstdout:\n${entry.stdout}stderr:\n${entry.stderr}${entry.error??''}\n`);return entry;};
if(process.argv[2]==='verify'){
 if(run('node',['scripts/research/goal-data/review-b7/write-review.mjs']).exit_code!==0)process.exit(1);
 const v=JSON.parse(fs.readFileSync('docs/research/goal-data-batches/review-b7/verdict.json','utf8'));
 const md=fs.readFileSync('docs/research/goal-data-batches/review-b7/review.md','utf8');
 if(v.acceptance.length!==5||v.sampleReviews.length!==25||md.includes(':0')||JSON.stringify(v).includes(':0"'))throw new Error('report validation failed');
 console.log('Report JSON, 5 acceptance statuses, 25 sample reviews and nonzero evidence lines checked.');
}else if(process.argv[2]==='git'){
 const paths=['docs/research/goal-data-batches/review-b7/.gitignore','docs/research/goal-data-batches/review-b7/verdict.json','docs/research/goal-data-batches/review-b7/review.md','docs/research/goal-data-batches/review-b7/recalculation.json',...['.gitignore','check.mjs','write-review.mjs','finish.mjs'].map(p=>'scripts/research/goal-data/review-b7/'+p)];
 run('git',['diff','--check','--',...paths]);
 run('git',['add','--',...paths]);
 const commit=run('git',['commit','--only',...paths,'-m','docs: independently verify b7 mapping and v2.4 guards','-m','Recompute selection, hashes, agreement and b2–b7 regression.\nProbe prior-selection and type guards against frozen input.\nReview source samples and retain independence and causal uncertainty.\nNo migration, route or RPC changes.\n\nCo-Authored-By: Codex <noreply@openai.com>']);
 // Do not mutate committed artifacts after success. On failure the record remains uncommitted and is truthful.
 if(commit.exit_code!==0){const p='docs/research/goal-data-batches/review-b7/verdict.json',v=JSON.parse(fs.readFileSync(p,'utf8'));v.git={status:'failed',exit_code:commit.exit_code,output_file:output};fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');fs.appendFileSync('docs/research/goal-data-batches/review-b7/review.md','\nGit add/commit 시도 실패. 오류 원문은 scripts/research/goal-data/review-b7/command-output.local.json에 보존. 커밋·통합 미완료.\n');}
}else if(process.argv[2]==='evidence'){
 const e={type:'review',command_or_protocol:'T-0111 independent review 78ff7df39..e87bdc173; node scripts/research/goal-data/review-b7/finish.mjs verify; pass=검증 수행 완료, 내용 전부 승인 아님',result:'pass',skip_count:0,artifact_path_or_url:'docs/research/goal-data-batches/review-b7/verdict.json',observed_at:new Date().toISOString(),covers:[0,1,2,3,4]};
 fs.writeFileSync(control+'/runtime/t-0111-ev.json',JSON.stringify(e,null,2)+'\n');console.log(JSON.stringify(e,null,2));
 if(run('node',['bin/vfc.mjs','task','evidence','T-0111','--file','runtime/t-0111-ev.json','--by','goal-data-independent'],control).exit_code!==0)process.exit(1);
 if(run('node',['bin/vfc.mjs','task','submit','T-0111','--by','goal-data-independent'],control).exit_code!==0)process.exit(1);
}else throw new Error('Use verify, git or evidence');
