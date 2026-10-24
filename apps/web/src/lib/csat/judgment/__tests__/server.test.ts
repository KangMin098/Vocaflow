// apps/web/src/lib/csat/judgment/__tests__/server.test.ts
// 서버 로더 — 가짜 DB 로 판본 결속 · 정답 미선택 · 실패 이유를 본다. 실제 DB 대조는 server.live.test.ts(명시 실행).
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { leakedAnswerKeys } from '../evidence'
import { loadJudgmentItem, loadJudgmentReveal } from '../server'

type Rows = Record<string, Record<string, unknown>[]>
function fakeDb(rows: Rows, failTable?: string) {
  const selects: { table: string; cols: string }[] = []
  const from = (table: string) => {
    const filters: [string, unknown][] = []
    let cols = ''
    const q = {
      select(c: string) { cols = c; selects.push({ table, cols: c }); return q },
      eq(k: string, v: unknown) { filters.push([k, v]); return q },
      limit() {
        if (table === failTable) return Promise.resolve({ data: null, error: { message: 'boom' } })
        const data = (rows[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v)).map((r) => Object.fromEntries(cols.split(',').map((s) => s.trim()).map((k) => [k, r[k]])))
        return Promise.resolve({ data, error: null })
      },
    }
    return q
  }
  return { db: { from } as never, selects }
}

const UNITS = [{ id: 'u1', n: 1, kind: 'sentence', text: 'A.', start: 0, end: 2 }, { id: 'u2', n: 2, kind: 'sentence', text: 'B.', start: 3, end: 5 }]
const CHOICES = ['a', 'b', 'c', 'd', 'e']
const base = (): Rows => ({
  csat_items: [{ id: 'H1#35', exam_id: 'H1', no: 35, type_id: 'R-IRRELEVANT', stem: '무관한 문장은?', choices: CHOICES, answer: 4 }],
  csat_item_analyses: [
    { item_id: 'H1#35', version: 2, status: 'published', units_version: 1, units_hash: 'h1', design_intent: '의도', answer_locus: { quote: 'q' }, choice_analysis: CHOICES.map((_, i) => ({ n: i + 1, verdict: i === 3 ? 'correct' : 'distractor' })) },
    { item_id: 'H1#35', version: 3, status: 'in_review', units_version: 1, units_hash: 'h1', design_intent: null, answer_locus: null, choice_analysis: [] },
  ],
  csat_item_units: [{ item_id: 'H1#35', units_version: 1, units_hash: 'h1', units: UNITS }],
})

describe('loadJudgmentItem', () => {
  it('페이지가 읽은 판본의 원문 단위로 문항을 만들고, 정답 컬럼을 select 하지 않는다', async () => {
    const { db, selects } = fakeDb(base())
    const r = await loadJudgmentItem(db, 'H1#35', 2)
    expect(r.state).toBe('ready')
    if (r.state !== 'ready') return
    expect(r.item.version).toEqual({ unitsVersion: 1, unitsHash: 'h1', analysisVersion: 2 })
    expect(r.item.units).toEqual([{ id: 'u1', n: 1, kind: 'sentence', text: 'A.' }, { id: 'u2', n: 2, kind: 'sentence', text: 'B.' }])
    expect(leakedAnswerKeys(r.item)).toEqual([])
    // 모든 테이블의 select 목록 — 정답 · 정답 위치 · 선지 판정 · 해설 컬럼이 하나도 없다(T-0151 P2-R2-01)
    const allCols = selects.map((s) => s.cols).join(',')
    for (const col of ['answer', 'design_intent', 'answer_locus', 'choice_analysis', 'why_correct', 'verdict']) expect(allCols, col).not.toContain(col)
    expect(selects.map((s) => s.table).sort()).toEqual(['csat_item_analyses', 'csat_item_units', 'csat_items'])
  })

  it.each([
    ['분석 해시 null', null],
    ['분석 해시 빈 문자열', ''],
  ] as const)('%s → 대조를 건너뛰지 않고 unavailable(T-0151 P2-R2-02)', async (_n, hash) => {
    const rows = base(); rows.csat_item_analyses[0].units_hash = hash
    expect(await loadJudgmentItem(fakeDb(rows).db, 'H1#35', 2)).toEqual({ state: 'unavailable', reason: 'version-mismatch' })
    expect(await loadJudgmentReveal(fakeDb(rows).db, 'H1#35', 2)).toBeNull()
  })

  it('원문 단위 쪽 해시가 비면 unavailable', async () => {
    const rows = { ...base(), csat_item_units: [{ item_id: 'H1#35', units_version: 1, units_hash: '', units: UNITS }] }
    expect(await loadJudgmentItem(fakeDb(rows).db, 'H1#35', 2)).toEqual({ state: 'unavailable', reason: 'version-mismatch' })
  })

  it.each([
    ['판본 없음(null)', base(), null, 'no-analysis'],
    ['published 아닌 판본', base(), 3, 'no-analysis'],
    ['원문 단위 해시 불일치', { ...base(), csat_item_units: [{ item_id: 'H1#35', units_version: 1, units_hash: 'OTHER', units: UNITS }] }, 2, 'version-mismatch'],
    ['원문 단위 없음', { ...base(), csat_item_units: [] }, 2, 'no-units'],
    ['선지 5개 아님', { ...base(), csat_items: [{ ...base().csat_items[0], choices: ['a'] }] }, 2, 'shape'],
    ['문항 없음', { ...base(), csat_items: [] }, 2, 'no-item'],
  ] as const)('%s → unavailable', async (_n, rows, v, reason) => {
    const { db } = fakeDb(rows as Rows)
    expect(await loadJudgmentItem(db, 'H1#35', v)).toEqual({ state: 'unavailable', reason })
  })

  it('DB 오류는 db 로 — 빈 결과로 삼키지 않는다', async () => {
    expect(await loadJudgmentItem(fakeDb(base(), 'csat_item_units').db, 'H1#35', 2)).toEqual({ state: 'unavailable', reason: 'db' })
  })
})

describe('loadJudgmentReveal', () => {
  it('같은 판본이면 정답 · 선지 분석을 판본과 함께 낸다', async () => {
    const r = await loadJudgmentReveal(fakeDb(base()).db, 'H1#35', 2)
    expect(r).toMatchObject({ id: 'H1#35', analysisVersion: 2, unitsVersion: 1, answer: 4, designIntent: '의도' })
    expect(r?.choices).toHaveLength(5)
  })
  it('판본이 다르거나 선지 분석이 5개가 아니면 null', async () => {
    expect(await loadJudgmentReveal(fakeDb(base()).db, 'H1#35', 3)).toBeNull()
    const rows = base(); rows.csat_item_analyses[0].choice_analysis = [{ n: 1 }]
    expect(await loadJudgmentReveal(fakeDb(rows).db, 'H1#35', 2)).toBeNull()
  })
})
