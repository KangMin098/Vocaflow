// scripts/compose/necessity-probe.mjs
//
// ACP §20 — **이 소스를 빼면 무엇을 잃는가.** (leave-one-out 반사실)
//
// 왜 기여도·짝 성립률로는 부족한가:
//   기여도는 "그 사건에 참여했는가" 를 세는데, 참여했다고 **필요한** 것은 아니다.
//   같은 사건을 다른 두 소스가 이미 덮고 있으면 그 소스가 없어도 사건은 그대로 성립한다.
//   실제로 어떤 소스는 기여 수는 높은데 전부 남이 이미 덮은 것이고(대체 가능),
//   어떤 소스는 기여 수가 적어도 그것 없이는 사건 자체가 사라진다(대체 불가).
//   피드를 끄는 판단은 **후자**를 봐야 한다.
//
// 재는 법: 소스를 하나 빼고 전체를 다시 묶어, 쓸 수 있는 사건이 몇 건 사라지는지 센다.
//   "쓸 수 있는" = 독립 2계통 + 읽을 수 있는 2계통 + 학습 적합.
//   한국 관련 사건이 몇 건 사라지는지도 따로 센다 — 그것이 이 파이프라인의 목표이기 때문이다.
//
// ⚠️ 제목 기반 분류를 쓰므로 자릿수·순위를 보는 도구다. 개별 판정용이 아니다.
// ⚠️ 발행 지연(48시간)은 무시하고 잰다 — 필요성은 숙성과 무관한 성질이고,
//    보류를 넣으면 최근 며칠 표본이 통째로 빠져 소스마다 불공평해진다.
//
// 읽기 전용. 실행: pnpm dlx tsx scripts/compose/necessity-probe.mjs [--days 30]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const di = process.argv.indexOf('--days')
const DAYS = di >= 0 ? Number(process.argv[di + 1]) : 30

const { createClient } = await import('@supabase/supabase-js')
const { clusterStories, classifyTopic, isKoreaRelevant } = await import('@vocaflow/library-pipeline')

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

const toCandidate = (r) => ({
  sourceKey: r.source_key,
  publisher: r.publisher,
  wire: r.wire,
  title: r.title,
  url: r.url,
  published_at: r.published_at,
  holdMs: 0,
})

/** 쓸 수 있는 사건의 열쇠 집합 — 소스를 뺀 뒤와 견주려면 사건을 식별해야 한다. */
function usableKeys(candidates) {
  const usable = clusterStories(candidates).filter(
    (c) => c.worthPursuing && classifyTopic(c.headline) === 'fit',
  )
  const all = new Set()
  const korea = new Set()
  for (const c of usable) {
    // 묶음 열쇠는 구성원 주소의 정렬 결합 — 헤드라인은 대표 기사가 바뀌면 달라진다.
    const key = c.members
      .map((m) => m.url)
      .sort()
      .join('|')
    all.add(key)
    if (isKoreaRelevant(c.headline, c.members.map((m) => m.publisher))) korea.add(key)
  }
  return { all, korea }
}

const base = usableKeys(rows.map(toCandidate))
const sources = [...new Set(rows.map((r) => r.source_key))].sort()

console.log(`최근 ${DAYS}일 · 후보 ${rows.length}`)
console.log(`기준선: 쓸 수 있는 사건 ${base.all.size} (한국 관련 ${base.korea.size})\n`)
console.log(['소스'.padEnd(16), '후보', '빼면 잃는 사건', '그중 한국'].join('  '))

const verdicts = []
for (const key of sources) {
  const without = usableKeys(rows.filter((r) => r.source_key !== key).map(toCandidate))
  // 사라진 사건 = 기준선에는 있었는데 이 소스를 빼니 없어진 것.
  //   묶음 열쇠가 바뀌는 경우(구성원이 줄어 다른 묶음이 됨)도 "사라졌다" 로 센다 —
  //   실제로 그 사건은 남은 소스만으로는 성립하지 않기 때문이다.
  const lost = [...base.all].filter((k) => !without.all.has(k))
  const lostKorea = [...base.korea].filter((k) => !without.korea.has(k))
  verdicts.push({ key, cands: rows.filter((r) => r.source_key === key).length, lost: lost.length, lostKorea: lostKorea.length })
}

verdicts.sort((a, b) => b.lost - a.lost || b.lostKorea - a.lostKorea)
for (const v of verdicts) {
  console.log(
    [
      v.key.padEnd(16),
      String(v.cands).padStart(4),
      String(v.lost).padStart(14),
      String(v.lostKorea).padStart(9),
    ].join('  '),
  )
}

const useless = verdicts.filter((v) => v.lost === 0)
console.log(`\n■ 빼도 잃는 것이 없는 소스 ${useless.length}개`)
for (const v of useless) {
  console.log(`  · ${v.key} (후보 ${v.cands}) — 이 소스가 참여한 사건은 남은 소스만으로도 성립한다.`)
}
if (!useless.length) console.log('  없음 — 지금 켜 둔 소스는 모두 무언가를 떠받치고 있다.')

console.log(
  '\n주의: 후보가 쌓일수록 결과가 바뀐다. 한 번의 측정으로 끄지 말고 며칠 간격으로 두 번 이상 볼 것.',
)
