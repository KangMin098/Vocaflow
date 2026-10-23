// scripts/research/goal-data/review-b16/finish-recheck3.mjs
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const cwd=process.cwd(),control='D:/workspace/Vocaflow-AI-Control',out='scripts/research/goal-data/review-b16/',doc='docs/research/goal-data-batches/review-b16/',log=[]
const files=[out+'recheck3.mjs',out+'write-recheck3.mjs',out+'finish-recheck3.mjs',doc+'recheck3.json',doc+'recheck3.md']
function run(cmd,args,dir=cwd){const r=spawnSync(cmd,args,{cwd:dir,encoding:'utf8',maxBuffer:10*1024*1024}),record={cmd,args,cwd:dir,status:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null};log.push(record);fs.writeFileSync(out+'recheck3-finish.local.json',JSON.stringify(log,null,2)+'\n');console.log(JSON.stringify(record,null,2));return record}
const verdict=JSON.parse(fs.readFileSync(doc+'recheck3.json'))
if(verdict.checks.failed||verdict.skip_count!==0||verdict.acceptance.length!==4)throw Error('Review not ready')
for(const f of files.filter(p=>p.endsWith('.mjs')))if(run(process.execPath,['--check',f]).status!==0)throw Error('Syntax check failed')
for(const f of files)if(fs.readFileSync(f,'utf8').split('\n').some(l=>/[\t ]+$/.test(l)))throw Error('Trailing whitespace '+f)
if(run('git',['diff','--check','--',...files]).status!==0)throw Error('Whitespace check failed')
run('git',['add','--',...files])
run('git',['commit','--only','-m','docs: recheck b16 fail-closed and chunk error masking','-m','Verify fail-closed ownership and numeric ID boundaries.\nRun 31 regressions and 49 independent assertions.\nFind unmasked bootstrap exceptions; hold b17.\n\nCo-Authored-By: Codex <codex@openai.com>','--',...files])
const evidence={type:'review',result:'pass',skip_count:0,artifact_path_or_url:doc+'recheck3.json',observed_at:new Date().toISOString(),covers:[0,1,2,3],command_or_protocol:'49 checks; shipped 31/31; pinned fc3690e3 runner with actual full validators; 1302 IDs and 9114 adjacency cases; AC0/2/3 resolved, AC1 unresolved; bootstrap stderr leak P1=1; b17 hold; pass means verification completed'}
fs.writeFileSync(control+'/runtime/t-0127-ev.json',JSON.stringify(evidence,null,2)+'\n')
if(run(process.execPath,['bin/vfc.mjs','task','evidence','T-0127','--file','runtime/t-0127-ev.json','--by','goal-data-independent'],control).status!==0)throw Error('Evidence failed; submit not attempted')
if(run(process.execPath,['bin/vfc.mjs','task','submit','T-0127','--by','goal-data-independent'],control).status!==0)throw Error('Submit failed')
