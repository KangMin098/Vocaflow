// apps/web/src/lib/csat/__tests__/item-finder-server.test.ts
//
// 기출 찾기 API 본체(FND1) — 인증 · 판정 실패와 빈 집합 구별 · 보류 제외 · no-store · 재검증 상태 · 권한 층 분리.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'

import type { BrowseCatalog } from '../browse-model'
import type { RevealScope } from '../embargo-gate'
import { handleFinderGet, type FinderDeps } from '../item-finder-server'

const CATALOG: BrowseCatalog = {
  exams: [
    { id: '2026', label: '2026학년도 수능', kind: 'suneung', year: 2026, month: null, grade: null, items: 2 },
    { id: 'M2609', label: '2026학년도 9월 모의평가', kind: 'mock', year: 2026, month: 9, grade: null, items: 1 },
  ],
  types: [{ id: 'R-BLANK', name: '빈칸 추론', status: 'active', items: 3 }],
  items: [
    { id: '2026#31', exam_id: '2026', no: 31, type_id: 'R-BLANK', points: 2, lecture: true, sec: 200, map: true },
    { id: '2026#34', exam_id: '2026', no: 34, type_id: 'R-BLANK', points: 3, lecture: true, sec: 200, map: false },
    { id: 'M2609#34', exam_id: 'M2609', no: 34, type_id: 'R-BLANK', points: 2, lecture: false, sec: 0, map: true },
  ],
  error: null,
}
const CLEAR: RevealScope = { failed: false, exams: new Set(), items: new Set(), types: new Set() }

/** 학습자 클라이언트 흉내 — auth.getUser 와 csat_items_public 한 줄 조회만 */
function client(user: { id: string } | null, rows: { id: string }[] | null = [{ id: 'x' }], error: unknown = null) {
  const from = vi.fn(() => {
    const chain = { select: () => chain, eq: () => chain, limit: async () => ({ data: rows, error }) }
    return chain
  })
  return { db: { auth: { getUser: async () => ({ data: { user } }) }, from } as unknown as SupabaseClient, from }
}
const deps = (over: Partial<FinderDeps> & { user?: { id: string } | null } = {}): FinderDeps => {
  const { db } = client(over.user === undefined ? { id: 'u1' } : over.user)
  return { client: async () => db, catalog: async () => CATALOG, scope: async () => CLEAR, decide: async () => ({ held: new Set(), failed: false }), ...over }
}
const req = (qs = '') => new Request(`http://x/api/csat/item-finder${qs}`)

describe('GET /api/csat/item-finder — 목록', () => {
  it('로그인 없으면 401 · private no-store', async () => {
    const res = await handleFinderGet(req(), deps({ user: null }))
    expect(res.status).toBe(401)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('보류 문항을 빼고 개수를 다시 센 메타데이터만 · private no-store', async () => {
    const scope: RevealScope = { failed: false, exams: new Set(['M2609']), items: new Set(), types: new Set() }
    const res = await handleFinderGet(req(), deps({ scope: async () => scope }))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    const body = await res.json()
    expect(body.catalog.items.map((i: { id: string }) => i.id)).toEqual(['2026#31', '2026#34'])
    expect(body.catalog.exams.map((e: { id: string }) => e.id)).toEqual(['2026'])
    expect(body.catalog.types[0].items).toBe(2)
    expect(JSON.stringify(body)).not.toMatch(/answer|stem|passage|choices|why_|script|explain/)
  })

  it('보류 판정 실패는 빈 정상 집합이 아니라 503 gate', async () => {
    const res = await handleFinderGet(req(), deps({ scope: async () => ({ ...CLEAR, failed: true }) }))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('gate')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('목록 원본 실패는 503 list', async () => {
    const res = await handleFinderGet(req(), deps({ catalog: async () => ({ ...CATALOG, error: 'boom' }) }))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('list')
  })

  it('보류 판정은 요청마다 새로 한다(캐시하지 않는다)', async () => {
    const scope = vi.fn(async () => CLEAR)
    const d = deps({ scope })
    await handleFinderGet(req(), d)
    await handleFinderGet(req(), d)
    expect(scope).toHaveBeenCalledTimes(2)
  })
})

describe('GET ?verify= — 열기 직전 재검증', () => {
  it('open · held · missing · error 를 가른다', async () => {
    expect((await (await handleFinderGet(req('?verify=2026%2334'), deps())).json()).verify).toBe('open')
    expect((await (await handleFinderGet(req('?verify=2026%2334'), deps({ decide: async () => ({ held: new Set(['2026#34']), failed: false }) }))).json()).verify).toBe('held')
    expect((await (await handleFinderGet(req('?verify=2026%2334'), deps({ decide: async () => ({ held: new Set(['2026#34']), failed: true }) }))).json()).verify).toBe('error')
    const gone = client({ id: 'u1' }, [])
    expect((await (await handleFinderGet(req('?verify=2026%2334'), deps({ client: async () => gone.db }))).json()).verify).toBe('missing')
    const broken = client({ id: 'u1' }, null, { message: 'x' })
    expect((await (await handleFinderGet(req('?verify=2026%2334'), deps({ client: async () => broken.db }))).json()).verify).toBe('error')
  })

  it('존재 확인은 학습자 클라이언트로 csat_items_public 만 읽는다', async () => {
    const c = client({ id: 'u1' })
    await handleFinderGet(req('?verify=2026%2334'), deps({ client: async () => c.db }))
    expect(c.from).toHaveBeenCalledWith('csat_items_public')
  })

  it('형식이 틀린 id 는 400 · 로그인 없으면 401', async () => {
    expect((await handleFinderGet(req('?verify=..%2Fx'), deps())).status).toBe(400)
    expect((await handleFinderGet(req('?verify=2026%2334'), deps({ user: null }))).status).toBe(401)
  })
})

describe('권한 층 — 목록에 관리자 클라이언트를 쓰지 않는다', () => {
  it('본체 · 라우트 · 팝업이 관리자 클라이언트를 import 하지 않고, 팝업은 서버 로더를 import 하지 않는다', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const src = path.resolve(here, '../../..')
    const read = (p: string) => fs.readFileSync(path.join(src, p), 'utf8')
    for (const p of ['lib/csat/item-finder-server.ts', 'app/api/csat/item-finder/route.ts', 'components/csat/browse/ItemFinderDialog.tsx', 'lib/csat/item-finder.ts']) {
      expect(read(p), p).not.toMatch(/supabase\/admin|createAdminClient|SERVICE_ROLE/)
    }
    for (const p of ['components/csat/browse/ItemFinderDialog.tsx', 'lib/csat/item-finder.ts']) {
      expect(read(p), p).not.toMatch(/from '@\/lib\/csat\/browse'|from '\.\/browse'|supabase\/server|item-finder-server/)
    }
    // 보류 판정은 기존 관문 함수만(새 RPC 를 부르지 않는다)
    expect(read('lib/csat/item-finder-server.ts')).not.toMatch(/\.rpc\(/)
  })
})
