// scripts/textbook/narrative-band-probe.mjs
//
// **수확한 서사가 어느 밴드에 앉았는가** — 심경(mood)·장문 지칭이 V7 에서 0 인 이유를 잰다.
//
// ── 왜 필요한가 ─────────────────────────────────────────────────────
// `harvest-gutenberg.mjs --narrative` 로 이야기를 담았는데도 V7 심경 재고가 1편이다.
// 짐작은 "이야기는 어휘가 평이해 V4~V5 로 배정된다" 였다 — 짐작인 채로 질의를 고치면
// 또 엉뚱한 곳에 쌓인다. 그래서 **실제 배정된 밴드를 세어 본다.**
//
// 재실행 안전: 읽기만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/narrative-band-probe.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fetchAllPaged } from './volume-pool.mjs'
import { looksNarrative, peopleRatio, speechCount } from '../csat/lib-narrative.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const rows = await fetchAllPaged(db, (q) =>
  q
    .from('library_articles')
    .select("id,title,source,status,article_v_level,content")
    .eq('source', 'gutenberg')
    .order('id'),
)

/** V-Level → 교재 밴드. `schoolOfBand` 와 같은 사다리를 쓴다. */
const bandOf = (v) => (v == null ? '미분류' : `V${v}`)

const tally = new Map()
let narr = 0
for (const r of rows) {
  const text = String(r.content ?? '')
  const isN = looksNarrative(text)
  if (isN) narr += 1
  const k = `${bandOf(r.article_v_level)}\t${r.status}`
  const t = tally.get(k) ?? { all: 0, narrative: 0 }
  t.all += 1
  if (isN) t.narrative += 1
  tally.set(k, t)
}

console.log(`Gutenberg 수확 ${rows.length.toLocaleString()}편 · 서사 판정 통과 ${narr.toLocaleString()}편\n`)
console.log('밴드\t상태\t\t전체\t서사')
for (const [k, t] of [...tally].sort()) {
  const [band, status] = k.split('\t')
  console.log(`${band}\t${status.padEnd(10)}\t${t.all}\t${t.narrative}`)
}

// 상위 밴드에서 서사인 글의 제목을 몇 개 보여 준다 — 있는데 못 쓰는 것인지, 없는 것인지.
const upper = rows.filter((r) => (r.article_v_level ?? 0) >= 6 && looksNarrative(String(r.content ?? '')))
console.log(`\nV6+ 서사 ${upper.length}편`)
for (const r of upper.slice(0, 15)) {
  const t = String(r.content ?? '')
  console.log(`  V${r.article_v_level} ${r.status.padEnd(9)} 인물 ${peopleRatio(t).toFixed(3)} 발화 ${speechCount(t)} — ${r.title.slice(0, 52)}`)
}
