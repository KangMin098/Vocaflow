// tests/worktree-reap.test.mjs — node --test --test-concurrency=1 tests/worktree-reap.test.mjs
//
// 판정 규칙은 가짜 ctx 로, 삭제 경로는 임시 git 저장소 + 실제 CLI 자식 프로세스로 확인한다.
// 실제 D:/workspace · state/ · runtime/ 는 건드리지 않는다(VFC_ROOT 임시 폴더).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  activeTaskWorktrees,
  activityAt,
  judgeWorktree,
  lastReflogAt,
  mentionsPath,
  normPath,
  parseWorktreeList,
} from '../lib/worktree-reap.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CLI = path.join(REPO, 'bin', 'worktree-reap.mjs')
const NOW = Date.parse('2026-10-24T12:00:00Z')
const DAY = 86_400_000
const WT = 'D:/workspace/Vocaflow-done'

function ctx(over = {}) {
  return {
    protectedPaths: new Set([normPath('D:/workspace/Vocaflow'), normPath('D:/workspace/Vocaflow-main-serving')]),
    activeTasks: new Set(),
    isMerged: () => true,
    statusLines: () => ['!! node_modules/', '!! apps/web/.next-dev/', '?? .agent-goal.md'],
    lastActivityAt: () => NOW - 5 * DAY,
    readFile: () => null,
    pidAlive: () => false,
    processCmdlines: [],
    mainEnvLocal: 'KEY=1\n',
    now: NOW,
    idleMs: 3 * DAY,
    ...over,
  }
}
const wt = (over = {}) => ({ path: WT, head: 'a'.repeat(40), branch: 'feat/done', locked: false, bare: false, ...over })

test('합쳐지고 깨끗하고 오래된 워크트리는 지운다 (캐시·에이전트 메모만 남은 경우)', () => {
  const v = judgeWorktree(wt(), ctx())
  assert.equal(v.remove, true, v.reasons.join(' · '))
})

test('하나라도 걸리면 남긴다 — 이유를 남긴다', () => {
  const cases = [
    [{ isMerged: () => false }, '로컬 main 에 없는 커밋'],
    [{ statusLines: () => [' M apps/web/src/a.ts'] }, '미커밋 변경'],
    [{ statusLines: () => ['A  new.ts'] }, '미커밋 변경'],
    [{ statusLines: () => ['!! scripts/research/x/local/'] }, 'git 밖 데이터'],
    [{ statusLines: () => ['!! tmp/'] }, 'git 밖 데이터'],
    [{ statusLines: () => ['?? "docs/\\354\\230\\201.md"'] }, 'git 밖 데이터'],
    [{ activeTasks: new Set([normPath(WT)]) }, 'TASK'],
    [{ lastActivityAt: () => NOW - 2 * DAY }, '최근 활동'],
    [{ processCmdlines: ['"C:\\node.exe" D:\\workspace\\Vocaflow-done\\apps\\web\\node_modules\\next dev'] }, '프로세스'],
    [{ statusLines: () => { throw new Error('x') } }, 'git status 실패'],
  ]
  for (const [over, why] of cases) {
    const v = judgeWorktree(wt(), ctx(over))
    assert.equal(v.remove, false, why)
    assert.ok(v.reasons.some((r) => r.includes(why)), `${why} ∉ ${v.reasons.join(' · ')}`)
  }
})

test('보호 경로 · git worktree lock · HEAD 불명은 남긴다', () => {
  assert.equal(judgeWorktree(wt({ path: 'D:\\workspace\\Vocaflow-main-serving\\' }), ctx()).remove, false)
  assert.equal(judgeWorktree(wt({ locked: true }), ctx()).remove, false)
  assert.equal(judgeWorktree(wt({ head: null }), ctx()).remove, false)
  assert.equal(judgeWorktree(wt({ bare: true }), ctx()).remove, false)
})

test('.env.local 은 main 과 같을 때만 지운다', () => {
  const st = () => ['!! apps/web/.env.local']
  const same = (f) => (f.endsWith('.env.local') ? 'KEY=1\n' : null)
  const diff = (f) => (f.endsWith('.env.local') ? 'KEY=2\n' : null)
  assert.equal(judgeWorktree(wt(), ctx({ statusLines: st, readFile: same })).remove, true)
  assert.equal(judgeWorktree(wt(), ctx({ statusLines: st, readFile: diff })).remove, false)
  assert.equal(judgeWorktree(wt(), ctx({ statusLines: st, readFile: same, mainEnvLocal: null })).remove, false)
})

test('.agent-lock — 살아 있는 PID·형식 불명은 남기고 죽은 PID 는 무시한다', () => {
  const lock = (text) => (f) => (f.endsWith('.agent-lock') ? text : null)
  assert.equal(judgeWorktree(wt(), ctx({ readFile: lock('{"pid": 99}'), pidAlive: () => true })).remove, false)
  assert.equal(judgeWorktree(wt(), ctx({ readFile: lock('not json') })).remove, false)
  assert.equal(judgeWorktree(wt(), ctx({ readFile: lock('{"pid": 99}'), pidAlive: () => false })).remove, true)
})

test('mentionsPath — 이름이 이어지는 다른 워크트리와 구별한다', () => {
  const key = normPath('D:/workspace/Vocaflow-done')
  assert.equal(mentionsPath('node D:\\workspace\\Vocaflow-done\\x.mjs', key), true)
  assert.equal(mentionsPath('node D:/workspace/Vocaflow-done', key), true)
  assert.equal(mentionsPath('cwd="d:\\\\workspace\\\\vocaflow-done"', key), true)
  assert.equal(mentionsPath('node D:\\workspace\\Vocaflow-done-2\\x.mjs', key), false)
  assert.equal(mentionsPath('node D:\\workspace\\Vocaflow-done.bak', key), false)
})

test('활동 시각은 reflog 파일 시각이 아니라 마지막 항목의 시각이다 (git gc 일괄 재작성 대비)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reflog-'))
  const gitDir = path.join(dir, 'g')
  fs.mkdirSync(path.join(gitDir, 'logs'), { recursive: true })
  const old = Math.floor((NOW - 10 * DAY) / 1000)
  fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/x\n')
  fs.writeFileSync(
    path.join(gitDir, 'logs', 'HEAD'),
    `${'0'.repeat(40)} ${'a'.repeat(40)} K <k@k> ${old - 100} +0900\tcommit: a\n${'a'.repeat(40)} ${'b'.repeat(40)} K <k@k> ${old} +0900\tcommit: b\n`,
  )
  const t = new Date(NOW - 10 * DAY)
  for (const f of [dir, path.join(gitDir, 'HEAD')]) fs.utimesSync(f, t, t)
  // logs/HEAD 파일 시각은 「지금」 — gc 가 다시 쓴 상황
  assert.equal(activityAt(dir, gitDir), old * 1000)
  assert.equal(lastReflogAt(path.join(gitDir, 'missing')), 0)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('parseWorktreeList · activeTaskWorktrees', () => {
  const list = parseWorktreeList(
    ['worktree D:/w/main', 'HEAD ' + 'b'.repeat(40), 'branch refs/heads/main', '', 'worktree D:/w/x', 'HEAD ' + 'c'.repeat(40), 'detached', 'locked reason', ''].join('\n'),
  )
  assert.deepEqual(list.map((w) => [w.path, w.branch, w.locked]), [['D:/w/main', 'main', false], ['D:/w/x', null, true]])
  const set = activeTaskWorktrees({ tasks: [{ worktree: 'd:/w/a', status: 'REVIEW' }, { worktree: 'D:/w/b', status: 'COMPLETED' }, { status: 'READY' }] })
  assert.deepEqual([...set], [normPath('d:/w/a')])
})

// ── 실제 git 저장소에서 CLI 를 돌린다 ─────────────────────────────────────────
function sh(cwd, ...args) {
  return String(execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).trim()
}
function oldify(dir, gitDir) {
  const t = new Date(Date.now() - 10 * DAY)
  for (const f of [dir, path.join(gitDir, 'HEAD'), path.join(gitDir, 'logs', 'HEAD')]) {
    try { fs.utimesSync(f, t, t) } catch { /* 없음 */ }
  }
}

test('CLI --apply — 끝난 워크트리만 지우고 브랜치는 남긴다', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'reap-'))
  const vfcRoot = path.join(base, 'vfc')
  const main = path.join(base, 'main')
  fs.mkdirSync(path.join(vfcRoot, 'config'), { recursive: true })
  fs.mkdirSync(path.join(vfcRoot, 'state'), { recursive: true })
  fs.mkdirSync(main)
  sh(main, 'init', '-q', '-b', 'main')
  sh(main, 'config', 'user.email', 't@t')
  sh(main, 'config', 'user.name', 't')
  fs.writeFileSync(path.join(main, '.gitignore'), 'node_modules/\n')
  fs.writeFileSync(path.join(main, 'a.txt'), '1')
  sh(main, 'add', '.')
  sh(main, 'commit', '-q', '-m', 'init')

  const mk = (name, branch) => {
    const dir = path.join(base, name)
    sh(main, 'worktree', 'add', '-q', '-b', branch, dir)
    return dir
  }
  const done = mk('wt-done', 'feat/done')
  fs.mkdirSync(path.join(done, 'node_modules', 'deep'), { recursive: true })
  fs.writeFileSync(path.join(done, 'node_modules', 'deep', 'x.js'), 'x')
  fs.writeFileSync(path.join(done, '.agent-goal.md'), 'goal')
  const dirty = mk('wt-dirty', 'feat/dirty')
  fs.writeFileSync(path.join(dirty, 'a.txt'), 'changed')
  const open = mk('wt-open', 'feat/open')
  fs.writeFileSync(path.join(open, 'b.txt'), 'b')
  sh(open, 'add', '.')
  sh(open, 'commit', '-q', '-m', 'unmerged')
  const tasked = mk('wt-tasked', 'feat/tasked')
  for (const d of [done, dirty, open, tasked]) oldify(d, sh(d, 'rev-parse', '--absolute-git-dir'))

  fs.writeFileSync(path.join(vfcRoot, 'config', 'dev-mode.json'), JSON.stringify({ mode: 'LOCAL_FAST', main_worktree: main, integration_worktree: path.join(base, 'none') }))
  fs.writeFileSync(path.join(vfcRoot, 'state', 'TASK_QUEUE.json'), JSON.stringify({ tasks: [{ worktree: tasked, status: 'REVIEW' }] }))

  const r = spawnSync(process.execPath, [CLI, '--apply', '--idle-days', '0'], { env: { ...process.env, VFC_ROOT: vfcRoot }, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.error, null)
  assert.deepEqual(out.removed.map((x) => path.basename(x.path)), ['wt-done'])
  assert.equal(fs.existsSync(done), false)
  for (const d of [dirty, open, tasked]) assert.equal(fs.existsSync(d), true, d)
  assert.ok(!sh(main, 'worktree', 'list').includes('wt-done'), 'prune 됨')
  assert.equal(sh(main, 'rev-parse', '--verify', 'feat/done').length, 40, '브랜치는 남는다')
  assert.ok(fs.existsSync(path.join(vfcRoot, 'runtime', 'worktree-reap.json')))

  // 미리보기는 아무것도 지우지 않는다
  const pv = spawnSync(process.execPath, [CLI, '--idle-days', '0'], { env: { ...process.env, VFC_ROOT: vfcRoot }, encoding: 'utf8' })
  assert.equal(JSON.parse(pv.stdout).removed.length, 0)
  fs.rmSync(base, { recursive: true, force: true })
})
