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
  isAlsoAcpSource,
  trackCoverage,
  type LearningTrack,
} from '@vocaflow/library-pipeline'

import { requireAdmin } from '@/lib/auth/require-admin'

import { fetchContentGates } from './actions'

import {
  ComposeConsoleClient,
  type AttestationRow,
  type BatchRow,
  type ComposeCounts,
  type ComposedRow,
  type DerivedCounts,
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
  eq(column: string, value: string | boolean): RowsQuery<T>
  in(column: string, values: readonly string[]): RowsQuery<T>
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
  // `?? 0` 을 쓰지 않는다 — `error` 를 검사해도 부족하다. head 요청은 **없는 테이블에도**
  // error=null · count=null 을 돌려주므로, 0 으로 뭉개면 "0건" 이라는 거짓 안심이 박힌다.
  // null 은 언제나 "모름" 으로 올려보내고, 화면이 0(없음)과 다르게 그린다.
  return count
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
  const derived: Record<string, DerivedCounts> = {}

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
    // ⑥ 가공 — **계획**만 보여 주면 화면이 "붙는다" 고 말하는데 실제로 만들어졌는지는
    //    아무도 모른다. 실제 산출물 수를 함께 싣는다(드레인 세 단계에 실행 경로가 없던 것을
    //    이 화면이 끝내 알려 주지 못했던 이유이기도 하다).
    const composeIds = composed.filter((a) => a.compose_batch_id !== null).map((a) => a.id)
    for (const id of composeIds) derived[id] = { dcp: 0, vocab: 0, wordSet: false }
    if (composeIds.length > 0) {
      const [dcpRes, vocabRes, setRes] = await Promise.all([
        client.from('csat_dcp_items').select<{ ref_id: string }>('ref_id').eq('kind', 'article').in('ref_id', composeIds),
        client
          .from('library_article_vocabularies')
          .select<{ library_article_id: string }>('library_article_id')
          .in('library_article_id', composeIds),
        client
          .from('shared_word_sets')
          .select<{ curation_query: { article_id?: string } | null }>('curation_query')
          .eq('category', 'library_article')
          .eq('is_published', true),
      ])
      for (const r of (dcpRes.data ?? []) as Array<{ ref_id: string }>) {
        const d = derived[r.ref_id]
        if (d) d.dcp++
      }
      for (const r of (vocabRes.data ?? []) as Array<{ library_article_id: string }>) {
        const d = derived[r.library_article_id]
        if (d) d.vocab++
      }
      for (const r of (setRes.data ?? []) as Array<{ curation_query: { article_id?: string } | null }>) {
        const aid = r.curation_query?.article_id
        if (aid && derived[aid]) derived[aid]!.wordSet = true
      }
    }

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

  // 피드 등록 선택지 — **ACP 겹침 소스는 뺀다**. 이게 "소스가 겹치는데?" 에 대한 실무 답이다.
  //   · 피드는 **사건을 발견**하는 자리다. 기관 발표(NASA·NOAA·USGS·NIH·eLife·OWID)는
  //     ACP 가 이미 자기 피드로 수집하고 있어 여기서 또 폴링할 이유가 없다.
  //   · 기관 소스는 재저작에서 **사실 증인**으로 쓰인다 — 발견이 아니라 확인 단계에서,
  //     특정 사건의 URL 을 직접 읽는 방식이다. 그래서 ① 소스 표에는 남고 피드 목록에는 없다.
  // 승인 전 소스도 뺀다 — 등록해 놓고 왜 수집이 안 되는지 묻게 된다.
  const feedSourceOptions = Object.values(FACT_SOURCES)
    .filter(
      (s) => s.access.termsReviewed && s.discovery && s.tier !== 'background' && !isAlsoAcpSource(s.key),
    )
    .map((s) => ({ key: s.key, publisher: s.publisher, tier: s.tier }))
    .sort((a, b) => a.key.localeCompare(b.key))

  // 발행을 막는 게이트는 재저작 게이트만이 아니다 — 콘텐츠 품질 게이트가 막는 경우가 많아
  // 화면에서 "전부 통과인데 발행이 안 된다" 가 된다. 검수 대기분만 조회한다(비용 절약).
  const pendingIds = composed
    .filter((a) => a.compose_batch_id !== null && a.status !== 'published')
    .map((a) => a.id)
  const contentGates = await fetchContentGates(pendingIds.slice(0, 20))

  return (
    <ComposeConsoleClient
      counts={counts}
      contentGates={contentGates}
      tracks={tracks}
      feeds={feeds}
      batches={batches}
      jobs={jobs}
      sources={sources}
      facts={facts}
      attestations={attestations}
      composed={composed.filter((a) => a.compose_batch_id !== null)}
      derived={derived}
      gates={gates}
      feedSourceOptions={feedSourceOptions}
      acpOverlap={acpOverlap()}
      envMissing={!url || !key}
    />
  )
}
