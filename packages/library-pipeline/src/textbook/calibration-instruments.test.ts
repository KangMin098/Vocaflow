// packages/library-pipeline/src/textbook/calibration-instruments.test.ts
// Content binding tests; temporary export evidence is synthetic and is never human-study data.
import {describe,it,expect} from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
import {measurementItemSchema} from './educational-validation'
import {bundleV2Schema} from './educational-validation-v2'
import {researchBodyHash} from '../ingest-article/research-origin'
const repo=fileURLToPath(new URL('../../../..',import.meta.url)),dir=path.join(repo,'scripts/textbook')
const read=(name:string)=>fs.readFileSync(path.join(dir,name),'utf8')
const pilotRaw=read('frym-precision/adaptation-pilot-1.json'),pilot=JSON.parse(pilotRaw)
const packRaw=read('frym-validation/calibration-instruments-3.draft.json'),pack=JSON.parse(packRaw)
const audit=JSON.parse(read('frym-validation/calibration-instrument-audit-3.json'))
describe('calibration revision 3 content bindings',()=>{
 it('covers every actual passage and exactly three grounded items per axis',()=>{
  expect(Object.keys(pack).sort()).toEqual(pilot.records.map((r:any)=>r.id).sort())
  let count=0
  for(const r of pilot.records){const items=pack[r.id].map((i:any)=>measurementItemSchema.parse(i));expect(items).toEqual(pack[r.id]);expect(items).toHaveLength(12);expect(new Set(items.map((i:any)=>i.id)).size).toBe(12);for(const axis of ['lexical','syntax','reasoning','comprehension'])expect(items.filter((i:any)=>i.axis===axis)).toHaveLength(3);for(const i of items){expect(r.text.includes(i.source_quote),r.id+' '+i.id).toBe(true);expect(i.source_quote).not.toBe(r.text);expect(i.prompt).toMatch(/[가-힣]/);expect(i.scoring_rubric).toContain('1점:');expect(i.scoring_rubric).toContain('0.5점:');expect(i.scoring_rubric).toContain('0점:');expect(i.scoring_rubric).toContain('무응답은 null');if(i.axis==='lexical'){const target=i.prompt.match(/이 글에서 (.+?)가 뜻하는/)[1];expect(i.source_quote.toLowerCase(),r.id+' '+i.id).toContain(target.toLowerCase())}}count+=items.length}
  expect(count).toBe(96)
 })
 it('binds the complete old-to-new item audit to the exact pilot and instrument files',()=>{
  expect(audit.pilot_sha256).toBe(researchBodyHash(pilotRaw));expect(audit.revised_instruments_sha256).toBe(researchBodyHash(packRaw));expect(audit.entries).toHaveLength(96);expect(new Set(audit.entries.map((a:any)=>a.record_id+':'+a.item_id)).size).toBe(96)
  for(const a of audit.entries){const revised=pack[a.record_id].find((i:any)=>i.id===a.item_id);expect([a.revised_prompt,a.revised_source_quote,a.revised_scoring_rubric]).toEqual([revised.prompt,revised.source_quote,revised.scoring_rubric]);expect(a.review_status).toBe('agent_draft_review_requires_human_confirmation')}
  expect(audit.actual_expert_reviews).toBe(0);expect(audit.actual_student_sessions).toBe(0)
 })
 it('does not require invisible sweets or an unstated review definition as a retrieval answer',()=>{
  const packetItem=pack['F02-high1'].find((i:any)=>i.id==='C2');expect(packetItem.scoring_rubric).toContain('사탕 내용물은 요구하지 않음')
  expect(pack['F06-middle1'].find((i:any)=>i.id==='L3').prompt).toContain('can')
  expect(pack['F06-middle1'].find((i:any)=>i.id==='L3').scoring_rubric).toContain('할 수 있다만 써도 인정')
  expect(pack['F14-high1'].find((i:any)=>i.id==='C3').source_quote).toContain('survey reports of symptoms')
  expect(pack['F14-middle1'].find((i:any)=>i.id==='S2').prompt).toContain('주절에서 비교하는 연관')
  expect(pack['F14-high1'].find((i:any)=>i.id==='C3').scoring_rubric).toContain('집단만 맞으므로 0.5점')
  expect(pack['F18-middle1'].find((i:any)=>i.id==='C2').scoring_rubric).toContain('행동만 맞으므로 0.5점')
  for(const id of Object.keys(pack)){const rubrics=pack[id].filter((i:any)=>i.axis==='reasoning').map((i:any)=>i.scoring_rubric);expect(new Set(rubrics).size).toBe(3)}
 })
 it('exports the explicit revised pack into eight unsealed v2 packets without rubric leakage',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fym-calibration-pack-test-'))
  try{
   const round=JSON.parse(read('frym-precision/round-1.json')),rules=JSON.parse(read('frym-precision/preservation-rules-1.json')),draftPilot=JSON.parse(pilotRaw)
   for(const e of rules.entries){const p=round.pairs.find((p:any)=>p.id===e.pair_id),fym='Synthetic source evidence for '+e.pair_id+'.',research='Synthetic research evidence for '+e.pair_id+'.';p.source.source_hash=researchBodyHash(fym);p.research.hash=researchBodyHash(research);p.files.fym=e.pair_id+'-fym.txt';p.files.research=e.pair_id+'-research.txt';p.reviewed_spans={fym:[{start:0,end:fym.length,section:'synthetic'}],research:[{start:0,end:research.length,section:'synthetic'}]};for(const a of p.alignments){a.fym_evidence={start:0,end:fym.length,section:'synthetic',quote:fym};a.original_evidence={start:0,end:research.length,section:'synthetic',quote:research};a.omitted_detail=null}e.source_hash=p.source.source_hash;e.research_hash=p.research.hash;e.source_quote=fym;e.research_quote=research;fs.writeFileSync(path.join(temp,p.files.fym),fym);fs.writeFileSync(path.join(temp,p.files.research),research)}
   const roundRaw=JSON.stringify(round);rules.review_hash=researchBodyHash(roundRaw);const rulesRaw=JSON.stringify(rules);draftPilot.review_hash=rules.review_hash;draftPilot.rules_hash=researchBodyHash(rulesRaw)
   for(const [name,raw] of Object.entries({round:roundRaw,rules:rulesRaw,pilot:JSON.stringify(draftPilot)}))fs.writeFileSync(path.join(temp,name+'.json'),raw)
   const output=path.join(temp,'output'),args=['--tsconfig',path.join(repo,'apps/web/tsconfig.json'),path.join(dir,'frym-validation-export.mjs'),'--pilot',path.join(temp,'pilot.json'),'--preservation-rules',path.join(temp,'rules.json'),'--precision-review',path.join(temp,'round.json'),'--protocol',path.join(dir,'frym-validation/protocol-2.draft.json'),'--instruments',path.join(dir,'frym-validation/calibration-instruments-3.draft.json'),'--study-id','synthetic-calibration-pack','--evidence-dir',temp,'--output',output]
   execFileSync(process.execPath,[createRequire(import.meta.url).resolve('tsx/cli'),...args],{cwd:repo,windowsHide:true})
   const b=bundleV2Schema.parse(JSON.parse(fs.readFileSync(path.join(output,'coordinator/results.json'),'utf8')));expect(b.protocol_approval).toBeNull();expect(b.records).toHaveLength(8);expect(b.records.reduce((n,r)=>n+r.instrument.length,0)).toBe(96)
   for(const r of b.records){expect(r.instrument).toEqual(pack[r.id]);for(const axis of ['lexical','syntax','reasoning','comprehension'])expect(r.instrument.filter(i=>i.axis===axis)).toHaveLength(3);const s=JSON.parse(fs.readFileSync(path.join(output,'student',r.blind_item_id+'.json'),'utf8')),e=JSON.parse(fs.readFileSync(path.join(output,'expert',r.blind_item_id+'.json'),'utf8'));expect(s.payload.instructions).toContain('질문을 보기 전에');expect(s.payload.questions).toHaveLength(12);expect(s.payload.questions.map((q:any)=>q.axis)).toEqual(['reasoning','reasoning','reasoning','comprehension','comprehension','comprehension','lexical','lexical','lexical','syntax','syntax','syntax']);for(const q of s.payload.questions)expect(Object.keys(q).sort()).toEqual(['axis','id','prompt']);expect(e.payload).not.toHaveProperty('grade');expect(e.payload).not.toHaveProperty('questions');expect(r.student_sessions).toEqual([]);expect(r.expert_reviews).toEqual([])}
   expect(()=>execFileSync(process.execPath,[createRequire(import.meta.url).resolve('tsx/cli'),...args],{cwd:repo,windowsHide:true,stdio:'pipe'})).toThrow()
  }finally{if(path.dirname(path.resolve(temp))!==path.resolve(os.tmpdir())||!path.basename(temp).startsWith('fym-calibration-pack-test-'))throw Error('Unexpected cleanup target');fs.rmSync(temp,{recursive:true,force:true})}
 },20000)
})
