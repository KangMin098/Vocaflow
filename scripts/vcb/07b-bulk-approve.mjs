// scripts/vcb/07b-bulk-approve.mjs
// Bulk auto-approve all enriched + enriched_flagged queue items for a run.
// Idempotent: skips queue_ids that already have a curation decision.
//
// Usage:
//   node scripts/vcb/07b-bulk-approve.mjs --run-id 1            # dry-run
//   node scripts/vcb/07b-bulk-approve.mjs --run-id 1 --apply    # actually write

import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const runIdx = args.indexOf('--run-id')
const runId = runIdx >= 0 ? parseInt(args[runIdx + 1], 10) : null
if (!runId) { console.error('--run-id required'); process.exit(1) }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// 1. Fetch all queue ids for this run that are enriched or enriched_flagged
const queueIds = []
let offset = 0
while (true) {
  const { data, error } = await sb.from('vocab_enrichment_queue')
    .select(`id, status, qa_flags, seed:vocab_seed_candidates!inner(run_id)`)
    .in('status', ['enriched','enriched_flagged'])
    .range(offset, offset+499)
  if (error) { console.error(error.message); process.exit(1) }
  if (!data || data.length === 0) break
  for (const r of data) {
    const s = Array.isArray(r.seed) ? r.seed[0] : r.seed
    if (s.run_id !== runId) continue
    queueIds.push({ id: r.id, status: r.status, qa_flags: r.qa_flags })
  }
  if (data.length < 500) break
  offset += 500
}
console.log(`run ${runId}: ${queueIds.length} candidate queue items`)
const byStatus = queueIds.reduce((a,r)=>{a[r.status]=(a[r.status]||0)+1;return a},{})
console.log('  by status:', byStatus)

// 2. Find already-decided queue_ids
const alreadyDecided = new Set()
offset = 0
while (true) {
  const { data, error } = await sb.from('vocab_curation_decisions')
    .select('queue_id, decision').range(offset, offset+999)
  if (error) { console.error(error.message); process.exit(1) }
  if (!data || data.length === 0) break
  for (const r of data) alreadyDecided.add(r.queue_id)
  if (data.length < 1000) break
  offset += 1000
}
console.log(`already decided: ${alreadyDecided.size}`)

const toApprove = queueIds.filter(r => !alreadyDecided.has(r.id))
console.log(`will approve: ${toApprove.length}`)

if (!apply) {
  console.log('\n(dry-run only — pass --apply to write)')
  process.exit(0)
}

// 3. Bulk insert decisions in batches of 500
const batch = []
let inserted = 0, errors = 0
for (let i = 0; i < toApprove.length; i += 500) {
  const slice = toApprove.slice(i, i + 500).map(r => ({
    queue_id: r.id,
    decision: 'approve',
    note: r.status === 'enriched_flagged' ? `auto-approve: ${(r.qa_flags||[]).join(',')} accepted (curator bulk)` : 'auto-approve: passed QA',
    decided_by: null,
  }))
  const { error } = await sb.from('vocab_curation_decisions').insert(slice)
  if (error) { errors += slice.length; console.error('batch err:', error.message); continue }
  inserted += slice.length
  console.log(`  inserted ${inserted}/${toApprove.length}`)
}
console.log(`\nInserted ${inserted} decisions, ${errors} errors.`)
