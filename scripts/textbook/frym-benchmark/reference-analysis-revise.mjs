// scripts/textbook/frym-benchmark/reference-analysis-revise.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { hash } from './benchmark.mjs'
import { admitReference } from './reference-admission.mjs'
import { reviseReferenceAnalysis } from './reference-analysis-revision.mjs'
import { assertExternalCandidate } from './local-candidate-path.mjs'

const [rulesPath, screeningPath, manifestPath, bundlePath, receiptPath, workdir,
  decisionPath, newBundlePath, newReceiptPath, lineagePath] = process.argv.slice(2)
if (![rulesPath, screeningPath, manifestPath, bundlePath, receiptPath, workdir,
  decisionPath, newBundlePath, newReceiptPath, lineagePath].every(Boolean))
  throw Error('USAGE: <rules> <screening> <manifest> <old-bundle> <old-receipt> <review-workdir> <old-decision> <new-bundle> <new-receipt> <new-lineage>')
for (const path of [bundlePath, workdir, decisionPath, newBundlePath, newReceiptPath, lineagePath])
  assertExternalCandidate(path)
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const shaFile = path => sha(readFileSync(path))
const input = { ...read(bundlePath), rules: read(rulesPath),
  screening: read(screeningPath), manifest: read(manifestPath) }
const admission = admitReference(input)
const saved = read(receiptPath)
if (hash(saved.receipt) !== hash(admission.receipt) ||
    hash(saved.reference) !== hash(admission.reference)) throw Error('REVISION_PARENT_STALE')
const decision = read(decisionPath)
const { audit_hash, ...audit } = decision
if (audit_hash !== hash(audit) || audit.admission_receipt_hash !== admission.reference.admission_receipt_hash ||
    audit.missing_outputs?.length !== 0 ||
    audit.stages?.rating_independence_eligible?.reason !== 'RATING_ANALYSIS_REVISION_REQUIRED')
  throw Error('REVISION_DECISION_INVALID')
const output = kind => join(workdir, `${kind}.out.json`)
const invocation = kind => join(workdir, `${kind}.invocation.json`)
const reviewed = Object.fromEntries(['rights', 'grade', 'rater-a', 'rater-b', 'adjudication']
  .map(kind => [kind, read(output(kind))]))
const reviewers = ['rater-a', 'rater-b'].map(kind => ({
  id: reviewed[kind].reviewer_id, model_family: reviewed[kind].model_family,
  invocation_id: reviewed[kind].invocation_id, ratings: reviewed[kind].ratings,
  invocation_evidence_path: invocation(kind), invocation_evidence_hash: shaFile(invocation(kind)),
  output_path: output(kind), output_hash: shaFile(output(kind)),
}))
const arbiter = reviewed.adjudication
const evidence = { rights: reviewed.rights, grade_mapping: reviewed.grade,
  rating: { analysis_hash: admission.receipt.analysis_hash,
    codebook_hash: admission.receipt.codebook_hash, reviewers,
    axis_reviews: arbiter.axis_reviews,
    adjudication: { id: arbiter.adjudicator_id, invocation_id: arbiter.invocation_id,
      output_path: output('adjudication'), output_hash: shaFile(output('adjudication')),
      invocation_evidence_path: invocation('adjudication'),
      invocation_evidence_hash: shaFile(invocation('adjudication')) } } }
const revised = reviseReferenceAnalysis({ input, ...admission }, evidence)
if (audit.evidence_hash !== hash(evidence)) throw Error('REVISION_EVIDENCE_DECISION_MISMATCH')
const bundle = { ...read(bundlePath), analysis: revised.input.analysis }
const outputs = [
  [newBundlePath, bundle],
  [newReceiptPath, { receipt: revised.receipt, reference: revised.reference }],
  [lineagePath, revised.lineage],
]
const outputPaths = outputs.map(([path]) => path)
if (new Set(outputPaths).size !== outputPaths.length ||
    outputPaths.some(path => [bundlePath, receiptPath, decisionPath].includes(path)))
  throw Error('REVISION_OUTPUT_OVERWRITES_PARENT')
if (outputPaths.some(path => existsSync(path))) throw Error('REVISION_OUTPUT_EXISTS')
for (const [path, value] of outputs)
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
process.stdout.write(`${JSON.stringify({ changed_axes: revised.lineage.changed_axes,
  parent_receipt_hash: revised.lineage.parent_admission_receipt_hash,
  receipt_hash: revised.reference.admission_receipt_hash,
  calibration_eligible: false })}\n`)
