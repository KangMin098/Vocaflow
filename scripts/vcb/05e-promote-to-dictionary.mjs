// scripts/vcb/05e-promote-to-dictionary.mjs
// VCB Step 5e — Promote enriched_payload from vocab_enrichment_queue to shared_dictionary.
// Fills example_en, synonyms, antonyms for matched (word, pos) rows.
// Idempotent: only updates rows where target column IS NULL.
//
// Usage:
//   node scripts/vcb/05e-promote-to-dictionary.mjs --run-id 1            # dry-run (default)
//   node scripts/vcb/05e-promote-to-dictionary.mjs --run-id 1 --apply    # actually write

import { createClient } from '@supabase/supabase-js'

const POS_MAP = {
  NOUN: 'noun', VERB: 'verb', ADJ: 'adjective', ADV: 'adverb',
  PREP: 'preposition', CONJ: 'conjunction', PRON: 'pronoun', DET: 'determiner',
  INTJ: 'interjection',
}

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const runIdx = args.indexOf('--run-id')
const runId = runIdx >= 0 ? parseInt(args[runIdx + 1], 10) : null
if (!runId) { console.error('--run-id required'); process.exit(1) }

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// 1. Fetch enriched queue rows joined with seed (lemma, pos)
const rows = []
let offset = 0
while (true) {
  const { data, error } = await sb.from('vocab_enrichment_queue')
    .select(`id, enriched_payload, seed:vocab_seed_candidates!inner(run_id, lemma, pos)`)
    .in('status', ['enriched', 'enriched_flagged'])
    .range(offset, offset + 499)
  if (error) { console.error(error.message); process.exit(1) }
  if (!data || data.length === 0) break
  for (const r of data) {
    const s = Array.isArray(r.seed) ? r.seed[0] : r.seed
    if (s.run_id !== runId) continue
    rows.push({ id: r.id, lemma: s.lemma, posRaw: s.pos, posMapped: POS_MAP[s.pos] || s.pos.toLowerCase(), payload: r.enriched_payload })
  }
  if (data.length < 500) break
  offset += 500
}
console.log(`fetched ${rows.length} enriched queue rows for run ${runId}`)

// 2. For each (lemma, posMapped), check if shared_dictionary has it and what columns are filled
const stats = { matched: 0, no_match: 0, already_filled: 0, will_update: 0, updated: 0, errors: 0 }
const noMatch = []
const updates = []

for (const r of rows) {
  const { data: existing, error } = await sb.from('shared_dictionary')
    .select('word, pos, example_en, synonyms, antonyms')
    .eq('word', r.lemma)
    .eq('pos', r.posMapped)
    .maybeSingle()
  if (error) { stats.errors++; console.error('select err', r.lemma, error.message); continue }
  if (!existing) {
    stats.no_match++
    noMatch.push(`${r.lemma}|${r.posMapped}`)
    continue
  }
  stats.matched++
  const p = r.payload || {}
  const patch = {}
  if (existing.example_en == null && Array.isArray(p.examples) && p.examples[0]?.en) patch.example_en = p.examples[0].en
  if ((existing.synonyms == null || existing.synonyms.length === 0) && Array.isArray(p.synonyms) && p.synonyms.length > 0) patch.synonyms = p.synonyms
  if ((existing.antonyms == null || existing.antonyms.length === 0) && Array.isArray(p.antonyms) && p.antonyms.length > 0) patch.antonyms = p.antonyms
  if (Object.keys(patch).length === 0) { stats.already_filled++; continue }
  stats.will_update++
  updates.push({ lemma: r.lemma, pos: r.posMapped, patch })
}

console.log('\nDry-run summary:')
console.log('  matched in shared_dictionary :', stats.matched)
console.log('  no match (not in dict)        :', stats.no_match)
console.log('  already filled (skip)         :', stats.already_filled)
console.log('  will update                   :', stats.will_update)
console.log('  errors                        :', stats.errors)
if (noMatch.length > 0 && noMatch.length <= 20) {
  console.log('\nno-match samples (all', noMatch.length, '):', noMatch.slice(0, 20))
} else if (noMatch.length > 0) {
  console.log('\nno-match samples (first 20 of', noMatch.length, '):', noMatch.slice(0, 20))
}
// Per-column counts
const colCounts = { example_en: 0, synonyms: 0, antonyms: 0 }
for (const u of updates) for (const k of Object.keys(u.patch)) colCounts[k]++
console.log('\nPer-column update counts:', colCounts)

if (!apply) {
  console.log('\n(dry-run only — pass --apply to write)')
  process.exit(0)
}

console.log('\nApplying updates...')
for (const u of updates) {
  const { error } = await sb.from('shared_dictionary')
    .update(u.patch)
    .eq('word', u.lemma)
    .eq('pos', u.pos)
  if (error) { stats.errors++; console.error('upd err', u.lemma, error.message); continue }
  stats.updated++
}
console.log(`\nApplied ${stats.updated} updates, ${stats.errors} errors.`)
