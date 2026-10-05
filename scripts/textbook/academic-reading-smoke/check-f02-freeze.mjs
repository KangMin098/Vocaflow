// scripts/textbook/academic-reading-smoke/check-f02-freeze.mjs
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../../..')
const evidence = resolve(root, '.agent-logs/academic-reading-f02-r2')
const manifestPath = resolve(root, 'scripts/textbook/frym-validation/f02-calibration-freeze.json')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const read = path => readFileSync(path)
const json = path => JSON.parse(read(path).toString('utf8'))
const packetPath = resolve(evidence, 'F02-review-packet.json')
const packet = json(packetPath)
const variants = packet.adaptations.map(a => {
  const grade = a.target.age_band
  const folder = grade === 'middle_1' ? 'middle1' : grade === 'high_1' ? 'high1' : null
  if (!folder || !a.review_binding || a.review_binding.source_id !== packet.source_id || a.review_binding.source_hash !== packet.source_hash || a.review_binding.target_key !== a.target_key) throw Error(`Invalid F02 binding: ${grade}`)
  const draft = json(resolve(evidence, folder, 'chunk-00.out.json'))
  if (draft.length !== 1 || draft[0].text !== a.text || draft[0].reading?.target_key !== a.target_key || draft[0].reading?.source_hash !== packet.source_hash) throw Error(`F02 draft differs from review packet: ${grade}`)
  const reviews = Object.fromEntries(['claude_code', 'codex'].map(reviewer => {
    const path = resolve(evidence, folder, `chunk-00.${reviewer}.review.json`)
    const matching = json(path).filter(r => r.draft_hash === a.review_binding.draft_hash && r.target_hash === a.review_binding.target_hash && r.source_hash === packet.source_hash && r.target_key === a.target_key && r.reviewer === reviewer)
    if (matching.length !== 1 || matching[0].verdict !== 'pass') throw Error(`Missing passing review: ${grade}/${reviewer}`)
    return [reviewer, sha(read(path))]
  }))
  return { grade, target_key: a.target_key, target_hash: a.review_binding.target_hash, draft_hash: a.review_binding.draft_hash, passage_sha256: sha(a.text), review_file_sha256: reviews }
}).sort((a, b) => a.grade.localeCompare(b.grade))
if (variants.length !== 2 || variants[0].grade !== 'high_1' || variants[1].grade !== 'middle_1') throw Error('F02 requires exactly two target variants')
const frozen = { version: 1, pair_id: 'F02', state: 'pipeline-valid_content-agent-reviewed_educational-validation-pending', source_id: packet.source_id, source_revision: packet.source_revision, source_hash: packet.source_hash, packet_sha256: sha(read(packetPath)), variants }
if (process.argv.length > 2) throw Error('Freeze check is read-only; create a new version after any draft change')
const expected = json(manifestPath)
if (JSON.stringify(expected) !== JSON.stringify(frozen)) throw Error('F02 calibration freeze is stale; do not reuse previous review or pilot instrument')
console.log('F02 calibration freeze matches both current passages and four passing reviews')
