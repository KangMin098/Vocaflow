// scripts/csat/__tests__/source-origin-review.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateReviews, reviewSql } from '../source-origin-review.mjs'
const fixture = () => {
  const before = { status:'unresolved', source_title:null, source_authors:[], source_publisher:null, source_year:null, source_part:null, evidence:[], note:'Pending', audited_at:'2026-09-28', audit_ref:'old' }
  return { passage_sha256:'a'.repeat(64), representative_item_id:'fixture#41', item_ids:['fixture#41','fixture#42'],
    body_sha256_by_item:{ 'fixture#41':'b'.repeat(64), 'fixture#42':'c'.repeat(64) }, before,
    after:{...before,status:'confirmed_exact',source_title:'Book',source_authors:['Author'],evidence:[{url:'https://example.org/book'}],audited_at:'2026-10-04'} }
}
test('every linked item is bound to its own current body, including shared passages', () => {
  const r=fixture(); delete r.body_sha256_by_item['fixture#42']
  assert.throws(()=>validateReviews([r]),/Every linked item/)
})
test('duplicate reviews, empty bibliography, incomplete snapshots and unsafe URLs are rejected', () => {
  const r=fixture(); assert.throws(()=>validateReviews([r,r]),/duplicate/)
  for (const mutate of [r=>r.after.source_authors=[],r=>delete r.before.note,r=>r.after.evidence=[{url:'javascript:alert(1)'}]]) {
    const bad=fixture();mutate(bad);assert.throws(()=>validateReviews([bad]))
  }
})
test('empty batches, duplicate identities and embedded SQL block delimiters are handled safely', () => {
  assert.throws(()=>validateReviews([]),/nonempty/)
  const duplicate=fixture();duplicate.item_ids=['fixture#41','fixture#41'];assert.throws(()=>validateReviews([duplicate]),/duplicate item/)
  const r=fixture();r.after.note='$origin_review$ literal note'
  const sql=reviewSql([r],{commit:true})
  assert.ok(sql.includes('do $origin_review_1$'))
  assert.ok(sql.includes('end $origin_review_1$'))
})
test('preview is read-only and distinguishes identity, body and row conflicts', () => {
  const sql=reviewSql([fixture()]); assert.ok(!/\b(update|delete|insert)\b/i.test(sql))
  for (const token of ['body_or_identity_conflict','row_conflict','already_applied','i.id is null','convert_to(i.passage','to_jsonb(o.item_ids)']) assert.ok(sql.includes(token),token)
})
test('commit locks bodies and origins, compares before fields, and rolls back the whole batch on conflict', () => {
  const r=fixture();r.after.note="Author's checked evidence"
  const sql=reviewSql([r],{commit:true})
  assert.match(sql,/^begin;/);assert.match(sql,/commit;$/)
  for (const token of ['for share','for update',"= (r->'before')","= (r->'after')",'then continue','raise exception',"Author''s"]) assert.ok(sql.includes(token),token)
  assert.ok(sql.includes("'evidence', to_jsonb(o)->'evidence'"))
  assert.ok(!sql.includes('@>'))
})
