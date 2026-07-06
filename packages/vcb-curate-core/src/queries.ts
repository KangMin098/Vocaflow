// packages/vcb-curate-core/src/queries.ts
// Run / Queue 조회 함수. Server Action (apps/web) + CLI (scripts/vcb/) 공유.

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  RunSummary,
  RunDetail,
  QueueListItem,
  QueueDetail,
  QueueListQuery,
  CurationDecisionKind,
  CurationFilter,
  CurationSort,
  RunConfig,
  Pos,
  QueuePayload,
  QueueStatus,
  RunStatus,
  SeedOrigin,
} from './types'

// ── helpers ────────────────────────────────────────

interface RunRow {
  id: number
  collection_slug: string
  collection_title: string
  status: RunStatus
  config: RunConfig
  created_at: string
  updated_at: string
}

interface AggregateRow {
  seed_count: number
  pending_count: number
  enriched_count: number
  flagged_count: number
  failed_count: number
  approved_count: number
}

async function aggregateRunCounts(
  client: SupabaseClient,
  runId: number,
): Promise<AggregateRow> {
  const { count: seedCount } = await client
    .from('vocab_seed_candidates')
    .select('*', { count: 'exact', head: true })
    .eq('run_id', runId)

  const { data: queueRows } = await client
    .from('vocab_enrichment_queue')
    .select('status, seed_id, vocab_seed_candidates!inner(run_id)')
    .eq('vocab_seed_candidates.run_id', runId)

  let pending = 0
  let enriched = 0
  let flagged = 0
  let failed = 0

  for (const row of queueRows ?? []) {
    const status = (row as { status: QueueStatus }).status
    if (status === 'pending') pending += 1
    else if (status === 'enriched') enriched += 1
    else if (status === 'enriched_flagged') flagged += 1
    else if (status === 'failed') failed += 1
  }

  // approved_count = 최신 결정이 승인(approve)/수정(edit)인 항목 수 — 발행 대상(publishable)과 정합(P0-6).
  //   기존 "과거에 approve 한 적 있음" 집계는 발행 정의와 불일치 → 무결성 배너 오탐 원인이었음.
  const { data: decisionRows } = await client
    .from('vocab_curation_decisions')
    .select(
      'queue_id, decision, decided_at, vocab_enrichment_queue!inner(vocab_seed_candidates!inner(run_id))',
    )
    .eq('vocab_enrichment_queue.vocab_seed_candidates.run_id', runId)
    .order('decided_at', { ascending: false })

  const latestDecision = new Map<number, string>()
  for (const row of (decisionRows ?? []) as Array<{
    queue_id: number
    decision: string
  }>) {
    if (!latestDecision.has(row.queue_id)) {
      latestDecision.set(row.queue_id, row.decision)
    }
  }
  let approved = 0
  for (const d of latestDecision.values()) {
    if (d === 'approve' || d === 'edit') approved += 1
  }

  return {
    seed_count: seedCount ?? 0,
    pending_count: pending,
    enriched_count: enriched,
    flagged_count: flagged,
    failed_count: failed,
    approved_count: approved,
  }
}

// ── Run 조회 ───────────────────────────────────────

export async function fetchRuns(client: SupabaseClient): Promise<RunSummary[]> {
  const { data, error } = await client
    .from('vocab_runs')
    .select(
      'id, collection_slug, collection_title, status, config, created_at, updated_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`fetchRuns failed: ${error.message}`)
  }

  const rows = (data ?? []) as RunRow[]
  const summaries: RunSummary[] = []

  for (const row of rows) {
    const counts = await aggregateRunCounts(client, row.id)
    const cfg = (row.config ?? {}) as RunConfig
    summaries.push({
      id: row.id,
      collection_slug: row.collection_slug,
      collection_title: row.collection_title,
      status: row.status,
      target_segment: cfg.target_segment ?? null,
      target_count: null,
      ...counts,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  return summaries
}

export async function fetchRunDetail(
  client: SupabaseClient,
  runId: number,
): Promise<RunDetail | null> {
  const { data, error } = await client
    .from('vocab_runs')
    .select(
      'id, collection_slug, collection_title, status, config, created_at, updated_at',
    )
    .eq('id', runId)
    .maybeSingle()

  if (error) {
    throw new Error(`fetchRunDetail failed: ${error.message}`)
  }
  if (!data) return null

  const row = data as RunRow
  const cfg = (row.config ?? {}) as RunConfig
  const counts = await aggregateRunCounts(client, runId)

  const { count: sourceCount } = await client
    .from('vocab_raw_texts')
    .select('source_id', { count: 'exact', head: true })
    .eq('run_id', runId)
    .not('source_id', 'is', null)

  return {
    id: row.id,
    collection_slug: row.collection_slug,
    collection_title: row.collection_title,
    status: row.status,
    target_segment: cfg.target_segment ?? null,
    target_count: null,
    ...counts,
    created_at: row.created_at,
    updated_at: row.updated_at,
    config: cfg,
    source_count: sourceCount ?? 0,
  }
}

// ── Queue list ─────────────────────────────────────

interface QueueRowRaw {
  id: number
  status: QueueStatus
  qa_flags: string[] | null
  enriched_payload: Partial<QueuePayload> | null
  vocab_seed_candidates: {
    id: number
    lemma: string
    pos: Pos
    rank_in_run: number | null
    seed_origin: SeedOrigin
  }
}

async function fetchLatestDecisions(
  client: SupabaseClient,
  queueIds: number[],
): Promise<Map<number, CurationDecisionKind>> {
  const map = new Map<number, CurationDecisionKind>()
  if (queueIds.length === 0) return map

  const { data, error } = await client
    .from('vocab_curation_decisions')
    .select('queue_id, decision, decided_at')
    .in('queue_id', queueIds)
    .order('decided_at', { ascending: false })

  if (error) {
    throw new Error(`fetchLatestDecisions failed: ${error.message}`)
  }

  for (const row of (data ?? []) as Array<{
    queue_id: number
    decision: CurationDecisionKind
  }>) {
    if (!map.has(row.queue_id)) {
      map.set(row.queue_id, row.decision)
    }
  }
  return map
}

async function fetchNgslRanks(
  client: SupabaseClient,
  lemmas: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (lemmas.length === 0) return map

  const { data, error } = await client
    .from('shared_dictionary')
    .select('word, frequency_rank')
    .in('word', lemmas)
    .not('frequency_rank', 'is', null)

  if (error) {
    throw new Error(`fetchNgslRanks failed: ${error.message}`)
  }

  for (const row of (data ?? []) as Array<{
    word: string
    frequency_rank: number
  }>) {
    map.set(row.word, row.frequency_rank)
  }
  return map
}

export async function fetchQueueItems(
  client: SupabaseClient,
  query: QueueListQuery,
): Promise<QueueListItem[]> {
  const filter: CurationFilter = query.filter ?? 'all'
  const sort: CurationSort = query.sort ?? 'ngsl_rank_asc'
  const limit = query.limit ?? 500
  const offset = query.offset ?? 0

  let q = client
    .from('vocab_enrichment_queue')
    .select(
      `id, status, qa_flags, enriched_payload,
       vocab_seed_candidates!inner(id, lemma, pos, rank_in_run, seed_origin, run_id)`,
    )
    .eq('vocab_seed_candidates.run_id', query.run_id)

  if (filter === 'flagged') {
    q = q.eq('status', 'enriched_flagged')
  }

  q = q.range(offset, offset + limit - 1)

  const { data, error } = await q
  if (error) {
    throw new Error(`fetchQueueItems failed: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as QueueRowRaw[]
  const queueIds = rows.map((r) => r.id)
  const lemmas = rows.map((r) => r.vocab_seed_candidates.lemma)

  const [decisionMap, ngslMap] = await Promise.all([
    fetchLatestDecisions(client, queueIds),
    fetchNgslRanks(client, lemmas),
  ])

  let items: QueueListItem[] = rows.map((row): QueueListItem => {
    const payload = row.enriched_payload ?? {}
    return {
      queue_id: row.id,
      lemma: row.vocab_seed_candidates.lemma,
      pos: row.vocab_seed_candidates.pos,
      status: row.status,
      qa_flags: row.qa_flags ?? [],
      rank_in_run: row.vocab_seed_candidates.rank_in_run,
      seed_origin: row.vocab_seed_candidates.seed_origin,
      cefr: payload.cefr ?? null,
      confidence: payload.confidence ?? null,
      latest_decision: decisionMap.get(row.id) ?? null,
      ngsl_rank: ngslMap.get(row.vocab_seed_candidates.lemma) ?? null,
    }
  })

  if (filter === 'rejected') {
    items = items.filter((i) => i.latest_decision === 'reject')
  } else if (filter === 'unreviewed') {
    items = items.filter((i) => i.latest_decision === null)
  } else if (filter === 'ai_seed') {
    items = items.filter((i) => i.seed_origin === 'ai_generated')
  } else if (filter === 'flagged') {
    items = items.filter(
      (i) => i.qa_flags.length > 0 && i.latest_decision === null,
    )
  }

  const cefrOrder: Record<string, number> = {
    A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6,
  }
  if (sort === 'ngsl_rank_asc') {
    items.sort((a, b) => (a.ngsl_rank ?? 99999) - (b.ngsl_rank ?? 99999))
  } else if (sort === 'cefr_asc') {
    items.sort(
      (a, b) =>
        (cefrOrder[a.cefr ?? 'B1'] ?? 99) - (cefrOrder[b.cefr ?? 'B1'] ?? 99),
    )
  } else if (sort === 'confidence_desc') {
    items.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
  } else if (sort === 'origin') {
    items.sort((a, b) => a.seed_origin.localeCompare(b.seed_origin))
  }

  return items
}

// ── Queue detail ───────────────────────────────────

interface QueueDetailRow {
  id: number
  status: QueueStatus
  qa_flags: string[] | null
  enriched_payload: QueuePayload | null
  vocab_seed_candidates: {
    lemma: string
    pos: Pos
    seed_origin: SeedOrigin
  }
}

export async function fetchQueueDetail(
  client: SupabaseClient,
  queueId: number,
): Promise<QueueDetail | null> {
  const { data, error } = await client
    .from('vocab_enrichment_queue')
    .select(
      `id, status, qa_flags, enriched_payload,
       vocab_seed_candidates!inner(lemma, pos, seed_origin)`,
    )
    .eq('id', queueId)
    .maybeSingle()

  if (error) {
    throw new Error(`fetchQueueDetail failed: ${error.message}`)
  }
  if (!data) return null

  const row = data as unknown as QueueDetailRow
  const payload = row.enriched_payload ?? buildEmptyPayload()

  const { data: histRows, error: histErr } = await client
    .from('vocab_curation_decisions')
    .select('decision, note, decided_at')
    .eq('queue_id', queueId)
    .order('decided_at', { ascending: false })
  if (histErr) {
    throw new Error(`fetchQueueDetail history failed: ${histErr.message}`)
  }
  const history = (
    (histRows ?? []) as Array<{
      decision: CurationDecisionKind
      note: string | null
      decided_at: string
    }>
  ).map((h) => ({
    decision: h.decision,
    note: h.note,
    decided_at: h.decided_at,
  }))

  const ngslMap = await fetchNgslRanks(client, [row.vocab_seed_candidates.lemma])

  return {
    queue_id: row.id,
    lemma: row.vocab_seed_candidates.lemma,
    pos: row.vocab_seed_candidates.pos,
    status: row.status,
    qa_flags: row.qa_flags ?? [],
    seed_origin: row.vocab_seed_candidates.seed_origin,
    payload,
    ngsl_rank: ngslMap.get(row.vocab_seed_candidates.lemma) ?? null,
    latest_decision: history[0]?.decision ?? null,
    decision_history: history,
  }
}

function buildEmptyPayload(): QueuePayload {
  return {
    ipa: null,
    cefr: null,
    definitions_ko: [],
    definitions_en: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    collocations: [],
    korean_learner_note: null,
    confidence: 0,
  }
}
