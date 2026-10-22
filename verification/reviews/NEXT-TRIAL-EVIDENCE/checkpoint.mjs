import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {loadState} from '../../../lib/state.mjs'
import {loadCriteria} from '../../../lib/goals.mjs'
const {state:s}=loadState()
const out={at:new Date().toISOString(),main:execFileSync('git',['-C','D:/workspace/Vocaflow-main-serving','rev-parse','HEAD'],{encoding:'utf8'}).trim(),completed:s.taskQueue.tasks.filter(t=>t.task_id==='T-0084').map(t=>({id:t.task_id,status:t.status,commit:t.verified_commit})),goals:loadCriteria().criteria.filter(c=>['VG-L3-D1-02','VG-L3-D3-02'].includes(c.id)),overlapping:s.taskQueue.tasks.filter(t=>['READY','IN_PROGRESS','REVIEW','BLOCKED'].includes(t.status)&&t.allowed_paths.some(p=>p.includes('knowledge'))).map(t=>({id:t.task_id,owner:t.owner_id,status:t.status,goal:t.goal_id,title:t.title})),owner:s.ownership.owners['final-product'].current_session}
fs.writeFileSync(new URL('./checkpoint.json',import.meta.url),JSON.stringify(out,null,2)+'\n')
console.log(JSON.stringify(out,null,2))
