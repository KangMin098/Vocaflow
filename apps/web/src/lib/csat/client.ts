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

  const [typesRes, itemsRes, analysesRes, reportsRes, reviewsRes] = await Promise.all([
    db.from('csat_types').select('id, name, section, status, in_scope').eq('in_scope', true),
    db.from('csat_items').select('id, type_id, answer').eq('in_scope', true),
    db.from('csat_item_analyses').select('item_id, status'),
    db.from('csat_type_reports').select('type_id, n_analyzed, status'),
    db.from('csat_analysis_reviews').select('id', { count: 'exact', head: true }),
  ])

  const firstError = [typesRes, itemsRes, analysesRes, reportsRes, reviewsRes].find((r) => r.error)
  if (firstError?.error) return { ...empty, coverage, loadError: firstError.error.message }

  // 문항 → 유형, 그리고 published 분석을 가진 문항
  const publishedItems = new Set(
    ((analysesRes.data ?? []) as { item_id: string; status: string }[])
      .filter((a) => a.status === 'published')
      .map((a) => a.item_id),
  )
  const analyzedItems = new Set(
    ((analysesRes.data ?? []) as { item_id: string }[]).map((a) => a.item_id),
  )

  const byType = new Map<string, { items: number; published: number }>()
  let answerUnknown = 0
  for (const it of (itemsRes.data ?? []) as { id: string; type_id: string | null; answer: number | null }[]) {
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
      inScopeItems: (itemsRes.data ?? []).length,
      analyzed: analyzedItems.size,
      published: publishedItems.size,
      exams99: coverage.filter((c) => c.covers_99).length,
      answerUnknown,
      reviews: reviewsRes.count ?? 0,
    },
    loadError: null,
  }
}
