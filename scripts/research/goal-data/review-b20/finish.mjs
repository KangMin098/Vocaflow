// scripts/research/goal-data/review-b20/finish.mjs
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const cwd=process.cwd(),control='D:/workspace/Vocaflow-AI-Control',paths=['docs/research/goal-data-batches/review-b20','scripts/research/goal-data/review-b20'],log=[]
function run(cmd,args,dir=cwd){const r=spawnSync(cmd,args,{cwd:dir,encoding:'utf8',maxBuffer:10e6}),rec={cmd,args,cwd:dir,status:r.status,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null};log.push(rec);fs.writeFileSync(paths[1]+'/finish.local.json',JSON.stringify(log,null,2)+'\n');console.log(JSON.stringify(rec,null,2));return rec}
const git=args=>run('git',['-c','safe.directory='+cwd.replaceAll('\\','/'),...args])
const verdict=JSON.parse(fs.readFileSync(paths[0]+'/verdict.json'))
if(verdict.verification.failed||verdict.skip_count!==0||verdict.acceptance.length!==5)throw Error('review not ready')
for(const p of ['extra','supplement','deep'])if(JSON.parse(fs.readFileSync(paths[1]+'/'+p+'.local.json')).checks.some(c=>!c.pass))throw Error('failed checks')
const snap=JSON.parse(fs.readFileSync(paths[1]+'/packets.local.json')).files
if(!Object.entries(snap).every(([p,v])=>fs.readFileSync('D:/workspace/Vocaflow-goal-data/'+p,'utf8')===v))throw Error('owner inputs changed')
for(const f of fs.readdirSync(paths[1]).filter(p=>p.endsWith('.mjs')))if(run(process.execPath,['--check',paths[1]+'/'+f]).status!==0)throw Error('syntax failure')
for(const p of paths)for(const f of fs.readdirSync(p).filter(f=>!f.endsWith('.local.json'))){const text=fs.readFileSync(p+'/'+f,'utf8');if(text.split('\n').some(l=>/[\t ]+$/.test(l)))throw Error('trailing whitespace '+p+'/'+f)}
if(git(['diff','--check','--',...paths]).status!==0)throw Error('diff check failed')
const files=git(['ls-files','--others','--exclude-standard','--',...paths]);if(files.status!==0||files.stdout.includes('.local.json'))throw Error('raw evidence tracked')
git(['add','--',...paths])
git(['commit','--only','-m','docs: verify b20 and flag source-gap candidate eligibility','-m','Replay four B20 chunks in temporary copies and compare first snapshots.\nRecalculate duplicate denominators, agreement, hashes and D3 bindings.\nReview source footnote loss and preserve unresolved TASK semantics.\nHold expansion until D2 excludes the confirmed source-gap candidate.\n\nCo-Authored-By: Codex <codex@openai.com>','--',...paths])
const evidence={type:'review',result:'pass',skip_count:0,artifact_path_or_url:paths[0]+'/verdict.json',observed_at:new Date().toISOString(),covers:[0,1,2,3,4],command_or_protocol:'579 unique static/binding checks failed 0; temporary byte replay 4/4; isolated regressions 32/32; 20 local batch variants validated; exhaustive 23x23 inventory comparison and three raw duplicate-pair comparisons; 18 sample items plus M1809#26 reviewed. AC0/2/4 confirmed, AC1 refuted for missing-evidence rationale/D2 eligibility (D3 isolation confirmed), AC3 unclear. New P0 0/P1 1, next batch hold. pass means verification performed, not all claims passed. Git attempts recorded separately.'}
fs.writeFileSync(control+'/runtime/t-0133-ev.json',JSON.stringify(evidence,null,2)+'\n')
if(run(process.execPath,['bin/vfc.mjs','task','evidence','T-0133','--file','runtime/t-0133-ev.json','--by','goal-data-independent'],control).status!==0)throw Error('evidence failed; original output retained')
if(run(process.execPath,['bin/vfc.mjs','task','submit','T-0133','--by','goal-data-independent'],control).status!==0)throw Error('submit failed; original output retained')
