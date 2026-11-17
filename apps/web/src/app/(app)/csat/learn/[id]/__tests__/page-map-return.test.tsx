// apps/web/src/app/(app)/csat/learn/[id]/__tests__/page-map-return.test.tsx
// FI-011 C — 받은 창작 자료 페이지의 **실제 분기**마다 지도 복귀 문맥이 같은지 본다(서버 컴포넌트를 모의 의존성으로 SSR).
//   FI-010 — 열기 기록 실패는 본문 없이 반환. 정상 본문은 기존 AuthoredRunner 그대로. DB · 권한 · API 는 모의만.
import { renderToString } from 'react-dom/server'
import type { ReactElement, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  user: { id: 'u1', email: 'u@example.com' } as { id: string; email: string } | null,
  opened: { status: 'not_delivered' } as Record<string, unknown>,
  recordOk: true,
  runnerProps: null as Record<string, unknown> | null,
  redirectTo: null as string | null,
}))

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
  redirect: (to: string) => { state.redirectTo = to; throw new Error('REDIRECT') },
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/csat/rail-data', () => ({ railExams: async () => [] }))
vi.mock('@/components/csat/home/CsatShell', () => ({ CsatShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('@/components/csat/authored/AuthoredRunner', () => ({
  AuthoredRunner: (p: Record<string, unknown>) => { state.runnerProps = p; return <div data-testid="runner">BODY:{String(p.stem)}</div> },
}))
vi.mock('@/lib/csat/authored/server', () => ({
  openDelivered: async () => state.opened,
  recordOpen: async () => state.recordOk,
  taskKeyOf: async () => 'task-key',
}))

import LearnPage from '../page'

const ID = 'r5-cm-ind-3'
const D = '0b6f3a2e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
const D2 = '9b6f3a2e-1c2d-4e5f-8a9b-0c1d2e3f4a5c'
const WS = '11111111-2222-4333-8444-555555555555'
const MAP = '/csat/diagnosis?tab=map&amp;view=full'
const FROM_MAP = { from: 'map', map_ws: WS, map_plan: '3', map_attempt: '7', d: D }

const view = { role: 'guided_practice', deliveryId: D, format: 'mcq', sentences: [], stem: 'STEM', choices: [], teach: null, hints: [], extra: null, probe: null, done: false, retry: null, annotationHash: 'h', taskId: 'main_idea', ref: `authored:${ID}` }

async function html(sp: Record<string, string>) {
  return renderToString((await LearnPage({ params: { id: ID }, searchParams: sp })) as ReactElement)
}
const mapLinks = (h: string) => [...h.matchAll(/href="([^"]*)"[^>]*>학습 지도로 가기/g)].map((m) => m[1]!)

beforeEach(() => {
  state.user = { id: 'u1', email: 'u@example.com' }
  state.opened = { status: 'not_delivered' }
  state.recordOk = true
  state.runnerProps = null
  state.redirectTo = null
})

describe('/csat/learn/[id] 분기별 지도 복귀', () => {
  it('비로그인 — 로그인 next 가 납품 id 와 검증된 지도 문맥을 지킨다', async () => {
    state.user = null
    await expect(html(FROM_MAP)).rejects.toThrow('REDIRECT')
    const next = decodeURIComponent(state.redirectTo!.split('=').slice(1).join('='))
    expect(next.startsWith(`/csat/learn/${ID}?d=${D}`)).toBe(true)
    expect(next).toContain('from=map')
    expect(next).toContain(`map_ws=${WS}`)
    expect(next).not.toContain('map_attempt') // 지난 시도를 새 시도로 옮기지 않는다
  })

  it('여러 묶음 선택 — 각 링크가 지도 문맥을 싣는다', async () => {
    state.opened = { status: 'choose', choices: [{ deliveryId: D, role: 'guided_practice', deliveredAt: '2026-10-20T00:00:00Z' }, { deliveryId: D2, role: 'model_explanation', deliveredAt: '2026-10-21T00:00:00Z' }] }
    const h = await html({ from: 'map', map_ws: WS })
    for (const d of [D, D2]) expect(h).toContain(`/csat/learn/${ID}?d=${d}&amp;from=map&amp;map_ws=${WS}`)
  })

  it.each(['revoked', 'not_delivered', 'not_installed'])('%s 안내 — 「학습 지도로 가기」가 같은 지도 문맥', async (status) => {
    state.opened = { status, deliveryId: D }
    const links = mapLinks(await html(FROM_MAP))
    expect(links).toHaveLength(1)
    expect(links[0]).toBe(`${MAP}&amp;map_ws=${WS}&amp;map_plan=3&amp;map_item=${ID}`)
  })

  it('열기 기록 실패 — 본문 없이 같은 지도 문맥(FI-010 fail-closed)', async () => {
    state.opened = { status: 'ok', view }
    state.recordOk = false
    const h = await html(FROM_MAP)
    expect(h).toContain('authored-open-unavailable')
    expect(h).not.toContain('data-testid="runner"')
    expect(state.runnerProps).toBeNull()
    expect(mapLinks(h)[0]).toBe(`${MAP}&amp;map_ws=${WS}&amp;map_plan=3&amp;map_item=${ID}`)
  })

  it('정상 본문 — Runner 에 기록한 세션과 같은 복귀 주소를 준다(기존 그대로)', async () => {
    state.opened = { status: 'ok', view }
    const h = await html(FROM_MAP)
    expect(h).toContain('data-testid="runner"')
    expect(state.runnerProps!.returnHref).toBe(`/csat/diagnosis?tab=map&view=full&map_ws=${WS}&map_plan=3&map_item=${ID}`)
    expect(typeof state.runnerProps!.sessionId).toBe('string')
  })

  it('위치 없이 들어오면 예전과 같은 전체 지도', async () => {
    expect(mapLinks(await html({ d: D }))[0]).toBe(MAP)
  })

  it('틀린 · 외부 문맥은 기존 파서가 버린다', async () => {
    const links = mapLinks(await html({ from: 'map', map_ws: 'https://evil.example', map_plan: 'x', d: D }))
    expect(links[0]).toBe(`${MAP}&amp;map_item=${ID}`)
  })
})
