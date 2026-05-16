// scripts/vcb/99-cefr-relabel.mjs
// CEFR re-labeling for shared_dictionary based on NGSL frequency_rank.
// Aligns CEFR with R5 rule's NGSL_RANK_CEFR_EXPECTATIONS.
//
// Usage:
//   node scripts/vcb/99-cefr-relabel.mjs            # dry-run (default)
//   node scripts/vcb/99-cefr-relabel.mjs --apply    # actually write (REQUIRES EXPLICIT APPROVAL)

import { createClient } from '@supabase/supabase-js'

const apply = process.argv.includes('--apply')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Aligned with packages/wlp/src/qa/rules.ts NGSL_RANK_CEFR_EXPECTATIONS
// For each bracket, pick the "center" CEFR as the canonical relabel target.
const CEFR_ORDER = ['A1','A2','B1','B2','C1','C2']
const RULES = [
  { name: 'top500',      maxRank: 500,      acceptable: new Set(['A1','A2']) },
  { name: 'top1500',     maxRank: 1500,     acceptable: new Set(['A1','A2','B1']) },
  { name: 'top3000',     maxRank: 3000,     acceptable: new Set(['A2','B1','B2']) },
  { name: 'above3000',   maxRank: Infinity, acceptable: new Set(['B1','B2','C1','C2']) },
]

function bracketFor(rank) {
  for (const r of RULES) { if (rank <= r.maxRank) return r }
  return null
}

// Find the acceptable CEFR closest to the current one in CEFR_ORDER distance.
// Bias to downward when equidistant (more conservative for over-labeled vocab).
function closestAcceptable(currentCefr, acceptable) {
  const acc = [...acceptable].sort((a, b) => CEFR_ORDER.indexOf(a) - CEFR_ORDER.indexOf(b))
  const curIdx = CEFR_ORDER.indexOf(currentCefr)
  if (curIdx < 0) return acc[Math.floor(acc.length / 2)]  // unknown/null → middle of acceptable
  let best = acc[0]; let bestDist = Math.abs(CEFR_ORDER.indexOf(acc[0]) - curIdx)
  for (const a of acc) {
    const d = Math.abs(CEFR_ORDER.indexOf(a) - curIdx)
    if (d < bestDist) { best = a; bestDist = d }
    else if (d === bestDist && CEFR_ORDER.indexOf(a) < CEFR_ORDER.indexOf(best)) best = a // tie → lower
  }
  return best
}

// 1. Fetch all rows with a frequency_rank
const rows = []
let offset = 0
while (true) {
  const { data, error } = await sb.from('shared_dictionary')
    .select('word, pos, cefr_level, frequency_rank')
    .not('frequency_rank', 'is', null)
    .range(offset, offset+999)
  if (error) { console.error(error.message); process.exit(1) }
  if (!data || data.length === 0) break
  rows.push(...data)
  if (data.length < 1000) break
  offset += 1000
}
console.log(`Loaded ${rows.length} rows with frequency_rank set`)

// 2. Classify
const buckets = { ok: 0, relabel: 0, no_target: 0 }
const byBracket = {}
const changes = [] // {word, pos, oldCefr, newCefr, rank, bracket}

for (const r of rows) {
  const b = bracketFor(r.frequency_rank)
  if (!b) { buckets.no_target++; continue }
  byBracket[b.name] = byBracket[b.name] || { total: 0, in_range: 0, out_of_range: 0, no_change_possible: 0 }
  byBracket[b.name].total++
  if (b.acceptable.has(r.cefr_level)) {
    byBracket[b.name].in_range++
    buckets.ok++
  } else {
    const newCefr = closestAcceptable(r.cefr_level, b.acceptable)
    byBracket[b.name].out_of_range++
    buckets.relabel++
    changes.push({ word: r.word, pos: r.pos, oldCefr: r.cefr_level, newCefr, rank: r.frequency_rank, bracket: b.name })
  }
}

console.log('\nBracket summary:')
for (const [name, s] of Object.entries(byBracket)) {
  console.log(`  ${name.padEnd(12)} total=${s.total}  in_range=${s.in_range}  out_of_range=${s.out_of_range}`)
}
console.log('\nGlobal:')
console.log('  rows with rank      :', rows.length)
console.log('  CEFR already in range:', buckets.ok)
console.log('  CEFR will relabel    :', buckets.relabel)
console.log('  rank>3000 outliers   :', buckets.no_target, '(no canonical target — kept)')

// Show old→new distribution
const transitions = {}
for (const c of changes) {
  const k = `${c.oldCefr} → ${c.newCefr}`
  transitions[k] = (transitions[k]||0)+1
}
console.log('\nProposed CEFR transitions:')
Object.entries(transitions).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('  ', v, k))

// Sample 10 per transition
console.log('\nSamples (per transition):')
const samples = {}
for (const c of changes) {
  const k = `${c.oldCefr} → ${c.newCefr}`
  samples[k] = samples[k] || []
  if (samples[k].length < 5) samples[k].push(`${c.word}(${c.pos}, rank=${c.rank})`)
}
for (const [k, v] of Object.entries(samples)) console.log(`  ${k}: ${v.join(' | ')}`)

if (!apply) {
  console.log('\n(dry-run only — pass --apply to write)')
  process.exit(0)
}

console.log('\n!!! APPLYING UPDATES — this changes', changes.length, 'rows !!!')
let done = 0, errs = 0
for (const c of changes) {
  const { error } = await sb.from('shared_dictionary')
    .update({ cefr_level: c.newCefr })
    .eq('word', c.word).eq('pos', c.pos)
  if (error) { errs++; if (errs < 5) console.error('err:', c.word, error.message) }
  else done++
  if (done % 500 === 0) console.log('  ...', done, '/', changes.length)
}
console.log(`\nApplied ${done} updates, ${errs} errors.`)
