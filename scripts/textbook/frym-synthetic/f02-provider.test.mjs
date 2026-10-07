// scripts/textbook/frym-synthetic/f02-provider.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildF02Synthetic } from './f02-synthetic.mjs'
import { callProvider, graderSpec, hash, studentSpec, verifyProviderBatch, verifyProviderPair } from './f02-provider.mjs'

const built = buildF02Synthetic()
const mockCredential = 'test-only'
const runIds = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']
const makeClock = () => {
  let seconds = 0
  return () => new Date(Date.UTC(2026, 9, 5, 0, 0, seconds++)).toISOString()
}
const makeFetch = (packet, { returnedModel = null, refusal = false } = {}) => {
  let count = 0
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    const request = JSON.parse(options.body)
    const provider = url.includes('anthropic') ? 'anthropic' : 'openai'
    const system = request.system ?? request.instructions
    const student = !system.includes('independent blind scorer')
    const output = student
      ? { answers: packet.body.questions.map(question => ({ id: question.id, answer: 'Evidence from the passage.' })) }
      : { scores: packet.body.questions.map(question => ({ id: question.id, score: 1 })) }
    const text = refusal && student ? 'I cannot simulate this response.' : JSON.stringify(output)
    const body = provider === 'anthropic'
      ? { id: `msg_${packet.packet_id.slice(0, 8)}_${++count}`, model: returnedModel ?? request.model, stop_reason: 'end_turn', content: [{ type: 'text', text }] }
      : { id: `resp_${packet.packet_id.slice(0, 8)}_${++count}`, model: returnedModel ?? request.model, status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'request-id': `req_${packet.packet_id.slice(0, 8)}_${count}`, 'x-request-id': `req_${packet.packet_id.slice(0, 8)}_${count}` } })
  }
  return { fetchImpl, calls }
}
const pair = async (packet, studentProvider, graderProvider) => {
  const models = { anthropic: 'claude-fixed-version', openai: 'gpt-fixed-version' }
  const assignment = { student_provider: studentProvider, grader_provider: graderProvider, student_model: models[studentProvider], grader_model: models[graderProvider] }
  const mock = makeFetch(packet), clock = makeClock()
  const student = await callProvider({ ...studentSpec(packet, studentProvider, assignment.student_model), runId: runIds[0], apiKey: mockCredential, fetchImpl: mock.fetchImpl, clock })
  const grader = await callProvider({ ...graderSpec(packet, student.parsed_output.answers, built.scoringKey, graderProvider, assignment.grader_model), runId: runIds[0], apiKey: mockCredential, fetchImpl: mock.fetchImpl, clock })
  return { student, grader, assignment, calls: mock.calls }
}

test('both cross-provider directions bind exact requests to provider receipts and independent grading', async () => {
  for (const [studentProvider, graderProvider] of [['anthropic', 'openai'], ['openai', 'anthropic']]) {
    const packet = built.packets[studentProvider === 'anthropic' ? 0 : 1]
    const result = await pair(packet, studentProvider, graderProvider)
    assert.deepEqual(verifyProviderPair(packet, built.scoringKey, result.student, result.grader, result.assignment), { admissible: true, reason: null })
    assert.equal(result.student.provider_request_id.startsWith('req_'), true)
    assert.equal(result.grader.returned_model, result.assignment.grader_model)
    assert.notEqual(result.student.provider, result.grader.provider)
    assert.ok(!result.calls[0].options.body.includes('rubrics'))
    assert.ok(result.calls[1].options.body.includes('rubrics'))
    assert.ok(!JSON.stringify(result.student).includes(mockCredential))
    assert.equal(result.student.raw_response_sha256, hash(Buffer.from(result.student.raw_response_base64, 'base64')))
  }
})

test('receipt and hash failure injection fails closed', async () => {
  const packet = built.packets[0], result = await pair(packet, 'anthropic', 'openai')
  const verdict = (student, grader) => verifyProviderPair(packet, built.scoringKey, student, grader, result.assignment)
  const mutations = [
    [student => { student.request_payload_sha256 = '0'.repeat(64) }, 'STUDENT_EVIDENCE_MISMATCH'],
    [student => { student.raw_response = '{}' }, 'STUDENT_EVIDENCE_MISMATCH'],
    [student => { student.provider_request_id = 'req_swapped' }, 'STUDENT_EVIDENCE_MISMATCH'],
    [student => { student.provider_request_id = 'req_swapped'; student.receipt_header_request_id = 'req_swapped' }, 'STUDENT_EVIDENCE_MISMATCH'],
    [student => { student.returned_model = 'different-model' }, 'STUDENT_EVIDENCE_MISMATCH'],
    [student => { student.packet_sha256 = '0'.repeat(64) }, 'INDEPENDENCE_OR_PACKET_MISMATCH'],
    [student => { student.invocation_id = result.grader.invocation_id }, 'INDEPENDENCE_OR_PACKET_MISMATCH']
  ]
  for (const [mutate, reason] of mutations) {
    const student = structuredClone(result.student)
    mutate(student)
    assert.equal(verdict(student, result.grader).reason, reason)
  }
  assert.equal(verdict({ ...result.student, run_id: '' }, result.grader).reason, 'INVOCATION_ID_OR_TIME_INVALID')
  assert.equal(verdict({ ...result.student, invocation_id: '' }, result.grader).reason, 'INVOCATION_ID_OR_TIME_INVALID')
  assert.equal(verdict({ ...result.student, completed_at: null }, result.grader).reason, 'INVOCATION_ID_OR_TIME_INVALID')
  const truncated = structuredClone(result.student)
  const truncatedRaw = JSON.stringify({ ...JSON.parse(truncated.raw_response), stop_reason: 'max_tokens' })
  truncated.raw_response = truncatedRaw
  truncated.raw_response_base64 = Buffer.from(truncatedRaw).toString('base64')
  truncated.raw_response_sha256 = hash(Buffer.from(truncatedRaw))
  truncated.response_status = 'max_tokens'
  assert.equal(verdict(truncated, result.grader).reason, 'STUDENT_EVIDENCE_MISMATCH')
  const incomplete = structuredClone(result.grader)
  const incompleteRaw = JSON.stringify({ ...JSON.parse(incomplete.raw_response), status: 'incomplete' })
  incomplete.raw_response = incompleteRaw
  incomplete.raw_response_base64 = Buffer.from(incompleteRaw).toString('base64')
  incomplete.raw_response_sha256 = hash(Buffer.from(incompleteRaw))
  incomplete.response_status = 'incomplete'
  assert.equal(verdict(result.student, incomplete).reason, 'GRADER_EVIDENCE_MISMATCH')
  assert.equal(verifyProviderBatch([{ packet_id: packet.packet_id, student: result.student, grader: result.grader, assignment: result.assignment }], built.packets, built.scoringKey).synthetic_validation_valid_n, 0)
})

test('model mismatch and refusal preserve terminal failure without a score', async () => {
  const packet = built.packets[0], clock = makeClock()
  const mismatch = makeFetch(packet, { returnedModel: 'different-model' })
  const changed = await callProvider({ ...studentSpec(packet, 'anthropic', 'claude-fixed-version'), runId: runIds[1], apiKey: mockCredential, fetchImpl: mismatch.fetchImpl, clock })
  assert.equal(changed.status, 'audit_failure')
  const refusal = makeFetch(packet, { refusal: true })
  const refused = await callProvider({ ...studentSpec(packet, 'anthropic', 'claude-fixed-version'), runId: runIds[2], apiKey: mockCredential, fetchImpl: refusal.fetchImpl, clock })
  assert.equal(refused.status, 'parse_error')
  assert.equal(refused.parsed_output_sha256, null)
})

test('even 28 internally consistent mock pairs cannot become valid before live audit readiness', async () => {
  const pairs = []
  for (const packet of built.packets) {
    const result = await pair(packet, 'anthropic', 'openai')
    pairs.push({ packet_id: packet.packet_id, student: result.student, grader: result.grader, assignment: result.assignment })
  }
  assert.deepEqual(verifyProviderBatch(pairs, built.packets, built.scoringKey), { admissible: false, reason: 'AUDIT_READY_NOT_PROVEN', synthetic_validation_valid_n: 0 })
})
