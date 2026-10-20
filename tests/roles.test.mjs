// tests/roles.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignRoles, validateRoles, roleMetrics, workReason, designReviewAllows } from '../lib/roles.mjs'
import { parsePlan, planKey, checkProvenance, canCombinePlan } from '../lib/localroles.mjs'
import { localPlan } from '../lib/localroles.mjs'
import { runAgent, runClaude, runCodex } from '../lib/agents.mjs'
import { localDesignRunning } from '../lib/usergoals.mjs'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

test('Codex inherits client effort by default and preserves an explicitly selected effort', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-effort-'))
  const script = path.join(dir, 'provider.mjs')
  fs.writeFileSync(script, 'console.log(JSON.stringify(process.argv.slice(2)))\n')
  const before = process.env.VFC_CODEX_CMD
  process.env.VFC_CODEX_CMD = `node ${script.replace(/\\/g, '/')}`
  try {
    const run = (effort) => runCodex({ prompt: 'fixture', cwd: dir, runDir: path.join(dir, effort || 'default'), timeoutMs: 5000, effort })
    const inherited = run(undefined)
    assert.equal(inherited.code, 0)
    assert.ok(!JSON.parse(inherited.stdout).some((a) => a.startsWith('model_reasoning_effort=')))
    const explicit = run('xhigh')
    assert.equal(explicit.code, 0)
    assert.ok(JSON.parse(explicit.stdout).includes('model_reasoning_effort="xhigh"'))
    assert.throws(() => run('unsupported'), /Unsupported Codex effort/)
  } finally {
    if (before === undefined) delete process.env.VFC_CODEX_CMD
    else process.env.VFC_CODEX_CMD = before
  }
})

test('Claude child retains nested-session markers and DB sentinel; no refusal bypass', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-markers-'))
  const script = path.join(dir, 'provider.mjs')
  fs.writeFileSync(script, "// provider.mjs\nconsole.log(JSON.stringify({is_error:false,result:JSON.stringify({marker:process.env.CLAUDECODE,db:process.env.VFC_AUTOMATED_RUN})}))")
  const keys = ['VFC_CLAUDE_CMD', 'CLAUDECODE'], before = keys.map((k) => process.env[k])
  try {
    process.env.VFC_CLAUDE_CMD = `node ${script.replace(/\\/g, '/')}`
    process.env.CLAUDECODE = 'nested-session-marker'
    const r = runClaude({ prompt: 'fixture', cwd: dir, runDir: path.join(dir, 'run'), budgetUsd: 1, timeoutMs: 10000, readOnly: true })
    assert.equal(r.code, 0)
    assert.deepEqual(JSON.parse(r.result_text), { marker: 'nested-session-marker', db: '1' })
  } finally { keys.forEach((k, i) => { if (before[i] === undefined) delete process.env[k]; else process.env[k] = before[i] }) }
})

test('roles preserve independence and use explicit context before measured duration', () => {
  assert.throws(() => validateRoles({ implementer: 'codex', reviewer: 'codex' }))
  assert.throws(() => validateRoles({ supervisor: 'claude' }))
  const a = assignRoles({ roles: { planner: 'claude', implementer: 'codex' } })
  assert.equal(a.roles.reviewer, 'claude'); assert.equal(a.roles.verifier, 'claude')
  const samples = [{ agent: 'codex', role: 'implementer', ms: 2, ok: true }, { agent: 'claude', role: 'implementer', ms: 5, ok: true }]
  assert.equal(assignRoles({}, { samples }).roles.implementer, 'codex')
  assert.equal(assignRoles({ roles: { implementer: 'claude' } }, { samples }).roles.implementer, 'claude')
  const planned = assignRoles({}, { samples: [...samples, { agent: 'codex', role: 'planner', ms: 9, ok: true }, { agent: 'claude', role: 'planner', ms: 3, ok: true }] })
  assert.equal(planned.roles.planner, 'claude')
  assert.equal(planned.roles.implementer, 'codex')
  assert.notEqual(planned.roles.implementer, planned.roles.reviewer)
  assert.equal(assignRoles({}, { samples: [...samples, { agent: 'claude', role: 'implementer', ms: 0, ok: true, validated: false }] }).roles.implementer, 'codex')
  assert.throws(() => assignRoles({}, { available: ['codex'] }))
})
test('local plans fail closed and reuse binds HEAD, scope, contract and actor', () => {
  const task = { acceptance: ['A', 'B'], allowed_paths: ['src/**'] }
  assert.equal(parsePlan('unknown', task).ok, false)
  const block = (p) => '```json vfc-plan\n' + JSON.stringify(p) + '\n```'
  const p = { status: 'READY', goal_fit: 'gap', steps: ['reuse'], acceptance_indexes: [0], risks: [], reuse: [] }
  assert.equal(parsePlan(block(p), task).ok, false)
  assert.equal(parsePlan(block({ ...p, acceptance_indexes: [0, 1] }), task).ok, true)
  const a = assignRoles({})
  assert.notEqual(planKey(task, 'a', a), planKey(task, 'b', a))
  assert.notEqual(planKey(task, 'a', a), planKey({ ...task, allowed_paths: ['other/**'] }, 'a', a))
  assert.equal(workReason({}), null)
  assert.equal(workReason({}, { conflicts: 2 }), 'repeated_local_design_conflict')
})
test('combine planning with implementation only for the same low-risk actor; independent review remains', () => {
  const b = assignRoles({ roles: { planner: 'claude', implementer: 'claude' } })
  assert.equal(canCombinePlan({ priority: 'P2' }, b), true)
  assert.notEqual(b.roles.reviewer, b.roles.implementer)
  for (const t of [{ priority: 'P0' }, { complexity: 'complex' }, { approval_required: true }, { flags: ['path_redesign'] }, { work_requested: true }, { local_design_feedback: { problem: 'conflict' } }]) assert.equal(canCombinePlan(t, b), false)
  assert.equal(canCombinePlan({}, assignRoles({ roles: { planner: 'codex', implementer: 'claude' } })), false)
})
test('actor/task/HEAD provenance rejects stale, self and unknown review', () => {
  const task = { task_id: 'T-1', role_assignment: assignRoles({}) }
  const p = { contract: 'local-roles/1', task_id: 'T-1', head: 'a', implementer: 'claude', reviewer: 'codex', executable: 'codex.exe' }
  assert.deepEqual(checkProvenance(task, 'a', { provenance: p }), [])
  for (const x of [{ ...p, head: 'b' }, { ...p, reviewer: 'claude' }, { ...p, executable: '' }, null]) assert.ok(checkProvenance(task, 'a', { provenance: x }).length)
})
test('metrics do not fabricate detection recall or unmeasured role times', () => {
  const m = roleMetrics([{ task_id: 'T-1', agent: 'codex', role: 'planner', ms: 12, ok: true }, { task_id: 'T-1', phase: 'review_done', blocking: ['P1'] }])
  assert.equal(m.phases['codex:planner'].ms, 12); assert.equal(m.rework_rate, 1); assert.equal(m.detection_recall, null)
})
test('design P2/P3 follow-ups preserve verdict without blocking core; unknown/P1 still block', () => {
  const r = { verdict: 'REQUEST_CHANGES', ran_tests: false, findings: [{ id: 'F', claim: 'numeric corner', scope: 'in', severity: 'P2' }] }
  assert.equal(designReviewAllows(r), true)
  assert.equal(r.verdict, 'REQUEST_CHANGES')
  assert.equal(designReviewAllows({ ...r, findings: [] }), false)
  assert.equal(designReviewAllows({ ...r, findings: [{ ...r.findings[0], severity: 'P1' }] }), false)
  assert.equal(designReviewAllows({ ...r, findings: [{ ...r.findings[0], severity: 'UNKNOWN' }] }), false)
})
test('configuration failure is refused and bounded by the caller, not an uncaught exception', () => {
  const r = runAgent('codex', 'planner', {}, { runCodex: () => { throw Error('private configuration detail') } })
  assert.equal(r.ok, false); assert.equal(r.code, 1); assert.ok(!r.stderr.includes('private'))
  let options
  runAgent('claude', 'planner', {}, { runClaude: (o) => { options = o; return { code: 0, result_text: 'ok' } } })
  assert.equal(options.readOnly, true); assert.equal(options.verify, false); assert.equal(options.strictPermissions, true)
})
test('recover only a known dead local design process; live/unknown/foreign markers remain active', () => {
  assert.equal(localDesignRunning({}), false)
  assert.equal(localDesignRunning({ local_design_active: { host: os.hostname(), pid: process.pid } }), true)
  assert.equal(localDesignRunning({ local_design_active: { host: os.hostname(), pid: 2147483647 } }), false)
  assert.equal(localDesignRunning({ local_design_active: { host: 'another-host', pid: 2147483647 } }), true)
  assert.equal(localDesignRunning({ local_design_active: {} }), true)
})
test('local disagreement resolves through opposite AI; unknown and repeated disagreement never pass', () => {
  const task = { task_id: 'T-1', priority: 'P0', acceptance: ['A'] }, binding = assignRoles({ roles: { planner: 'codex' } })
  const plan = '```json vfc-plan\n' + JSON.stringify({ status: 'READY', goal_fit: 'gap', steps: ['change'], acceptance_indexes: [0], risks: [], reuse: [] }) + '\n```'
  let reviews = 0
  const deps = { runCodex: () => ({ code: 0, stdout: plan, ms: 1 }), runClaude: () => ({ code: 0, result_text: '```json vfc-review\n' + JSON.stringify({ verdict: ++reviews === 1 ? 'REQUEST_CHANGES' : 'APPROVE', findings: [], ran_tests: false }) + '\n```', ms: 1 }) }
  const opts = { binding, base: 'a', runDir: 'unused', limits: { claude_budget_usd: 1, claude_timeout_ms: 1000, codex_timeout_ms: 1000 }, deps }
  assert.equal(localPlan(task, opts).ok, true); assert.equal(reviews, 2)
  deps.runClaude = () => ({ code: 0, result_text: 'REVIEW_UNKNOWN', ms: 1 })
  assert.equal(localPlan(task, opts).ok, false)
  deps.runClaude = () => ({ code: 0, result_text: '```json vfc-review\n{"verdict":"REQUEST_CHANGES","findings":[],"ran_tests":false}\n```', ms: 1 })
  assert.equal(localPlan(task, opts).work, 'repeated_local_design_conflict')
})
