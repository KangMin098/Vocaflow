// apps/web/src/app/api/csat/practice/review/route.ts
//
// POST /api/csat/practice/review — /csat/practice 판정 뒤 「며칠 뒤 다시 보기」 예약 한 건(E11 · 기출 → Practice → 복습 → 재평가).
// 본문: { itemId, clientSessionId, days(1|3|7), preview }. 응답: { ok, reviewAt, outcome }.
// 판단을 낸 세션을 마치고(finished) review_at 을 남긴다(G2 learning_session_apply · 별도 mutation). 학습 지도가 날짜가 되면 「다시 보기」를 띄운다.
// userId 는 세션에서만 · 미리보기는 관리자만 · 시각은 라우트가 서버 시계로 정한다.
import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { readJson } from '@/lib/csat/diagnosis/route-helpers'
import { isSyntheticEmail, parseClientMeta } from '@/lib/knowledge/practice'
import { PracticeInputError, defaultSubmitDeps, schedulePracticeReview } from '@/lib/knowledge/practice-server'
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
  const now = Date.now()
  // 세션 id 검사는 판단 메타와 같은 규칙(UUID)
  const meta = parseClientMeta({ clientMutationId: o.clientSessionId, clientSessionId: o.clientSessionId, answeredAt: new Date(now).toISOString(), helpLevel: 'independent' }, now)
  if (!meta.ok) return bad(meta.error, 400)
  if (typeof o.days !== 'number') return bad('예약 간격을 다시 골라 주세요', 400)
  const preview = o.preview === true
  if (preview) {
    const admin = await requireAdminApi()
    if (admin instanceof NextResponse) return admin
  }
  try {
    const r = await schedulePracticeReview(defaultSubmitDeps(), { userId: user.id, synthetic: isSyntheticEmail(user.email) }, {
      itemId: o.itemId, clientSessionId: meta.value.clientSessionId, days: o.days, now, preview,
    })
    return NextResponse.json({ ok: true, ...r }, { headers: NO_STORE })
  } catch (e) {
    if (e instanceof PracticeInputError) return bad(e.message, e.status)
    console.error('[csat-practice-review]', e)
    return bad('예약하지 못했어요. 잠시 뒤 다시 시도해 주세요', 500)
  }
}
