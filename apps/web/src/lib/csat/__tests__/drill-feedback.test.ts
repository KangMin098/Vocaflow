// apps/web/src/lib/csat/__tests__/drill-feedback.test.ts
//
// **기록이 훈련으로 되돌아오는 고리를 잠근다** (학습과학 원칙 2 · 간격 반복).
//
// 이 고리가 무너지는 방식은 전부 조용하다:
//   · 이미 익힌 문제가 끝없이 돌아온다(「틀린 적이 있다」로 골랐을 때)
//   · 방금 틀린 문제가 바로 다음 세트에 나온다(간격이 없으면 인출이 아니라 기억 재생이다)
//   · 편향 때문에 한 세트가 한두 수법만 묻는다(「넷 이상」 약속이 깨진다)
//   · 기록이 얇은데 세트를 기울인다(잡음을 키운다)
// 화면은 넷 다 멀쩡히 돈다.

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { MIN_TOTAL, drillBias, returningCardIds, summarizeMyTraps, type AttemptRow } from '../my-traps'
import { MAX_PER_TRAP, MAX_RETURNING, pickSet, type DrillCard } from '../trap-drill'

const POOL = (
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/csat/drill-data/pool.json'), 'utf8')) as {
    cards: DrillCard[]
  }
).cards

const NOW = new Date('2026-09-17T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString()
const att = (item: string, choice: number, ok: boolean, h: number): AttemptRow => ({
  item_id: item,
  choice,
  is_correct: ok,
  answered_at: hoursAgo(h),
})

describe('returningCardIds — 무엇이 되돌아오나', () => {
  it('하루 넘게 지난 오답만 돌아온다', () => {
    const ids = returningCardIds([att('A', 1, false, 30), att('B', 2, false, 2)], NOW)
    expect(ids).toEqual(['A:1'])
  })

  it('가장 최근 시도로 본다 — 틀린 뒤 맞혔으면 안 돌아온다', () => {
    // 「틀린 적이 있다」로 고르면 이미 익힌 문제가 끝없이 돌아온다.
    const ids = returningCardIds([att('A', 1, false, 72), att('A', 1, true, 30)], NOW)
    expect(ids).toEqual([])
  })

  it('맞혔다가 나중에 틀렸으면 돌아온다', () => {
    const ids = returningCardIds([att('A', 1, true, 72), att('A', 1, false, 30)], NOW)
    expect(ids).toEqual(['A:1'])
  })

  it('같은 문항의 다른 선지는 다른 카드다', () => {
    const ids = returningCardIds([att('A', 1, false, 30), att('A', 3, false, 40)], NOW)
    expect(new Set(ids)).toEqual(new Set(['A:1', 'A:3']))
  })

  it('오래 기다린 것부터 온다', () => {
    const ids = returningCardIds([att('A', 1, false, 30), att('B', 1, false, 90), att('C', 1, false, 50)], NOW)
    expect(ids).toEqual(['B:1', 'C:1', 'A:1'])
  })

  it('시각 형식이 달라도 순서가 뒤집히지 않는다', () => {
    // PostgREST 는 'T' 구분자를 주지만, 다른 경로는 공백을 줄 수 있다. 문자열로 견주면
    // '2026-09-15 …' 와 '2026-09-15T…' 의 순서가 형식 때문에 갈린다.
    const rows: AttemptRow[] = [
      { item_id: 'A', choice: 1, is_correct: false, answered_at: '2026-09-15T10:00:00+00:00' },
      { item_id: 'A', choice: 1, is_correct: true, answered_at: '2026-09-16 10:00:00+00' },
    ]
    expect(returningCardIds(rows, NOW)).toEqual([])
  })
})

describe('drillBias — 두 신호의 문턱이 다르다', () => {
  const thin = summarizeMyTraps([
    { answer_trap: '무관', is_correct: false },
    { answer_trap: '무관', is_correct: false },
    { answer_trap: '무관', is_correct: false },
  ])
  const thick = summarizeMyTraps(
    Array.from({ length: MIN_TOTAL }, (_, i) => ({ answer_trap: '무관', is_correct: i >= 15 })),
  )

  it('기록이 얇으면 수법 편향은 없다 — 되돌아오는 문제는 그래도 낸다', () => {
    // 되돌아오는 문제는 특정 카드를 다시 묻는 것이라 분포에 대한 주장이 아니다.
    expect(thin.enough).toBe(false)
    expect(drillBias(thin, ['A:1'])).toEqual({ weak: [], returning: ['A:1'] })
  })

  it('기록이 두꺼우면 되풀이해 놓친 수법을 넘긴다', () => {
    expect(thick.enough).toBe(true)
    expect(drillBias(thick, [])?.weak).toEqual(['무관'])
  })

  it('넘길 것이 없으면 null — 편향 없는 뽑기와 같아야 한다', () => {
    expect(drillBias(thin, [])).toBeNull()
  })
})

describe('pickSet — 편향이 약속을 깨지 않는다', () => {
  it('편향 없이는 예전 뽑기와 같다 — 같은 씨앗, 같은 세트', () => {
    const a = pickSet(POOL, 'same', 8).cards.map((c) => c.id)
    const b = pickSet(POOL, 'same', 8, null).cards.map((c) => c.id)
    expect(a).toEqual(b)
  })

  it('되돌아오는 카드가 먼저 들어가고, 상한을 넘지 않는다', () => {
    const ids = POOL.slice(0, 5).map((c) => c.id)
    const r = pickSet(POOL, 's', 8, { weak: [], returning: ids })
    expect(r.returningIds.length).toBeLessThanOrEqual(MAX_RETURNING)
    expect(r.returningIds.length).toBeGreaterThan(0)
    for (const id of r.returningIds) expect(r.cards.map((c) => c.id)).toContain(id)
  })

  it('풀에서 사라진 카드는 조용히 건너뛴다', () => {
    const r = pickSet(POOL, 's', 8, { weak: [], returning: ['없는문항#99:9'] })
    expect(r.returningIds).toEqual([])
    expect(r.cards).toHaveLength(8)
  })

  it('자주 놓치는 수법이 자리를 받지만 세트는 여전히 넷 이상의 수법을 묻는다', () => {
    const weak = [POOL[0]!.answer]
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const r = pickSet(POOL, seed, 8, { weak, returning: [] })
      expect(r.boosted).toEqual(weak)
      expect(r.cards.filter((c) => c.answer === weak[0]).length).toBeGreaterThan(0)
      const kinds = new Set(r.cards.map((c) => c.answer)).size
      expect(kinds, `씨앗 ${seed}: 편향 때문에 ${kinds}종으로 줄었다`).toBeGreaterThanOrEqual(4)
    }
  })

  it('어떤 편향에서도 수법당 상한과 문항 중복 금지를 지킨다', () => {
    const traps = [...new Set(POOL.map((c) => c.answer))]
    const r = pickSet(POOL, 'x', 8, { weak: traps, returning: POOL.slice(0, 10).map((c) => c.id) })
    const per = new Map<string, number>()
    for (const c of r.cards) per.set(c.answer, (per.get(c.answer) ?? 0) + 1)
    for (const [k, n] of per) expect(`${k}:${n <= MAX_PER_TRAP}`).toBe(`${k}:true`)
    expect(new Set(r.cards.map((c) => c.item_id)).size).toBe(r.cards.length)
    expect(r.cards).toHaveLength(8)
  })

  it('편향이 새 수법을 만날 자리를 다 먹지 않는다 — 남은 칸의 절반까지만', () => {
    const weak = [POOL[0]!.answer, POOL.find((c) => c.answer !== POOL[0]!.answer)!.answer]
    const r = pickSet(POOL, 'y', 8, { weak, returning: [] })
    const boostedCount = r.cards.filter((c) => weak.includes(c.answer)).length
    // 절반(4)까지 편향으로 채울 수 있지만, 나머지 뽑기에서 우연히 더 들어올 수는 있다.
    // 단 수법당 상한 2 × 2수법 = 4 를 넘을 수는 없다.
    expect(boostedCount).toBeLessThanOrEqual(4)
  })
})
