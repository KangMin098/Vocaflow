// apps/web/src/app/api/csat/practice/attempt/route.ts
//
// POST /api/csat/practice/attempt — /csat/practice 「주장과 근거」 연습 제출 한 건.
// 본문: { itemId, claim, support[0–3], relation|null, option|null, confidence, sec, clientMutationId, clientSessionId, answeredAt, helpLevel, preview }
// 응답: { ok, outcome: 'inserted'|'duplicate', feedback } — 정답 키는 기록이 저장된 뒤에만 feedback 에 담긴다.
// userId 는 세션에서만 온다. 미리보기(preview=true)는 관리자만(JSON 401/403 가드). 채점 · 게이트는 서버가 한다.
// 쓰기는 service_role 로만(쓰기 어댑터 practice-writer) — 학습자 키는 learning_task_attempts 에 SELECT 만 있다.
// 분석 이벤트는 보내지 않는다 — knowledge_task_* 는 DB 허용 목록에 없다(G2 통합 SQL 적용 전 · PRACTICE_PORT_BRIEF §5).
import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { readJson } from '@/lib/csat/diagnosis/route-helpers'
import { isSyntheticEmail, parseSubmission } from '@/lib/knowledge/practice'
import { PracticeInputError, defaultSubmitDeps, submitPractice } from '@/lib/knowledge/practice-server'
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

  const parsed = parseSubmission(await readJson(req), Date.now())
  if (!parsed.ok) return bad(parsed.error, 400)
  if (parsed.value.preview) {
    const admin = await requireAdminApi()
    if (admin instanceof NextResponse) return admin
  }
  try {
    const r = await submitPractice(defaultSubmitDeps(), { userId: user.id, synthetic: isSyntheticEmail(user.email) }, parsed.value)
    return NextResponse.json({ ok: true, ...r }, { headers: NO_STORE })
  } catch (e) {
    if (e instanceof PracticeInputError) return bad(e.message, e.status)
    console.error('[csat-practice]', e)
    return bad('기록하지 못했어요. 잠시 뒤 다시 시도해 주세요', 500)
  }
}
