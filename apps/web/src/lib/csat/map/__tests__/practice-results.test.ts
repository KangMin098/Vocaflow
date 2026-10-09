// apps/web/src/lib/csat/map/__tests__/practice-results.test.ts
// 학습 지도 결과 환류 — 본인 수행 요약(순수)
import { describe, expect, it } from 'vitest'

import { practiceResultsFor, summarizePractice, type AttemptRow } from '../practice-results'

const row = (is_correct: boolean, answered_at: string, task_key = 'claim-support', item_ref = '2022#20'): AttemptRow => ({ task_key, item_ref, is_correct, answered_at })

describe('summarizePractice', () => {
  it('수행이 없으면 start', () => {
    expect(summarizePractice([], null)).toEqual({ attempts: 0, firstCorrect: null, firstIndependent: null, latestCorrect: null, latestAt: null, transfer: null, reviewAt: null, next: 'start' })
  })
  it('오답 뒤 정답 — 처음은 오답 · 최근은 정답 · 다음은 넘어가기(도착 순서가 아니라 판단 시각 순)', () => {
    const r = summarizePractice([row(true, '2026-10-08T10:05:00Z'), row(false, '2026-10-08T10:00:00Z')], null)
    expect(r).toMatchObject({ attempts: 2, firstCorrect: false, latestCorrect: true, latestAt: '2026-10-08T10:05:00Z', next: 'move_on' })
  })
  it('최근이 오답이면 다시 해 보기', () => {
    expect(summarizePractice([row(true, '2026-10-08T10:00:00Z'), row(false, '2026-10-08T10:05:00Z')], null).next).toBe('retry')
  })
  it('첫 시도 뷰가 있으면 그 판정과 도움 여부를 쓴다 — 해설 먼저 · 해설 뒤 판단은 독립 아님', () => {
    const rows = [row(true, '2026-10-08T10:00:00Z')]
    expect(summarizePractice(rows, { task_key: 'claim-support', item_ref: '2022#20', is_correct: true, help_level: 'independent', after_explanation: false }).firstIndependent).toBe(true)
    expect(summarizePractice(rows, { task_key: 'claim-support', item_ref: '2022#20', is_correct: true, help_level: 'viewed_first', after_explanation: false }).firstIndependent).toBe(false)
    expect(summarizePractice(rows, { task_key: 'claim-support', item_ref: '2022#20', is_correct: true, help_level: 'independent', after_explanation: true }).firstIndependent).toBe(false)
  })
  it('M8 시각 불확실이면 「도움 없이」 를 단정하지 않는다(null) — 도움받은 판단은 그대로 false', () => {
    const rows = [row(true, '2026-10-08T10:00:00Z')]
    const base = { task_key: 'claim-support', item_ref: '2022#20', is_correct: true, after_explanation: false, timing_uncertain: true }
    expect(summarizePractice(rows, { ...base, help_level: 'independent' }).firstIndependent).toBeNull()
    expect(summarizePractice(rows, { ...base, help_level: 'viewed_first' }).firstIndependent).toBe(false)
  })
  it('도움 수준이 비어 있으면(세션 없는 기록) 도움 여부를 모른다 — 해설을 봤다고 단정하지 않는다', () => {
    expect(summarizePractice([row(false, '2026-10-08T10:00:00Z')], { task_key: 'claim-support', item_ref: '2022#20', is_correct: false, help_level: null, after_explanation: null }).firstIndependent).toBeNull()
    expect(summarizePractice([row(false, '2026-10-08T10:00:00Z')], { task_key: 'claim-support', item_ref: '2022#20', is_correct: false, help_level: null, after_explanation: true }).firstIndependent).toBe(false)
  })
  it('첫 시도 뷰를 못 읽으면 도움 여부는 모른다(null) — 독립이라고 단정하지 않는다', () => {
    expect(summarizePractice([row(false, '2026-10-08T10:00:00Z')], null).firstIndependent).toBeNull()
  })
})

describe('복습 · 전이', () => {
  const now = new Date('2026-10-20T00:00:00Z')
  it('최근 정답이고 예약일이 지났으면 review · 아직이면 move_on(예약일 표시)', () => {
    const rows = [row(true, '2026-10-08T10:00:00Z')]
    expect(summarizePractice(rows, null, { reviews: [{ item_ref: '2022#20', review_at: '2026-10-15T00:00:00Z', deleted_at: null }], now }).next).toBe('review')
    const later = summarizePractice(rows, null, { reviews: [{ item_ref: '2022#20', review_at: '2026-10-25T00:00:00Z', deleted_at: null }], now })
    expect(later).toMatchObject({ next: 'move_on', reviewAt: '2026-10-25T00:00:00Z' })
  })
  it('예약 시각 뒤에 다시 확인했으면 그 예약은 끝났다 — review 아님', () => {
    const rows = [row(true, '2026-10-08T10:00:00Z'), row(true, '2026-10-16T09:00:00Z')]
    const r = summarizePractice(rows, null, { reviews: [{ item_ref: '2022#20', review_at: '2026-10-15T00:00:00Z', deleted_at: null }], now })
    expect(r).toMatchObject({ next: 'move_on', reviewAt: null })
  })
  it('최근이 오답이면 예약보다 retry 가 먼저', () => {
    expect(summarizePractice([row(false, '2026-10-08T10:00:00Z')], null, { reviews: [{ item_ref: '2022#20', review_at: '2026-10-15T00:00:00Z', deleted_at: null }], now }).next).toBe('retry')
  })
  it('삭제된 세션의 예약은 쓰지 않는다 · now 가 없으면 예약일이 지났다고 보지 않는다', () => {
    const rows = [row(true, '2026-10-08T10:00:00Z')]
    expect(summarizePractice(rows, null, { reviews: [{ item_ref: '2022#20', review_at: '2026-10-15T00:00:00Z', deleted_at: '2026-10-16T00:00:00Z' }], now }).reviewAt).toBeNull()
    expect(summarizePractice(rows, null, { reviews: [{ item_ref: '2022#20', review_at: '2026-10-15T00:00:00Z', deleted_at: null }] }).next).toBe('move_on')
  })
})

describe('practiceResultsFor', () => {
  const links = {
    'B6-3': { href: '/csat/item/2022-20#principle', label: 'x', itemId: '2022#20', target: '2022#20', taskKey: 'claim-support', confirm: [] },
    'A3-4': { href: '/csat/item/2022-36#principle', label: 'y', itemId: '2022#36', target: '2022#36', taskKey: 'cohesion-link', confirm: [] },
  }
  it('전이(transfer)는 같은 과제 키면 다른 문항이어도 붙고, 이 문항 연습 횟수에는 들어가지 않는다', () => {
    const rows = [row(true, '2026-10-08T10:00:00Z'), { ...row(false, '2026-10-08T11:00:00Z', 'claim-support', '2023#22'), phase: 'transfer' }]
    const out = practiceResultsFor(links, rows, [])
    expect(out['B6-3']).toMatchObject({ attempts: 1, transfer: { attempts: 1, latestCorrect: false } })
    expect(out['A3-4'].transfer).toBeNull()
  })
  it('골격 문항(<key>-skeleton)의 전이도 「다른 지문에 적용」 으로 센다 — Practice 의 전이 문항은 대부분 골격이다', () => {
    const rows = [row(true, '2026-10-08T10:00:00Z'), { ...row(true, '2026-10-08T11:00:00Z', 'claim-support-skeleton', '2024#23'), phase: 'transfer' }]
    expect(practiceResultsFor(links, rows, [])['B6-3'].transfer).toEqual({ attempts: 1, latestCorrect: true })
  })
  it('같은 문항의 transfer 는 「다른 지문」 이 아니다 · 첫 시도는 transfer 줄을 쓰지 않는다', () => {
    const rows = [row(true, '2026-10-08T10:00:00Z'), { ...row(false, '2026-10-08T09:00:00Z'), phase: 'transfer' }]
    const firsts = [{ task_key: 'claim-support', item_ref: '2022#20', is_correct: false, help_level: 'viewed_first', after_explanation: false, phase: 'transfer' }, { task_key: 'claim-support', item_ref: '2022#20', is_correct: true, help_level: 'independent', after_explanation: false, phase: 'practice' }]
    const out = practiceResultsFor(links, rows, firsts)
    expect(out['B6-3']).toMatchObject({ attempts: 1, transfer: null, firstCorrect: true, firstIndependent: true })
  })
  it('과제 키와 문항이 모두 같은 기록만 그 지도 과제에 붙인다', () => {
    const rows = [row(true, '2026-10-08T10:00:00Z'), row(false, '2026-10-08T10:01:00Z', 'cohesion-link', '2022#20'), row(false, '2026-10-08T10:02:00Z', 'claim-support', '2021#20')]
    const out = practiceResultsFor(links, rows, [])
    expect(out['B6-3'].attempts).toBe(1)
    expect(out['A3-4']).toMatchObject({ attempts: 0, next: 'start' })
  })
})

describe('practiceResultsFor — 확인 문항 여러 개(Codex P1)', () => {
  const conf = (t: string) => ({ href: `/csat/item/${t.replace('#', '-')}#principle`, label: t, target: t, taskKey: 'claim-support' })
  const links = { 'B6-3': { href: '/csat/item/2022-20#principle', label: 'x', itemId: '2022#20', target: '2022#20', taskKey: 'claim-support', confirm: [conf('2022#20'), conf('2021#20')] } }
  it('둘째 확인 문항의 수행 · 복습 예약도 지도 결과에 들어간다 · 그 문항은 전이로 세지 않는다', () => {
    const rows = [row(false, '2026-10-08T10:00:00Z', 'claim-support', '2021#20'), row(true, '2026-10-08T11:00:00Z')]
    const reviews = [{ item_ref: '2021#20', review_at: '2026-10-09T00:00:00Z', deleted_at: null }]
    const out = practiceResultsFor(links, rows, [], reviews, new Date('2026-10-10T00:00:00Z'))
    expect(out['B6-3']).toMatchObject({ attempts: 2, firstCorrect: false, latestCorrect: true, transfer: null, reviewAt: '2026-10-09T00:00:00Z', next: 'review' })
  })
  it('첫 시도는 확인 문항들 중 가장 이른 판단', () => {
    const firsts = [
      { task_key: 'claim-support', item_ref: '2022#20', is_correct: true, help_level: 'independent', after_explanation: false, answered_at: '2026-10-08T11:00:00Z' },
      { task_key: 'claim-support', item_ref: '2021#20', is_correct: false, help_level: 'viewed_first', after_explanation: false, answered_at: '2026-10-08T10:00:00Z' },
    ]
    const out = practiceResultsFor(links, [row(true, '2026-10-08T11:00:00Z')], firsts)
    expect(out['B6-3']).toMatchObject({ firstCorrect: false, firstIndependent: false })
  })
})
