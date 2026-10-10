// scripts/textbook/frym-benchmark/reference-admit.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { admitReference } from './reference-admission.mjs'
import { assertExternalCandidate } from './local-candidate-path.mjs'

const [rulesPath, screeningPath, manifestPath, bundlePath, outputPath] = process.argv.slice(2)
if (![rulesPath, screeningPath, manifestPath, bundlePath, outputPath].every(Boolean))
  throw Error('USAGE: <rules> <screening> <manifest> <external-bundle> <new-receipt-output>')
assertExternalCandidate(bundlePath)
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const { receipt, reference } = admitReference({ ...read(bundlePath),
  rules: read(rulesPath), screening: read(screeningPath), manifest: read(manifestPath) })
writeFileSync(outputPath, `${JSON.stringify({ receipt, reference }, null, 2)}\n`, { flag: 'wx' })
process.stdout.write(`${JSON.stringify({ candidate_id: receipt.candidate_id,
  cohort: receipt.cohort, grade_scope: receipt.grade_scope,
  admission_receipt_hash: reference.admission_receipt_hash })}\n`)
