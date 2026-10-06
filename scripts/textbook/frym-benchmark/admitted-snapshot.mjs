// scripts/textbook/frym-benchmark/admitted-snapshot.mjs
import { buildBenchmark, hash, verifySnapshot } from './benchmark.mjs'

export function sealAdmittedSnapshot(protocol, samples, admissionReceiptHash) {
  const body = {
    schema: 'frym-admitted-benchmark-snapshot/1',
    admission_receipt_hash: admissionReceiptHash,
    benchmark_snapshot: buildBenchmark(protocol, samples),
  }
  return { ...body, seal_hash: hash(body) }
}

export function verifyAdmittedSnapshot(envelope, protocol, samples, admissionReceiptHash) {
  if (envelope?.schema !== 'frym-admitted-benchmark-snapshot/1' ||
      envelope.admission_receipt_hash !== admissionReceiptHash ||
      envelope.seal_hash !== hash(Object.fromEntries(Object.entries(envelope).filter(([key]) => key !== 'seal_hash')))) throw Error('ADMITTED_SNAPSHOT_STALE')
  verifySnapshot(envelope.benchmark_snapshot, protocol)
  if (buildBenchmark(protocol, samples).snapshot_hash !== envelope.benchmark_snapshot.snapshot_hash) throw Error('BENCHMARK_SAMPLE_CHANGED')
  return envelope.benchmark_snapshot
}
