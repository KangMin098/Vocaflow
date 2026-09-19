// scripts/compose/ceiling-probe.mjs
//
// ACP §20 — **뉴스 피드의 천장 측정.**
//
// 왜: "취재 가능 사건 중 학습 지문이 나오는 비율 50%" 를 목표로 잡았는데, 관측 표본이
// 매번 3~7건이라 그 목표가 도달 가능한지 알 수 없다. 하루치 사건 수로 목표를 정하면
// 운에 따라 오르내린다. 그래서 **저장된 후보 전체를 묶어** 큰 표본으로 천장을 잰다.
//
// 재는 것:
//   · 후보 전체 → 사건 묶음
//   · 그중 취재 가능(읽을 수 있는 독립 2계통 이상)
//   · 그중 학습 적합 — feed-fitness 와 **같은 분류 규칙**
//
// ⚠️ 분류는 제목 기반이라 정밀하지 않다. 천장의 자릿수를 보는 용도다.
//
// 실행: pnpm dlx tsx scripts/compose/ceiling-probe.mjs [--days 30]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const di = process.argv.indexOf('--days')
const DAYS = di >= 0 ? Number(process.argv[di + 1]) : 30

const { createClient } = await import('@supabase/supabase-js')
const { clusterStories, classifyTopic } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const since = new Date(Date.now() - DAYS * 86_400_000).toISOString()
const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('article_compose_candidates')
    .select('source_key, publisher, wire, title, url, published_at')
    .gte('published_at', since)
    .order('url', { ascending: true })
    .range(from, from + 999)
  if (error) throw new Error('조회 실패: ' + error.message)
  rows.push(...(data ?? []))
  if (!data || data.length < 1000) break
}

const clusters = clusterStories(
  rows.map((r) => ({
    sourceKey: r.source_key,
    publisher: r.publisher,
    wire: r.wire,
    title: r.title,
    url: r.url,
    published_at: r.published_at,
    holdMs: 0,
  })),
)

const pursue = clusters.filter((c) => c.worthPursuing)
const titleFit = (c) => classifyTopic(c.headline)
const fitPursue = pursue.filter((c) => titleFit(c) === 'fit')
const unfitPursue = pursue.filter((c) => titleFit(c) === 'unfit')

const pct = (a, b) => (b === 0 ? '—' : ((100 * a) / b).toFixed(1) + '%')

console.log(`최근 ${DAYS}일 후보 ${rows.length}건\n`)
console.log(`묶은 사건            ${clusters.length}`)
console.log(`취재 가능(읽기 2계통) ${pursue.length}  (${pct(pursue.length, clusters.length)})`)
console.log(`  · 학습 적합         ${fitPursue.length}  (${pct(fitPursue.length, pursue.length)}) ← 천장`)
console.log(`  · 학습 부적합       ${unfitPursue.length}  (${pct(unfitPursue.length, pursue.length)})`)
console.log(
  `  · 중립              ${pursue.length - fitPursue.length - unfitPursue.length}  (${pct(pursue.length - fitPursue.length - unfitPursue.length, pursue.length)})`,
)

if (fitPursue.length) {
  console.log('\n적합 사건 (최대 12):')
  for (const c of fitPursue.slice(0, 12)) {
    console.log(`  · [${c.readableLines}계통] ${c.headline.slice(0, 78)}`)
  }
}

// 단일계통 중 적합한 것 — 계통이 하나 더 붙으면 쓸 수 있게 되는 잠재분
const single = clusters.filter((c) => !c.worthPursuing && classifyTopic(c.headline) === 'fit')
console.log(`\n단일계통이라 못 쓰는 적합 사건 ${single.length}건 — 계통이 하나만 더 붙으면 쓸 수 있다`)
for (const c of single.slice(0, 8)) {
  console.log(`  · [${c.members.map((m) => m.publisher).join(',')}] ${c.headline.slice(0, 70)}`)
}
