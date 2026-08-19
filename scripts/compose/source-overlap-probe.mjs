// scripts/compose/source-overlap-probe.mjs
//
// ACP §20 — **두 소스가 사실은 같은 원고인가.**
//
// 왜 필요한가 (실측 2026-08-19):
//   로카르노 영화제 사건을 취재하려다 연합뉴스와 코리아헤럴드의 문장이 **글자 그대로 같은 것**을
//   발견했다. 코리아헤럴드가 연합 원고를 그대로 실은 것이다. 그런데 우리 화면에는 `계통 2/2` 로
//   떴다 — 발행사가 둘이므로 독립 2계통으로 셌기 때문이다.
//
//   이것이 왜 치명적인가: 재저작의 정당성은 **"여러 곳이 각자 취재한 사실은 누구의 표현도
//   아니다"** 에 있다. 한 곳의 원고를 두 곳이 실은 것을 2계통으로 세면, 실제로는 **한 매체의
//   기사 하나를 바꿔 쓴 것**이 된다. 그건 재저작이 아니라 2차 저작물이다.
//
//   `wire` 필드가 이걸 막게 돼 있지만 손으로 적는 값이라, 표시되지 않은 전재는 그냥 통과한다.
//   지문은 이미 소스마다 만들어 두었으므로 **소스끼리 견주면 측정으로 잡을 수 있다.**
//
// 읽기 전용. 실행:
//   pnpm dlx tsx scripts/compose/source-overlap-probe.mjs [--batch <id>]
//     --batch 없으면 저장된 모든 취재 묶음을 훑는다.

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const bi = process.argv.indexOf('--batch')
const only = bi >= 0 ? process.argv[bi + 1] : null

const { createClient } = await import('@supabase/supabase-js')
const { containment, jaccard } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

// `--url` 두 개 이상을 주면 **아직 취재하지 않은 기사**를 견준다.
//   취재 묶음을 만들고 나서 아는 것보다 만들기 전에 아는 편이 낫다.
const urlArgs = process.argv.filter((_, i) => process.argv[i - 1] === '--url')
if (urlArgs.length >= 2) {
  const { COMPOSE_USER_AGENT, buildFingerprint, extractArticle } = await import(
    '@vocaflow/library-pipeline'
  )
  const fps = []
  for (const u of urlArgs) {
    const res = await fetch(u, { headers: { 'User-Agent': COMPOSE_USER_AGENT }, redirect: 'follow' })
    if (!res.ok) {
      console.log(`  열지 못했다 (${res.status}) ${u}`)
      continue
    }
    // 지문은 **추출한 본문**에서 뜬다 — 원본 HTML 로 뜨면 서로 다른 사이트 틀이 섞여
    //   같은 원고인데도 겹침이 낮게 나온다.
    fps.push({ url: u, fp: buildFingerprint(extractArticle(await res.text()).text) })
  }
  for (let i = 0; i < fps.length; i++) {
    for (let j = i + 1; j < fps.length; j++) {
      const c = containment(fps[i].fp, fps[j].fp)
      console.log(`\n${fps[i].url}\n${fps[j].url}`)
      console.log(
        `  담김 ${(100 * c).toFixed(1)}% · 자카드 ${(100 * jaccard(fps[i].fp, fps[j].fp)).toFixed(1)}%` +
          (c >= 0.4 ? '  ← 사실상 같은 원고. 독립 계통으로 셀 수 없다.' : ''),
      )
    }
  }
  process.exit(0)
}

let q = db
  .from('article_compose_sources')
  .select('batch_id, publisher, url, fingerprint, wire')
  .order('batch_id')
if (only) q = q.eq('batch_id', only)
const { data: rows, error } = await q
if (error) throw new Error('소스 조회 실패: ' + error.message)

const { data: batches } = await db.from('article_compose_batches').select('id, topic')
const topicOf = new Map((batches ?? []).map((b) => [b.id, b.topic]))

const byBatch = new Map()
for (const r of rows ?? []) {
  if (!byBatch.has(r.batch_id)) byBatch.set(r.batch_id, [])
  byBatch.get(r.batch_id).push(r)
}

/** 사실상 같은 원고로 보는 선. 넘으면 독립 계통으로 셀 수 없다. */
const SAME_COPY = 0.4

let flagged = 0
for (const [batchId, srcs] of byBatch) {
  if (srcs.length < 2) continue
  const pairs = []
  for (let i = 0; i < srcs.length; i++) {
    for (let j = i + 1; j < srcs.length; j++) {
      const a = srcs[i]
      const b = srcs[j]
      // 담김(containment)은 짧은 쪽이 긴 쪽에 얼마나 들어 있는지 — 전재는 여기서 튄다.
      const c = containment(a.fingerprint, b.fingerprint)
      const j2 = jaccard(a.fingerprint, b.fingerprint)
      pairs.push({ a: a.publisher, b: b.publisher, c, j: j2 })
    }
  }
  const worst = pairs.reduce((x, y) => (y.c > x.c ? y : x))
  const bad = worst.c >= SAME_COPY
  if (bad) flagged++
  console.log(`\n${bad ? '✗' : '·'} ${(topicOf.get(batchId) ?? batchId).slice(0, 60)}`)
  for (const p of pairs) {
    console.log(
      `    ${p.a} ↔ ${p.b} · 담김 ${(100 * p.c).toFixed(1)}% · 자카드 ${(100 * p.j).toFixed(1)}%${
        p.c >= SAME_COPY ? '  ← 사실상 같은 원고' : ''
      }`,
    )
  }
}

console.log(`\n취재 묶음 ${byBatch.size} · 같은 원고로 의심되는 것 ${flagged}`)
console.log(`기준: 7어절 지문의 담김 ${100 * SAME_COPY}% 이상. 전재는 대개 90%를 넘는다.`)
