// scripts/textbook/frym-synthetic/f02-audit-run.mjs
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { analyzeF02Synthetic, buildF02Synthetic } from './f02-synthetic.mjs'
import { SCORER_INSTRUCTION, SCORER_MODEL, STUDENT_COMMAND, STUDENT_INSTRUCTION, STUDENT_MODEL, STUDENT_SYSTEM, scorerCall, smokeHash as sha, studentCall } from './f02-smoke-identity.mjs'
import { auditPacket, beginInvocation, endInvocation } from './f02-audit.mjs'

const [outputDir, limitInput] = process.argv.slice(2)
if (!outputDir || process.platform !== 'win32') throw Error('Usage on Windows: node f02-audit-run.mjs <fresh-exported-packet-dir> [limit 1..28]')
const root = resolve(outputDir)
const built = buildF02Synthetic()
if (JSON.stringify(JSON.parse(readFileSync(join(root, 'seal.json'), 'utf8'))) !== JSON.stringify(built.seal)) throw Error('Synthetic seal changed; export a new packet directory')
const limit = limitInput === undefined ? built.packets.length : Number(limitInput)
if (!Number.isInteger(limit) || limit < 1 || limit > built.packets.length) throw Error('Packet limit must be 1..28')
const runId = randomUUID()
const clientVersion = (command, args) => {
  const useCmd = command.toLowerCase().endsWith('.cmd')
  const result = useCmd ? spawnSync('cmd.exe', ['/d', '/s', '/c', `${command} ${args.join(' ')}`], { encoding: 'utf8', windowsVerbatimArguments: true }) : spawnSync(command, args, { encoding: 'utf8' })
  if (result.status !== 0) throw Error(`${command} version unavailable`)
  return (result.stdout || result.stderr).trim()
}
const exportNames = new Set(['seal.json', ...built.packets.map(packet => `${packet.packet_id}.json`)])
if (readdirSync(root).some(name => !exportNames.has(name))) throw Error('Audit run requires a fresh export directory without prior audit or output files')
const studentClientVersion = clientVersion('claude.cmd', ['-v'])
const graderClientVersion = clientVersion('codex', ['-V'])
writeFileSync(join(root, 'audit-run.json'), JSON.stringify({ run_id: runId, seal_sha256: built.seal.seal_sha256, planned_packets: limit, student_client_version: studentClientVersion, grader_client_version: graderClientVersion, status: 'running' }, null, 2))
const studentCwd = join(root, 'student-isolated')
const scorerCwd = join(root, 'scorer-isolated')
mkdirSync(studentCwd, { recursive: true })
mkdirSync(scorerCwd, { recursive: true })
const stripFence = value => value.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/, '').trim()
const parseResult = value => JSON.parse(stripFence(value))
const run = (command, args, cwd, input, audit, auditPath, responsePath, options = {}) => new Promise((resolve, reject) => {
  writeFileSync(auditPath, JSON.stringify(audit, null, 2))
  const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], ...options })
  let stdout = '', stderr = ''
  let timedOut = false, spawnError = null, stdinError = null
  const timer = setTimeout(() => {
    timedOut = true
    const killer = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, encoding: 'utf8' })
    if (killer.status !== 0) child.kill()
  }, 120000)
  child.stdout.setEncoding('utf8').on('data', chunk => stdout += chunk)
  child.stderr.setEncoding('utf8').on('data', chunk => stderr += chunk)
  child.on('error', error => {
    spawnError = error
  })
  child.stdin.on('error', error => {
    stdinError = error
  })
  child.on('close', (code, signal) => {
    clearTimeout(timer)
    writeFileSync(`${auditPath}.stdout`, stdout)
    writeFileSync(`${auditPath}.stderr`, stderr)
    const response = responsePath && existsSync(responsePath) ? readFileSync(responsePath) : stdout
    const recorded = endInvocation(audit, { pid: child.pid ?? null, code, signal, stdout, stderr, response, errorReason: spawnError ? String(spawnError) : stdinError ? String(stdinError) : timedOut ? 'TIMEOUT' : code ? `EXIT_${code}` : null, modelObserved: null, endedAt: new Date().toISOString() })
    writeFileSync(auditPath, JSON.stringify(recorded, null, 2))
    if (spawnError || stdinError || timedOut || code || signal) reject(new Error(`${command} exited ${code ?? signal}: ${spawnError ?? stdinError ?? ''} ${stderr.slice(-500)} ${stdout.slice(-500)}`))
    else resolve({ stdout, stderr })
  })
  try { child.stdin.end(Buffer.from(input, 'utf8')) } catch (error) { stdinError = error }
})
const rows = []
const errors = []
const packets = built.packets.slice(0, limit)
writeFileSync(join(root, 'responses.json'), '[]')
writeFileSync(join(root, 'run-summary.json'), JSON.stringify({ status: 'running', seal_sha256: built.seal.seal_sha256, planned_packets: packets.length }))
for (const packet of packets) {
  const rawPath = join(root, `claude-${packet.packet_id}.json`)
  const scorePath = join(root, `codex-${packet.packet_id}.json`)
  const student = studentCall(packet)
  try {
    if (JSON.stringify(JSON.parse(readFileSync(join(root, `${packet.packet_id}.json`), 'utf8'))) !== JSON.stringify({ packet_id: packet.packet_id, ...packet.body })) throw Error(`Blind packet ${packet.packet_id} changed`)
    let outer
    if (existsSync(rawPath)) throw Error('Audit run refuses cached student output')
    else {
      const studentAuditPath = join(root, `audit-student-${packet.packet_id}.json`)
      const studentAudit = beginInvocation({ runId, packetId: packet.packet_id, role: 'student', command: 'cmd.exe', args: ['/d', '/s', '/c', STUDENT_COMMAND], cwd: studentCwd, stdin: student.prompt, system: STUDENT_SYSTEM, profile: packet.body.profile, payload: { passage: packet.body.passage, questions: packet.body.questions }, modelRequested: STUDENT_MODEL, clientVersion: studentClientVersion, startedAt: new Date().toISOString() })
      const result = await run('cmd.exe', ['/d', '/s', '/c', STUDENT_COMMAND], studentCwd, student.prompt, studentAudit, studentAuditPath, null, { windowsVerbatimArguments: true })
      outer = { ...JSON.parse(result.stdout), prompt_sha256: student.prompt_sha256, invocation_sha256: student.invocation_sha256 }
      writeFileSync(rawPath, JSON.stringify(outer, null, 2))
      const recorded = JSON.parse(readFileSync(studentAuditPath, 'utf8'))
      recorded.model_observed = Object.keys(outer.modelUsage ?? {})[0] ?? null
      writeFileSync(studentAuditPath, JSON.stringify(recorded, null, 2))
    }
    if (outer.prompt_sha256 !== student.prompt_sha256 || outer.invocation_sha256 !== student.invocation_sha256) throw Error('Student invocation changed after response')
    const answer = parseResult(outer.result)
    const ids = packet.body.questions.map(question => question.id)
    if (!Array.isArray(answer.answers) || answer.answers.length !== ids.length || ids.some((id, i) => answer.answers[i]?.id !== id || typeof answer.answers[i]?.answer !== 'string' || !answer.answers[i].answer.trim())) throw Error('Claude answers invalid')
    const model = Object.keys(outer.modelUsage ?? {})[0]
    if (model !== STUDENT_MODEL) throw Error('Claude model provenance changed')
    const scorer = scorerCall(packet, answer.answers, built.scoringKey)
    const scorerPromptHashPath = join(root, `codex-prompt-hash-${packet.packet_id}.txt`)
    const scorerArgs = ['exec', '-s', 'read-only', '--skip-git-repo-check', '-m', SCORER_MODEL, '-o', scorePath, '-']
    let scores
    if (existsSync(scorePath)) throw Error('Audit run refuses cached grader output')
    else {
      const graderAuditPath = join(root, `audit-grader-${packet.packet_id}.json`)
      const graderAudit = beginInvocation({ runId, packetId: packet.packet_id, role: 'grader', command: 'codex', args: scorerArgs, cwd: scorerCwd, stdin: scorer.prompt, system: null, profile: packet.body.profile, payload: { passage: packet.body.passage, questions: packet.body.questions, answers: answer.answers, rubrics: built.scoringKey[packet.passage_variant] }, modelRequested: SCORER_MODEL, clientVersion: graderClientVersion, startedAt: new Date().toISOString() })
      await run('codex', scorerArgs, scorerCwd, scorer.prompt, graderAudit, graderAuditPath, scorePath)
      scores = parseResult(readFileSync(scorePath, 'utf8'))
      writeFileSync(scorerPromptHashPath, scorer.invocation_sha256)
    }
    if (!Array.isArray(scores.scores) || scores.scores.length !== ids.length || ids.some((id, i) => scores.scores[i]?.id !== id || ![0, 0.5, 1].includes(scores.scores[i]?.score))) throw Error('Codex scores invalid')
    const audit = auditPacket(JSON.parse(readFileSync(join(root, `audit-student-${packet.packet_id}.json`), 'utf8')), JSON.parse(readFileSync(join(root, `audit-grader-${packet.packet_id}.json`), 'utf8')))
    rows.push({ run_id: runId, packet_id: packet.packet_id, model, model_family: 'anthropic', scorer_model: SCORER_MODEL, scorer_family: 'openai', replica_id: 'r1', scoring_key_hash: built.seal.scoring_key_hash, student_prompt_sha256: student.prompt_sha256, scorer_prompt_sha256: scorer.prompt_sha256, student_invocation_sha256: student.invocation_sha256, scorer_invocation_sha256: scorer.invocation_sha256, respondent_raw_sha256: sha(readFileSync(rawPath)), scorer_raw_sha256: sha(readFileSync(scorePath)), audit_status: audit, answers: answer.answers, scores: scores.scores })
    writeFileSync(join(root, 'responses.json'), JSON.stringify(rows, null, 2))
    process.stdout.write(`OK ${rows.length}/${packets.length} ${packet.profile_id} ${packet.passage_variant} total=${scores.scores.reduce((sum, item) => sum + item.score, 0)}\n`)
  } catch (error) {
    const graderAuditPath = join(root, `audit-grader-${packet.packet_id}.json`)
    const failedAuditPath = existsSync(graderAuditPath) ? graderAuditPath : join(root, `audit-student-${packet.packet_id}.json`)
    if (existsSync(failedAuditPath)) {
      const recorded = JSON.parse(readFileSync(failedAuditPath, 'utf8'))
      recorded.status = 'failed'
      recorded.error_reason = String(error)
      writeFileSync(failedAuditPath, JSON.stringify(recorded, null, 2))
    }
    errors.push({ packet_id: packet.packet_id, profile_id: packet.profile_id, passage_variant: packet.passage_variant, error: String(error) })
    process.stderr.write(`FAIL ${packet.profile_id} ${packet.passage_variant}: ${String(error).slice(0, 300)}\n`)
  }
}
const analysis = analyzeF02Synthetic(rows, built)
writeFileSync(join(root, 'run-summary.json'), JSON.stringify({ status: 'audit_incomplete', run_id: runId, execution_profile: 'process_audit_v3', seal_sha256: built.seal.seal_sha256, planned_packets: packets.length, structurally_scored_rows: rows.length, synthetic_validation_valid_n: 0, errors, student_system_sha256: sha(STUDENT_SYSTEM), student_instruction_sha256: sha(STUDENT_INSTRUCTION), student_command_sha256: sha(STUDENT_COMMAND), scorer_instruction_sha256: sha(SCORER_INSTRUCTION), analysis_status: analysis.status }, null, 2))
writeFileSync(join(root, 'audit-run.json'), JSON.stringify({ run_id: runId, seal_sha256: built.seal.seal_sha256, planned_packets: limit, student_client_version: studentClientVersion, grader_client_version: graderClientVersion, status: 'audit_incomplete', structurally_scored_rows: rows.length, errors: errors.length, provider_attestation: 'unavailable_from_cli', synthetic_validation_valid_n: 0 }, null, 2))
if (errors.length || rows.length !== packets.length || rows.some(row => !row.audit_status.admissible)) process.exitCode = 1
