// scripts/compose/ripen-eta.mjs
//
// ACP §20 — **쓸 수 있는 사건이 언제 익는가.**
//
// 왜 필요한가 (2026-08-19):
//   기여도 측정(contribution-probe)은 48시간 보류를 무시하고 재기 때문에 "쓸 수 있는 사건 5건,
//   그중 한국 관련 3건" 이 나오는데, 실제 수집 화면에는 3건이 뜨고 한국 관련은 0건이다.
//   이 차이를 "고장" 으로 오해하면 멀쩡한 피드를 끄게 된다 — 실제로 Cycle 1 에 그렇게 껐다.
//   차이의 정체는 대부분 **아직 안 익은 것**이고, 그건 고칠 대상이 아니라 기다릴 대상이다.
//
// 이 스크립트는 그 둘 사이를 시간으로 잇는다. 사건마다 구성원 중 **가장 늦게 발행된 것**을
// 기준으로 익는 시각을 계산한다(그때라야 사건 전체가 48시간을 넘긴다).
//
// 읽기 전용 — 아무것도 쓰지 않는다.
// 실행: pnpm dlx tsx scripts/compose/ripen-eta.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const { clusterStories, classifyTopic, isKoreaRelevant } = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('article_compose_candidates')
    .select('source_key, publisher, wire, title, url, published_at')
    .eq('status', 'open')
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

const HOLD_MS = 48 * 3_600_000
const now = Date.now()
const usable = clusters.filter((c) => c.worthPursuing && classifyTopic(c.headline) === 'fit')

const scored = usable
  .map((c) => {
    // 사건이 익는 시각 = **가장 늦게 발행된 구성원** + 48시간.
    //   가장 이른 것으로 재면 아직 안 익은 구성원을 쓰게 된다.
    const latest = Math.max(...c.members.map((m) => new Date(m.published_at).getTime()))
    return {
      c,
      ripeAt: latest + HOLD_MS,
      korea: isKoreaRelevant(c.headline, c.members.map((m) => m.publisher)),
    }
  })
  .sort((a, b) => a.ripeAt - b.ripeAt)

const ripe = scored.filter((s) => s.ripeAt <= now)
console.log(`쓸 수 있는 사건 ${scored.length} · 지금 익은 것 ${ripe.length} · 익는 중 ${scored.length - ripe.length}`)
console.log(`  그중 한국 관련 ${scored.filter((s) => s.korea).length} (익은 것 ${ripe.filter((s) => s.korea).length})\n`)

for (const s of scored) {
  const hours = (s.ripeAt - now) / 3_600_000
  const when = hours <= 0 ? '익음' : `${hours.toFixed(1)}시간 뒤`
  console.log(`  ${s.korea ? '[한국]' : '     '} ${when.padStart(11)}  ${s.c.headline.slice(0, 56)}`)
  console.log(`                       ${s.c.members.map((m) => m.publisher).join(', ')}`)
}

if (!ripe.length && scored.length) {
  console.log('\n지금 0건인 것은 고장이 아니라 **아직 안 익은 것**이다 — 위 시각에 저절로 뜬다.')
}
