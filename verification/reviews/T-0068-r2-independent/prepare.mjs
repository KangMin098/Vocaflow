// verification/reviews/T-0068-r2-independent/prepare.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
const root='D:/workspace/Vocaflow-AI-Control',dir=path.join(root,'verification/reviews/T-0068-r2-independent')
const cp=(...args)=>execFileSync('gh',args,{encoding:'utf8',maxBuffer:64*1024*1024})
const task=JSON.parse(execFileSync(process.execPath,['bin/vfc.mjs','task','show','T-0068'],{cwd:root,encoding:'utf8'}))
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.isAbsolute(p)?p:path.join(root,p))).digest('hex')
const artifacts=task.evidence.map(e=>({id:e.evidence_id,head:e.commit,type:e.type,path:e.artifact_path_or_url,expected:e.artifact_sha256,actual:hash(e.artifact_path_or_url)}))
const ui=task.evidence.find(e=>e.type==='ui')
const expectedCaptures=new Map(ui.screenshots_sha256.map(e=>[e.path,e.sha256]))
const captures=ui.screenshots.map(p=>({path:p,expected:expectedCaptures.get(p),actual:hash(p)}))
if(artifacts.some(e=>e.expected!==e.actual)||captures.some(e=>e.expected!==e.actual))throw Error('Artifact hash mismatch')
fs.writeFileSync(path.join(dir,'artifact-check.json'),JSON.stringify({recorded_at:new Date().toISOString(),artifacts,captures},null,2)+'\n')
const runs=[]
for(const run of ['39468609541','39470298963']){
 const meta=JSON.parse(cp('run','view',run,'--repo','KangMin098/Vocaflow','--json','headSha,event,status,conclusion,jobs,attempt'))
 const job=meta.jobs.find(j=>j.name==='e2e')
 const log=cp('run','view',run,'--repo','KangMin098/Vocaflow','--job',String(job.databaseId),'--log')
 const selected=log.split(/\r?\n/).filter(l=>/authored-format-cycle\.isolated\.spec|\d+ passed|\d+ failed|Error:|422|order|PLAN.*\b/.test(l))
 runs.push({run,head:meta.headSha,event:meta.event,attempt:meta.attempt,status:meta.status,conclusion:meta.conclusion,jobs:meta.jobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion})),selected_log:selected})
}
fs.writeFileSync(path.join(dir,'ci-inspection.json'),JSON.stringify({recorded_at:new Date().toISOString(),runs},null,2)+'\n')
let probe=fs.readFileSync(path.join(root,'verification/reviews/T-0068-r1-independent/probe.test.ts'),'utf8').replace('T-0068-r1-independent/probe.test.ts','T-0068-r2-independent/probe.test.ts').replace("head='8ec7d978d94217fd2a85c5b95e16e86eb5e13111'","head='d2f340cba90387931fcaf66bf579c081c21cf861'")
const cut=probe.indexOf(" it('first gs-ind-3 failure")
if(cut<0)throw Error('Original probe anchor missing')
probe=probe.slice(0,cut)+` it('P1-1 fixed: unique missing passive auxiliary, aligned mark/correction/voice explanation',()=>{
  const s=sets.find(x=>x.s.taskId==='s.form_scope')!.s,item=s.items.find(i=>i.id==='gs-ind-3')!
  expect((item.body.sentences as string[])[2]).toContain('have abandoned by owners')
  expect((item.body.marks as any[])[2].text).toBe('have abandoned')
  expect(item.gold).toMatchObject({answer:2,reason:'voice',correction:'have been abandoned'})
  expect(FORMAT_SPECS.form_scope.grade(item.body,item.gold,{choice:2,reason:'voice'},'v1')?.grade.isCorrect).toBe(true)
  expect(FORMAT_SPECS.form_scope.grade(item.body,item.gold,{choice:2,reason:'agreement'},'v1')?.grade.isCorrect).toBe(false)
 })
 it('P1-2 fixed: truthful yeast quantity, matching segment, correct main verb unchanged',()=>{
  const s=sets.find(x=>x.s.taskId==='s.sentence_core')!.s,item=s.items.find(i=>i.id==='sc-transfer-2')!
  expect((item.body.sentences as string[])[2]).toContain('takes less yeast')
  expect((item.body.segments as string[])[3]).toBe('takes less yeast')
  expect(item.gold).toMatchObject({answer:3,reason:'main_verb'})
  expect((item.body.sentences as string[])[3]).toContain('rose too fast and then collapsed')
 })
 it('P2 empirical framing corrected without changing role or relation answers',()=>{
  const df=sets.find(x=>x.s.taskId==='r.discourse_function')!.s.items.find(i=>i.id==='df-ind-4')!
  const rel=sets.find(x=>x.s.taskId==='r.relation')!.s.items.find(i=>i.id==='rel-ind-4')!
  expect((df.body.sentences as string[])[4]).toMatch(/^Imagine /)
  expect((rel.body.sentences as string[])[2]).toContain('imagined team')
 })
})
`
fs.writeFileSync(path.join(dir,'probe.test.ts'),probe)
fs.writeFileSync(path.join(dir,'probe.config.mjs'),`// verification/reviews/T-0068-r2-independent/probe.config.mjs
export default {root:'${dir.replaceAll('\\','/')}',resolve:{alias:{'@':'D:/workspace/Vocaflow-final-product/apps/web/src'}},test:{include:['probe.test.ts'],environment:'node',globals:false}}
`)
console.log(JSON.stringify({artifacts:artifacts.length,captures:captures.length,runs:runs.map(r=>({id:r.run,head:r.head,result:r.conclusion,log:r.selected_log.slice(-8)}))},null,2))
