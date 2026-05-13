// packages/vcb-curate-core/src/publish.ts
// Step 8 publish 비즈니스 로직.
// 08-publish.ts CLI 와 Server Action (P5c 이상) 공유.
// 정합: CLAUDE.md §19.8 + §19.10 매핑.

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PublishContext,
  PublishResult,
  QueuePayload,
  RunConfig,
  RunStatus,
  Segment,
} from './types'
import { precheckPublish } from './precheck'

// Segment → shared_word_sets.category 매핑
// 실제 DB CHECK enum: 'elementary' | 'middle' | 'high' | 'csat' |
//                     'eng_test' | 'civil' | 'business' | 'themed'
// CLAUDE.md §19.10 매핑 정합.
const SEGMENT_TO_CATEGORY: Record<Segment, string> = {
  middle_school: 'middle',
  high_school: 'high',
  toeic: 'eng_test',
  business: 'business',
  academic: 'themed',
  civil_service: 'civil',
  general: 'themed',
}

interface QueueItemForPublish {
  queue_id: number
  lemma: string
  pos: string
  payload: QueuePayload
  rank_in_run: number | null
  status: string
}

export async function publishRun(
  client: SupabaseClient,
  runId: number,
  ctx: PublishContext,
): Promise<PublishResult> {
  const precheck = await precheckPublish(client, runId)
  if (!precheck.ok) {
    return {
      ok: false,
      error: `precheck blockers: ${precheck.blockers.join('; ')}`,
    }
  }

  const { data: runRow, error: runErr } = await client
    .from('vocab_runs')
    .select('id, collection_slug, collection_title, status, config')
    .eq('id', runId)
    .maybeSingle()

  if (runErr || !runRow) {
    return {
      ok: false,
      error: `run fetch failed: ${runErr?.message ?? 'not found'}`,
    }
  }
  const run = runRow as {
    id: number
    collection_slug: string
    collection_title: string
    status: RunStatus
    config: RunConfig
  }

  const segment = run.config.target_segment
  if (!segment) {
    return { ok: false, error: 'target_segment is null' }
  }
  const category = SEGMENT_TO_CATEGORY[segment]

  await client.from('vocab_runs').update({ status: 'publishing' }).eq('id', runId)

  try {
    const items = await fetchPublishableItems(client, runId)
    if (items.length === 0) {
      throw new Error('no publishable items')
    }

    const nextVersion = precheck.stats.existing_max_version + 1
    const { data: setRow, error: setErr } = await client
      .from('shared_word_sets')
      .insert({
        slug: run.collection_slug,
        version: nextVersion,
        title: run.collection_title,
        category,
        is_published: true,
        source_run_id: runId,
        source_attributions: await buildSourceAttributions(client, runId),
      })
      .select('id')
      .single()

    if (setErr || !setRow) {
      throw new Error(
        `shared_word_sets insert failed: ${setErr?.message ?? 'unknown'}`,
      )
    }
    const setId = (setRow as { id: string }).id

    const insertRows = items.map((it, idx) => ({
      set_id: setId,
      word: it.lemma,
      meaning_ko: it.payload.definitions_ko[0]?.sense ?? '',
      example_en: it.payload.examples[0]?.en ?? null,
      pronunciation: it.payload.ipa,
      part_of_speech: it.pos.toLowerCase(),
      cefr_level: it.payload.cefr,
      sort_order: idx,
      ipa: it.payload.ipa,
      definitions_ko_full: it.payload.definitions_ko,
      definitions_en_full: it.payload.definitions_en,
      examples_full: it.payload.examples,
      synonyms: it.payload.synonyms,
      antonyms: it.payload.antonyms,
      collocations: it.payload.collocations,
      korean_learner_note: it.payload.korean_learner_note,
      confidence: it.payload.confidence,
      source_run_id: runId,
      source_queue_id: it.queue_id,
    }))

    const { error: wordsErr } = await client.from('shared_words').insert(insertRows)
    if (wordsErr) {
      throw new Error(`shared_words bulk insert failed: ${wordsErr.message}`)
    }

    const { data: collRow, error: collErr } = await client
      .from('vocab_collections')
      .insert({
        run_id: runId,
        slug: run.collection_slug,
        title: run.collection_title,
        version: nextVersion,
        published_word_count: items.length,
        shared_word_set_id: setId,
        notes: ctx.published_by ? `published_by=${ctx.published_by}` : null,
      })
      .select('id')
      .single()

    if (collErr || !collRow) {
      throw new Error(
        `vocab_collections insert failed: ${collErr?.message ?? 'unknown'}`,
      )
    }

    await client.from('vocab_runs').update({ status: 'published' }).eq('id', runId)

    return {
      ok: true,
      shared_word_set_id: setId,
      collection_id: (collRow as { id: number }).id,
      version: nextVersion,
      published_count: items.length,
    }
  } catch (err) {
    await client.from('vocab_runs').update({ status: 'curating' }).eq('id', runId)
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

async function fetchPublishableItems(
  client: SupabaseClient,
  runId: number,
): Promise<QueueItemForPublish[]> {
  const { data, error } = await client
    .from('vocab_enrichment_queue')
    .select(
      `id, status, enriched_payload,
       vocab_seed_candidates!inner(lemma, pos, rank_in_run, run_id)`,
    )
    .eq('vocab_seed_candidates.run_id', runId)
    .in('status', ['enriched', 'enriched_flagged'])

  if (error) {
    throw new Error(`fetch publishable items failed: ${error.message}`)
  }

  const rows = (data ?? []) as unknown as Array<{
    id: number
    status: string
    enriched_payload: QueuePayload
    vocab_seed_candidates: {
      lemma: string
      pos: string
      rank_in_run: number | null
    }
  }>

  const queueIds = rows.map((r) => r.id)
  const { data: decData } = await client
    .from('vocab_curation_decisions')
    .select('queue_id, decision, edited_payload, decided_at')
    .in('queue_id', queueIds.length > 0 ? queueIds : [-1])
    .order('decided_at', { ascending: false })

  const latestByQueue = new Map<
    number,
    { decision: string; edited_payload: QueuePayload | null }
  >()
  for (const row of (decData ?? []) as Array<{
    queue_id: number
    decision: string
    edited_payload: QueuePayload | null
  }>) {
    if (!latestByQueue.has(row.queue_id)) {
      latestByQueue.set(row.queue_id, {
        decision: row.decision,
        edited_payload: row.edited_payload,
      })
    }
  }

  const result: QueueItemForPublish[] = []
  for (const row of rows) {
    const dec = latestByQueue.get(row.id)
    if (dec?.decision === 'reject') continue

    const payload =
      dec?.decision === 'edit' && dec.edited_payload
        ? dec.edited_payload
        : row.enriched_payload

    result.push({
      queue_id: row.id,
      lemma: row.vocab_seed_candidates.lemma,
      pos: row.vocab_seed_candidates.pos,
      payload,
      rank_in_run: row.vocab_seed_candidates.rank_in_run,
      status: row.status,
    })
  }

  result.sort(
    (a, b) => (a.rank_in_run ?? 99999) - (b.rank_in_run ?? 99999),
  )

  return result
}

async function buildSourceAttributions(
  client: SupabaseClient,
  runId: number,
): Promise<
  Array<{ source_id: number; slug: string; title: string; citation: string }>
> {
  const { data, error } = await client
    .from('vocab_raw_texts')
    .select('source_id, vocab_sources!inner(id, slug, title, citation)')
    .eq('run_id', runId)
    .not('source_id', 'is', null)

  if (error) {
    throw new Error(`source attributions fetch failed: ${error.message}`)
  }

  const seen = new Set<number>()
  const result: Array<{
    source_id: number
    slug: string
    title: string
    citation: string
  }> = []

  // Supabase 조인 결과는 단일 row 인데 PostgREST 타입 추론은 array — unknown 캐스팅 우회
  for (const row of (data ?? []) as unknown as Array<{
    source_id: number
    vocab_sources: {
      id: number
      slug: string
      title: string
      citation: string
    }
  }>) {
    if (seen.has(row.source_id)) continue
    seen.add(row.source_id)
    result.push({
      source_id: row.vocab_sources.id,
      slug: row.vocab_sources.slug,
      title: row.vocab_sources.title,
      citation: row.vocab_sources.citation,
    })
  }
  return result
}
