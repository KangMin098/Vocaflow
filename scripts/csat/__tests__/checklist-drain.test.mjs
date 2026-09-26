// scripts/csat/__tests__/checklist-drain.test.mjs
//
// v7 체크리스트 경로 운영 드레인(criteria §3-6) — 감사 고르기 · 갈래 나누기 · 원천 끄기를 못박는다.

import test from 'node:test'
import assert from 'node:assert/strict'

import { auditPick, chunkByBudget, checklistAllowed, route, tallyAudit, sourceStatus, disabledSources } from '../checklist-drain/lib.mjs'
import { toRetainReview } from '../checklist-drain/record.mjs'
import { CRITERIA_VERSION } from '../gate-rules.mjs'

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const item = (n, source = 'wikinews') => ({
  id: uuid(n), source, source_updated_at: '2026-09-26T00:00:00+00:00', body_sha256: 'a'.repeat(64), content: 'x'.repeat(100),
})
const keepAnswers = {
  blocked: null, needsVisual: false, truncated: false, listOnly: false, linkage: 'strong', strippedRemains: true,
  mainPoint: true, narrative: false, notice: false, detachable: true, standsAlone: true, vocabAdjustable: true,
  factsMany: true, stereotypeCore: false, gap: false,
}
const out = (n, answers = keepAnswers) => ({
  id: uuid(n), answers, sample: 'The city council voted on', note: `시의회 결정과 반응이 한 흐름으로 이어진다 ${n}`,
  record: { genre: 'news', slots: { ages: ['high1'], purposes: ['mock'], types: ['content_match'], levels: ['V5'], platform: [] } },
})

test('감사 고르기: 5% 올림 · 최소 1편 · 같은 배치면 같은 선택 · 배치가 바뀌면 다른 선택', () => {
  const ids = Array.from({ length: 449 }, (_, i) => uuid(i))
  const a = auditPick(ids, 1)
  assert.equal(a.length, 23)
  assert.deepEqual(auditPick([...ids].reverse(), 1), a)
  assert.notDeepEqual(auditPick(ids, 2), a)
  assert.equal(auditPick(ids.slice(0, 3), 1).length, 1)
  assert.deepEqual(auditPick([], 1), [])
})

test('청크 자르기: 글자 수·편수 상한을 한 번에 · 한 편이 상한보다 길면 그 한 편만', () => {
  const c = chunkByBudget([{ content: 'a'.repeat(50) }, { content: 'a'.repeat(40) }, { content: 'a'.repeat(200) }, { content: 'a'.repeat(10) }], 100)
  assert.deepEqual(c.map((x) => x.length), [2, 1, 1])
  const d = chunkByBudget(Array.from({ length: 60 }, () => ({ content: 'a' })), 1000, 25)
  assert.deepEqual(d.map((x) => x.length), [25, 25, 10])
})

test('논문 원천·꺼진 원천은 체크리스트 경로 밖', () => {
  assert.equal(checklistAllowed('wikinews'), true)
  assert.equal(checklistAllowed('plos'), false)
  assert.equal(checklistAllowed('frontiers'), false)
  assert.equal(checklistAllowed('gdl', new Set(['gdl'])), false)
})

test('기록 만들기: keep 만 기록 · 판정자 답과 규칙 이름을 남긴다 · 적재기 검사를 통과한다', () => {
  const { review, problems } = toRetainReview(item(1), out(1))
  assert.deepEqual(problems, [])
  assert.equal(review.retention, 'keep')
  assert.equal(review.criteria_version, CRITERIA_VERSION)
  assert.equal(review.method, 'checklist')
  assert.equal(review.checklist.rule, 'keep')
  assert.equal(toRetainReview(item(2), out(2, { ...keepAnswers, linkage: 'thin' })).review, null)
})

test('기록 만들기: record 가 빠지면 문제로 잡는다(빈 기록을 넣지 않는다)', () => {
  const { problems } = toRetainReview(item(1), { ...out(1), record: undefined })
  assert.ok(problems.some((p) => /genre/.test(p)))
  assert.ok(problems.some((p) => /slots/.test(p)))
})

test('갈래: keep·감사 밖 → 기록 · 비keep → 전문 · 감사분은 keep 이어도 전문으로', () => {
  const items = [item(1), item(2), item(3), item(4)]
  const outs = [out(1), out(2, { ...keepAnswers, gap: true }), out(3), out(4, { ...keepAnswers, needsVisual: true })]
  const r = route(items, outs, [uuid(3), uuid(4)])
  assert.deepEqual(r.records.map((x) => x.id), [uuid(1)])
  assert.deepEqual(r.full.map((x) => x.id), [uuid(2), uuid(3), uuid(4)])
  assert.deepEqual(r.audited.map((a) => [a.id, a.checklist]), [[uuid(3), 'keep'], [uuid(4), 'discard']])
  assert.deepEqual(r.problems, [])
  // 전문 판정 청크에는 체크리스트 답이 실리지 않는다(눈가림)
  assert.ok(r.full.every((x) => !('answers' in x) && !('checklist' in x)))
})

test('갈래: 출력이 빠진 글은 문제로 — 어느 갈래에도 넣지 않는다', () => {
  const r = route([item(1), item(2)], [out(1)], [])
  assert.equal(r.records.length, 1)
  assert.equal(r.full.length, 0)
  assert.equal(r.problems.length, 1)
})

test('감사 세기: 체크리스트 keep 인데 전문이 keep 이 아닌 것만 오판 · 전문 없으면 pending', () => {
  const audited = [
    { id: 'a', source: 'wikinews', checklist: 'keep', rule: 'keep' },
    { id: 'b', source: 'wikinews', checklist: 'keep', rule: 'keep' },
    { id: 'c', source: 'wikinews', checklist: 'discard', rule: 'noSlot' },
    { id: 'd', source: 'gdl', checklist: 'keep', rule: 'keep' },
  ]
  const t = tallyAudit(audited, new Map([['a', 'keep'], ['b', 'hold'], ['c', 'keep']]))
  assert.deepEqual(t.bySource.wikinews, { audited: 3, auditedKeep: 2, wrongKeep: 1 })
  assert.deepEqual(t.pending, ['d'])
  assert.deepEqual(t.wrong.map((w) => w.id), ['b'])
})

test('원천 끄기: 누적 감사 keep 30편 이상 · 오판률 3% 초과일 때만', () => {
  const b = (keep, wrong) => ({ bySource: { wikinews: { audited: keep, auditedKeep: keep, wrongKeep: wrong } } })
  assert.equal(sourceStatus([b(29, 5)]).wikinews.off, false) // 29편 — 아직 판단 안 함
  assert.equal(sourceStatus([b(15, 1), b(15, 0)]).wikinews.off, true) // 배치를 넘어 누적 — 1/30 = 3.3%
  assert.equal(sourceStatus([b(20, 0), b(20, 1)]).wikinews.off, false) // 1/40 = 2.5%
  assert.equal(sourceStatus([b(20, 1), b(20, 1)]).wikinews.off, true) // 2/40 = 5%
  assert.deepEqual([...disabledSources({ disabled: ['gdl'], batches: [b(20, 1), b(20, 1)] })].sort(), ['gdl', 'wikinews'])
  assert.deepEqual([...disabledSources(null)], [])
})
