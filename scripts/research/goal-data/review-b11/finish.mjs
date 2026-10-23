// scripts/research/goal-data/review-b11/finish.mjs
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const log=[],cwd=process.cwd(),control='D:/workspace/Vocaflow-AI-Control'
const paths=['docs/research/goal-data-batches/review-b11','scripts/research/goal-data/review-b11']
function run(cmd,args,dir=cwd){const r=spawnSync(cmd,args,{cwd:dir,encoding:'utf8',maxBuffer:10*1024*1024});const record={cmd,args,cwd:dir,status:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null};log.push(record);fs.writeFileSync(paths[1]+'/finish.local.json',JSON.stringify(log,null,2)+'\n');console.log(JSON.stringify(record,null,2));return record}
const verdict=JSON.parse(fs.readFileSync(paths[0]+'/verdict.json'))
if(verdict.checks.failed||verdict.skip_count!==0)throw Error('review not ready')
for(const f of ['audit.mjs','supplement.mjs','write-review.mjs','finish.mjs']){const r=run(process.execPath,['--check',paths[1]+'/'+f]);if(r.status!==0)throw Error('syntax check failed')}
run('git',['diff','--check','--',...paths])
run('git',['add','--',...paths])
run('git',['commit','--only','-m','docs: review b11 v2.4 evidence and contamination limits','-m','Verify the answer-in-distractors guard and b2-b11 regression.\nRecalculate selection, agreement, hashes and freeze changes.\nReview 80 rows, 20 samples and four primary disagreements.\nPreserve exposure uncertainty and conditional next-batch decision.\n\nCo-Authored-By: Codex <codex@openai.com>','--',...paths])
const ev={type:'review',result:'pass',skip_count:0,artifact_path_or_url:paths[0]+'/verdict.json',observed_at:new Date().toISOString(),covers:[0,1,2,3,4],command_or_protocol:'97 checks; node --experimental-vm-modules scripts/research/goal-data/review-b11/supplement.mjs; node scripts/research/goal-data/review-b11/write-review.mjs; pass means review performed, not absence of contamination or seal approval'}
fs.writeFileSync(control+'/runtime/t-0118-ev.json',JSON.stringify(ev,null,2)+'\n')
const evidence=run(process.execPath,['bin/vfc.mjs','task','evidence','T-0118','--file','runtime/t-0118-ev.json','--by','goal-data-independent'],control)
if(evidence.status!==0)throw Error('evidence rejected; submit not attempted')
run(process.execPath,['bin/vfc.mjs','task','submit','T-0118','--by','goal-data-independent'],control)
