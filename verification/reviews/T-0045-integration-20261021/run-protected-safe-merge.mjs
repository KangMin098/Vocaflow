// verification/reviews/T-0045-integration-20261021/run-protected-safe-merge.mjs
// Run the existing policy-protected tool. No injected approval/hash or alternate merge path.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'
const cwd='D:/workspace/Vocaflow-csat-v32-mywords'
const require=createRequire(path.join(cwd,'apps/web/package.json'))
const parse=require('dotenv').parse
const env={...process.env,VFC_DEV_MODE:'GITHUB'}
// Existing task-authorized local credentials only, never printed or written.
if(!env.SUPABASE_ACCESS_TOKEN){
 for(const file of [path.join(cwd,'apps/web/.env.local'),'D:/workspace/Vocaflow/apps/web/.env.local','D:/workspace/Vocaflow-final-independent/apps/web/.env.local']){
  if(!fs.existsSync(file))continue
  const token=parse(fs.readFileSync(file)).SUPABASE_ACCESS_TOKEN
  if(token){env.SUPABASE_ACCESS_TOKEN=token;break}
 }
}
if(!env.SUPABASE_ACCESS_TOKEN){
 const file=path.join(os.homedir(),'.supabase','access-token')
 if(fs.existsSync(file)){const token=fs.readFileSync(file,'utf8').trim();if(/^sbp_[A-Za-z0-9_-]+$/.test(token))env.SUPABASE_ACCESS_TOKEN=token}
}
const n=process.argv[2]??'250',scope=process.argv[3]??new URL('./pr250-scope.json',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')
const dry=process.argv.includes('--dry-run')
const result=spawnSync(process.execPath,['agents/scripts/safe-merge.mjs',n,'--scope-file',scope,...(dry?['--dry-run']:[])],{cwd,env,encoding:'utf8',timeout:180000,windowsHide:true})
process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'')
if(result.error)console.error(result.error.message)
process.exit(result.status??1)
