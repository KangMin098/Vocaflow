// apps/web/src/app/api/topic-corpus/drain/route.ts
//
// TCP 드레인 — 큐에서 N편을 claim 해 수확하고, 카운트만 적재한다.
//
// ── 재실행 안전 ──
// claim 은 `FOR UPDATE SKIP LOCKED` 라 동시 호출해도 같은 문서를 두 번 잡지 않고,
// `ingest_topic_corpus_doc` 은 이미 수확한 (source, external_id) 를 통계에 다시 더하지 않는다.
// 그러므로 이 endpoint 는 **몇 번을 눌러도 안전하다** — 중단됐던 지점부터 이어서 마른다.
//
// ── 왜 순차 처리인가 ──
// 병렬로 때리면 외부 사이트에 부담을 주고 차단당한다. 편당 짧은 간격을 두고 순차로 돈다.
// 그래서 한 번 호출의 상한(max)이 작고, Admin 화면이 큐가 마를 때까지 반복 호출한다.

import { NextResponse } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'
import { harvestTedTalk } from '@/lib/topic-corpus/harvest'
import { createTopicCorpusClient } from '@/lib/topic-corpus/client'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

/** 외부 사이트 예의 — 편당 최소 간격(ms) */
const POLITE_DELAY_MS = 1200

const MAX_PER_CALL = 10

interface DrainBody {
  /** 특정 주제만 드레인. 생략하면 전 주제에서 오래된 것부터 */
  sourceId?: string
  /** 한 번 호출에 처리할 최대 편수 (default 5, max 10) */
  max?: number
}

interface ClaimedRow {
  id: string
  source_id: string
  external_id: string
  url: string
  title: string | null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(request: Request) {
  const admin = await requireAdminApi()
  if (admin instanceof NextResponse) return admin

  let body: DrainBody = {}
  try {
    body = (await request.json()) as DrainBody
  } catch {
    // 본문 없이 호출해도 기본값으로 동작한다.
  }

  const max = Math.min(Math.max(body.max ?? 5, 1), MAX_PER_CALL)
  const supabase = createTopicCorpusClient()

  const { data: claimed, error: claimError } = await supabase.rpc('claim_topic_corpus_batch', {
    p_source_id: body.sourceId ?? null,
    p_limit: max,
  })

  if (claimError) {
    return NextResponse.json(
      { error: 'claim_failed', message: claimError.message },
      { status: 500 },
    )
  }

  const rows = (claimed ?? []) as unknown as ClaimedRow[]
  if (rows.length === 0) {
    return NextResponse.json({
      claimed: 0,
      harvested: 0,
      skipped: 0,
      failed: 0,
      drained: true,
      results: [],
    })
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

  return NextResponse.json({
    claimed: rows.length,
    harvested,
    skipped,
    failed,
    // 이번 배치가 상한을 못 채웠다면 큐가 (거의) 마른 것 — 화면이 반복 호출을 멈추는 신호.
    drained: rows.length < max,
    results,
  })
}
