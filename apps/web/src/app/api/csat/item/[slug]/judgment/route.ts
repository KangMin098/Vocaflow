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
  const { reveal } = await loadTheaterAnswer(item)
  return NextResponse.json({ ok: true, exposureId: data, reveal }, { headers: NO_STORE })
}
