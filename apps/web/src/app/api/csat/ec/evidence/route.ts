// apps/web/src/app/api/csat/ec/evidence/route.ts
//
// POST /api/csat/ec/evidence — { sessionId, itemNo, evidence: {kind …} } → csat_ec_add_process_evidence(쿠키 클라이언트).
// kind 허용: reason · blocked_span(문장 번호만 받고 문자 범위는 서버가 원문으로 계산) · interpretation(answered · unknown · skipped) · category(학생 범주).
// 문항당 종류별 하나 — 같은 종류의 유효 증거가 다른 값이면 그 행을 정정(supersedes)한다(재시도 중 고친 값이 상충 증거로 남지 않게).
// category 는 과정 증거 하나일 뿐이다 — 원인 claim(add_student_claim)을 만들지 않는다. 같은 값 재전송은 DB 가 같은 id 를 돌려준다.

import { NextResponse } from 'next/server'

import { readJson } from '@/lib/csat/diagnosis/route-helpers'
import { ecContext, itemSource, loadCapture, ownValidEvidence } from '@/lib/csat/ec-pilot/server'
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
    // 같은 값이면 DB 가 같은 행을 돌려준다(멱등). 다른 값이면 가장 최근 유효 행을 정정한다
    const prev = (await ownValidEvidence(ctx, sessionId)).filter((r) => r.item_no === itemNo && r.kind === input.kind)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const same = prev && sameJson(prev.value, value)
    const { data, error } = await ctx.rls.rpc('csat_ec_add_process_evidence', { p_session: sessionId, p_item_no: itemNo, p_kind: input.kind, p_value: value, p_supersedes: prev && !same ? prev.id : null })
    if (error) throw new Error(error.message)
    return NextResponse.json({ id: data })
  } catch (e) {
    console.error('[csat-ec] evidence', e)
    return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
  }
}

/** jsonb 는 키 순서를 바꿔 돌려준다 — 키를 정렬해 비교한다(문자열화 비교 금지) */
function sameJson(a: unknown, b: unknown): boolean {
  const norm = (x: unknown): unknown => (Array.isArray(x) ? x.map(norm) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, norm((x as Record<string, unknown>)[k])])) : x)
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b))
}
