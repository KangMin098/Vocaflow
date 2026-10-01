// agents/scripts/__tests__/lock.test.mjs
// 실행: node --test agents/scripts/__tests__/*.test.mjs
//
// D5 — 잠금 중 두 번째 acquire 거부 · 고아 잠금 자동 해제. 실제 CLI 를 실제 프로세스로 돌린다.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lock.mjs')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-lock-'))
const LOCK = path.join(dir, '.agent-lock')
const env = { ...process.env, AGENT_LOCK_FILE: LOCK }
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8' })

// 살아 있는 "에이전트" 역할 — 테스트 동안 떠 있는 프로세스
const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], { stdio: 'ignore' })
after(() => {
  holder.kill()
  fs.rmSync(dir, { recursive: true, force: true })
})

test('살아 있는 잠금이 있으면 다른 에이전트의 acquire 는 exit 3', () => {
  const a = run('acquire', 'claude', '--pid', String(holder.pid))
  assert.equal(a.status, 0, a.stderr)
  const b = run('acquire', 'codex', '--pid', String(process.pid))
  assert.equal(b.status, 3)
  assert.match(b.stderr, /잠금 중: claude/)
  assert.equal(JSON.parse(fs.readFileSync(LOCK, 'utf8')).agent, 'claude')
})

// 2026-09-20 실측 결함: claude 세션 둘이 같은 워크트리를 동시에 썼는데 잠금이 막지 않았다
// (pid 21452 의 잠금을 pid 5772 가 "같은 에이전트 — 갱신" 으로 가져갔다). DD-53 보완.
test('이름이 같아도 살아 있는 **다른 세션**의 잠금은 가져가지 못한다', () => {
  const r = run('acquire', 'claude', '--pid', String(process.pid))
  assert.equal(r.status, 3, r.stdout)
  assert.match(r.stderr, /다른 세션/)
  assert.equal(JSON.parse(fs.readFileSync(LOCK, 'utf8')).pid, holder.pid, '잠금 주인이 바뀌면 안 된다')
})

test('같은 pid 의 재획득은 갱신이다', () => {
  const r = run('acquire', 'claude', '--pid', String(holder.pid))
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /같은 세션 — 잠금 갱신/)
})

test('--force 는 사용자 지시가 있을 때 인수를 허용한다', () => {
  const r = run('acquire', 'claude', '--pid', String(process.pid), '--force')
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /--force/)
  assert.equal(JSON.parse(fs.readFileSync(LOCK, 'utf8')).pid, process.pid)
  // 뒤 테스트가 기대하는 주인으로 되돌린다
  run('release', 'claude', '--pid', String(process.pid))
  assert.equal(run('acquire', 'claude', '--pid', String(holder.pid)).status, 0)
})

test('남의 잠금은 release 하지 않는다', () => {
  const r = run('release', 'codex')
  assert.equal(r.status, 3)
  assert.ok(fs.existsSync(LOCK))
})

test('주인이 release 하면 풀리고 다른 에이전트가 잡을 수 있다', () => {
  assert.equal(run('release', 'claude', '--pid', String(holder.pid)).status, 0)
  assert.ok(!fs.existsSync(LOCK))
  assert.equal(run('acquire', 'codex', '--pid', String(holder.pid)).status, 0)
  assert.equal(run('release', 'codex', '--pid', String(holder.pid)).status, 0)
})

test('고아 잠금(죽은 pid)은 자동 해제된다', () => {
  const dead = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' })
  const deadPid = Number(dead.stdout)
  fs.writeFileSync(
    LOCK,
    JSON.stringify({ agent: 'codex', pid: deadPid, host: os.hostname(), branch: 'x', started_at: new Date().toISOString() }),
  )
  assert.match(run('status').stdout, /고아/)
  const r = run('acquire', 'claude', '--pid', String(holder.pid))
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /고아 잠금 해제: codex/)
  assert.equal(JSON.parse(fs.readFileSync(LOCK, 'utf8')).agent, 'claude')
  run('release', 'claude', '--pid', String(holder.pid))
})

test('고아 잠금(TTL 초과)은 다른 호스트라도 해제된다', () => {
  const old = new Date(Date.now() - 13 * 3600 * 1000).toISOString()
  fs.writeFileSync(LOCK, JSON.stringify({ agent: 'codex', pid: 1, host: 'other-host', branch: 'x', started_at: old }))
  const r = run('acquire', 'claude', '--pid', String(holder.pid))
  assert.equal(r.status, 0, r.stderr)
  run('release', 'claude', '--pid', String(holder.pid))
})

test('다른 호스트의 최근 잠금은 pid 를 확인할 수 없으니 존중한다', () => {
  fs.writeFileSync(LOCK, JSON.stringify({ agent: 'codex', pid: 1, host: 'other-host', branch: 'x', started_at: new Date().toISOString() }))
  assert.equal(run('acquire', 'claude', '--pid', String(holder.pid)).status, 3)
  fs.rmSync(LOCK)
})

// ── 2026-10-01 Codex 리뷰 P2 세 건 ─────────────────────────────────

test('같은 이름의 **다른 세션**은 살아 있는 잠금을 놓지 못한다(acquire 를 거절당한 세션 포함)', () => {
  assert.equal(run('acquire', 'claude', '--pid', String(holder.pid)).status, 0)
  assert.equal(run('acquire', 'claude', '--pid', String(process.pid)).status, 3) // 거절당한 세션
  const r = run('release', 'claude', '--pid', String(process.pid))
  assert.equal(r.status, 3)
  assert.match(r.stderr, /다른 세션/)
  assert.equal(JSON.parse(fs.readFileSync(LOCK, 'utf8')).pid, holder.pid, '남의 잠금이 지워지면 안 된다')
  assert.equal(run('release', 'claude', '--pid', String(holder.pid)).status, 0)
})

test('에이전트를 못 찾으면 셸 pid 로 잡지 않고 --pid 를 요구한다', () => {
  const r = spawnSync(process.execPath, [CLI, 'acquire', 'claude'], { env: { ...env, AGENT_LOCK_DISCOVERY: 'off' }, encoding: 'utf8' })
  assert.equal(r.status, 64)
  assert.match(r.stderr, /--pid/)
  assert.ok(!fs.existsSync(LOCK))
})

test('엉터리·죽은 pid 로는 잡지 못한다(곧바로 고아가 된다)', () => {
  const dead = Number(spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout)
  for (const bad of ['abc', '0', '-5', String(dead)]) {
    const r = run('acquire', 'claude', '--pid', bad)
    assert.equal(r.status, 64, `--pid ${bad}`)
    assert.ok(!fs.existsSync(LOCK), `--pid ${bad} 로 잠금이 생기면 안 된다`)
  }
})

test('보조 잠금이 남아 있으면 기다리다 물러난다 · 자동으로 지우지 않는다(지우는 판단끼리 경쟁한다)', () => {
  const mutex = `${LOCK}.mutex`
  const quick = (pid) =>
    spawnSync(process.execPath, [CLI, 'acquire', 'claude', '--pid', String(pid)], {
      env: { ...env, AGENT_LOCK_MUTEX_WAIT_MS: '200' },
      encoding: 'utf8',
    })
  // 살아 있는 주인의 보조 잠금 — 잠시 뒤 다시
  fs.writeFileSync(mutex, String(holder.pid))
  const busy = quick(holder.pid)
  assert.equal(busy.status, 3)
  assert.match(busy.stderr, /다른 세션/)
  // 죽은 주인의 보조 잠금 — 오래돼도 지우지 않고, 죽었다고 알리며 사람이 지우게 한다
  const dead = Number(spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout)
  fs.writeFileSync(mutex, String(dead))
  const old = new Date(Date.now() - 60_000)
  fs.utimesSync(mutex, old, old)
  const stale = quick(holder.pid)
  assert.equal(stale.status, 3)
  assert.match(stale.stderr, /죽었다/)
  assert.ok(fs.existsSync(mutex), '보조 잠금을 자동으로 지우면 안 된다')
  assert.ok(!fs.existsSync(LOCK))
  // 사람이 확인하고 지운 뒤에는 잡힌다 · 끝나면 보조 잠금도 지워진다
  fs.rmSync(mutex)
  assert.equal(run('acquire', 'claude', '--pid', String(holder.pid)).status, 0)
  assert.ok(!fs.existsSync(mutex), '보조 잠금은 끝나면 지워진다')
  assert.equal(run('release', 'claude', '--pid', String(holder.pid)).status, 0)
})

test('고아 잠금 정리와 획득이 동시에 일어나도 잠금은 하나만 남는다', async () => {
  const deadPid = Number(spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout)
  fs.writeFileSync(LOCK, JSON.stringify({ agent: 'codex', pid: deadPid, host: os.hostname(), branch: 'x', started_at: new Date().toISOString() }))
  const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], { stdio: 'ignore' })
  try {
    const go = (pid) =>
      new Promise((res) => {
        const p = spawn(process.execPath, [CLI, 'acquire', 'claude', '--pid', String(pid)], { env, stdio: 'ignore' })
        p.on('exit', (code) => res(code))
      })
    const codes = await Promise.all([go(holder.pid), go(other.pid)])
    assert.deepEqual([...codes].sort(), [0, 3], `한쪽만 잡아야 한다: ${codes}`)
    const owner = JSON.parse(fs.readFileSync(LOCK, 'utf8')).pid
    assert.ok(owner === holder.pid || owner === other.pid)
    assert.equal(run('release', 'claude', '--pid', String(owner)).status, 0)
  } finally {
    other.kill()
  }
})
