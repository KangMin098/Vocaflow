// scripts/textbook/academic-reading-smoke/fill-reviews.mjs
import fs from 'node:fs'

const base = process.argv[2] ?? '.agent-logs/academic-reading-e2e-smoke'
const read = file => JSON.parse(fs.readFileSync(`${base}/${file}`, 'utf8').replace(/^\uFEFF/, ''))
const claude = new Map(read('claude-f02-complete-review.txt').map(row => [row.id, row]))
const codex = new Map(read('codex-f02-complete-review.txt').map(row => [row.id, row]))
for (const dir of ['middle1', 'high1']) {
  const id = `F02-${dir}`
  for (const [reviewer, decisions] of [['claude_code', claude], ['codex', codex]]) {
    const file = `${base}/${dir}/chunk-00.${reviewer}.review.json`
    const rows = read(`${dir}/chunk-00.${reviewer}.review.json`)
    const decision = decisions.get(id)
    if (!decision) throw new Error(`review decision missing: ${id}/${reviewer}`)
    const matching = rows.flatMap((row, index) => row.reviewer === reviewer &&
      decision.draft_hash === row.draft_hash && decision.target_hash === row.target_hash &&
      decision.source_hash === row.source_hash ? [index] : [])
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
