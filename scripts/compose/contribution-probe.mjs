// scripts/compose/contribution-probe.mjs
//
// ACP §20 — **어느 피드가 실제로 쓸 만한 사건에 기여하는가 + 한국 관련성.**
//
// 왜 두 가지를 함께 재는가:
//   ① "불필요한 소스 피드" 는 항목 수나 적합률이 아니라 **쓸 수 있는 사건에 기여했는가**로
//      판정해야 한다. 적합률이 높아도 늘 단일계통이면 한 편도 못 만든다.
//   ② 목표는 "**한국 학습자**에게 맞는 결과" 인데, 그동안 소프트뉴스 여부만 쟀고
//      한국 관련성은 한 번도 재지 않았다. 한국 학습자에게는 친숙한 소재가 진입 장벽을 낮춘다
//      (Context-Dependent 원칙) — 같은 난이도면 아는 배경이 있는 글이 낫다.
//
// ⚠️ 한국 관련성 판정도 제목 기반이라 거칠다. 순위용이다.
//
// 실행: pnpm dlx tsx scripts/compose/contribution-probe.mjs [--days 30]

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

/** 한국 학습자에게 배경 지식이 있는 소재인가 — 한국·한국어권·인접 아시아. */
const KOREA =
  /\b(korea\w*|seoul|busan|incheon|jeju|hanbok|kimchi|k-pop|kpop|hallyu|samsung|hyundai|lg|sk hynix|kia|naver|kakao|bts|blackpink|taekwondo|chuseok|seollal|dmz|pyongyang|north korean|yonhap)\b/i

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

const usable = clusters.filter((c) => c.worthPursuing && classifyTopic(c.headline) === 'fit')

// ① 피드(소스)별 기여 — 쓸 수 있는 사건에 구성원으로 들어갔는가
const contrib = new Map()
for (const r of rows) contrib.set(r.source_key, { cands: 0, usable: 0, korea: 0 })
for (const r of rows) {
  const e = contrib.get(r.source_key)
  e.cands++
  if (KOREA.test(r.title)) e.korea++
}
for (const c of usable) {
  for (const key of new Set(c.members.map((m) => m.sourceKey))) {
    const e = contrib.get(key)
    if (e) e.usable++
  }
}

console.log(`최근 ${DAYS}일 · 후보 ${rows.length} · 사건 ${clusters.length} · 쓸 수 있는 사건 ${usable.length}\n`)
console.log(['소스'.padEnd(16), '후보', '기여', '한국관련', '한국%'].join('  '))
const list = [...contrib.entries()].sort((a, b) => b[1].usable - a[1].usable || b[1].korea - a[1].korea)
for (const [k, v] of list) {
  console.log(
    [
      k.padEnd(16),
      String(v.cands).padStart(4),
      String(v.usable).padStart(4),
      String(v.korea).padStart(8),
      ((100 * v.korea) / (v.cands || 1)).toFixed(1).padStart(6),
    ].join('  '),
  )
}

const dead = list.filter(([, v]) => v.usable === 0)
console.log(`\n쓸 수 있는 사건에 한 번도 기여 못 한 소스 ${dead.length}개`)
for (const [k, v] of dead) console.log(`  · ${k} (후보 ${v.cands} · 한국관련 ${v.korea})`)

// ② 한국 관련 소재의 학습 적합성 — 친숙한 소재가 실제로 쓸 만한가
const koreaCands = rows.filter((r) => KOREA.test(r.title))
const koreaFit = koreaCands.filter((r) => classifyTopic(r.title) === 'fit').length
const koreaUnfit = koreaCands.filter((r) => classifyTopic(r.title) === 'unfit').length
const allFit = rows.filter((r) => classifyTopic(r.title) === 'fit').length
console.log(`\n■ 한국 관련성`)
console.log(`  한국 관련 후보 ${koreaCands.length} / ${rows.length} (${((100 * koreaCands.length) / rows.length).toFixed(1)}%)`)
console.log(`    · 학습 적합 ${koreaFit} (${((100 * koreaFit) / (koreaCands.length || 1)).toFixed(1)}%)`)
console.log(`    · 학습 부적합 ${koreaUnfit} (${((100 * koreaUnfit) / (koreaCands.length || 1)).toFixed(1)}%)`)
console.log(`  전체 적합률 ${((100 * allFit) / rows.length).toFixed(1)}% 와 견줄 것`)

const koreaUsable = usable.filter((c) => c.members.some((m) => KOREA.test(m.title)))
console.log(`  쓸 수 있는 사건 중 한국 관련 ${koreaUsable.length} / ${usable.length}`)
for (const c of koreaUsable.slice(0, 6)) console.log(`    · ${c.headline.slice(0, 70)}`)
