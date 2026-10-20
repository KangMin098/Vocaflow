// verification/reviews/T-0063-r1-independent-probe/inspect.mjs
import fs from 'node:fs'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {loadState} from '../../../lib/state.mjs'
const t=loadState().state.taskQueue.tasks.find(x=>x.task_id==='T-0063')
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const evidence=(t.evidence??[]).map(e=>({id:e.evidence_id,type:e.type,commit:e.commit,artifact:e.artifact_path_or_url,expected:e.artifact_sha256,actual:e.artifact_path_or_url&&fs.existsSync(e.artifact_path_or_url)?hash(e.artifact_path_or_url):null,screenCount:e.screenshots_sha256?.length,screensMatch:e.screenshots_sha256?.every(s=>hash(s.path)===s.sha256)}))
const ci=JSON.parse(fs.readFileSync(new URL('./inspection.json',import.meta.url),'utf8')).ci
const receipt={observed_at:new Date().toISOString(),status:t.status,run:t.run,role_assignment:t.role_assignment,evidence,ci:{...ci,jobs:ci.jobs.map(j=>({name:j.name,conclusion:j.conclusion}))}}
fs.writeFileSync(new URL('./inspection.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify(receipt,null,2))
