// apps/web/src/app/api/csat/ec/probe/route.ts
//
// POST /api/csat/ec/probe — { sessionId, itemNo, probeKey, probeVersion, promptHash, option: 'A'..'D' | null }.
// 판 · 해시는 학생이 본 그대로 받아 저장소 정의(옛 판 포함)와 대조한다. option null = 건너뜀(skipped = true).
// 저장은 csat_ec_add_probe_response(세션 잠금 안에서 상한 · 같은 질문 첫 응답 반환). 이미 답했으면 저장된 응답으로 성공.

import { NextResponse } from 'next/server'

import { readJson } from '@/lib/csat/diagnosis/route-helpers'
import { EC_PILOT } from '@/lib/csat/ec-pilot/config'
import { findProbe } from '@/lib/csat/ec-pilot/probes'
import { ecContext, ownSession, pendingBoundary, savedProbe } from '@/lib/csat/ec-pilot/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const OPTIONS = new Set(['A', 'B', 'C', 'D'])

export async function POST(req: Request) {
  const ctx = await ecContext()
  if (ctx instanceof NextResponse) return ctx
  const b = (await readJson(req)) as Record<string, unknown> | null
  if (!b || typeof b.sessionId !== 'string' || !UUID.test(b.sessionId) || !Number.isInteger(b.itemNo) || typeof b.probeKey !== 'string'
      || typeof b.probeVersion !== 'string' || typeof b.promptHash !== 'string' || !(b.option === null || (typeof b.option === 'string' && OPTIONS.has(b.option))))
    return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
  const sessionId = b.sessionId, itemNo = b.itemNo as number, option = b.option as string | null
  const def = findProbe(b.probeKey, b.probeVersion, b.promptHash)
  if (!def) return NextResponse.json({ error: '질문이 바뀌었어요. 다시 열어 주세요' }, { status: 409 })
  try {
    if (!(await ownSession(ctx.admin, ctx.userId, sessionId))) return NextResponse.json({ error: '기록을 찾지 못했어요' }, { status: 404 })
    const already = await savedProbe(ctx, sessionId, itemNo, def.key)
    if (already) return NextResponse.json({ id: already.id, already: true })
    const boundary = await pendingBoundary(ctx, sessionId, itemNo, def.key)
    if (!boundary) return NextResponse.json({ error: '지금은 이 질문에 답할 수 없어요' }, { status: 404 })
    const value = { probe_key: def.key, probe_version: def.version, taxonomy_version: EC_PILOT.taxonomyVersion, boundary_key: boundary,
      prompt_hash: b.promptHash, option, skipped: option === null }
    const { data, error } = await ctx.rls.rpc('csat_ec_add_probe_response', { p_session: sessionId, p_item_no: itemNo, p_value: value, p_session_cap: EC_PILOT.probeCapPerSession })
    if (error) {
      // 동시 요청이 먼저 저장했으면 그 응답으로 복구(unique · 같은 첫 응답)
      const again = await savedProbe(ctx, sessionId, itemNo, def.key)
      if (again) return NextResponse.json({ id: again.id, already: true })
      if (/상한/.test(error.message)) return NextResponse.json({ error: '추가 질문은 여기까지예요', capped: true }, { status: 409 })
      throw new Error(error.message)
    }
    return NextResponse.json({ id: data })
  } catch (e) {
    console.error('[csat-ec] probe', e)
    return NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 })
  }
}
