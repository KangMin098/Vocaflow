// tests/no-auto-codex.test.mjs — RP-2026-10-10.2: 자동 Codex 리뷰 제거 회귀
// 기본 모드(VFC_AUTO_CODEX 미설정)에서 오케스트레이터 구현·담당 제출 경로가 Codex 를 0회 부르고,
// 완료는 completeTask 의 결정적 검사로만 정해지는지(통과 아닌 증거는 완료되지 않는지) 본다.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VFC = path.join(REPO, 'bin', 'vfc.mjs')
const ORCH = path.join(REPO, 'bin', 'goal-orchestrator.mjs')
const FAKE_CLAUDE = `node ${path.join(REPO, 'tests', 'fakes', 'fake-claude.mjs').replace(/\\/g, '/')}`
const TRIPWIRE = `node ${path.join(REPO, 'tests', 'fakes', 'codex-tripwire.mjs').replace(/\\/g, '/')}`
const FAKE_CODEX = `node ${path.join(REPO, 'tests', 'fakes', 'fake-codex.mjs').replace(/\\/g, '/')}`
const OWNER = 'r0-learning-journey'
const kids = []
after(() => kids.forEach((k) => k.kill()))

function env(root, extra = {}) {
  return { ...process.env, VFC_ROOT: root, VFC_CLAUDE_CMD: FAKE_CLAUDE, VFC_CODEX_CMD: TRIPWIRE, FAKE_STATE_DIR: root, VFC_PRODUCT_REPO: root, VFC_REVIEW_VERDICTS: path.join(root, 'verdicts.jsonl'), VFC_SNAPSHOT_ONLY_UNDER: os.tmpdir(), ...extra }
}
function vfc(root, args, extra) {
  const r = spawnSync(process.execPath, [VFC, ...args], { env: env(root, extra), encoding: 'utf8' })
  return { code: r.status, out: r.stdout, err: r.stderr }
}
function orch(root, args = [], extra) {
  const r = spawnSync(process.execPath, [ORCH, '--no-ci', '--json', ...args], { env: env(root, extra), encoding: 'utf8', timeout: 240000 })
  let json = null
  try {
    json = JSON.parse(r.stdout)
  } catch {
    json = null
  }
  return { code: r.status, out: r.stdout, err: r.stderr, json }
}
const state = (root, f) => JSON.parse(fs.readFileSync(path.join(root, 'state', f), 'utf8'))
const task = (root, id) => state(root, 'TASK_QUEUE.json').tasks.find((t) => t.task_id === id)

function mkWorktree() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-owt-'))
  const g = (...a) => execFileSync('git', ['-C', d, ...a], { encoding: 'utf8' })
  g('init', '-q', '-b', 'feat/t')
  g('config', 'user.email', 't@example.com')
  g('config', 'user.name', 'test')
  fs.writeFileSync(path.join(d, 'README.md'), 'x\n')
  fs.writeFileSync(path.join(d, '.gitignore'), '.vfc-runs/\n.agent-lock\n')
  g('add', '.')
  g('commit', '-q', '-m', 'base')
  return d
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfc-orch-'))
  assert.equal(vfc(root, ['init']).code, 0)
  // 시드 작업(T-0001~0005)은 worktree·DB 때문에 실행 불가 — 테스트 작업만 후보가 된다
  return root
}

function addTask(root, over = {}) {
  const wt = over.worktree ?? mkWorktree()
  vfc(root, ['owner', 'bind-worktree', over.owner_id ?? OWNER, wt, '--branch', 'feat/t'])
  const spec = { goal_id: 'VG-L3-A2-01', title: 'orch test', description: 'd', priority: 'P0', owner_id: OWNER, allowed_paths: ['src/**'], forbidden_paths: ['secret.txt'], acceptance: ['조건 0', '조건 1'], worktree: wt, branch: 'feat/t', impact: { current_gap: 'test gap', expected_impact: (over.criterion_claims || []).some((c) => c.claim === 'full') ? 'closes' : 'advances', evidence_required: ['테스트 통과'], out_of_scope: [] }, duplicate_reason: 'test fixture — 같은 범위 작업 여러 개', ...over }
  const f = path.join(root, `spec-${crypto.randomBytes(3).toString('hex')}.json`)
  fs.writeFileSync(f, JSON.stringify(spec))
  const r = vfc(root, ['task', 'add', '--file', f, '--json'])
  assert.equal(r.code, 0, r.err)
  return { ...JSON.parse(r.out), wt }
}

function integrity(root) {
  for (const f of fs.readdirSync(path.join(root, 'state')).filter((f) => f.endsWith('.json'))) JSON.parse(fs.readFileSync(path.join(root, 'state', f), 'utf8'))
  assert.ok(!fs.existsSync(path.join(root, 'state', '.journal.json')), 'journal 이 남지 않는다')
  const locks = JSON.parse(vfc(root, ['lock', 'list', '--json']).out)
  assert.deepEqual(locks.map((l) => l.name), [], '실행이 끝나면 잠금이 남지 않는다')
}


const codexCalls = (root) => (fs.existsSync(path.join(root, 'codex-called.log')) ? fs.readFileSync(path.join(root, 'codex-called.log'), 'utf8').trim().split('\n').filter(Boolean).length : 0)

test('NC1 구현 → 증거 통과 → 자동 Codex 0회로 COMPLETED · 리뷰 기록에 정책 판', () => {
  const root = setup()
  const t = addTask(root)
  const r = orch(root)
  assert.equal(r.code, 0, r.err + r.out)
  const tt = task(root, t.task_id)
  assert.equal(tt.status, 'COMPLETED')
  assert.equal(codexCalls(root), 0, 'Codex 를 부르지 않는다')
  const rec = fs.readdirSync(path.join(root, 'verification', 'reviews')).find((f) => f.startsWith(t.task_id))
  assert.match(fs.readFileSync(path.join(root, 'verification', 'reviews', rec), 'utf8'), /RP-2026-10-10.2/)
  integrity(root)
})

test('NC2 통과가 아닌 증거(수정 전 실패·미실행)는 Codex 없이도 완료되지 않는다', () => {
  const root = setup()
  const t = addTask(root)
  orch(root, [], { FAKE_CLAUDE: 'redstep' })
  assert.notEqual(task(root, t.task_id).status, 'COMPLETED')
  assert.equal(codexCalls(root), 0)
})

test('NC3 구현 실패 보고는 완료되지 않는다 · Codex 0회', () => {
  const root = setup()
  const t = addTask(root)
  orch(root, [], { FAKE_CLAUDE: 'fail' })
  assert.notEqual(task(root, t.task_id).status, 'COMPLETED')
  assert.equal(codexCalls(root), 0)
})
