// verification/reviews/T-0045-integration-20261021/prepare-pr250.mjs
// Read-only remote metadata and exact reviewed paths. Does not merge or touch product files.
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const cwd='D:/workspace/Vocaflow-csat-v32-mywords'
const gh=args=>execFileSync('gh',args,{cwd,encoding:'utf8'})
const before=JSON.parse(gh(['api','repos/KangMin098/Vocaflow/pulls/250']))
const files=JSON.parse(gh(['api','--paginate','--slurp','repos/KangMin098/Vocaflow/pulls/250/files?per_page=100'])).flat()
const after=JSON.parse(gh(['api','repos/KangMin098/Vocaflow/pulls/250']))
if(before.head.sha!==after.head.sha||before.base.sha!==after.base.sha||after.head.sha!=='aab0c918c13a1b8aa375fd2dcbdc314a5314b026'||after.base.sha!=='0c8e0274d62e642c7d480ef5bae0f3cba642b00a'||files.length!==after.changed_files||files.length!==124)throw Error('PR scope drift/incomplete file list')
const scope={version:1,head_sha:after.head.sha,base_ref:'main',base_sha:after.base.sha,expected_commits:after.commits,expected_paths:files.map(f=>f.filename).sort()}
fs.writeFileSync(new URL('./pr250-scope.json',import.meta.url),JSON.stringify(scope,null,2)+'\n')
const rec={recorded_at:new Date().toISOString(),pr:250,head:scope.head_sha,base:scope.base_sha,commits:scope.expected_commits,files:files.length,scope:'Full pagination and double metadata read; reviewed old product bytes with approved-main-only merge',db_read:{version:'20261014091841',statements_sha256:'bb4cc88d0ac62855908d610c9bdc394d60db22d61eadc04b218e05bfa367a089',method:'Supabase execute_sql SELECT only, fresh independent read'},dirty_audit_outputs:'Foreign uncommitted results preserved; remote committed tree is merge target, not local dirty files'}
fs.writeFileSync(new URL('./pr250-preparation.json',import.meta.url),JSON.stringify(rec,null,2)+'\n')
console.log(JSON.stringify(rec))
