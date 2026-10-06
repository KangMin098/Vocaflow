// scripts/textbook/frym-benchmark/benchmark-run.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { buildBenchmark, judgeBenchmark, verifyDecision, verifySnapshot, hash } from './benchmark.mjs'
import { buildF02Synthetic } from '../frym-synthetic/f02-synthetic.mjs'
import { verifyStage } from '../frym-synthetic/f02-cross-agent.mjs'

const [command, ...paths] = process.argv.slice(2)
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const write = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })

try {
  if (command === 'build' && paths.length === 3) {
    write(paths[2], buildBenchmark(read(paths[0]), read(paths[1])))
  } else if (command === 'judge' && paths.length === 6) {
    const [protocol, snapshot, samples, f02] = paths.slice(0, 4).map(read)
    const seal = buildF02Synthetic().seal
    if (f02.source_freeze_sha256 !== seal.source_freeze_sha256 || f02.item_set_hash !== seal.item_set_hash || f02.scoring_key_hash !== seal.scoring_key_hash || ['middle_1', 'high_1'].some(grade => f02.variants?.[grade]?.passage_hash !== seal.passage_hash[grade])) throw Error('F02_CURRENT_SEAL_MISMATCH')
    const audited = verifyStage(paths[4])
    if (audited.stage !== 'batch' || audited.synthetic_validation_valid_n !== 28) throw Error('E3_BATCH_NOT_VERIFIED')
    const e3 = { status: 'verified', valid_n: audited.synthetic_validation_valid_n, run_id: audited.run_id, seal }
    write(paths[5], judgeBenchmark({ protocol, snapshot, samples, f02, e3 }))
  } else if (command === 'verify' && paths.length === 2) {
    verifySnapshot(read(paths[1]), read(paths[0]))
    process.stdout.write('BENCHMARK_SNAPSHOT_CURRENT\n')
  } else if (command === 'verify-decision' && paths.length === 5) {
    const [protocol, snapshot, f02] = paths.slice(0, 3).map(read)
    const decision = read(paths[4])
    verifySnapshot(snapshot, protocol)
    const seal = buildF02Synthetic().seal
    if (f02.source_freeze_sha256 !== seal.source_freeze_sha256 || f02.item_set_hash !== seal.item_set_hash || f02.scoring_key_hash !== seal.scoring_key_hash || ['middle_1', 'high_1'].some(grade => f02.variants?.[grade]?.passage_hash !== seal.passage_hash[grade])) throw Error('F02_CURRENT_SEAL_MISMATCH')
    const audited = verifyStage(paths[3])
    const current = { benchmark_version: snapshot.benchmark_version, benchmark_snapshot_hash: snapshot.snapshot_hash, f02_input_hash: hash(f02), e3_run_id: audited.run_id }
    const result = verifyDecision(decision, current)
    process.stdout.write(`${result.status.toUpperCase()}\n`)
    if (result.status !== 'current') process.exitCode = 1
  } else {
    throw Error('Usage: benchmark-run.mjs build <protocol.json> <metadata-samples.json> <new-snapshot.json> | judge <protocol.json> <snapshot.json> <metadata-samples.json> <f02-input.json> <verified-e3-batch-dir> <new-decision.json> | verify <protocol.json> <snapshot.json> | verify-decision <protocol.json> <snapshot.json> <f02-input.json> <verified-e3-batch-dir> <decision.json>')
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
