// apps/web/src/lib/csat/map/__tests__/practice-results.test.ts
// 학습 지도 결과 환류 — 본인 수행 요약(순수)
import { describe, expect, it } from 'vitest'

import { practiceResultsFor, summarizePractice, type AttemptRow } from '../practice-results'

const row = (is_correct: boolean, answered_at: string, task_key = 'claim-support', item_ref = '2022#20'): AttemptRow => ({ task_key, item_ref, is_correct, answered_at })

describe('summarizePractice', () => {
  it('수행이 없으면 start', () => {
    expect(summarizePractice([], null)).toEqual({ attempts: 0, firstCorrect: null, firstIndependent: null, latestCorrect: null, latestAt: null, next: 'start' })
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
  it('도움 수준이 비어 있으면(세션 없는 기록) 도움 여부를 모른다 — 해설을 봤다고 단정하지 않는다', () => {
    expect(summarizePractice([row(false, '2026-10-08T10:00:00Z')], { task_key: 'claim-support', item_ref: '2022#20', is_correct: false, help_level: null, after_explanation: null }).firstIndependent).toBeNull()
    expect(summarizePractice([row(false, '2026-10-08T10:00:00Z')], { task_key: 'claim-support', item_ref: '2022#20', is_correct: false, help_level: null, after_explanation: true }).firstIndependent).toBe(false)
  })
  it('첫 시도 뷰를 못 읽으면 도움 여부는 모른다(null) — 독립이라고 단정하지 않는다', () => {
    expect(summarizePractice([row(false, '2026-10-08T10:00:00Z')], null).firstIndependent).toBeNull()
  })
})

describe('practiceResultsFor', () => {
  const links = {
    'B6-3': { href: '/csat/item/2022-20#principle', label: 'x', itemId: '2022#20', taskKey: 'claim-support' },
    'A3-4': { href: '/csat/item/2022-36#principle', label: 'y', itemId: '2022#36', taskKey: 'cohesion-link' },
  }
  it('과제 키와 문항이 모두 같은 기록만 그 지도 과제에 붙인다', () => {
    const rows = [row(true, '2026-10-08T10:00:00Z'), row(false, '2026-10-08T10:01:00Z', 'cohesion-link', '2022#20'), row(false, '2026-10-08T10:02:00Z', 'claim-support', '2021#20')]
    const out = practiceResultsFor(links, rows, [])
    expect(out['B6-3'].attempts).toBe(1)
    expect(out['A3-4']).toMatchObject({ attempts: 0, next: 'start' })
  })
})
