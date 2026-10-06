// scripts/textbook/frym-synthetic/f02-cross-agent.mjs
import { createHash, randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyzeF02Synthetic, buildF02Synthetic } from './f02-synthetic.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')
const json = value => JSON.stringify(value)
const studentSystem = 'Use only the supplied packet. Do not use tools, files, prior conversation, or outside facts. Simulate only the stated reading capacities. Return a JSON object with answers in question order.'
const graderSystem = 'Independently grade the candidate answers against the supplied rubric. Do not use tools or outside facts. Return a JSON object with scores in question order. Every score must be exactly 0, 0.5, or 1; use 0 for missing or unsupported evidence. Never return null.'
const model = { claude: 'claude-haiku-4-5-20251001', codex: 'gpt-6.1-sol' }
const family = { claude: 'anthropic', codex: 'openai' }
function findClaudeExecutable() {
  const configured = process.env.F02_CLAUDE_EXECUTABLE
  if (configured) {
    const path = resolve(configured)
    if (!existsSync(path)) throw Error('F02_CLAUDE_EXECUTABLE unavailable')
    return path
  }
  if (process.platform !== 'win32') return 'claude'
  const locate = name => {
    const result = spawnSync('where.exe', [name], { encoding: 'utf8', windowsHide: true })
    return result.status === 0 ? result.stdout.split(/\r?\n/).map(path => path.trim()).find(path => path && existsSync(path)) : null
  }
  const native = locate('claude.exe')
  if (native) return native
  const wrapper = locate('claude.cmd')
  const npmNative = wrapper && join(dirname(wrapper), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
  if (npmNative && existsSync(npmNative)) return npmNative
  throw Error('Claude Code executable unavailable')
}
let cachedClaudeExecutable
const claudeExecutable = () => cachedClaudeExecutable ??= findClaudeExecutable()
function findCodexLaunch() {
  if (process.platform !== 'win32') return { command: 'codex', prefix: [] }
  const locate = name => {
    const result = spawnSync('where.exe', [name], { encoding: 'utf8', windowsHide: true })
    return result.status === 0 ? result.stdout.split(/\r?\n/).map(path => path.trim()).find(path => path && existsSync(path)) : null
  }
  if (locate('codex.exe')) return { command: 'codex', prefix: [] }
  const wrapper = locate('codex.cmd')
  if (!wrapper) throw Error('Codex CLI executable unavailable')
  const packageRoot = join(dirname(wrapper), 'node_modules', '@openai', 'codex')
  const findNative = (folder, depth) => {
    if (depth < 0 || !existsSync(folder)) return null
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name)
      if (entry.isFile() && entry.name.toLowerCase() === 'codex.exe') return path
      if (entry.isDirectory()) {
        const found = findNative(path, depth - 1)
        if (found) return found
      }
    }
    return null
  }
  const native = findNative(packageRoot, 5)
  if (native) return { command: native, prefix: [] }
  const js = join(packageRoot, 'bin', 'codex.js')
  if (existsSync(js)) return { command: process.execPath, prefix: [js] }
  throw Error('Codex CLI native package unavailable')
}
let cachedCodexLaunch
const codexLaunch = () => cachedCodexLaunch ??= findCodexLaunch()
const codexHome = resolve(process.env.CODEX_HOME ?? join(homedir(), '.codex'))
function globalInstructionInventory() {
  const override = join(codexHome, 'AGENTS.override.md')
  const active = existsSync(override) ? 'AGENTS.override.md' : existsSync(join(codexHome, 'AGENTS.md')) ? 'AGENTS.md' : null
  return ['AGENTS.override.md', 'AGENTS.md'].filter(name => existsSync(join(codexHome, name))).map(name => ({ name, path: join(codexHome, name), active: name === active, sha256: sha(readFileSync(join(codexHome, name))) }))
}
const answerSchema = { type: 'object', properties: { answers: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, answer: { type: 'string' } }, required: ['id', 'answer'], additionalProperties: false } } }, required: ['answers'], additionalProperties: false }
const scoreSchema = { type: 'object', properties: { scores: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, score: { type: 'number', enum: [0, 0.5, 1] } }, required: ['id', 'score'], additionalProperties: false } } }, required: ['scores'], additionalProperties: false }

export const evidencePolicy = Object.freeze({ synthetic_minimum: 'E3', gold_s_minimum: 'E4', provider_attested: false })

export function requestFor(packet, role, answers, scoringKey) {
  if (role === 'student') return {
    system: studentSystem,
    stdin: json({ instruction: 'Answer as the constrained reader. Use available capacities only. Return {"answers":[{"id":"...","answer":"..."}]}.', profile: packet.body.profile, passage: packet.body.passage, questions: packet.body.questions })
  }
  if (role === 'grader' && Array.isArray(answers)) return {
    system: graderSystem,
    stdin: json({ instruction: 'Return {"scores":[{"id":"...","score":0}]} in question order. Each score must be 0, 0.5, or 1, never null. If an answer has no supported basis, give 0.', passage: packet.body.passage, questions: packet.body.questions, answers, rubrics: scoringKey[packet.passage_variant], general_rule: scoringKey.general_rule })
  }
  throw Error('Invalid blind role')
}
function effectiveStdin(engine, request) {
  return engine === 'codex' ? `INSTRUCTIONS\n${request.system}\n\nPACKET\n${request.stdin}` : request.stdin
}

function stripFence(value) { return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim() }
export function parseAnswers(text, packet) {
  const parsed = JSON.parse(stripFence(text))
  const ids = packet.body.questions.map(question => question.id)
  if (!Array.isArray(parsed.answers) || parsed.answers.length !== ids.length || ids.some((id, i) => parsed.answers[i]?.id !== id || typeof parsed.answers[i]?.answer !== 'string' || !parsed.answers[i].answer.trim() || json(Object.keys(parsed.answers[i]).sort()) !== json(['answer', 'id']))) throw Error('STUDENT_ANSWERS_INVALID')
  return parsed.answers.map(({ id, answer }) => ({ id, answer }))
}
function parseScores(text, packet) {
  const parsed = JSON.parse(stripFence(text))
  const ids = packet.body.questions.map(question => question.id)
  if (!Array.isArray(parsed.scores) || parsed.scores.length !== ids.length || ids.some((id, i) => parsed.scores[i]?.id !== id || ![0, 0.5, 1].includes(parsed.scores[i]?.score))) throw Error('GRADER_SCORES_INVALID')
  return parsed.scores
}
function versionOf(engine) {
  const launch = engine === 'claude' ? { command: claudeExecutable(), prefix: [] } : codexLaunch()
  const spec = [launch.command, [...launch.prefix, '--version']]
  const call = spawnSync(spec[0], spec[1], { encoding: 'utf8', windowsHide: true })
  if (call.status !== 0) throw Error(`${engine} CLI unavailable`)
  return (call.stdout || call.stderr).trim()
}
function cliSpec(engine, role, cwd, outputPath, system) {
  if (engine === 'claude') {
    const schema = role === 'student' ? answerSchema : scoreSchema
    const args = ['-p', '--model', model.claude, '--effort', 'low', '--safe-mode', '--restricted', '--strict-mcp-config', '--tools', '', '--system-prompt', system, '--json-schema', json(schema), '--output-format', 'json', '--no-session-persistence']
    return { command: claudeExecutable(), argv: args, options: {}, cwd }
  }
  const launch = codexLaunch()
  return { command: launch.command, argv: [...launch.prefix, 'exec', '--json', '--ephemeral', '--ignore-user-config', '-s', 'read-only', '--skip-git-repo-check', '-c', 'project_doc_max_bytes=0', '-m', model.codex, '-o', outputPath, '-'], options: {}, cwd }
}
function assertIsolatedCwd(cwd) {
  if (!resolve(cwd).startsWith(resolve(tmpdir()) + sep)) throw Error('CWD_NOT_ISOLATED')
  for (let path = cwd; path !== dirname(path); path = dirname(path)) {
    if (['AGENTS.md', 'AGENTS.override.md', 'CLAUDE.md'].some(name => existsSync(join(path, name)))) throw Error('CWD_INSTRUCTIONS_PRESENT')
  }
}
function decode(engine, stdout, outputPath) {
  if (engine === 'claude') {
    const record = JSON.parse(stdout.toString('utf8'))
    if (record.type !== 'result' || record.subtype !== 'success' || record.terminal_reason !== 'completed' || record.is_error !== false || typeof record.result !== 'string') throw Error('CLAUDE_TERMINAL_INCOMPLETE')
    const observed = Object.keys(record.modelUsage ?? {})[0] ?? null
    const remoteTools = Object.values(record.usage?.server_tool_use ?? {}).some(value => Number(value) > 0)
    return { text: record.structured_output ? json(record.structured_output) : record.result, session_id: record.session_id ?? null, observed_model: observed, refusal: record.is_error === true, tool_used: remoteTools || (record.subagent_stats?.spawned ?? 0) > 0 || (record.permission_denials?.length ?? 0) > 0 }
  }
  const events = stdout.toString('utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
  const threadIndex = events.findIndex(event => event.type === 'thread.started')
  const startIndex = events.findIndex(event => event.type === 'turn.started')
  const messageIndex = events.findLastIndex(event => event.type === 'item.completed' && event.item?.type === 'agent_message')
  const completeIndex = events.findLastIndex(event => event.type === 'turn.completed')
  if (threadIndex < 0 || startIndex <= threadIndex || messageIndex <= startIndex || completeIndex <= messageIndex || completeIndex !== events.length - 1) throw Error('TURN_TERMINAL_MISSING')
  const session = events[threadIndex].thread_id ?? null
  const error = events.find(event => event.type === 'error' || event.type === 'turn.failed')
  const toolUsed = events.some(event => event.type?.startsWith('item.') && !['agent_message', 'reasoning'].includes(event.item?.type))
  const message = events[messageIndex]?.item?.text ?? null
  const final = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : null
  if (!message || !final || message.trim() !== final.trim()) throw Error('FINAL_STDOUT_MISMATCH')
  return { text: message, session_id: session, observed_model: null, refusal: Boolean(error), tool_used: toolUsed }
}
function callCli(spec, stdin, timeoutMs = 180000) {
  return new Promise(resolveCall => {
    const started = new Date().toISOString()
    const child = spawn(spec.command, spec.argv, { cwd: spec.cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, ...spec.options })
    const out = [], err = []
    let issue = null
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      if (process.platform === 'win32' && child.pid) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
      else child.kill()
    }, timeoutMs)
    child.stdout.on('data', chunk => out.push(chunk))
    child.stderr.on('data', chunk => err.push(chunk))
    child.on('error', error => { issue = String(error) })
    child.stdin.on('error', error => { issue = String(error) })
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer)
      resolveCall({ pid: child.pid ?? null, started_at: started, ended_at: new Date().toISOString(), exit_code: exitCode, signal, stdout: Buffer.concat(out), stderr: Buffer.concat(err), error: issue ?? (timedOut ? 'TIMEOUT' : null) })
    })
    child.stdin.end(Buffer.from(stdin, 'utf8'))
  })
}

async function invoke(root, runId, packet, role, engine, answers, scoringKey, version) {
  const request = requestFor(packet, role, answers, scoringKey)
  const stdin = effectiveStdin(engine, request)
  const invocationId = randomUUID()
  const stem = `${role}-${invocationId}`
  const cwd = mkdtempSync(join(tmpdir(), `f02-${role}-${engine}-`))
  assertIsolatedCwd(cwd)
  const outputPath = join(root, `${stem}.final`)
  const spec = cliSpec(engine, role, cwd, outputPath, request.system)
  const globalInstructions = engine === 'codex' ? globalInstructionInventory() : []
  const manifest = { schema_version: 1, run_id: runId, invocation_id: invocationId, packet_id: packet.packet_id, role, engine, family: family[engine], model_requested: model[engine], cli_version: version, cwd, cwd_isolated: true, codex_home: engine === 'codex' ? codexHome : null, global_instructions: globalInstructions, command: spec.command, argv: spec.argv, packet_sha256: sha(json({ packet_id: packet.packet_id, ...packet.body })), profile_sha256: sha(json(packet.body.profile)), system_sha256: sha(request.system), stdin_sha256: sha(stdin), grader_answers_sha256: role === 'grader' ? sha(json(answers)) : null, credential_source: 'cli_account', provider_attested: false }
  manifest.command_manifest_sha256 = sha(json(manifest))
  writeFileSync(join(root, `${stem}.manifest.json`), json(manifest))
  writeFileSync(join(root, `${stem}.system`), request.system)
  writeFileSync(join(root, `${stem}.stdin`), stdin)
  for (const instruction of globalInstructions) writeFileSync(join(root, `${stem}.global-${instruction.name}`), readFileSync(instruction.path))
  const result = await callCli(spec, stdin)
  rmSync(cwd, { recursive: true, force: true })
  writeFileSync(join(root, `${stem}.stdout`), result.stdout)
  writeFileSync(join(root, `${stem}.stderr`), result.stderr)
  const record = { ...manifest, ...Object.fromEntries(['pid', 'started_at', 'ended_at', 'exit_code', 'signal', 'error'].map(key => [key, result[key]])), stdout_sha256: sha(result.stdout), stderr_sha256: sha(result.stderr), final_sha256: existsSync(outputPath) ? sha(readFileSync(outputPath)) : null }
  try {
    const decoded = decode(engine, result.stdout, outputPath)
    record.session_id = decoded.session_id
    record.model_observed = decoded.observed_model
    record.refusal = decoded.refusal
    record.tool_used = decoded.tool_used
    record.parsed = role === 'student' ? parseAnswers(decoded.text, packet) : parseScores(decoded.text, packet)
    record.parsed_sha256 = sha(json(record.parsed))
  } catch (error) { record.error = record.error ?? String(error) }
  record.status = result.exit_code === 0 && !record.error && !record.refusal && !record.tool_used && record.session_id && record.parsed ? 'completed' : 'failed'
  writeFileSync(join(root, `${stem}.record.json`), json(record))
  if (record.status !== 'completed') throw Error(`${engine} ${role}: ${record.error ?? 'INCOMPLETE_CLI_EVIDENCE'}`)
  return { stem, record }
}

export async function runStage(rootInput, stage, stageA, stageB) {
  if (!['a', 'b', 'batch'].includes(stage)) throw Error('Stage must be a, b or batch')
  const gate = stage === 'batch' ? stageC(stageA, stageB) : null
  const root = resolve(rootInput)
  if (existsSync(root)) throw Error('Use a fresh output directory')
  mkdirSync(root, { recursive: true })
  const built = buildF02Synthetic()
  const runId = randomUUID()
  const versions = { claude: versionOf('claude'), codex: versionOf('codex') }
  const selection = stage === 'a' ? [{ packet: built.packets[0], student: 'claude' }] : stage === 'b' ? [{ packet: built.packets[0], student: 'claude' }, { packet: built.packets[1], student: 'codex' }] : built.packets.map((packet, index) => ({ packet, student: Math.floor(index / 2) % 2 === 0 ? 'claude' : 'codex' }))
  const run = { schema_version: 1, run_id: runId, stage, seal_sha256: built.seal.seal_sha256, planned: selection.length, pairs: [], status: 'running', synthetic_validation_valid_n: 0, evidence_level: 'E2', provider_attested: false }
  if (gate) writeFileSync(join(root, 'stage-c-gate.json'), json({ ...gate, stage_a_dir: resolve(stageA), stage_b_dir: resolve(stageB) }))
  const save = () => writeFileSync(join(root, 'run.json'), json(run))
  save()
  for (const { packet, student } of selection) {
    try {
      const grader = student === 'claude' ? 'codex' : 'claude'
      const s = await invoke(root, runId, packet, 'student', student, null, built.scoringKey, versions[student])
      const g = await invoke(root, runId, packet, 'grader', grader, s.record.parsed, built.scoringKey, versions[grader])
      run.pairs.push({ packet_id: packet.packet_id, student: s.stem, grader: g.stem, status: 'completed' })
    } catch (error) {
      run.pairs.push({ packet_id: packet.packet_id, status: 'failed', reason: String(error) })
      run.status = 'failed'
      save()
      return run
    }
    save()
  }
  run.status = 'completed_unverified'
  save()
  return run
}

export function verifyStage(rootInput) {
  const root = resolve(rootInput)
  const run = JSON.parse(readFileSync(join(root, 'run.json'), 'utf8'))
  const built = buildF02Synthetic()
  const expectedPackets = run.stage === 'a' ? [built.packets[0].packet_id] : run.stage === 'b' ? [built.packets[0].packet_id, built.packets[1].packet_id] : run.stage === 'batch' ? built.packets.map(packet => packet.packet_id) : null
  if (!expectedPackets || run.status !== 'completed_unverified' || run.planned !== expectedPackets.length || run.seal_sha256 !== built.seal.seal_sha256 || run.pairs.length !== run.planned || run.pairs.some((pair, index) => pair.status !== 'completed' || pair.packet_id !== expectedPackets[index])) throw Error('RUN_INCOMPLETE')
  const packets = new Map(built.packets.map(packet => [packet.packet_id, packet]))
  const ids = new Set()
  for (const pair of run.pairs) {
    const packet = packets.get(pair.packet_id)
    if (!packet) throw Error('PACKET_UNKNOWN')
    const records = []
    for (const [role, stem] of [['student', pair.student], ['grader', pair.grader]]) {
      const record = JSON.parse(readFileSync(join(root, `${stem}.record.json`), 'utf8'))
      const manifest = JSON.parse(readFileSync(join(root, `${stem}.manifest.json`), 'utf8'))
      const { command_manifest_sha256, ...unsigned } = manifest
      if (sha(json(unsigned)) !== command_manifest_sha256 || Object.entries(manifest).some(([key, value]) => json(record[key]) !== json(value))) throw Error('MANIFEST_CHANGED')
      const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
      if (record.run_id !== run.run_id || record.packet_id !== packet.packet_id || record.role !== role || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(record.invocation_id) || stem !== `${role}-${record.invocation_id}` || ids.has(record.invocation_id) || !record.session_id || !record.cli_version || record.status !== 'completed' || record.exit_code !== 0 || record.signal !== null || record.error !== null || !record.pid || record.tool_used || !validTime(record.started_at) || !validTime(record.ended_at) || record.started_at > record.ended_at) throw Error('INVOCATION_IDENTITY_INVALID')
      const studentEngine = run.stage === 'batch' ? (Math.floor(built.packets.findIndex(item => item.packet_id === pair.packet_id) / 2) % 2 === 0 ? 'claude' : 'codex') : (run.stage === 'a' || pair.packet_id === built.packets[0].packet_id ? 'claude' : 'codex')
      const expectedEngine = role === 'student' ? studentEngine : studentEngine === 'claude' ? 'codex' : 'claude'
      const recordedFinal = expectedEngine === 'codex' ? record.argv[record.argv.indexOf('-o') + 1] : join(root, `${stem}.final`)
      const expectedSpec = cliSpec(expectedEngine, role, record.cwd, recordedFinal, requestFor(packet, role, role === 'grader' ? records[0].parsed : null, built.scoringKey).system)
      if (record.engine !== expectedEngine || record.family !== family[expectedEngine] || record.model_requested !== model[expectedEngine] || record.command !== expectedSpec.command || json(record.argv) !== json(expectedSpec.argv) || !basename(record.cwd).startsWith(`f02-${role}-${expectedEngine}-`) || !resolve(record.cwd).startsWith(resolve(tmpdir()) + sep) || record.cwd_isolated !== true || (expectedEngine === 'codex' && basename(recordedFinal) !== `${stem}.final`) || !/^\d{4}-\d\d-\d\dT/.test(record.started_at) || !/^\d{4}-\d\d-\d\dT/.test(record.ended_at)) throw Error('COMMAND_OR_MODEL_CHANGED')
      if (expectedEngine === 'codex') {
        if (!record.codex_home || !Array.isArray(record.global_instructions) || record.global_instructions.length > 2 || record.global_instructions.filter(item => item.active).length > 1) throw Error('GLOBAL_INSTRUCTIONS_INVALID')
        const names = record.global_instructions.map(item => item.name)
        const storedCopies = readdirSync(root).filter(name => name.startsWith(`${stem}.global-`) && name.endsWith('.md')).sort()
        const declaredCopies = names.map(name => `${stem}.global-${name}`).sort()
        if (json(storedCopies) !== json(declaredCopies)) throw Error('GLOBAL_INSTRUCTION_INVENTORY_CHANGED')
        const active = names.includes('AGENTS.override.md') ? 'AGENTS.override.md' : names.includes('AGENTS.md') ? 'AGENTS.md' : null
        if (new Set(names).size !== names.length || record.global_instructions.some(item => item.active !== (item.name === active))) throw Error('GLOBAL_INSTRUCTIONS_PRIORITY_CHANGED')
        for (const instruction of record.global_instructions) {
          if (!['AGENTS.md', 'AGENTS.override.md'].includes(instruction.name) || instruction.path !== join(record.codex_home, instruction.name) || instruction.sha256 !== sha(readFileSync(join(root, `${stem}.global-${instruction.name}`)))) throw Error('GLOBAL_INSTRUCTIONS_CHANGED')
        }
      }
      ids.add(record.invocation_id)
      if (record.packet_sha256 !== sha(json({ packet_id: packet.packet_id, ...packet.body })) || record.profile_sha256 !== sha(json(packet.body.profile))) throw Error('PACKET_OR_PROFILE_CHANGED')
      const answers = role === 'grader' ? records[0].parsed : null
      const request = requestFor(packet, role, answers, built.scoringKey)
      if (record.system_sha256 !== sha(readFileSync(join(root, `${stem}.system`))) || record.system_sha256 !== sha(request.system) || record.stdin_sha256 !== sha(readFileSync(join(root, `${stem}.stdin`))) || record.stdin_sha256 !== sha(effectiveStdin(record.engine, request)) || record.grader_answers_sha256 !== (role === 'grader' ? sha(json(answers)) : null)) throw Error('REQUEST_CHANGED')
      const stdout = readFileSync(join(root, `${stem}.stdout`)), stderr = readFileSync(join(root, `${stem}.stderr`))
      if (record.stdout_sha256 !== sha(stdout) || record.stderr_sha256 !== sha(stderr)) throw Error('RAW_OUTPUT_CHANGED')
      const outputPath = join(root, `${stem}.final`)
      if (record.final_sha256 !== (existsSync(outputPath) ? sha(readFileSync(outputPath)) : null)) throw Error('FINAL_OUTPUT_CHANGED')
      const decoded = decode(record.engine, stdout, outputPath)
      const parsed = role === 'student' ? parseAnswers(decoded.text, packet) : parseScores(decoded.text, packet)
      if (record.session_id !== decoded.session_id || record.model_observed !== decoded.observed_model || record.refusal !== decoded.refusal || decoded.refusal || record.tool_used !== decoded.tool_used || record.parsed_sha256 !== sha(json(parsed)) || json(record.parsed) !== json(parsed)) throw Error('PARSED_OUTPUT_CHANGED')
      if (record.engine === 'claude' && record.model_observed !== model.claude) throw Error('MODEL_MISMATCH')
      if (record.engine === 'codex' && !record.argv.includes(model.codex)) throw Error('MODEL_MISMATCH')
      records.push(record)
    }
    if (records[0].family === records[1].family || records[0].invocation_id === records[1].invocation_id || records[0].ended_at > records[1].started_at) throw Error('SELF_GRADE_OR_ORDER_INVALID')
  }
  if (run.stage === 'batch') {
    const gate = JSON.parse(readFileSync(join(root, 'stage-c-gate.json'), 'utf8'))
    const live = stageC(gate.stage_a_dir, gate.stage_b_dir)
    if (!gate.local_cross_agent_audit_ready || !live.all_rejected || live.stage_a_run_id !== gate.stage_a_run_id || live.stage_b_run_id !== gate.stage_b_run_id) throw Error('STAGE_C_GATE_STALE')
  }
  return { stage: run.stage, run_id: run.run_id, checked_pairs: run.pairs.length, evidence_level: run.stage === 'batch' ? 'E3' : 'E2', local_cross_agent_audit_ready: run.stage === 'batch', synthetic_validation_valid_n: run.stage === 'batch' ? run.pairs.length : 0 }
}

export function stageC(stageA, stageB) {
  const a = verifyStage(stageA), b = verifyStage(stageB)
  if (a.stage !== 'a' || b.stage !== 'b' || a.run_id === b.run_id || a.checked_pairs !== 1 || b.checked_pairs !== 2) throw Error('STAGE_A_B_INVALID')
  const checks = []
  const mutations = [
    ['packet_hash', 'student', 'record.json', obj => { obj.packet_sha256 = '0'.repeat(64); return obj }],
    ['profile_hash', 'student', 'record.json', obj => { obj.profile_sha256 = '0'.repeat(64); return obj }],
    ['system_prompt', 'student', 'system', value => value + ' changed'],
    ['request', 'student', 'stdin', value => value + ' changed'],
    ['raw_student', 'student', 'stdout', value => value + ' changed'],
    ['parsed_answer', 'student', 'record.json', obj => { obj.parsed[0].answer = 'changed'; return obj }],
    ['run_id', 'grader', 'record.json', obj => { obj.run_id = 'mixed'; return obj }],
    ['raw_grader', 'grader', 'stdout', value => value + ' changed'],
    ['parsed_score', 'grader', 'record.json', obj => { obj.parsed[0].score = obj.parsed[0].score === 0 ? 1 : 0; return obj }],
    ['self_grading', 'grader', 'record.json', obj => { obj.family = 'same'; return obj }],
    ['missing_stdout', 'student', 'stdout', () => ''],
    ['session_id', 'student', 'record.json', obj => { obj.session_id = 'wrong'; return obj }],
    ['cli_version', 'student', 'record.json', obj => { obj.cli_version = ''; return obj }],
    ['requested_model', 'student', 'record.json', obj => { obj.model_requested = 'wrong'; return obj }],
    ['observed_model', 'grader', 'record.json', obj => { obj.model_observed = 'wrong'; return obj }],
    ['argv', 'student', 'manifest.json', obj => { obj.argv = ['wrong']; return obj }],
    ['refusal', 'student', 'record.json', obj => { obj.refusal = true; return obj }],
    ['provider_error', 'grader', 'record.json', obj => { obj.exit_code = 1; return obj }],
    ['tool_use', 'student', 'record.json', obj => { obj.tool_used = true; return obj }],
    ['invocation_id_missing', 'student', 'record.json', obj => { obj.invocation_id = ''; return obj }],
    ['time_reversed', 'grader', 'record.json', obj => { obj.started_at = new Date(Date.parse(obj.ended_at) + 1000).toISOString(); return obj }]
  ]
  for (const source of [stageA, stageB]) {
    const pairs = JSON.parse(readFileSync(join(source, 'run.json'), 'utf8')).pairs
    for (const pair of pairs) for (const [name, role, suffix, mutate] of mutations) {
      const temp = mkdtempSync(join(tmpdir(), 'f02-stage-c-'))
      try {
        cpSync(source, temp, { recursive: true })
        verifyStage(temp)
        const path = join(temp, `${pair[role]}.${suffix}`)
        const original = readFileSync(path, 'utf8')
        const input = suffix.endsWith('.json') ? JSON.parse(original) : original
        const output = mutate(input)
        writeFileSync(path, typeof output === 'string' ? output : json(output))
        const manifestField = { packet_hash: 'packet_sha256', profile_hash: 'profile_sha256', run_id: 'run_id', self_grading: 'family', cli_version: 'cli_version', requested_model: 'model_requested', argv: 'argv', invocation_id_missing: 'invocation_id' }[name]
        if (manifestField) {
          const otherSuffix = suffix === 'manifest.json' ? 'record.json' : 'manifest.json'
          const otherPath = join(temp, `${pair[role]}.${otherSuffix}`)
          const other = JSON.parse(readFileSync(otherPath, 'utf8'))
          other[manifestField] = output[manifestField]
          if (otherSuffix === 'manifest.json') {
            const { command_manifest_sha256, ...unsigned } = other
            other.command_manifest_sha256 = sha(json(unsigned))
          } else other.command_manifest_sha256 = output.command_manifest_sha256
          writeFileSync(otherPath, json(other))
          if (suffix === 'manifest.json') {
            const manifest = JSON.parse(readFileSync(path, 'utf8'))
            const { command_manifest_sha256, ...unsigned } = manifest
            manifest.command_manifest_sha256 = sha(json(unsigned))
            writeFileSync(path, json(manifest))
            other.command_manifest_sha256 = manifest.command_manifest_sha256
            writeFileSync(otherPath, json(other))
          } else {
            output.command_manifest_sha256 = other.command_manifest_sha256
            writeFileSync(path, json(output))
          }
        }
        let rejected = false
        try { verifyStage(temp) } catch { rejected = true }
        checks.push({ run_id: source === stageA ? a.run_id : b.run_id, packet_id: pair.packet_id, mutation: name, rejected })
        if (!rejected) throw Error(`TAMPER_NOT_REJECTED:${name}`)
      } finally { rmSync(temp, { recursive: true, force: true }) }
    }
    for (const pair of pairs) for (const name of ['final_stdout_mismatch', 'raw_refusal_with_rehashed_output', 'global_instruction_file', 'terminal_event_removed', 'claude_terminal_removed', 'global_inventory_erased']) {
      const role = ['student', 'grader'].find(candidate => {
        const record = JSON.parse(readFileSync(join(source, `${pair[candidate]}.record.json`), 'utf8'))
        return record.engine === (['raw_refusal_with_rehashed_output', 'claude_terminal_removed'].includes(name) ? 'claude' : 'codex')
      })
      const stem = pair[role], temp = mkdtempSync(join(tmpdir(), 'f02-stage-c-'))
      try {
        cpSync(source, temp, { recursive: true })
        verifyStage(temp)
        const recordPath = join(temp, `${stem}.record.json`)
        const record = JSON.parse(readFileSync(recordPath, 'utf8'))
        if (name === 'final_stdout_mismatch') {
          const altered = structuredClone(record.parsed)
          if (role === 'student') altered[0].answer += ' altered'
          else altered[0].score = altered[0].score === 0 ? 1 : 0
          const final = role === 'student' ? json({ answers: altered }) : json({ scores: altered })
          writeFileSync(join(temp, `${stem}.final`), final)
          record.final_sha256 = sha(Buffer.from(final))
          record.parsed = altered
          record.parsed_sha256 = sha(json(altered))
        } else if (['raw_refusal_with_rehashed_output', 'claude_terminal_removed'].includes(name)) {
          const path = join(temp, `${stem}.stdout`)
          const raw = JSON.parse(readFileSync(path, 'utf8'))
          if (name === 'raw_refusal_with_rehashed_output') raw.is_error = true
          else delete raw.terminal_reason
          const altered = json(raw)
          writeFileSync(path, altered)
          record.stdout_sha256 = sha(Buffer.from(altered))
        } else if (name === 'global_inventory_erased') {
          const changed = record.global_instructions.length ? [] : [{ name: 'AGENTS.md', path: join(record.codex_home, 'AGENTS.md'), active: true, sha256: '0'.repeat(64) }]
          record.global_instructions = changed
          const manifestPath = join(temp, `${stem}.manifest.json`)
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
          manifest.global_instructions = changed
          const { command_manifest_sha256, ...unsigned } = manifest
          manifest.command_manifest_sha256 = sha(json(unsigned))
          record.command_manifest_sha256 = manifest.command_manifest_sha256
          writeFileSync(manifestPath, json(manifest))
        } else if (name === 'global_instruction_file') {
          const instruction = record.global_instructions[0]
          if (instruction) {
            const path = join(temp, `${stem}.global-${instruction.name}`)
            writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from(' changed')]))
          } else {
            const fake = { name: 'AGENTS.md', path: join(record.codex_home, 'AGENTS.md'), active: true, sha256: '0'.repeat(64) }
            record.global_instructions = [fake]
            const manifestPath = join(temp, `${stem}.manifest.json`)
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
            manifest.global_instructions = [fake]
            const { command_manifest_sha256, ...unsigned } = manifest
            manifest.command_manifest_sha256 = sha(json(unsigned))
            record.command_manifest_sha256 = manifest.command_manifest_sha256
            writeFileSync(manifestPath, json(manifest))
          }
        } else {
          const path = join(temp, `${stem}.stdout`)
          const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean)
          if (JSON.parse(lines.at(-1)).type !== 'turn.completed') throw Error('EXPECTED_TERMINAL_EVENT_MISSING')
          lines.pop()
          const altered = `${lines.join('\n')}\n`
          writeFileSync(path, altered)
          record.stdout_sha256 = sha(Buffer.from(altered))
        }
        writeFileSync(recordPath, json(record))
        let rejected = false
        try { verifyStage(temp) } catch { rejected = true }
        checks.push({ run_id: source === stageA ? a.run_id : b.run_id, packet_id: pair.packet_id, mutation: name, rejected })
        if (!rejected) throw Error(`TAMPER_NOT_REJECTED:${name}`)
      } finally { rmSync(temp, { recursive: true, force: true }) }
    }
  }
  return { local_cross_agent_audit_ready: true, evidence_level: 'E3', stage_a_run_id: a.run_id, stage_b_run_id: b.run_id, tamper_checks: checks.length, all_rejected: true, synthetic_validation_valid_n: 0, provider_attested: false }
}

export function exportVerifiedBatch(rootInput) {
  const root = resolve(rootInput)
  const verified = verifyStage(root)
  if (verified.stage !== 'batch' || verified.synthetic_validation_valid_n !== 28) throw Error('BATCH_NOT_ADMISSIBLE')
  const built = buildF02Synthetic()
  const packetById = new Map(built.packets.map(packet => [packet.packet_id, packet]))
  const run = JSON.parse(readFileSync(join(root, 'run.json'), 'utf8'))
  const rows = run.pairs.map(pair => {
    const student = JSON.parse(readFileSync(join(root, `${pair.student}.record.json`), 'utf8'))
    const grader = JSON.parse(readFileSync(join(root, `${pair.grader}.record.json`), 'utf8'))
    const packet = packetById.get(pair.packet_id)
    return { run_id: run.run_id, packet_id: pair.packet_id, model: student.model_observed ?? student.model_requested, model_family: student.family, scorer_model: grader.model_observed ?? grader.model_requested, scorer_family: grader.family, replica_id: 'r1', scoring_key_hash: built.seal.scoring_key_hash, student_prompt_sha256: student.stdin_sha256, scorer_prompt_sha256: grader.stdin_sha256, student_invocation_sha256: student.command_manifest_sha256, scorer_invocation_sha256: grader.command_manifest_sha256, respondent_raw_sha256: student.stdout_sha256, scorer_raw_sha256: grader.stdout_sha256, profile_id: packet.profile_id, passage_variant: packet.passage_variant, audit_level: 'E3_local_cross_agent', provider_attested: false, answers: student.parsed, scores: grader.parsed }
  })
  const analysis = analyzeF02Synthetic(rows, built)
  writeFileSync(join(root, 'responses.json'), json(rows))
  writeFileSync(join(root, 'analysis.json'), json({ ...analysis, evidence_level: 'E3', actual_student_n: 0, benchmark_version: null, target_fit: 'unopened', level_separation: 'unopened', gold_s: 0, db_seed: 0 }))
  return { ...verified, analysis_status: analysis.status, rows: rows.length, target_fit: 'unopened', level_separation: 'unopened', gold_s: 0, db_seed: 0 }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, root, stage, stageA, stageB] = process.argv.slice(2)
  if (command === 'run' && root) {
    const result = await runStage(root, stage, stageA, stageB)
    console.log(json(result))
    if (result.status !== 'completed_unverified') process.exitCode = 1
  } else if (command === 'verify' && root) console.log(json(verifyStage(root)))
  else if (command === 'stage-c' && root && stage) console.log(json(stageC(root, stage)))
  else if (command === 'export-verified' && root) console.log(json(exportVerifiedBatch(root)))
  else throw Error('Usage: node f02-cross-agent.mjs run <fresh-directory> <a|b|batch> [stage-a-dir stage-b-dir] | verify <directory> | stage-c <stage-a-dir> <stage-b-dir> | export-verified <batch-dir>')
}
