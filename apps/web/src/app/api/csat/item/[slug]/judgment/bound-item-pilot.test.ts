// apps/web/src/app/api/csat/item/[slug]/judgment/bound-item-pilot.test.ts
//
// U02-ORDER-PILOT-01 — R-ORDER 는 파일럿 한 문항(H2609G2#36) · 고정 판본에서만 도구 문항을 만든다.
// 실 입력: lib/csat/judgment/fixtures/r-order-pilot.input.json = dev SELECT 결과 그대로(mc-u02o-input.json, sha 1903fa4c…) — 손으로 만든 문항이 아니다.
// G 어댑터 → toJudgmentItem → 무효화 판정 → 파일럿 판본 판정까지 실제 loader 를 태우고, 다른 문항 · 판본/units/원문 해시 불일치 · 보류 · 강의는 닫힌다.
import { beforeEach, describe, expect, it, vi } from 'vitest'

import pilotInput from '@/lib/csat/judgment/fixtures/r-order-pilot.input.json'
import { leakedAnswerKeys } from '@/lib/csat/judgment/evidence'
import { parseOrder } from '@/lib/csat/judgment/r-order'

vi.mock('server-only', () => ({}))
const st = vi.hoisted(() => ({ lecture: false, held: false }))
vi.mock('@/lib/csat/lecture/store', () => ({ lectureMeta: () => (st.lecture ? { sec: 60, cues: 3 } : null) }))

import { loadBoundJudgmentItem } from './bound-item'

type Input = { item: Record<string, unknown> & { id: string }; units: Record<string, unknown>; inputHash: string; analyses: Array<Record<string, unknown>> }
const real = pilotInput as unknown as Input
const PILOT = 'H2609G2#36'

function db(over: { item?: Record<string, unknown>; units?: Record<string, unknown> | null; inputHash?: string; analyses?: Array<Record<string, unknown>> } = {}) {
  const item = { ...real.item, ...(over.item ?? {}) }
  const q = (data: unknown) => {
    const chain: Record<string, unknown> = {}
    for (const k of ['select', 'eq', 'limit']) chain[k] = () => chain
    chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok)
    return chain
  }
  const units = over.units === undefined ? { ...real.units, item_id: item.id } : over.units
  return {
    from: (t: string) => q(t === 'csat_items' ? [item] : over.analyses ?? real.analyses),
    rpc: async (fn: string) =>
      fn === 'csat_ec_embargoed_items'
        ? { data: st.held ? [item.id] : [], error: null }
        : fn === 'csat_ec_embargoed_exams'
          ? { data: [], error: null }
          : fn === 'csat_current_units_many'
            ? { data: units ? [units] : [], error: null }
            : { data: over.inputHash ?? real.inputHash, error: null },
  } as never
}

beforeEach(() => {
  st.lecture = false
  st.held = false
})

describe('파일럿 H2609G2#36 — 실 입력', () => {
  it('도구 문항을 만든다 — 고정 판본 · 초기 DTO 에 정답 · 선지 분석 없음 · 순서 모델 성립', async () => {
    const out = await loadBoundJudgmentItem(db(), PILOT, 1)
    expect(out.item).not.toBeNull()
    const item = out.item!
    expect(item.typeId).toBe('R-ORDER')
    expect(item.version).toEqual({ unitsVersion: 1, unitsHash: '138a1c06dad25b467641b80a2dfaaa62f040be95f4bd08abf70ad39595b54a28', analysisVersion: 1 })
    expect(leakedAnswerKeys(item)).toEqual([])
    expect(JSON.stringify(item)).not.toMatch(/"answer"|"answers"|choice_analysis|answer_locus/)
    const order = parseOrder(item.units)
    expect(order).not.toBeNull()
  })
})

describe('파일럿 밖은 기존처럼 닫힌다', () => {
  it('다른 R-ORDER 문항(같은 자료 · 다른 id) → no_tool(결속을 읽지 않는다)', async () => {
    expect(await loadBoundJudgmentItem(db({ item: { id: 'H2609G2#37', no: 37 } }), 'H2609G2#37', 1)).toEqual({ item: null, reason: 'no_tool' })
  })
  it('같은 id 인데 유형이 R-ORDER 가 아니면(격리 유형) → no_tool', async () => {
    expect(await loadBoundJudgmentItem(db({ item: { type_id: 'R-SUMMARY' } }), PILOT, 1)).toEqual({ item: null, reason: 'no_tool' })
  })
  it('분석 판본이 바뀜(published v2 · 같은 단위) → pilot_version', async () => {
    const v2 = real.analyses.map((a) => ({ ...a, version: 2 }))
    expect(await loadBoundJudgmentItem(db({ analyses: v2 }), PILOT, 2)).toEqual({ item: null, reason: 'pilot_version' })
  })
  it('극장 판본과 다름(expectedVersion 2) → version_mismatch', async () => {
    expect((await loadBoundJudgmentItem(db(), PILOT, 2)).item).toBeNull()
  })
  it('units 판본이 바뀜(units_version 2) → 닫힘', async () => {
    const units = { ...real.units, item_id: PILOT, units_version: 2 }
    const analyses = real.analyses.map((a) => ({ ...a, units_version: 2 }))
    expect((await loadBoundJudgmentItem(db({ units, analyses }), PILOT, 1)).item).toBeNull()
  })
  it('units 해시가 바뀜 → 닫힘', async () => {
    const units = { ...real.units, item_id: PILOT, units_hash: 'f'.repeat(64) }
    const analyses = real.analyses.map((a) => ({ ...a, units_hash: 'f'.repeat(64) }))
    expect((await loadBoundJudgmentItem(db({ units, analyses }), PILOT, 1)).item).toBeNull()
  })
  it('원문이 바뀜(원문 해시 불일치) → 닫힘', async () => {
    const out = await loadBoundJudgmentItem(db({ item: { passage: `${String(real.item.passage)} ` }, units: null, inputHash: 'e'.repeat(64) }), PILOT, 1)
    expect(out.item).toBeNull()
  })
  it('보류 문항 → held(정답 표를 읽기 전)', async () => {
    st.held = true
    expect(await loadBoundJudgmentItem(db(), PILOT, 1)).toEqual({ item: null, reason: 'held' })
  })
  it('강의가 생기면 → lecture_present', async () => {
    st.lecture = true
    expect(await loadBoundJudgmentItem(db(), PILOT, 1)).toEqual({ item: null, reason: 'lecture_present' })
  })
  it('분석 없음 → no_analysis', async () => {
    expect(await loadBoundJudgmentItem(db(), PILOT, null)).toEqual({ item: null, reason: 'no_analysis' })
  })
})
