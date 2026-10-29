// apps/web/src/app/api/csat/item/[slug]/judgment/route.ts
//
// POST /api/csat/item/[slug]/judgment — 학습자가 정답을 명시적으로 요청했을 때만 정답 · 정답을 확정하는 해설을 돌려준다
// (판단 장면 정답 지연 조회 (b) · T-0147). 문항 페이지의 첫 HTML · RSC 에는 이 자료가 없다(`lib/csat/lecture/answer-split.ts`).
//
// 본문: { analysisVersion, clientExposureId(uuid), source('judgment_scene' | 'lecture_full' | 'lecture_continue') }
// 순서: 인증(401) → 문항 · 보류(404 · 423) → 분석 버전 결속(409) → **노출 원장 learning_exposure_record(answer_direct) 커밋** →
//       성공했을 때만 공개 자료(200). 기록이 실패하면 503 이고 본문에 정답 자료가 없다(fail-closed). 모든 응답 no-store.
// 같은 clientExposureId 재전송은 같은 원장 행(멱등) — 다시 공개 자료를 받는다. 다른 내용으로 같은 id 를 쓰면 RPC 가 거부 → 503.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { loadJudgmentReveal } from '@/lib/csat/judgment/server'
import type { RevealData } from '@/lib/csat/judgment/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadBoundJudgmentItem } from './bound-item'
import { judgmentToolInScope } from '@/lib/csat/judgment/pilot'

import { learnerContext, readJson } from '@/lib/csat/diagnosis/route-helpers'
import { canRevealItem, revealHeldResponse } from '@/lib/csat/embargo-gate'
import { fromItemSlug } from '@/lib/csat/item-slug'
import { loadTheaterAnswer } from '@/lib/csat/judgment-reveal'
import { loadCsatItemExplain } from '@/lib/csat/learner'
import { isSyntheticEmail } from '@/lib/knowledge/practice'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'cache-control': 'no-store' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SOURCES = new Set(['judgment_scene', 'lecture_full', 'lecture_continue'])
const TOOL_STALE = '원문 · 해설 판본이 바뀌어 이 판단 도구의 해설을 열 수 없어요. 화면을 새로 열어 주세요'
const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE })

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const ctx = await learnerContext()
  if (ctx instanceof NextResponse) {
    // 비로그인 401 도 캐시에 남기지 않는다(R147-04)
    ctx.headers.set('cache-control', 'no-store')
    return ctx
  }
  const { slug } = await params
  if (!/^[A-Za-z0-9]+-\d{1,2}$/.test(slug)) return fail(404, '문항을 찾지 못했어요')
  const o = ((await readJson(req)) ?? {}) as Record<string, unknown>
  const clientExposureId = typeof o.clientExposureId === 'string' && UUID.test(o.clientExposureId) ? o.clientExposureId : null
  const source = typeof o.source === 'string' && SOURCES.has(o.source) ? o.source : null
  const analysisVersion = typeof o.analysisVersion === 'number' && Number.isInteger(o.analysisVersion) ? o.analysisVersion : o.analysisVersion === null ? null : undefined
  if (!clientExposureId || !source || analysisVersion === undefined) return fail(400, '요청 형식이 올바르지 않아요')

  const itemId = fromItemSlug(slug)
  // 보류 시험 문항이면 정답을 읽기 전에 멈춘다 — 페이지 · 강의 API 와 같은 계약(423 · no-store)
  if (!(await canRevealItem(itemId))) return revealHeldResponse()
  const { item, error, held } = await loadCsatItemExplain(itemId)
  if (held) return revealHeldResponse()
  if (error) return fail(503, '지금은 정답을 열 수 없어요')
  if (!item) return fail(404, '문항을 찾지 못했어요')
  // 화면이 읽은 분석과 지금 분석이 다르면 섞지 않는다 — 새로 열게 한다
  if ((item.analysis_version ?? null) !== analysisVersion) return fail(409, '해설이 새 판본으로 바뀌었어요. 화면을 새로 열어 주세요')

  // D 판단 도구 결속(T-0161 r2) — 「도구 없는 정상 문항」과 「도구를 보였는데 결속이 바뀜」을 가른다.
  //   tool: null              → 화면에 도구가 없다(해설 극장의 정답 보기 · 강의) — 기존 공개만
  //   tool: {analysisVersion, unitsHash} → 화면에 도구가 있다 — 지금 결속이 같아야 한다
  //   tool 키 없음            → 도구 provider(D, 본문을 바꿀 수 없다). 도구 유형 문항이면 도구 요청으로 본다
  // 도구 요청인데 결속이 없거나 다르면 원장 기록 전에 409 — 정답 · 근거 · 해설 어느 것도 보내지 않는다
  const toolField = Object.prototype.hasOwnProperty.call(o, 'tool') ? o.tool : undefined
  const toolClaim = toolField && typeof toolField === 'object' ? (toolField as Record<string, unknown>) : null
  if (toolField !== undefined && toolField !== null && (!toolClaim || typeof toolClaim.unitsHash !== 'string' || toolClaim.analysisVersion !== analysisVersion)) return fail(400, '요청 형식이 올바르지 않아요')
  const toolRequest = toolField === undefined ? judgmentToolInScope(item.type_id, itemId) : toolClaim != null
  const admin = toolRequest ? (createAdminClient() as unknown as SupabaseClient) : null
  let bound: Awaited<ReturnType<typeof loadBoundJudgmentItem>> | null = null
  if (admin) {
    bound = await loadBoundJudgmentItem(admin, itemId, analysisVersion)
    if (!bound.item || (toolClaim && toolClaim.unitsHash !== bound.item.version.unitsHash)) return fail(409, TOOL_STALE)
  }

  const { data, error: recErr } = await ctx.db.rpc('learning_exposure_record', {
    p_user: ctx.userId,
    p_client_exposure_id: clientExposureId,
    p_item_ref: itemId,
    p_kind: 'answer_direct',
    p_source: source,
    p_analysis_version: analysisVersion,
    p_lecture_version: null,
    p_lecture_digest: null,
    p_cue_id: null,
    p_occurred_at: new Date().toISOString(),
    p_synthetic: isSyntheticEmail(ctx.email),
  })
  if (recErr || data == null) {
    console.error('[csat-judgment] exposure record failed', recErr?.code ?? 'no-id')
    return fail(503, '지금은 정답을 열 수 없어요')
  }
  // 커밋 뒤 마지막 관문 — 기록 사이에 보류가 시작됐으면 내지 않는다
  if (!(await canRevealItem(itemId))) return revealHeldResponse()
  // D 판단 도구 공개 자료 — 원장 커밋 · 마지막 관문 뒤, 기록 전에 확인한 결속과 같은 판본 · 단위 해시일 때만.
  // 그 사이 결속이 바뀌었으면 409 이고 극장 공개 자료(reveal)도 보내지 않는다(원장 행은 남는다 — 「정답 요청」 기록이 과대 쪽으로만 틀린다)
  let judgment: RevealData | null = null
  if (admin && bound?.item) {
    const again = await loadBoundJudgmentItem(admin, itemId, analysisVersion)
    judgment = again.item && again.item.version.unitsHash === bound.item.version.unitsHash ? await loadJudgmentReveal(admin, itemId, bound.item.version.analysisVersion) : null
    if (!judgment || judgment.unitsHash !== bound.item.version.unitsHash || judgment.analysisVersion !== bound.item.version.analysisVersion) return fail(409, TOOL_STALE)
  }
  const { reveal } = await loadTheaterAnswer(item)
  return NextResponse.json({ ok: true, exposureId: data, reveal, judgment }, { headers: NO_STORE })
}
