// verification/reviews/FINAL-MAIN-65c8ef6ae/receipt-update.mjs
import fs from 'node:fs';import {loadState} from '../../../lib/state.mjs';
const s=loadState().state;const t=s.taskQueue.tasks.find(x=>x.task_id==='T-0073');
const p='verification/reviews/FINAL-MAIN-65c8ef6ae/handoff-receipt.json';const r=JSON.parse(fs.readFileSync(p,'utf8'));
Object.assign(r,{status:t.status,acknowledged:!!t.dispatch?.accepted_at,accepted_at:t.dispatch?.accepted_at,accepted_session:t.dispatch?.accepted_session,implementation_started:t.status==='IN_PROGRESS',run:t.run,result_returned:t.status==='REVIEW',queue_to_ack_ms:Date.parse(t.dispatch.accepted_at)-Date.parse(t.created_at),recorded_at:new Date().toISOString()});fs.writeFileSync(p,JSON.stringify(r,null,2)+'\n');console.log({status:r.status,ack:r.acknowledged,start:r.implementation_started,pid:r.run?.pid,queue_to_ack_ms:r.queue_to_ack_ms});
