// scripts/textbook/__tests__/factory-order-draft.test.mjs
// 합성 Cookie · fake fetch · 메모리 파일만 쓴다 — 실제 서버·DB 에 닿지 않는다.
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { test } from 'node:test'

import {
  FACTORY_ORDER_DRAFT_PATH,
  MAX_INPUT_BYTES,
  PRODUCT_ORDER_LINEAGE_PATH,
  loopbackOrigin,
  run,
} from '../factory-order-draft.mjs'

const COOKIE = 'sb-synthetic-auth-token=synthetic-cookie-value'
const USER = '11111111-1111-4111-8111-111111111111'
const WS = '22222222-2222-4222-8222-222222222222'
const INPUT = JSON.stringify({ demand_id: USER, line_id: WS, signature: 'synthetic' })

const DRAFT = {
  status: 'draft_prepared',
  persisted: false,
  lineage: 'not_registered',
  production: 'not_started',
  delivery: 'not_performed',
  mapping: 'candidate_unvalidated',
  registrable: false,
  factory: { order_hash: 'h'.repeat(64) },
  blockers: ['lineage_not_registered', 'production_not_run'],
}

function harness({ env = { VOCAFLOW_ADMIN_COOKIE: COOKIE }, files = {}, response, fetchError } = {}) {
  const calls = []
  const written = {}
  const logs = []
  const deps = {
    env,
    fetch: async (url, init) => {
      calls.push({ url, init })
      if (fetchError) throw fetchError
      const r = response ?? { status: 200, body: DRAFT }
      return {
        status: r.status,
        json: async () => {
          if (r.raw !== undefined) return JSON.parse(r.raw)
          return r.body
        },
      }
    },
    readFile: (p) => {
      if (!Object.hasOwn(files, p)) throw new Error('ENOENT')
      return files[p]
    },
    exists: (p) => Object.hasOwn(written, p) || Object.hasOwn(files, p),
    writeNew: (p, text) => {
      if (Object.hasOwn(written, p) || Object.hasOwn(files, p)) throw new Error('EEXIST')
      written[p] = text
    },
    stdout: (s) => logs.push(s),
    stderr: (s) => logs.push(s),
  }
  return { deps, calls, written, logs }
}

const OUT = 'synthetic-out.json'

test('prepare — 새 API 에 POST · 관리자 Cookie · Origin · JSON · redirect 차단', async () => {
  const h = harness({ files: { 'in.json': INPUT } })
  const code = await run(['prepare', '--input', 'in.json', '--out', OUT], h.deps)
  assert.equal(code, 0)
  assert.equal(h.calls.length, 1)
  const { url, init } = h.calls[0]
  assert.equal(url, `http://localhost:3000${FACTORY_ORDER_DRAFT_PATH}`)
  assert.equal(FACTORY_ORDER_DRAFT_PATH, '/api/admin/csat/factory-order-draft')
  assert.equal(init.method, 'POST')
  assert.equal(init.redirect, 'error')
  assert.equal(init.headers.Cookie, COOKIE)
  assert.equal(init.headers.Origin, 'http://localhost:3000')
  assert.equal(init.headers['Content-Type'], 'application/json')
  assert.equal(init.body, INPUT)
  assert.deepEqual(JSON.parse(h.written[resolve(OUT)]), DRAFT)
  assert.ok(!h.logs.join('\n').includes(COOKIE), 'Cookie 가 출력되면 안 된다')
  assert.match(h.logs.join('\n'), /생산 미실행 · 납품 미실행/)
})

test('lineage — 기존 API 에 GET · user/workspace 쿼리 · Cookie · Origin', async () => {
  const h = harness({ response: { status: 200, body: { status: 'installed', orders: [] } } })
  const code = await run(
    ['lineage', '--user', USER, '--workspace', WS, '--out', OUT, '--base-url', 'http://127.0.0.1:3100'],
    h.deps,
  )
  assert.equal(code, 0)
  const { url, init } = h.calls[0]
  assert.equal(PRODUCT_ORDER_LINEAGE_PATH, '/api/admin/csat/product-order-lineage')
  assert.equal(url, `http://127.0.0.1:3100${PRODUCT_ORDER_LINEAGE_PATH}?user=${USER}&workspace=${WS}`)
  assert.equal(init.method, 'GET')
  assert.equal(init.body, undefined)
  assert.equal(init.redirect, 'error')
  assert.equal(init.headers.Cookie, COOKIE)
  assert.equal(init.headers.Origin, 'http://127.0.0.1:3100')
  assert.ok(h.written[resolve(OUT)])
  assert.ok(!h.logs.join('\n').includes(COOKIE))
})

test('loopback origin 만 허용 — 외부 host · https · 계정 정보 · 경로/쿼리/fragment 거절', () => {
  assert.equal(loopbackOrigin('http://localhost:3000'), 'http://localhost:3000')
  assert.equal(loopbackOrigin('http://localhost:3000/'), 'http://localhost:3000')
  assert.equal(loopbackOrigin('http://[::1]:3000'), 'http://[::1]:3000')
  for (const bad of [
    'http://example.com',
    'https://localhost:3000',
    'http://localhost.example.com:3000',
    'http://127.0.0.2:3000',
    'http://user:pw@localhost:3000',
    'http://localhost:3000/api',
    'http://localhost:3000/?x=1',
    'http://localhost:3000?',
    'http://localhost:3000#f',
    'file:///etc/passwd',
    'not a url',
  ])
    assert.throws(() => loopbackOrigin(bad), undefined, bad)
})

test('외부 base-url 이면 fetch 0 · 쓰기 0', async () => {
  const h = harness({ files: { 'in.json': INPUT } })
  const code = await run(['prepare', '--input', 'in.json', '--out', OUT, '--base-url', 'http://evil.example'], h.deps)
  assert.equal(code, 2)
  assert.equal(h.calls.length, 0)
  assert.deepEqual(h.written, {})
})

test('Cookie 미설정 · 줄바꿈 Cookie 는 실패(성공으로 세지 않음) · fetch 0', async () => {
  for (const env of [{}, { VOCAFLOW_ADMIN_COOKIE: '  ' }, { VOCAFLOW_ADMIN_COOKIE: 'a=b\r\nX-Evil: 1' }]) {
    const h = harness({ env, files: { 'in.json': INPUT } })
    const code = await run(['prepare', '--input', 'in.json', '--out', OUT], h.deps)
    assert.notEqual(code, 0)
    assert.equal(h.calls.length, 0)
    assert.deepEqual(h.written, {})
  }
})

test('입력 상한 초과 · JSON 아님 · 배열 · 읽기 실패는 fetch 0', async () => {
  const cases = {
    'big.json': JSON.stringify({ pad: 'x'.repeat(MAX_INPUT_BYTES) }),
    'bad.json': '{not json',
    'arr.json': '[]',
  }
  for (const name of [...Object.keys(cases), 'missing.json']) {
    const h = harness({ files: cases })
    const code = await run(['prepare', '--input', name, '--out', OUT], h.deps)
    assert.equal(code, 2, name)
    assert.equal(h.calls.length, 0, name)
    assert.deepEqual(h.written, {}, name)
  }
})

test('잘못된 인자 — 명령 · 플래그 · UUID · 필수값 · 중복 · 쓰기 명령 없음', async () => {
  const bad = [
    [],
    ['register'],
    ['link'],
    ['withdraw'],
    ['prepare', '--out', OUT],
    ['prepare', '--input', 'in.json'],
    ['prepare', '--input', 'in.json', '--out', OUT, '--user', USER],
    ['prepare', '--input', 'in.json', '--input', 'in.json', '--out', OUT],
    ['prepare', '--input', '--out', OUT],
    ['lineage', '--user', 'nope', '--workspace', WS, '--out', OUT],
    ['lineage', '--user', USER, '--workspace', WS],
    ['lineage', '--user', USER, '--out', OUT],
  ]
  for (const argv of bad) {
    const h = harness({ files: { 'in.json': INPUT } })
    assert.equal(await run(argv, h.deps), 2, argv.join(' '))
    assert.equal(h.calls.length, 0, argv.join(' '))
  }
})

test('기존 출력 파일은 덮어쓰지 않는다 — fetch 전에 거절', async () => {
  const h = harness({ files: { 'in.json': INPUT, [resolve(OUT)]: 'keep' } })
  const code = await run(['prepare', '--input', 'in.json', '--out', OUT], h.deps)
  assert.equal(code, 2)
  assert.equal(h.calls.length, 0)
  assert.deepEqual(h.written, {})
})

test('HTTP 실패 · 파싱 실패 · 네트워크/redirect 오류 · 형식 불일치 → 실패 · 산출물 0 · 비밀 미출력', async () => {
  const cases = [
    { response: { status: 403, body: { error: 'x' } } },
    { response: { status: 409, body: { error: 'x', code: 'signature_mismatch' } } },
    { response: { status: 503, body: { status: 'error' } } },
    { response: { status: 200, raw: '<html>' } },
    { response: { status: 200, body: { ...DRAFT, persisted: true } } },
    { response: { status: 200, body: { ...DRAFT, delivery: 'performed' } } },
    { fetchError: new TypeError(`fetch failed ${COOKIE}`) },
  ]
  for (const c of cases) {
    const h = harness({ ...c, files: { 'in.json': INPUT } })
    const code = await run(['prepare', '--input', 'in.json', '--out', OUT], h.deps)
    assert.equal(code, 1)
    assert.deepEqual(h.written, {})
    assert.ok(!h.logs.join('\n').includes(COOKIE))
  }
  const h = harness({ response: { status: 200, body: { status: 'error' } } })
  assert.equal(await run(['lineage', '--user', USER, '--workspace', WS, '--out', OUT], h.deps), 1)
  assert.deepEqual(h.written, {})
})
