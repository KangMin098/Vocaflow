// scripts/dict/plural-lane-eval.mjs
//
// **드레인이 나에게 판단이 필요 없는 일을 주고 있는가?** 를 재는 계측기.
//
// 실측 2026-08-26 (34청크 2,040낱말 판정 뒤):
//   낱말 모양별 add 율 — 하이픈 복합 38.2% · 일반 39.9% · **복수형(-s) 8.9%**
// 하이픈은 통념과 달리 일반어와 같은 수율이었다(드레인 스크립트 머리말도 같은 말을 한다).
// 남는 후보는 복수형 하나다. 그런데 "복수형이면 버린다" 는 규칙은 위험하다 —
// `headsets` 는 굴절형이지만 `informatics` `cannabinoids` 는 표제어일 수 있다.
//
// 그래서 규칙을 만들기 전에 **이미 사람이 내린 판정과 대조한다.**
// 규칙: 어간(-s / -es / -ies→y)이 이미 shared_dictionary 표제어면 굴절형으로 본다.
//
// 이 스크립트는 아무것도 쓰지 않는다. 읽고 표를 찍을 뿐이다.
//
// 실행: node scripts/dict/plural-lane-eval.mjs [--dir scripts/dict/pending-drain]

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath))
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }

const url = process.env['NEXT_PUBLIC_SUPABASE_URL']
const key = process.env['SUPABASE_SERVICE_ROLE_KEY']
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다.')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(url, key, { auth: { persistSession: false } })

const argDir = process.argv.indexOf('--dir')
const DIR = argDir > 0 ? process.argv[argDir + 1] : 'scripts/dict/pending-drain'

// ── 1. 이미 내려진 판정을 모은다 ─────────────────────────────────────
const judged = []
for (const f of fs.readdirSync(DIR).filter((n) => n.endsWith('.out.json'))) {
  let rows
  try { rows = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { continue }
  for (const o of rows) if (o && o.word && o.verdict) judged.push([String(o.word).toLowerCase(), o.verdict])
}
if (!judged.length) {
  console.error(`${DIR} 에 .out.json 이 없다 — 대조할 판정이 없으므로 아무 결론도 못 낸다.`)
  process.exit(1)
}

// ── 2. 복수형 모양만 남긴다 ──────────────────────────────────────────
const PLURAL = /^[a-z]{4,}s$/
const plurals = judged.filter(([w]) => PLURAL.test(w))

const stemsOf = (w) => {
  const out = new Set([w.slice(0, -1)])
  if (w.endsWith('es')) out.add(w.slice(0, -2))
  if (w.endsWith('ies')) out.add(`${w.slice(0, -3)}y`)
  return [...out].filter((s) => s.length >= 3)
}

const wanted = new Set()
for (const [w] of plurals) for (const s of stemsOf(w)) wanted.add(s)

// ── 3. 그 어간들이 사전에 있는지 묻는다 (IN 절을 나눠서) ─────────────
const known = new Set()
const list = [...wanted]
const STEP = 400
for (let i = 0; i < list.length; i += STEP) {
  const slice = list.slice(i, i + STEP)
  const { data, error } = await db.from('shared_dictionary').select('word').in('word', slice)
  if (error) { console.error(`사전 조회 실패: ${error.message}`); process.exit(1) }
  for (const r of data) known.add(String(r.word).toLowerCase())
}

// ── 4. 규칙 판정 vs 사람 판정 ────────────────────────────────────────
const table = {}
const wrongAdds = []
for (const [w, v] of plurals) {
  const ruleSaysInflection = stemsOf(w).some((s) => known.has(s))
  const k = ruleSaysInflection ? 'rule:굴절형' : 'rule:모름'
  table[k] = table[k] || {}
  table[k][v] = (table[k][v] || 0) + 1
  if (ruleSaysInflection && v === 'add') wrongAdds.push(w)
}

console.log(`판정 총 ${judged.length} · 복수형 모양 ${plurals.length} · 대조한 어간 ${list.length}\n`)
for (const k of Object.keys(table).sort()) {
  const row = table[k]
  const tot = Object.values(row).reduce((a, b) => a + b, 0)
  const add = row.add || 0
  console.log(
    `${k.padEnd(12)} 총 ${String(tot).padStart(4)} · add ${String(add).padStart(3)} (${((add * 100) / tot).toFixed(1)}%)` +
      ` · defer ${String(row.defer || 0).padStart(3)} · noise ${String(row.noise || 0).padStart(3)} · proper ${String(row.proper_noun || 0).padStart(3)}`,
  )
}

const ruleRow = table['rule:굴절형'] || {}
const ruleTot = Object.values(ruleRow).reduce((a, b) => a + b, 0)
const ruleAdd = ruleRow.add || 0
console.log('')
if (!ruleTot) {
  console.log('규칙이 아무것도 못 잡았다 — 선필터를 만들 근거가 없다.')
} else {
  console.log(`규칙이 "굴절형" 이라 한 ${ruleTot}건 중 사람이 add 한 것은 ${ruleAdd}건 (${((ruleAdd * 100) / ruleTot).toFixed(1)}%).`)
  console.log(`즉 선필터를 켜면 표제어 ${ruleAdd}개를 잃는다.`)
  if (wrongAdds.length) console.log(`  잃게 될 것: ${wrongAdds.slice(0, 20).join(' · ')}${wrongAdds.length > 20 ? ' …' : ''}`)
  console.log('')
  console.log(
    ruleAdd === 0
      ? '→ 손실 0. 선필터를 export 에 넣을 근거가 있다.'
      : '→ 손실이 0 이 아니다. 자동 기각이 아니라 **별도 레인으로 미루는 것**까지만 정당하다.',
  )
}
