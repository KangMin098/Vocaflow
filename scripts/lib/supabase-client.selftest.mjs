// scripts/lib/supabase-client.selftest.mjs
//
// `retryingFetch` 자가검사. 망을 타지 않는다 — `globalThis.fetch` 를 갈아 끼운다.
//
// 여기서 지키는 것은 넷이다:
//   1. 5xx 에 물러섰다가 돌아오면 성공한다
//   2. **POST 는 재시도하지 않는다** — 다시 보내면 두 번 들어간다
//   3. 다 쓰고도 안 되면 **진짜 이유를 담아** 던진다 (조용한 0건 금지)
//   4. 4xx 는 다시 보내지 않는다 — 같은 답이 온다
//
// 실행: node scripts/lib/supabase-client.selftest.mjs

import { retryingFetch } from './supabase-client.mjs'

let pass = 0
let fail = 0
const real = globalThis.fetch
const check = (name, cond) => {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name}`)
  }
}

// ── 1. 522 두 번 뒤 성공 ───────────────────────────────────────────
{
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return calls <= 2 ? { status: 522, ok: false } : { status: 200, ok: true }
  }
  const f = retryingFetch({ retries: 5, baseMs: 1 })
  const res = await f('https://x/rest/v1/t', { method: 'GET' })
  check('522 에 물러섰다가 돌아오면 성공한다', res.status === 200 && calls === 3)
}

// ── 2. POST 는 재시도하지 않는다 ───────────────────────────────────
{
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return { status: 522, ok: false }
  }
  const f = retryingFetch({ retries: 5, baseMs: 1 })
  const res = await f('https://x/rest/v1/t', { method: 'POST' })
  check('POST 는 한 번만 보낸다 — 중복 적재를 만들지 않는다', calls === 1 && res.status === 522)
}

// ── 3. 연결 실패는 진짜 이유를 담아 던진다 ─────────────────────────
{
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    throw Object.assign(new TypeError('fetch failed'), { cause: new Error('ECONNRESET') })
  }
  const f = retryingFetch({ retries: 2, baseMs: 1 })
  let msg = ''
  try {
    await f('https://x/rest/v1/t', { method: 'GET' })
  } catch (e) {
    msg = e.message
  }
  check('3번 시도한다', calls === 3)
  check(
    '원인 사슬을 메시지에 담는다 — "fetch failed" 만으로는 아무것도 모른다',
    /ECONNRESET/.test(msg) && /3번 시도/.test(msg)
  )
}

// ── 4. 4xx 는 그대로 돌려준다 ──────────────────────────────────────
{
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return { status: 404, ok: false }
  }
  const f = retryingFetch({ retries: 5, baseMs: 1 })
  const res = await f('https://x/rest/v1/t', { method: 'GET' })
  check('4xx 는 다시 보내지 않는다', calls === 1 && res.status === 404)
}

// ── 5. 물러선 이유를 말한다 ────────────────────────────────────────
{
  let calls = 0
  const seen = []
  globalThis.fetch = async () => {
    calls++
    return calls === 1 ? { status: 503 } : { status: 200 }
  }
  const f = retryingFetch({ retries: 3, baseMs: 1, onRetry: (i) => seen.push(i.why) })
  await f('https://x/rest/v1/t', { method: 'PATCH' })
  check('물러선 이유를 알려 준다 — 조용히 멈추면 "느리네" 로 읽힌다', seen[0] === 'HTTP 503')
}

globalThis.fetch = real
console.log(`\n통과 ${pass} · 실패 ${fail}`)
process.exit(fail ? 1 : 0)
