// scripts/textbook/proofread-report.mjs
//
// **교정 재교·삼교 상시 점검 — 상업 교재 8단계 중 5번.**
//
// `proofread.ts` 를 저장 지문 전체에 돌려 표기 결함을 센다. **고치지 않는다** —
// 지문 수정은 원문 개작이라 사람이 정한다(§production-stages 5번 `storage`).
//
// 재실행 안전 — 읽기만 한다. 몇 번 돌려도 DB 가 바뀌지 않는다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/proofread-report.mjs
//   ... --limit 500          앞 500편만 (빠른 확인)
//   ... --rule quote_style   한 규칙만 표본을 본다
//   ... --out docs/reports/textbook-proofread.json

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const { proofreadPassage } = await import('@vocaflow/library-pipeline')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const argv = process.argv
const limitFlag = argv.indexOf('--limit')
const LIMIT = limitFlag > 0 ? Number(argv[limitFlag + 1]) : Infinity
const ruleFlag = argv.indexOf('--rule')
const ONLY_RULE = ruleFlag > 0 ? argv[ruleFlag + 1] : null
const outFlag = argv.indexOf('--out')

async function fetchAll() {
  const rows = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('csat_dcp_items')
      .select('id,type,v_level,payload')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < PAGE || rows.length >= LIMIT) break
  }
  return rows.slice(0, LIMIT === Infinity ? rows.length : LIMIT)
}

const items = await fetchAll()

// 지문은 `sentences` 배열로 산다. 배열이 아니면 이 점검의 대상이 아니다 —
// 대상 밖인 것을 "깨끗함" 으로 세면 결함률이 실제보다 낮게 나온다.
const passages = []
for (const it of items) {
  const s = it.payload?.sentences
  if (!Array.isArray(s) || s.length < 2) continue
  const body = s.join(' ')
  if (body.trim().length <= 40) continue
  passages.push({ id: it.id, type: it.type, vLevel: it.v_level, sentences: s })
}

const byRule = {}
const byType = {}
const samples = {}
let defective = 0

for (const p of passages) {
  const found = proofreadPassage(p.sentences)
  if (!found.length) continue
  defective += 1
  byType[p.type] ??= { defective: 0, total: 0 }
  byType[p.type].defective += 1
  for (const f of found) {
    byRule[f.rule] ??= { count: 0, stage: f.stage, passages: new Set() }
    byRule[f.rule].count += 1
    byRule[f.rule].passages.add(p.id)
    samples[f.rule] ??= []
    if (samples[f.rule].length < 3) samples[f.rule].push({ id: p.id, type: p.type, found: f.found, hint: f.hint })
  }
}
for (const p of passages) {
  byType[p.type] ??= { defective: 0, total: 0 }
  byType[p.type].total += 1
}

const rate = passages.length ? defective / passages.length : 0

console.log('\n교정 재교·삼교 — 표기 결함 점검')
console.log(`  대상 지문 ${passages.length.toLocaleString()}편 (문항 ${items.length.toLocaleString()}건 중 sentences 배열 보유)`)
console.log(`  결함 지문 ${defective.toLocaleString()}편 · ${(rate * 100).toFixed(2)}%\n`)

const rows = Object.entries(byRule).sort((a, b) => b[1].count - a[1].count)
if (!rows.length) console.log('  결함 없음.')
for (const [rule, v] of rows) {
  console.log(
    `  ${v.stage}  ${rule.padEnd(20)} ${String(v.count).padStart(5)}건 · 지문 ${String(v.passages.size).padStart(5)}편`,
  )
}

if (ONLY_RULE) {
  console.log(`\n표본 — ${ONLY_RULE}:`)
  for (const s of samples[ONLY_RULE] ?? []) console.log(`  [${s.type}] ${s.found}\n     → ${s.hint}`)
} else {
  console.log('\n표본 (규칙별 1건):')
  for (const [rule, list] of Object.entries(samples)) {
    const s = list[0]
    if (s) console.log(`  ${rule}: [${s.type}] ${s.found}`)
  }
}

const typeRows = Object.entries(byType)
  .filter(([, v]) => v.defective > 0)
  .sort((a, b) => b[1].defective - a[1].defective)
if (typeRows.length) {
  console.log('\n유형별 결함 지문:')
  for (const [type, v] of typeRows) {
    console.log(`  ${type.padEnd(18)} ${String(v.defective).padStart(4)}/${String(v.total).padEnd(5)} ${((v.defective / v.total) * 100).toFixed(1)}%`)
  }
}

if (outFlag > 0) {
  const file = argv[outFlag + 1]
  const json = {
    generatedAt: new Date().toISOString(),
    passages: passages.length,
    defective,
    defectRate: Number(rate.toFixed(4)),
    byRule: Object.fromEntries(rows.map(([r, v]) => [r, { stage: v.stage, count: v.count, passages: v.passages.size }])),
    byType: Object.fromEntries(typeRows),
    samples,
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
  console.log(`\n기록: ${file}`)
}
console.log()
