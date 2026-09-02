// scripts/csat/analysis-drain-import.mjs
//
// **기출 문항 분석 드레인 — 3단계(import).** `.out.json` 원장을 DB 로 올린다.
//
// ⚠️ **검수 게이트를 먼저 통과해야 한다.** `--commit` 은 `analysis-drain-validate.mjs` 를
//    실행해 exit 0 인 것만 올린다. 게이트를 건너뛰는 플래그는 두지 않는다 —
//    두면 급할 때 쓰이고, 급할 때 쓰인 것이 학습자에게 그대로 간다.
//
// 빈 값·짧은 값은 넣지 않는다. 건너뛴 수를 반드시 출력한다(CLAUDE.md §🤖).
// jsonb 는 통째로 덮되, **버전을 올려 새 행으로 넣는다** — 옛 분석을 덮어 지우지 않는다.
// 그래야 "무엇이 어떻게 바뀌었나" 를 나중에 볼 수 있다.
//
// 실행:
//   node scripts/csat/analysis-drain-import.mjs           (미리보기)
//   node scripts/csat/analysis-drain-import.mjs --commit

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const COMMIT = process.argv.includes('--commit')
const WORK = path.resolve('scripts/csat/analysis-drain')

function env(name) {
  if (process.env[name]) return process.env[name]
  for (const f of ['.env.local', '.env', 'apps/web/.env.local', 'apps/web/.env']) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}
const URL = env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL')
const KEY = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_KEY')
if (!URL || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 못 찾았다')
const db = createClient(URL, KEY, { auth: { persistSession: false } })

// ── 게이트 ────────────────────────────────────────────────────────────
if (COMMIT) {
  try {
    execFileSync(process.execPath, ['scripts/csat/analysis-drain-validate.mjs'], { stdio: 'inherit' })
  } catch {
    console.log('\n  ✗ 검수 게이트 실패 — 적재하지 않는다')
    process.exit(1)
  }
}

const files = fs.readdirSync(WORK).filter((f) => f.endsWith('.out.json')).sort()
if (!files.length) { console.log('  .out.json 이 없다'); process.exit(0) }

const analyses = []
const reviewsOf = new Map()
const typeReports = new Map()
const skipped = []

for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'))
  for (const a of j.analyses ?? []) {
    // 빈 값·짧은 값은 넣지 않는다. 넣으면 다음 export 가 "완료" 로 세어 구멍이 영영 남는다.
    if (!a.item_id) { skipped.push(`${f}: item_id 없음`); continue }
    if (!a.measured_ability || a.measured_ability.length < 20) { skipped.push(`${a.item_id}: measured_ability 부실`); continue }
    if (!a.design_intent || a.design_intent.length < 20) { skipped.push(`${a.item_id}: design_intent 부실`); continue }
    if (!(a.solve_procedure ?? []).length) { skipped.push(`${a.item_id}: solve_procedure 없음`); continue }
    const pass = new Set((a.reviews ?? []).filter((r) => r.verdict === 'pass').map((r) => r.persona))
    if (pass.size < 3) { skipped.push(`${a.item_id}: 3인 검수 미완(${pass.size})`); continue }

    analyses.push({
      item_id: a.item_id,
      measured_ability: a.measured_ability,
      design_intent: a.design_intent,
      answer_locus: a.answer_locus ?? null,
      choice_analysis: a.choices ?? [],
      solve_procedure: a.solve_procedure ?? [],
      time_budget_sec: a.time_budget_sec ?? null,
      difficulty: a.difficulty ?? null,
      required_vocab: a.required_vocab ?? [],
      answer_unknown: a.answer_unknown === true,
      body_recovered: a.body_recovered === true,
    })
    reviewsOf.set(a.item_id, a.reviews ?? [])
  }
  const tr = j.type_report
  if (tr?.type_id) typeReports.set(tr.type_id, tr)
}

console.log(`\n  파일 ${files.length} · 적재 대상 ${analyses.length} · 건너뜀 ${skipped.length} · 유형 리포트 ${typeReports.size}`)
for (const s of skipped.slice(0, 10)) console.log(`    · ${s}`)
if (skipped.length > 10) console.log(`    · … 외 ${skipped.length - 10}건`)

if (!COMMIT) { console.log('\n  미리보기다 — 아무것도 쓰지 않았다. 올리려면 --commit'); process.exit(0) }

// ── 적재 ──────────────────────────────────────────────────────────────
let inserted = 0
let republished = 0
for (const a of analyses) {
  // 같은 문항의 최신 버전을 보고, 내용이 같으면 건너뛴다(재실행 안전).
  const { data: prev } = await db
    .from('csat_item_analyses')
    .select('id, version, measured_ability, design_intent, status')
    .eq('item_id', a.item_id)
    .order('version', { ascending: false })
    .limit(1)
  const last = prev?.[0]
  const same = last && last.measured_ability === a.measured_ability && last.design_intent === a.design_intent
  let aid = last?.id

  if (!same) {
    const { data, error } = await db
      .from('csat_item_analyses')
      .insert({ ...a, version: (last?.version ?? 0) + 1, status: 'draft' })
      .select('id')
      .single()
    if (error) throw new Error(`${a.item_id}: ${error.message}`)
    aid = data.id
    inserted += 1
  }

  // 검수 — 페르소나마다 한 행. unique(analysis_id, persona) 가 중복을 막는다.
  const rows = (reviewsOf.get(a.item_id) ?? []).map((r) => ({
    analysis_id: aid,
    persona: r.persona,
    verdict: r.verdict,
    findings: r.findings ?? [],
    checked: r.checked ?? [],
  }))
  if (rows.length) {
    const { error } = await db.from('csat_analysis_reviews').upsert(rows, { onConflict: 'analysis_id,persona' })
    if (error) throw new Error(`${a.item_id} 검수: ${error.message}`)
  }

  // published 승격 — 트리거가 3인 pass 를 다시 확인한다. 여기서 막히면 그게 맞는 것이다.
  const { error: pe } = await db
    .from('csat_item_analyses')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', aid)
  if (pe) { skipped.push(`${a.item_id}: published 거부 — ${pe.message}`); continue }
  republished += 1
  process.stdout.write(`\r  적재 ${republished}/${analyses.length}`)
}
process.stdout.write('\n')

// ── 유형 리포트 ───────────────────────────────────────────────────────
for (const [tid, tr] of typeReports) {
  const { error } = await db.from('csat_type_reports').upsert(
    {
      type_id: tid,
      n_analyzed: tr.n_analyzed ?? 0,
      recurring_traps: tr.recurring_traps ?? [],
      answer_locus_pattern: tr.answer_locus_pattern ?? null,
      procedure_steps: tr.procedure ?? [],
      failure_modes: tr.failure_modes ?? [],
      time_budget_sec: tr.time_budget_sec ?? null,
      open_questions: tr.open_questions ?? [],
      status: 'published',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'type_id' },
  )
  if (error) throw new Error(`유형 리포트 ${tid}: ${error.message}`)
}

console.log(`  새 분석 ${inserted} · published ${republished} · 유형 리포트 ${typeReports.size} · 건너뜀 ${skipped.length}`)
console.log('→ csat_item_analyses · csat_analysis_reviews · csat_type_reports')
