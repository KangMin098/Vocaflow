// scripts/research/goal-data/review-b16/finish-recheck2.mjs
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const cwd=process.cwd(),control='D:/workspace/Vocaflow-AI-Control',out='scripts/research/goal-data/review-b16/',doc='docs/research/goal-data-batches/review-b16/',log=[]
const files=[out+'recheck2.mjs',out+'write-recheck2.mjs',out+'finish-recheck2.mjs',doc+'recheck2.json',doc+'recheck2.md']
function run(cmd,args,dir=cwd){const r=spawnSync(cmd,args,{cwd:dir,encoding:'utf8',maxBuffer:10*1024*1024}),record={cmd,args,cwd:dir,status:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null};log.push(record);fs.writeFileSync(out+'recheck2-finish.local.json',JSON.stringify(log,null,2)+'\n');console.log(JSON.stringify(record,null,2));return record}
const verdict=JSON.parse(fs.readFileSync(doc+'recheck2.json'))
if(verdict.checks.failed||verdict.skip_count!==0||verdict.acceptance.length!==3)throw Error('Review not ready')
for(const f of files.filter(p=>p.endsWith('.mjs')))if(run(process.execPath,['--check',f]).status!==0)throw Error('Syntax check failed')
for(const f of files)if(fs.readFileSync(f,'utf8').split('\n').some(l=>/[\t ]+$/.test(l)))throw Error('Trailing whitespace '+f)
if(run('git',['diff','--check','--',...files]).status!==0)throw Error('Whitespace check failed')
run('git',['add','--',...files])
run('git',['commit','--only','-m','docs: independently recheck b16 ownership and ID masking','-m','Verify ordinary ownership and masking fixes with actual validators.\nReproduce missing-input bypass and ID masking escape paths.\nCheck 26 regressions and 1302 exam IDs; hold b17.\n\nCo-Authored-By: Codex <codex@openai.com>','--',...files])
const evidence={type:'review',result:'pass',skip_count:0,artifact_path_or_url:doc+'recheck2.json',observed_at:new Date().toISOString(),covers:[0,1,2],command_or_protocol:'33 checks; shipped 26/26; pinned d85f22d runner with actual full validators; 1302 IDs; pass means verification performed; AC0/1 unresolved, AC2 resolved; new P1=2; b17 hold; Git output preserved separately'}
fs.writeFileSync(control+'/runtime/t-0126-ev.json',JSON.stringify(evidence,null,2)+'\n')
if(run(process.execPath,['bin/vfc.mjs','task','evidence','T-0126','--file','runtime/t-0126-ev.json','--by','goal-data-independent'],control).status!==0)throw Error('Evidence failed; submit not attempted')
if(run(process.execPath,['bin/vfc.mjs','task','submit','T-0126','--by','goal-data-independent'],control).status!==0)throw Error('Submit failed')
