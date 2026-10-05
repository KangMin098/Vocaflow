// apps/web/src/app/api/csat/ec/evidence/route.ts
//
// POST /api/csat/ec/evidence — { sessionId, itemNo, evidence: {kind …} } → csat_ec_add_process_evidence(쿠키 클라이언트).
// kind 허용: reason · blocked_span(문장 번호만 받고 문자 범위는 서버가 원문으로 계산) · interpretation(answered · unknown · skipped) · category(학생 범주).
// category 는 과정 증거 하나일 뿐이다 — 원인 claim(add_student_claim)을 만들지 않는다. 같은 값 재전송은 DB 가 같은 id 를 돌려준다.

import { NextResponse } from 'next/server'

import { readJson } from '@/lib/csat/diagnosis/route-helpers'
import { ecContext, itemSource, loadCapture } from '@/lib/csat/ec-pilot/server'
import { evidenceValue, parseEvidence } from '@/lib/csat/ec-pilot/targets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const ctx = await ecContext()
  if (ctx instanceof NextResponse) return ctx
  const b = (await readJson(req)) as { sessionId?: unknown; itemNo?: unknown; evidence?: unknown } | null
  const input = parseEvidence(b?.evidence)
  if (!b || typeof b.sessionId !== 'string' || !UUID.test(b.sessionId) || !Number.isInteger(b.itemNo) || !input)
    return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  const sessionId = b.sessionId, itemNo = b.itemNo as number
  try {
    const state = await loadCapture(ctx, sessionId)   // 본인 · 대상 문항인지(대상 밖 문항에는 받지 않는다)
    if (!state || state.status !== 'open' || !state.items.some((i) => i.itemNo === itemNo)) return NextResponse.json({ error: '이 문항에는 남길 수 없어요' }, { status: 404 })
    const src = await itemSource(ctx, sessionId, itemNo)
    const value = src && evidenceValue(input, src)
    if (!value) return NextResponse.json({ error: '표시한 위치가 맞지 않아요' }, { status: 400 })
    const { data, error } = await ctx.rls.rpc('csat_ec_add_process_evidence', { p_session: sessionId, p_item_no: itemNo, p_kind: input.kind, p_value: value })
    if (error) throw new Error(error.message)
    return NextResponse.json({ id: data })
  } catch (e) {
    console.error('[csat-ec] evidence', e)
    return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
  }
}
