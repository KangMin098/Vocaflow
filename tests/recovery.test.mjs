// tests/recovery.test.mjs — T-0091 재현: 범위 보완·동시 작업·상태 진단·실행 경계.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkToolScope } from '../lib/tool-scope.mjs'
import { classifyWorktreeChanges } from '../lib/orchestrator.mjs'
import { amendTask } from '../lib/tasks.mjs'
import { runClaude } from '../lib/agents.mjs'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-recovery-'))
  fs.mkdirSync(path.join(root, 'src'))
  fs.writeFileSync(path.join(root, 'src', 'a.ts'), '// a\n')
  return { root, scope: { worktree: root, allowed_paths: ['src/**'], forbidden_paths: ['src/secret.ts'], report_files: [path.join(root, '..', 'report-' + path.basename(root) + '.json')] } }
}

test('actual hook rejects cross-worktree, forbidden and junction writes; allows source and only the exact report', () => {
  const { root, scope } = fixture(), other = fixture()
  fs.symlinkSync(other.root, path.join(root, 'src', 'outside'), process.platform === 'win32' ? 'junction' : 'dir')
  const file = path.join(root, 'scope.json'); fs.writeFileSync(file, JSON.stringify(scope))
  const hook = (dest) => spawnSync(process.execPath, [path.join(repo, 'bin/tool-scope-guard.mjs'), file], { input: JSON.stringify({ tool_name: 'Write', cwd: root, tool_input: { file_path: dest } }), encoding: 'utf8' })
  for (const dest of [path.join(other.root, 'src', 'a.ts'), path.join(root, 'src', 'outside', 'new.ts'), path.join(root, 'src', 'secret.ts'), scope.report_files[0] + '.other']) {
    const result = hook(dest); assert.equal(result.status, 2); assert.match(result.stderr, /VFC_SCOPE_DENIED/)
  }
  assert.equal(hook(path.join(root, 'src', 'new.ts')).status, 0)
  assert.equal(hook(scope.report_files[0]).status, 0)
  assert.equal(fs.readFileSync(path.join(other.root, 'src', 'a.ts'), 'utf8'), '// a\n')
})

test('real Claude launcher installs the additive task hook; isolated commands are not granted to unscoped executions', () => {
  const { root, scope } = fixture()
  const fake = path.join(root, 'provider.mjs')
  fs.writeFileSync(fake, 'console.log(JSON.stringify({result:"fixture",is_error:false,total_cost_usd:0}))\n')
  const previous = process.env.VFC_CLAUDE_CMD
  process.env.VFC_CLAUDE_CMD = `node ${fake.replace(/\\/g, '/')}`
  try {
    const invoke = (name, taskScope) => {
      const runDir = path.join(root, name)
      const result = runClaude({ prompt: 'fixture', cwd: root, budgetUsd: 1, timeoutMs: 5000, runDir, taskScope })
      assert.equal(result.code, 0)
      return { settings: JSON.parse(fs.readFileSync(path.join(runDir, 'claude-settings.json'), 'utf8')), runDir }
    }
    const bounded = invoke('bounded', scope)
    assert.match(bounded.settings.hooks.PreToolUse[0].hooks[0].command, /tool-scope-guard\.mjs/)
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(bounded.runDir, 'tool-scope.json'), 'utf8')).allowed_paths, scope.allowed_paths)
    assert.ok(bounded.settings.permissions.deny.includes('Bash(git push:*)'))
    const unbounded = invoke('legacy', null)
    assert.equal(unbounded.settings.permissions.allow.some((p) => p.includes('playwright') || p.includes('exec tsx')), false)
  } finally { if (previous === undefined) delete process.env.VFC_CLAUDE_CMD; else process.env.VFC_CLAUDE_CMD = previous }
})

test('shell boundary refuses cwd escape/compound/staging all; direct tests and explicit own commit remain usable', () => {
  const { root, scope } = fixture()
  const check = (command) => checkToolScope({ cwd: root, tool_name: 'Bash', tool_input: { command } }, scope)
  for (const cmd of ['cd ../other', 'git -C ../other add .', 'git add src/a.ts && git commit -m x', 'pnpm --filter web exec vitest run ../other/test.ts', 'git add .', 'git add src', 'git commit --only . -m x', 'git commit --amend --only src/a.ts -m x', 'pnpm --filter web exec vitest run > log.txt', 'node -e "process.exit()"', 'pnpm --filter web exec playwright test tests/e2e/some.spec.ts --config playwright.isolated.config.ts', 'pnpm --filter web exec tsx scripts/arbitrary.mts']) assert.ok(check(cmd), cmd)
  for (const cmd of ['git add src/a.ts', 'git commit --only src/a.ts -F .vfc-runs/message.txt', 'git status --short', 'pnpm --filter web exec vitest run src/a.test.ts', 'pnpm --filter web exec tsc --noEmit -p .']) assert.equal(check(cmd), null, cmd)
  assert.ok(checkToolScope({ tool_name: 'Write', tool_input: { file_path: 'src/a.ts' } }, { ...scope, read_only: true }))
})

test('only task-owned isolated browser specs and harness builder are executable', () => {
  const { root } = fixture()
  const scope = { worktree: root, allowed_paths: ['apps/web/tests/e2e-isolated/csat-system-learning*.spec.ts', 'apps/web/scripts/build-csat-system-learning-harness.mts'], forbidden_paths: [] }
  const check = (command) => checkToolScope({ cwd: root, tool_name: 'Bash', tool_input: { command } }, scope)
  assert.equal(check('pnpm --filter web exec playwright test tests/e2e-isolated/csat-system-learning.spec.ts --config playwright.isolated.config.ts'), null)
  assert.equal(check('pnpm --filter web exec tsx scripts/build-csat-system-learning-harness.mts'), null)
  assert.ok(check('pnpm --filter web exec playwright test tests/e2e-isolated/other.spec.ts --config playwright.isolated.config.ts'))
  assert.ok(check('pnpm --filter web exec playwright test tests/e2e-isolated/csat-system-learning.spec.ts --config elsewhere.ts'))
  assert.ok(check('pnpm --filter web exec tsx scripts/build-other-harness.mts'))
})

const snap = (fingerprint, files, writer = null) => ({ fingerprint, head: 'same', files, writer })
const writer = { owner_id: 'other', pid: 123, allowed_paths: ['src/**'], forbidden_paths: ['src/secret.ts'] }
test('live owner content changes do not blame guarded Claude; unknown/forbidden changes still hard-stop', () => {
  const a = { other: snap('a', { 'src/a.ts': 'one' }, writer) }
  const b = { other: snap('b', { 'src/a.ts': 'two' }, writer) }
  assert.deepEqual(classifyWorktreeChanges(a, b, { guarded: true }), { concurrent: ['other'], suspicious: [] })
  assert.deepEqual(classifyWorktreeChanges(a, b), { concurrent: [], suspicious: ['other'] })
  assert.deepEqual(classifyWorktreeChanges({ other: snap('a', {}) }, { other: snap('b', { 'src/a.ts': 'two' }) }, { guarded: true }).suspicious, ['other'])
  assert.deepEqual(classifyWorktreeChanges(a, { other: snap('c', { 'src/a.ts': 'one', 'src/secret.ts': 'bad' }, writer) }, { guarded: true }).suspicious, ['other'])
  assert.deepEqual(classifyWorktreeChanges(a, { other: null }, { guarded: true }).suspicious, ['other'])
})

function amendmentFixture() {
  const task = { task_id: 'T-0091', owner_id: 'owner', status: 'BLOCKED', description: 'old', allowed_paths: ['src/**'], forbidden_paths: ['supabase/**', '.env*'], acceptance: ['keep'], evidence: [{ old: true }], verified_commit: 'abc', history: [] }
  return { task, state: { taskQueue: { tasks: [task] } } }
}
test('same task can add missing ordinary paths with audited reason; no acceptance, DB or forbidden boundary widening', () => {
  const { task, state } = amendmentFixture()
  amendTask(state, task.task_id, { caller: 'owner', patch: { allowed_paths: ['src/**', 'apps/web/src/lib/csat/item-tab-memory.ts'], description: 'keep legacy contracts' }, reason: 'user-authorized recovery' })
  assert.equal(task.task_id, 'T-0091'); assert.equal(task.status, 'BLOCKED'); assert.equal(task.amendments[0].previous.description, 'old')
  assert.deepEqual(task.acceptance, ['keep']); assert.deepEqual(task.evidence, []); assert.equal(task.verified_commit, null)
  for (const patch of [{ acceptance: ['skip UI'] }, { allowed_paths: ['src/**', 'supabase/**'] }, { allowed_paths: ['src/**', '../other'] }, { allowed_paths: ['src/**', '.env.local'] }, { allowed_paths: ['src/**', 'package.json'] }]) {
    assert.throws(() => amendTask(state, task.task_id, { caller: 'owner', patch, reason: 'invalid' }))
  }
  assert.throws(() => amendTask(state, task.task_id, { caller: 'other', patch: { description: 'x' }, reason: 'invalid' }))
  task.status = 'IN_PROGRESS'
  assert.throws(() => amendTask(state, task.task_id, { caller: 'owner', patch: { description: 'x' }, reason: 'invalid' }))
})

test('CLI amendment is journaled on the existing task and rejects acceptance weakening', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-amend-cli-'))
  const run = (...args) => spawnSync(process.execPath, [path.join(repo, 'bin/vfc.mjs'), ...args], { env: { ...process.env, VFC_ROOT: root }, encoding: 'utf8' })
  assert.equal(run('init').status, 0)
  const spec = { goal_id: 'VG-L3-A1-01', title: 'recovery', description: 'd', priority: 'P1', owner_id: 'r0-learning-journey', allowed_paths: ['src/**'], forbidden_paths: ['supabase/**'], acceptance: ['unchanged'], criterion_claims: [], impact: { kind: 'independent', user_request_ref: 'explicit recovery fixture', current_gap: 'missing dependency', expected_impact: 'advances', evidence_required: ['regression'] } }
  const specFile = path.join(root, 'spec.json'); fs.writeFileSync(specFile, JSON.stringify(spec))
  const added = run('task', 'add', '--file', specFile, '--json'); assert.equal(added.status, 0, added.stderr)
  const id = JSON.parse(added.stdout).task_id
  const patchFile = path.join(root, 'patch.json'); fs.writeFileSync(patchFile, JSON.stringify({ allowed_paths: ['src/**', 'apps/web/src/lib/csat/item-tab-memory.ts'] }))
  const amended = run('task', 'amend', id, '--file', patchFile, '--by', spec.owner_id, '--reason', 'same authorized work', '--json')
  assert.equal(amended.status, 0, amended.stderr)
  const task = JSON.parse(amended.stdout)
  assert.equal(task.task_id, id); assert.equal(task.amendments.length, 1); assert.deepEqual(task.acceptance, ['unchanged'])
  fs.writeFileSync(patchFile, JSON.stringify({ acceptance: ['skip'] }))
  assert.notEqual(run('task', 'amend', id, '--file', patchFile, '--by', spec.owner_id, '--reason', 'no').status, 0)
  const saved = JSON.parse(run('task', 'show', id, '--json').stdout)
  assert.equal(saved.amendments.length, 1); assert.deepEqual(saved.acceptance, ['unchanged'])
})
