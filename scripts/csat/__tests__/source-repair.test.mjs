// scripts/csat/__tests__/source-repair.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {applySourceRepair,mergeSourceRepair,sourceDigest} from '../lib-source-repair.mjs'

const pdf=Buffer.from('fictional PDF fixture')
const old={id:'H2603G1#26',passage:'[button glyph lost]',choices:['old1','old2','old3','old4','old5'],answer:5,answers:[5],raw_block:'untouched'}
const repair={item_id:old.id,pdf_sha256:sourceDigest(pdf),before:{passage:old.passage,choices:old.choices},after:{passage:'A: Short press to confirm.',choices:['A','B','C','D','E']}}

test('verified transcription preserves official answers/raw input and replays without change',()=>{
 const next=applySourceRepair(old,repair,pdf)
 assert.equal(next.answer,5)
 assert.deepEqual(next.answers,[5])
 assert.equal(next.raw_block,'untouched')
 assert.deepEqual(applySourceRepair(next,repair,pdf),next)
 assert.equal(old.passage,'[button glyph lost]')
 assert.deepEqual(applySourceRepair({...old,choices:repair.after.choices},repair,pdf),next)
})
test('changed PDF or source cannot acquire an older inspected transcription',()=>{
 assert.throws(()=>applySourceRepair(old,repair,Buffer.from('different PDF')),/PDF 정본 해시/)
 assert.throws(()=>applySourceRepair({...old,passage:'another author repaired this'},repair,pdf),/재대조/)
 assert.throws(()=>applySourceRepair({...old,id:'H2603G1#27'},repair,pdf),/ID/)
})
test('official answer mutation and empty or incomplete sources are rejected',()=>{
 assert.throws(()=>applySourceRepair(old,{...repair,before:{answer:5},after:{answer:1}},pdf),/동일 필드/)
 assert.throws(()=>applySourceRepair(old,{...repair,after:{...repair.after,passage:''}},pdf),/빈 지문/)
 assert.throws(()=>applySourceRepair(old,{...repair,after:{...repair.after,choices:['A','B']}},pdf),/선지 5/)
})
test('successive inspections preserve the parser preimage and reject unrelated repair histories',()=>{
 const next={...repair,before:{passage:repair.after.passage,stem:'old stem'},after:{passage:'A: Press to confirm.',stem:'new stem'}}
 const merged=mergeSourceRepair(repair,next)
 assert.equal(merged.before.passage,old.passage)
 assert.deepEqual(merged.after.choices,repair.after.choices)
 assert.equal(applySourceRepair({...old,stem:'old stem'},merged,pdf).stem,'new stem')
 assert.deepEqual(mergeSourceRepair(merged,next),merged)
 assert.throws(()=>mergeSourceRepair(repair,{...next,pdf_sha256:'0'.repeat(64)}),/정본/)
 assert.throws(()=>mergeSourceRepair(repair,{...next,before:{...next.before,passage:'unrelated'}}),/이어지지/)
})
