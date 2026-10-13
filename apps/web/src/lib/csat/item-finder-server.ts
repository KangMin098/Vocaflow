// apps/web/src/lib/csat/item-finder-server.ts
//
// **기출 찾기 API 의 본체 — 서버 전용.** (기출 찾기 FND1) 라우트(`app/api/csat/item-finder/route.ts`)는 이 함수만 부른다.
//
// 권한의 두 층을 섞지 않는다:
//   · 목록 · 존재 확인 = **로그인한 학습자 클라이언트**로 `csat_items_public` 만 읽는다(`loadBrowseCatalog` · 아래 verify 질의).
//     관리자 클라이언트로 목록 · 원문을 읽지 않는다.
//   · 공개 허용 판정 = 기존 `embargo-gate` 의 함수만 부른다(그 내부의 service-role RPC 는 판정에만 쓰인다 · 새 RPC 없음).
// 캐시: `loadBrowseCatalog` 의 프로세스 캐시는 사용자와 무관한 공개 목록 원본뿐이다. 보류 판정은 **요청마다** 새로 하고
//   (embargo-gate 규칙 ③ — 캐시 앞에 두지 않는다), 응답은 `private, no-store` 다. 오류 응답도 같다.
// 판정 실패는 빈 정상 집합(200 · 0건)으로 바꾸지 않는다 — 503 `gate` 로 구별한다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { loadBrowseCatalog } from './browse'
import { itemRevealDecision, loadRevealScope, isItemHeld, type RevealScope } from './embargo-gate'
import { parseFinderItemId, projectFinderCatalog, type FinderVerify } from './item-finder'
import type { BrowseCatalog } from './browse-model'
import { createClient } from '@/lib/supabase/server'

export interface FinderDeps {
  /** 로그인 학습자 클라이언트(테스트가 주입한다) */
  client?: () => Promise<SupabaseClient>
  catalog?: () => Promise<BrowseCatalog>
  scope?: () => Promise<RevealScope>
  decide?: (ids: readonly string[]) => Promise<{ held: Set<string>; failed: boolean }>
}

const HEADERS = { 'cache-control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS })

export async function handleFinderGet(req: Request, deps: FinderDeps = {}): Promise<NextResponse> {
  const db = await (deps.client ?? (async () => (await createClient()) as unknown as SupabaseClient))()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return json({ ok: false, error: 'auth' }, 401)

  const url = new URL(req.url)
  const verifyRaw = url.searchParams.get('verify')
  if (verifyRaw !== null) {
    const id = parseFinderItemId(verifyRaw)
    if (!id) return json({ ok: false, error: 'bad_request' }, 400)
    return json({ ok: true, verify: await verifyItem(db, id, deps) })
  }

  // 목록 — 공개 원본(학습자 클라이언트) + 요청마다의 보류 범위
  const [catalog, scope] = await Promise.all([(deps.catalog ?? (() => loadBrowseCatalog()))(), (deps.scope ?? (() => loadRevealScope()))()])
  if (catalog.error) return json({ ok: false, error: 'list' }, 503)
  if (scope.failed) return json({ ok: false, error: 'gate' }, 503)
  return json({ ok: true, catalog: projectFinderCatalog(catalog, (id) => isItemHeld(scope, id)) })
}

/** 열기 직전 재검증 — 지금 공개 목록에 있고(학습자 클라이언트) 보류가 아닌가(기존 관문). 학습 기록을 쓰지 않는다 */
async function verifyItem(db: SupabaseClient, id: string, deps: FinderDeps): Promise<FinderVerify> {
  try {
    const { data, error } = await db.from('csat_items_public').select('id').eq('id', id).eq('in_scope', true).limit(1)
    if (error) return 'error'
    if (!data || data.length === 0) return 'missing'
  } catch {
    return 'error'
  }
  const d = await (deps.decide ?? ((ids) => itemRevealDecision(ids)))([id])
  if (d.failed) return 'error'
  return d.held.has(id) ? 'held' : 'open'
}
