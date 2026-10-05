// apps/web/src/app/api/csat/diagnosis/sessions/[id]/result/route.ts
//
// GET /api/csat/diagnosis/sessions/<id>/result — 본인 기록 한 회의 점수 · 등급 · 틀린 문항 번호.
// 오답 원인 Pilot 참가자는 저장 응답에 결과가 없다(증거 수집 뒤 공개 — 화면 단계 보류). 수집을 마치거나 「나중에 하기」에서 이것을 부른다.

import { NextResponse } from 'next/server'

import { learnerContext } from '@/lib/csat/diagnosis/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  if (!UUID.test(params.id)) return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  const { data: s, error } = await ctx.db.from('csat_dx_session').select('id, user_id, raw_score, grade').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: '불러오지 못했어요' }, { status: 500 })
  if (!s || s.user_id !== ctx.userId) return NextResponse.json({ error: '기록을 찾지 못했어요' }, { status: 404 })
  const { data: rows, error: we } = await ctx.db.from('csat_dx_response').select('item_no').eq('session_id', params.id).eq('is_correct', false)
  if (we) return NextResponse.json({ error: '불러오지 못했어요' }, { status: 500 })
  return NextResponse.json({ sessionId: s.id, raw: s.raw_score, grade: s.grade, wrong: (rows ?? []).map((r) => r.item_no as number).sort((a, b) => a - b) })
}
