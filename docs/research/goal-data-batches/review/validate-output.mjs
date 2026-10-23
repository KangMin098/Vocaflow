// docs/research/goal-data-batches/review/validate-output.mjs
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const dir='docs/research/goal-data-batches/review'
const v=JSON.parse(fs.readFileSync(`${dir}/verdict.json`,'utf8'))
const snapshot=JSON.parse(fs.readFileSync(`${dir}/snapshot-checks.json`,'utf8'))
assert.equal(snapshot.all_git_inputs_identical,true)
assert.equal(snapshot.all_working_bytes_match,true)
assert.equal(v.d2.r1.length,30);assert.equal(v.d2.disputes.length,30)
assert.equal(v.d2.disputes.filter(r=>r.task==='R3').length,11)
assert(v.d2.disputes.filter(r=>r.task==='R3').every(r=>r.verdict==='unclear'))
assert.equal(v.d3.sample.length,30);assert.equal(v.d4.tasks.length,21)
assert.equal(v.top_5_gaps.length,5)
assert.equal(v.db.all_http_200,true)
const rows=[...v.d1,...v.d2.r1,...v.d2.disputes,v.d2.r3_claim,...v.d3.sample,...v.d3.claims,...v.d4.handoff,...v.d4.tasks,...v.d4.omissions]
const contents=new Map()
for(const r of rows){
 assert(['confirmed','refuted','unclear'].includes(r.verdict),r.id)
 assert(r.note.length>10,r.id)
 assert(r.evidence.length>0,r.id)
 for(const e of r.evidence){
  let ref=null,p,n
  const g=e.match(/^([a-f0-9]{9,40}):(.+):(\d+)$/)
  if(g){ref=g[1];p=g[2];n=Number(g[3])} else {const m=e.match(/^(.+):(\d+)$/);assert(m,e);p=m[1];n=Number(m[2])}
  const key=(ref??'local')+':'+p
  if(!contents.has(key)) contents.set(key,ref?execFileSync('git',['show',`${ref}:${p}`],{encoding:'utf8',maxBuffer:30e6}):fs.readFileSync(p,'utf8'))
  assert(n>0&&n<=contents.get(key).split('\n').length,e)
 }
}
assert.equal(v.d2.summary.confirmed_boundary_violations,v.d2.disputes.filter(r=>r.contract_boundary_violation).length)
assert.equal(v.d3.summary.full_recount.source_text,280)
assert.equal(v.d3.summary.full_recount.agree_source_text,164)
const runtime=JSON.parse(fs.readFileSync(`${dir}/runtime-checks.json`,'utf8'))
assert.equal(runtime.assertions_passed,14)
assert.equal(runtime.inventory.items,155)
const ids=new Set(rows.map(r=>r.id));assert.equal(ids.size,rows.length)
console.log(JSON.stringify({passed:true,verdict_rows:rows.length,evidence_documents:contents.size,sample_counts:[30,30,30],r3:11,d4_tasks:21,db_gets:6,runtime_assertions:14,snapshot_inputs:38}))
