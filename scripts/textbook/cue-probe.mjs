// scripts/textbook/cue-probe.mjs
//
// **해설의 근거가 될 단서를 corpus 에서 센다.** 짐작으로 목록을 만들지 않기 위해서다.
//
// 해설을 결정론으로 쓰려면 "왜 이 순서인가" 를 문장 자체가 말해 줘야 한다. 그 자국은
// 문장 첫머리에 남는다 — 연결어(However·Therefore) · 지시어(This·These) · 대명사(It·They).
// 어느 것이 실제로 얼마나 나오는지 재지 않고 목록을 적으면 그건 짐작이다.
//
// 재실행 안전: 읽기만 한다.
// 실행: pnpm dlx tsx scripts/textbook/cue-probe.mjs

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

const rows = []
for (let from = 0; ; from += 500) {
  const { data, error } = await db
    .from('csat_dcp_items')
    .select('type, payload, answer_key')
    .order('id')
    .range(from, from + 499)
  if (error) throw new Error(error.message)
  if (!data?.length) break
  rows.push(...data)
  if (data.length < 500) break
}
console.log(`문항 ${rows.length}개`)

// 후보 문장: 해설이 근거로 삼아야 하는 자리의 문장들.
//   order  — 원문에서 2번째 이후 문장(= 어떤 덩어리든 앞에 무언가가 온다)
//   insert — 넣을 문장, 그리고 정답 자리 바로 뒤 문장
const sents = []
for (const r of rows) {
  if (r.type === 'order') {
    const p = r.payload?.presented ?? []
    const so = r.answer_key?.source_order ?? []
    const orig = new Array(p.length)
    for (let k = 0; k < p.length; k++) orig[so[k]] = p[k]
    for (let i = 1; i < orig.length; i++) if (orig[i]) sents.push(orig[i])
  } else {
    const rem = r.payload?.remaining ?? []
    const pos = r.answer_key?.position
    if (r.payload?.insert_sentence) sents.push(r.payload.insert_sentence)
    if (pos != null && rem[pos]) sents.push(rem[pos])
  }
}
console.log(`후보 문장 ${sents.length}개\n`)

const first = new Map()
for (const s of sents) {
  const w = String(s).trim().replace(/^["“'‘(]+/, '').split(/[\s,;:.]+/)[0]
  if (!w) continue
  const key = w.replace(/[^A-Za-z'-]/g, '')
  if (!key) continue
  first.set(key, (first.get(key) ?? 0) + 1)
}
const total = sents.length
const ranked = [...first.entries()].sort((a, b) => b[1] - a[1])
console.log('첫 낱말 상위 60 (건수 · 후보문장 대비 %)')
for (const [w, n] of ranked.slice(0, 60)) {
  console.log(`  ${w.padEnd(16)} ${String(n).padStart(5)}  ${((100 * n) / total).toFixed(2)}%`)
}
console.log(`\n서로 다른 첫 낱말 ${ranked.length}종 · 상위 60 누적 ${((100 * ranked.slice(0,60).reduce((s,[,n])=>s+n,0)) / total).toFixed(1)}%`)
