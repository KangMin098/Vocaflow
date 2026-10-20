// verification/reviews/T-0069-final-independent/inspect.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
const root='D:/workspace/Vocaflow-AI-Control',dir=path.join(root,'verification/reviews/T-0069-final-independent')
const cli=(...a)=>execFileSync('gh',a,{encoding:'utf8',maxBuffer:64*1024*1024})
const task=JSON.parse(execFileSync(process.execPath,['bin/vfc.mjs','task','show','T-0069'],{cwd:root,encoding:'utf8'}))
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.isAbsolute(p)?p:path.join(root,p))).digest('hex')
const artifacts=task.evidence.map(e=>({id:e.evidence_id,head:e.commit,type:e.type,path:e.artifact_path_or_url,expected:e.artifact_sha256,actual:hash(e.artifact_path_or_url)}))
const ui=task.evidence.find(e=>e.type==='ui'),expected=new Map(ui.screenshots_sha256.map(e=>[e.path,e.sha256]))
const captures=ui.screenshots.map(p=>({path:p,expected:expected.get(p),actual:hash(p)}))
if(artifacts.some(e=>e.expected!==e.actual)||captures.some(e=>e.expected!==e.actual))throw Error('Artifact hash mismatch')
const runs=[]
for(const attempt of [1,2]){
 const meta=JSON.parse(cli('run','view','39477451406','--attempt',String(attempt),'--repo','KangMin098/Vocaflow','--json','headSha,event,status,conclusion,jobs,attempt'))
 const job=meta.jobs.find(j=>j.name==='e2e')
 const log=cli('run','view','39477451406','--attempt',String(attempt),'--job',String(job.databaseId),'--repo','KangMin098/Vocaflow','--log')
 const selected=log.split(/\r?\n/).filter(l=>/vocab-core-roundtrip\.isolated\.spec|authored-format-cycle\.isolated\.spec|\d+ passed|\d+ failed|Error:|ECONNRESET|socket hang up/.test(l))
 runs.push({attempt,head:meta.headSha,event:meta.event,status:meta.status,conclusion:meta.conclusion,jobs:meta.jobs.map(j=>({name:j.name,result:j.conclusion})),selected_log:selected})
}
fs.writeFileSync(path.join(dir,'artifacts.json'),JSON.stringify({recorded_at:new Date().toISOString(),artifacts,captures},null,2)+'\n')
fs.writeFileSync(path.join(dir,'ci-inspection.json'),JSON.stringify({recorded_at:new Date().toISOString(),run:'39477451406',runs},null,2)+'\n')
const meta=()=>JSON.parse(cli('api','repos/KangMin098/Vocaflow/pulls/325')),a=meta()
const files=JSON.parse(cli('api','--paginate','--slurp','repos/KangMin098/Vocaflow/pulls/325/files?per_page=100')).flat(),b=meta()
const head='a14ab5ecdc86baeec84d076f789386985ee0c36f',base='25566801020cc40ed6cd5d3b2bf45615b023989d'
const local=execFileSync('git',['diff','--name-only',base,head],{cwd:'D:/workspace/Vocaflow-final-product',encoding:'utf8'}).trim().split('\n').sort(),remote=files.map(f=>f.filename).sort()
if(a.head.sha!==head||b.head.sha!==head||a.base.sha!==base||b.base.sha!==base||files.length!==a.changed_files||files.length!==b.changed_files||b.commits!==1||JSON.stringify(local)!==JSON.stringify(remote))throw Error('Incomplete or moving scope')
fs.writeFileSync(path.join(dir,'pr325-scope.json'),JSON.stringify({version:1,head_sha:head,base_ref:'main',base_sha:base,expected_commits:b.commits,expected_paths:remote},null,2)+'\n')
fs.writeFileSync(path.join(dir,'scope-receipt.json'),JSON.stringify({recorded_at:new Date().toISOString(),head,base,files:files.length,commits:b.commits,full_pagination:true,double_metadata_stable:true,local_remote_equal:true},null,2)+'\n')
console.log(JSON.stringify({artifacts:artifacts.length,captures:captures.length,files:files.length,commits:b.commits,runs:runs.map(r=>({attempt:r.attempt,head:r.head,result:r.conclusion,summary:r.selected_log.filter(l=>/\d+ passed|\d+ failed|ECONNRESET/.test(l))}))},null,2))
