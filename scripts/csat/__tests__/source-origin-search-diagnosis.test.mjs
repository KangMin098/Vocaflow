// scripts/csat/__tests__/source-origin-search-diagnosis.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { diagnoseOrigins } from '../source-origin-search-diagnosis.mjs'
const make=id=>({passage_sha256:createHash('sha256').update(id).digest('hex'),representative_item_id:id,item_ids:[id],passage:'Distinctive example.',body_sha256_by_item:{[id]:createHash('sha256').update('Distinctive example.').digest('hex')},status:'unresolved'})
const run=(snapshot,decisions=[])=>diagnoseOrigins({snapshot,decisions,generalLog:[],booksLog:[],auditedAt:'2026-10-05'})
const decision=(r,why)=>({...r,why,checked_range:'Historical scope',checked_urls:[]})
test('scan and uncertain quotation are not access failure; unknown reasons stay unknown',()=>{
 const scan=make('2014B#34'),dead=make('2019#26'),unknown=make('M2020-06#20')
 const r=run([scan,dead,unknown],[decision(scan,'스캔이며 재인용 관계 미확인.'),decision(dead,'공식 PDF 404.')])
 assert.deepEqual(r.observed_primary_counts,{reason1_access_obstacle:1,reason4_work_not_identified:1,unclassified:1})
 assert.equal(r.rows[0].diagnosis.reason3_provenance_uncertainty,true)
 assert.equal(r.rows[2].diagnosis.reason_number,null)
 assert.equal(r.rows[2].legacy_books_empty,null)
 assert.equal(r.overlapping_flags.reason2_documented_causal_obstacle,0)
})
test('stale linked bodies, changed representative text and duplicate identities fail closed',()=>{
 const r=make('2019#26'),d=decision(r,'404')
 assert.throws(()=>run([r],[{...d,body_sha256_by_item:{[r.representative_item_id]:'0'.repeat(64)}}]),/body conflict/)
 assert.throws(()=>run([{...r,passage:'changed'}]),/hash mismatch/)
 assert.throws(()=>run([{...r,item_ids:[r.representative_item_id,'2019#27']}]),/Missing current/)
 assert.throws(()=>run([r,r]),/duplicate/)
})
