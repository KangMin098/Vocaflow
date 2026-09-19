// apps/web/src/lib/csat/session/__tests__/model.test.ts
//
// **F7 · F8 — 복습 큐와 세션 구성 규칙을 잠근다.** (docs/csat-learner-brief.md [F])
//
//   F7 [헷갈려요]가 복습 큐에 들어가고 3일 후 세션에 나타난다 — 시간을 옮겨 검사한다
//   F8 세션이 약한 유형 · 다음 순서 · 복습(비면 신규)을 규칙대로 섞는다

import { describe, expect, it } from 'vitest'

import {
  EMPTY_RECORD,
  SESSION_SIZE,
  applyResult,
  composeSession,
  dueReviews,
  examOrder,
  nextOrderType,
  planLabel,
  shortTypeName,
  streak,
  weakestType,
  weekCount,
  type CatalogItem,
  type LearnerRecord,
  type SessionCatalog,
} from '../model'

const T = ['R-BLANK', 'R-ORDER', 'R-INSERT', 'R-GIST']
const item = (exam: string, no: number, type: string): CatalogItem => ({
  id: `${exam}#${no}`,
  exam_id: exam,
  no,
  type_id: type,
  points: 2,
})
const CAT: SessionCatalog = {
  items: [
    item('2026', 31, 'R-BLANK'),
    item('2026', 32, 'R-BLANK'),
    item('2026', 36, 'R-ORDER'),
    item('2026', 38, 'R-INSERT'),
    item('2026', 22, 'R-GIST'),
    item('M2706', 31, 'R-BLANK'),
    item('M2706', 36, 'R-ORDER'),
    item('M2706', 38, 'R-INSERT'),
    item('2025', 36, 'R-ORDER'),
  ],
  types: [
    { id: 'R-BLANK', name: '빈칸 추론', time_budget_sec: 150 },
    { id: 'R-ORDER', name: '글의 순서', time_budget_sec: 120 },
    { id: 'R-INSERT', name: '문장 삽입', time_budget_sec: 120 },
    { id: 'R-GIST', name: '요지', time_budget_sec: 60 },
  ],
  exams: {
    '2026': { label: '2026학년도 수능', order: examOrder('2026') },
    M2706: { label: '2027학년도 6월 모평', order: examOrder('M2706') },
    '2025': { label: '2025학년도 수능', order: examOrder('2025') },
  },
}
const byId = (id: string) => CAT.items.find((i) => i.id === id)!
const NOW = new Date('2026-09-17T09:00:00+09:00')
const days = (d: number) => new Date(NOW.getTime() + d * 86_400_000)

describe('F7 — 복습 큐', () => {
  it('정답이어도 「헷갈려요」면 3일 뒤 복습 큐에 들어간다', () => {
    const r = applyResult(EMPTY_RECORD, { item: byId('2026#36'), correct: true, confused: true, sec: 80 }, NOW)
    expect(r.reviews).toHaveLength(1)
    expect(r.reviews[0].stage).toBe(1)
    expect(dueReviews(r, days(2.9))).toHaveLength(0)
    expect(dueReviews(r, days(3))).toHaveLength(1)
  })

  it('3일 뒤 세션에 그 문항이 「복습」 칸으로 나온다 — 전날에는 안 나온다', () => {
    const r = applyResult(EMPTY_RECORD, { item: byId('2026#36'), correct: true, confused: true, sec: 80 }, NOW)
    const before = composeSession(CAT, r, days(2))
    expect(before.slots.some((s) => s.kind === 'review')).toBe(false)
    const after = composeSession(CAT, r, days(3))
    const rev = after.slots.find((s) => s.kind === 'review')
    expect(rev?.item.id).toBe('2026#36')
  })

  it('틀리면 3일 뒤, 그 복습을 맞히면 10일 뒤, 또 맞히면 졸업한다', () => {
    let r = applyResult(EMPTY_RECORD, { item: byId('2026#31'), correct: false, confused: false, sec: 90 }, NOW)
    expect(r.reviews[0]).toMatchObject({ stage: 1 })
    r = applyResult(r, { item: byId('2026#31'), correct: true, confused: false, sec: 60 }, days(3))
    expect(r.reviews[0]).toMatchObject({ stage: 2 })
    expect(dueReviews(r, days(12.9))).toHaveLength(0)
    expect(dueReviews(r, days(13))).toHaveLength(1)
    r = applyResult(r, { item: byId('2026#31'), correct: true, confused: false, sec: 50 }, days(13))
    expect(r.reviews).toHaveLength(0)
  })

  it('10일 뒤 복습에서 헷갈리면 다시 3일 뒤부터', () => {
    let r = applyResult(EMPTY_RECORD, { item: byId('2026#31'), correct: false, confused: false, sec: 90 }, NOW)
    r = applyResult(r, { item: byId('2026#31'), correct: true, confused: false, sec: 60 }, days(3))
    r = applyResult(r, { item: byId('2026#31'), correct: true, confused: true, sec: 60 }, days(13))
    expect(r.reviews[0]).toMatchObject({ stage: 1 })
    expect(Date.parse(r.reviews[0].due)).toBe(days(16).getTime())
  })

  it('고르지 않고 넘어간 것도 복습에 들어간다 — 모르는 것이다', () => {
    const r = applyResult(EMPTY_RECORD, { item: byId('2026#22'), correct: null, confused: false, sec: 10 }, NOW)
    expect(r.reviews).toHaveLength(1)
  })

  it('처음 맞히고 헷갈리지 않았으면 큐에 없다', () => {
    const r = applyResult(EMPTY_RECORD, { item: byId('2026#22'), correct: true, confused: false, sec: 40 }, NOW)
    expect(r.reviews).toHaveLength(0)
    expect(r.attempts).toHaveLength(1)
  })
})

describe('F8 — 세션 구성', () => {
  it('기록이 없으면 순서표 앞 유형 둘 + 신규 하나 — 셋 다 다른 유형(교차)', () => {
    const p = composeSession(CAT, EMPTY_RECORD, NOW)
    expect(p.slots).toHaveLength(SESSION_SIZE)
    expect(p.slots.map((s) => s.kind)).toEqual(['order', 'order', 'new'])
    expect(new Set(p.slots.map((s) => s.item.type_id)).size).toBe(3)
    expect(p.slots.map((s) => s.item.type_id)).toEqual(['R-BLANK', 'R-ORDER', 'R-INSERT'])
  })

  it('약한 유형 = 최근 20문항 정확도 최하 → 첫 칸', () => {
    let r: LearnerRecord = EMPTY_RECORD
    r = applyResult(r, { item: byId('2026#31'), correct: true, confused: false, sec: 1 }, NOW)
    r = applyResult(r, { item: byId('2026#36'), correct: false, confused: false, sec: 1 }, NOW)
    r = applyResult(r, { item: byId('M2706#36'), correct: false, confused: false, sec: 1 }, NOW)
    expect(weakestType(r, T)).toBe('R-ORDER')
    const p = composeSession(CAT, r, NOW)
    expect(p.slots[0]).toMatchObject({ kind: 'weak' })
    expect(p.slots[0].item.type_id).toBe('R-ORDER')
    // 안 푼 문항이 먼저다
    expect(p.slots[0].item.id).toBe('2025#36')
  })

  it('최근 20문항 밖의 오답은 약한 유형 판정에 안 들어간다', () => {
    let r: LearnerRecord = applyResult(EMPTY_RECORD, { item: byId('2026#36'), correct: false, confused: false, sec: 1 }, NOW)
    for (let k = 0; k < 20; k += 1) {
      r = applyResult(r, { item: byId('2026#31'), correct: k % 2 === 0, confused: false, sec: 1 }, NOW)
    }
    expect(weakestType(r, T)).toBe('R-BLANK')
  })

  it('복습 차례가 있으면 셋째 칸은 복습 — 없으면 신규', () => {
    const r = applyResult(EMPTY_RECORD, { item: byId('2026#38'), correct: false, confused: false, sec: 1 }, NOW)
    expect(composeSession(CAT, r, days(1)).slots[2].kind).toBe('new')
    const p = composeSession(CAT, r, days(3))
    expect(p.slots[2]).toMatchObject({ kind: 'review' })
    expect(p.slots.filter((s) => s.item.id === '2026#38')).toHaveLength(1)
  })

  it('다음 순서 유형은 마지막에 푼 유형의 다음이다', () => {
    const r = applyResult(EMPTY_RECORD, { item: byId('2026#36'), correct: true, confused: false, sec: 1 }, NOW)
    expect(nextOrderType(r, T)).toBe('R-INSERT')
  })

  it('한 세션의 문항은 서로 다르다', () => {
    let r: LearnerRecord = EMPTY_RECORD
    for (const id of ['2026#31', '2026#32', 'M2706#31']) {
      r = applyResult(r, { item: byId(id), correct: false, confused: false, sec: 1 }, NOW)
    }
    const p = composeSession(CAT, r, days(3))
    expect(new Set(p.slots.map((s) => s.item.id)).size).toBe(p.slots.length)
  })

  it('기기에 있는 회차를 먼저 쓴다 — 받아야 할 PDF 가 줄어든다', () => {
    const p = composeSession(CAT, EMPTY_RECORD, NOW, ['M2706'])
    expect(p.slots.slice(0, 2).every((s) => s.item.exam_id === 'M2706')).toBe(true)
  })

  it('필요한 회차 목록과 분 어림이 나온다', () => {
    const p = composeSession(CAT, EMPTY_RECORD, NOW)
    expect(p.exams.length).toBeGreaterThan(0)
    // (150 + 120 + 120) + 3 × 60 = 570초 ≈ 10분 — 지시문 「세션 ≤ 10분」
    expect(p.minutes).toBe(10)
  })

  it('요약 한 줄 — 복습은 맨 뒤', () => {
    const r = applyResult(EMPTY_RECORD, { item: byId('2026#38'), correct: false, confused: false, sec: 1 }, NOW)
    const p = composeSession(CAT, r, days(3))
    expect(planLabel(p, CAT.types)).toMatch(/복습 1$/)
  })
})

describe('기록 — 숫자 셋', () => {
  it('스트릭: 오늘 안 풀었으면 어제까지 센다 — 아침에 0 이 되지 않는다', () => {
    let r: LearnerRecord = EMPTY_RECORD
    r = applyResult(r, { item: byId('2026#31'), correct: true, confused: false, sec: 1 }, days(-2))
    r = applyResult(r, { item: byId('2026#32'), correct: true, confused: false, sec: 1 }, days(-1))
    expect(streak(r, NOW).days).toBe(2)
    r = applyResult(r, { item: byId('2026#36'), correct: true, confused: false, sec: 1 }, NOW)
    expect(streak(r, NOW).days).toBe(3)
  })

  it('스트릭: 이틀 비면 끊긴다 — 벌이 아니라 「다시 시작」', () => {
    const r = applyResult(EMPTY_RECORD, { item: byId('2026#31'), correct: true, confused: false, sec: 1 }, days(-3))
    expect(streak(r, NOW)).toEqual({ days: 0, broken: true })
    expect(streak(EMPTY_RECORD, NOW)).toEqual({ days: 0, broken: false })
  })

  it('이번 주 문항 수는 월요일부터 센다', () => {
    // 2026-09-17 은 목요일 — 월요일은 09-14
    let r: LearnerRecord = EMPTY_RECORD
    r = applyResult(r, { item: byId('2026#31'), correct: true, confused: false, sec: 1 }, new Date('2026-09-13T12:00:00+09:00'))
    r = applyResult(r, { item: byId('2026#32'), correct: true, confused: false, sec: 1 }, new Date('2026-09-14T08:00:00+09:00'))
    r = applyResult(r, { item: byId('2026#36'), correct: true, confused: false, sec: 1 }, NOW)
    expect(weekCount(r, NOW)).toBe(2)
  })

  it('유형 약칭이 조사에서 끊기지 않는다 — 「글의 목적」이 「글의」가 됐던 것', () => {
    expect(shortTypeName('글의 목적')).toBe('목적')
    expect(shortTypeName('빈칸 추론')).toBe('빈칸')
    expect(shortTypeName('장문 제목')).toBe('장문 제목')
    expect(shortTypeName('빈칸 추론(2개·폐지)')).toBe('빈칸 추론')
    for (const n of ['글의 순서', '무관한 문장', '내용 일치(글)']) {
      expect(shortTypeName(n)).not.toMatch(/(의|한)$/)
    }
  })

  it('회차 순서 — 모평 M2706(2027학년도 6월)이 2026 수능보다 최근', () => {
    expect(examOrder('M2706')).toBeGreaterThan(examOrder('2026'))
    expect(examOrder('2026')).toBeGreaterThan(examOrder('M2609'))
    expect(examOrder('2014B')).toBeGreaterThan(examOrder('2014A'))
  })
})
