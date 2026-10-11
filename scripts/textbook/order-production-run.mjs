// scripts/textbook/order-production-run.mjs
// Registered Product Order drafts -> grade/day drain -> family adapter gate -> student volume.
//   export --input RUN_INPUT.json --run-dir NEW_DIR   writes drain.json (agent fills drain.out.json)
//   import --input RUN_INPUT.json --run-dir DIR       gates drain.out.json, writes student volume or blocked result
//   status --run-dir DIR                              prints current stage, blockers and stale flag
// Re-running export never overwrites; import refuses a run that is already complete.
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { exportOrderProductionDrain, importOrderProductionDrain, summarizeOrderRun } from '../../packages/library-pipeline/src/textbook/order-production-run.ts'
import { verifyPlannedVolumeSyntheticOutput } from '../../packages/library-pipeline/src/textbook/product-planning.ts'
import { assertExternalCandidate } from './frym-benchmark/local-candidate-path.mjs'
import { writeAtomicDryRunOutput } from './atomic-production-output.mjs'
import { buildCompanionPractice, verifyCompanionPractice } from '../../packages/library-pipeline/src/textbook/companion-practice.ts'

const companionBytes = file => fs.readFileSync(path.resolve(file), 'utf8')
// Companion resources file (only when an order seals companion activities):
// { antonyms: {word: [..]}, pos: {word: pos}, common_words: [..] | null, word_pool: [{word, meaningKo, rhymeKey}],
//   audio: {word: {url, attribution}} }. Missing parts block only the activities that need them.
function companionDeps(file) {
  if (!file) return {}
  const raw = JSON.parse(companionBytes(file))
  return {
    ...(raw.antonyms || raw.pos ? { lexicon: { antonymsOf: word => raw.antonyms?.[word] ?? [], posOf: word => raw.pos?.[word] ?? null } } : {}),
    ...(raw.common_words !== undefined ? { isCommonWord: word => raw.common_words === null || raw.common_words.includes(word.toLowerCase()) } : {}),
    ...(raw.word_pool ? { wordPool: raw.word_pool } : {}),
    ...(raw.audio ? { audioOf: word => raw.audio[word] ?? null } : {}),
  }
}

const usage = 'Usage: pnpm exec tsx scripts/textbook/order-production-run.mjs export|import --input FILE --run-dir DIR [--companion-resources FILE] | status --run-dir DIR'
const [command, ...rest] = process.argv.slice(2)
const opt = name => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined }
if (!['export', 'import', 'status'].includes(command)) throw Error(usage)
const runDir = opt('--run-dir') && path.resolve(opt('--run-dir'))
if (!runDir) throw Error(usage)
assertExternalCandidate(runDir)
const read = name => { const file = path.join(runDir, name); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined }
const writeNew = (name, value) => fs.writeFileSync(path.join(runDir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' })

if (command === 'status') {
  console.log(JSON.stringify(summarizeOrderRun({ drain: read('drain.json'), result: read('result.json'), complete: read('complete.json') }), null, 2))
  process.exit(0)
}
const inputPath = opt('--input') && path.resolve(opt('--input'))
if (!inputPath) throw Error(usage)
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))

if (command === 'export') {
  if (fs.existsSync(runDir)) throw Error('ORDER_RUN_DIRECTORY_EXISTS')
  const drain = exportOrderProductionDrain(input)
  fs.mkdirSync(runDir)
  writeNew('drain.json', drain)
  console.log(JSON.stringify({ status: 'drain_exported', cells: drain.cells.length, drain_hash: drain.drain_hash }))
  process.exit(0)
}

if (read('complete.json')) throw Error('ORDER_RUN_ALREADY_COMPLETE')
const drain = read('drain.json')
const filled = read('drain.out.json')
if (!drain || !filled) throw Error('ORDER_RUN_DRAIN_NOT_FILLED')
// A blocked previous attempt is kept for audit; the new attempt replaces only result.json.
fs.rmSync(path.join(runDir, 'result.json'), { force: true })
const result = importOrderProductionDrain(input, filled)
if (result.drain_hash !== drain.drain_hash && result.status !== 'blocked') {
  writeNew('result.json', { status: 'blocked', drain_hash: result.drain_hash,
    blockers: [{ stage: 'drain_exported', reason: 'ORDER_RUN_DRAIN_STALE_REEXPORT_REQUIRED' }] })
  console.log(JSON.stringify(summarizeOrderRun({ drain, result: read('result.json') })))
  process.exit(2)
}
if (result.status === 'blocked') {
  writeNew('result.json', result)
  console.log(JSON.stringify(summarizeOrderRun({ drain, result })))
  process.exit(2)
}
// Companion (non-reading) practice is part of the same run: blocked practice blocks the run.
const deps = companionDeps(opt('--companion-resources'))
const resourcesSha256 = opt('--companion-resources')
  ? createHash('sha256').update(companionBytes(opt('--companion-resources'))).digest('hex') : null
const practice = buildCompanionPractice(result, deps, { resourcesSha256 })
if (practice.status === 'blocked') {
  writeNew('result.json', { status: 'blocked', drain_hash: result.drain_hash,
    blockers: practice.blockers.map(row => ({ stage: 'units_built', cell_id: row.grade, reason: `${row.activity}:${row.reason}` })) })
  console.log(JSON.stringify(summarizeOrderRun({ drain, result: read('result.json') })))
  process.exit(2)
}
// No complete.json yet, so any earlier student files are an interrupted attempt and never trusted.
for (const name of ['student.html', 'student.html.manifest.json', 'practice.html', 'practice.manifest.json', '.complete.pending'])
  fs.rmSync(path.join(runDir, name), { force: true })
const written = writeAtomicDryRunOutput(path.join(runDir, 'student.html'), result.output.html, result.output.manifest)
if (!written.ok) throw Error(`ORDER_RUN_OUTPUT_FAILED;LEFTOVERS:${written.leftovers.join(',')}`)
fs.rmSync(path.join(runDir, 'receipt.json'), { force: true })
fs.rmSync(path.join(runDir, 'lineage.json'), { force: true })
writeNew('receipt.json', result.output.receipt)
writeNew('lineage.json', result.lineage)
verifyPlannedVolumeSyntheticOutput(result.volumeInput, {
  html: fs.readFileSync(path.join(runDir, 'student.html'), 'utf8'),
  manifest: JSON.parse(fs.readFileSync(path.join(runDir, 'student.html.manifest.json'), 'utf8')),
  receipt: read('receipt.json'),
})
fs.writeFileSync(path.join(runDir, 'practice.html'), practice.html, { flag: 'wx' })
writeNew('practice.manifest.json', practice.manifest)
verifyCompanionPractice(result, deps, { html: fs.readFileSync(path.join(runDir, 'practice.html'), 'utf8'),
  manifest: read('practice.manifest.json') }, { resourcesSha256 })
writeNew('result.json', { status: 'assembled', drain_hash: result.drain_hash })
const pending = path.join(runDir, '.complete.pending')
const fd = fs.openSync(pending, 'wx')
try {
  fs.writeFileSync(fd, JSON.stringify({ status: 'complete', publish_eligible: false, non_production: true,
    drain_hash: result.drain_hash, receipt_hash: result.output.receipt.receipt_hash,
    manifest_hash: result.output.manifest.manifest_hash,
    practice_manifest_hash: practice.manifest.manifest_hash, practice_items: practice.manifest.items.length,
    companion_resources_sha256: resourcesSha256 }, null, 2) + '\n')
  fs.fsyncSync(fd)
} finally { fs.closeSync(fd) }
fs.linkSync(pending, path.join(runDir, 'complete.json'))
fs.unlinkSync(pending)
console.log(JSON.stringify(summarizeOrderRun({ drain, result: read('result.json'), complete: read('complete.json') })))
