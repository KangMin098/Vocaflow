// scripts/csat/rates/import-megastudy.mjs
//
// 메가스터디 정답률 원장(fetch-megastudy.mjs 산출) → csat_item_response_stats (source_id='megastudy').
//
//   node --tls-max-v1.2 scripts/csat/rates/import-megastudy.mjs [--in <원장.json>] [--commit]
//
// 회차·유형 대응 = 정답 키: 같은 학년 · 같은 시행년(exam_year)의 DB 회차 × 원장 유형(홀/짝) 중 DB 문항 정답이
//   전부 같은 쌍(겹치는 문항 ≥ 20)이 정확히 하나일 때만 넣는다. 날짜·월은 쓰지 않는다 — 2020 코로나 연기 · 2022-08-31 모평처럼
//   시행 월이 어긋나고, DB 수능 일부 회차는 짝수형 정답 키로 들어 있다(paper_form 표기와 무관).
//   한 문항이라도 다르면 넣지 않고(다른 시험·유형) 90% 이상 일치는 「근접」으로 보고한다(DB 정답 오류 후보).
//   원장에는 전 45문항이 있어 DB 에 없는 문항(듣기 1~17 등)도 같이 넣는다 — 외래키는 회차까지만. 배점 불일치는 수만 보고한다.
// 재실행 안전: (exam_id, no, source_id) upsert — 같은 원장을 다시 넣으면 값이 같다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const IN = (() => { const i = args.indexOf('--in'); return i >= 0 ? args[i + 1] : path.join(HERE, 'source', 'megastudy-correct-rate.json') })()
const COMMIT = args.includes('--commit')

const fromFiles = (name) => {
  for (const f of ['.env.local', '.env', 'apps/web/.env.local', 'apps/web/.env']) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(new RegExp(String.raw`^${name}\s*=\s*(.+)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}
const pick = (...names) => names.map((n) => process.env[n]).find(Boolean) ?? names.map(fromFiles).find(Boolean) ?? null
const url = pick('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL')
const key = pick('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY')
if (!url || !key) throw new Error('SUPABASE_URL / SERVICE_ROLE_KEY 가 필요하다')
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(url, key, { auth: { persistSession: false } })
console.log(`대상 DB: ${new URL(url).host}`)

async function all(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) return out
  }
}

const led = JSON.parse(fs.readFileSync(IN, 'utf8'))
const exams = await all('csat_exams', 'id, kind, exam_year, month, grade')
const items = await all('csat_items', 'exam_id, no, answer, answers, points')
const itemsByExam = new Map()
for (const it of items) {
  if (!itemsByExam.has(it.exam_id)) itemsByExam.set(it.exam_id, new Map())
  itemsByExam.get(it.exam_id).set(it.no, it)
}

const rows = []
const report = { matched: 0, noMatch: [], ambiguous: [], near: [], unverified: [], pointsMismatch: 0 }
const usedIds = new Map()
const answerOk = (it, a) => (it.answers?.length ? it.answers.includes(a) : it.answer === a)
for (const e of led.exams) {
  const y = Number(e.date.slice(0, 4))
  const hits = []
  for (const x of exams.filter((x) => x.grade === e.grade && x.exam_year === y)) {
    const dbItems = itemsByExam.get(x.id) ?? new Map()
    for (const fm of e.forms) {
      const both = fm.rows.filter((r) => dbItems.has(r.no))
      const same = both.filter((r) => answerOk(dbItems.get(r.no), r.answer)).length
      if (both.length >= 20 && same === both.length) hits.push({ exam: x, fm })
      else if (both.length >= 20 && same / both.length >= 0.9) report.near.push(`${e.date} 고${e.grade} ${fm.form ?? ''} ~ ${x.id} ${same}/${both.length}`)
    }
  }
  const tag = `${e.date} 고${e.grade} ${e.label}(seq ${e.seq})`
  // 대조할 문항이 하나도 없는 DB 회차만 날짜(종류·학년·시행년·월)로 대응하고 verified=false 로 남긴다
  let verified = true
  if (hits.length === 0) {
    const mo = Number(e.date.slice(5, 7))
    const bare = exams.filter((x) => !itemsByExam.has(x.id) && x.kind === e.kind && x.grade === e.grade && x.exam_year === y && x.month === mo)
    if (bare.length === 1 && e.forms.length === 1) { hits.push({ exam: bare[0], fm: e.forms[0] }); verified = false; report.unverified.push(`${tag} → ${bare[0].id}`) }
  }
  if (hits.length === 0) { report.noMatch.push(tag); continue }
  if (hits.length > 1) { report.ambiguous.push(`${tag} → ${hits.map((h) => `${h.exam.id}/${h.fm.form}`).join(' ')}`); continue }
  const { exam, fm } = hits[0]
  if (usedIds.has(exam.id)) { report.ambiguous.push(`${exam.id} ← seq ${usedIds.get(exam.id)}, ${e.seq}`); continue }
  usedIds.set(exam.id, e.seq)
  report.matched++
  const dbItems = itemsByExam.get(exam.id) ?? new Map()
  for (const r of fm.rows) {
    const it = dbItems.get(r.no)
    if (it?.points != null && it.points !== r.points) report.pointsMismatch++
    rows.push({
      exam_id: exam.id,
      no: r.no,
      source_id: 'megastudy',
      correct_rate: r.correctRate,
      choice_rates: r.choiceRates,
      unreported_choice_rate: r.unreportedChoiceRate,
      difficulty: r.difficulty || null,
      points: r.points,
      answer: r.answer,
      paper_form: fm.form,
      verified,
      source_exam_ref: String(e.seq),
      retrieved_at: led.retrievedAt,
    })
  }
}

const dbOnly = exams.filter((x) => !usedIds.has(x.id)).map((x) => x.id)
console.log(`원장 ${led.exams.length}회 → 대응·검증 통과 ${report.matched}회 · ${rows.length}행`)
console.log(`  대응 없음 ${report.noMatch.length} · 모호 ${report.ambiguous.length} · 근접(DB 정답 오류 후보) ${report.near.length} · 날짜 대응(미검증) ${report.unverified.length} · 배점 불일치 ${report.pointsMismatch}문항`)
for (const k of ['noMatch', 'ambiguous', 'near', 'unverified']) for (const s of report[k]) console.log(`  [${k}] ${s}`)
console.log(`  DB 회차 중 메가스터디 값이 없는 것 ${dbOnly.length}: ${dbOnly.join(',')}`)

if (!COMMIT) { console.log('dry-run — DB 에 쓰지 않았다. 적용은 --commit.'); process.exit(0) }
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db.from('csat_item_response_stats').upsert(rows.slice(i, i + 500), { onConflict: 'exam_id,no,source_id' })
  if (error) throw new Error(`upsert ${i}: ${error.message}`)
}
const { count, error } = await db.from('csat_item_response_stats').select('*', { count: 'exact', head: true }).eq('source_id', 'megastudy')
if (error) throw new Error(error.message)
console.log(`적재 완료 — megastudy ${count}행`)
