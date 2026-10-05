// scripts/textbook/frym-synthetic/f02-smoke-run.mjs
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { analyzeF02Synthetic, buildF02Synthetic } from './f02-synthetic.mjs'

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
const studentSystem = 'Use only the current user message. Do not use tools, files, prior conversation, or external context. Return strict JSON without code fences.'
const studentInstruction = 'Use only this packet. Respond as the constrained reader described by the profile. Do not use external knowledge, tools or files. Answer all questions in order. Return only valid JSON object {"answers":[{"id":"...","answer":"..."}]}. '
const scorerInstruction = 'You are an independent blind scorer. Score each response using the supplied rubric, 0, 0.5, or 1. Return only valid JSON object {"scores":[{"id":"...","score":0.5}]} in question order. Do not use tools. '
const sha = text => createHash('sha256').update(text).digest('hex')
const stripFence = value => value.trim().replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/, '').trim()
const parseResult = value => JSON.parse(stripFence(value))
const run = (command, args, cwd, input) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
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
for (const packet of packets) {
  if (JSON.stringify(JSON.parse(readFileSync(join(root, `${packet.packet_id}.json`), 'utf8'))) !== JSON.stringify({ packet_id: packet.packet_id, ...packet.body })) throw Error(`Blind packet ${packet.packet_id} changed`)
  const rawPath = join(root, `claude-${packet.packet_id}.json`)
  const scorePath = join(root, `codex-${packet.packet_id}.json`)
  const studentPayload = { profile: packet.body.profile, passage: packet.body.passage, questions: packet.body.questions }
  const studentPrompt = studentInstruction + JSON.stringify(studentPayload)
  try {
    let outer
    if (existsSync(rawPath)) outer = JSON.parse(readFileSync(rawPath, 'utf8'))
    else {
      const result = await run('cmd.exe', ['/d', '/s', '/c', `claude.cmd -p --model haiku --effort low --restricted --strict-mcp-config --system-prompt "${studentSystem}" --output-format json --no-session-persistence`], studentCwd, studentPrompt)
      outer = { ...JSON.parse(result.stdout), prompt_sha256: sha(studentPrompt) }
      writeFileSync(rawPath, JSON.stringify(outer, null, 2))
    }
    if (outer.prompt_sha256 !== sha(studentPrompt)) throw Error('Student prompt changed after response')
    const answer = parseResult(outer.result)
    const ids = packet.body.questions.map(question => question.id)
    if (!Array.isArray(answer.answers) || answer.answers.length !== ids.length || ids.some((id, i) => answer.answers[i]?.id !== id || typeof answer.answers[i]?.answer !== 'string' || !answer.answers[i].answer.trim())) throw Error('Claude answers invalid')
    const model = Object.keys(outer.modelUsage ?? {})[0]
    if (!model?.startsWith('claude-')) throw Error('Claude model provenance missing')
    const gradeKey = built.scoringKey[packet.passage_variant]
    const scorerPayload = { passage: packet.body.passage, questions: packet.body.questions, answers: answer.answers, rubrics: gradeKey, general_rule: built.scoringKey.general_rule }
    const scorerPrompt = scorerInstruction + JSON.stringify(scorerPayload)
    const scorerPromptHashPath = join(root, `codex-prompt-hash-${packet.packet_id}.txt`)
    let scores
    if (existsSync(scorePath)) {
      if (!existsSync(scorerPromptHashPath) || readFileSync(scorerPromptHashPath, 'utf8') !== sha(scorerPrompt)) throw Error('Scorer prompt changed after scoring')
      scores = parseResult(readFileSync(scorePath, 'utf8'))
    }
    else {
      await run('codex', ['exec', '-s', 'read-only', '--skip-git-repo-check', '-m', 'gpt-6.1-sol', '-o', scorePath, '-'], scorerCwd, scorerPrompt)
      scores = parseResult(readFileSync(scorePath, 'utf8'))
      writeFileSync(scorerPromptHashPath, sha(scorerPrompt))
    }
    if (!Array.isArray(scores.scores) || scores.scores.length !== ids.length || ids.some((id, i) => scores.scores[i]?.id !== id || ![0, 0.5, 1].includes(scores.scores[i]?.score))) throw Error('Codex scores invalid')
    rows.push({ packet_id: packet.packet_id, model, model_family: 'anthropic', scorer_model: 'gpt-6.1-sol', scorer_family: 'openai', replica_id: 'r1', scoring_key_hash: built.seal.scoring_key_hash, student_prompt_sha256: sha(studentPrompt), scorer_prompt_sha256: sha(scorerPrompt), respondent_raw_sha256: sha(readFileSync(rawPath)), scorer_raw_sha256: sha(readFileSync(scorePath)), answers: answer.answers, scores: scores.scores })
    writeFileSync(join(root, 'responses.json'), JSON.stringify(rows, null, 2))
    process.stdout.write(`OK ${rows.length}/${packets.length} ${packet.profile_id} ${packet.passage_variant} total=${scores.scores.reduce((sum, item) => sum + item.score, 0)}\n`)
  } catch (error) {
    errors.push({ packet_id: packet.packet_id, profile_id: packet.profile_id, passage_variant: packet.passage_variant, error: String(error) })
    process.stderr.write(`FAIL ${packet.profile_id} ${packet.passage_variant}: ${String(error).slice(0, 300)}\n`)
  }
}
const analysis = analyzeF02Synthetic(rows, built)
writeFileSync(join(root, 'run-summary.json'), JSON.stringify({ seal_sha256: built.seal.seal_sha256, planned_packets: packets.length, valid_rows: rows.length, errors, student_system_sha256: sha(studentSystem), student_instruction_sha256: sha(studentInstruction), scorer_instruction_sha256: sha(scorerInstruction), analysis_status: analysis.status }, null, 2))
if (errors.length) process.exitCode = 1
