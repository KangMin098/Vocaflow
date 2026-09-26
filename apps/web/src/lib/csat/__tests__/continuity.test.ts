// apps/web/src/lib/csat/__tests__/continuity.test.ts
import { describe, expect, it } from 'vitest'

import {
  DAY,
  activeSet,
  compressDue,
  coverage,
  dueBucket,
  dueNow,
  gapBucket,
  gapDays,
  mergeDissection,
  sameRecord,
  studyDays,
  upcoming,
  visitState,
  withView,
} from '../continuity'
import { emptyDissectionRecord, type DissectionRecord } from '../dissect'

// 시계를 읽지 않는다 — 고정 시각(AGENTS 「시계를 직접 읽는 코드·테스트」).
const NOW = Date.UTC(2026, 8, 24, 12)
const base = (over: Partial<DissectionRecord> = {}): DissectionRecord => ({ ...emptyDissectionRecord(1), ...over })

describe('visitState', () => {
  it('기록이 없으면 첫 방문 — 온보딩 표시만 켠 것도 첫 방문', () => {
    expect(visitState(base(), NOW)).toBe('first')
    expect(visitState(base({ onboarded: true }), NOW)).toBe('first')
  })
  it('사흘 안이면 재방문, 사흘 이상 비면 공백 복귀', () => {
    expect(visitState(base({ completed: [{ id: 'a', at: NOW - 2 * DAY }] }), NOW)).toBe('return')
    expect(visitState(base({ completed: [{ id: 'a', at: NOW - 3 * DAY }] }), NOW)).toBe('comeback')
    expect(gapDays(base({ views: [{ id: 'a', at: NOW - 8 * DAY }] }), NOW)).toBe(8)
  })
  it('진행 중 세트만 있어도 첫 방문이 아니다', () => {
    expect(visitState(base({ active: { items: ['a', 'b', 'c'], index: 1, pairSeen: false, loci: {} } }), NOW)).toBe('return')
  })
})

describe('compressDue', () => {
  const queue = Array.from({ length: 9 }, (_, i) => ({ tag: `t${i}`, source: `s${i}`, due: NOW - (9 - i) * DAY }))
  it('밀린 9개 중 가장 오래된 3개만 오늘 남기고 나머지는 하루 3개씩 뒤로 민다', () => {
    const out = compressDue(base({ queue }), NOW)
    expect(dueNow(out, NOW).map((q) => q.tag)).toEqual(['t0', 't1', 't2'])
    const tomorrow = Math.floor(NOW / DAY) * DAY + DAY
    expect(out.queue.filter((q) => q.due === tomorrow).map((q) => q.tag)).toEqual(['t3', 't4', 't5'])
    expect(out.queue.filter((q) => q.due === tomorrow + DAY).map((q) => q.tag)).toEqual(['t6', 't7', 't8'])
  })
  it('3개 이하면 같은 객체를 돌려준다(저장하지 않게)', () => {
    const rec = base({ queue: queue.slice(0, 3) })
    expect(compressDue(rec, NOW)).toBe(rec)
  })
})

describe('activeSet · upcoming · studyDays', () => {
  it('남은 문항과 분', () => {
    expect(activeSet(base({ active: { items: ['a', 'b', 'c'], index: 1, pairSeen: false, loci: {} } }))).toMatchObject({ remaining: 2, minutes: 8, first: 'b' })
    expect(activeSet(base({ active: { items: ['a'], index: 1, pairSeen: false, loci: {} } }))).toBeNull()
  })
  it('오늘 · 내일 · 이번 주 복습 수', () => {
    const endToday = Math.floor(NOW / DAY) * DAY + DAY
    const rec = base({ queue: [{ tag: 'a', source: 'x', due: NOW - DAY }, { tag: 'b', source: 'x', due: endToday + 10 }, { tag: 'c', source: 'x', due: endToday + 3 * DAY }] })
    expect(upcoming(rec, NOW)).toEqual({ today: 1, tomorrow: 1, week: 3 })
  })
  it('학습한 날 칸 — 오늘이 마지막 칸', () => {
    const days = studyDays(base({ completed: [{ id: 'a', at: NOW }, { id: 'b', at: NOW - 2 * DAY }] }), NOW, 5)
    expect(days).toEqual([false, false, true, false, true])
  })
})

describe('coverage · withView', () => {
  it('완료 · 열람 · 먼저 읽기를 합쳐 본 문항과 유형을 센다', () => {
    const typeOf = (id: string) => ({ a: 'T1', b: 'T1', c: 'T2' })[id]
    let rec = base({ completed: [{ id: 'a', at: 1 }], inspected: ['b'], predictions: [{ item: 'a', type: 'T1', step: 1, hit: true, at: 1, family: '반대 진술' }] })
    rec = withView(rec, 'c', NOW)
    const cov = coverage(rec, typeOf)
    expect(cov).toMatchObject({ items: 3, types: 2, families: 1, formulas: 0 })
    expect(cov.byType.get('T1')).toBe(2)
    expect(rec.updatedAt).toBe(NOW)
  })
  it('같은 문항을 다시 열면 시각만 바뀐다', () => {
    const rec = withView(withView(base(), 'a', 1), 'a', 2)
    expect(rec.views).toEqual([{ id: 'a', at: 2 }])
  })
})

describe('mergeDissection', () => {
  it('쌓이는 것은 합집합, 공식은 출처를 합친다', () => {
    const local = base({ updatedAt: 10, completed: [{ id: 'a', at: 1 }], formulas: [{ tag: 'f', text: 'x', type: 'T', sources: ['a'] }] })
    const server = base({ updatedAt: 5, completed: [{ id: 'b', at: 2 }], formulas: [{ tag: 'f', text: 'x', type: 'T', sources: ['b'] }], onboarded: true })
    const out = mergeDissection(local, server)
    expect(out.completed.map((c) => c.id)).toEqual(['a', 'b'])
    expect(out.formulas[0].sources.sort()).toEqual(['a', 'b'])
    expect(out.onboarded).toBe(true)
    expect(out.updatedAt).toBe(10)
  })
  it('복습 큐가 겹치면 최근에 고친 쪽, 한쪽에만 있으면 살린다', () => {
    const local = base({ updatedAt: 1, queue: [{ tag: 'f', source: 'a', due: 100 }, { tag: 'g', source: 'a', due: 5 }] })
    const server = base({ updatedAt: 2, queue: [{ tag: 'f', source: 'b', due: 200 }] })
    const out = mergeDissection(local, server)
    expect(out.queue).toEqual([{ tag: 'f', source: 'b', due: 200 }, { tag: 'g', source: 'a', due: 5 }])
  })
  it('진행 중 세트는 최근에 고친 쪽', () => {
    const local = base({ updatedAt: 1, active: { items: ['a', 'b', 'c'], index: 0, pairSeen: false, loci: {} } })
    const server = base({ updatedAt: 9, active: { items: ['a', 'b', 'c'], index: 2, pairSeen: true, loci: {} } })
    expect(mergeDissection(local, server).active?.index).toBe(2)
  })
  it('같은 기록이면 sameRecord 가 참 — 키 순서와 무관', () => {
    const a = base({ queue: [{ tag: 'f', source: 'a', due: 1 }] })
    const { queue, ...rest } = a
    const b = JSON.parse(JSON.stringify({ queue, ...rest })) as DissectionRecord
    expect(sameRecord(a, b)).toBe(true)
    expect(sameRecord(a, { ...a, onboarded: true })).toBe(false)
  })
})

describe('이벤트 버킷', () => {
  it('닫힌 열거형으로만 나간다', () => {
    expect([0, 2, 3, 4].map(dueBucket)).toEqual(['0', '1-3', '1-3', '4+'])
    expect([0, 1, 2, 3, 6, 7].map(gapBucket)).toEqual(['0', '1-2', '1-2', '3-6', '3-6', '7+'])
  })
})
