// scripts/csat/lib-review-blind-protocol.mjs

/** Shared question sets remain related even when underlining changes the text. */
export function shareReviewSource(left, right) {
  if (!left || !right) return false
  if (left.id === right.id) return true
  if (left.exam_id === right.exam_id) {
    for (const group of [[41, 42], [43, 44, 45]]) {
      if (group.includes(left.no) && group.includes(right.no)) return true
    }
  }
  return !!left.passage?.trim() && left.passage === right.passage
}

/** Historical ordering matters; later reveals cannot contaminate an earlier solve. */
export function blindProtocolViolation(run, history, items, excluded, before) {
  if (excluded.has(run.id)) return { reason: 'excluded', run_id: run.id }
  const item = items.get(run.item_id)
  if (!item) throw new Error(`Missing review source: ${run.item_id}`)
  const cutoff = Date.parse(run.solve_committed_at ?? before)
  if (!Number.isFinite(cutoff)) throw new Error('A valid injected exposure cutoff is required')
  for (const other of history) {
    if (other.role !== 'reviewer' || other.agent_run !== run.agent_run) continue
    if (!shareReviewSource(item, items.get(other.item_id))) continue
    const createdCutoff = run.solve_committed_at ? run.created_at : before
    if (excluded.has(other.id) && Date.parse(other.created_at) <= Date.parse(createdCutoff)) {
      return { reason: 'replacement-of-excluded', run_id: other.id, item_id: other.item_id }
    }
    if (other.revealed_at && Date.parse(other.revealed_at) < cutoff) {
      return { reason: 'source-already-revealed', run_id: other.id, item_id: other.item_id, revealed_at: other.revealed_at }
    }
  }
  return null
}
