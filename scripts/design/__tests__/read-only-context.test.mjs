// scripts/design/__tests__/read-only-context.test.mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import { blockLearningWrites } from '../lib/read-only-context.mjs'

test('최초 인증 확인 전 설치한 차단기가 Server Action·RPC·REST·외부 쓰기도 막는다', async () => {
  let handler
  const blocked = []
  await blockLearningWrites({ route: async (_, callback) => { handler = callback } }, blocked)
  for (const [method, url] of [
    ['POST', 'http://localhost:3041/hub'],
    ['POST', 'https://example.invalid/rest/v1/rpc/record'],
    ['PATCH', 'https://example.invalid/rest/v1/texts'],
    ['DELETE', 'http://localhost:3041/api/session'],
    ['POST', 'https://example.invalid/events'],
  ]) {
    let forwarded = false
    let response
    await handler({ request: () => ({ method: () => method, url: () => url }), continue: () => { forwarded = true }, fulfill: (value) => { response = value } })
    assert.equal(forwarded, false, `${method} ${url}`)
    assert.equal(response.status, 200)
  }
  assert.equal(blocked.length, 5)
})

test('읽기와 인증 토큰 교환은 통과하고 인증·본문 내용을 기록하지 않는다', async () => {
  let handler
  const blocked = []
  await blockLearningWrites({ route: async (_, callback) => { handler = callback } }, blocked)
  for (const [method, url] of [['GET', 'http://localhost:3041/hub'], ['HEAD', 'https://example.invalid/image'], ['POST', 'https://example.invalid/auth/v1/token']]) {
    let forwarded = false
    await handler({ request: () => ({ method: () => method, url: () => url }), continue: () => { forwarded = true }, fulfill: () => assert.fail('읽기/인증이 차단됨') })
    assert.equal(forwarded, true)
  }
  assert.deepEqual(blocked, [])
})

test('known GET writers and authenticated article prefetches are blocked before reaching the server', async () => {
  let handler
  const blocked = []
  await blockLearningWrites({ route: async (_, callback) => { handler = callback }, cookies: async () => [{ name: 'sb-fixture-auth-token.0' }] }, blocked)
  for (const pathname of ['/text/existing', '/text/existing/echo', '/teacher', '/library/scripts/article-id?_rsc=prefetch', '/join/code']) {
    let aborted = false
    await handler({ request: () => ({ method: () => 'GET', url: () => `http://localhost:3000${pathname}` }), continue: () => assert.fail('Server GET writer was forwarded'), abort: () => { aborted = true } })
    assert.equal(aborted, true)
  }
  assert.equal(blocked.length, 5)
})

test('anonymous public article preview remains readable while private text creation screen is just a read', async () => {
  let handler
  await blockLearningWrites({ route: async (_, callback) => { handler = callback }, cookies: async () => [] })
  for (const pathname of ['/library/scripts/article-id', '/text/new']) {
    let forwarded = false
    await handler({ request: () => ({ method: () => 'GET', url: () => `http://localhost:3000${pathname}` }), continue: () => { forwarded = true }, abort: () => assert.fail('Read-only surface was blocked') })
    assert.equal(forwarded, true)
  }
})
