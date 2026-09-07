// apps/web/src/lib/vcb/server/production.ts
//
// 제작 단계 콘솔이 읽는 곳 — **발행된 세트 행**에서 단계 완료를 센다.
//
// 판정 규칙은 `lib/vcb/production-stages.ts` 가 갖는다(회귀가 그것을 잰다). 여기서는
// 행을 가져오기만 한다 — 판정을 여기 두면 회귀가 못 닿는 곳에 규칙이 생긴다.

import { createAdminClient } from '@/lib/supabase/admin'
import { computeStageStatus, type ProductionSetRow, type StageStatus } from '@/lib/vcb/production-stages'

/** 학습자의 공용 서가에 뜨지 않는 칸 — `lib/library/vocab/queries.ts` 와 같아야 한다. */
const HIDDEN_CATEGORIES = ['library_book', 'library_article']

export interface ProductionStatus {
  stages: StageStatus[]
  sets: number
  /** 읽지 못했을 때 관리자에게 할 말. **0 을 내지 않는다** — 0 은 "아무것도 안 됐다" 로 읽힌다. */
  problem: string | null
}

export async function readProductionStatus(): Promise<ProductionStatus> {
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return { stages: [], sets: 0, problem: '서비스 키가 없어 제작 단계를 읽지 못했다 (SUPABASE_SERVICE_ROLE_KEY)' }
  }

  const { data, error } = await supabase
    .from('shared_word_sets')
    .select('id, title, slug, word_count, curation_query')
    .eq('is_published', true)
    .not('category', 'in', `(${HIDDEN_CATEGORIES.join(',')})`)
    .order('id')
  if (error) return { stages: [], sets: 0, problem: `발행 세트를 읽지 못했다 — ${error.message}` }

  const rows = (data ?? []) as Array<{
    id: string
    title: string
    slug: string | null
    word_count: number | null
    curation_query: ProductionSetRow['curationQuery']
  }>
  const sets: ProductionSetRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    wordCount: r.word_count ?? 0,
    curationQuery: r.curation_query,
  }))

  return { stages: computeStageStatus(sets), sets: sets.length, problem: null }
}
