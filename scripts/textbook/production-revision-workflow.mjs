// scripts/textbook/production-revision-workflow.mjs
import { hash } from './frym-benchmark/benchmark.mjs'
import { inspectProductionRevisionImpact } from './production-revision-impact.mjs'

const SHA256 = /^[a-f0-9]{64}$/
const eventsByState = {
  needs_review: { review_approved: 'revise' },
  revise: { rebuild_failed: 'needs_review', rebuild_passed: 'republish' },
  republish: { publication_simulated: 'complete' },
}

function verified(record) {
  const { workflow_hash: storedHash, ...body } = record ?? {}
  if (!record || record.schema !== 'textbook-revision-workflow-synthetic/1' ||
      record.synthetic_fixture !== true || record.non_production !== true ||
      record.publish_eligible !== false ||
      storedHash !== hash(body) || !['changed', 'rights_revoked'].includes(record.cause) ||
      !SHA256.test(record.prior_manifest_hash) || !SHA256.test(record.next_manifest_hash) ||
      !Array.isArray(record.events) || !Array.isArray(record.affected) || !record.affected.length ||
      record.affected.some(row => row?.authorized !== false ||
        !['stale', 'invalidated'].includes(row.proposed_state)))
    throw Error('REVISION_WORKFLOW_TAMPERED')
  let state = record.cause === 'rights_revoked' ? 'withdraw' : 'needs_review'
  const seen = new Set()
  for (const event of record.events) {
    if (!event || typeof event.event_id !== 'string' || seen.has(event.event_id) ||
        event.group_id !== record.group_id || event.next_manifest_hash !== record.next_manifest_hash ||
        !SHA256.test(event.proof_hash) || !eventsByState[state]?.[event.type])
      throw Error('REVISION_WORKFLOW_HISTORY_INVALID')
    seen.add(event.event_id)
    if (event.type === 'publication_simulated' &&
        (event.output_hash !== event.proof_hash || event.output_hash !== record.events[record.events.indexOf(event) - 1]?.proof_hash))
      throw Error('REVISION_WORKFLOW_HISTORY_INVALID')
    state = eventsByState[state][event.type]
  }
  if (state !== record.state) throw Error('REVISION_WORKFLOW_HISTORY_INVALID')
  return record
}

export function beginSyntheticRevisionWorkflow(priorManifest, nextManifest, cause = 'changed') {
  const impact = inspectProductionRevisionImpact(priorManifest, nextManifest, cause)
  if (!impact.affected.length) throw Error('REVISION_WORKFLOW_NO_CHANGE')
  const body = { schema: 'textbook-revision-workflow-synthetic/1',
    synthetic_fixture: true, non_production: true,
    group_id: impact.group_id, prior_manifest_hash: impact.prior_manifest_hash,
    next_manifest_hash: impact.next_manifest_hash, cause,
    affected: impact.affected, state: cause === 'rights_revoked' ? 'withdraw' : 'needs_review',
    events: [], publish_eligible: false }
  return { ...body, workflow_hash: hash(body) }
}

export function advanceSyntheticRevisionWorkflow(input, event) {
  const record = verified(input)
  if (record.state === 'withdraw' || record.state === 'complete') throw Error('REVISION_WORKFLOW_TERMINAL')
  if (!event || typeof event !== 'object' || typeof event.event_id !== 'string' || !event.event_id.trim() ||
      typeof event.type !== 'string' || !SHA256.test(event.proof_hash) ||
      event.next_manifest_hash !== record.next_manifest_hash || event.group_id !== record.group_id)
    throw Error('REVISION_WORKFLOW_EVENT_INVALID')
  const existing = record.events.find(row => row.event_id === event.event_id)
  if (existing) {
    if (hash(existing) !== hash(event)) throw Error('REVISION_WORKFLOW_REPLAY_CONFLICT')
    return record
  }
  const nextState = eventsByState[record.state]?.[event.type]
  if (!nextState) throw Error('REVISION_WORKFLOW_TRANSITION_INVALID')
  if (event.type === 'publication_simulated' &&
      (!SHA256.test(event.output_hash) || event.output_hash !== event.proof_hash ||
        event.output_hash !== record.events.at(-1)?.proof_hash))
    throw Error('REVISION_WORKFLOW_OUTPUT_MISMATCH')
  const body = { ...record, state: nextState, events: [...record.events, event] }
  delete body.workflow_hash
  return { ...body, workflow_hash: hash(body) }
}
