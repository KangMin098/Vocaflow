// verification/reviews/T-0068-r2-independent/scope.mjs
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
const gh=(...a)=>execFileSync('gh',a,{encoding:'utf8',maxBuffer:16*1024*1024})
const meta=()=>JSON.parse(gh('api','repos/KangMin098/Vocaflow/pulls/324'))
const a=meta()
const files=JSON.parse(gh('api','--paginate','--slurp','repos/KangMin098/Vocaflow/pulls/324/files?per_page=100')).flat()
const b=meta()
const head='d2f340cba90387931fcaf66bf579c081c21cf861',base='9ba70cfcca6fb197b8e9fa966a19c1812835c52f'
if(a.head.sha!==head||b.head.sha!==head||a.base.sha!==base||b.base.sha!==base||files.length!==a.changed_files||files.length!==b.changed_files||b.commits!==3)throw Error('PR scope moved or incomplete')
const local=execFileSync('git',['diff','--name-only',base,head],{cwd:'D:/workspace/Vocaflow-final-product',encoding:'utf8'}).trim().split('\n').sort()
const remote=files.map(f=>f.filename).sort()
if(JSON.stringify(local)!==JSON.stringify(remote))throw Error('Local/remote scope differs')
const dir='verification/reviews/T-0068-r2-independent/'
fs.writeFileSync(dir+'pr324-scope.json',JSON.stringify({version:1,head_sha:head,base_ref:'main',base_sha:base,expected_commits:b.commits,expected_paths:remote},null,2)+'\n')
fs.writeFileSync(dir+'scope-receipt.json',JSON.stringify({recorded_at:new Date().toISOString(),head,base,files:files.length,commits:b.commits,scope_stable:true,full_pagination:true,local_remote_equal:true,reported_file_count:21,corrected_file_count:files.length,state:b.state,mergeable:b.mergeable},null,2)+'\n')
console.log(JSON.stringify({head,base,files:files.length,commits:b.commits}))
