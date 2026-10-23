// scripts/research/goal-data/review-b16/finish-recheck.mjs
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const cwd=process.cwd(),control='D:/workspace/Vocaflow-AI-Control',out='scripts/research/goal-data/review-b16/',doc='docs/research/goal-data-batches/review-b16/',log=[]
const files=[out+'recheck.mjs',out+'write-recheck.mjs',out+'finish-recheck.mjs',doc+'recheck.json',doc+'recheck.md']
function run(cmd,args,dir=cwd){const r=spawnSync(cmd,args,{cwd:dir,encoding:'utf8',maxBuffer:10*1024*1024}),record={cmd,args,cwd:dir,status:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null};log.push(record);fs.writeFileSync(out+'recheck-finish.local.json',JSON.stringify(log,null,2)+'\n');console.log(JSON.stringify(record,null,2));return record}
const verdict=JSON.parse(fs.readFileSync(doc+'recheck.json'))
if(verdict.checks.failed||verdict.skip_count!==0||verdict.acceptance.length!==4)throw Error('Review not ready')
for(const f of files.filter(p=>p.endsWith('.mjs')))if(run(process.execPath,['--check',f]).status!==0)throw Error('Syntax check failed')
for(const f of files)if(fs.readFileSync(f,'utf8').split('\n').some(l=>/[\t ]+$/.test(l)))throw Error('Trailing whitespace '+f)
if(run('git',['diff','--check','--',...files]).status!==0)throw Error('Whitespace check failed')
run('git',['add','--',...files])
run('git',['commit','--only','-m','docs: recheck b16 chunk validation with full validators','-m','Reproduce resolved missing-output and fourth-member findings.\nCompare chunk and combination paths with 160 boundary cases.\nRecord two remaining P1 defects and hold b17 expansion.\n\nCo-Authored-By: Codex <codex@openai.com>','--',...files])
const evidence={type:'review',result:'pass',skip_count:0,artifact_path_or_url:doc+'recheck.json',observed_at:new Date().toISOString(),covers:[0,1,2,3],command_or_protocol:'514 checks; pinned b447ccf runner with full actual row/chunk validators; 160 boundary cases; pass means verification performed; AC0/1 unresolved, AC2/3 resolved; new P1=2; b17 hold; Git attempt output preserved separately'}
fs.writeFileSync(control+'/runtime/t-0125-ev.json',JSON.stringify(evidence,null,2)+'\n')
if(run(process.execPath,['bin/vfc.mjs','task','evidence','T-0125','--file','runtime/t-0125-ev.json','--by','goal-data-independent'],control).status!==0)throw Error('Evidence failed; submit not attempted')
if(run(process.execPath,['bin/vfc.mjs','task','submit','T-0125','--by','goal-data-independent'],control).status!==0)throw Error('Submit failed')
