// apps/web/src/components/csat/judgment/__tests__/type-judgment-pilot.test.tsx
// U02-ORDER-PILOT-01 — 공유 화면이 넘기는 stages={['first']} 에서 OrderTool 은 파일럿 한 문항 · 고정 판본일 때만 보인다(loader · route 와 같은 판정).
// 도구 문항은 실제 loader 가 실 입력(r-order-pilot.input.json)으로 만든 것을 그대로 쓴다.
import { renderToString } from 'react-dom/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import pilotInput from '@/lib/csat/judgment/fixtures/r-order-pilot.input.json'
import { itemsOf } from '@/lib/csat/judgment/fixtures'
import type { JudgmentItem } from '@/lib/csat/judgment/types'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/csat/lecture/store', () => ({ lectureMeta: () => null }))

import { loadBoundJudgmentItem } from '@/app/api/csat/item/[slug]/judgment/bound-item'
import { TypeJudgment, hasJudgmentTool } from '../TypeJudgment'

type Input = { item: Record<string, unknown> & { id: string }; units: Record<string, unknown>; inputHash: string; analyses: unknown[] }
const real = pilotInput as unknown as Input
function db() {
  const q = (data: unknown) => {
    const chain: Record<string, unknown> = {}
    for (const k of ['select', 'eq', 'limit']) chain[k] = () => chain
    chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok)
    return chain
  }
  return {
    from: (t: string) => q(t === 'csat_items' ? [real.item] : real.analyses),
    rpc: async (fn: string) => (fn.startsWith('csat_ec_') ? { data: [], error: null } : fn === 'csat_current_units_many' ? { data: [real.units], error: null } : { data: real.inputHash, error: null }),
  } as never
}

let pilot: JudgmentItem
beforeAll(async () => {
  const out = await loadBoundJudgmentItem(db(), 'H2609G2#36', 1)
  if (!out.item) throw new Error('파일럿 문항을 만들지 못함')
  pilot = out.item
})
const render = (item: JudgmentItem) => renderToString(<TypeJudgment item={item} reveal={vi.fn()} stages={['first']} />)

describe('TypeJudgment — first 화면의 R-ORDER 파일럿', () => {
  it('파일럿 문항 · 고정 판본 → OrderTool(배열 6 · 선지 5 · 해설 보기) · 정답 표지 없음', () => {
    const html = render(pilot)
    expect((html.match(/data-move=/g) ?? []).length).toBe(6)
    expect((html.match(/data-choice=/g) ?? []).length).toBe(5)
    expect(html).toContain('해설 보기')
    expect(html).not.toMatch(/data-revealed|해설의 정답|해설의 순서/)
  })
  it('같은 문항이라도 판본이 다르면(분석 v2 · units 해시) → 그리지 않는다', () => {
    expect(render({ ...pilot, version: { ...pilot.version, analysisVersion: 2 } })).toBe('')
    expect(render({ ...pilot, version: { ...pilot.version, unitsHash: 'f'.repeat(64) } })).toBe('')
  })
  it('다른 R-ORDER 문항(격리 픽스처 H2609G2#37) → 그리지 않는다 · 픽스처의 #36 은 같은 고정 판본이라 그린다', () => {
    const others = itemsOf('R-ORDER').filter((x) => x.id !== 'H2609G2#36')
    expect(others.map((x) => x.id)).toEqual(['H2609G2#37'])
    for (const other of others) expect(render(other)).toBe('')
    expect(render(itemsOf('R-ORDER').find((x) => x.id === 'H2609G2#36')!)).not.toBe('')
  })
  it('기존 R-IRRELEVANT first 는 그대로 · 다른 격리 유형은 그대로 숨김', () => {
    for (const it of itemsOf('R-IRRELEVANT')) expect(render(it)).not.toBe('')
    for (const it of itemsOf('R-SUMMARY')) expect(render(it)).toBe('')
  })
  it('isolated 단계를 직접 요청하는 격리 검증 경로는 기존과 같다', () => {
    const other = itemsOf('R-ORDER').find((x) => x.id === 'H2609G2#37')!
    expect(renderToString(<TypeJudgment item={other} reveal={vi.fn()} stages={['isolated']} />)).not.toBe('')
    expect(hasJudgmentTool('R-ORDER')).toBe(false)
  })
})
