// apps/web/src/components/diagnostic/__tests__/DiagnosticClient.ssr.test.tsx
//
// 실제 DiagnosticClient 렌더 게이트(DIAG-RESUME-BIND-01 재리뷰) — 이 저장소의 vitest 는 node 환경이라 효과(useEffect)가 돌지 않는다.
// 그래서 첫 렌더(서버 렌더)에서 판정되는 계약만 여기서 고정한다:
//   · 신원이 확인되지 않았거나(checking) 바뀌었으면(changed) 개인 보관분 · 진행이 DOM 에 없고, 공개 설명은 남는다
//   · 제출 owner 판정(submitOwnerOk) — 묶음 주인 · 지금 viewer · getUser 셋이 같을 때만
// 「재개 → 다음 문항」 · 「owner 불일치 → 제출 0」 클릭 흐름은 같은 commit 의 PC 하네스(pd-t239-r3)가 실제 컴포넌트로 잰다.
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { StoryAuthSource } from '@/components/library/story/use-story-auth-guard'

const db = vi.hoisted(() => ({ insert: 0, rpc: 0 }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))
vi.mock('@/app/(main)/library/vocab/actions', () => ({ subscribeSet: vi.fn() }))
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ error: () => {} }) }))
vi.mock('@/lib/supabase/client', () => {
  const chain: Record<string, unknown> = {}
  for (const k of ['select', 'eq', 'order', 'limit', 'maybeSingle', 'single']) chain[k] = () => chain
  chain.insert = () => { db.insert++; return chain }
  chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
  const client = { from: () => chain, rpc: async () => { db.rpc++; return { data: null, error: null } }, auth: { getUser: async () => ({ data: { user: null } }) } }
  return { createClient: () => client }
})

const { DiagnosticClient } = await import('../DiagnosticClient')
const { submitOwnerOk } = await import('../progress-store')

const src = (known: string | null | undefined): StoryAuthSource => ({
  subscribe: () => () => {},
  currentUserId: () => new Promise(() => {}),
  testOnlyKnownUserId: () => known,
})
const KV = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
const html = (viewerId: string | null, known: string | null | undefined) =>
  renderToString(<DiagnosticClient viewerId={viewerId} authSource={src(known)} storage={KV} now={() => 0} />)

describe('DiagnosticClient 첫 렌더 — 개인 진행은 본인 확인(same) 동안만', () => {
  it('viewer A · 브라우저 B(바뀜) → 바뀜 안내 + 공개 설명은 남고, 보관분 · 진행 · 제출 단추 0', () => {
    const h = html('user-a', 'user-b')
    expect(h).toContain('로그인한 계정이 바뀌어 진단을 멈췄어요')
    expect(h).toContain('어휘 진단')
    expect(h).not.toContain('하다 만 진단이 있어요')
    expect(h).not.toContain('이 답으로 제출')
    expect(h).not.toMatch(/\d+ \/ \d+/)
  })
  it('viewer A · 신원 확인 전(checking) → 보관분 0, 공개 설명만', () => {
    const h = html('user-a', undefined)
    expect(h).toContain('어휘 진단')
    expect(h).not.toContain('하다 만 진단이 있어요')
    expect(h).not.toContain('로그인한 계정이 바뀌어')
  })
  it('비로그인 → 공개 화면, 바뀜 안내 없음', () => {
    const h = html(null, null)
    expect(h).toContain('어휘 진단')
    expect(h).not.toContain('로그인한 계정이 바뀌어')
  })
  it('첫 렌더는 DB 에 쓰지 않는다', () => {
    html('user-a', 'user-a')
    expect(db).toEqual({ insert: 0, rpc: 0 })
  })
})

describe('submitOwnerOk — 제출 owner 판정', () => {
  it('묶음 주인 · 지금 viewer · getUser 가 모두 같을 때만 참', () => {
    expect(submitOwnerOk('a', 'a', 'a')).toBe(true)
    expect(submitOwnerOk('a', 'b', 'b')).toBe(false) // viewer 가 바뀐 뒤 이전 묶음
    expect(submitOwnerOk('a', 'a', 'b')).toBe(false) // 서버 세션이 다른 계정
    expect(submitOwnerOk('a', 'a', null)).toBe(false) // 로그아웃
    expect(submitOwnerOk(null, null, 'a')).toBe(false) // 비로그인 묶음
  })
})

describe('결속 배선 — viewer 별 재마운트 · 제출 묶음 owner', () => {
  it('page 가 viewer 별 key 로 DiagnosticClient 를 다시 만든다', () => {
    const page = fs.readFileSync(path.join(__dirname, '../../../app/(main)/diagnostic/page.tsx'), 'utf8')
    expect(page).toContain("<DiagnosticClient key={user?.id ?? 'anon'} viewerId={user?.id ?? null} />")
  })
  it('제출 묶음은 만든 화면의 viewer 를 owner 로 싣고, 제출은 submitOwnerOk 와 ctx.owner === viewerId 를 거친다', () => {
    const c = fs.readFileSync(path.join(__dirname, '../DiagnosticClient.tsx'), 'utf8')
    expect((c.match(/token: guard\.token\(\), owner: viewerId \}/g) ?? []).length).toBe(2)
    expect(c).toContain('if (ctx.owner !== viewerId) {')
    expect(c).toContain('if (!submitOwnerOk(ctx.owner, viewerId, userId) || !guard.isCurrent(ctx.token)) {')
    expect(c).toContain("const view: Phase = personalOk ? phase : 'start'")
  })
})
