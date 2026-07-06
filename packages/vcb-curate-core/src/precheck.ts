// packages/vcb-curate-core/src/precheck.ts
// Step 8 publish 사전 검증.
// Server Action (어드민 UI precheck) + CLI(08b-publish-precheck.ts) 공유.

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PrecheckResult,
  PrecheckStats,
  RunConfig,
  RunStatus,
  Segment,
} from './types'

const VALID_SEGMENTS: ReadonlySet<Segment> = new Set([
  'middle_school',
  'high_school',
  'toeic',
  'business',
  'academic',
  'civil_service',
  'general',
])

const MIN_PUBLISHABLE_COUNT = 50

export async function precheckPublish(
  client: SupabaseClient,
  runId: number,
): Promise<PrecheckResult> {
  const { data: runRow, error: runErr } = await client
    .from('vocab_runs')
    .select('id, collection_slug, status, config')
    .eq('id', runId)
    .maybeSingle()

  if (runErr) {
    return precheckFailure(runId, [`run fetch failed: ${runErr.message}`])
  }
  if (!runRow) {
    return precheckFailure(runId, [`run ${runId} not found`])
  }

  const run = runRow as {
    id: number
    collection_slug: string
    status: RunStatus
    config: RunConfig
  }

  const blockers: string[] = []
  const warnings: string[] = []

  if (run.status === 'published') {
    warnings.push('run is already published — this will create a new version')
  } else if (run.status !== 'curating' && run.status !== 'publishing') {
    blockers.push(`run status must be curating/publishing, got: ${run.status}`)
  }

  const { data: queueRows, error: queueErr } = await client
    .from('vocab_enrichment_queue')
    .select('id, status, vocab_seed_candidates!inner(run_id)')
    .eq('vocab_seed_candidates.run_id', runId)

  if (queueErr) {
    return precheckFailure(runId, [`queue fetch failed: ${queueErr.message}`])
  }

  let queueTotal = 0
  let queuePending = 0
  let queueEnriched = 0
  let queueFlagged = 0
  let queueFailed = 0
  const queueIds: number[] = []

  for (const row of (queueRows ?? []) as Array<{
    id: number
    status: string
  }>) {
    queueTotal += 1
    queueIds.push(row.id)
    if (row.status === 'pending') queuePending += 1
    else if (row.status === 'enriched') queueEnriched += 1
    else if (row.status === 'enriched_flagged') queueFlagged += 1
    else if (row.status === 'failed') queueFailed += 1
  }

  if (queuePending > 0) {
    blockers.push(`${queuePending} queue items still pending — run enrichment first`)
  }

  const { data: decRows, error: decErr } = await client
    .from('vocab_curation_decisions')
    .select('queue_id, decision, decided_at')
    .in('queue_id', queueIds.length > 0 ? queueIds : [-1])
    .order('decided_at', { ascending: false })

  if (decErr) {
    return precheckFailure(runId, [`decisions fetch failed: ${decErr.message}`])
  }

  const latestByQueue = new Map<number, string>()
  for (const row of (decRows ?? []) as Array<{
    queue_id: number
    decision: string
  }>) {
    if (!latestByQueue.has(row.queue_id)) {
      latestByQueue.set(row.queue_id, row.decision)
    }
  }

  // P0-6: 발행 대상 = 최신 결정이 승인(approve)/수정(edit)인 항목만.
  let acceptedCount = 0
  let rejectedCount = 0
  for (const decision of latestByQueue.values()) {
    if (decision === 'approve' || decision === 'edit') acceptedCount += 1
    else if (decision === 'reject') rejectedCount += 1
  }

  // enriched/enriched_flagged 중 승인/수정/거절 어느 것도 없는 항목 = 미검토.
  //   flagged 뿐 아니라 QA 통과한 plain enriched 도 미검토면 발행 차단 → silent 발행 방지.
  const reviewableTotal = queueEnriched + queueFlagged
  const unreviewedCount = Math.max(0, reviewableTotal - acceptedCount - rejectedCount)

  // flagged 미검토는 별도 통계로 노출 (운영자 검토 우선순위 힌트)
  let flaggedWithoutDecision = 0
  for (const id of queueIds) {
    if (!latestByQueue.has(id)) {
      const row = (queueRows ?? []).find(
        (r) => (r as { id: number }).id === id,
      ) as { status: string } | undefined
      if (row?.status === 'enriched_flagged') flaggedWithoutDecision += 1
    }
  }
  if (unreviewedCount > 0) {
    blockers.push(
      `${unreviewedCount}개 항목 미검토 — 검토 후 승인/거절하세요 (목록에서 일괄 선택→승인 가능)`,
    )
  }

  const publishableCount = acceptedCount
  if (publishableCount < MIN_PUBLISHABLE_COUNT) {
    blockers.push(`publishable count ${publishableCount} < ${MIN_PUBLISHABLE_COUNT}`)
  }

  const targetSegment = run.config.target_segment ?? null
  const targetSegmentValid =
    targetSegment !== null && VALID_SEGMENTS.has(targetSegment)
  if (!targetSegmentValid) {
    blockers.push(
      `target_segment invalid or missing: ${targetSegment ?? '<null>'}`,
    )
  }

  const { data: existingRows, error: existErr } = await client
    .from('shared_word_sets')
    .select('version')
    .eq('slug', run.collection_slug)
    .order('version', { ascending: false })
    .limit(1)

  if (existErr) {
    return precheckFailure(runId, [
      `existing versions fetch failed: ${existErr.message}`,
    ])
  }
  const existingMaxVersion =
    ((existingRows ?? [])[0] as { version: number } | undefined)?.version ?? 0

  if (queueFailed > 0) {
    warnings.push(`${queueFailed} items in failed status (will be skipped)`)
  }

  const stats: PrecheckStats = {
    queue_total: queueTotal,
    queue_pending: queuePending,
    queue_enriched: queueEnriched,
    queue_enriched_flagged: queueFlagged,
    queue_failed: queueFailed,
    flagged_without_decision: flaggedWithoutDecision,
    rejected_by_curator: rejectedCount,
    publishable_count: publishableCount,
    target_segment: targetSegment,
    target_segment_valid: targetSegmentValid,
    existing_max_version: existingMaxVersion,
  }

  return {
    ok: blockers.length === 0,
    run_id: runId,
    blockers,
    warnings,
    stats,
  }
}

function precheckFailure(runId: number, blockers: string[]): PrecheckResult {
  return {
    ok: false,
    run_id: runId,
    blockers,
    warnings: [],
    stats: {
      queue_total: 0,
      queue_pending: 0,
      queue_enriched: 0,
      queue_enriched_flagged: 0,
      queue_failed: 0,
      flagged_without_decision: 0,
      rejected_by_curator: 0,
      publishable_count: 0,
      target_segment: null,
      target_segment_valid: false,
      existing_max_version: 0,
    },
  }
}
