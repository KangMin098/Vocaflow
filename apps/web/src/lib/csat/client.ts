// apps/web/src/lib/csat/client.ts
//
// 기출 분석 파이프라인 전용 서비스 클라이언트 + 조회 함수.
//
// 왜 별도 헬퍼인가: `@vocaflow/types` 의 `Database` 는 DB 스키마에서 생성되므로,
// 마이그레이션 `20260902055354_csat_analysis_pipeline` 을 적용하기 전 타입에는
// `csat_*` 테이블·RPC 가 없다. 라우트마다 `as any` 를 흩뿌리면 타입을 재생성했을 때
// 어디를 되돌려야 하는지 아무도 모른다. 완화 지점을 이 파일 하나로 모은다.
//
// ⚠️ 이 클라이언트는 RLS 를 우회한다. **반드시 `requireAdmin*` 게이트 뒤에서만** 쓴다.
//    `csat_items.passage` 는 평가원 저작물이라 학습자 경로로 새면 안 된다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

export function createCsatClient(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

/**
 * PostgREST 는 응답을 **1000행에서 자르고, 자르면서 오류를 내지 않는다.**
 *
 * 그래서 한 번에 읽는 코드는 조용히 틀린 수를 보여 준다. 실측 2026-09-05: 이 파일의
 * `loadCsatOverview` 가 `csat_item_analyses` 2,234행 중 1,000행만 받아 「검수 통과 문항」을
 * **802 인데 734** 로 적고 있었다. 진행률이 낮게 보이는 것으로 끝나지 않는다 — 이미 끝난
 * 유형이 「남은 몫」 상단에 올라와 관리자가 **다 된 유형에 드레인을 다시 돌게** 만든다.
 *
 * 1000행을 넘을 수 있는 조회는 전부 이 함수를 지나간다. `count: 'exact', head: true` 는
 * 서버가 세므로 영향이 없다(그래서 검수 기록 6,702 는 맞게 나오고 있었다).
 */
const PAGE = 1000

type PageResult = { data: unknown[] | null; error: { message: string } | null }

export async function selectAllPages<T>(
  build: (from: number, to: number) => PromiseLike<PageResult>,
): Promise<{ rows: T[]; error: string | null }> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const res = await build(from, from + PAGE - 1)
    if (res.error) return { rows: out, error: res.error.message }
    const batch = (res.data ?? []) as T[]
    out.push(...batch)
    if (batch.length < PAGE) break
    // 안전판 — 조회가 잘못 걸려 표 전체를 끌어오는 사고를 여기서 멈춘다
    if (out.length >= 200_000) break
  }
  return { rows: out, error: null }
}

/** 회차별 커버리지 — `csat_coverage()` RPC 한 행 */
export interface CsatCoverageRow {
  exam_id: string
  label: string
  kind: 'suneung' | 'mock'
  in_scope_items: number
  analyzed: number
  published: number
  scope_points: number
  covered_points: number
  covers_99: boolean
}

/** 유형별 진행 — 테이블 집계 */
export interface CsatTypeRow {
  type_id: string
  name: string
  section: string
  status: 'active' | 'retired'
  items: number
  published: number
  has_report: boolean
  report_n: number | null
}

export interface CsatOverview {
  coverage: CsatCoverageRow[]
  types: CsatTypeRow[]
  totals: {
    exams: number
    inScopeItems: number
    analyzed: number
    published: number
    /** 사정권(독해) 배점을 전부 덮은 회차 수 — 우리가 책임지는 「실점 0」의 정의다. 듣기는 세지 않는다 */
    exams99: number
    /** 정답표가 없어 정답 근거를 쓸 수 없는 문항 */
    answerUnknown: number
    reviews: number
  }
  loadError: string | null
}

/**
 * 콘솔 한 화면 분량을 한 번에 읽는다.
 *
 * 유형 집계를 RPC 로 만들지 않고 여기서 접는 이유: 새 RPC 는 마이그레이션이고,
 * 마이그레이션은 승인 절차가 있다. 이 집계는 유형 44 · 문항 1,350 규모라
 * 앱에서 접어도 비용이 없다. 규모가 커지면 그때 RPC 로 내린다.
 */
export async function loadCsatOverview(): Promise<CsatOverview> {
  const db = createCsatClient()
  const empty: CsatOverview = {
    coverage: [],
    types: [],
    totals: { exams: 0, inScopeItems: 0, analyzed: 0, published: 0, exams99: 0, answerUnknown: 0, reviews: 0 },
    loadError: null,
  }

  const cov = await db.rpc('csat_coverage')
  if (cov.error) return { ...empty, loadError: `csat_coverage: ${cov.error.message}` }
  const coverage = (cov.data ?? []) as CsatCoverageRow[]

  // 문항 830 · 분석 2,234 는 둘 다 1000행 벽을 넘는다 — `selectAllPages` 를 지나가야 한다.
  const [typesRes, itemsPaged, analysesPaged, reportsRes, reviewsRes] = await Promise.all([
    db.from('csat_types').select('id, name, section, status, in_scope').eq('in_scope', true),
    selectAllPages<{ id: string; type_id: string | null; answer: number | null }>((from, to) =>
      db.from('csat_items').select('id, type_id, answer').eq('in_scope', true).range(from, to),
    ),
    selectAllPages<{ item_id: string; status: string }>((from, to) =>
      db.from('csat_item_analyses').select('item_id, status').range(from, to),
    ),
    db.from('csat_type_reports').select('type_id, n_analyzed, status'),
    db.from('csat_analysis_reviews').select('id', { count: 'exact', head: true }),
  ])

  const firstError =
    typesRes.error?.message ??
    itemsPaged.error ??
    analysesPaged.error ??
    reportsRes.error?.message ??
    reviewsRes.error?.message ??
    null
  if (firstError) return { ...empty, coverage, loadError: firstError }

  // 문항 → 유형, 그리고 published 분석을 가진 문항
  const publishedItems = new Set(
    analysesPaged.rows.filter((a) => a.status === 'published').map((a) => a.item_id),
  )
  const analyzedItems = new Set(analysesPaged.rows.map((a) => a.item_id))

  const byType = new Map<string, { items: number; published: number }>()
  let answerUnknown = 0
  for (const it of itemsPaged.rows) {
    if (it.answer == null) answerUnknown += 1
    if (!it.type_id) continue
    const e = byType.get(it.type_id) ?? { items: 0, published: 0 }
    e.items += 1
    if (publishedItems.has(it.id)) e.published += 1
    byType.set(it.type_id, e)
  }

  const reportOf = new Map(
    ((reportsRes.data ?? []) as { type_id: string; n_analyzed: number; status: string }[]).map((r) => [r.type_id, r]),
  )

  const types: CsatTypeRow[] = ((typesRes.data ?? []) as { id: string; name: string; section: string; status: string }[])
    .map((t) => {
      const agg = byType.get(t.id) ?? { items: 0, published: 0 }
      const rep = reportOf.get(t.id)
      return {
        type_id: t.id,
        name: t.name,
        section: t.section,
        status: t.status as 'active' | 'retired',
        items: agg.items,
        published: agg.published,
        has_report: Boolean(rep),
        report_n: rep?.n_analyzed ?? null,
      }
    })
    // 남은 몫이 많은 유형이 위로 — 관리자가 다음에 무엇을 돌릴지 여기서 정한다
    .sort((a, b) => b.items - b.published - (a.items - a.published) || b.items - a.items)

  return {
    coverage,
    types,
    totals: {
      exams: coverage.length,
      inScopeItems: itemsPaged.rows.length,
      analyzed: analyzedItems.size,
      published: publishedItems.size,
      exams99: coverage.filter((c) => c.covers_99).length,
      answerUnknown,
      reviews: reviewsRes.count ?? 0,
    },
    loadError: null,
  }
}
