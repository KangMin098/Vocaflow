// scripts/csat/gate-make.mjs
//
// **`csat_fit.make` 를 채운다 — 문항 생성기가 바로 쓰는 값.**
//
// 담는 것은 넷뿐이다: `words` · `sents` · `paras` · `windows`.
// `windows` 는 대역을 만족하는 창의 **위치**(문장 인덱스)다. 지금까지 `pass` 는
// 창이 몇 개인지만 알았고, 생성기는 "어디에 빈칸을 뚫을지" 를 처음부터 다시 계산해야 했다.
//
// ⚠️ **유형별 적합도 점수는 넣지 않는다.** `data/passage-selection.json` 실측에서
//   대조군(선정 안 된 산문 0.936)이 빈칸용(0.860)·주제용(0.893)·순서용(0.899)보다
//   높았다 — 결속도는 유형을 가르지 못한다. 검증 안 된 점수를 필드로 만들면
//   파이프라인이 그것을 근거로 문항을 고르고, 그때는 틀렸다는 사실조차 안 보인다.
//
// ⚠️ **`gate-import.mjs` 와 동시에 돌리면 안 된다.** 둘 다 `csat_fit` 을 읽어-고쳐-쓰기
//   하므로 나중에 끝난 쪽이 앞의 것을 덮는다. 순서대로 돌릴 것.
//
// 재실행 안전: 같은 값이면 쓰지 않는다.
//
// 실행: node scripts/csat/gate-make.mjs [--commit] [--source gutenberg]

import fs from 'node:fs'
import path from 'node:path'

import { windowsOf, splitSentences, W } from './lib-fit.mjs'
import { curlFetch } from './lib-curl-fetch.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const COMMIT = process.argv.includes('--commit')
// ⚠️ 소스가 아니라 **용도**로 고른다. make 를 쓰는 것은 문항 생성기이고, 문항이 되는 것은
//   csat·kids 두 용도뿐이다. library 는 읽기 자료라 창이 필요 없고, raw 는 아직 지문이 아니다.
const PURPOSES = (arg('purposes', 'csat,kids') || '').split(',').filter(Boolean)
const MAKE_VERSION = 1

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  ...(process.argv.includes('--curl') ? { global: { fetch: curlFetch } } : {}),
})

console.log(`make 채우기 (${PURPOSES.join('·')})` + (COMMIT ? ' — **쓴다**' : ' — 예행'))
console.log('='.repeat(78))

// ⚠️ 이 저장소에서 **다섯 번째** 같은 결함이다 — 긴 루프가 일시적 실패 한 번에 통째로 죽는다.
//   curl 경로는 요청마다 프로세스를 띄우므로 간헐 실패가 오히려 더 잦다.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function retry(fn, what, attempt = 0) {
  try {
    const r = await fn()
    if (r?.error) throw new Error(r.error.message)
    return r
  } catch (e) {
    if (attempt >= 4) throw new Error(`${what} — ${String(e.message).slice(0, 80)}`)
    await sleep(1500 * 2 ** attempt)
    return retry(fn, what, attempt + 1)
  }
}

/** 키 순서에 흔들리지 않는 비교용 직렬화. jsonb 왕복을 견디게 한다. */
const stable = (v) =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]]))
      : x,
  )

const t = { rows: 0, wrote: 0, same: 0, noWin: 0 }
let cursor = '00000000-0000-0000-0000-000000000000'
for (;;) {
  const { data } = await retry(
    () =>
      db
        .from('library_articles')
        .select('id,content,csat_fit')
        .in('csat_fit->gate->>purpose', PURPOSES)
        .eq('csat_fit->gate->>publishable', 'true')
        .gt('id', cursor)
        .order('id')
        .limit(300),
    '조회',
  )
  if (!data?.length) break
  cursor = data[data.length - 1].id

  for (const row of data) {
    t.rows += 1
    const text = String(row.content ?? '')
    const wins = windowsOf(text).filter((w) => w.pass).map((w) => ({ s: w.s, e: w.e }))
    if (!wins.length) t.noWin += 1
    const make = {
      v: MAKE_VERSION,
      words: W(text).length,
      sents: splitSentences(text).length,
      paras: text.split(/\n\s*\n/).filter((p) => p.trim()).length,
      windows: wins,
    }
    const prev = row.csat_fit?.make
    // ⚠️ **jsonb 는 키 순서를 보존하지 않는다.** Postgres 가 길이·바이트순으로 다시 정렬해서
    //   돌려주므로 `JSON.stringify(prev)` 는 우리가 넣은 것과 절대 같아지지 않는다.
    //   실측 2026-09-05: 이 비교 때문에 두 번째 회차가 이미 쓴 2,400편을 전부 다시 썼다 —
    //   "재실행 안전" 이라고 적어 두고 실제로는 매번 전량을 다시 쓰고 있었다.
    if (prev && stable(prev) === stable(make)) {
      t.same += 1
      continue
    }
    if (!COMMIT) continue
    // 기존 csat_fit 을 읽어 키 하나만 더한다 — 통째로 덮으면 pass·topic·gate 가 날아간다.
    await retry(
      () =>
        db
          .from('library_articles')
          .update({ csat_fit: { ...(row.csat_fit ?? {}), make } })
          .eq('id', row.id),
      `쓰기 ${row.id}`,
    )
    t.wrote += 1
  }
  process.stdout.write(`\r  ${t.rows.toLocaleString()}편 · 쓴 것 ${t.wrote.toLocaleString()}`)
  if (data.length < 300) break
}
console.log(
  `\n\n  훑음 ${t.rows.toLocaleString()} · 쓴 것 ${t.wrote.toLocaleString()}` +
    ` · 이미 같음 ${t.same.toLocaleString()} · 통과 창 없음 ${t.noWin.toLocaleString()}`,
)
if (!COMMIT) console.log(`\n  예행이었다. 실제로 쓰려면 --commit`)
