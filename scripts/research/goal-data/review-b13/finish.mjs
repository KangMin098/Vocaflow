// scripts/research/goal-data/review-b13/finish.mjs
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const cwd=process.cwd(),control='D:/workspace/Vocaflow-AI-Control',paths=['docs/research/goal-data-batches/review-b13','scripts/research/goal-data/review-b13'],log=[]
function run(cmd,args,dir=cwd){const r=spawnSync(cmd,args,{cwd:dir,encoding:'utf8',maxBuffer:10*1024*1024});const record={cmd,args,cwd:dir,status:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null};log.push(record);fs.writeFileSync(paths[1]+'/finish.local.json',JSON.stringify(log,null,2)+'\n');console.log(JSON.stringify(record,null,2));return record}
const verdict=JSON.parse(fs.readFileSync(paths[0]+'/verdict.json'))
if(verdict.checks.failed||verdict.skip_count!==0||verdict.acceptance.length!==5)throw Error('Review not ready')
for(const f of ['audit.mjs','supplement.mjs','verify-diff.mjs','transcripts.mjs','write-review.mjs','finish.mjs'])if(run(process.execPath,['--check',paths[1]+'/'+f]).status!==0)throw Error('Syntax check failed')
for(const p of paths)for(const f of fs.readdirSync(p))if(!f.endsWith('.local.json')){const b=fs.readFileSync(p+'/'+f,'utf8');if(b.split('\n').some(l=>/[\t ]+$/.test(l)))throw Error('Trailing whitespace: '+p+'/'+f)}
if(run('git',['diff','--check','--',...paths]).status!==0)throw Error('Whitespace check failed')
run('git',['add','--',...paths])
run('git',['commit','--only','-m','docs: verify b13 prompt provenance and v2.4 batch','-m','Verify saved prompts, dispatched inputs and overwrite refusal.\nCompare first/final rows and retain semantic uncertainty.\nRecalculate agreement, D3 bindings and b2-b13 regression.\nRecord conditional continuation with no new P0/P1.\n\nCo-Authored-By: Codex <codex@openai.com>','--',...paths])
const evidence={type:'review',result:'pass',skip_count:0,artifact_path_or_url:paths[0]+'/verdict.json',observed_at:new Date().toISOString(),covers:[0,1,2,3,4],command_or_protocol:`${verdict.checks.total} checks; review-b13 audit/supplement/transcripts/verify-diff; pass means verification performed, with AC3 semantic uncertainty retained; commit attempt recorded separately`}
fs.writeFileSync(control+'/runtime/t-0120-ev.json',JSON.stringify(evidence,null,2)+'\n')
if(run(process.execPath,['bin/vfc.mjs','task','evidence','T-0120','--file','runtime/t-0120-ev.json','--by','goal-data-independent'],control).status!==0)throw Error('Evidence rejected; submit not attempted')
if(run(process.execPath,['bin/vfc.mjs','task','submit','T-0120','--by','goal-data-independent'],control).status!==0)throw Error('Submit failed; see original output')
