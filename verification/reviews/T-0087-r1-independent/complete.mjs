import fs from 'node:fs'
import {withState} from '../../../lib/state.mjs'
import {addEvidence,completeTask} from '../../../lib/tasks.mjs'
import {staticGates,defaultGit} from '../../../lib/localgate.mjs'
const caller='final-independent-accept',dir='verification/reviews/T-0087-r1-independent/',head='1607faebb096a4a361347f9cd80a45f23d0457a2'
const ev={type:'review',result:'pass',skip_count:0,observed_at:new Date().toISOString(),commit:head,covers:[0,1,2,3,4],artifact_path_or_url:dir+'ACCEPT.md',command_or_protocol:'Independent full packet read plus node verify.mjs: 8 items, 16 exact body/Gold hash bindings, all displayed fields and numbering, pending approval boundaries. Docs only; no product tests required.'}
console.log(withState(s=>addEvidence(s,'T-0087',ev,{caller}),{event:'evidence.add',task:'T-0087',by:caller}).evidence_id)
const t=withState(s=>completeTask(s,'T-0087',{caller,review_path:dir+'ACCEPT.md'}),{event:'task.complete',task:'T-0087',by:caller})
const gates=staticGates({task:t,head,base:'d726c5d07234a0dfb2d3b1dfa0e827b14d7adb77',git:defaultGit(t.worktree),reviewRoot:process.cwd()})
fs.writeFileSync(dir+'static-gates.json',JSON.stringify(gates,null,2)+'\n');console.log(JSON.stringify({task:t.task_id,status:t.status,gates},null,2))
