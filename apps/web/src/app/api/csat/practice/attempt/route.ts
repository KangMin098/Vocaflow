// apps/web/src/app/api/csat/practice/attempt/route.ts
//
// POST /api/csat/practice/attempt — /csat/practice 「주장과 근거」 연습 제출 한 건.
// 본문: { itemId, claim, support[주장 외], relation|null, option|null, confidence, sec, clientMutationId, clientSessionId, answeredAt, helpLevel, preview }
// 응답: { ok, outcome: 'inserted'|'duplicate', feedback } — 정답 키는 기록이 저장된 뒤에만 feedback 에 담긴다.
// userId 는 세션에서만 온다. 미리보기(preview=true)는 관리자만(JSON 401/403 가드). 채점 · 게이트는 서버가 한다.
// 쓰기는 service_role 로만(쓰기 어댑터 practice-writer) — 학습자 키는 learning_task_attempts 에 SELECT 만 있다.
// 분석 이벤트는 보내지 않는다 — knowledge_task_* 는 DB 허용 목록에 없다(G2 통합 SQL 적용 전 · PRACTICE_PORT_BRIEF §5).
import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { readJson } from '@/lib/csat/diagnosis/route-helpers'
import { canRevealItem, revealHeldResponse } from '@/lib/csat/embargo-gate'
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

  const raw = (await readJson(req)) as Record<string, unknown> | null
  // 첫 제출 계정과 지금 계정이 다르면(다른 탭에서 계정 전환 뒤 재시도) 남기지 않는다 — 다른 학습자 기록 오염 방지
  if (raw && typeof raw.ownerId === 'string' && raw.ownerId !== user.id) return bad('다른 계정에서 시작한 제출이에요 — 화면을 새로 고쳐 주세요', 409)
  const parsed = parseSubmission(raw, Date.now())
  if (!parsed.ok) return bad(parsed.error, 400)
  // 보류 관문 — 피드백에 정답 키가 담긴다. 보류 시험 문항이면 기록 · 채점 전에 423(fail-closed · Codex P1)
  if (!(await canRevealItem(parsed.value.itemId))) return revealHeldResponse()
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
