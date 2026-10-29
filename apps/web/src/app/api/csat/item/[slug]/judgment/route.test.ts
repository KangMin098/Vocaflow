// apps/web/src/app/api/csat/item/[slug]/judgment/route.test.ts
//
// 판단 라우트 — 노출 원장 기록이 성공해야만 정답 자료를 돌려준다(fail-closed). 인증 · 보류 · 판본 결속 · no-store.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const st = vi.hoisted(() => ({
  user: 'u1' as string | null,
  open: true,
  version: 4 as number | null,
  rpc: { data: 77 as unknown, error: null as null | { code: string } },
  calls: [] as string[],
  bound: { id: '2014A#23', version: { unitsVersion: 1, unitsHash: 'h1', analysisVersion: 4 } } as null | { id: string; version: { unitsVersion: number; unitsHash: string; analysisVersion: number } },
  revealHash: 'h1',
  type: 'R-IRRELEVANT' as string | null,
  boundSeq: [] as (null | 'other')[],
}))

vi.mock('@/lib/csat/diagnosis/route-helpers', async () => {
  const { NextResponse } = await import('next/server')
  return {
    readJson: async (req: Request) => req.json().catch(() => null),
    learnerContext: async () => {
      if (!st.user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
      return {
        userId: st.user,
        email: 'learner@example.com',
        db: {
          rpc: async (name: string, args: Record<string, unknown>) => {
            st.calls.push(`rpc:${name}:${args.p_kind}:${args.p_source}:${args.p_item_ref}:${args.p_analysis_version}`)
            return st.rpc
          },
        },
      }
    },
  }
})
vi.mock('@/lib/csat/embargo-gate', () => ({
  canRevealItem: async () => st.open,
  revealHeldResponse: () => new Response(JSON.stringify({ held: 'exam_embargo' }), { status: 423, headers: { 'cache-control': 'no-store' } }),
}))
vi.mock('@/lib/csat/learner', () => ({
  loadCsatItemExplain: async (id: string) => ({ item: { id, analysis_version: st.version, type_id: st.type }, error: null, held: false }),
}))
vi.mock('@/lib/csat/judgment-reveal', () => ({
  loadTheaterAnswer: async () => {
    st.calls.push('load-reveal')
    return { reveal: { analysisVersion: st.version, gate: { answer: 5, evidence: [6], selection: null, transform_note: null }, blocks: [{ key: 'analysis:answer', kind: 'answer', title: '답이 왜 이것인가', chips: [], body: ['정답 근거'], quote: null }] } }
  },
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('./bound-item', () => ({
  JUDGMENT_TOOL_TYPES: new Set(['R-IRRELEVANT']),
  loadBoundJudgmentItem: async (_db: unknown, id: string, v: number | null) => {
    st.calls.push(`bound:${id}:${v}`)
    const next = st.boundSeq.shift()
    if (next === null || !st.bound) return { item: null, reason: 'stale' }
    return { item: next === 'other' ? { ...st.bound, version: { ...st.bound.version, unitsHash: 'h2' } } : st.bound }
  },
}))
vi.mock('@/lib/csat/judgment/server', () => ({
  loadJudgmentReveal: async (_db: unknown, id: string, v: number) => {
    st.calls.push(`judgment-reveal:${v}`)
    return { id, analysisVersion: v, unitsVersion: 1, unitsHash: st.revealHash, answer: 3, choices: [] }
  },
}))

import { leakedAnswerKeys } from '@/lib/csat/judgment/evidence'
import { POST } from './route'

/** 정답 자료가 전혀 없는 응답인지 — T-0171 별칭 전체 + 극장 공개 자료 키 + 해설 문구 */
async function assertNoAnswer(res: Response) {
  const text = await res.text()
  const j = JSON.parse(text) as unknown
  expect(leakedAnswerKeys(j)).toEqual([])
  expect(text).not.toMatch(/"reveal"|"judgment"|"gate"|"blocks"|정답 근거/)
}

const body = (o: Record<string, unknown> = {}) => ({ analysisVersion: 4, clientExposureId: '0b0c8f0e-1b2a-4c3d-8e9f-0a1b2c3d4e5f', source: 'judgment_scene', ...o })
const call = (o?: Record<string, unknown>, slug = '2014A-23') =>
  POST(new Request('http://x/api/csat/item/x/judgment', { method: 'POST', body: JSON.stringify(body(o)) }), { params: Promise.resolve({ slug }) })

describe('판단 라우트 — 기록 뒤에만 정답', () => {
  beforeEach(() => {
    st.user = 'u1'
    st.open = true
    st.version = 4
    st.rpc = { data: 77, error: null }
    st.calls = []
    st.bound = { id: '2014A#23', version: { unitsVersion: 1, unitsHash: 'h1', analysisVersion: 4 } }
    st.revealHash = 'h1'
    st.type = 'R-IRRELEVANT'
    st.boundSeq = []
  })

  it('성공 — answer_direct · judgment_scene 기록이 공개 자료보다 먼저, no-store', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const j = await res.json()
    expect(j).toMatchObject({ ok: true, exposureId: 77, reveal: { gate: { answer: 5 } } })
    expect(st.calls).toEqual(['bound:2014A#23:4', 'rpc:learning_exposure_record:answer_direct:judgment_scene:2014A#23:4', 'bound:2014A#23:4', 'judgment-reveal:4', 'load-reveal'])
    expect(j.judgment).toMatchObject({ answer: 3, analysisVersion: 4, unitsHash: 'h1' })
  })

  it('기록 실패 → 503 · 정답 자료 없음 · 공개 자료를 만들지도 않는다', async () => {
    st.rpc = { data: null, error: { code: '42501' } }
    const res = await call()
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const text = await res.text()
    expect(text).not.toMatch(/reveal|answer|정답 근거/)
    expect(st.calls.some((c) => c.startsWith('judgment-reveal'))).toBe(false)
  })

  it('기록 id 가 없으면(커밋 확인 실패) 503', async () => {
    st.rpc = { data: null, error: null }
    expect((await call()).status).toBe(503)
    expect(st.calls).not.toContain('load-reveal')
  })

  it('비로그인 401 · 기록 없음', async () => {
    st.user = null
    const res = await call()
    expect(res.status).toBe(401)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(st.calls).toEqual([])
  })

  it('보류 문항 423 · 기록 없음', async () => {
    st.open = false
    expect((await call()).status).toBe(423)
    expect(st.calls).toEqual([])
  })

  it('분석 판본이 바뀌었으면 409 · 기록 없음', async () => {
    expect((await call({ analysisVersion: 3 })).status).toBe(409)
    expect(st.calls).toEqual([])
  })

  it('형식 오류 400 · 문항 모양 아님 404', async () => {
    expect((await call({ clientExposureId: 'nope' })).status).toBe(400)
    expect((await call({ source: 'item_page_render' })).status).toBe(400)
    expect((await call({}, '../etc')).status).toBe(404)
    expect(st.calls).toEqual([])
  })

  it('도구 없는 정상 문항(tool: null) — 결속을 보지 않고 극장 공개만, judgment null', async () => {
    const j = await (await call({ tool: null })).json()
    expect(j).toMatchObject({ ok: true, reveal: { gate: { answer: 5 } }, judgment: null })
    expect(st.calls.some((c) => c.startsWith('bound') || c.startsWith('judgment-reveal'))).toBe(false)
  })

  it('도구 유형이 아닌 문항 · tool 키 없음 — 기존 공개 그대로', async () => {
    st.type = 'R-BLANK'
    const j = await (await call()).json()
    expect(j.reveal).toBeTruthy()
    expect(j.judgment).toBeNull()
  })

  it('도구 요청인데 지금 결속이 없다 → 409 · 원장 기록 전 · 정답 자료 전혀 없음', async () => {
    st.boundSeq = [null]
    const res = await call()
    expect(res.status).toBe(409)
    expect(res.headers.get('cache-control')).toBe('no-store')
    await assertNoAnswer(res)
    expect(st.calls.some((c) => c.startsWith('rpc:'))).toBe(false)
  })

  it('화면 도구의 unitsHash 가 지금 결속과 다르다 → 409 · 원장 기록 전 · 정답 자료 없음', async () => {
    const res = await call({ tool: { analysisVersion: 4, unitsHash: 'h0' } })
    expect(res.status).toBe(409)
    await assertNoAnswer(res)
    expect(st.calls.some((c) => c.startsWith('rpc:'))).toBe(false)
  })

  it('tool 판본이 요청 판본과 다르면 400', async () => {
    expect((await call({ tool: { analysisVersion: 3, unitsHash: 'h1' } })).status).toBe(400)
  })

  it('원장 커밋 뒤 결속이 바뀌었다 → 409 · 극장 reveal 도 없음', async () => {
    st.boundSeq = [undefined as never, 'other']
    const res = await call({ tool: { analysisVersion: 4, unitsHash: 'h1' } })
    expect(res.status).toBe(409)
    await assertNoAnswer(res)
    expect(st.calls).not.toContain('load-reveal')
  })

  it('공개 자료의 단위 해시가 결속과 다르다 → 409 · 정답 자료 없음', async () => {
    st.revealHash = 'other'
    const res = await call()
    expect(res.status).toBe(409)
    await assertNoAnswer(res)
    expect(st.calls).not.toContain('load-reveal')
  })

  it('원장 커밋 뒤 보류가 시작되면 423 · judgment 없음', async () => {
    let n = 0
    const gate = await import('@/lib/csat/embargo-gate')
    vi.spyOn(gate, 'canRevealItem').mockImplementation(async () => (n++ === 0))
    const res = await call()
    expect(res.status).toBe(423)
    expect(await res.text()).not.toMatch(/judgment|answer/)
    expect(st.calls.some((c) => c.startsWith('judgment-reveal'))).toBe(false)
    expect(st.calls).not.toContain('load-reveal')
    vi.restoreAllMocks()
  })

  it('강의 전체 · 경계 계속도 같은 원장(source 만 다름)', async () => {
    await call({ source: 'lecture_continue' })
    expect(st.calls).toContain('rpc:learning_exposure_record:answer_direct:lecture_continue:2014A#23:4')
  })
})

// U02-ORDER-PILOT-01 — 도구 provider 요청(tool 키 없음)을 도구 요청으로 볼지는 pilot.ts 의 같은 범위 판정을 쓴다
describe('판단 라우트 — R-ORDER 파일럿 범위', () => {
  beforeEach(() => {
    st.user = 'u1'
    st.open = true
    st.version = 1
    st.rpc = { data: 77, error: null }
    st.calls = []
    st.revealHash = 'h1'
    st.type = 'R-ORDER'
    st.boundSeq = []
  })
  it('파일럿 문항 H2609G2#36 · tool 키 없음 → 도구 요청(기록 전 결속 확인 · 공개 뒤 결속 재확인)', async () => {
    st.bound = { id: 'H2609G2#36', version: { unitsVersion: 1, unitsHash: 'h1', analysisVersion: 1 } }
    const res = await call({ analysisVersion: 1 }, 'H2609G2-36')
    expect(res.status).toBe(200)
    expect(st.calls[0]).toBe('bound:H2609G2#36:1')
    expect(st.calls.filter((c) => c.startsWith('bound:'))).toHaveLength(2)
    expect(st.calls).toContain('judgment-reveal:1')
  })
  it('파일럿 밖 R-ORDER 문항 · tool 키 없음 → 도구 요청이 아니다(결속 · 판단 공개 없이 기존 공개만)', async () => {
    st.bound = { id: 'H2609G2#37', version: { unitsVersion: 1, unitsHash: 'h1', analysisVersion: 1 } }
    const res = await call({ analysisVersion: 1 }, 'H2609G2-37')
    expect(res.status).toBe(200)
    expect(st.calls.some((c) => c.startsWith('bound:'))).toBe(false)
    expect(st.calls.some((c) => c.startsWith('judgment-reveal'))).toBe(false)
    expect((await res.json()).judgment).toBeNull()
  })
  it('파일럿 문항인데 결속이 닫혔으면(판본 바뀜) 기록 전에 409 — 정답 자료 없음', async () => {
    st.bound = null
    const res = await call({ analysisVersion: 1 }, 'H2609G2-36')
    expect(res.status).toBe(409)
    expect(st.calls.some((c) => c.startsWith('rpc:'))).toBe(false)
    await assertNoAnswer(res)
  })
})
