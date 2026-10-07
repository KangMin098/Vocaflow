// scripts/textbook/frym-benchmark/benchmark-run.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildBenchmark, judgeBenchmark, verifyDecision, verifySnapshot, hash } from './benchmark.mjs'
import { verifyAdmission } from './local-admission-ledger.mjs'
import { assertExternalCandidate } from './local-candidate-path.mjs'
import { sealAdmittedSnapshot, verifyAdmittedSnapshot } from './admitted-snapshot.mjs'
import { inspectPipeline } from './pipeline-state.mjs'
import { previewPromotion } from './promotion-preview.mjs'
import { buildF02Synthetic } from '../frym-synthetic/f02-synthetic.mjs'
import { verifyStage } from '../frym-synthetic/f02-cross-agent.mjs'

const [command, ...paths] = process.argv.slice(2)
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
const fileBacked = samples => samples.some(sample => sample?.file_hash || sample?.source_path_hash)
const requireAdmission = (protocol, candidates, samples, audit, receipt) => {
  const result = verifyAdmission(protocol, candidates, samples, audit, receipt)
  if (!result.ready_for_build) throw Error(`ADMISSION_NOT_CURRENT_OR_INCOMPLETE:${result.reasons.join(',') || result.state}`)
  return result.receipt_hash
}
const statusFailure = reason => ({ schema: 'frym-benchmark-pipeline-state/1', state: 'stale', reasons: [reason], gold_s: false, seed_eligible: false, db_seed: false })
const auditDirectoryHash = directory => {
  const digest = createHash('sha256')
  const files = readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name).sort()
  if (!files.includes('run.json')) throw Error('E3_AUDIT_FILES_MISSING')
  for (const name of files) {
    const bytes = readFileSync(join(directory, name))
    digest.update(name).update('\0').update(String(bytes.length)).update('\0').update(bytes)
  }
  return digest.digest('hex')
}
const auditEvidenceHash = directory => {
  const gate = read(join(directory, 'stage-c-gate.json'))
  return hash({ batch: auditDirectoryHash(directory), stage_a: auditDirectoryHash(gate.stage_a_dir), stage_b: auditDirectoryHash(gate.stage_b_dir) })
}
const currentF02Seal = () => {
  const reviewCheck = spawnSync(process.execPath, [fileURLToPath(new URL('../../../node_modules/tsx/dist/cli.mjs', import.meta.url)), '--tsconfig', fileURLToPath(new URL('../../../apps/web/tsconfig.json', import.meta.url)), fileURLToPath(new URL('../academic-reading-smoke/check-f02-freeze.mjs', import.meta.url))], { encoding: 'utf8', windowsHide: true })
  if (reviewCheck.status !== 0) throw Error('F02_REVIEW_STALE')
  const built = buildF02Synthetic()
  const item_ids = Object.fromEntries(['middle_1', 'high_1'].map(grade => [grade, built.packets.find(packet => packet.passage_variant === grade).body.questions.map(question => question.id)]))
  return { ...built.seal, item_ids }
}

try {
  if (command === 'build' && paths.length === 3) {
    const samples = read(paths[1])
    if (fileBacked(samples)) throw Error('ADMISSION_RECEIPT_REQUIRED')
    write(paths[2], buildBenchmark(read(paths[0]), samples))
  } else if (command === 'build-admitted' && paths.length === 6) {
    assertExternalCandidate(paths[1])
    const [protocol, candidates, samples, audit, receipt] = paths.slice(0, 5).map(read)
    const admissionReceiptHash = requireAdmission(protocol, candidates, samples, audit, receipt)
    write(paths[5], sealAdmittedSnapshot(protocol, samples, admissionReceiptHash))
  } else if ((command === 'judge' && paths.length === 6) || (command === 'judge-admitted' && paths.length === 9)) {
    const admitted = command === 'judge-admitted'
    if (admitted) assertExternalCandidate(paths[2])
    const [protocol, storedSnapshot, samples, f02] = (admitted ? [paths[0], paths[1], paths[3], paths[6]] : paths.slice(0, 4)).map(read)
    if (!admitted && fileBacked(samples)) throw Error('ADMISSION_RECEIPT_REQUIRED')
    const admissionReceiptHash = admitted ? requireAdmission(protocol, read(paths[2]), samples, read(paths[4]), read(paths[5])) : null
    const snapshot = admitted ? verifyAdmittedSnapshot(storedSnapshot, protocol, samples, admissionReceiptHash) : storedSnapshot
    const seal = currentF02Seal()
    if (f02.source_freeze_sha256 !== seal.source_freeze_sha256 || f02.item_set_hash !== seal.item_set_hash || f02.scoring_key_hash !== seal.scoring_key_hash || ['middle_1', 'high_1'].some(grade => f02.variants?.[grade]?.passage_hash !== seal.passage_hash[grade])) throw Error('F02_CURRENT_SEAL_MISMATCH')
    const audited = verifyStage(admitted ? paths[7] : paths[4])
    if (audited.stage !== 'batch' || audited.synthetic_validation_valid_n !== 28) throw Error('E3_BATCH_NOT_VERIFIED')
    const e3Directory = admitted ? paths[7] : paths[4]
    const e3 = { status: 'verified', valid_n: audited.synthetic_validation_valid_n, run_id: audited.run_id, evidence_hash: auditEvidenceHash(e3Directory), seal }
    const decision = judgeBenchmark({ protocol, snapshot, samples, f02, e3 })
    if (admitted) {
      const { decision_hash, ...body } = decision
      body.admission_receipt_hash = admissionReceiptHash
      write(paths[8], { ...body, decision_hash: hash(body) })
    } else write(paths[5], decision)
  } else if (command === 'verify' && paths.length === 2) {
    const snapshot = read(paths[1])
    if (snapshot?.schema === 'frym-admitted-benchmark-snapshot/1') throw Error('ADMISSION_RECEIPT_REQUIRED')
    verifySnapshot(snapshot, read(paths[0]))
    process.stdout.write('BENCHMARK_SNAPSHOT_CURRENT\n')
  } else if (command === 'verify-admitted' && paths.length === 6) {
    assertExternalCandidate(paths[2])
    const [protocol, snapshot, candidates, samples, audit, receipt] = paths.map(read)
    const admissionReceiptHash = requireAdmission(protocol, candidates, samples, audit, receipt)
    verifyAdmittedSnapshot(snapshot, protocol, samples, admissionReceiptHash)
    process.stdout.write('BENCHMARK_ADMITTED_SNAPSHOT_CURRENT\n')
  } else if (command === 'status-admitted' && paths.length === 9) {
    let verifiedDecision
    const inspectStatus = () => {
      try { assertExternalCandidate(paths[1]) } catch { return statusFailure('RAW_CANDIDATES_LOCATION_INVALID') }
      let protocol, candidates, samples, audit, receipt
      try { [protocol, candidates, samples, audit, receipt] = paths.slice(0, 5).map(read) } catch { return statusFailure('ADMISSION_ARTIFACT_UNREADABLE') }
      const input = { protocol, candidates, samples, audit, receipt }
      const admissionState = inspectPipeline(input)
      if (admissionState.state !== 'admission-pass' || paths[5] === '-') return paths[5] === '-' && paths[8] !== '-' && admissionState.state === 'admission-pass' ? statusFailure('SNAPSHOT_MISSING') : admissionState
      let envelope
      try { envelope = read(paths[5]) } catch { return statusFailure('SNAPSHOT_UNREADABLE') }
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return statusFailure('SNAPSHOT_INVALID')
      const snapshotState = inspectPipeline({ ...input, envelope })
      if (snapshotState.state === 'stale' || paths[8] === '-') return snapshotState
      let decision
      try { decision = read(paths[8]) } catch { return statusFailure('DECISION_UNREADABLE') }
      if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return statusFailure('DECISION_INVALID')
      let currentDecision, f02, e3, decisionEvidenceError
      if (paths[6] !== '-' && paths[7] !== '-') try {
        f02 = read(paths[6])
        const seal = currentF02Seal()
        if (f02.source_freeze_sha256 !== seal.source_freeze_sha256 || f02.item_set_hash !== seal.item_set_hash || f02.scoring_key_hash !== seal.scoring_key_hash || ['middle_1', 'high_1'].some(grade => f02.variants?.[grade]?.passage_hash !== seal.passage_hash[grade])) throw Error('F02_CURRENT_SEAL_MISMATCH')
        const audited = verifyStage(paths[7], { readOnlyStageC: true })
        if (audited.stage !== 'batch' || audited.synthetic_validation_valid_n !== 28) throw Error('E3_BATCH_NOT_VERIFIED')
        const snapshot = envelope.benchmark_snapshot
        const e3EvidenceHash = auditEvidenceHash(paths[7])
        e3 = { status: 'verified', valid_n: 28, run_id: audited.run_id, evidence_hash: e3EvidenceHash, seal }
        currentDecision = { benchmark_version: snapshot.benchmark_version, benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f02), e3_run_id: audited.run_id, e3_evidence_hash: e3EvidenceHash }
      } catch (error) { decisionEvidenceError = ['F02_CURRENT_SEAL_MISMATCH', 'E3_BATCH_NOT_VERIFIED'].includes(error.message) ? error.message : 'DECISION_EVIDENCE_STALE' }
      const state = inspectPipeline({ ...input, envelope, decision, currentDecision, f02, e3, decisionEvidenceError })
      if (state.state === 'gold_s_candidate') verifiedDecision = decision
      return state
    }
    const state = inspectStatus()
    process.stdout.write(`${JSON.stringify({ ...state, promotion: previewPromotion(state, verifiedDecision) })}\n`)
    if (state.state === 'stale' || state.state === 'decision-unverified') process.exitCode = 1
  } else if ((command === 'verify-decision' && paths.length === 5) || (command === 'verify-decision-admitted' && paths.length === 9)) {
    try {
      const admitted = command === 'verify-decision-admitted'
      if (admitted) assertExternalCandidate(paths[2])
      const [protocol, storedSnapshot, f02] = (admitted ? [paths[0], paths[1], paths[6]] : paths.slice(0, 3)).map(read)
      const decision = read(admitted ? paths[8] : paths[4])
      if (!admitted && decision.admission_receipt_hash) throw Error('ADMISSION_RECEIPT_REQUIRED')
      const admissionReceiptHash = admitted ? requireAdmission(protocol, read(paths[2]), read(paths[3]), read(paths[4]), read(paths[5])) : null
      if (admitted && decision.admission_receipt_hash !== admissionReceiptHash) throw Error('ADMISSION_RECEIPT_STALE')
      const snapshot = admitted ? verifyAdmittedSnapshot(storedSnapshot, protocol, read(paths[3]), admissionReceiptHash) : storedSnapshot
      verifySnapshot(snapshot, protocol)
      const seal = currentF02Seal()
      if (f02.source_freeze_sha256 !== seal.source_freeze_sha256 || f02.item_set_hash !== seal.item_set_hash || f02.scoring_key_hash !== seal.scoring_key_hash || ['middle_1', 'high_1'].some(grade => f02.variants?.[grade]?.passage_hash !== seal.passage_hash[grade])) throw Error('F02_CURRENT_SEAL_MISMATCH')
      const e3Directory = admitted ? paths[7] : paths[3]
      const audited = verifyStage(e3Directory)
      if (audited.stage !== 'batch' || audited.synthetic_validation_valid_n !== 28) throw Error('E3_BATCH_NOT_VERIFIED')
      const current = { benchmark_version: snapshot.benchmark_version, benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f02), e3_run_id: audited.run_id, e3_evidence_hash: auditEvidenceHash(e3Directory) }
      const result = verifyDecision(decision, current)
      process.stdout.write(`${result.status.toUpperCase()}\n`)
      if (result.status !== 'current') process.exitCode = 1
    } catch {
      process.stdout.write('STALE\n')
      process.exitCode = 1
    }
  } else {
    throw Error('Usage: benchmark-run.mjs build <protocol> <fixture-samples> <snapshot> | build-admitted <protocol> <local-candidates> <metadata-samples> <audit> <receipt> <snapshot> | judge <protocol> <snapshot> <fixture-samples> <f02> <e3-dir> <decision> | judge-admitted <protocol> <snapshot> <local-candidates> <metadata-samples> <audit> <receipt> <f02> <e3-dir> <decision> | verify <protocol> <snapshot> | verify-admitted <protocol> <snapshot> <local-candidates> <metadata-samples> <audit> <receipt> | status-admitted <protocol> <local-candidates> <metadata-samples> <audit> <receipt> <snapshot-or-dash> <f02-or-dash> <e3-dir-or-dash> <decision-or-dash> | verify-decision <protocol> <snapshot> <f02> <e3-dir> <decision> | verify-decision-admitted <protocol> <snapshot> <local-candidates> <metadata-samples> <audit> <receipt> <f02> <e3-dir> <decision>')
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
