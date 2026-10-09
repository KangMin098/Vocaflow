// scripts/textbook/planned-volume-run.mjs
import fs from 'node:fs'
import path from 'node:path'
import { assemblePlannedVolumeSynthetic, verifyPlannedVolumeSyntheticOutput } from '../../packages/library-pipeline/src/textbook/product-planning.ts'
import { assertExternalCandidate } from './frym-benchmark/local-candidate-path.mjs'
import { writeAtomicDryRunOutput } from './atomic-production-output.mjs'

const usage = 'Usage: pnpm exec tsx scripts/textbook/planned-volume-run.mjs --input FILE --out-dir NEW_DIRECTORY'
if (process.argv.includes('--help')) { console.log(usage); process.exit(0) }
const args = process.argv.slice(2)
if (args.length !== 4 || args[0] !== '--input' || args[2] !== '--out-dir' || !args[1] || !args[3]) throw Error(usage)
const inputPath = path.resolve(args[1]), root = path.resolve(args[3])
assertExternalCandidate(inputPath)
assertExternalCandidate(root)
if (fs.existsSync(root)) throw Error('PLANNED_VOLUME_OUTPUT_DIRECTORY_EXISTS')
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
if (!input || Object.keys(input).sort().join(',') !== 'brief,orders,units') throw Error('PLANNED_VOLUME_INPUT_INVALID')
const output = assemblePlannedVolumeSynthetic(input)
fs.mkdirSync(root)
const written = writeAtomicDryRunOutput(path.join(root, 'student.html'), output.html, output.manifest)
if (!written.ok) throw Error(`PLANNED_VOLUME_OUTPUT_FAILED;LEFTOVERS:${written.leftovers.join(',')}`)
fs.writeFileSync(path.join(root, 'receipt.json'), JSON.stringify(output.receipt, null, 2) + '\n', { flag: 'wx' })
verifyPlannedVolumeSyntheticOutput(input, {
  html: fs.readFileSync(path.join(root, 'student.html'), 'utf8'),
  manifest: JSON.parse(fs.readFileSync(path.join(root, 'student.html.manifest.json'), 'utf8')),
  receipt: JSON.parse(fs.readFileSync(path.join(root, 'receipt.json'), 'utf8')),
})
const pending = path.join(root, '.complete.pending')
const fd = fs.openSync(pending, 'wx')
try {
  fs.writeFileSync(fd, JSON.stringify({ synthetic_fixture: true,
  non_production: true, publish_eligible: false, status: 'complete',
    planning_hash: output.receipt.planning_hash, receipt_hash: output.receipt.receipt_hash,
    manifest_hash: output.manifest.manifest_hash }, null, 2) + '\n')
  fs.fsyncSync(fd)
} finally { fs.closeSync(fd) }
fs.linkSync(pending, path.join(root, 'complete.json'))
fs.unlinkSync(pending)
console.log(JSON.stringify({ status: 'complete', synthetic_fixture: true,
  non_production: true, unit_count: output.receipt.unit_count, manifest_hash: output.manifest.manifest_hash }))
