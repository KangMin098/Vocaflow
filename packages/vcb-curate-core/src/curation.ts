// packages/vcb-curate-core/src/curation.ts
// 큐레이션 결정 함수 (approve / reject / edit / reenrich + bulk).
// CLI(07-curate.ts) 와 Server Action 양쪽이 호출.
// auth.uid() 는 CurationContext.decided_by 로 주입 (CLI 는 null).

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CurationContext,
  CurationActionResult,
  BulkActionResult,
  QueuePayload,
} from './types'

export async function approveQueueItem(
  client: SupabaseClient,
  queueId: number,
  note: string | null,
  ctx: CurationContext,
): Promise<CurationActionResult> {
  const { data: queueRow, error: queueErr } = await client
    .from('vocab_enrichment_queue')
    .select('id, status')
    .eq('id', queueId)
    .maybeSingle()

  if (queueErr) {
    return { ok: false, error: `queue fetch failed: ${queueErr.message}` }
  }
  if (!queueRow) {
    return { ok: false, error: `queue_id ${queueId} not found` }
  }

  const status = (queueRow as { status: string }).status
  if (status !== 'enriched' && status !== 'enriched_flagged') {
    return { ok: false, error: `queue must be enriched, got: ${status}` }
  }

  const { data: decisionRow, error: decErr } = await client
    .from('vocab_curation_decisions')
    .insert({
      queue_id: queueId,
      decision: 'approve',
      note,
      decided_by: ctx.decided_by,
    })
    .select('id')
    .single()

  if (decErr || !decisionRow) {
    return {
      ok: false,
      error: `decision insert failed: ${decErr?.message ?? 'unknown'}`,
    }
  }

  return { ok: true, decision_id: (decisionRow as { id: number }).id }
}

export async function rejectQueueItem(
  client: SupabaseClient,
  queueId: number,
  note: string | null,
  ctx: CurationContext,
): Promise<CurationActionResult> {
  const { data: queueRow, error: queueErr } = await client
    .from('vocab_enrichment_queue')
    .select('id, status')
    .eq('id', queueId)
    .maybeSingle()

  if (queueErr) {
    return { ok: false, error: `queue fetch failed: ${queueErr.message}` }
  }
  if (!queueRow) {
    return { ok: false, error: `queue_id ${queueId} not found` }
  }

  const { data: decisionRow, error: decErr } = await client
    .from('vocab_curation_decisions')
    .insert({
      queue_id: queueId,
      decision: 'reject',
      note,
      decided_by: ctx.decided_by,
    })
    .select('id')
    .single()

  if (decErr || !decisionRow) {
    return {
      ok: false,
      error: `decision insert failed: ${decErr?.message ?? 'unknown'}`,
    }
  }

  return { ok: true, decision_id: (decisionRow as { id: number }).id }
}

export async function editQueueItem(
  client: SupabaseClient,
  queueId: number,
  editedPayload: Partial<QueuePayload>,
  note: string | null,
  ctx: CurationContext,
): Promise<CurationActionResult> {
  const { data: queueRow, error: queueErr } = await client
    .from('vocab_enrichment_queue')
    .select('id, status')
    .eq('id', queueId)
    .maybeSingle()

  if (queueErr) {
    return { ok: false, error: `queue fetch failed: ${queueErr.message}` }
  }
  if (!queueRow) {
    return { ok: false, error: `queue_id ${queueId} not found` }
  }

  const { data: decisionRow, error: decErr } = await client
    .from('vocab_curation_decisions')
    .insert({
      queue_id: queueId,
      decision: 'edit',
      edited_payload: editedPayload,
      note,
      decided_by: ctx.decided_by,
    })
    .select('id')
    .single()

  if (decErr || !decisionRow) {
    return {
      ok: false,
      error: `decision insert failed: ${decErr?.message ?? 'unknown'}`,
    }
  }

  return { ok: true, decision_id: (decisionRow as { id: number }).id }
}

export async function reenrichQueueItem(
  client: SupabaseClient,
  queueId: number,
  note: string | null,
  ctx: CurationContext,
): Promise<CurationActionResult> {
  const { data: queueRow, error: queueErr } = await client
    .from('vocab_enrichment_queue')
    .select('id, status, retry_count')
    .eq('id', queueId)
    .maybeSingle()

  if (queueErr) {
    return { ok: false, error: `queue fetch failed: ${queueErr.message}` }
  }
  if (!queueRow) {
    return { ok: false, error: `queue_id ${queueId} not found` }
  }

  const row = queueRow as { id: number; status: string; retry_count: number }

  const { data: decisionRow, error: decErr } = await client
    .from('vocab_curation_decisions')
    .insert({
      queue_id: queueId,
      decision: 'reenrich',
      note,
      decided_by: ctx.decided_by,
    })
    .select('id')
    .single()

  if (decErr || !decisionRow) {
    return {
      ok: false,
      error: `decision insert failed: ${decErr?.message ?? 'unknown'}`,
    }
  }

  const { error: updErr } = await client
    .from('vocab_enrichment_queue')
    .update({
      status: 'pending',
      qa_flags: [],
      enriched_payload: null,
      retry_count: row.retry_count + 1,
    })
    .eq('id', queueId)

  if (updErr) {
    return { ok: false, error: `queue revert failed: ${updErr.message}` }
  }

  const slashCommand = note
    ? `/vcb-reenrich ${queueId} "${note.replace(/"/g, '\\"')}"`
    : `/vcb-reenrich ${queueId}`

  return {
    ok: true,
    decision_id: (decisionRow as { id: number }).id,
    slash_command: slashCommand,
  }
}

export async function bulkApprove(
  client: SupabaseClient,
  queueIds: number[],
  ctx: CurationContext,
): Promise<BulkActionResult> {
  let affected = 0
  let failed = 0
  const errors: string[] = []

  for (const queueId of queueIds) {
    const r = await approveQueueItem(client, queueId, null, ctx)
    if (r.ok) {
      affected += 1
    } else {
      failed += 1
      errors.push(`#${queueId}: ${r.error ?? 'unknown'}`)
    }
  }

  return { ok: failed === 0, affected, failed, errors }
}

export async function bulkReject(
  client: SupabaseClient,
  queueIds: number[],
  ctx: CurationContext,
): Promise<BulkActionResult> {
  let affected = 0
  let failed = 0
  const errors: string[] = []

  for (const queueId of queueIds) {
    const r = await rejectQueueItem(client, queueId, null, ctx)
    if (r.ok) {
      affected += 1
    } else {
      failed += 1
      errors.push(`#${queueId}: ${r.error ?? 'unknown'}`)
    }
  }

  return { ok: failed === 0, affected, failed, errors }
}

// ── 통계 (CLI stats subcommand 용) ─────────────────

export interface CurationStats {
  total_enriched: number
  total_flagged: number
  total_failed: number
  approved: number
  rejected: number
  edited: number
  reenriched: number
  unreviewed: number
}

export async function fetchCurationStats(
  client: SupabaseClient,
  runId: number,
): Promise<CurationStats> {
  const { data: queueRows, error: queueErr } = await client
    .from('vocab_enrichment_queue')
    .select('id, status, vocab_seed_candidates!inner(run_id)')
    .eq('vocab_seed_candidates.run_id', runId)
  if (queueErr) {
    throw new Error(`fetchCurationStats queue failed: ${queueErr.message}`)
  }

  const queueIds: number[] = []
  let totalEnriched = 0
  let totalFlagged = 0
  let totalFailed = 0

  for (const row of (queueRows ?? []) as Array<{
    id: number
    status: string
  }>) {
    queueIds.push(row.id)
    if (row.status === 'enriched') totalEnriched += 1
    else if (row.status === 'enriched_flagged') totalFlagged += 1
    else if (row.status === 'failed') totalFailed += 1
  }

  const { data: decRows, error: decErr } = await client
    .from('vocab_curation_decisions')
    .select('queue_id, decision, decided_at')
    .in('queue_id', queueIds.length > 0 ? queueIds : [-1])
    .order('decided_at', { ascending: false })
  if (decErr) {
    throw new Error(`fetchCurationStats decisions failed: ${decErr.message}`)
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

  let approved = 0
  let rejected = 0
  let edited = 0
  let reenriched = 0
  for (const decision of latestByQueue.values()) {
    if (decision === 'approve') approved += 1
    else if (decision === 'reject') rejected += 1
    else if (decision === 'edit') edited += 1
    else if (decision === 'reenrich') reenriched += 1
  }
  const unreviewed = totalEnriched + totalFlagged - latestByQueue.size

  return {
    total_enriched: totalEnriched,
    total_flagged: totalFlagged,
    total_failed: totalFailed,
    approved,
    rejected,
    edited,
    reenriched,
    unreviewed,
  }
}
