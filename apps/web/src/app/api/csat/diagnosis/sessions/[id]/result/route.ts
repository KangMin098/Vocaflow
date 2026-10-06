// apps/web/src/app/api/csat/diagnosis/sessions/[id]/result/route.ts
//
// GET /api/csat/diagnosis/sessions/<id>/result — 본인 기록 한 회의 점수 · 등급 · 틀린 문항 번호.
// 오답 원인 Pilot 참가자는 저장 응답에 결과가 없다(증거 수집 뒤 공개 — 화면 단계 보류). 수집을 마치거나 「나중에 하기」에서 이것을 부른다.
// Reveal Gate: 그 시험이 보류(활성 capture · 열린 묘비 — 요청자 무관)면 점수를 읽기 **전에** 423 · { held } · no-store(embargo-gate).

import { NextResponse } from 'next/server'

import { canRevealExam, revealHeldResponse } from '@/lib/csat/embargo-gate'
import { learnerContext } from '@/lib/csat/diagnosis/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_STORE = { 'cache-control': 'no-store' }

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  if (!UUID.test(params.id)) return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  // 소유 · 시험만 먼저(점수 없이) — 남의 기록이면 보류 여부도 말하지 않는다(404)
  const { data: s, error } = await ctx.db.from('csat_dx_session').select('id, user_id, exam_id').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: '불러오지 못했어요' }, { status: 500 })
  if (!s || s.user_id !== ctx.userId) return NextResponse.json({ error: '기록을 찾지 못했어요' }, { status: 404 })
  if (!(await canRevealExam(s.exam_id as string | null))) return revealHeldResponse()
  const [{ data: score, error: se }, { data: rows, error: we }] = await Promise.all([
    ctx.db.from('csat_dx_session').select('raw_score, grade').eq('id', params.id).maybeSingle(),
    ctx.db.from('csat_dx_response').select('item_no').eq('session_id', params.id).eq('is_correct', false),
  ])
  if (se || we || !score) return NextResponse.json({ error: '불러오지 못했어요' }, { status: 500 })
  return NextResponse.json(
    { sessionId: s.id, raw: score.raw_score, grade: score.grade, wrong: (rows ?? []).map((r) => r.item_no as number).sort((a, b) => a - b) },
    { headers: NO_STORE },
  )
}
