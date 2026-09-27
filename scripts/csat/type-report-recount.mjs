// scripts/csat/type-report-recount.mjs
//
// **유형 리포트의 문항 수(`n_analyzed`)를 DB 에서 다시 센다.** (2026-09-28)
//
// 옛 값은 분석 드레인 청크의 `item_ids` 를 모은 것이라, 문항 유형이 나중에 바뀌면(재분류) 옛 유형에
// 남고 새 유형에 빠진다(실측: 합 800 · 실제 802 · 6유형 어긋남). 여기서는 **지금 그 유형인 문항 중
// published 분석이 있는 것**을 센다. 2014 A/B형 공통 문항(2쌍)도 **문항 행마다** 센다 —
// 관리 콘솔의 「리포트 계수 불일치」가 유형별 문항 행 수와 대조하므로, 한 번만 세면 그 두 유형이
// 영영 불일치로 남는다(드레인 import 의 중복 제거는 청크 게이트용이다).
//
// 재실행 안전: 값이 같으면 쓰지 않는다. 기본은 미리보기 — `--commit` 이 있어야 쓴다.
//   NODE_OPTIONS=--tls-max-v1.2 node scripts/csat/type-report-recount.mjs [--commit]

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { isKiceExam } from './lib-exam-id.mjs'

for (const f of ['apps/web/.env.local', '.env.local']) {
  try {
    for (const line of fs.readFileSync(path.resolve(f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 없으면 다음 후보 */
  }
}
const COMMIT = process.argv.includes('--commit')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 페이지로 읽는다 — 학평 문항이 들어와 1,000행을 넘는다(한 번에 읽으면 조용히 잘린다)
const items = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('csat_items').select('id, type_id').order('id').range(from, from + 999)
  if (error) throw new Error(error.message)
  items.push(...data)
  if (data.length < 1000) break
}
const analyzed = new Set()
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('csat_item_analyses').select('item_id').eq('status', 'published').range(from, from + 999)
  if (error) throw new Error(error.message)
  for (const r of data) analyzed.add(r.item_id)
  if (data.length < 1000) break
}
const byType = new Map()
// 유형 리포트는 평가원 집합의 것이다 — 학평(보조 집합) 문항은 세지 않는다
for (const it of items) {
  if (!isKiceExam(it.id) || !analyzed.has(it.id)) continue
  if (!byType.has(it.type_id)) byType.set(it.type_id, [])
  byType.get(it.type_id).push(it.id)
}
const { data: reps, error: e2 } = await db.from('csat_type_reports').select('type_id, n_analyzed').eq('status', 'published')
if (e2) throw new Error(e2.message)
let changed = 0
let total = 0
for (const r of reps.sort((a, b) => a.type_id.localeCompare(b.type_id))) {
  const n = (byType.get(r.type_id) ?? []).length
  total += n
  if (n === r.n_analyzed) continue
  changed += 1
  console.log(`  ${r.type_id}  ${r.n_analyzed} → ${n}`)
  if (COMMIT) {
    const { error } = await db.from('csat_type_reports').update({ n_analyzed: n }).eq('type_id', r.type_id)
    if (error) throw new Error(`${r.type_id}: ${error.message}`)
  }
}
console.log(`${COMMIT ? '고침' : '미리보기 — --commit 을 붙이면 쓴다'} · 유형 ${reps.length} · 바뀜 ${changed} · 합 ${total}`)
