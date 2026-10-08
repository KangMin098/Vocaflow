// apps/web/src/app/api/csat/practice/view/route.ts
//
// POST /api/csat/practice/view — /csat/practice 에서 판단 **전** 「해설 먼저 보기」 한 건(시도가 아니다).
// 본문: { itemId, clientSessionId, viewedAt, preview }. 응답: { ok, saved } — saved=false 는 직접 쓰기(롤백) 모드라 남길 곳이 없을 때.
// 세션을 viewed_first 로 공개하고 열람 시각을 별도 mutation 으로 남긴다(G2 B8). userId 는 세션에서만 · 미리보기는 관리자만.
import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { readJson } from '@/lib/csat/diagnosis/route-helpers'
import { isSyntheticEmail, parseClientMeta } from '@/lib/knowledge/practice'
import { PracticeInputError, defaultSubmitDeps, notePracticeView } from '@/lib/knowledge/practice-server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'cache-control': 'no-store' }
const bad = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE })

export async function POST(req: Request) {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return bad('로그인이 필요해요', 401)

  const o = ((await readJson(req)) ?? {}) as Record<string, unknown>
  if (typeof o.itemId !== 'string' || o.itemId.length < 1 || o.itemId.length > 120) return bad('문항을 다시 골라 주세요', 400)
  // 세션 id · 열람 시각 검사는 판단 메타와 같은 규칙(UUID · 기기 시각 허용 범위)
  const meta = parseClientMeta({ clientMutationId: o.clientSessionId, clientSessionId: o.clientSessionId, answeredAt: o.viewedAt, helpLevel: 'viewed_first' }, Date.now())
  if (!meta.ok) return bad(meta.error, 400)
  const preview = o.preview === true
  if (preview) {
    const admin = await requireAdminApi()
    if (admin instanceof NextResponse) return admin
  }
  try {
    const saved = await notePracticeView(defaultSubmitDeps(), { userId: user.id, synthetic: isSyntheticEmail(user.email) }, {
      itemId: o.itemId, clientSessionId: meta.value.clientSessionId, viewedAt: meta.value.answeredAt, preview,
    })
    return NextResponse.json({ ok: true, saved }, { headers: NO_STORE })
  } catch (e) {
    if (e instanceof PracticeInputError) return bad(e.message, e.status)
    console.error('[csat-practice-view]', e)
    return bad('해설 열람을 기록하지 못했어요. 잠시 뒤 다시 시도해 주세요', 500)
  }
}
