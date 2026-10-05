// scripts/csat/__tests__/scoped-type-reports.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { scopedTypeReports } from '../lib-scoped-type-reports.mjs'

test('reports use latest published rows per grade and cannot include KICE or a held correction', () => {
  const items = ['2026#23', 'H2603G1#23', 'H2603G2#23', 'H2603G3#23'].map((id) => ({ id, type_id: 'R-TOPIC', in_scope: true }))
  const analysis = (item_id, version, status) => ({ item_id, version, status, answer_locus: { sentence_index: [2, 2, 3] }, choice_analysis: [{ verdict: 'distractor', trap: '무관' }, { verdict: 'correct', trap: '정답 잔재' }], time_budget_sec: 60 })
  const rows = [analysis(items[0].id, 1, 'published'), analysis(items[1].id, 1, 'published'), analysis(items[1].id, 2, 'published'), analysis(items[2].id, 1, 'published'), analysis(items[2].id, 2, 'in_review'), analysis(items[3].id, 1, 'published')]
  const reports = scopedTypeReports(items, rows, '2026-10-04T00:00:00Z')
  assert.deepEqual(reports.filter((r) => r.status === 'published').map((r) => r.grade), [1, 3])
  assert.equal(reports.find((r) => r.grade === 2).n_analyzed, 0)
  assert.equal(reports.find((r) => r.grade === 2).status, 'draft')
  for (const r of reports.filter((r) => r.status === 'published')) {
    assert.equal(r.organizer, 'edu_office')
    assert.equal(r.n_analyzed, 1)
    assert.deepEqual(r.recurring_traps, [{ trap: '무관', count: 1 }])
    assert.match(r.answer_locus_pattern, /2단위 1문항/)
    assert.equal(r.time_budget_sec, 60)
    assert.equal(r.updated_at, '2026-10-04T00:00:00Z')
    assert.ok(r.procedure_steps.length)
    assert.equal(typeof r.procedure_steps[0].step, 'string', 'learner.ts uses steps[0].step for first_step')
  }
})

test('unknown-answer rows and out-of-scope items are excluded', () => {
  const items = [{ id: 'H2603G1#23', type_id: 'R-TOPIC', in_scope: false }, { id: 'H2603G1#24', type_id: 'R-TITLE' }]
  const reports = scopedTypeReports(items, items.map((i) => ({ item_id: i.id, version: 1, status: 'published', answer_unknown: true })), 'fixed')
  assert.equal(reports.length, 1)
  assert.equal(reports[0].status, 'draft')
  assert.equal(reports[0].n_analyzed, 0)
})

test('a recurring trap counts each item once even when several distractors share its label', () => {
  const items = [23,24].map(n=>({id:`H2603G1#${n}`,type_id:'R-TOPIC',in_scope:true}))
  const analyses = items.map(i=>({item_id:i.id,version:1,status:'published',choice_analysis:[
    {verdict:'distractor',trap:'무관'}, {verdict:'distractor',trap:' 무관 '},
    {verdict:'distractor',trap:'무관'}, {verdict:'correct',trap:'정답 잔재'},
  ]}))
  const [report]=scopedTypeReports(items,analyses,'fixed')
  assert.equal(report.n_analyzed,2)
  assert.deepEqual(report.recurring_traps,[{trap:'무관',count:2}])
})

test('previous report keys with no remaining scoped items become empty drafts instead of stale published rows', () => {
  const reports = scopedTypeReports([], [], 'fixed', [{ grade: 2, type_id: 'R-TOPIC' }])
  assert.equal(reports.length, 1)
  assert.equal(reports[0].status, 'draft')
  assert.equal(reports[0].n_analyzed, 0)
  assert.deepEqual(reports[0].recurring_traps, [])
})

test('a missing type holds only that item while normal grade reports continue', () => {
  const items = [{ id: 'H2603G1#23', type_id: null }, { id: 'H2603G1#24', type_id: 'R-TITLE' }]
  const reports = scopedTypeReports(items, items.map((i) => ({ item_id: i.id, version: 1, status: 'published' })), 'fixed')
  assert.equal(reports.length, 1)
  assert.equal(reports[0].type_id, 'R-TITLE')
  assert.equal(reports[0].n_analyzed, 1)
})

test('the first independently published chart creates a grade-scoped report while unreviewed grades remain draft', () => {
 const items=[1,2,3].map(grade=>({id:`H2603G${grade}#25`,type_id:'R-CHART',in_scope:true}))
 const analyses=items.map((item,index)=>({item_id:item.id,version:3,status:index===2?'published':'in_review',answer_locus:{sentence_index:[3]},time_budget_sec:60,choice_analysis:[{verdict:'correct'},{verdict:'distractor',trap:'배수 표현 혼동'}]}))
 const reports=scopedTypeReports(items,analyses,'2026-10-05T00:00:00Z')
 assert.deepEqual(reports.map(r=>[r.grade,r.n_analyzed,r.status]),[[1,0,'draft'],[2,0,'draft'],[3,1,'published']])
 const chart=reports[2]
 assert.equal(chart.organizer,'edu_office')
 assert.equal(chart.time_budget_sec,60)
 assert.deepEqual(chart.recurring_traps,[{trap:'배수 표현 혼동',count:1}])
 assert.match(chart.procedure_steps[0].step,/원본 도표.*범례/)
 assert.match(chart.procedure_steps[2].step,/초과.*정확히.*경계/)
 assert.match(chart.procedure_steps[3].step,/모든 주장/)
})
