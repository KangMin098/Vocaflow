// scripts/textbook/review-causes.mjs
//
// **3인 검수가 막은 사유를 계열로 접어, 「무엇을 고치면 몇 개가 풀리나」를 낸다.**
//
// 화면은 「3인 통과 9 / 172」만 말한다. 그 상태에서 할 수 있는 판단은 「163개를 하나씩
// 고친다」뿐이고 그건 아무도 안 한다. 사유 947건을 읽으면 같은 말이 되풀이되므로,
// 계열로 접으면 **고칠 공정**이 보인다.
//
// ⚠️ **문자열 휴리스틱이지 의미 판정이 아니다.** 미분류 비율을 늘 함께 찍는다 —
//   그 값이 크면 아래 집계를 근거로 쓰면 안 된다. 계열마다 원문 표본도 함께 낸다.
//
// **읽기만 한다**(SELECT 뿐). 몇 번을 돌려도 결과가 같다.
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/review-causes.mjs [--samples 2]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const envText = fs.readFileSync(path.join(ROOT, 'apps/web/.env.local'), 'utf8')
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const { createClient } = await import('@supabase/supabase-js')
const { CAUSE_LABEL, classifyCause, tallyCauses } = await import('@vocaflow/library-pipeline')

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const SAMPLES = Number(arg('samples', 2))
/** 미분류를 몇 줄 보여 줄지 — **규칙을 늘리려면 이걸 읽어야 한다.** */
const UNKNOWN = Number(arg('unknown', 0))

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ⚠️ **페이지로 나눠 읽는다.** 이 저장소는 필터 없는 전수 조회가 1000행에서 조용히 잘려
//   「이미 끝난 유형이 남은 몫 상단에 올라오는」 사고를 겪었다(csat-evidence 도움말).
const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('csat_item_reviews')
    .select('item_id, persona, verdict, findings')
    .neq('verdict', 'pass')
    .range(from, from + 999)
  if (error) {
    console.error('조회 실패:', error.message)
    process.exit(1)
  }
  rows.push(...(data ?? []))
  if (!data || data.length < 1000) break
}

const findings = []
for (const r of rows) {
  for (const f of Array.isArray(r.findings) ? r.findings : []) {
    if (typeof f === 'string' && f.trim()) findings.push({ itemId: r.item_id, finding: f, persona: r.persona })
  }
}

const report = tallyCauses(findings)

// 3인 판정 현황 — 분모가 없으면 집중도가 의미를 잃는다.
const { data: all, error: e2 } = await db
  .from('csat_item_reviews')
  .select('item_id, persona, verdict')
  .range(0, 9999)
if (e2) {
  console.error('조회 실패:', e2.message)
  process.exit(1)
}
const seen = new Map()
const passers = new Map()
for (const r of all ?? []) {
  if (!seen.has(r.item_id)) seen.set(r.item_id, new Set())
  seen.get(r.item_id).add(r.persona)
  if (r.verdict !== 'pass') continue
  if (!passers.has(r.item_id)) passers.set(r.item_id, new Set())
  passers.get(r.item_id).add(r.persona)
}
const settled = [...seen.values()].filter((s) => s.size >= 3).length
const passed = [...passers.values()].filter((s) => s.size >= 3).length

console.log(`3인이 본 문항 ${settled} · 3인 전원 통과 ${passed} (${((passed / Math.max(1, settled)) * 100).toFixed(1)}%)`)
console.log(`막은 사유 ${report.totalFindings}건 · 걸린 문항 ${report.totalItems}`)
console.log('')

if (report.unknownShare > 0.3) {
  console.log(`⚠️ 미분류 ${(report.unknownShare * 100).toFixed(1)}% — 사유 ${report.totalFindings - Math.round(report.totalFindings * report.unknownShare)}건만 계열로 접혔다.`)
  console.log('   아래 집계는 **접힌 것 안에서의 순위**다. 미분류가 다른 분포를 가질 수 있으므로')
  console.log(`   「${report.tally[1]?.cause === undefined ? '상위 계열' : '상위 계열'}만 고치면 풀린다」로 읽지 마라 — --unknown 으로 직접 읽는다.`)
  console.log('')
}

console.log('계열            사유    문항   고칠 자리')
for (const t of report.tally) {
  const L = CAUSE_LABEL[t.cause]
  const pct = ((t.findings / report.totalFindings) * 100).toFixed(1)
  console.log(
    `${L.label.padEnd(12)}${String(t.findings).padStart(5)} ${String(pct).padStart(5)}% ${String(t.items).padStart(4)}   ${L.fixes}`,
  )
}
console.log('')
console.log(`겹쳐 걸린 사유 ${report.ambiguous}건 (${((report.ambiguous / report.totalFindings) * 100).toFixed(1)}%) — 접은 것은 보고지 판정이 아니다`)
console.log(`미분류 ${(report.unknownShare * 100).toFixed(1)}%`)

if (UNKNOWN > 0) {
  console.log('')
  console.log('— 미분류 (규칙을 늘릴 재료) —')
  const un = findings.filter((f) => classifyCause(f.finding).cause === 'unknown')
  for (const e of un.slice(0, UNKNOWN)) console.log('  · ' + e.finding.slice(0, 150))
}

if (SAMPLES > 0) {
  console.log('')
  console.log('— 계열마다 실제 사유 (규칙이 맞게 접었는지 눈으로 본다) —')
  for (const t of report.tally) {
    const ex = findings.filter((f) => classifyCause(f.finding).cause === t.cause).slice(0, SAMPLES)
    console.log(`\n[${CAUSE_LABEL[t.cause].label}]`)
    for (const e of ex) console.log(`  · ${e.finding.slice(0, 120)}`)
  }
}
