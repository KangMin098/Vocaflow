// scripts/csat/__tests__/meaning-support-isolated-gate-fault.test.mjs
//
// 게이트 고장 주입 가드 — 거부마다 psql 호출 0 · 클라이언트 생성 0(쓰기 0)을 단언한다. 실제 DB 에 닿지 않는다.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ABSENT_SQL, runFault } from '../meaning-support-isolated-gate-fault.mjs'
import { SeedRefusal } from '../meaning-support-isolated-seed.mjs'

const OK_ENV = Object.freeze({
  VOCAFLOW_CSAT_ISOLATED_NAMESPACE: 'csat-v31',
  VOCAFLOW_CSAT_ISOLATED_RUN_ID: '123456-1',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'local-demo-service-role-key-not-secret',
  VOCAFLOW_CSAT_ISOLATED_DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
})
const OWNER = { namespace: 'csat-v31', runId: '123456-1', manifestHash: 'x' }

function harness({ marker = OWNER, rpcError = { code: 'PGRST202', message: 'Could not find the function' } } = {}) {
  const calls = { psql: 0, client: 0 }
  return {
    calls,
    markerIo: { read: () => marker, write: () => { throw new Error('marker 를 쓰면 안 된다') } },
    psql: () => { calls.psql += 1; return { status: 0, stderr: '' } },
    makeClient: async () => { calls.client += 1; return { rpc: async () => ({ data: null, error: rpcError }) } },
  }
}

async function refused(env, argv, re, opts) {
  const h = harness(opts)
  await assert.rejects(runFault({ env, argv, markerIo: h.markerIo, psql: h.psql, makeClient: h.makeClient }), (e) => e instanceof SeedRefusal && re.test(e.message))
  assert.deepEqual(h.calls, { psql: 0, client: 0 }, '쓰기 0')
}

const ARGV = ['--mode', 'absent', '--commit']

test('원격 API host · 잘못된 port 거부', async () => {
  await refused({ ...OK_ENV, NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' }, ARGV, /http|loopback/)
  await refused({ ...OK_ENV, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:8000' }, ARGV, /port/)
})

test('원격 DB URL · 잘못된 DB port · 누락 거부', async () => {
  await refused({ ...OK_ENV, VOCAFLOW_CSAT_ISOLATED_DB_URL: 'postgresql://u:p@db.abcdefgh.supabase.co:5432/postgres' }, ARGV, /loopback/)
  await refused({ ...OK_ENV, VOCAFLOW_CSAT_ISOLATED_DB_URL: 'postgresql://u:p@127.0.0.1:5432/postgres' }, ARGV, /54322/)
  const { VOCAFLOW_CSAT_ISOLATED_DB_URL: _d, ...noDb } = OK_ENV
  await refused(noDb, ARGV, /미설정/)
})

test('namespace · run ID 위반 거부', async () => {
  await refused({ ...OK_ENV, VOCAFLOW_CSAT_ISOLATED_NAMESPACE: 'other' }, ARGV, /NAMESPACE/)
  await refused({ ...OK_ENV, VOCAFLOW_CSAT_ISOLATED_RUN_ID: 'abc' }, ARGV, /RUN_ID/)
  await refused({ ...OK_ENV, VOCAFLOW_CSAT_ISOLATED_RUN_ID: `${'9'.repeat(70)}-1` }, ARGV, /64자/)
})

test('mode 누락 · 미지원 거부', async () => {
  await refused(OK_ENV, ['--commit'], /--mode/)
  await refused(OK_ENV, ['--mode', 'slow', '--commit'], /--mode/)
})

test('seed 소유 marker 없음 · 다른 run 거부', async () => {
  await refused(OK_ENV, ARGV, /marker 없음/, { marker: null })
  await refused(OK_ENV, ARGV, /다른 namespace\/run/, { marker: { ...OWNER, runId: '999-1' } })
})

test('거부 메시지에 DB URL · 비밀번호가 없다', async () => {
  const h = harness()
  try {
    await runFault({ env: { ...OK_ENV, VOCAFLOW_CSAT_ISOLATED_DB_URL: 'postgresql://u:topsecret@remote.example.com:5432/x' }, argv: ARGV, markerIo: h.markerIo, psql: h.psql, makeClient: h.makeClient })
    assert.fail('거부돼야 한다')
  } catch (e) {
    assert.ok(!e.message.includes('topsecret') && !e.message.includes('remote.example.com'))
  }
})

test('dry-run 은 psql · 클라이언트 0', async () => {
  const h = harness()
  const r = await runFault({ env: OK_ENV, argv: ['--mode', 'absent'], markerIo: h.markerIo, psql: h.psql, makeClient: h.makeClient })
  assert.equal(r.mode, 'dry-run')
  assert.deepEqual(h.calls, { psql: 0, client: 0 })
})

test('commit — DROP 3개 · 부재 확인', async () => {
  const h = harness()
  const r = await runFault({ env: OK_ENV, argv: ARGV, markerIo: h.markerIo, psql: h.psql, makeClient: h.makeClient })
  assert.deepEqual(r, { mode: 'committed', verified: true })
  assert.equal(h.calls.psql, 1)
  for (const fn of ['csat_ec_embargoed_items(text[])', 'csat_ec_embargoed_exams(text[])', 'csat_ec_reveal_state(uuid)']) assert.ok(ABSENT_SQL.includes(fn), fn)
})
