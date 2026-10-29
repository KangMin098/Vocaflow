// scripts/textbook/__tests__/factory-admission-preview.test.mjs
// admission-preview — 합성 Cookie · fake fetch · 메모리 파일만. 실제 서버·DB 에 닿지 않는다.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { test } from 'node:test'

import { DCP_ADMISSION_PATH, run } from '../factory-order-draft.mjs'

const FILES = { 'p.json': '{"body":{}}', 'o.json': '{"items":[]}\n', 'r.json': '{"verdict":"x"}' }
const PREVIEW = { status: 'ok', writes: 'not_performed', plan: { items: [{ qualification_ready: false }], real_admissible: false, blockers: ['synthetic_demand'] } }
const OUT = 'synthetic-preview.json'
const ARGS = ['admission-preview', '--packet', 'p.json', '--output', 'o.json', '--review', 'r.json', '--out', OUT]

function harness(response = { status: 200, body: PREVIEW }) {
  const calls = []
  const written = {}
  const logs = []
  const deps = {
    env: { VOCAFLOW_ADMIN_COOKIE: 'sb-synthetic=1' },
    fetch: async (url, init) => {
      calls.push({ url, init })
      return { status: response.status, json: async () => response.body }
    },
    readFile: (p) => {
      if (!Object.hasOwn(FILES, p)) throw new Error('ENOENT')
      return FILES[p]
    },
    exists: (p) => Object.hasOwn(written, p),
    writeNew: (p, text) => {
      written[p] = text
    },
    stdout: (s) => logs.push(s),
    stderr: (s) => logs.push(s),
  }
  return { deps, calls, written, logs }
}

test('action=preview 만 POST · 출력 sha256 은 파일 bytes · 읽기 전용 응답만 저장', async () => {
  const h = harness()
  assert.equal(await run(ARGS, h.deps), 0)
  const { url, init } = h.calls[0]
  assert.equal(url, `http://localhost:3000${DCP_ADMISSION_PATH}`)
  assert.equal(init.method, 'POST')
  assert.equal(init.redirect, 'error')
  assert.equal(init.headers.Origin, 'http://localhost:3000')
  const sent = JSON.parse(init.body)
  assert.equal(sent.action, 'preview')
  assert.equal(sent.output_sha256, createHash('sha256').update(FILES['o.json']).digest('hex'))
  assert.ok(h.written[resolve(OUT)])
  assert.ok(h.logs.some((l) => l.includes('real_admissible=false')))
})

test('쓰기처럼 보이는 응답 · 비200 은 저장하지 않는다 · 필수 플래그 없으면 요청 0', async () => {
  for (const response of [{ status: 200, body: { ...PREVIEW, writes: 'performed' } }, { status: 409, body: { status: 'rejected', code: 'source_changed' } }]) {
    const h = harness(response)
    assert.equal(await run(ARGS, h.deps), 1)
    assert.deepEqual(h.written, {})
  }
  const h = harness()
  assert.equal(await run(['admission-preview', '--packet', 'p.json', '--out', OUT], h.deps), 2)
  assert.equal(h.calls.length, 0)
})
