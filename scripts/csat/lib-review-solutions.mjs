// scripts/csat/lib-review-solutions.mjs
/** Validate the complete batch before any immutable solve is committed. */
export function validateBlindSolutions(notes, rows) {
  if (!Array.isArray(notes) || !notes.length) throw new Error('Nonempty solution array required')
  const runs = new Map(rows.filter((r) => r.kind === 'blind').map((r) => [r.run_id, r]))
  const seen = new Set()
  for (const note of notes) {
    const row = runs.get(note?.run_id)
    if (!row || row.excluded || note.item_id !== row.item_id) throw new Error('Solution item/run mismatch or excluded run')
    if (seen.has(note.run_id)) throw new Error('Duplicate solution run')
    seen.add(note.run_id)
    if (!Number.isInteger(note.answer) || note.answer < 1 || note.answer > 5) throw new Error('Answer must be an integer 1..5')
    if (typeof note.note !== 'string' || note.note.trim().length < 20) throw new Error('Actual item-specific reasoning of at least 20 characters required')
  }
  return notes
}
