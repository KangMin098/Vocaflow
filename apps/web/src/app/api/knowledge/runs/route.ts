// apps/web/src/app/api/knowledge/runs/route.ts
//
// POST /api/knowledge/runs  { designSlug, itemId, preview, response }
//   → 수행 한 번을 기록하고 판정(주장 문장 적중 · 선지 정답 · 정답 근거 문장 번호 · 다음 행동)을 돌려준다.
//
// 저작권 경계: 요청·응답 어디에도 지문 글자가 없다. 문장 번호와 선지 번호만 오간다.
// 정답 근거 문장 번호는 **기록이 저장된 뒤에만** 나간다 — 먼저 보고 답하는 길이 없다.
// 학습자: 배포 중인 설계만(DB 트리거가 열린 배포 구간·버전을 다시 확인). 관리자: preview=true 로 아무 설계나.
// phase(훈련/전이)는 클라이언트가 정하지 않는다 — 문항 유형으로 서버가 정한다.
import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { createClient } from '@/lib/supabase/server'
import { answerOf, insertRun, loadPracticeDesign, practicePool, taskFor } from '@/lib/knowledge/learner-practice'
import { parseClaimResponse, scoreClaim } from '@/lib/knowledge/practice'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return bad('unauthenticated', 401)

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return bad('본문이 JSON 이 아니다')
  }
  const slug = typeof body.designSlug === 'string' ? body.designSlug : ''
  const itemId = typeof body.itemId === 'string' ? body.itemId : ''
  const preview = body.preview === true
  if (preview) {
    // 미리보기는 관리자만 — JSON 401/403 을 돌려주는 API 가드(redirect 가드 아님)
    const admin = await requireAdminApi()
    if (admin instanceof NextResponse) return admin
  }

  try {
    const design = await loadPracticeDesign(slug, { preview })
    if (!design) return bad('지금 열려 있는 과제가 아니다', 404)
    const entry = practicePool(design).find((p) => p.itemId === itemId)
    if (!entry) return bad('이 과제의 문항이 아니다')
    const task = taskFor(itemId)
    if (!task) return bad('이 문항은 판정할 수 없다')
    const parsed = parseClaimResponse(body.response, task.bars.length)
    if (!parsed.ok) return bad(parsed.error)
    const r = parsed.value
    const fb = scoreClaim(task, r, await answerOf(itemId))
    await insertRun({
      userId: user.id,
      design,
      preview,
      itemId,
      phase: entry.phase,
      response: { claimSentence: r.claimSentence, evidenceSentences: r.evidenceSentences, option: r.option, sentenceCount: task.bars.length, claimOnTrap: fb.claimOnTrap },
      claimHit: fb.claimHit,
      optionCorrect: fb.optionCorrect,
      confidence: r.confidence,
      sec: r.sec,
    })
    return NextResponse.json({ ok: true, phase: entry.phase, feedback: fb }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return bad(e instanceof Error ? e.message : '기록 실패', 500)
  }
}
