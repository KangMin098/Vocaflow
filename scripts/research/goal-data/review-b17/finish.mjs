// scripts/research/goal-data/review-b17/finish.mjs
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const cwd=process.cwd(),control='D:/workspace/Vocaflow-AI-Control',paths=['docs/research/goal-data-batches/review-b17','scripts/research/goal-data/review-b17'],log=[]
function run(cmd,args,dir=cwd){const r=spawnSync(cmd,args,{cwd:dir,encoding:'utf8',maxBuffer:10e6}),rec={cmd,args,cwd:dir,status:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null};log.push(rec);fs.writeFileSync(paths[1]+'/finish.local.json',JSON.stringify(log,null,2)+'\n');console.log(JSON.stringify(rec,null,2));return rec}
const verdict=JSON.parse(fs.readFileSync(paths[0]+'/verdict.json'))
if(verdict.verification.failed||verdict.skip_count!==0||verdict.acceptance.length!==5)throw Error('review not ready')
for(const f of fs.readdirSync(paths[1]).filter(p=>p.endsWith('.mjs')))if(run(process.execPath,['--check',paths[1]+'/'+f]).status!==0)throw Error('syntax failure')
for(const p of paths)for(const f of fs.readdirSync(p).filter(f=>!f.endsWith('.local.json'))){const text=fs.readFileSync(p+'/'+f,'utf8');if(text.split('\n').some(l=>/[\t ]+$/.test(l)))throw Error('trailing whitespace '+p+'/'+f)}
if(run('git',['diff','--check','--',...paths]).status!==0)throw Error('diff check failed')
const files=run('git',['ls-files','--others','--exclude-standard','--',...paths]);if(files.status!==0||files.stdout.includes('.local.json'))throw Error('raw evidence tracked')
run('git',['add','--',...paths])
run('git',['commit','--only','-m','docs: independently verify b17 manual output revisions','-m','Compare all first snapshots and final item fields.\nReplay assembly paths and verify pre-output B02 correction.\nRecalculate agreement and validate b2-b17 with shipped regressions.\nRetain semantic uncertainty and allow research-only continuation.\n\nCo-Authored-By: Codex <codex@openai.com>','--',...paths])
const evidence={type:'review',result:'pass',skip_count:0,artifact_path_or_url:paths[0]+'/verdict.json',observed_at:new Date().toISOString(),covers:[0,1,2,3,4],command_or_protocol:'387 independent checks, failed 0; real isolated regression 32/32; 17 local batch variants validated; first/final item field diff and assembly replay; AC0/1/2/4 confirmed, AC3 unclear; pass means verification performed; Git attempt recorded separately'}
fs.writeFileSync(control+'/runtime/t-0129-ev.json',JSON.stringify(evidence,null,2)+'\n')
if(run(process.execPath,['bin/vfc.mjs','task','evidence','T-0129','--file','runtime/t-0129-ev.json','--by','goal-data-independent'],control).status!==0)throw Error('evidence failed; original output retained')
if(run(process.execPath,['bin/vfc.mjs','task','submit','T-0129','--by','goal-data-independent'],control).status!==0)throw Error('submit failed; original output retained')
