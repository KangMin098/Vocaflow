// scripts/textbook/academic-reading-smoke/fill-reviews.mjs
import fs from 'node:fs'
import { reviewIdentity } from '../academic-reading-review.mjs'

const base = process.argv[2] ?? '.agent-logs/academic-reading-e2e-smoke'
const read = file => JSON.parse(fs.readFileSync(`${base}/${file}`, 'utf8').replace(/^\uFEFF/, ''))
const claude = new Map(read('claude-f02-complete-review.txt').map(row => [row.id, row]))
const codex = new Map(read('codex-f02-complete-review.txt').map(row => [row.id, row]))
for (const dir of ['middle1', 'high1']) {
  const id = `F02-${dir}`
  const sourceRows = read(`${dir}/chunk-00.json`)
  const draftRows = read(`${dir}/chunk-00.out.json`)
  const source = sourceRows.find(row => row.reading?.preservation_rules?.entry?.pair_id === 'F02')
  const draft = draftRows.find(row => row.adapted_from_id === source?.adapted_from_id)
  if (!source || !draft) throw new Error(`current F02 source or draft missing: ${id}`)
  const binding = reviewIdentity(draft, source)
  for (const [reviewer, decisions] of [['claude_code', claude], ['codex', codex]]) {
    const file = `${base}/${dir}/chunk-00.${reviewer}.review.json`
    const rows = read(`${dir}/chunk-00.${reviewer}.review.json`)
    const decision = decisions.get(id)
    if (!decision) throw new Error(`review decision missing: ${id}/${reviewer}`)
    if (decision.source_hash !== binding.source_hash || decision.target_hash !== binding.target_hash ||
        decision.draft_hash !== binding.draft_hash)
      throw new Error(`review decision is stale for current draft: ${id}/${reviewer}`)
    const matching = rows.flatMap((row, index) => row.reviewer === reviewer &&
      Object.entries(binding).every(([key, value]) => row[key] === value) ? [index] : [])
    if (matching.length !== 1) throw new Error(`review result does not match exactly one completed draft: ${id}/${reviewer}`)
    const index = matching[0]
    const template = rows[index]
    const result = {
      ...template, verdict: decision.verdict, dimensions: decision.dimensions,
      distortions: decision.distortions, source_quote: decision.source_quote,
      passage_quote: decision.passage_quote, rationale: decision.rationale,
      concerns: decision.concerns,
    }
    rows[index] = result
    fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`)
    console.log(`${id} ${reviewer}: ${decision.verdict}`)
  }
}
