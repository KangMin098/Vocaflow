// verification/reviews/T-0066-r1-independent/probe.test.ts
import fs from 'node:fs'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { AUTHORED_SETS, gradeAuthored, learnerView, validateAuthoredSet } from '@/lib/knowledge/authored/authored-items'
const cwd='D:/workspace/Vocaflow-final-product'
const path='apps/web/src/lib/knowledge/authored/e-task-demand.v1.json'
const bytes=fs.readFileSync(`${cwd}/${path}`)
const before=execFileSync('git',['show',`38d4146c4:${path}`],{cwd,encoding:'utf8'})
const current=bytes.toString('utf8'), old=JSON.parse(before)
const set=AUTHORED_SETS.find(s=>s.taskId==='e.task_demand')!
// Independent content judgment, not copied from item.gold: title=operation covering whole text;
// unrelated sentence=whole discourse flow; paragraph order=links among ALL supplied paragraphs.
const expected=[['td-ind-3',1],['td-ind-4',3],['td-transfer-2',2]] as const
describe('T0066 independent content/grading boundary',()=>{
 it('preserves all original six item objects AND literal item-block prefix',()=>{
  expect(set.items.slice(0,6)).toEqual(old.items)
  const key='"items": ['
  const firstSix=before.slice(before.indexOf(key)+key.length,before.lastIndexOf('\n  ]')).trimEnd()
  expect(current.slice(current.indexOf(key)+key.length).startsWith(firstSix)).toBe(true)
 })
 it('valid nine-item set,4 independent checks,2 transfer passages,3 instructional/delayed roles',()=>{
  expect(validateAuthoredSet(set)).toEqual([])
  expect(set.items).toHaveLength(9)
  expect(set.items.filter(i=>i.role==='independent_check')).toHaveLength(4)
  expect(set.items.filter(i=>i.role==='transfer')).toHaveLength(2)
 })
 it('new groups and actual prose are distinct within the17-set corpus',()=>{
  const normalize=(xs:unknown)=>JSON.stringify(xs).toLowerCase().replace(/[^a-z0-9]/g,'')
  const all=AUTHORED_SETS.flatMap(s=>s.items)
  for(const [id] of expected){
   const item=set.items.find(i=>i.id===id)!
   expect(all.filter(i=>i.passageGroup===item.passageGroup)).toHaveLength(1)
   expect(all.filter(i=>normalize(i.body.sentences)===normalize(item.body.sentences))).toHaveLength(1)
  }
 })
 for(const [id,right] of expected) it(`${id}: independently chosen correct operation accepted;all four wrong operations rejected`,()=>{
  const item=set.items.find(i=>i.id===id)!
  for(let choice=0;choice<5;choice++) expect(gradeAuthored(set,item,{choice})?.grade.isCorrect,`${id}:choice${choice}`).toBe(choice===right)
 })
 it('all new items reject malformed/out-of-range responses',()=>{
  for(const [id] of expected){
   const item=set.items.find(i=>i.id===id)!
   for(const response of [{choice:-1},{choice:5},{choice:'1'},{}]) expect(gradeAuthored(set,item,response)).toBeNull()
  }
 })
 it('learner payload does not expose Gold,rationale or correct answer before submission',()=>{
  for(const [id] of expected){
   const item=set.items.find(i=>i.id===id)!
   const view=learnerView(set,item)
   expect(view).not.toHaveProperty('gold');expect(view).not.toHaveProperty('answer')
   expect(JSON.stringify(view)).not.toContain((item.gold as {rationale:string}).rationale)
  }
 })
 it('current exact bytes bind ledger hash; human Gold/rights remain pending',()=>{
  expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe('8a91033b38d9ee68108a02422aff00790f0c21b5428facb4c56a2fa78c068bda')
  expect(set.provenance.humanGold).toMatch(/^pending/)
  expect(set.provenance.rights).toMatch(/^pending/)
 })
})
