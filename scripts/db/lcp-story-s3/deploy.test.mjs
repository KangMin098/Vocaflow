// scripts/db/lcp-story-s3/deploy.test.mjs — node --test scripts/db/lcp-story-s3/deploy.test.mjs
//
// 승인형 러너가 DB 에 닿기 전에 닫히는지(fail closed) — 순수 함수와 실제 프로세스 실행으로 본다. DB 접속 · 티켓 발급 없음.
// 프로세스 시험은 빈 임시 승인 폴더(VF_DB_APPROVAL_DIR)와 없는 env 파일(VF_DEPLOY_ENV_FILE)을 넘겨 실제 승인 기록 · 접속 문자열을 읽지 않는다.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  applyAuthorizationBlocks, evaluate, HISTORY_SQL, LEGACY_FINGERPRINT_SQL, offlineCheck, parseArgs, PREFLIGHT_SQL, STAGES, VERIFY_SQL,
} from './deploy.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..', '..')
const RUNNER = path.join(HERE, 'deploy.mjs')
const nonce = 'a'.repeat(48)
const schemaOk = { stage: 'schema', confirmSha: STAGES.schema.sha256 }
const mineSchema = { version: STAGES.schema.version, name: STAGES.schema.name, sha256: STAGES.schema.sha256 }
const mineQuarantine = { version: STAGES.quarantine.version, name: STAGES.quarantine.name, sha256: STAGES.quarantine.sha256 }

test('단계 SHA = 저장소 SQL 파일 바이트 sha256 · 본문 경로는 보류 SQL 두 파일뿐', () => {
  for (const [stage, st] of Object.entries(STAGES)) {
    assert.match(st.path, /^supabase\/migrations\/_pending_lcp_story_s3_(schema|quarantine)\.sql$/)
    const buf = fs.readFileSync(path.join(ROOT, st.path))
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), st.sha256, stage)
    assert.deepEqual(offlineCheck(stage).blocks, [], stage)
    assert.match(st.sha256, /^[0-9a-f]{64}$/)
    assert.notEqual(st.sha256, '0'.repeat(64))
  }
})

test('본문이 한 바이트라도 바뀌면 sha 차단 · 없는 단계 · 없는 파일도 차단', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcp-story-s3-runner-'))
  try {
    const target = path.join(dir, STAGES.schema.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, fs.readFileSync(path.join(ROOT, STAGES.schema.path), 'utf8').replace(/\n/g, '\r\n'))
    assert.match(offlineCheck('schema', { root: dir }).blocks.join(), /DEPLOY_BLOCKED\[sha\]/)
    assert.match(offlineCheck('quarantine', { root: dir }).blocks.join(), /가 없다/)
    assert.match(offlineCheck('nope').blocks.join(), /DEPLOY_BLOCKED\[stage\]/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('자동화 · CI 는 난수 · TTY 어느 경로든 거부', () => {
  for (const env of [{ VFC_AUTOMATED_RUN: '1' }, { AGENT_GUARD_ASK: '0' }, { CI: 'true' }]) {
    assert.match(applyAuthorizationBlocks({ ...schemaOk, approvalNonce: nonce }, { tty: false, env }).join(), /automated/)
    assert.match(applyAuthorizationBlocks(schemaOk, { tty: true, env }).join(), /automated/)
  }
})

test('대화형 경로만 통과 · 비TTY 난수 없음 · SHA 불일치 · 모르는 단계는 차단', () => {
  assert.deepEqual(applyAuthorizationBlocks({ ...schemaOk, approvalNonce: nonce }, { tty: false, env: {} }), [])
  assert.deepEqual(applyAuthorizationBlocks(schemaOk, { tty: true, env: { CI: 'false' } }), [])
  assert.match(applyAuthorizationBlocks(schemaOk, { tty: false, env: {} }).join(), /nonce/)
  assert.match(applyAuthorizationBlocks({ ...schemaOk, confirmSha: STAGES.quarantine.sha256 }, { tty: true, env: {} }).join(), /sha/)
  assert.match(applyAuthorizationBlocks({ stage: 'drop', confirmSha: 'x' }, { tty: true, env: {} }).join(), /stage/)
})

test('순서 — schema 는 한 번만 · quarantine 은 schema 이력 SHA 가 승인값일 때만 · verify 는 자기 이력 SHA 필수', () => {
  assert.deepEqual(evaluate('schema', [], { mode: 'apply' }), [])
  assert.match(evaluate('schema', [mineSchema], { mode: 'apply' }).join(), /already/)
  assert.match(evaluate('quarantine', [], { mode: 'apply' }).join(), /order/)
  assert.match(evaluate('quarantine', [{ ...mineSchema, sha256: 'bad' }], { mode: 'apply' }).join(), /order/)
  assert.deepEqual(evaluate('quarantine', [mineSchema], { mode: 'apply' }), [])
  assert.match(evaluate('quarantine', [mineSchema, mineQuarantine], { mode: 'apply' }).join(), /already/)
  assert.deepEqual(evaluate('schema', [mineSchema], { mode: 'verify' }), [])
  assert.match(evaluate('schema', [{ ...mineSchema, sha256: 'other' }], { mode: 'verify' }).join(), /history/)
  assert.match(evaluate('nope', [], { mode: 'apply' }).join(), /stage/)
})

test('러너 SQL 은 상수뿐 — 이력은 이 러너 버전만 읽고, 사용자 입력 SQL 인자가 없다', () => {
  assert.match(HISTORY_SQL, new RegExp(`version in \\('${STAGES.schema.version}','${STAGES.quarantine.version}'\\)`))
  assert.deepEqual(Object.keys(parseArgs(['apply', '--sql', 'drop table x', '--stage', 'schema'])).sort(),
    ['approvalNonce', 'cmd', 'confirmSha', 'deps', 'stage', 'urlEnv'])
  for (const name of ['library_books', 'user_profiles', 'texts', 'content_chunks', 'reading_sessions']) {
    assert.match(LEGACY_FINGERPRINT_SQL, new RegExp(`'${name}'`))
  }
  const names = (list) => list.map((q) => q.match(/select '([a-z_]+)'/)[1])
  assert.ok(names(PREFLIGHT_SQL.schema).includes('story_schema_absent'))
  assert.ok(names(VERIFY_SQL.schema).includes('no_client_table_privileges'))
  assert.ok(names(VERIFY_SQL.schema).includes('anon_only_catalog'))
  assert.ok(names(VERIFY_SQL.schema).includes('rpc_definer_search_path_pg_temp'))
  assert.ok(names(VERIFY_SQL.quarantine).includes('rpc_closed'))
})

function run(args, extraEnv = {}) {
  const approvals = fs.mkdtempSync(path.join(os.tmpdir(), 'lcp-story-s3-approvals-'))
  const env = { ...process.env, VF_DB_APPROVAL_DIR: approvals, VF_DEPLOY_ENV_FILE: path.join(approvals, 'no-such.env'), ...extraEnv }
  for (const k of ['CI', 'VFC_AUTOMATED_RUN', 'AGENT_GUARD_ASK', 'VF_DEPLOY_DB_URL']) if (!(k in extraEnv)) delete env[k]
  try {
    const r = spawnSync(process.execPath, [RUNNER, ...args], { cwd: ROOT, env, encoding: 'utf8', input: '', timeout: 60_000 })
    return { status: r.status, out: `${r.stdout}${r.stderr}`, approvalsAfter: fs.readdirSync(approvals) }
  } finally {
    fs.rmSync(approvals, { recursive: true, force: true })
  }
}

test('실제 실행: 사용법 오류는 1 · 승인 없이 apply 는 DB 접속 전에 2 · 승인 폴더에 아무것도 남기지 않는다', () => {
  const logDir = path.join(HERE, 'logs')
  const logsBefore = fs.existsSync(logDir) ? fs.readdirSync(logDir).length : 0
  assert.equal(run(['bogus']).status, 1)
  assert.equal(run(['apply', '--stage', 'everything']).status, 1)
  assert.equal(run(['preflight', '--stage', 'schema']).status, 1) // --deps 없음 — 접속 전에 멈춘다

  const wrongSha = run(['apply', '--stage', 'schema', '--confirm-sha', STAGES.quarantine.sha256])
  assert.equal(wrongSha.status, 2)
  assert.match(wrongSha.out, /DEPLOY_BLOCKED\[sha\]/)

  const noNonce = run(['apply', '--stage', 'schema', '--confirm-sha', STAGES.schema.sha256])
  assert.equal(noNonce.status, 2)
  assert.match(noNonce.out, /DEPLOY_BLOCKED\[permission\]/)

  const forgedNonce = run(['apply', '--stage', 'schema', '--confirm-sha', STAGES.schema.sha256, '--approval-nonce', nonce])
  assert.equal(forgedNonce.status, 2)
  assert.match(forgedNonce.out, /DEPLOY_BLOCKED\[permission\]/)
  assert.deepEqual(forgedNonce.approvalsAfter, [])

  const automated = run(['apply', '--stage', 'schema', '--confirm-sha', STAGES.schema.sha256, '--approval-nonce', nonce], { VFC_AUTOMATED_RUN: '1' })
  assert.equal(automated.status, 2)
  assert.match(automated.out, /automated/)

  for (const r of [wrongSha, noNonce, forgedNonce, automated]) assert.doesNotMatch(r.out, /postgres(ql)?:\/\//)
  const logsAfter = fs.existsSync(logDir) ? fs.readdirSync(logDir).length : 0
  assert.equal(logsAfter, logsBefore, '차단된 실행은 로그를 만들지 않는다(DB 에 닿지 않았다)')
})
