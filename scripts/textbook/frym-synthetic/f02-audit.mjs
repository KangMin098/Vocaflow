// scripts/textbook/frym-synthetic/f02-audit.mjs
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCORER_MODEL, STUDENT_MODEL, STUDENT_SYSTEM, scorerCall, smokeHash, studentCall } from './f02-smoke-identity.mjs'
import { buildF02Synthetic } from './f02-synthetic.mjs'

export const hashBytes = value => smokeHash(Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8'))

export function beginInvocation({ runId, packetId, role, command, args, cwd, stdin, system, profile, payload, modelRequested, clientVersion, startedAt }) {
  if (!runId || !packetId || !['student', 'grader'].includes(role) || !command || !Array.isArray(args)) throw Error('Invocation metadata incomplete')
  return {
    schema_version: 1,
    run_id: runId,
    packet_id: packetId,
    role,
    invocation_id: randomUUID(),
    started_at: startedAt,
    command,
    argv: args,
    cwd,
    client_version: clientVersion,
    model_requested: modelRequested,
    model_observed: null,
    provider_request_attested: false,
    system_sha256: system === null ? null : hashBytes(system),
    profile_sha256: hashBytes(JSON.stringify(profile)),
    payload_sha256: hashBytes(JSON.stringify(payload)),
    stdin_sha256: hashBytes(stdin),
    pid: null,
    ended_at: null,
    exit_code: null,
    signal: null,
    status: 'started',
    stdout_sha256: null,
    stderr_sha256: null,
    response_sha256: null,
    error_reason: null
  }
}

export function endInvocation(record, { pid, code, signal, stdout, stderr, response, errorReason, modelObserved, endedAt }) {
  return {
    ...record,
    pid,
    ended_at: endedAt,
    exit_code: code,
    signal,
    status: errorReason || code !== 0 ? 'failed' : 'completed',
    stdout_sha256: hashBytes(stdout),
    stderr_sha256: hashBytes(stderr),
    response_sha256: response === null ? null : hashBytes(response),
    error_reason: errorReason ?? null,
    model_observed: modelObserved ?? null
  }
}

export function auditPacket(student, grader) {
  if (!student || !grader || student.role !== 'student' || grader.role !== 'grader' || student.run_id !== grader.run_id || student.packet_id !== grader.packet_id || student.invocation_id === grader.invocation_id || student.pid === grader.pid || !student.pid || !grader.pid || student.status !== 'completed' || grader.status !== 'completed' || !student.ended_at || !grader.started_at || student.ended_at > grader.started_at || student.response_sha256 === null || grader.response_sha256 === null || student.model_requested === grader.model_requested) return { admissible: false, reason: 'INVOCATION_CHAIN_INCOMPLETE' }
  if (student.model_observed !== student.model_requested || grader.model_observed !== grader.model_requested) return { admissible: false, reason: 'MODEL_IDENTITY_UNATTESTED' }
  // CLI logs are local assertions, not signed provider receipts. A future verifier must
  // validate provider evidence before this gate can ever return admissible.
  return { admissible: false, reason: 'PROVIDER_REQUEST_UNATTESTED' }
}

export function verifyAuditFiles(root, packet, row, scoringKey, expectedRunId) {
  const id = packet.packet_id
  const load = role => JSON.parse(readFileSync(join(root, `audit-${role}-${id}.json`), 'utf8'))
  const student = load('student'), grader = load('grader')
  const studentRequest = studentCall(packet), graderRequest = scorerCall(packet, row.answers, scoringKey)
  if (student.packet_id !== id || grader.packet_id !== id || row.packet_id !== id || row.run_id !== expectedRunId || student.run_id !== expectedRunId || grader.run_id !== expectedRunId || student.model_requested !== STUDENT_MODEL || grader.model_requested !== SCORER_MODEL || student.system_sha256 !== hashBytes(STUDENT_SYSTEM) || student.profile_sha256 !== hashBytes(JSON.stringify(packet.body.profile)) || student.payload_sha256 !== hashBytes(JSON.stringify({ passage: packet.body.passage, questions: packet.body.questions })) || student.stdin_sha256 !== hashBytes(studentRequest.prompt) || grader.stdin_sha256 !== hashBytes(graderRequest.prompt) || student.command !== 'cmd.exe' || grader.command !== 'codex') throw Error('Audit request binding mismatch')
  for (const role of ['student', 'grader']) {
    const record = role === 'student' ? student : grader
    const path = join(root, `audit-${role}-${id}.json`)
    if (record.stdout_sha256 !== hashBytes(readFileSync(`${path}.stdout`)) || record.stderr_sha256 !== hashBytes(readFileSync(`${path}.stderr`))) throw Error('Audit process-output hash mismatch')
  }
  const respondentRaw = readFileSync(join(root, `claude-${id}.json`))
  const scorerRaw = readFileSync(join(root, `codex-${id}.json`))
  if (student.response_sha256 !== student.stdout_sha256 || grader.response_sha256 !== hashBytes(scorerRaw) || row.respondent_raw_sha256 !== hashBytes(respondentRaw) || row.scorer_raw_sha256 !== hashBytes(scorerRaw)) throw Error('Audit response hash mismatch')
  const parse = value => JSON.parse(value.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/, '').trim())
  const respondent = JSON.parse(respondentRaw.toString('utf8'))
  const processOutput = JSON.parse(readFileSync(join(root, `audit-student-${id}.json.stdout`), 'utf8'))
  const graderOutput = parse(scorerRaw.toString('utf8'))
  if (respondent.result !== processOutput.result || JSON.stringify(respondent.modelUsage) !== JSON.stringify(processOutput.modelUsage) || !Object.hasOwn(processOutput.modelUsage ?? {}, row.model) || JSON.stringify(parse(respondent.result).answers) !== JSON.stringify(row.answers) || JSON.stringify(graderOutput.scores) !== JSON.stringify(row.scores)) throw Error('Audit scored content mismatch')
  return auditPacket(student, grader)
}

export function verifyAuditRun(root, built = buildF02Synthetic()) {
  const manifest = JSON.parse(readFileSync(join(root, 'audit-run.json'), 'utf8'))
  const summary = JSON.parse(readFileSync(join(root, 'run-summary.json'), 'utf8'))
  const rows = JSON.parse(readFileSync(join(root, 'responses.json'), 'utf8'))
  if (manifest.run_id !== summary.run_id || manifest.seal_sha256 !== built.seal.seal_sha256 || summary.seal_sha256 !== built.seal.seal_sha256 || !Array.isArray(rows) || rows.length !== summary.structurally_scored_rows || summary.planned_packets !== manifest.planned_packets) throw Error('Audit run manifest mismatch')
  const packets = new Map(built.packets.map(packet => [packet.packet_id, packet]))
  const seen = new Set()
  const findings = rows.map(row => {
    if (seen.has(row.packet_id) || !packets.has(row.packet_id)) throw Error('Audit packet missing or duplicated')
    seen.add(row.packet_id)
    return { packet_id: row.packet_id, ...verifyAuditFiles(root, packets.get(row.packet_id), row, built.scoringKey, manifest.run_id) }
  })
  const complete = summary.planned_packets === built.packets.length && rows.length === built.packets.length && summary.errors.length === 0
  const admissible = complete && findings.every(finding => finding.admissible)
  return { run_id: manifest.run_id, planned_packets: summary.planned_packets, structurally_scored_rows: rows.length, errors: summary.errors.length, findings, synthetic_validation_valid_n: admissible ? rows.length : 0, status: admissible ? 'admissible' : 'audit_incomplete' }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2]
  if (!root) throw Error('Usage: node f02-audit.mjs <audit-run-directory>')
  const result = verifyAuditRun(resolve(root))
  console.log(JSON.stringify(result, null, 2))
  if (result.status !== 'admissible') process.exitCode = 1
}
