// apps/web/src/app/admin/compose/page.tsx
// ACP §20 재저작(Compose) 콘솔 — 학습 유형별 발주 → 취재 → 작성 → 가공 → 발행.
//
// ACP(/admin/articles)와 나눈 이유: 두 파이프라인은 소스를 다루는 방식이 정반대다.
//   ACP     — 남의 본문을 가져와 발행한다 (라이선스가 1차 판정 기준)
//   Compose — 사실만 가져와 우리가 쓴다 (라이선스가 아니라 출처 독립성이 기준)
// 한 화면에 섞으면 "이 소스는 쓸 수 있나" 라는 같은 질문에 다른 답이 나온다.

import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  FACT_SOURCES,
  LEARNING_TYPES,
  acpOverlap,
  trackCoverage,
  type LearningTrack,
} from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'

import {
  ComposeConsoleClient,
  type AttestationRow,
  type BatchRow,
  type ComposeCounts,
  type ComposedRow,
  type FactRow,
  type FeedRow,
  type GateRow,
  type JobRow,
  type SourceRow,
  type TrackRow,
} from './ComposeConsoleClient'

export const dynamic = 'force-dynamic'

type CountResult = { count: number | null; error: unknown }
type CountQuery = PromiseLike<CountResult> & {
  eq(column: string, value: string | boolean): PromiseLike<CountResult>
}
type RowsResult<T> = { data: T[] | null; error: unknown }
type RowsQuery<T> = PromiseLike<RowsResult<T>> & {
  order(column: string, opts: { ascending: boolean }): RowsQuery<T>
  limit(n: number): RowsQuery<T>
}
/** supabase-js 제네릭과 싸우지 않도록 필요한 모양만 구조적으로 받는다. */
interface CountableClient {
  from(table: string): {
    select(cols: string, opts: { count: 'exact'; head: true }): CountQuery
    select<T>(cols: string): RowsQuery<T>
  }
}

/** 표가 없으면 빈 배열 — 화면은 '없음'을 counts 의 `—` 로 이미 구별해 보여 준다. */
async function safeRows<T>(
  client: CountableClient,
  table: string,
  cols: string,
  order: string,
  limit = 100,
): Promise<T[]> {
  const { data, error } = await client
    .from(table)
    .select<T>(cols)
    .order(order, { ascending: false })
    .limit(limit)
  return error ? [] : (data ?? [])
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

  let feeds: FeedRow[] = []
  let batches: BatchRow[] = []
  let jobs: JobRow[] = []
  let sources: SourceRow[] = []
  let facts: FactRow[] = []
  let attestations: AttestationRow[] = []
  let composed: ComposedRow[] = []
  let gates: GateRow[] = []

  if (url && key) {
    const client = createServiceClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as unknown as CountableClient

    feeds = await safeRows<FeedRow>(
      client,
      'article_compose_feeds',
      'id, source_key, url, label, enabled, robots_status, robots_at, last_polled_at, last_found, last_note',
      'created_at',
    )
    batches = await safeRows<BatchRow>(
      client,
      'article_compose_batches',
      'id, topic, event_occurred_at, status, created_at',
      'created_at',
      50,
    )
    sources = await safeRows<SourceRow>(
      client,
      'article_compose_sources',
      'id, batch_id, publisher, url, published_at, access_basis, wire',
      'fetched_at',
      200,
    )
    facts = await safeRows<FactRow>(
      client,
      'article_fact_ledger',
      'id, batch_id, claim, kind, quote, quote_is_public, created_at',
      'created_at',
      200,
    )
    attestations = await safeRows<AttestationRow>(
      client,
      'article_fact_attestation',
      'fact_id, source_id, ordinal',
      'ordinal',
      500,
    )
    composed = await safeRows<ComposedRow>(
      client,
      'library_articles',
      'id, title, status, register, cefr_level, article_v_level, word_count, audio_url, compose_batch_id, content_hash',
      'created_at',
      100,
    )
    gates = await safeRows<GateRow>(
      client,
      'article_compose_gates',
      'article_id, invariant, severity, verdict, detail, content_hash',
      'checked_at',
      500,
    )
    jobs = await safeRows<JobRow>(
      client,
      'article_compose_jobs',
      'id, batch_id, track, register, target_v_level, skill_focus, words_min, words_max, status, claimed_by, claimed_at, attempts, last_error, article_id',
      'created_at',
      100,
    )
    const [
      feedCount,
      feedsEnabled,
      batchCount,
      factCount,
      jobsPending,
      jobsClaimed,
      jobsDone,
      published,
    ] = await Promise.all([
        safeCount(client, 'article_compose_feeds'),
        safeCount(client, 'article_compose_feeds', ['enabled', true]),
        safeCount(client, 'article_compose_batches'),
        safeCount(client, 'article_fact_ledger'),
        safeCount(client, 'article_compose_jobs', ['status', 'pending']),
        safeCount(client, 'article_compose_jobs', ['status', 'claimed']),
        safeCount(client, 'article_compose_jobs', ['status', 'done']),
        safeCount(client, 'library_articles', ['source', 'original']),
      ])
    counts = {
      feeds: feedCount,
      feedsEnabled,
      batches: batchCount,
      facts: factCount,
      jobsPending,
      jobsClaimed,
      jobsDone,
      published,
    }
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

  // 피드 등록 폼의 선택지 — 승인된 소스만. 승인 전 소스를 고를 수 있으면
  // 등록해 놓고 왜 수집이 안 되는지 묻게 된다.
  const feedSourceOptions = Object.values(FACT_SOURCES)
    .filter((s) => s.access.termsReviewed && s.tier !== 'background')
    .map((s) => ({ key: s.key, publisher: s.publisher, tier: s.tier }))
    .sort((a, b) => a.key.localeCompare(b.key))

  return (
    <ComposeConsoleClient
      counts={counts}
      tracks={tracks}
      feeds={feeds}
      batches={batches}
      jobs={jobs}
      sources={sources}
      facts={facts}
      attestations={attestations}
      composed={composed.filter((a) => a.compose_batch_id !== null)}
      gates={gates}
      feedSourceOptions={feedSourceOptions}
      acpOverlap={acpOverlap()}
      envMissing={!url || !key}
    />
  )
}
