// scripts/csat/__tests__/meaning-support-isolated-seed.test.mjs
//
// 격리 seed 가드 — 거부 사유마다 **쓰기 0**(가짜 DB 의 쓰기 기록 · marker 쓰기 · DB 생성 호출)을 단언한다.
// 실제 DB 에 닿지 않는다(가짜 클라이언트만). 같은 run/manifest 두 번 = 결과 동일, 다른 manifest = 중단.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ALLOWED_ITEM_IDS, FIXTURE, SeedRefusal, checkManifestAgainstRecords, guardEnv, manifestHash, runSeed } from '../meaning-support-isolated-seed.mjs'

const OK_ENV = Object.freeze({
  VOCAFLOW_CSAT_ISOLATED_NAMESPACE: 'csat-v31',
  VOCAFLOW_CSAT_ISOLATED_RUN_ID: '123456-1',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'local-demo-service-role-key-not-secret',
})
const RECORDS = { '2026#22': { analysis_version: 5 }, '2026#34': { analysis_version: 5 }, '2026#38': { analysis_version: 5 } }

/** 가짜 DB — 쓰기를 기록하고 행을 메모리에 둔다. gate 기본 = RPC 부재(이 저장소의 격리 DB 와 같다) */
function fakeDb({ preexisting = [], gate } = {}) {
  const rows = new Map()
  for (const id of preexisting) rows.set(id, { id })
  const writes = []
  let created = 0
  const db = {
    async existing(_t, ids) { return ids.filter((id) => rows.has(id)) },
    async upsert(table, list, onConflict) {
      writes.push({ op: 'upsert', table, n: list.length })
      for (const r of list) {
        const key = table === 'csat_item_analyses' ? `${r.item_id}@${r.version}` : table === 'csat_analysis_reviews' ? `${r.analysis_id}/${r.persona}` : r.id
        rows.set(`${table}:${key}`, { ...(rows.get(`${table}:${key}`) ?? {}), ...r, id: rows.get(`${table}:${key}`)?.id ?? (table === 'csat_item_analyses' ? `a-${key}` : r.id) })
        if (['csat_exams', 'csat_types', 'csat_items'].includes(table)) rows.set(r.id, r)
      }
      return list
    },
    async analysesOf(itemIds) {
      return [...rows.entries()].filter(([k]) => k.startsWith('csat_item_analyses:')).map(([, v]) => v).filter((v) => itemIds.includes(v.item_id))
    },
    async setStatus(ids, status) {
      writes.push({ op: 'update', table: 'csat_item_analyses', n: ids.length })
      for (const [k, v] of rows) if (k.startsWith('csat_item_analyses:') && ids.includes(v.id)) v.status = status
    },
    async gate() { return gate ?? { items: null, exams: null, error: 'PGRST202 Could not find the function public.csat_ec_embargoed_items(p_items) in the schema cache' } },
  }
  return {
    db, writes, rows,
    makeDb: async () => { created += 1; return db },
    get created() { return created },
  }
}
function memMarker(initial = null) {
  let m = initial
  let writes = 0
  return { io: { read: () => m, write: (x) => { writes += 1; m = structuredClone(x) } }, get value() { return m }, get writes() { return writes } }
}

async function expectRefusedZeroWrites(args, re) {
  const f = fakeDb(args.fake)
  const mk = memMarker(args.marker ?? null)
  await assert.rejects(
    runSeed({ env: args.env ?? OK_ENV, commit: true, ids: args.ids, records: RECORDS, makeDb: f.makeDb, markerIo: mk.io }),
    (e) => e instanceof SeedRefusal && re.test(e.message),
  )
  assert.equal(f.writes.length, 0, 'DB 쓰기 0')
  assert.equal(mk.writes, 0, 'marker 쓰기 0')
  return f
}

test('원격 host 거부 — DB 생성 · 쓰기 0', async () => {
  const f = await expectRefusedZeroWrites({ env: { ...OK_ENV, NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefgh.supabase.co' } }, /http|loopback/)
  assert.equal(f.created, 0)
  const g = await expectRefusedZeroWrites({ env: { ...OK_ENV, NEXT_PUBLIC_SUPABASE_URL: 'http://10.0.0.5:54321' } }, /loopback/)
  assert.equal(g.created, 0)
})

test('잘못된 port 거부', async () => {
  const f = await expectRefusedZeroWrites({ env: { ...OK_ENV, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:5432' } }, /port/)
  assert.equal(f.created, 0)
})

test('namespace 누락 · 잘못된 값 거부', async () => {
  const { VOCAFLOW_CSAT_ISOLATED_NAMESPACE: _drop, ...noNs } = OK_ENV
  assert.equal((await expectRefusedZeroWrites({ env: noNs }, /미설정/)).created, 0)
  assert.equal((await expectRefusedZeroWrites({ env: { ...OK_ENV, VOCAFLOW_CSAT_ISOLATED_NAMESPACE: 'csat-v3' } }, /다른 값/)).created, 0)
  assert.equal((await expectRefusedZeroWrites({ env: { ...OK_ENV, VOCAFLOW_CSAT_ISOLATED_NAMESPACE: 'CSAT-V31 ' } }, /다른 값/)).created, 0)
})

test('run ID 형식 · 길이 위반 거부', async () => {
  for (const bad of ['', 'abc-1', '123', '123-', '12-3-4', '1 -2']) {
    assert.equal((await expectRefusedZeroWrites({ env: { ...OK_ENV, VOCAFLOW_CSAT_ISOLATED_RUN_ID: bad } }, /RUN_ID/)).created, 0, bad)
  }
  const long = `${'1'.repeat(60)}-12345`
  assert.equal((await expectRefusedZeroWrites({ env: { ...OK_ENV, VOCAFLOW_CSAT_ISOLATED_RUN_ID: long } }, /64자/)).created, 0)
})

test('거부 메시지에 URL · 키 원문이 없다', () => {
  const env = { ...OK_ENV, NEXT_PUBLIC_SUPABASE_URL: 'https://secret-host.example.com:443', SUPABASE_SERVICE_ROLE_KEY: 'sk-very-secret' }
  try { guardEnv(env); assert.fail('거부돼야 한다') } catch (e) {
    assert.ok(!e.message.includes('secret-host') && !e.message.includes('sk-very-secret'))
  }
})

test('다른 소유 marker(다른 run) 거부', async () => {
  const marker = { namespace: 'csat-v31', runId: '999-1', manifestHash: manifestHash(FIXTURE) }
  assert.equal((await expectRefusedZeroWrites({ marker }, /다른 run/)).created, 0)
})

test('marker 없는 기존 fixture ID 거부 — 소유 주장 · 쓰기 0', async () => {
  await expectRefusedZeroWrites({ fake: { preexisting: ['2026#34'] } }, /이미 존재/)
  await expectRefusedZeroWrites({ fake: { preexisting: ['2026'] } }, /이미 존재/)
})

test('allowlist 밖 문항 ID 거부', async () => {
  assert.equal((await expectRefusedZeroWrites({ ids: ['2026#34', '2026#31'] }, /allowlist/)).created, 0)
})

test('같은 run · manifest 두 번 = 같은 결과(멱등)', async () => {
  const f = fakeDb()
  const mk = memMarker()
  const a = await runSeed({ env: OK_ENV, commit: true, records: RECORDS, makeDb: f.makeDb, markerIo: mk.io })
  const snap1 = JSON.stringify([...f.rows.entries()].sort())
  const b = await runSeed({ env: OK_ENV, commit: true, records: RECORDS, makeDb: f.makeDb, markerIo: mk.io })
  const snap2 = JSON.stringify([...f.rows.entries()].sort())
  assert.deepEqual(a, b)
  assert.equal(snap1, snap2)
  assert.equal(mk.writes, 1, 'marker 는 처음 한 번만 쓴다')
  assert.equal(a.counts.analyses, 3)
  const status = [...f.rows.entries()].filter(([k]) => k.startsWith('csat_item_analyses:')).map(([k, v]) => `${k}=${v.status}`).sort()
  assert.deepEqual(status, ['csat_item_analyses:2026#22@5=published', 'csat_item_analyses:2026#34@5=published', 'csat_item_analyses:2026#38@6=published'])
})

test('같은 run 이지만 다른 manifest = 중단', async () => {
  const marker = { namespace: 'csat-v31', runId: OK_ENV.VOCAFLOW_CSAT_ISOLATED_RUN_ID, manifestHash: 'deadbeef' }
  await expectRefusedZeroWrites({ marker }, /manifest 가 다르다/)
  // 부분 집합 manifest 도 다른 manifest 다
  const full = { namespace: 'csat-v31', runId: OK_ENV.VOCAFLOW_CSAT_ISOLATED_RUN_ID, manifestHash: manifestHash(FIXTURE) }
  await expectRefusedZeroWrites({ marker: full, ids: ['2026#34'] }, /manifest 가 다르다/)
})

test('dry-run 은 DB 를 만들지 않는다', async () => {
  const f = fakeDb()
  const mk = memMarker()
  const r = await runSeed({ env: OK_ENV, commit: false, records: RECORDS, makeDb: f.makeDb, markerIo: mk.io })
  assert.equal(r.mode, 'dry-run')
  assert.equal(f.created, 0)
  assert.equal(mk.writes, 0)
})

test('Reveal Gate 부재 = 기대(fail-closed) · 생기면 실패(spec 갱신 신호)', async () => {
  for (const err of ['42883 function public.csat_ec_embargoed_items(text[]) does not exist', 'PGRST202 Could not find the function']) {
    const missing = fakeDb({ gate: { items: null, exams: null, error: err } })
    const r = await runSeed({ env: OK_ENV, commit: true, records: RECORDS, makeDb: missing.makeDb, markerIo: memMarker().io })
    assert.equal(r.mode, 'committed')
    assert.equal(r.counts.analyses, 3, '행은 게이트가 생길 때를 위해 그대로 준비한다')
  }
  for (const gate of [{ items: ['2026#22'], exams: [], error: null }, { items: [], exams: [], error: null }]) {
    const present = fakeDb({ gate })
    await assert.rejects(
      runSeed({ env: OK_ENV, commit: true, records: RECORDS, makeDb: present.makeDb, markerIo: memMarker().io }),
      /Reveal Gate 가 격리 DB 에 생겼다 — csat-v31-meaning\.isolated\.spec 을 공개\/stale 케이스로 갱신해야 한다/,
    )
  }
  // 다른 오류(권한 · 네트워크)는 부재로 보지 않는다 — 크게 실패
  const other = fakeDb({ gate: { items: null, exams: null, error: '42501 permission denied' } })
  await assert.rejects(runSeed({ env: OK_ENV, commit: true, records: RECORDS, makeDb: other.makeDb, markerIo: memMarker().io }), /Reveal Gate 가 격리 DB 에 생겼다/)
})

test('manifest 버전은 배포 탐구 결속과 맞아야 한다(stale = +1)', () => {
  checkManifestAgainstRecords(RECORDS)
  assert.throws(() => checkManifestAgainstRecords({ ...RECORDS, '2026#38': { analysis_version: 6 } }), /버전 불일치/)
  assert.deepEqual([...ALLOWED_ITEM_IDS].sort(), ['2026#22', '2026#34', '2026#38'])
})

test('IPv6 loopback · localhost 허용', () => {
  assert.equal(guardEnv({ ...OK_ENV, NEXT_PUBLIC_SUPABASE_URL: 'http://[::1]:54321' }).runId, '123456-1')
  assert.equal(guardEnv({ ...OK_ENV, NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321/' }).namespace, 'csat-v31')
})
