// scripts/compose/near-miss-probe.mjs
//
// ACP §20 — **묶기 임계값이 병목인가.**
//
// 왜: 학습 적합한데 단일계통이라 못 쓰는 사건이 152건이다. 원인이 둘 중 무엇인지 갈라야 한다.
//   (가) 소프트뉴스는 정말 한 곳에서만 나온다 → 피드를 더 늘려야 한다
//   (나) 같은 사건인데 제목이 달라 **묶기 임계값을 못 넘는다** → 임계값 문제다
//
// 이 스크립트는 (나)를 잰다 — 서로 다른 발행사의 적합 후보 쌍 중 유사도가 임계값 **바로 아래**
// 인 것을 찾아 눈으로 확인할 수 있게 늘어놓는다. 임계값을 옮길지는 이 목록을 보고 정한다.
// **임계값을 짐작으로 내리지 않는다** — 잘못 묶으면 한 곳에서만 나온 사실이 "독립 2계통" 으로
// 보이고, 그 상태로 취재를 시작하면 I12 가 잡기 전까지 비용을 쓴다.
//
// 실행: pnpm dlx tsx scripts/compose/near-miss-probe.mjs [--days 30] [--floor 0.2]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const num = (flag, dflt) => {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? Number(process.argv[i + 1]) : dflt
}
const DAYS = num('--days', 30)
const FLOOR = num('--floor', 0.2)

const { createClient } = await import('@supabase/supabase-js')
const { classifyTopic, headlineTokens, diceCoefficient, CLUSTER_THRESHOLDS } = await import(
  '@vocaflow/library-pipeline'
)

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const CEIL = CLUSTER_THRESHOLDS.minTitleDice

const since = new Date(Date.now() - DAYS * 86_400_000).toISOString()
const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('article_compose_candidates')
    .select('source_key, publisher, wire, title, published_at')
    .gte('published_at', since)
    .order('title', { ascending: true })
    .range(from, from + 999)
  if (error) throw new Error('조회 실패: ' + error.message)
  rows.push(...(data ?? []))
  if (!data || data.length < 1000) break
}

// 적합한 것만 본다 — 부적합 사건을 더 묶어 봐야 쓸 수 없다.
const fit = rows
  .filter((r) => classifyTopic(r.title) === 'fit')
  .map((r) => ({ ...r, tokens: headlineTokens(r.title), t: Date.parse(r.published_at ?? '') }))

console.log(`최근 ${DAYS}일 · 적합 후보 ${fit.length}건 · 임계 ${CEIL} · 바닥 ${FLOOR}\n`)

const WINDOW = 72 * 3_600_000
const pairs = []
for (let i = 0; i < fit.length; i++) {
  for (let j = i + 1; j < fit.length; j++) {
    const a = fit[i]
    const b = fit[j]
    const lineA = a.wire ?? a.publisher.toLowerCase()
    const lineB = b.wire ?? b.publisher.toLowerCase()
    if (lineA === lineB) continue // 같은 계통끼리는 묶어도 독립이 안 된다
    if (!Number.isFinite(a.t) || !Number.isFinite(b.t) || Math.abs(a.t - b.t) > WINDOW) continue
    const d = diceCoefficient(a.tokens, b.tokens)
    if (d >= FLOOR && d < CEIL) pairs.push({ d, a, b })
  }
}
pairs.sort((x, y) => y.d - x.d)

console.log(`임계 바로 아래(${FLOOR}~${CEIL}) 교차계통 쌍 ${pairs.length}건\n`)
for (const p of pairs.slice(0, 20)) {
  console.log(`  ${p.d.toFixed(2)}  [${p.a.publisher}] ${p.a.title.slice(0, 62)}`)
  console.log(`        [${p.b.publisher}] ${p.b.title.slice(0, 62)}`)
}
if (pairs.length === 0) {
  console.log('  없음 — 임계값이 아니라 **소재가 한 곳에서만 나오는 것**이 병목이다.')
}
