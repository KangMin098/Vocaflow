// scripts/textbook/explain-drain-import.mjs
//
// **해설 드레인 ②/② — Claude Code 가 쓴 해설을 DB 에 넣는다.**
//
// `answer_key.explanation_ko` 에 넣는다. jsonb 라 **마이그레이션이 필요 없고**,
// 채점 RPC(`grade_dcp_item`)는 `position`·`source_order` 만 읽으므로 키가 늘어도 무해하다.
//
// ── 넣기 전에 확인하는 것 ────────────────────────────────────────────
// **빈 해설을 넣지 않는다.** 청크를 다 못 채웠는데 그대로 돌리면 빈 문자열이 들어가고,
// 그러면 다음 export 가 "이미 해설 있음" 으로 세어 영영 안 쓰인다 — 조용히 구멍이 남는다.
// 그래서 비었거나 너무 짧은 항목은 **건너뛰고 몇 개를 건너뛰었는지 적는다.**
//
// 재실행 안전: 같은 값을 다시 써도 결과가 같다(멱등). `--commit` 없이는 아무것도 쓰지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/explain-drain-import.mjs           # 몇 개 들어갈지만
//   pnpm dlx tsx scripts/textbook/explain-drain-import.mjs --commit

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const commit = process.argv.includes('--commit')
const DIR = path.resolve('scripts/textbook/explain-drain')

/** 해설이 실제로 쓰인 것으로 볼 최소 길이. 한 줄짜리 "정답 ③" 같은 것을 막는다. */
const MIN_LENGTH = 20

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

if (!fs.existsSync(DIR)) {
  console.log(`청크 디렉터리가 없다: ${path.relative(process.cwd(), DIR)}`)
  process.exit(0)
}
const outFiles = fs.readdirSync(DIR).filter((f) => f.endsWith('.out.json')).sort()
if (!outFiles.length) {
  console.log('채워진 청크(.out.json)가 없다. export 로 뽑은 chunk-NN.json 을 채운 뒤 다시 돌린다.')
  process.exit(0)
}

const ready = []
let skippedEmpty = 0
let skippedShort = 0

for (const f of outFiles) {
  const rows = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  for (const r of rows) {
    const text = String(r.explanation_ko ?? '').trim()
    if (!text) {
      skippedEmpty++
      continue
    }
    if (text.length < MIN_LENGTH) {
      skippedShort++
      continue
    }
    ready.push({ id: r.id, text })
  }
}

console.log(`청크 ${outFiles.length}개 · 해설 ${ready.length}건`)
if (skippedEmpty) console.log(`  건너뜀 — 비어 있음 ${skippedEmpty}`)
if (skippedShort) console.log(`  건너뜀 — 너무 짧음(${MIN_LENGTH}자 미만) ${skippedShort}`)

if (!commit) {
  console.log('\n--commit 없이 실행했다. 아무것도 쓰지 않았다.')
  process.exit(0)
}

// 기존 answer_key 를 읽어 **키 하나만 더한다** — 통째로 덮으면 정답 키가 날아간다.
let written = 0
for (let i = 0; i < ready.length; i += 50) {
  const batch = ready.slice(i, i + 50)
  const { data, error } = await db
    .from('csat_dcp_items')
    .select('id, answer_key')
    .in('id', batch.map((b) => b.id))
  if (error) throw new Error('기존 정답 키 조회 실패: ' + error.message)
  const keyById = new Map((data ?? []).map((r) => [r.id, r.answer_key ?? {}]))

  for (const b of batch) {
    const prev = keyById.get(b.id)
    // 없는 문항에 쓰지 않는다 — 조용히 만들어 내면 출처 없는 행이 생긴다.
    if (!prev) throw new Error(`문항을 찾을 수 없다: ${b.id}`)
    const { error: e } = await db
      .from('csat_dcp_items')
      .update({ answer_key: { ...prev, explanation_ko: b.text } })
      .eq('id', b.id)
    if (e) throw new Error(`적재 실패 ${b.id}: ${e.message}`)
    written++
  }
}
console.log(`\n적재 완료 ${written}건`)
