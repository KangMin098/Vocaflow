// apps/web/src/lib/csat/session/__tests__/sync.test.ts
//
// **기기 기록 ↔ 서버 기록 합치기** — 겹치지 않고, 복습 큐는 다시 계산된다.

import { describe, expect, it } from 'vitest'

import { EMPTY_RECORD, applyResult, type Attempt } from '../model'
import { cleanAttempts, mergeAttempts, mergeRecord, replayReviews, unsynced } from '../sync'

const T0 = Date.parse('2026-09-17T09:00:00+09:00')
const at = (d: number) => new Date(T0 + d * 86_400_000).toISOString()
const a = (item: string, d: number, correct: boolean | null, confused = false): Attempt => ({
  item_id: item,
  type_id: 'R-BLANK',
  correct,
  confused,
  at: at(d),
  sec: 60,
})

describe('합치기', () => {
  it('같은 풀이(문항·시각)는 하나로 — 재전송·두 탭이 겹쳐도', () => {
    const x = a('2026#31', 0, false)
    expect(mergeAttempts([x], [{ ...x }], [x])).toHaveLength(1)
  })

  it('시각 표기가 달라도(Z vs +09:00) 같은 풀이다', () => {
    const x = a('2026#31', 0, false)
    const y = { ...x, at: new Date(x.at).toISOString().replace('Z', '+00:00') }
    expect(mergeAttempts([x], [y])).toHaveLength(1)
  })

  it('두 기기의 풀이를 합쳐 복습 큐를 처음부터 다시 돌린다 — 앞 기기의 오답 뒤 다른 기기의 정답', () => {
    const phone = [a('2026#31', 0, false)] // 3일 뒤 복습
    const laptop = [a('2026#31', 3, true)] // 복습을 맞힘 → 10일 뒤
    const rec = mergeRecord({ ...EMPTY_RECORD, attempts: phone }, laptop)
    expect(rec.attempts).toHaveLength(2)
    expect(rec.reviews).toEqual([expect.objectContaining({ item_id: '2026#31', stage: 2, due: at(13) })])
  })

  it('다시 돌린 큐 = 기기에서 차례로 applyResult 한 큐', () => {
    const list = [a('2026#31', 0, false), a('2026#36', 1, true, true), a('2026#31', 3, true)]
    let rec = EMPTY_RECORD
    for (const x of list) {
      rec = applyResult(rec, { item: { id: x.item_id, exam_id: '2026', no: 0, type_id: x.type_id, points: null }, correct: x.correct, confused: x.confused, sec: x.sec }, new Date(x.at))
    }
    const sort = (r: typeof rec.reviews) => [...r].sort((p, q) => p.item_id.localeCompare(q.item_id))
    expect(sort(replayReviews(list))).toEqual(sort(rec.reviews))
  })

  it('서버에만 기록이 있으면 새 기기에서도 온보딩을 건너뛴다', () => {
    expect(mergeRecord(EMPTY_RECORD, [a('2026#31', 0, true)]).onboarded).toBe(true)
    expect(mergeRecord(EMPTY_RECORD, []).onboarded).toBe(false)
  })

  it('올릴 것 = 서버에 없는 기기 풀이', () => {
    const x = a('2026#31', 0, false)
    const y = a('2026#36', 1, true)
    expect(unsynced([x, y], [x])).toEqual([y])
  })
})

describe('API 입력 검사', () => {
  it('모양이 틀린 행은 버린다 — 자유 문자열이 표로 흘러가지 않게', () => {
    const ok = a('2026#31', 0, true)
    const got = cleanAttempts([
      ok,
      { ...ok, item_id: "2026#31'; drop" },
      { ...ok, type_id: 'anything' },
      { ...ok, correct: 'yes' },
      { ...ok, at: 'not a date' },
      { ...ok, at: '2020-01-01T00:00:00Z' },
      { ...ok, sec: -5, item_id: 'M2706#33' },
    ])
    expect(got.map((g) => g.item_id)).toEqual(['2026#31', 'M2706#33'])
    expect(got[1].sec).toBe(0)
  })

  it('배열이 아니면 빈 배열 · 개수 상한', () => {
    expect(cleanAttempts({})).toEqual([])
    expect(cleanAttempts(Array.from({ length: 300 }, (_, k) => a('2026#31', k / 1000, true)))).toHaveLength(200)
  })
})
