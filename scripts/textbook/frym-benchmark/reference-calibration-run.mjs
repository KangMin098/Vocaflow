// scripts/textbook/frym-benchmark/reference-calibration-run.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { hash } from './benchmark.mjs'
import { admitReference } from './reference-admission.mjs'
import { assessReferenceCalibration, buildCalibrationPackets, buildAdjudicationPacket } from './reference-calibration.mjs'
import { assertExternalCandidate } from './local-candidate-path.mjs'

const [command, rulesPath, screeningPath, manifestPath, bundlePath, receiptPath, workdir, outputPath] = process.argv.slice(2)
if (!['export', 'export-adjudication', 'import'].includes(command) ||
    ![rulesPath, screeningPath, manifestPath, bundlePath, receiptPath, workdir].every(Boolean) ||
    (command === 'import' && !outputPath))
  throw Error('USAGE: export|export-adjudication|import <rules> <screening> <manifest> <external-bundle> <admission-receipt> <external-workdir> [new-decision-output]')

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
const same = (a, b) => hash(a) === hash(b)
assertExternalCandidate(bundlePath)
assertExternalCandidate(workdir)
if (outputPath) assertExternalCandidate(outputPath)
const input = { ...read(bundlePath), rules: read(rulesPath), screening: read(screeningPath),
  manifest: read(manifestPath) }
const admission = admitReference(input)
const saved = read(receiptPath)
if (!same(saved.receipt, admission.receipt) || !same(saved.reference, admission.reference))
  throw Error('CALIBRATION_ADMISSION_STALE')
const receiptHash = admission.reference.admission_receipt_hash
const packets = buildCalibrationPackets(input, admission)
const packetPath = kind => join(workdir, `${kind}.packet.json`)
const output = kind => join(workdir, `${kind}.out.json`)
const invocation = kind => join(workdir, `${kind}.invocation.json`)
const verifyPacket = (kind, expected) => {
  const path = packetPath(kind)
  if (!existsSync(path) || !same(read(path), expected)) throw Error(`CALIBRATION_PACKET_STALE:${kind}`)
}
const readReview = (kind, expected) => {
  const path = output(kind)
  assertExternalCandidate(path)
  if (!existsSync(path)) return null
  const reviewed = read(path)
  if (reviewed.packet_hash !== expected.packet_hash || reviewed.kind !== kind ||
      reviewed.candidate_id !== admission.receipt.candidate_id)
    throw Error(`CALIBRATION_OUTPUT_PACKET_MISMATCH:${kind}`)
  return reviewed
}
const reviewerEvidence = reviewed => ['rater-a', 'rater-b'].map(kind => ({
  id: reviewed[kind].reviewer_id, model_family: reviewed[kind].model_family,
  invocation_id: reviewed[kind].invocation_id, ratings: reviewed[kind].ratings,
  invocation_evidence_path: invocation(kind),
  invocation_evidence_hash: sha(readFileSync(invocation(kind))),
  output_path: output(kind), output_hash: sha(readFileSync(output(kind))),
}))
const readyRaters = () => {
  const reviewed = {}
  for (const kind of ['rater-a', 'rater-b']) {
    verifyPacket(kind, packets[kind])
    reviewed[kind] = readReview(kind, packets[kind])
    if (!reviewed[kind] || !existsSync(invocation(kind))) return null
  }
  const reviewers = reviewerEvidence(reviewed)
  const decision = assessReferenceCalibration({ admission: { input, ...admission },
    evidence: { rating: { analysis_hash: admission.receipt.analysis_hash,
      codebook_hash: admission.receipt.codebook_hash, reviewers } } })
  if (decision.stages.rating_independence_eligible.reason !== 'RATING_ADJUDICATION_INCOMPLETE')
    throw Error('CALIBRATION_RATERS_NOT_READY')
  return reviewers
}

if (command === 'export') {
  let created = 0, unchanged = 0
  for (const [kind, value] of Object.entries(packets)) {
    const path = packetPath(kind)
    assertExternalCandidate(path)
    if (existsSync(path)) {
      if (!same(read(path), value)) throw Error(`CALIBRATION_PACKET_STALE:${kind}`)
      unchanged++
    } else {
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
      created++
    }
  }
  process.stdout.write(`${JSON.stringify({ created, unchanged, receipt_hash: receiptHash })}\n`)
} else if (command === 'export-adjudication') {
  const reviewers = readyRaters()
  if (!reviewers) throw Error('CALIBRATION_RATER_OUTPUTS_REQUIRED')
  const value = buildAdjudicationPacket(input, admission, reviewers)
  const path = packetPath('adjudication')
  assertExternalCandidate(path)
  if (existsSync(path)) {
    if (!same(read(path), value)) throw Error('CALIBRATION_PACKET_STALE:adjudication')
    process.stdout.write(`${JSON.stringify({ created: 0, unchanged: 1, receipt_hash: receiptHash })}\n`)
  } else {
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
    process.stdout.write(`${JSON.stringify({ created: 1, unchanged: 0, receipt_hash: receiptHash })}\n`)
  }
} else {
  for (const [kind, expected] of Object.entries(packets)) verifyPacket(kind, expected)
  const reviewed = {}, missing = []
  for (const kind of Object.keys(packets)) {
    reviewed[kind] = readReview(kind, packets[kind])
    if (!reviewed[kind]) missing.push(kind)
  }
  const ratersComplete = ['rater-a', 'rater-b'].every(kind => reviewed[kind])
  for (const kind of ['rater-a', 'rater-b'])
    if (ratersComplete && !existsSync(invocation(kind))) missing.push(`${kind}-invocation`)
  let adjudicationPacket = null
  if (ratersComplete && !missing.some(value => value.endsWith('-invocation'))) {
    const reviewers = reviewerEvidence(reviewed)
    adjudicationPacket = buildAdjudicationPacket(input, admission, reviewers)
    if (existsSync(packetPath('adjudication'))) {
      verifyPacket('adjudication', adjudicationPacket)
      reviewed.adjudication = readReview('adjudication', adjudicationPacket)
    }
  }
  if (!adjudicationPacket || !existsSync(packetPath('adjudication')) || !reviewed.adjudication)
    missing.push('adjudication')
  if (reviewed.adjudication?.adjudicator_id &&
      !existsSync(invocation('adjudication'))) missing.push('adjudication-invocation')
  const complete = ratersComplete && reviewed.adjudication &&
    !missing.some(value => value.endsWith('-invocation'))
  const evidence = {
    rights: reviewed.rights,
    grade_mapping: reviewed.grade,
    rating: complete ? {
      analysis_hash: admission.receipt.analysis_hash,
      codebook_hash: admission.receipt.codebook_hash,
      reviewers: reviewerEvidence(reviewed), axis_reviews: reviewed.adjudication.axis_reviews,
      adjudication: reviewed.adjudication.adjudicator_id ? {
        id: reviewed.adjudication.adjudicator_id,
        invocation_id: reviewed.adjudication.invocation_id,
        output_path: output('adjudication'),
        output_hash: sha(readFileSync(output('adjudication'))),
        invocation_evidence_path: invocation('adjudication'),
        invocation_evidence_hash: existsSync(invocation('adjudication')) ?
          sha(readFileSync(invocation('adjudication'))) : null,
      } : undefined,
    } : undefined,
  }
  const decision = assessReferenceCalibration({ admission: { input, ...admission }, evidence })
  const audit = { ...decision, missing_outputs: missing }
  writeFileSync(outputPath, `${JSON.stringify({ ...audit, audit_hash: hash(audit) }, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`${JSON.stringify({ calibration_eligible: decision.calibration_eligible,
    missing_outputs: missing, stages: decision.stages })}\n`)
}
