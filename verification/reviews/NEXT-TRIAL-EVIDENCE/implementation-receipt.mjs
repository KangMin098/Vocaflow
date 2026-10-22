import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {loadState} from '../../../lib/state.mjs'
const {state}=loadState()
const t=state.taskQueue.tasks.find(t=>t.task_id==='T-0085')
if(t.status!=='IN_PROGRESS'||t.run?.session!=='c513ff5b-86ef-44a3-8efd-7925a229614b'||t.run?.pid!==13384)throw new Error('No matching actual implementation run')
const inbox=fs.readFileSync('planning/inbox/final-product.md','utf8')
if(!inbox.includes('2026-10-22T08:43:48.000Z · T-0085 · ACKNOWLEDGED'))throw new Error('Actual owner ACK missing')
const receipt={observed_at:new Date().toISOString(),task_id:t.task_id,revision:'rev1',design_id:t.source.design_id,owner:t.owner_id,status:t.status,delivery:'ACKNOWLEDGED',implementation_started:true,actual_session:t.run.session,actual_pid:t.run.pid,started_at:t.run.started_at,start_head:t.run.start_head,worktree:t.worktree,ack:'planning/inbox/final-product.md:2026-10-22T08:43:48.000Z',process_and_worktree_lock:'Get-Process pid13384 alive + source lock.mjs status claude pid13384 observed',result_returned:false,db_writes:0,new_worker_or_session:false,queue_to_actual_start_ms:Date.parse(t.run.started_at)-Date.parse(t.created_at)}
fs.writeFileSync(new URL('./implementation-receipt.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n')
execFileSync('git',['add','--intent-to-add','--','verification/reviews/NEXT-TRIAL-EVIDENCE/implementation-receipt.mjs','verification/reviews/NEXT-TRIAL-EVIDENCE/implementation-receipt.json'],{stdio:'inherit'})
execFileSync('git',['commit','--only','verification/reviews/NEXT-TRIAL-EVIDENCE/implementation-receipt.mjs','verification/reviews/NEXT-TRIAL-EVIDENCE/implementation-receipt.json','-m','review: confirm actual trial evidence task handoff','-m','Bind owner ACK, live process and official implementation run to T-0085.\nDo not equate queued files or schedules with execution.\n\nCo-Authored-By: Codex <noreply@openai.com>'],{stdio:'inherit'})
console.log(JSON.stringify(receipt,null,2))
