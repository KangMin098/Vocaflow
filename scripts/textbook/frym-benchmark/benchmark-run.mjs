// scripts/textbook/frym-benchmark/benchmark-run.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildBenchmark, judgeBenchmark, verifyDecision, verifySnapshot, hash } from './benchmark.mjs'
import { buildF02Synthetic } from '../frym-synthetic/f02-synthetic.mjs'
import { verifyStage } from '../frym-synthetic/f02-cross-agent.mjs'

const [command, ...paths] = process.argv.slice(2)
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
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
    write(paths[2], buildBenchmark(read(paths[0]), read(paths[1])))
  } else if (command === 'judge' && paths.length === 6) {
    const [protocol, snapshot, samples, f02] = paths.slice(0, 4).map(read)
    const seal = currentF02Seal()
    if (f02.source_freeze_sha256 !== seal.source_freeze_sha256 || f02.item_set_hash !== seal.item_set_hash || f02.scoring_key_hash !== seal.scoring_key_hash || ['middle_1', 'high_1'].some(grade => f02.variants?.[grade]?.passage_hash !== seal.passage_hash[grade])) throw Error('F02_CURRENT_SEAL_MISMATCH')
    const audited = verifyStage(paths[4])
    if (audited.stage !== 'batch' || audited.synthetic_validation_valid_n !== 28) throw Error('E3_BATCH_NOT_VERIFIED')
    const e3 = { status: 'verified', valid_n: audited.synthetic_validation_valid_n, run_id: audited.run_id, evidence_hash: auditEvidenceHash(paths[4]), seal }
    write(paths[5], judgeBenchmark({ protocol, snapshot, samples, f02, e3 }))
  } else if (command === 'verify' && paths.length === 2) {
    verifySnapshot(read(paths[1]), read(paths[0]))
    process.stdout.write('BENCHMARK_SNAPSHOT_CURRENT\n')
  } else if (command === 'verify-decision' && paths.length === 5) {
    try {
      const [protocol, snapshot, f02] = paths.slice(0, 3).map(read)
      const decision = read(paths[4])
      verifySnapshot(snapshot, protocol)
      const seal = currentF02Seal()
      if (f02.source_freeze_sha256 !== seal.source_freeze_sha256 || f02.item_set_hash !== seal.item_set_hash || f02.scoring_key_hash !== seal.scoring_key_hash || ['middle_1', 'high_1'].some(grade => f02.variants?.[grade]?.passage_hash !== seal.passage_hash[grade])) throw Error('F02_CURRENT_SEAL_MISMATCH')
      const audited = verifyStage(paths[3])
      if (audited.stage !== 'batch' || audited.synthetic_validation_valid_n !== 28) throw Error('E3_BATCH_NOT_VERIFIED')
      const current = { benchmark_version: snapshot.benchmark_version, benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f02), e3_run_id: audited.run_id, e3_evidence_hash: auditEvidenceHash(paths[3]) }
      const result = verifyDecision(decision, current)
      process.stdout.write(`${result.status.toUpperCase()}\n`)
      if (result.status !== 'current') process.exitCode = 1
    } catch {
      process.stdout.write('STALE\n')
      process.exitCode = 1
    }
  } else {
    throw Error('Usage: benchmark-run.mjs build <protocol.json> <metadata-samples.json> <new-snapshot.json> | judge <protocol.json> <snapshot.json> <metadata-samples.json> <f02-input.json> <verified-e3-batch-dir> <new-decision.json> | verify <protocol.json> <snapshot.json> | verify-decision <protocol.json> <snapshot.json> <f02-input.json> <verified-e3-batch-dir> <decision.json>')
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
