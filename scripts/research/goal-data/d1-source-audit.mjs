// scripts/research/goal-data/d1-source-audit.mjs
//
// D1 — 기출 · 원천 데이터 전수 감사(읽기 전용 · DB 에 쓰지 않는다). map-data-expansion coverage.json 의 시험군 집계를
// 문항 단위 결손 · 중복 · 출처 결속 · 사설 통계 결속 · 적격 공급 판정으로 확장한다.
//   node --tls-max-v1.2 --env-file=<메인 apps/web/.env.local> scripts/research/goal-data/d1-source-audit.mjs
// 출력(생성물 — 손으로 고치지 않는다): docs/research/goal-data-batches/D1-source-audit/*.json
// 원문은 커밋하지 않는다 — 지문 · 선지는 sha256 으로만 남긴다.
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const OUT = path.join(ROOT, 'docs/research/goal-data-batches/D1-source-audit')
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!String(URL_).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')

async function all(table, select) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${URL_}/rest/v1/${table}?select=${encodeURIComponent(select)}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } })
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)
    const rows = await res.json()
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
const head = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim()

const exams = await all('csat_exams', 'id,label,organizer,kind,grade,exam_year,month,form,paper_form,item_count,has_answer_key,source_note,official_grade1_ratio,official_stats_source,diagnosis_ready')
const items = await all('csat_items', 'id,exam_id,no,section,type_id,in_scope,stem,passage,choices,answer,answers,points,body_ok,official_error_rate,ebs_linked')
const analyses = await all('csat_item_analyses', 'item_id,version,status,source,answer_unknown')
const attrs = await all('csat_dx_item_attribute', 'item_id,attribute_code,source,reviewed_at')
const reviews = await all('csat_item_reviews', 'item_id,persona,verdict')
const states = await all('csat_item_state', 'item_id,status,reason_code')
const stats = await all('csat_item_response_stats', 'exam_id,no,source_id,correct_rate,verified,answer')
const rates = await all('csat_map_item_rate', 'exam_id,no,source_id,metric')
const units = await all('csat_item_units', 'item_id')

const latest = new Map()
for (const a of analyses) if (!latest.has(a.item_id) || latest.get(a.item_id).version < a.version) latest.set(a.item_id, a)
const answersOf = (i) => (i.answers?.length ? i.answers : i.answer != null ? [i.answer] : [])
const unitSet = new Set(units.map((u) => u.item_id))
const attrBy = attrs.reduce((m, a) => m.set(a.item_id, [...(m.get(a.item_id) ?? []), a]), new Map())
const reviewBy = reviews.reduce((m, r) => m.set(r.item_id, [...(m.get(r.item_id) ?? []), r]), new Map())
const stateBy = new Map(states.map((s) => [s.item_id, s]))
const statKey = (e, n) => `${e}#${n}`
const statBy = stats.reduce((m, s) => m.set(statKey(s.exam_id, s.no), [...(m.get(statKey(s.exam_id, s.no)) ?? []), s]), new Map())
const rateBy = rates.reduce((m, s) => m.set(statKey(s.exam_id, s.no), [...(m.get(statKey(s.exam_id, s.no)) ?? []), s]), new Map())
const itemsBy = items.reduce((m, i) => m.set(i.exam_id, [...(m.get(i.exam_id) ?? []), i]), new Map())

// ── 문항 단위 결손 ───────────────────────────────────────
function itemFlags(i) {
  const f = []
  if (!answersOf(i).length) f.push('answer_missing')
  if (answersOf(i).length > 1) f.push('answer_multiple')
  if (!i.body_ok) f.push('body_not_ok')
  if (norm(i.stem).length < 5) f.push('stem_missing')
  if (norm(i.passage).length < 50) f.push('passage_short_or_missing')
  if (!Array.isArray(i.choices) || i.choices.length !== 5) f.push(`choices_${Array.isArray(i.choices) ? i.choices.length : 'none'}`)
  if (i.points == null) f.push('points_missing')
  const a = latest.get(i.id)
  if (!a) f.push('analysis_none')
  else if (a.status !== 'published') f.push(`analysis_${a.status}`)
  if (a?.answer_unknown) f.push('analysis_answer_unknown')
  if (!unitSet.has(i.id)) f.push('units_none')
  return f
}
const itemRows = items.map((i) => {
  const a = latest.get(i.id)
  const at = attrBy.get(i.id) ?? []
  const st = statBy.get(statKey(i.exam_id, i.no)) ?? []
  const statAnswerMismatch = st.filter((s) => s.answer != null && answersOf(i).length && !answersOf(i).includes(s.answer)).map((s) => s.source_id)
  return {
    item_id: i.id, exam_id: i.exam_id, no: i.no, type_id: i.type_id,
    source_sha256: sha({ stem: i.stem, passage: i.passage, choices: i.choices, answer: i.answer, answers: i.answers, points: i.points }),
    passage_sha256: norm(i.passage).length ? sha(norm(i.passage)) : null,
    flags: itemFlags(i),
    analysis: a ? { version: a.version, status: a.status, source: a.source } : null,
    attribute_tags: { rows: at.length, human_reviewed: at.filter((x) => x.reviewed_at).length },
    ai_persona_reviews: (reviewBy.get(i.id) ?? []).length,
    pipeline_state: stateBy.get(i.id)?.status ?? null,
    private_stats: st.map((s) => ({ source_id: s.source_id, verified: s.verified })),
    private_stats_answer_mismatch: statAnswerMismatch,
    item_rate_sources: [...new Set((rateBy.get(statKey(i.exam_id, i.no)) ?? []).map((r) => r.source_id))],
    official_error_rate: i.official_error_rate != null,
  }
})

// ── 중복 ─────────────────────────────────────────────────
const byPassage = new Map()
for (const i of items) { const p = norm(i.passage); if (p.length < 200) continue; const h = sha(p); byPassage.set(h, [...(byPassage.get(h) ?? []), i]) }
const SET_NOS = [[41, 42], [43, 44, 45]]
const sameSet = (a, b) => a.exam_id === b.exam_id && SET_NOS.some((s) => s.includes(a.no) && s.includes(b.no))
const exactDup = [...byPassage.values()].filter((g) => g.length > 1 && !g.every((x) => sameSet(x, g[0])))
  .map((g) => ({ items: g.map((x) => x.id).sort(), cross_exam: new Set(g.map((x) => x.exam_id)).size > 1 }))
// 근사 중복: 앞 300자 정규화가 같은데 전문 sha 는 다름(오탈자 · 개정 · 편집 차이 후보)
const byPrefix = new Map()
for (const i of items) { const p = norm(i.passage); if (p.length < 300) continue; const h = sha(p.slice(0, 300)); byPrefix.set(h, [...(byPrefix.get(h) ?? []), i]) }
const nearDup = [...byPrefix.values()].filter((g) => g.length > 1 && new Set(g.map((x) => sha(norm(x.passage)))).size > 1 && !g.every((x) => sameSet(x, g[0])))
  .map((g) => ({ items: g.map((x) => x.id).sort(), distinct_full_sha: new Set(g.map((x) => sha(norm(x.passage)))).size }))
const examDup = (() => { // 시험 단위 전체가 같은 내용(같은 시험의 다른 id 후보)
  const m = new Map()
  for (const [ex, its] of itemsBy) { const h = sha(its.map((i) => norm(i.passage)).sort().join('|')); m.set(h, [...(m.get(h) ?? []), ex]) }
  return [...m.values()].filter((g) => g.length > 1)
})()

// ── 시험 단위 ────────────────────────────────────────────
const groupKey = (e) => `${e.organizer ?? '?'}/${e.kind ?? '?'}/g${e.grade ?? '?'}`
const examRows = exams.map((e) => {
  const its = itemsBy.get(e.id) ?? []
  const flagCount = {}
  for (const r of itemRows.filter((r) => r.exam_id === e.id)) for (const f of r.flags) flagCount[f] = (flagCount[f] ?? 0) + 1
  const st = stats.filter((s) => s.exam_id === e.id)
  return {
    exam_id: e.id, label: e.label, group: groupKey(e), exam_year: e.exam_year, month: e.month, form: e.form ?? e.paper_form ?? null,
    reading_items: its.length, item_nos: its.length ? `${Math.min(...its.map((i) => i.no))}–${Math.max(...its.map((i) => i.no))}` : null,
    has_answer_key_flag: !!e.has_answer_key, diagnosis_ready: !!e.diagnosis_ready,
    source_note: e.source_note ? 'present' : 'missing',
    official_stats: e.official_stats_source ? 'present' : 'missing',
    private_stats: { rows: st.length, sources: [...new Set(st.map((s) => s.source_id))], verified_rows: st.filter((s) => s.verified).length },
    content_sha256: its.length ? sha(its.map((i) => [i.no, sha(norm(i.passage)), i.answer, i.answers]).sort((a, b) => a[0] - b[0])) : null,
    flags: flagCount,
  }
})

// ── 학습 공급 적격성(문항 단위 판정 — 원천 분석 · 진단용 vs 학습자 재배포) ──
// 진단 · 분석 적격: 정답 1개 + body_ok + 선지 5 + 지문 있음. 학습자 재배포 적격: 위 + 권리 결정 기록(source_note) — 현재 기록 필드가 비어 있으면 미정.
const analyzable = itemRows.filter((r) => !r.flags.some((f) => ['answer_missing', 'body_not_ok', 'passage_short_or_missing'].includes(f) || f.startsWith('choices_')))
const rightsRecorded = new Set(exams.filter((e) => e.source_note).map((e) => e.id))

// ── 기대 시험 격자(누락 시험 후보) ─────────────────────────
const present = new Set(exams.map((e) => `${groupKey(e)}@${e.exam_year}-${e.month}`))
// 실재 시험의 연도 범위 안에서 같은 군의 월 패턴을 기대값으로 본다(공식 시행 일정이 아닌 내부 일관성 기대값)
const grid = []
const groupYears = {}
for (const e of exams) { const g = groupKey(e); (groupYears[g] ??= { years: new Set(), months: new Set() }); groupYears[g].years.add(e.exam_year); groupYears[g].months.add(e.month) }
for (const [g, v] of Object.entries(groupYears)) {
  const ys = [...v.years].filter((y) => y != null)
  for (let y = Math.min(...ys); y <= Math.max(...ys); y++) for (const m of v.months) if (!present.has(`${g}@${y}-${m}`)) grid.push({ group: g, exam_year: y, month: m })
}

const inputs = { head, tables: { csat_exams: exams.length, csat_items: items.length, csat_item_analyses: analyses.length, csat_dx_item_attribute: attrs.length, csat_item_reviews: reviews.length, csat_item_state: states.length, csat_item_response_stats: stats.length, csat_map_item_rate: rates.length, csat_item_units: units.length }, items_content_sha256: sha(itemRows.map((r) => [r.item_id, r.source_sha256])) }
const meta = (name) => ({ generated_by: 'scripts/research/goal-data/d1-source-audit.mjs', generated_at: new Date().toISOString(), artifact: name, inputs, note: '읽기 전용 실측. 분석 published 는 AI 분석의 공개 상태(사람 검수 · Gold 아님). 원문은 sha256 으로만.' })

const flagTotals = {}
for (const r of itemRows) for (const f of r.flags) flagTotals[f] = (flagTotals[f] ?? 0) + 1
const write = (f, o) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(o, null, 1) + '\n')
fs.mkdirSync(OUT, { recursive: true })
write('source-inventory.json', { ...meta('source-inventory'), exams: examRows, items: itemRows })
const groups = {}
for (const r of examRows) {
  const g = (groups[r.group] ??= { exams: 0, reading_items: 0, analyzable_items: 0, source_note_missing: 0, official_stats_missing: 0, private_stats_exams: 0, diagnosis_ready: 0, years: new Set() })
  g.exams++; g.reading_items += r.reading_items; g.years.add(r.exam_year)
  if (r.source_note === 'missing') g.source_note_missing++
  if (r.official_stats === 'missing') g.official_stats_missing++
  if (r.private_stats.rows) g.private_stats_exams++
  if (r.diagnosis_ready) g.diagnosis_ready++
}
for (const r of analyzable) groups[examRows.find((e) => e.exam_id === r.exam_id).group].analyzable_items++
for (const g of Object.values(groups)) g.years = [...g.years].sort().join(',')
write('exam-coverage.json', { ...meta('exam-coverage'), totals: { exams: exams.length, exams_with_items: itemsBy.size, reading_items: items.length, analyzable_items: analyzable.length, rights_recorded_exams: rightsRecorded.size, flag_totals: flagTotals }, groups, expected_but_absent: grid, supply_eligibility: { diagnosis_analysis_eligible_items: analyzable.length, learner_redistribution_eligible_items: analyzable.filter((r) => rightsRecorded.has(r.exam_id)).length, rule: '진단 · 분석 적격 = 정답 있음 · body_ok · 선지 5 · 지문 50자 이상. 학습자 재배포 적격 = 위 + 시험의 권리 기록(source_note). 권리 기록이 없으면 재배포 미정이다.' } })
write('missing-sources.json', { ...meta('missing-sources'),
  exams_without_items: exams.filter((e) => !itemsBy.has(e.id)).map((e) => e.id),
  items_by_flag: Object.fromEntries(Object.keys(flagTotals).sort().map((f) => [f, itemRows.filter((r) => r.flags.includes(f)).map((r) => r.item_id)])),
  private_stats_answer_mismatch: itemRows.filter((r) => r.private_stats_answer_mismatch.length).map((r) => ({ item_id: r.item_id, sources: r.private_stats_answer_mismatch })),
  duplicates: { exact_passage: exactDup, near_passage_prefix300: nearDup, whole_exam_same_content: examDup },
  expected_but_absent_exams: grid,
})
console.log(JSON.stringify({ inputs, flagTotals, analyzable: analyzable.length, rightsRecorded: rightsRecorded.size, exactDup: exactDup.length, nearDup: nearDup.length, examDup: examDup.length, absent: grid.length, statMismatch: itemRows.filter((r) => r.private_stats_answer_mismatch.length).length }, null, 1))
