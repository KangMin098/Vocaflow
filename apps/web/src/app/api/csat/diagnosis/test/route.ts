// apps/web/src/app/api/csat/diagnosis/test/route.ts
//
// POST /api/csat/diagnosis/test — 진단 테스트(기록이 없는 학습자용) 제출.
// 본문: { clientKey, answers: [{ itemId, chosen: 1~5|null, confidence? }] }
// 문항은 활성 진단 풀에 있어야 하고, 정답 판정은 서버가 csat_items 로 한다.

import { NextResponse } from 'next/server'

import { parseDiagnosticPayload, todayKst } from '@/lib/csat/diagnosis/payload'
import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { loadActiveSettings, submitDiagnosticSession } from '@/lib/csat/diagnosis/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const now = new Date()
  try {
    const { settings } = await loadActiveSettings(ctx.db)
    const body = parseDiagnosticPayload(await readJson(req), settings.diagnostic_test.size)
    if (!body) return NextResponse.json({ error: '입력 형식이 맞지 않아요' }, { status: 400 })
    const out = await submitDiagnosticSession(ctx.db, { ...body, userId: ctx.userId, takenAt: todayKst(now) }, now)
    return NextResponse.json(out)
  } catch (e) {
    return failure(e)
  }
}
