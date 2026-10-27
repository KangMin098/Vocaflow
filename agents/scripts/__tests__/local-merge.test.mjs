// agents/scripts/__tests__/local-merge.test.mjs
// 잠금 결과를 코드에서 확인한 뒤에만 merge 하는지 — 잠금 실패·dirty·HEAD 바뀜은 merge 0회, 정상은 정확한 SHA, 실패는 상태 보존.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'local-merge-'))
// 잠금은 대상 워크트리 루트의 .agent-lock 이어야 한다 — 모든 fixture 를 같은 경로에 다시 만든다
const REPO = path.join(tmp, 'repo')
const LOCK = path.join(REPO, '.agent-lock')
process.env.AGENT_LOCK_FILE = LOCK
const { localMerge } = await import('../local-merge.mjs')

const g = (repo, ...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

/** main 에 커밋 하나, feature 에 커밋 하나인 저장소 — feature SHA 를 돌려준다. */
function fixture({ conflict = false } = {}) {
  const repo = REPO
  fs.rmSync(repo, { recursive: true, force: true })
  fs.mkdirSync(repo)
  g(repo, 'init', '-q', '-b', 'main')
  g(repo, 'config', 'user.email', 't@t')
  g(repo, 'config', 'user.name', 't')
  g(repo, 'config', 'core.autocrlf', 'false')
  fs.writeFileSync(path.join(repo, 'a.txt'), 'base\n')
  g(repo, 'add', 'a.txt')
  g(repo, 'commit', '-q', '-m', 'base')
  g(repo, 'checkout', '-q', '-b', 'feat')
  fs.writeFileSync(path.join(repo, conflict ? 'a.txt' : 'b.txt'), 'feat\n')
  g(repo, 'add', '-A')
  g(repo, 'commit', '-q', '-m', 'feat')
  const sha = g(repo, 'rev-parse', 'HEAD')
  g(repo, 'checkout', '-q', 'main')
  if (conflict) {
    fs.writeFileSync(path.join(repo, 'a.txt'), 'main\n')
    g(repo, 'commit', '-q', '-am', 'main side')
  }
  return { repo, sha, head: g(repo, 'rev-parse', 'HEAD') }
}

let holder
before(() => {
  holder = spawn(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], { stdio: 'ignore' })
})
after(() => {
  holder.kill()
  fs.rmSync(tmp, { recursive: true, force: true })
})

const me = { agent: 'claude', pid: process.pid }

test('정상: 정확한 SHA 를 --no-ff 로 합치고 자기 잠금을 놓는다', () => {
  const { repo, sha, head } = fixture()
  const r = localMerge({ repo, sha, ...me })
  assert.equal(r.code, 0, r.msg)
  assert.equal(r.merged, true)
  assert.equal(r.mainSha, g(repo, 'rev-parse', 'HEAD'))
  assert.equal(g(repo, 'rev-parse', 'HEAD^1'), head)
  assert.equal(g(repo, 'rev-parse', 'HEAD^2'), sha)
  assert.equal(fs.existsSync(LOCK), false)
  // 다시 부르면 이미 포함 — merge 하지 않는다
  const again = localMerge({ repo, sha, ...me })
  assert.equal(again.code, 0)
  assert.equal(again.merged, false)
  assert.equal(g(repo, 'rev-parse', 'HEAD'), r.mainSha)
})

test('남의 잠금: merge 0회 · 그 잠금은 그대로', () => {
  const { repo, sha, head } = fixture()
  const other = JSON.stringify({ agent: 'codex', pid: holder.pid, host: os.hostname(), branch: 'x', started_at: 't' })
  fs.writeFileSync(LOCK, other)
  try {
    const r = localMerge({ repo, sha, ...me })
    assert.equal(r.code, 3, r.msg)
    assert.equal(g(repo, 'rev-parse', 'HEAD'), head)
    assert.equal(fs.readFileSync(LOCK, 'utf8'), other)
  } finally {
    fs.rmSync(LOCK, { force: true })
  }
})

test('죽은/잘못된 pid: 잠금 실패로 merge 0회', () => {
  const { repo, sha, head } = fixture()
  const r = localMerge({ repo, sha, agent: 'claude', pid: 999999 })
  assert.equal(r.code, 3, r.msg)
  assert.equal(g(repo, 'rev-parse', 'HEAD'), head)
})

test('dirty · main 아님 · 짧은 SHA: merge 0회, 잠금 시도 없음', () => {
  const { repo, sha, head } = fixture()
  fs.writeFileSync(path.join(repo, 'a.txt'), 'dirty\n')
  assert.equal(localMerge({ repo, sha, ...me }).code, 2)
  g(repo, 'checkout', '-q', '--', 'a.txt')
  g(repo, 'checkout', '-q', 'feat')
  assert.equal(localMerge({ repo, sha, ...me }).code, 2)
  g(repo, 'checkout', '-q', 'main')
  assert.equal(localMerge({ repo, sha: sha.slice(0, 9), ...me }).code, 64)
  assert.equal(g(repo, 'rev-parse', 'HEAD'), head)
  assert.equal(fs.existsSync(LOCK), false)
})

test('잠금 사이 HEAD 바뀜 · dirty: merge 0회, 잠금은 놓는다', () => {
  const { repo, sha } = fixture()
  const r = localMerge({
    repo, sha, ...me,
    afterAcquire: () => {
      fs.writeFileSync(path.join(repo, 'c.txt'), 'x\n')
      g(repo, 'add', 'c.txt')
      g(repo, 'commit', '-q', '-m', 'drift')
    },
  })
  assert.equal(r.code, 2, r.msg)
  assert.match(r.msg, /HEAD/)
  assert.equal(g(repo, 'log', '-1', '--format=%s'), 'drift')
  assert.equal(fs.existsSync(LOCK), false)

  const r2 = localMerge({ repo, sha, ...me, afterAcquire: () => fs.writeFileSync(path.join(repo, 'a.txt'), 'dirty\n') })
  assert.equal(r2.code, 2, r2.msg)
  assert.equal(g(repo, 'log', '-1', '--format=%s'), 'drift')
})

test('merge 충돌: abort/reset 하지 않고 상태·잠금을 보존한다', () => {
  const { repo, sha, head } = fixture({ conflict: true })
  const r = localMerge({ repo, sha, ...me })
  assert.equal(r.code, 4, r.msg)
  assert.equal(g(repo, 'rev-parse', 'HEAD'), head)
  assert.ok(fs.existsSync(path.join(repo, '.git', 'MERGE_HEAD')))
  assert.equal(JSON.parse(fs.readFileSync(LOCK, 'utf8')).pid, process.pid)
  g(repo, 'merge', '--abort')
  fs.rmSync(LOCK, { force: true })
})

test('다른 워크트리의 잠금: 대상이 잠금 파일의 워크트리가 아니면 merge 0회 · 기존 잠금 보존', () => {
  const { sha } = fixture()
  const other = path.join(tmp, 'other')
  fs.rmSync(other, { recursive: true, force: true })
  fs.cpSync(REPO, other, { recursive: true })
  const held = JSON.stringify({ agent: 'codex', pid: holder.pid, host: os.hostname(), branch: 'x', started_at: 't' })
  fs.writeFileSync(path.join(other, '.agent-lock'), held)
  const otherHead = g(other, 'rev-parse', 'HEAD')
  const r = localMerge({ repo: other, sha, ...me })
  assert.equal(r.code, 64, r.msg)
  assert.equal(g(other, 'rev-parse', 'HEAD'), otherHead)
  assert.equal(fs.readFileSync(path.join(other, '.agent-lock'), 'utf8'), held)
  assert.equal(fs.existsSync(LOCK), false)
})

test('잠금 이름과 같은 다른 경로의 파일은 dirty 로 남는다', () => {
  const { repo, sha, head } = fixture()
  fs.mkdirSync(path.join(repo, 'sub'))
  fs.writeFileSync(path.join(repo, 'sub', '.agent-lock'), 'x\n')
  const r = localMerge({ repo, sha, ...me })
  assert.equal(r.code, 2, r.msg)
  assert.equal(g(repo, 'rev-parse', 'HEAD'), head)
})
