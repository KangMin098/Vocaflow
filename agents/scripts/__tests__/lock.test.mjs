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

test('남의 잠금은 release 하지 않는다', () => {
  const r = run('release', 'codex')
  assert.equal(r.status, 3)
  assert.ok(fs.existsSync(LOCK))
})

test('주인이 release 하면 풀리고 다른 에이전트가 잡을 수 있다', () => {
  assert.equal(run('release', 'claude').status, 0)
  assert.ok(!fs.existsSync(LOCK))
  assert.equal(run('acquire', 'codex', '--pid', String(holder.pid)).status, 0)
  assert.equal(run('release', 'codex').status, 0)
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
  run('release', 'claude')
})

test('고아 잠금(TTL 초과)은 다른 호스트라도 해제된다', () => {
  const old = new Date(Date.now() - 13 * 3600 * 1000).toISOString()
  fs.writeFileSync(LOCK, JSON.stringify({ agent: 'codex', pid: 1, host: 'other-host', branch: 'x', started_at: old }))
  const r = run('acquire', 'claude', '--pid', String(holder.pid))
  assert.equal(r.status, 0, r.stderr)
  run('release', 'claude')
})

test('다른 호스트의 최근 잠금은 pid 를 확인할 수 없으니 존중한다', () => {
  fs.writeFileSync(LOCK, JSON.stringify({ agent: 'codex', pid: 1, host: 'other-host', branch: 'x', started_at: new Date().toISOString() }))
  assert.equal(run('acquire', 'claude', '--pid', String(holder.pid)).status, 3)
  fs.rmSync(LOCK)
})
