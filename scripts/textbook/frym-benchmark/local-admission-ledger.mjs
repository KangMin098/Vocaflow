// scripts/textbook/frym-benchmark/local-admission-ledger.mjs
import { hash, validateProtocol } from './benchmark.mjs'
import { prepareAdmission } from './local-admission.mjs'

const stateOf = audit => audit.results.some(row => row.status === 'admission-reject')
  ? 'admission-reject'
  : audit.results.length === 0 || audit.results.some(row => row.status === 'admission-hold') ? 'admission-hold' : 'admission-pass'

const countsOf = audit => ({
  pass: audit.results.filter(row => row.status === 'admission-pass').length,
  hold: audit.results.filter(row => row.status === 'admission-hold').length,
  reject: audit.results.filter(row => row.status === 'admission-reject').length,
})

export function dryRunAdmission(protocol, candidates) {
  const protocol_hash = validateProtocol(protocol)
  const { samples, audit } = prepareAdmission(candidates, protocol)
  const state = stateOf(audit)
  return {
    schema: 'frym-local-admission-dry-run/1',
    benchmark_version: protocol.version,
    protocol_hash,
    state,
    ready_for_build: state === 'admission-pass',
    counts: countsOf(audit),
    sample_count: samples.length,
    reasons: [...new Set(audit.results.flatMap(row => row.reasons))].sort(),
  }
}

export function createAdmissionReceipt(protocol, candidates, samples, audit) {
  const protocol_hash = validateProtocol(protocol)
  const state = stateOf(audit)
  const body = {
    schema: 'frym-local-admission-receipt/1',
    benchmark_version: protocol.version,
    protocol_hash,
    codebook_hash: protocol.codebook_hash,
    selection_manifest_hash: protocol.selection_manifest_hash,
    candidate_input_hash: hash(candidates),
    metadata_samples_hash: hash(samples),
    admission_audit_hash: hash(audit),
    state,
    counts: countsOf(audit),
    ready_for_build: state === 'admission-pass',
  }
  return { ...body, receipt_hash: hash(body) }
}

export function prepareSealedAdmission(protocol, candidates) {
  const { samples, audit } = prepareAdmission(candidates, protocol)
  return { samples, audit, receipt: createAdmissionReceipt(protocol, candidates, samples, audit) }
}

export function verifyAdmission(protocol, candidates, samples, audit, receipt) {
  const current = prepareSealedAdmission(protocol, candidates)
  const reasons = []
  if (receipt?.schema !== 'frym-local-admission-receipt/1' || receipt.receipt_hash !== hash(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receipt_hash')))) reasons.push('RECEIPT_INVALID')
  if (receipt?.benchmark_version !== protocol.version || receipt?.protocol_hash !== current.receipt.protocol_hash || receipt?.codebook_hash !== protocol.codebook_hash || receipt?.selection_manifest_hash !== protocol.selection_manifest_hash) reasons.push('BENCHMARK_VERSION_STALE')
  if (receipt?.candidate_input_hash !== current.receipt.candidate_input_hash) reasons.push('CANDIDATE_INPUT_STALE')
  if (hash(samples) !== current.receipt.metadata_samples_hash || receipt?.metadata_samples_hash !== current.receipt.metadata_samples_hash) reasons.push('METADATA_SAMPLES_STALE')
  if (hash(audit) !== current.receipt.admission_audit_hash || receipt?.admission_audit_hash !== current.receipt.admission_audit_hash) reasons.push('ADMISSION_AUDIT_STALE')
  if (receipt?.receipt_hash !== current.receipt.receipt_hash) reasons.push('RECEIPT_STALE')
  if (current.audit.results.some(row => row.reasons.includes('SOURCE_HASH_CHANGED') || row.reasons.includes('SOURCE_UNREADABLE'))) reasons.push('SOURCE_STALE')
  const status = reasons.length ? 'stale' : 'current'
  return {
    schema: 'frym-local-admission-verification/1',
    status,
    benchmark_version: protocol.version,
    protocol_hash: current.receipt.protocol_hash,
    receipt_hash: status === 'current' ? current.receipt.receipt_hash : null,
    state: current.receipt.state,
    ready_for_build: status === 'current' && current.receipt.ready_for_build,
    counts: current.receipt.counts,
    reasons,
  }
}
