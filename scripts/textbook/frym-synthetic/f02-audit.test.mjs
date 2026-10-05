// scripts/textbook/frym-synthetic/f02-audit.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditPacket, beginInvocation, endInvocation, hashBytes, verifyAuditFiles } from './f02-audit.mjs'
import { buildF02Synthetic } from './f02-synthetic.mjs'
import { SCORER_MODEL, STUDENT_MODEL, STUDENT_SYSTEM, scorerCall, studentCall } from './f02-smoke-identity.mjs'

const start = (role, id, time) => beginInvocation({ runId: 'fresh-run', packetId: 'packet', role, command: role === 'student' ? 'cmd.exe' : 'codex', args: ['--model', role === 'student' ? 'claude' : 'codex'], cwd: '/isolated', stdin: 'request', system: role === 'student' ? 'system' : null, profile: { grade: 'middle_1' }, payload: { passage: 'text' }, modelRequested: role === 'student' ? 'claude' : 'codex', clientVersion: '1.0', startedAt: time })
const finish = (record, pid, time) => endInvocation(record, { pid, code: 0, signal: null, stdout: 'output', stderr: '', response: 'response', errorReason: null, modelObserved: record.model_requested, endedAt: time })

test('invocation audit binds request, process, output and independent identities', () => {
  const student = finish(start('student', 'a', '2026-10-05T00:00:00Z'), 101, '2026-10-05T00:00:01Z')
  const grader = finish(start('grader', 'b', '2026-10-05T00:00:02Z'), 102, '2026-10-05T00:00:03Z')
  assert.equal(student.stdin_sha256, hashBytes('request'))
  assert.equal(student.system_sha256, hashBytes('system'))
  assert.equal(student.stdout_sha256, hashBytes('output'))
  assert.notEqual(student.invocation_id, grader.invocation_id)
  assert.deepEqual(auditPacket(student, grader), { admissible: false, reason: 'PROVIDER_REQUEST_UNATTESTED' })
  assert.deepEqual(auditPacket({ ...student, provider_request_attested: true }, { ...grader, provider_request_attested: true }), { admissible: false, reason: 'PROVIDER_REQUEST_UNATTESTED' })
  assert.equal(auditPacket(student, { ...grader, pid: 101 }).admissible, false)
  assert.equal(auditPacket(student, { ...grader, started_at: '2026-10-04T23:59:59Z' }).admissible, false)
  assert.equal(auditPacket(student, { ...grader, model_observed: null }).admissible, false)
  assert.equal(auditPacket({ ...student, status: 'failed' }, grader).admissible, false)
})

test('audit verifier rejects a changed raw process output', () => {
  const root = mkdtempSync(join(tmpdir(), 'f02-audit-test-'))
  try {
    const built = buildF02Synthetic(), packet = built.packets[0]
    const answers = packet.body.questions.map(question => ({ id: question.id, answer: 'sample' }))
    const scores = packet.body.questions.map(question => ({ id: question.id, score: 1 }))
    const studentOutput = JSON.stringify({ result: JSON.stringify({ answers }), modelUsage: { [STUDENT_MODEL]: 1 } })
    const scoreOutput = JSON.stringify({ scores })
    const row = { run_id: 'run', packet_id: packet.packet_id, model: STUDENT_MODEL, answers, scores, respondent_raw_sha256: hashBytes(studentOutput), scorer_raw_sha256: hashBytes(scoreOutput) }
    const student = endInvocation(beginInvocation({ runId: 'run', packetId: packet.packet_id, role: 'student', command: 'cmd.exe', args: [], cwd: root, stdin: studentCall(packet).prompt, system: STUDENT_SYSTEM, profile: packet.body.profile, payload: { passage: packet.body.passage, questions: packet.body.questions }, modelRequested: STUDENT_MODEL, clientVersion: '1', startedAt: '2026-10-05T00:00:00Z' }), { pid: 1, code: 0, signal: null, stdout: studentOutput, stderr: '', response: studentOutput, errorReason: null, modelObserved: STUDENT_MODEL, endedAt: '2026-10-05T00:00:01Z' })
    const grader = endInvocation(beginInvocation({ runId: 'run', packetId: packet.packet_id, role: 'grader', command: 'codex', args: [], cwd: root, stdin: scorerCall(packet, answers, built.scoringKey).prompt, system: null, profile: packet.body.profile, payload: {}, modelRequested: SCORER_MODEL, clientVersion: '1', startedAt: '2026-10-05T00:00:02Z' }), { pid: 2, code: 0, signal: null, stdout: 'grader log', stderr: '', response: scoreOutput, errorReason: null, modelObserved: null, endedAt: '2026-10-05T00:00:03Z' })
    for (const [role, record, stdout] of [['student', student, studentOutput], ['grader', grader, 'grader log']]) {
      const path = join(root, `audit-${role}-${packet.packet_id}.json`)
      writeFileSync(path, JSON.stringify(record))
      writeFileSync(`${path}.stdout`, stdout)
      writeFileSync(`${path}.stderr`, '')
    }
    writeFileSync(join(root, `claude-${packet.packet_id}.json`), studentOutput)
    writeFileSync(join(root, `codex-${packet.packet_id}.json`), scoreOutput)
    assert.equal(verifyAuditFiles(root, packet, row, built.scoringKey, 'run').reason, 'MODEL_IDENTITY_UNATTESTED')
    assert.throws(() => verifyAuditFiles(root, packet, { ...row, run_id: 'other' }, built.scoringKey, 'run'), /request binding mismatch/)
    assert.throws(() => verifyAuditFiles(root, packet, { ...row, scores: scores.map(score => ({ ...score, score: 0 })) }, built.scoringKey, 'run'), /scored content mismatch/)
    const alteredOutput = JSON.stringify({ result: JSON.stringify({ answers: answers.map(answer => ({ ...answer, answer: 'altered' })) }), modelUsage: { [STUDENT_MODEL]: 1 } })
    writeFileSync(join(root, `claude-${packet.packet_id}.json`), alteredOutput)
    assert.throws(() => verifyAuditFiles(root, packet, { ...row, respondent_raw_sha256: hashBytes(alteredOutput) }, built.scoringKey, 'run'), /scored content mismatch/)
    writeFileSync(join(root, `claude-${packet.packet_id}.json`), studentOutput)
    writeFileSync(join(root, `audit-student-${packet.packet_id}.json.stdout`), 'changed')
    assert.throws(() => verifyAuditFiles(root, packet, row, built.scoringKey, 'run'), /process-output hash mismatch/)
  } finally {
    const absoluteRoot = realpathSync(root)
    assert.ok(absoluteRoot.startsWith(`${realpathSync(tmpdir())}${sep}`))
    rmSync(absoluteRoot, { recursive: true, force: true })
  }
})

test('audit runner refuses a directory containing prior audit records', { skip: process.platform !== 'win32' }, () => {
  const root = mkdtempSync(join(tmpdir(), 'f02-audit-stale-'))
  const target = join(root, 'export')
  try {
    const exporter = fileURLToPath(new URL('./f02-synthetic.mjs', import.meta.url))
    const runner = fileURLToPath(new URL('./f02-audit-run.mjs', import.meta.url))
    assert.equal(spawnSync(process.execPath, [exporter, 'export', target], { encoding: 'utf8' }).status, 0)
    writeFileSync(join(target, 'audit-run.json'), '{}')
    const result = spawnSync(process.execPath, [runner, target, '1'], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /fresh export directory/)
  } finally {
    const absoluteRoot = realpathSync(root)
    assert.ok(absoluteRoot.startsWith(`${realpathSync(tmpdir())}${sep}`))
    rmSync(absoluteRoot, { recursive: true, force: true })
  }
})
