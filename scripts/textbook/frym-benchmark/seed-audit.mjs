// scripts/textbook/frym-benchmark/seed-audit.mjs
import { appendFileSync, closeSync, fsyncSync, openSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { hash } from './benchmark.mjs'
import { assertExternalCandidate } from './local-candidate-path.mjs'

const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

export function openSeedAudit(path, { policyHash, bundleHash, candidateCount, startedAt } = {}) {
  assertExternalCandidate(path)
  if (!hex(policyHash) || !hex(bundleHash) || !Number.isSafeInteger(candidateCount) || candidateCount < 0 || !Number.isFinite(Date.parse(startedAt))) throw Error('GOLD_S_AUDIT_START_INVALID')
  const fd = openSync(path, 'wx', 0o600)
  const runId = randomUUID()
  let previousHash = null
  const append = (event, batchIndex = null, sourceIds = []) => {
    if (!['run_start', 'batch_start', 'batch_committed', 'run_complete'].includes(event) || !Array.isArray(sourceIds) || sourceIds.some(id => typeof id !== 'string' || !id.startsWith('reading:')) || (event.startsWith('batch_') && (!Number.isSafeInteger(batchIndex) || batchIndex < 0))) throw Error('GOLD_S_AUDIT_EVENT_INVALID')
    const body = { schema: 'frym-gold-s-seed-audit/1', run_id: runId, event, batch_index: batchIndex, source_ids: sourceIds, policy_hash: policyHash, bundle_hash: bundleHash, candidate_count: candidateCount, started_at: startedAt, previous_hash: previousHash }
    const row = { ...body, event_hash: hash(body) }
    appendFileSync(fd, `${JSON.stringify(row)}\n`)
    fsyncSync(fd)
    previousHash = row.event_hash
    return row
  }
  append('run_start')
  return { runId, append, close: () => closeSync(fd) }
}

export function verifySeedAudit(path) {
  const lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean)
  if (!lines.length) return { valid: false, status: 'invalid' }
  let previousHash = null, runId = null, starts = 0, completes = 0
  const pending = new Map()
  const committed = new Set()
  for (const [index, line] of lines.entries()) {
    let row
    try { row = JSON.parse(line) } catch {
      if (index === lines.length - 1 && previousHash) return { valid: false, status: 'invalid_tail', run_id: runId, pending_batches: [...pending.keys()].sort((a, b) => a - b), verified_prefix_hash: previousHash }
      return { valid: false, status: 'invalid' }
    }
    const { event_hash, ...body } = row
    if (body.schema !== 'frym-gold-s-seed-audit/1' || !hex(event_hash) || event_hash !== hash(body) || body.previous_hash !== previousHash || (runId && body.run_id !== runId) || (index === 0 && body.event !== 'run_start') || (completes > 0 && body.event !== 'run_complete')) return { valid: false, status: 'invalid' }
    runId = body.run_id
    previousHash = event_hash
    if (body.event === 'run_start') starts += 1
    else if (body.event === 'batch_start') { if (pending.has(body.batch_index) || committed.has(body.batch_index) || !Array.isArray(body.source_ids) || !body.source_ids.length) return { valid: false, status: 'invalid' }; pending.set(body.batch_index, hash(body.source_ids)) }
    else if (body.event === 'batch_committed') { if (!Array.isArray(body.source_ids) || !pending.has(body.batch_index) || pending.get(body.batch_index) !== hash(body.source_ids)) return { valid: false, status: 'invalid' }; pending.delete(body.batch_index); committed.add(body.batch_index) }
    else if (body.event === 'run_complete') { if (pending.size) return { valid: false, status: 'invalid' }; completes += 1 }
    else return { valid: false, status: 'invalid' }
  }
  if (starts !== 1 || completes > 1 || (completes && (pending.size || lines.at(-1) && JSON.parse(lines.at(-1)).event !== 'run_complete'))) return { valid: false, status: 'invalid' }
  return { valid: true, status: completes ? 'complete' : 'interrupted', run_id: runId, pending_batches: [...pending.keys()].sort((a, b) => a - b), last_hash: previousHash }
}
