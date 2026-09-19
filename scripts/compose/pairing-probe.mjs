// scripts/compose/pairing-probe.mjs
//
// ACP §20 — **이 소스는 짝을 못 짓는가, 주제만 안 맞는가.**
//
// 왜 기여도만으로는 부족한가 (2026-08-19):
//   기여도 측정(contribution-probe)은 "학습 적합한 2계통 사건에 들어갔는가" 하나만 본다.
//   그래서 0 이 나와도 원인이 둘 중 무엇인지 모른다:
//     ① 짝을 잘 짓는데 그 사건들이 사건사고·정치라 학습에 못 쓴다 → **섹션을 바꾸면 산다**
//     ② 애초에 아무와도 안 겹친다 — 혼자만 다루는 것을 쓴다 → **끄는 게 맞다**
//   이 둘을 구별하지 않고 껐다가 되살린 적이 있다(Cycle 1 연합뉴스). 그래서 나눠 잰다.
//
// 함께 내는 동시출현 표는 "누가 누구와 짝이 되는가" 를 보여 준다. 어떤 소스가 특정 한 곳과만
// 짝이 된다면 그 한 곳이 사라질 때 같이 죽는다 — 목록에는 안 보이는 의존이다.
//
// 읽기 전용. 실행: pnpm dlx tsx scripts/compose/pairing-probe.mjs [--days 30]

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

const stat = new Map()
const ensure = (k) => {
  if (!stat.has(k)) stat.set(k, { cands: 0, paired: 0, pairedFit: 0, partners: new Map() })
  return stat.get(k)
}
for (const r of rows) ensure(r.source_key).cands++

// 짝을 지은 사건 = 독립 2계통 이상. 학습 적합 여부와 무관하게 먼저 센다.
for (const c of clusters) {
  if (!c.worthPursuing) continue
  const keys = [...new Set(c.members.map((m) => m.sourceKey))]
  const fit = classifyTopic(c.headline) === 'fit'
  for (const k of keys) {
    const e = ensure(k)
    e.paired++
    if (fit) e.pairedFit++
    for (const other of keys) {
      if (other === k) continue
      e.partners.set(other, (e.partners.get(other) ?? 0) + 1)
    }
  }
}

console.log(`최근 ${DAYS}일 · 후보 ${rows.length} · 사건 ${clusters.length}\n`)
console.log(['소스'.padEnd(16), '후보', '짝지음', '짝%', '적합짝', '주된 짝 상대'].join('  '))

const list = [...stat.entries()].sort((a, b) => b[1].paired - a[1].paired)
for (const [k, v] of list) {
  const top = [...v.partners.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p, n]) => `${p}×${n}`)
    .join(' ')
  console.log(
    [
      k.padEnd(16),
      String(v.cands).padStart(4),
      String(v.paired).padStart(6),
      ((100 * v.paired) / (v.cands || 1)).toFixed(1).padStart(5),
      String(v.pairedFit).padStart(6),
      '  ' + (top || '(없음)'),
    ].join('  '),
  )
}

console.log('\n■ 판정')
for (const [k, v] of list) {
  if (v.pairedFit > 0) continue
  if (v.paired === 0) {
    console.log(`  ✗ ${k} — 아무와도 안 겹친다(후보 ${v.cands}). 혼자 다루는 것을 본다 → 끄는 쪽.`)
  } else {
    console.log(
      `  △ ${k} — 짝은 ${v.paired}건 지었으나 학습 적합이 0. 주제 문제다 → 섹션 교체를 먼저 본다.`,
    )
  }
}
