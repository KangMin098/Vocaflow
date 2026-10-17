// scripts/db/factory-i1/deploy.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { targetOf, writeAuthorizationBlocks, canonicalRunnerBlock, resolveDbUrl, redactText, offlineCheck, evaluatePreflight, applyStage } from './deploy.mjs'
import { issueTicket, NONCE_FLAG } from '../../../agents/scripts/db-approval.mjs'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROJECT_REF } from './spec.mjs'
import { PREFLIGHT_SQL } from './sql.mjs'
import { buildAll } from './build.mjs'
import fs from 'node:fs'
const url = `postgresql://postgres:example-password@db.${PROJECT_REF}.supabase.co:5432/postgres`

test('production target rejects pg query overrides, protocol, database, pooler mode and alternate ports', () => {
  assert.equal(targetOf(url).ok, true)
  for (const bad of [url + '?host=another-project', url + '?sslmode=disable', url + '#fragment', url.replace('postgresql:', 'https:'),
    url.replace(/\/postgres$/, '/other'), url.replace(':5432/', ':6543/'), url.replace(':5432/', '/'), url.replace(PROJECT_REF, 'otherproject'),
    `postgresql://postgres.${PROJECT_REF}:x@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`]) assert.equal(targetOf(bad).ok, false)
  assert.equal(targetOf(`postgresql://postgres.${PROJECT_REF}:x@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres`).ok, true)
})

test('approval metadata and a TTY never override auto/CI or isolated CLI write blocks', () => {
  const terminal = { env: {}, stdinIsTTY: true, stdoutIsTTY: true }
  for (const env of [{ VFC_AUTOMATED_RUN: '1' }, { AGENT_GUARD_ASK: '0' }, { CI: 'true' }]) {
    assert.ok(writeAuthorizationBlocks({ approvedBy: 'user says yes' }, { ...terminal, env }).length)
  }
  assert.ok(writeAuthorizationBlocks({ isolated: true }, terminal).length)
  assert.ok(writeAuthorizationBlocks({}, { ...terminal, stdinIsTTY: false }).length)
  assert.ok(writeAuthorizationBlocks({}, { ...terminal, stdoutIsTTY: false }).length)
  // Passing this gate means an interactive executor is eligible, not that user approval has been proven.
  assert.deepEqual(writeAuthorizationBlocks({}, terminal), [])
})

test('approval-nonce mode: marker never overrides auto/CI/isolated; no marker keeps the non-TTY block', () => {
  const pipe = { env: {}, stdinIsTTY: false, stdoutIsTTY: false }
  assert.ok(writeAuthorizationBlocks({}, pipe).length)
  assert.deepEqual(writeAuthorizationBlocks({}, { ...pipe, ticket: true }), [])
  for (const env of [{ VFC_AUTOMATED_RUN: '1' }, { AGENT_GUARD_ASK: '0' }, { CI: 'true' }]) assert.ok(writeAuthorizationBlocks({}, { ...pipe, env, ticket: true }).length)
  assert.ok(writeAuthorizationBlocks({ isolated: true }, { ...pipe, ticket: true }).length)
})

test('approval-nonce mode accepts only the canonical runner file (copies / other entry points rejected)', () => {
  assert.equal(canonicalRunnerBlock(fileURLToPath(new URL('./deploy.mjs', import.meta.url))), null)
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vf-runner-')), 'deploy.mjs')
  fs.copyFileSync(fileURLToPath(new URL('./deploy.mjs', import.meta.url)), copy)
  assert.ok(canonicalRunnerBlock(copy))
  assert.ok(canonicalRunnerBlock(undefined))
})

test('DB URL: shell env wins, else the key alone from .env.local candidates; missing → undefined', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-env-'))
  const f = path.join(d, '.env.local')
  fs.writeFileSync(f, 'OTHER=x\nVF_DEPLOY_DB_URL="postgresql://u:p@h:5432/postgres"\n')
  assert.equal(resolveDbUrl('VF_DEPLOY_DB_URL', { env: {}, files: [f] }), 'postgresql://u:p@h:5432/postgres')
  assert.equal(resolveDbUrl('VF_DEPLOY_DB_URL', { env: { VF_DEPLOY_DB_URL: 'env' }, files: [f] }), 'env')
  assert.equal(resolveDbUrl('NOPE', { env: {}, files: [f] }), undefined)
})

test('runner CLI (non-TTY): apply without a valid approval nonce exits 2 before any connection; ticket survives bad attempts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-approval-'))
  const sha = buildAll().db1.sha256
  const runner = fileURLToPath(new URL('./deploy.mjs', import.meta.url))
  const { nonce } = issueTicket({ runner: 'factory-i1', stage: 'db1', sha, dir })
  const run = (extra, env = {}) => spawnSync(process.execPath, [runner, 'apply', '--stage', 'db1', '--confirm-sha', sha, ...extra], {
    env: { ...process.env, VF_DB_APPROVAL_DIR: dir, VF_DEPLOY_DB_URL: '', VF_DEPLOY_ENV_FILE: path.join(dir, 'none'), CI: '', VFC_AUTOMATED_RUN: '', AGENT_GUARD_ASK: '', ...env },
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  })
  for (const [extra, env] of [[[]], [[NONCE_FLAG, 'b'.repeat(48)]], [[NONCE_FLAG, nonce], { CI: 'true' }], [[NONCE_FLAG, nonce], { VFC_AUTOMATED_RUN: '1' }]]) {
    const r = run(extra, env)
    assert.equal(r.status, 2, `${JSON.stringify(extra)} ${JSON.stringify(env)}\n${r.stderr}`)
    assert.match(r.stderr, /DEPLOY_BLOCKED\[permission\]/)
  }
  assert.equal(fs.readdirSync(dir).filter((f) => f.endsWith('.consumed')).length, 0, '거절된 시도는 티켓을 태우지 않는다')
  // 유효한 난수: 승인은 통과하고 접속 단계에서 멈춘다(접속 문자열 없음) — 티켓은 1회 소비
  const ok = run([NONCE_FLAG, nonce])
  assert.notEqual(ok.status, 2, ok.stderr)
  assert.match(ok.stdout, /Claude Code 승인 확인/)
  assert.equal(fs.readdirSync(dir).filter((f) => f.endsWith('.consumed')).length, 1)
  assert.equal(run([NONCE_FLAG, nonce]).status, 2, '재사용 거절')
})

test('errors/logs remove full URLs and both encoded and decoded passwords', () => {
  const secret = url.replace('example-password', 'secret%24password')
  const text = redactText(`failure ${secret} secret%24password secret$password`, secret)
  assert.ok(!text.includes('secret'))
  assert.ok(!text.includes('postgresql://'))
})

test('package generation, all source bytes and version files remain bound', () => {
  assert.deepEqual(offlineCheck().blocks, [])
})

test('read-only measured remote checkpoint still admits DB-1 and rejects DB-2', () => {
  const pre = JSON.parse(fs.readFileSync(new URL('../../../docs/research/factory-i1-deploy-286-independent/remote-preflight.json', import.meta.url))).preflight
  assert.deepEqual(evaluatePreflight('db1', pre), [])
  assert.ok(evaluatePreflight('db2', pre).some((b) => b.includes('[db1-first]')))
  const changed = structuredClone(pre)
  changed.history.versions_after_20261014091841 = ['20261016000000']
  assert.ok(evaluatePreflight('db1', changed).some((b) => b.includes('[history]')))
})

test('COMMIT shutdown/connection errors remain unknown even when ROLLBACK responds', async () => {
  const pre = JSON.parse(fs.readFileSync(new URL('../../../docs/research/factory-i1-deploy-286-independent/remote-preflight.json', import.meta.url))).preflight
  const { db1 } = buildAll()
  for (const code of ['ECONNRESET', '57P01', 'XX000', '08006', '40003']) {
    let commitSent = false
    const client = { on() {}, off() {}, async query(q) {
      if (q === PREFLIGHT_SQL) return { rows: [{ preflight: pre }] }
      if (q === 'commit') { commitSent = true; throw Object.assign(new Error('COMMIT response lost'), { code }) }
      return { command: q === 'rollback' ? 'ROLLBACK' : '' }
    } }
    const r = await applyStage(client, 'db1', { text: db1.text, sha: db1.sha256, approvedBy: 'test' })
    assert.equal(commitSent, true)
    assert.equal(r.outcome, 'unknown', code)
  }
})
