// verification/reviews/T-0068-r1-independent/probe.test.ts
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { gradeAuthored, learnerView, validateAuthoredSet, type AuthoredSet } from '@/lib/knowledge/authored/authored-items'
import { FORMAT_SPECS, SEGMENT_REASONS } from '@/lib/knowledge/authored/formats'
import { nextActionOf } from '@/lib/csat/map/v62/next-action'
import { ranksOf } from '@/lib/csat/map/v62/rank'

const cwd='D:/workspace/Vocaflow-final-product', head='8ec7d978d94217fd2a85c5b95e16e86eb5e13111', base='9ba70cfcca6fb197b8e9fa966a19c1812835c52f'
const git=(...args:string[])=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024})
const paths=git('diff','--name-only',base,head).trim().split('\n').filter(p=>/^apps\/web\/src\/lib\/knowledge\/authored\/.*\.json$/.test(p))
const read=(rev:string,p:string)=>git('show',`${rev}:${p}`)
const sets=paths.map(p=>({p,before:read(base,p),bytes:read(head,p),s:JSON.parse(read(head,p)) as AuthoredSet}))
const allPaths=git('ls-tree','-r','--name-only',head,'apps/web/src/lib/knowledge/authored').trim().split('\n').filter(p=>p.endsWith('.v1.json'))
const corpus=allPaths.flatMap(p=>(JSON.parse(read(head,p)) as AuthoredSet).items)
const newItems=sets.flatMap(x=>x.s.items.slice(6))
const choose:Record<string,number>={ 'opt-ind-3':2,'opt-ind-4':4,'opt-transfer-2':3,'inf-ind-3':2,'inf-ind-4':1,'inf-transfer-2':4,'ref-ind-3':1,'ref-ind-4':3,'ref-transfer-2':4,'cb-ind-3':1,'cb-ind-4':3,'cb-transfer-2':2,'gs-ind-4':4,'gs-transfer-2':3,'sc-ind-3':4,'sc-ind-4':1,'sc-transfer-2':3,'sr-ind-3':4,'sr-ind-4':3,'sr-transfer-2':1,'vcs-ind-3':1,'vcs-ind-4':3,'vcs-transfer-2':0,'mw-ind-3':1,'mw-ind-4':3,'mw-transfer-2':0 }

describe('T0068 exact submitted content and grading boundaries',()=>{
 it('exact13sets/39appended items; no engine,canon,SQL or old completed set changes',()=>{
  expect(sets).toHaveLength(13); expect(newItems).toHaveLength(39)
  const changed=git('diff','--name-only',base,head).trim().split('\n')
  expect(changed).toHaveLength(19)
  expect(changed.filter(p=>/supabase|\.sql$|map\/v4|authored\/formats\.ts|workspaces\.json/.test(p))).toEqual([])
  expect(paths.some(p=>/attachment|central-meaning|evidence-location|task-demand/.test(p))).toBe(false)
 })
 for(const {p,before,bytes,s} of sets) describe(s.taskId,()=>{
  it('original six objects and literal item prefix preserved; four check/two transfer; validation and pending human approvals',()=>{
   const old=JSON.parse(before);expect(s.items.slice(0,6)).toEqual(old.items)
   const key='"items": [';const prefix=before.slice(before.indexOf(key)+key.length,before.lastIndexOf('\n  ]')).trimEnd()
   expect(bytes.slice(bytes.indexOf(key)+key.length).startsWith(prefix)).toBe(true)
   expect(s.items).toHaveLength(9);expect(s.items.filter(i=>i.role==='independent_check')).toHaveLength(4);expect(s.items.filter(i=>i.role==='transfer')).toHaveLength(2)
   expect(validateAuthoredSet(s)).toEqual([]);expect(s.provenance.humanGold).toMatch(/^pending/);expect(s.provenance.rights).toMatch(/^pending/)
   const approval=read(head,'docs/final/APPROVAL_PACKAGE.md');expect(approval).toContain(crypto.createHash('sha256').update(bytes).digest('hex'))
  })
  for(const item of s.items.slice(6)) it(`${item.id}: unique actual prose/group, no Gold leak; independently selected answer`,()=>{
   expect(corpus.filter(i=>i.passageGroup===item.passageGroup)).toHaveLength(1)
   const text=(x:typeof item)=>JSON.stringify(x.body.sentences).toLowerCase().replace(/[^a-z0-9]/g,'')
   expect(corpus.filter(i=>text(i)===text(item))).toHaveLength(1)
   const view=learnerView(s,item);expect(view).not.toHaveProperty('gold');expect(view).not.toHaveProperty('answer')
   if(item.id in choose) expect((item.gold as {answer:number}).answer).toBe(choose[item.id])
   if(s.format==='segment_choice'){
    const g=item.gold as {answer:number;reason:string;reasonAlternatives?:{reason:string}[]}
    expect(gradeAuthored(s,item,{choice:g.answer,reason:g.reason})?.grade.isCorrect).toBe(true)
    for(const alt of g.reasonAlternatives??[]) expect(gradeAuthored(s,item,{choice:g.answer,reason:alt.reason})?.grade.isCorrect).toBe(true)
    const allowed=new Set([g.reason,...(g.reasonAlternatives??[]).map(a=>a.reason)])
    for(const r of SEGMENT_REASONS.filter(r=>!allowed.has(r))) expect(gradeAuthored(s,item,{choice:g.answer,reason:r})?.grade.isCorrect).toBe(false)
    for(let choice=0;choice<(item.body.segments as string[]).length;choice++) if(choice!==g.answer) expect(gradeAuthored(s,item,{choice,reason:g.reason})?.grade.isCorrect).toBe(false)
   }
  })
 })
 it('no_content does not block saved learner supply: ranks content_gap then supply CTA',()=>{
  const task='r.inference',ws='ws.inference'
  const p={task,name:'inference',stage:'transfer',next:null,unresolved:['no_content'],quantity:{unit:'지문',planned:null,done:0},criterion:'criterion',evidence:'verified_need'}
  const n={task,type:'GAP',evidence:'verified_need',relevance:{items:1,pointsPerExam:2}}
  const view={asIs:{tasks:{}},toBe:{needs:[n],relevanceUnknown:[]},taskPlans:[p],plans:{[ws]:{core:[task],tasks:[p]}}} as any
  const ranks=ranksOf(view);expect(ranks.notActionable).toEqual([{task,reason:'content_gap'}])
  expect(nextActionOf(view,ranks,{byTemplate:{[ws]:{}},status:'ok'} as any)).toMatchObject({task,ws,kind:'supply',blocked:'content_gap'})
 })
 it('first gs-ind-3 failure is a semantic Gold defect, not an adapter or format validation error',()=>{
  const s=sets.find(x=>x.s.taskId==='s.form_scope')!.s,item=s.items.find(i=>i.id==='gs-ind-3')!
  expect((item.body.sentences as string[])[2]).toContain('need to be walking every day')
  expect(FORMAT_SPECS.form_scope.grade(item.body,item.gold,{choice:2,reason:'voice'},'v1')?.grade.isCorrect).toBe(true)
  // Both active walking and passive being walked are possible; the desired passive meaning is not mandatory grammar.
 })
})
