// scripts/textbook/frym-synthetic/f02-provider.mjs
import { randomUUID } from 'node:crypto'
import { smokeHash, scorerCall, studentCall, STUDENT_SYSTEM, SCORER_INSTRUCTION } from './f02-smoke-identity.mjs'

export const PROVIDER_ENDPOINTS = Object.freeze({ anthropic: 'https://api.anthropic.com/v1/messages', openai: 'https://api.openai.com/v1/responses' })
export const hash = value => smokeHash(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : JSON.stringify(value))
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const instant = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value))
const receiptDigest = record => hash(JSON.stringify({ run_id: record.run_id, invocation_id: record.invocation_id, packet_id: record.packet_id, serialized_request: record.serialized_request, provider_request_id: record.provider_request_id, provider_response_id: record.provider_response_id, returned_model: record.returned_model, raw_response_sha256: record.raw_response_sha256, started_at: record.started_at, completed_at: record.completed_at }))
const parseText = text => JSON.parse(text.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/, '').trim())

export function makeRequest({ provider, model, system, prompt }) {
  if (!PROVIDER_ENDPOINTS[provider] || !model || !system || !prompt) throw Error('Provider request incomplete')
  const body = provider === 'anthropic'
    ? { model, max_tokens: 2048, system, messages: [{ role: 'user', content: prompt }] }
    : { model, instructions: system, input: prompt, max_output_tokens: 2048, store: false }
  return { provider, endpoint: PROVIDER_ENDPOINTS[provider], body, serialized_body: JSON.stringify(body) }
}

export function extractProviderResponse(provider, rawText, requestId) {
  const body = JSON.parse(rawText)
  const responseText = provider === 'anthropic'
    ? (body.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('')
    : (body.output ?? []).flatMap(item => item.type === 'message' ? item.content ?? [] : []).filter(item => item.type === 'output_text').map(item => item.text).join('')
  return { provider_request_id: requestId, provider_response_id: body.id, returned_model: body.model, response_status: provider === 'anthropic' ? body.stop_reason : body.status, response_text: responseText }
}

export async function callProvider({ provider, model, system, prompt, packet, role, runId, apiKey, fetchImpl = fetch, clock = () => new Date().toISOString(), invocationId = randomUUID() }) {
  if (!apiKey) throw Error(`${provider} API credential unavailable`)
  if (!['student', 'grader'].includes(role)) throw Error('Provider role invalid')
  const request = makeRequest({ provider, model, system, prompt })
  const record = {
    schema_version: 1, run_id: runId, invocation_id: invocationId, packet_id: packet.packet_id,
    role, provider, requested_model: model, returned_model: null,
    provider_request_id: null, receipt_header_request_id: null, provider_response_id: null, receipt_digest_sha256: null,
    request_endpoint: request.endpoint, request_body: request.body, serialized_request: request.serialized_body,
    request_payload_sha256: hash(request.serialized_body), system_prompt_sha256: hash(system),
    profile_sha256: hash(packet.body.profile), packet_sha256: packet.packet_id,
    raw_response: null, raw_response_base64: null, raw_response_sha256: null, response_http_status: null, parsed_output_sha256: null,
    started_at: clock(), completed_at: null, status: 'started', error_reason: null
  }
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
  if (provider === 'anthropic') headers['anthropic-version'] = '2023-06-01'
  try {
    const response = await fetchImpl(request.endpoint, { method: 'POST', headers, body: request.serialized_body, signal: AbortSignal.timeout(120000) })
    const rawBytes = Buffer.from(await response.arrayBuffer())
    record.completed_at = clock()
    record.provider_request_id = response.headers.get(provider === 'anthropic' ? 'request-id' : 'x-request-id')
    record.receipt_header_request_id = record.provider_request_id
    record.response_http_status = response.status
    record.raw_response_base64 = rawBytes.toString('base64')
    record.raw_response_sha256 = hash(rawBytes)
    let raw
    try { raw = new TextDecoder('utf-8', { fatal: true }).decode(rawBytes) }
    catch {
      record.status = 'parse_error'
      record.error_reason = 'INVALID_UTF8_RESPONSE'
      return record
    }
    record.raw_response = raw
    if (!response.ok) {
      record.status = 'provider_error'
      record.error_reason = `HTTP_${response.status}`
      return record
    }
    const extracted = extractProviderResponse(provider, raw, record.provider_request_id)
    Object.assign(record, extracted)
    record.receipt_digest_sha256 = receiptDigest(record)
    if (!record.provider_request_id || !record.provider_response_id || record.returned_model !== model) {
      record.status = 'audit_failure'
      record.error_reason = 'PROVIDER_RECEIPT_INCOMPLETE_OR_MODEL_MISMATCH'
      return record
    }
    if ((provider === 'openai' && extracted.response_status !== 'completed') || (provider === 'anthropic' && extracted.response_status !== 'end_turn') || !extracted.response_text) {
      record.status = 'refused'
      record.error_reason = 'NO_TEXT_RESPONSE'
      return record
    }
    try {
      const output = parseText(extracted.response_text)
      record.parsed_output = output
      record.parsed_output_sha256 = hash(output)
      record.status = 'completed'
    } catch {
      record.status = 'parse_error'
      record.error_reason = 'NON_JSON_RESPONSE'
    }
  } catch (error) {
    record.completed_at = clock()
    record.status = error?.name === 'TimeoutError' ? 'timeout' : 'provider_error'
    record.error_reason = error?.name ?? 'UNKNOWN_ERROR'
  }
  return record
}

export function studentSpec(packet, provider, model) {
  return { provider, model, system: STUDENT_SYSTEM, prompt: studentCall(packet).prompt, packet, role: 'student' }
}

export function graderSpec(packet, answers, scoringKey, provider, model) {
  return { provider, model, system: SCORER_INSTRUCTION, prompt: scorerCall(packet, answers, scoringKey).prompt, packet, role: 'grader' }
}

export function verifyProviderPair(packet, scoringKey, student, grader, expected) {
  const fail = reason => ({ admissible: false, reason })
  if (!student || !grader || student.status !== 'completed' || grader.status !== 'completed') return fail('INCOMPLETE_RESPONSE')
  if (!uuid(student.run_id) || !uuid(grader.run_id) || !uuid(student.invocation_id) || !uuid(grader.invocation_id) || ![student.started_at, student.completed_at, grader.started_at, grader.completed_at].every(instant) || student.started_at > student.completed_at || grader.started_at > grader.completed_at) return fail('INVOCATION_ID_OR_TIME_INVALID')
  if (student.run_id !== grader.run_id || student.invocation_id === grader.invocation_id || student.packet_id !== packet.packet_id || grader.packet_id !== packet.packet_id || student.packet_sha256 !== packet.packet_id || grader.packet_sha256 !== packet.packet_id || student.role !== 'student' || grader.role !== 'grader' || student.provider === grader.provider) return fail('INDEPENDENCE_OR_PACKET_MISMATCH')
  if (student.provider !== expected.student_provider || grader.provider !== expected.grader_provider || student.requested_model !== expected.student_model || grader.requested_model !== expected.grader_model) return fail('PROVIDER_ASSIGNMENT_MISMATCH')
  if (student.completed_at > grader.started_at) return fail('INVOCATION_ORDER_INVALID')
  const verifyCall = (record, spec) => {
    try {
      const request = makeRequest(spec)
      const rawBytes = Buffer.from(record.raw_response_base64, 'base64')
      if (rawBytes.toString('base64') !== record.raw_response_base64 || new TextDecoder('utf-8', { fatal: true }).decode(rawBytes) !== record.raw_response || record.response_http_status !== 200 || record.request_endpoint !== request.endpoint || JSON.stringify(record.request_body) !== request.serialized_body || record.serialized_request !== request.serialized_body || record.request_payload_sha256 !== hash(record.serialized_request) || record.system_prompt_sha256 !== hash(spec.system) || record.profile_sha256 !== hash(packet.body.profile) || !record.provider_request_id || record.provider_request_id !== record.receipt_header_request_id || !record.provider_response_id || record.returned_model !== spec.model || hash(rawBytes) !== record.raw_response_sha256 || receiptDigest(record) !== record.receipt_digest_sha256) return false
      const extracted = extractProviderResponse(spec.provider, record.raw_response, record.provider_request_id)
      if (extracted.response_status !== (spec.provider === 'anthropic' ? 'end_turn' : 'completed') || extracted.provider_response_id !== record.provider_response_id || extracted.returned_model !== record.returned_model || hash(record.parsed_output) !== record.parsed_output_sha256 || JSON.stringify(parseText(extracted.response_text)) !== JSON.stringify(record.parsed_output)) return false
      return true
    } catch { return false }
  }
  if (!verifyCall(student, studentSpec(packet, expected.student_provider, expected.student_model))) return fail('STUDENT_EVIDENCE_MISMATCH')
  const answers = student.parsed_output?.answers
  const ids = packet.body.questions.map(question => question.id)
  if (!Array.isArray(answers) || answers.length !== ids.length || ids.some((id, index) => answers[index]?.id !== id || typeof answers[index]?.answer !== 'string' || !answers[index].answer.trim())) return fail('STUDENT_ANSWERS_INCOMPLETE')
  if (!verifyCall(grader, graderSpec(packet, answers, scoringKey, expected.grader_provider, expected.grader_model))) return fail('GRADER_EVIDENCE_MISMATCH')
  const scores = grader.parsed_output?.scores
  if (!Array.isArray(scores) || scores.length !== ids.length || ids.some((id, index) => scores[index]?.id !== id || ![0, 0.5, 1].includes(scores[index]?.score))) return fail('GRADER_SCORES_INCOMPLETE')
  return { admissible: true, reason: null }
}

export function verifyProviderBatch(pairs, packets, scoringKey, expectedCount = 28) {
  if (pairs.length !== expectedCount) return { admissible: false, reason: 'INCOMPLETE_BATCH', synthetic_validation_valid_n: 0 }
  const packetById = new Map(packets.map(packet => [packet.packet_id, packet]))
  const ids = new Set(), requestIds = new Set(), responseIds = new Set(), runIds = new Set()
  for (const pair of pairs) {
    if (ids.has(pair.packet_id) || !packetById.has(pair.packet_id)) return { admissible: false, reason: 'DUPLICATE_OR_UNKNOWN_PACKET', synthetic_validation_valid_n: 0 }
    ids.add(pair.packet_id)
    const result = verifyProviderPair(packetById.get(pair.packet_id), scoringKey, pair.student, pair.grader, pair.assignment)
    if (!result.admissible) return { ...result, synthetic_validation_valid_n: 0 }
    for (const receipt of [pair.student, pair.grader]) {
      const requestKey = `${receipt.provider}:${receipt.provider_request_id}`
      const responseKey = `${receipt.provider}:${receipt.provider_response_id}`
      if (requestIds.has(requestKey) || responseIds.has(responseKey)) return { admissible: false, reason: 'DUPLICATE_PROVIDER_RECEIPT', synthetic_validation_valid_n: 0 }
      requestIds.add(requestKey)
      responseIds.add(responseKey)
      runIds.add(receipt.run_id)
    }
  }
  if (runIds.size !== 1) return { admissible: false, reason: 'MIXED_RUN_IDS', synthetic_validation_valid_n: 0 }
  // Live Stage A/B receipts and Stage C failure injection have no sealed audit-ready
  // manifest yet. Pair consistency alone must never promote a synthetic batch.
  return { admissible: false, reason: 'AUDIT_READY_NOT_PROVEN', synthetic_validation_valid_n: 0 }
}
