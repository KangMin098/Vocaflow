// apps/web/src/components/csat/judgment/__tests__/OrderTool.compare.test.tsx
// @vitest-environment node
// U02-ORDER-COMPARE-01 — 해설 요청 순간 배열 · 연결 스냅샷 규칙, 같은 단서(cueId)끼리 맞춘 당시/지금 비교 행,
// 실제 OrderTool + T-0232 파일럿 실 입력(r-order-pilot.input.json) 초기 화면.
// 화면 흐름(대기 중 조작 · 연속 입력 호출 수 · 실패 뒤 재시도 · 문항 교체 뒤 늦은 응답)은 PC 하네스(pd-t237-r1)가 실제 컴포넌트로 잰다.
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import pilotInput from '@/lib/csat/judgment/fixtures/r-order-pilot.input.json'
import type { Link } from '@/lib/csat/judgment/r-order'
import type { JudgmentItem } from '@/lib/csat/judgment/types'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/csat/lecture/store', () => ({ lectureMeta: () => null }))

import { loadBoundJudgmentItem } from '@/app/api/csat/item/[slug]/judgment/bound-item'
import { OrderTool, orderCompareRows, orderSnapshotOnRequest, type OrderSnapshot } from '../OrderTool'

const L = (cueId: string, antecedent: string, para: 'A' | 'B' | 'C' = 'B'): Link => ({ cueId, para, cueText: `cue-${cueId}`, kind: 'demonstrative' as Link['kind'], antecedent, antecedentPara: 'G' })
const S = (arr: OrderSnapshot['arr'], links: Link[]): OrderSnapshot => ({ arr, links })

describe('orderSnapshotOnRequest', () => {
  it('hidden · error 에서 누르면 지금 값을 복사한다 — 지금 state 와 공유하지 않는다(재시도는 새 스냅샷)', () => {
    const cur = S(['B', 'A', 'C'], [L('B-1', 'u1')])
    const snap = orderSnapshotOnRequest(null, cur, 'hidden')!
    expect(snap).toEqual(cur)
    expect(snap).not.toBe(cur)
    expect(snap.arr).not.toBe(cur.arr)
    expect(snap.links[0]).not.toBe(cur.links[0])
    cur.arr[0] = 'C'
    cur.links[0].antecedent = 'u9'
    expect(snap.arr[0]).toBe('B')
    expect(snap.links[0].antecedent).toBe('u1')
    const retry = orderSnapshotOnRequest(snap, S(['C', 'B', 'A'], []), 'error')!
    expect(retry).toEqual(S(['C', 'B', 'A'], []))
  })
  it('loading 중 중복 누름 · shown 뒤에는 그 요청의 스냅샷을 지킨다', () => {
    const prev = S(['A', 'B', 'C'], [])
    const cur = S(['C', 'A', 'B'], [L('A-1', 'u2')])
    expect(orderSnapshotOnRequest(prev, cur, 'loading')).toBe(prev)
    expect(orderSnapshotOnRequest(prev, cur, 'shown')).toBe(prev)
    expect(orderSnapshotOnRequest(null, cur, 'loading')).toBeNull()
  })
})

describe('orderCompareRows — 같은 cueId 기준', () => {
  it('그대로 · 대상 바꿈 · 지움 · 새로 이음을 모두 남긴다(당시 순서 뒤에 새 연결)', () => {
    const asked = S(['B', 'A', 'C'], [L('B-1', 'u1'), L('C-2', 'u4', 'C'), L('A-1', 'u3', 'A')])
    const now = S(['B', 'A', 'C'], [L('A-1', 'u3', 'A'), L('B-1', 'u2'), L('C-9', 'u5', 'C')])
    expect(orderCompareRows(asked, now).map((r) => [r.cueId, r.asked, r.now, r.change])).toEqual([
      ['B-1', 'u1', 'u2', 'changed'],
      ['C-2', 'u4', null, 'removed'],
      ['A-1', 'u3', 'u3', 'same'],
      ['C-9', null, 'u5', 'added'],
    ])
  })
  it('배열만 바뀌고 연결이 같으면 연결 행은 모두 그대로', () => {
    const asked = S(['A', 'B', 'C'], [L('B-1', 'u1')])
    const rows = orderCompareRows(asked, S(['C', 'A', 'B'], [L('B-1', 'u1')]))
    expect(rows).toEqual([{ cueId: 'B-1', para: 'B', cueText: 'cue-B-1', asked: 'u1', now: 'u1', change: 'same' }])
  })
  it('양쪽 연결이 없으면 행 0(화면은 「표시한 연결 없음」)', () => {
    expect(orderCompareRows(S(['A', 'B', 'C'], []), S(['A', 'B', 'C'], []))).toEqual([])
  })
})

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

describe('실제 OrderTool + 파일럿 실 입력', () => {
  it('요청 전에는 비교가 없고 provider 를 부르지 않는다', () => {
    const reveal = vi.fn()
    const html = renderToString(<OrderTool item={pilot} reveal={reveal} />)
    expect(reveal).not.toHaveBeenCalled()
    expect(html).not.toContain('data-order-compare')
    expect(html).not.toContain('해설 요청 당시')
    expect(html).toContain('해설 보기')
  })
})

describe('문구 — 당시 값을 정답 보기 전 · 독립 수행으로 부르지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../OrderTool.tsx'), 'utf8')
  const ui = src.slice(src.indexOf('function OrderCompare'), src.indexOf('/** 문항(id · 판본)이 바뀌면'))
  it('「초기 배열일 수 있다」 보충이 있고 금지 표현이 없다', () => {
    expect(ui).toContain('해설 요청 당시')
    expect(ui).toContain('초기 배열일 수 있다')
    for (const bad of ['정답 보기 전', '첫 시도', '독립', '도움 없이', '향상', '점수']) expect(ui).not.toContain(bad)
  })
  it('해설 · 재시도 버튼은 모두 스냅샷을 잡는 ask 를 거친다(request 직접 호출 0)', () => {
    expect(src).not.toMatch(/onClick=\{request\}/)
    expect((src.match(/onClick=\{ask\}/g) ?? []).length).toBe(2)
  })
})
