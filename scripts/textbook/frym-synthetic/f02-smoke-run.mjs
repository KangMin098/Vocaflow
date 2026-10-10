// scripts/textbook/frym-synthetic/f02-smoke-run.mjs
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { analyzeF02Synthetic, buildF02Synthetic } from './f02-synthetic.mjs'
import { SCORER_INSTRUCTION, SCORER_MODEL, STUDENT_COMMAND, STUDENT_INSTRUCTION, STUDENT_MODEL, STUDENT_SYSTEM, scorerCall, smokeHash as sha, studentCall } from './f02-smoke-identity.mjs'

const [outputDir, limitInput] = process.argv.slice(2)
if (!outputDir || process.platform !== 'win32') throw Error('Usage on Windows: node f02-smoke-run.mjs <exported-packet-dir> [limit 1..28]')
const root = resolve(outputDir)
const built = buildF02Synthetic()
if (JSON.stringify(JSON.parse(readFileSync(join(root, 'seal.json'), 'utf8'))) !== JSON.stringify(built.seal)) throw Error('Synthetic seal changed; export a new packet directory')
const limit = limitInput === undefined ? built.packets.length : Number(limitInput)
if (!Number.isInteger(limit) || limit < 1 || limit > built.packets.length) throw Error('Packet limit must be 1..28')
const studentCwd = join(root, 'student-isolated')
const scorerCwd = join(root, 'scorer-isolated')
mkdirSync(studentCwd, { recursive: true })
mkdirSync(scorerCwd, { recursive: true })
const stripFence = value => value.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/, '').trim()
const parseResult = value => JSON.parse(stripFence(value))
const run = (command, args, cwd, input, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], ...options })
  let stdout = '', stderr = ''
  const timer = setTimeout(() => child.kill(), 120000)
  child.stdout.setEncoding('utf8').on('data', chunk => stdout += chunk)
  child.stderr.setEncoding('utf8').on('data', chunk => stderr += chunk)
  child.on('error', reject)
  child.on('exit', code => {
    clearTimeout(timer)
    if (code) reject(new Error(`${command} exited ${code}: ${stderr.slice(-500)} ${stdout.slice(-500)}`))
    else resolve({ stdout, stderr })
  })
  child.stdin.end(Buffer.from(input, 'utf8'))
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
    if (existsSync(rawPath)) outer = JSON.parse(readFileSync(rawPath, 'utf8'))
    else {
      const result = await run('cmd.exe', ['/d', '/s', '/c', STUDENT_COMMAND], studentCwd, student.prompt, { windowsVerbatimArguments: true })
      outer = { ...JSON.parse(result.stdout), prompt_sha256: student.prompt_sha256, invocation_sha256: student.invocation_sha256 }
      writeFileSync(rawPath, JSON.stringify(outer, null, 2))
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
    if (existsSync(scorePath)) {
      if (!existsSync(scorerPromptHashPath) || readFileSync(scorerPromptHashPath, 'utf8') !== scorer.invocation_sha256) throw Error('Scorer invocation changed after scoring')
      scores = parseResult(readFileSync(scorePath, 'utf8'))
    }
    else {
      await run('codex', scorerArgs, scorerCwd, scorer.prompt)
      scores = parseResult(readFileSync(scorePath, 'utf8'))
      writeFileSync(scorerPromptHashPath, scorer.invocation_sha256)
    }
    if (!Array.isArray(scores.scores) || scores.scores.length !== ids.length || ids.some((id, i) => scores.scores[i]?.id !== id || ![0, 0.5, 1].includes(scores.scores[i]?.score))) throw Error('Codex scores invalid')
    rows.push({ packet_id: packet.packet_id, model, model_family: 'anthropic', scorer_model: SCORER_MODEL, scorer_family: 'openai', replica_id: 'r1', scoring_key_hash: built.seal.scoring_key_hash, student_prompt_sha256: student.prompt_sha256, scorer_prompt_sha256: scorer.prompt_sha256, student_invocation_sha256: student.invocation_sha256, scorer_invocation_sha256: scorer.invocation_sha256, respondent_raw_sha256: sha(readFileSync(rawPath)), scorer_raw_sha256: sha(readFileSync(scorePath)), answers: answer.answers, scores: scores.scores })
    writeFileSync(join(root, 'responses.json'), JSON.stringify(rows, null, 2))
    process.stdout.write(`OK ${rows.length}/${packets.length} ${packet.profile_id} ${packet.passage_variant} total=${scores.scores.reduce((sum, item) => sum + item.score, 0)}\n`)
  } catch (error) {
    errors.push({ packet_id: packet.packet_id, profile_id: packet.profile_id, passage_variant: packet.passage_variant, error: String(error) })
    process.stderr.write(`FAIL ${packet.profile_id} ${packet.passage_variant}: ${String(error).slice(0, 300)}\n`)
  }
}
const analysis = analyzeF02Synthetic(rows, built)
writeFileSync(join(root, 'run-summary.json'), JSON.stringify({ status: 'completed', execution_profile: 'windows_verbatim_v2', seal_sha256: built.seal.seal_sha256, planned_packets: packets.length, valid_rows: rows.length, errors, student_system_sha256: sha(STUDENT_SYSTEM), student_instruction_sha256: sha(STUDENT_INSTRUCTION), student_command_sha256: sha(STUDENT_COMMAND), scorer_instruction_sha256: sha(SCORER_INSTRUCTION), analysis_status: analysis.status }, null, 2))
if (errors.length) process.exitCode = 1
