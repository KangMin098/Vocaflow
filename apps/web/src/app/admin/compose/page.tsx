// apps/web/src/app/admin/compose/page.tsx
// ACP §20 재저작(Compose) 콘솔 — 학습 유형별 발주 → 취재 → 작성 → 가공 → 발행.
//
// ACP(/admin/articles)와 나눈 이유: 두 파이프라인은 소스를 다루는 방식이 정반대다.
//   ACP     — 남의 본문을 가져와 발행한다 (라이선스가 1차 판정 기준)
//   Compose — 사실만 가져와 우리가 쓴다 (라이선스가 아니라 출처 독립성이 기준)
// 한 화면에 섞으면 "이 소스는 쓸 수 있나" 라는 같은 질문에 다른 답이 나온다.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  LEARNING_TYPES,
  trackCoverage,
  type LearningTrack,
} from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'

import { ComposeConsoleClient, type ComposeCounts, type TrackRow } from './ComposeConsoleClient'

export const dynamic = 'force-dynamic'

type CountResult = { count: number | null; error: unknown }
type CountQuery = PromiseLike<CountResult> & {
  eq(column: string, value: string | boolean): PromiseLike<CountResult>
}
/** supabase-js 제네릭과 싸우지 않도록 필요한 모양만 구조적으로 받는다. */
interface CountableClient {
  from(table: string): { select(cols: string, opts: { count: 'exact'; head: true }): CountQuery }
}

/**
 * 표가 **비어 있는 것**과 표가 **없는 것**을 구별해 돌려준다(null = 없음).
 * count 만 보면 둘 다 0 이라, 마이그레이션 미적용을 "아직 안 만든 것" 으로 오해하게 된다.
 */
async function safeCount(
  client: CountableClient,
  table: string,
  eq?: [string, string | boolean],
): Promise<number | null> {
  const base = client.from(table).select('*', { count: 'exact', head: true })
  const { count, error } = await (eq ? base.eq(eq[0], eq[1]) : base)
  if (error) return null
  return count ?? 0
}

export default async function AdminComposePage() {
  await requireAdmin('/admin/compose')

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']

  let counts: ComposeCounts = {
    feeds: null,
    feedsEnabled: null,
    batches: null,
    facts: null,
    jobsPending: null,
    jobsClaimed: null,
    jobsDone: null,
    published: null,
  }

  if (url && key) {
    const client = createServiceClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as unknown as CountableClient
    const [feeds, feedsEnabled, batches, facts, jobsPending, jobsClaimed, jobsDone, published] =
      await Promise.all([
        safeCount(client, 'article_compose_feeds'),
        safeCount(client, 'article_compose_feeds', ['enabled', true]),
        safeCount(client, 'article_compose_batches'),
        safeCount(client, 'article_fact_ledger'),
        safeCount(client, 'article_compose_jobs', ['status', 'pending']),
        safeCount(client, 'article_compose_jobs', ['status', 'claimed']),
        safeCount(client, 'article_compose_jobs', ['status', 'done']),
        safeCount(client, 'library_articles', ['source', 'original']),
      ])
    counts = { feeds, feedsEnabled, batches, facts, jobsPending, jobsClaimed, jobsDone, published }
  }

  // 유형별 소스 커버리지는 DB 가 아니라 레지스트리 계산 — 어떤 유형이 지금 발주 가능한지.
  const tracks: TrackRow[] = trackCoverage().map((row) => {
    const spec = LEARNING_TYPES[row.track as LearningTrack]
    return {
      ...row,
      composable: spec.composable,
      words: spec.compose.words,
      avgSentenceWords: spec.compose.avgSentenceWords,
      vBand: spec.vBand,
      registers: [...spec.registers],
      skills: [...spec.skills],
      activities: [...spec.activities],
      note: spec.note,
    }
  })

  return (
    <ComposeConsoleClient counts={counts} tracks={tracks} envMissing={!url || !key} />
  )
}
