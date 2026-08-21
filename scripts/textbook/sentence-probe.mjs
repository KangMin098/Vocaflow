// scripts/textbook/sentence-probe.mjs
//
// **문장 길이 분포를 잰다.** 영작 배열(어순 배열) 문항이 받을 낱말 수 범위를 정하기 위해서다.
//
// 짧으면 문제가 안 되고(3~4어는 보자마자 맞춘다) 길면 손으로 못 푼다. 어디를 자를지는
// **우리 재고의 실제 분포**를 보고 정한다 — 다른 데서 본 숫자를 가져오면 그건 짐작이다.
//
// 밴드별로 따로 본다. 초중급(V1~4) 지문의 문장이 실제로 몇 어인지가 이 유형의 성패다.
//
// 재실행 안전: 읽기만 한다.
// 실행: pnpm dlx tsx scripts/textbook/sentence-probe.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: arts, error } = await db
  .from('library_articles')
  .select('id, article_v_level, display_only, content')
  .in('status', ['ready', 'published'])
  .not('content', 'is', null)
if (error) throw new Error(error.message)

const lens = []
const byBand = new Map()
let repeatedToken = 0
let total = 0

for (const a of arts ?? []) {
  if (a.display_only) continue // ND 는 본문을 못 쓴다
  for (const para of String(a.content).split(/\n\s*\n+/)) {
    for (const s of para.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)) {
      const t = s.trim()
      if (!t) continue
      const words = t.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean)
      total++
      lens.push(words.length)
      const band = a.article_v_level ?? -1
      byBand.set(band, [...(byBand.get(band) ?? []), words.length])
      // 같은 낱말이 두 번 나오면 배열 문제의 정답이 하나로 확정되지 않는다.
      const seen = new Set()
      let dup = false
      for (const w of words) {
        const k = w.toLowerCase().replace(/[^a-z']/g, '')
        if (!k) continue
        if (seen.has(k)) dup = true
        seen.add(k)
      }
      if (dup) repeatedToken++
    }
  }
}

lens.sort((a, b) => a - b)
const q = (p) => lens[Math.min(lens.length - 1, Math.floor(p * lens.length))]
console.log(`문장 ${total}개 (ND 제외 · 발행+검수대기)\n`)
console.log(`  p10 ${q(0.1)}  p25 ${q(0.25)}  중앙 ${q(0.5)}  p75 ${q(0.75)}  p90 ${q(0.9)}  최대 ${lens.at(-1)}`)
console.log(`  같은 낱말이 두 번 이상 나오는 문장: ${repeatedToken} = ${((100 * repeatedToken) / total).toFixed(1)}%`)
console.log('    ↳ 배열 문항의 정답이 하나로 확정되지 않는다 — 이만큼은 못 쓴다\n')

// 후보 범위별 재고 — 어디를 잘라야 문항이 얼마나 나오는지
console.log('  낱말 수 구간별 재고')
for (const [lo, hi] of [
  [5, 8],
  [6, 10],
  [6, 12],
  [7, 12],
  [8, 14],
]) {
  const n = lens.filter((x) => x >= lo && x <= hi).length
  console.log(`    ${lo}~${hi}어  ${String(n).padStart(6)}  ${((100 * n) / total).toFixed(1)}%`)
}

console.log('\n  밴드별 중앙 낱말 수 (문항 수)')
for (const [band, arr] of [...byBand.entries()].sort((a, b) => a[0] - b[0])) {
  arr.sort((a, b) => a - b)
  const mid = arr[Math.floor(arr.length / 2)]
  const in6to12 = arr.filter((x) => x >= 6 && x <= 12).length
  console.log(
    `    V${String(band).padEnd(3)} 문장 ${String(arr.length).padStart(5)} · 중앙 ${String(mid).padStart(3)}어 · 6~12어 ${String(in6to12).padStart(5)} (${((100 * in6to12) / arr.length).toFixed(0)}%)`,
  )
}
