// apps/web/src/lib/topic-corpus/drain.ts
//
// TCP 드레인 **한 배치**의 본체 — 큐에서 N편을 claim 해 수확하고 결과를 돌려준다.
//
// ── 왜 라우트에서 떼어 냈나 (2026-08-26) ─────────────────────────────
// 이 로직은 원래 `app/api/topic-corpus/drain/route.ts` 안에만 있었다. 그래서 큐를 비우려면
// **관리자가 브라우저 탭을 열어 두고** 화면이 반복 호출해 주기를 기다려야 했다.
// 실측 당시 대기 **85,179건** — 한 호출 상한 10편에 편당 1.2초 예의 지연이라
// 사람이 지키고 앉아 있을 분량이 아니다.
//
// 그래서 본체를 여기로 옮기고, 라우트와 헤드리스 워커(`scripts/topic-corpus/drain-loop.mts`)가
// **같은 함수**를 부른다. 두 벌로 짜면 한쪽만 고쳐지고 그 차이는 아무도 안 본다.
//
// ── 재실행 안전 ──
// `claim_topic_corpus_batch` 는 `FOR UPDATE SKIP LOCKED` 라 동시 호출해도 같은 문서를
// 두 번 잡지 않고, `ingest_topic_corpus_doc` 은 이미 수확한 (source, external_id) 를
// 통계에 다시 더하지 않는다. **몇 번을 돌려도 안전하다.**
//
// ── 왜 순차인가 ──
// 병렬로 때리면 외부 사이트에 부담을 주고 차단당한다. 편당 간격을 두고 순차로 돈다.
// 이 상수(`POLITE_DELAY_MS`·`MAX_PER_CALL`)를 올리는 것은 **성능 개선이 아니라 차단 위험**이다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { harvestTedTalk } from './harvest'

/** 외부 사이트 예의 — 편당 최소 간격(ms) */
export const POLITE_DELAY_MS = 1200

/** 한 번 호출에 처리할 수 있는 최대 편수 */
export const MAX_PER_CALL = 10

export interface ClaimedRow {
  id: string
  source_id: string
  external_id: string
  url: string
  title: string | null
}

export interface DrainBatchOptions {
  /** 특정 주제만. 생략하면 전 주제에서 오래된 것부터 */
  sourceId?: string | null
  /** 이번 배치 최대 편수 (1..MAX_PER_CALL) */
  max?: number
}

export interface DrainBatchResult {
  claimed: number
  harvested: number
  skipped: number
  failed: number
  /** 큐가 말랐는가 — claim 이 0건이면 true */
  drained: boolean
  results: Array<Record<string, unknown>>
  /** claim 자체가 실패했을 때만 채워진다 */
  error?: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 한 배치를 드레인한다. 던지지 않는다 — 실패는 `error` 로 돌려준다
 * (루프가 예외로 죽으면 남은 큐를 못 비운다).
 */
export async function drainTopicCorpusBatch(
  supabase: SupabaseClient,
  opts: DrainBatchOptions = {},
): Promise<DrainBatchResult> {
  const max = Math.min(Math.max(opts.max ?? 5, 1), MAX_PER_CALL)

  const { data: claimed, error: claimError } = await supabase.rpc('claim_topic_corpus_batch', {
    p_source_id: opts.sourceId ?? null,
    p_limit: max,
  })

  if (claimError) {
    return { claimed: 0, harvested: 0, skipped: 0, failed: 0, drained: false, results: [], error: claimError.message }
  }

  const rows = (claimed ?? []) as unknown as ClaimedRow[]
  if (rows.length === 0) {
    return { claimed: 0, harvested: 0, skipped: 0, failed: 0, drained: true, results: [] }
  }

  const results: Array<Record<string, unknown>> = []
  let harvested = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!
    if (i > 0) await sleep(POLITE_DELAY_MS)

    const outcome = await harvestTedTalk(supabase, row.source_id, row.url)

    if (outcome.ok) {
      harvested += 1
      results.push({
        queue_id: row.id,
        source_id: row.source_id,
        external_id: outcome.externalId,
        title: outcome.title,
        ok: true,
        already_ingested: outcome.alreadyIngested,
        running_words: outcome.runningWords,
        unique_words: outcome.uniqueWords,
        resolved_words: outcome.resolvedWords,
        gap_words: outcome.gapWords,
        truncated: outcome.truncated,
        ted_topics: outcome.tedTopics,
      })
      // ingest RPC 안에서 큐를 done 으로 닫는다 — 여기서 또 건드리지 않는다.
      continue
    }

    // 실패: 영구/일시를 구분해 되돌린다. 이 구분이 없으면 자막 없는 강연이 큐에 영원히 남는다.
    const nextStatus = outcome.permanent ? 'skipped' : 'pending'
    if (outcome.permanent) skipped += 1
    else failed += 1

    await supabase.rpc('release_topic_corpus_claim', {
      p_id: row.id,
      p_status: nextStatus,
      p_error: outcome.reason,
    })

    results.push({
      queue_id: row.id,
      source_id: row.source_id,
      external_id: outcome.externalId,
      ok: false,
      permanent: outcome.permanent,
      reason: outcome.reason,
    })
  }

  return { claimed: rows.length, harvested, skipped, failed, drained: false, results }
}
