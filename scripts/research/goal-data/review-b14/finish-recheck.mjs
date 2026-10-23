// scripts/research/goal-data/review-b14/finish-recheck.mjs
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const cwd=process.cwd(),control='D:/workspace/Vocaflow-AI-Control',script='scripts/research/goal-data/review-b14/',doc='docs/research/goal-data-batches/review-b14/',log=[]
const paths=[doc+'recheck.json',doc+'recheck.md',script+'recheck.mjs',script+'write-recheck.mjs',script+'finish-recheck.mjs']
function run(cmd,args,dir=cwd){const r=spawnSync(cmd,args,{cwd:dir,encoding:'utf8',maxBuffer:10*1024*1024}),record={cmd,args,cwd:dir,status:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null};log.push(record);fs.writeFileSync(script+'finish-recheck.local.json',JSON.stringify(log,null,2)+'\n');console.log(JSON.stringify(record,null,2));return record}
const review=JSON.parse(fs.readFileSync(doc+'recheck.json','utf8'))
if(review.checks.failed||review.skip_count!==0||review.acceptance.length!==4)throw Error('Review incomplete')
run(process.execPath,['bin/vfc.mjs','task','show','T-0123'],control)
for(const p of paths.filter(p=>p.endsWith('.mjs')))if(run(process.execPath,['--check',p]).status!==0)throw Error('Syntax failure')
for(const p of paths)if(fs.readFileSync(p,'utf8').split('\n').some(l=>/[\t ]+$/.test(l)))throw Error('Trailing whitespace '+p)
if(run('git',['diff','--check','--',...paths]).status!==0)throw Error('Diff check failed')
run('git',['add','--',...paths])
run('git',['commit','--only','-m','docs: recheck row-level rationale guard relaxation','-m','Reproduce all 28 tracks and 16 shipped counterexamples.\nReview 52 rows for source-specific observation limits.\nDemonstrate denominator padding and broad insertion E2 bypasses.\nRecord two P1 findings and require guard criteria revision.\n\nCo-Authored-By: Codex <codex@openai.com>','--',...paths])
const evidence={type:'review',result:'pass',skip_count:0,artifact_path_or_url:doc+'recheck.json',observed_at:new Date().toISOString(),covers:[0,1,2,3],command_or_protocol:`${review.checks.total} reproduction checks; 28 tracks; 16 shipped counterexamples; 52-row independent review; pass means verification completed, two P1 findings retained; Git attempt separate`}
fs.writeFileSync(control+'/runtime/t-0123-ev.json',JSON.stringify(evidence,null,2)+'\n')
if(run(process.execPath,['bin/vfc.mjs','task','evidence','T-0123','--file','runtime/t-0123-ev.json','--by','goal-data-independent'],control).status!==0)throw Error('Evidence rejected')
if(run(process.execPath,['bin/vfc.mjs','task','submit','T-0123','--by','goal-data-independent'],control).status!==0)throw Error('Submit failed')
