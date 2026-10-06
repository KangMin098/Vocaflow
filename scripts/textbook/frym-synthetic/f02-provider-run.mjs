// scripts/textbook/frym-synthetic/f02-provider-run.mjs
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildF02Synthetic } from './f02-synthetic.mjs'
import { callProvider, graderSpec, studentSpec, verifyProviderPair } from './f02-provider.mjs'

const [outputDir, mode] = process.argv.slice(2)
if (!outputDir || !['stage-a', 'stage-b'].includes(mode)) throw Error('Usage: node f02-provider-run.mjs <fresh-exported-packet-dir> stage-a|stage-b')
const root = resolve(outputDir), built = buildF02Synthetic()
if (JSON.stringify(JSON.parse(readFileSync(join(root, 'seal.json'), 'utf8'))) !== JSON.stringify(built.seal)) throw Error('Frozen F02 seal mismatch')
const exportNames = new Set(['seal.json', ...built.packets.map(packet => `${packet.packet_id}.json`)])
if (readdirSync(root).some(name => !exportNames.has(name))) throw Error('Provider run requires a fresh export directory')
const anthropicKey = process.env.ANTHROPIC_API_KEY, openaiKey = process.env.OPENAI_API_KEY
const anthropicModel = process.env.F02_ANTHROPIC_MODEL, openaiModel = process.env.F02_OPENAI_MODEL
if (!anthropicKey || !openaiKey || !anthropicModel || !openaiModel) throw Error('Provider API credentials and explicit F02 model versions required in environment')
if (anthropicModel === openaiModel) throw Error('Student and grader models must differ')
const runId = randomUUID()
const assignments = mode === 'stage-a'
  ? [{ packet: built.packets[0], student_provider: 'anthropic', grader_provider: 'openai', student_model: anthropicModel, grader_model: openaiModel }]
  : [
      { packet: built.packets[0], student_provider: 'anthropic', grader_provider: 'openai', student_model: anthropicModel, grader_model: openaiModel },
      { packet: built.packets[1], student_provider: 'openai', grader_provider: 'anthropic', student_model: openaiModel, grader_model: anthropicModel }
    ]
const manifest = { schema_version: 1, run_id: runId, mode, seal_sha256: built.seal.seal_sha256, planned_packets: assignments.map(item => item.packet.packet_id), models: { anthropic: anthropicModel, openai: openaiModel }, status: 'running', audit_ready: false, synthetic_validation_valid_n: 0 }
writeFileSync(join(root, 'provider-run.json'), JSON.stringify(manifest, null, 2))
const results = []
for (const item of assignments) {
  const { packet, ...assignment } = item
  if (JSON.stringify(JSON.parse(readFileSync(join(root, `${packet.packet_id}.json`), 'utf8'))) !== JSON.stringify({ packet_id: packet.packet_id, ...packet.body })) throw Error(`Blind packet ${packet.packet_id} changed`)
  const student = await callProvider({ ...studentSpec(packet, assignment.student_provider, assignment.student_model), runId, apiKey: assignment.student_provider === 'anthropic' ? anthropicKey : openaiKey })
  writeFileSync(join(root, `provider-student-${packet.packet_id}.json`), JSON.stringify(student, null, 2))
  const grader = student.status === 'completed' && Array.isArray(student.parsed_output?.answers)
    ? await callProvider({ ...graderSpec(packet, student.parsed_output.answers, built.scoringKey, assignment.grader_provider, assignment.grader_model), runId, apiKey: assignment.grader_provider === 'anthropic' ? anthropicKey : openaiKey })
    : null
  if (grader) writeFileSync(join(root, `provider-grader-${packet.packet_id}.json`), JSON.stringify(grader, null, 2))
  const verdict = verifyProviderPair(packet, built.scoringKey, student, grader, assignment)
  const result = { packet_id: packet.packet_id, assignment, student, grader, verdict }
  writeFileSync(join(root, `provider-${packet.packet_id}.json`), JSON.stringify(result, null, 2))
  results.push(result)
  process.stdout.write(`${packet.profile_id} ${packet.passage_variant}: ${verdict.admissible ? 'receipt-complete' : verdict.reason}\n`)
}
manifest.status = results.every(result => result.verdict.admissible) ? 'receipt_smoke_complete' : 'incomplete'
manifest.results = results.map(result => ({ packet_id: result.packet_id, status: result.verdict.admissible ? 'receipt_complete' : 'incomplete', reason: result.verdict.reason }))
writeFileSync(join(root, 'provider-run.json'), JSON.stringify(manifest, null, 2))
if (manifest.status !== 'receipt_smoke_complete') process.exitCode = 1
