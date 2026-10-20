// apps/web/src/app/api/csat/item/[slug]/structure/route.ts
//
// POST /api/csat/item/[slug]/structure — 「글 전체 구조」 예측 한 건(FINAL §6 ⑤). 본문 { roles, pattern, clientSessionId, clientMutationId, answeredAt, helpLevel }.
// 서버가 검수된 설계 주석(최신 발행 분석의 passage_design)과 대조해 { grade, reveal } 을 돌려준다. 보류 시험 문항은 받지 않는다(Reveal Gate · fail-closed).
// 수행은 G2 기록으로 남긴다(task_key design-structure · 지도 근거 키 밖 — 설계 가설 대조는 능력 확인이 아니다).
// 응답 200 · 400 invalid_input · 404 no_design.

import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { failure, learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { canRevealItem, revealHeldResponse } from '@/lib/csat/embargo-gate'
import { STRUCTURE_TASK_KEY, gradeStructure, parseStructureResponse } from '@/lib/csat/inquiry/structure-check'
import { fromItemSlug } from '@/lib/csat/item-slug'
import { loadCsatItemExplain } from '@/lib/csat/learner'
import { isSyntheticEmail, parseClientMeta } from '@/lib/knowledge/practice'
import { selectWriter } from '@/lib/knowledge/practice-writer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const { slug } = await params
  if (!/^[A-Za-z0-9]+-\d{1,2}$/.test(slug)) return NextResponse.json({ error: '문항을 찾지 못했어요' }, { status: 404 })
  const itemRef = fromItemSlug(slug)
  if (!(await canRevealItem(itemRef))) return revealHeldResponse()
  try {
    const body = (await readJson(req)) as Record<string, unknown> | null
    const o = body ?? {}
    const now = Date.now()
    const meta = parseClientMeta(o, now)
    if (!meta.ok) return NextResponse.json({ error: meta.error, code: 'invalid_input' }, { status: 400 })
    const { item, held } = await loadCsatItemExplain(itemRef)
    if (held) return revealHeldResponse()
    const design = item?.design ?? null
    if (!design || design.roles.length === 0) return NextResponse.json({ error: '이 문항에는 구조 주석이 없어요', code: 'no_design' }, { status: 404 })
    const r = parseStructureResponse(o.response, design.roles.length)
    if (!r) return NextResponse.json({ error: '문장마다 역할과 구조를 골라 주세요', code: 'invalid_input' }, { status: 400 })
    const grade = gradeStructure(design, r)
    const writer = selectWriter(ctx.db)
    const w = {
      userId: ctx.userId, taskKey: STRUCTURE_TASK_KEY, applicationId: null, itemRef,
      contentHash: createHash('sha256').update(JSON.stringify({ roles: design.roles, alternatives: design.alternatives, pattern: design.pattern, v: item?.analysis_version ?? null })).digest('hex'),
      activity: 'theater' as const, phase: 'practice' as const, helpLevel: meta.value.helpLevel, synthetic: isSyntheticEmail(ctx.email),
      clientMutationId: meta.value.clientMutationId, clientSessionId: meta.value.clientSessionId, answeredAt: meta.value.answeredAt, sec: null,
      isCorrect: grade.isCorrect, answer: r as unknown as Record<string, unknown>, extra: { grade, analysisVersion: item?.analysis_version ?? null },
    }
    const sessionId = await writer.reveal(w)
    const outcome = await writer.record(w, sessionId)
    if (outcome === 'conflict') return NextResponse.json({ error: '같은 제출 id 로 다른 답이 왔어요 — 화면을 새로 고쳐 주세요', code: 'invalid_input' }, { status: 409 })
    return NextResponse.json({ grade, reveal: { roles: design.roles, alternatives: design.alternatives, pattern: design.pattern, cues: design.cues } })
  } catch (e) {
    return failure(e)
  }
}
