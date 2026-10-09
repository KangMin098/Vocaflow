// apps/web/src/app/api/csat/item/[slug]/reveal/route.ts
//
// POST /api/csat/item/[slug]/reveal — 해설 극장에서 이 문항의 해설(정답 · 근거 · 오답 설계)을 공개한 순간을 서버 학습 세션에 남긴다.
// 본문: { sessionId, help('independent'|'viewed_first'), revealedAt, userId(공개한 계정) }. 응답: { ok, outcome }. 계정이 다르면 409 로 버린다.
// 지금까지 극장 공개는 기기 기록에만 있어, 같은 문항의 Practice · 확인 과제가 「해설을 본 뒤의 판단」 인지 서버가 몰랐다(Codex P1).
// G2 learning_session_apply(activity theater · stage revealed · p_explanation_viewed_at = 공개 시각)로 별도 mutation 을 남긴다 — 시도가 아니다.
// 같은 공개의 재전송은 같은 mutation(세션 id 로 결정) → duplicate. userId · 합성 여부는 세션에서만.
import { NextResponse } from 'next/server'

import { learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { fromItemSlug } from '@/lib/csat/item-slug'
import { isSyntheticEmail } from '@/lib/knowledge/practice'
import { stableUuid } from '@/lib/knowledge/practice-writer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SKEW_MS = 5 * 60_000
const MAX_AGE_MS = 30 * 86_400_000

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) return ctx
  const { slug } = await params
  if (!/^[A-Za-z0-9]+-\d{1,2}$/.test(slug)) return NextResponse.json({ error: '문항을 찾지 못했어요' }, { status: 404 })
  const o = ((await readJson(req)) ?? {}) as Record<string, unknown>
  if (typeof o.sessionId !== 'string' || o.sessionId.length < 8 || o.sessionId.length > 120) return NextResponse.json({ error: '세션을 다시 열어 주세요' }, { status: 400 })
  // 공개한 계정과 지금 계정이 다르면(공유 기기 재전송) 남기지 않는다 — 다른 학습자 기록 오염 방지
  if (typeof o.userId === 'string' && o.userId !== ctx.userId) return NextResponse.json({ ok: false, error: '다른 계정의 기록이에요', dropped: true }, { status: 409 })
  const help = o.help === 'independent' || o.help === 'viewed_first' ? o.help : null
  if (!help) return NextResponse.json({ error: '도움 수준이 올바르지 않아요' }, { status: 400 })
  const now = Date.now()
  const at = typeof o.revealedAt === 'string' ? Date.parse(o.revealedAt) : Number.NaN
  if (!Number.isFinite(at) || at > now + SKEW_MS || at < now - MAX_AGE_MS) return NextResponse.json({ error: '공개 시각이 올바르지 않아요' }, { status: 400 })
  const revealedAt = new Date(at).toISOString()
  // 기기 세션 id 는 UUID 가 아닐 수 있다 — 서버 세션 키는 그 id 에서 결정적으로 만든다(같은 기기 세션 = 같은 서버 세션)
  const clientSessionId = stableUuid('theater-session', o.sessionId)
  const { data, error } = await ctx.db.rpc('learning_session_apply', {
    p_user: ctx.userId,
    p_mutation: stableUuid(clientSessionId, 'theater-reveal'),
    p_client_session_id: clientSessionId,
    p_activity: 'theater',
    p_phase: 'practice',
    p_item_ref: fromItemSlug(slug),
    p_stage: 'revealed',
    p_step: 0,
    p_steps: 1,
    p_help_level: help,
    p_at: revealedAt,
    p_synthetic: isSyntheticEmail(ctx.email),
    p_explanation_viewed_at: revealedAt,
  })
  if (error) {
    console.error('[csat-item-reveal]', error.message)
    return NextResponse.json({ error: '해설 공개를 기록하지 못했어요' }, { status: 500 })
  }
  const row = (Array.isArray(data) ? data[0] : data) as { outcome?: string } | null
  if (row?.outcome !== 'applied' && row?.outcome !== 'duplicate') return NextResponse.json({ error: '해설 공개 기록이 맞지 않아요', outcome: row?.outcome ?? null }, { status: 409 })
  return NextResponse.json({ ok: true, outcome: row.outcome })
}
