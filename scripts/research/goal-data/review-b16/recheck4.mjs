// scripts/research/goal-data/review-b16/recheck4.mjs
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
const source='D:/workspace/Vocaflow-goal-data', rev='8980aaa59eff4156a8e4a916fbaeeb5e1dc37e1c', old='fc3690e3abafc213ab04afbbf394f4cd384c4935'
const out='scripts/research/goal-data/review-b16/', doc='docs/research/goal-data-batches/review-b16/', base='scripts/research/goal-data/local/', runner='scripts/research/goal-data/d2-run.mjs'
const temp=fs.mkdtempSync(path.resolve(out,'recheck4-temp.local-')), checks=[], runs=[]
const git=(...args)=>execFileSync('C:/Program Files/Git/mingw64/bin/git.exe',['-c','safe.directory='+source,...args],{cwd:source,encoding:'utf8',maxBuffer:50*1024*1024,stdio:['pipe','pipe','pipe']})
const at=(p,r=rev)=>git('show',r+':'+p), hash=s=>crypto.createHash('sha256').update(s).digest('hex')
const put=(p,s)=>{const f=path.join(temp,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
const check=(name,pass,detail)=>checks.push({name,pass,detail})
const packets=JSON.parse(fs.readFileSync(out+'packets.local.json')).files
for(const [p,s] of Object.entries(packets))put(p,s)
const dependencies=['scripts/csat/map/v62/data/pilot-lib.mjs','docs/csat-learner/v4/codebook.json','docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md',runner,'scripts/research/goal-data/d2-validate.mjs','scripts/research/goal-data/d2-validate.check.mjs','scripts/research/goal-data/prereg-compare.mjs','scripts/research/goal-data/d3-build.mjs',...git('ls-tree','-r','--name-only',rev,'docs/research/goal-data-batches/D2-task-mapping').trim().split('\n').filter(p=>/\/CONTRACT.*\.md$/.test(p))]
const sources={}
for(const p of dependencies){sources[p]=at(p);put(p,sources[p])}
const diff=git('diff',old,rev), lines=sources[runner].split('\n')
const line=s=>lines.findIndex(l=>l.includes(s))+1
check('handlers precede input parsing and task resolution',line("process.on('uncaughtException'")<line('const input =')&&line("process.on('unhandledRejection'")<line('const input =')&&line('const input =')<line('const tasks ='),{uncaught:line("process.on('uncaughtException'"),rejection:line("process.on('unhandledRejection'"),input:line('const input ='),tasks:line('const tasks =')})
check('only runner handler, shipped regression and review note changed',git('diff','--name-only',old,rev).trim().split('\n').every(p=>[runner,'scripts/research/goal-data/d2-validate.check.mjs','docs/research/goal-data-batches/D2-task-mapping/mapping-review.md'].includes(p)),diff)
check('296 captured packets unchanged in input worktree',Object.entries(packets).every(([p,s])=>fs.readFileSync(source+'/'+p,'utf8')===s),{count:Object.keys(packets).length})
function run(file,args=[],label=''){
 const r=spawnSync(process.execPath,[path.join(temp,file),...args],{cwd:temp,encoding:'utf8',maxBuffer:20*1024*1024,timeout:30000})
 const rec={label,file,args,status:r.status,signal:r.signal,stdout:r.stdout??'',stderr:r.stderr??'',error:r.error?.message??null};runs.push(rec);return rec
}
const shipped=run('scripts/research/goal-data/d2-validate.check.mjs',[],'shipped regression')
check('shipped 32/32',shipped.status===0&&shipped.stdout.split('\n').filter(l=>l.startsWith('ok ')).length===32&&!shipped.stdout.includes('FAIL'),shipped)
const batch='b16-v24', inputPath=base+batch+'/input.json', input=JSON.parse(packets[inputPath]), p1=base+batch+'/chunk-A-01.out.json',p2=base+batch+'/chunk-A-02.out.json'
const foreign=JSON.parse(packets[p1]).rows[4].item_id, idPattern=/(?<!\d)M?\d{4}[AB]?#\d{1,2}(?!\d)/gi
const bootstrap=[]
for(const [name,body] of [['malformed batch JSON','{"'+foreign+'": invalid}'],['undefined task',JSON.stringify({...input,tasks:[foreign]})]]){
 put(inputPath,body)
 const r=run(runner,[batch,'validate','A','02'],name),all=r.stdout+r.stderr
 const hits=all.match(idPattern)??[]
 check(name+' spawn masked one line exit 1',r.status===1&&r.stderr===''&&r.stdout.trim().split('\n').length===1&&all.includes('검사 실패')&&hits.length===0,{...r,external_id_count:hits.length})
 bootstrap.push(r)
}
put(inputPath,packets[inputPath])
const defects=[]
for(const [name,changes] of [
 ['own row defect',{[p2]:JSON.stringify({...JSON.parse(packets[p2]),rows:JSON.parse(packets[p2]).rows.map((r,i)=>i?r:{...r,primary_reason:''})})}],
 ['other unreadable plus own empty',{[p1]:'{"'+foreign+'": invalid}',[p2]:JSON.stringify({...JSON.parse(packets[p2]),rows:[]})}],
 ['own malformed output',{[p2]:'{"'+foreign+'": invalid}'}],
 ]){
 for(const [p,s] of Object.entries(changes))put(p,s)
 const r=run(runner,[batch,'validate','A','02'],name)
 check(name+' preserves defect and exit 1',r.status===1&&r.stdout.includes('이 청크 결함')&&!r.stdout.includes(foreign),r)
 defects.push(r)
 for(const p of Object.keys(changes))put(p,packets[p])
}
const batches=[...new Set(Object.keys(packets).filter(p=>p.endsWith('/input.json')).map(p=>p.split('/').at(-2)))].sort(), comparisons=[]
for(const b of batches)for(const cmd of ['validate','agree']){
 put(runner,at(runner,old));const before=run(runner,[b,cmd],'before '+b+' '+cmd)
 const outputFiles=cmd==='agree'?fs.readdirSync(path.join(temp,doc.replace('review-b16/','D2-task-mapping/'))).filter(f=>f.startsWith(b+'-')):[]
 const beforeArtifacts=Object.fromEntries(outputFiles.map(f=>[f,hash(fs.readFileSync(path.join(temp,'docs/research/goal-data-batches/D2-task-mapping',f)))]))
 put(runner,sources[runner]);const after=run(runner,[b,cmd],'after '+b+' '+cmd)
 const artifactsSame=outputFiles.every(f=>beforeArtifacts[f]===hash(fs.readFileSync(path.join(temp,'docs/research/goal-data-batches/D2-task-mapping',f))))
 const same=before.status===after.status&&before.stdout===after.stdout&&before.stderr===after.stderr&&artifactsSame
 check(b+' '+cmd+' unchanged',same,{before_status:before.status,after_status:after.status,artifactsSame});comparisons.push({batch:b,cmd,same,beforeArtifacts})
}
const raw={rev,old,temp,observed_at:new Date().toISOString(),sources,diff,checks,runs,bootstrap,defects,comparisons}
fs.writeFileSync(out+'recheck4.local.json',JSON.stringify(raw,null,2)+'\n')
const failed=checks.filter(c=>!c.pass)
console.log(JSON.stringify({total:checks.length,failed,shipped:32,batches:batches.length,comparisons:comparisons.length,raw:out+'recheck4.local.json'},null,2))
if(failed.length)process.exitCode=1
