// scripts/csat/map/v62/data/pilot-run.mjs
//
// 문항↔TASK 심층 매핑 표본 — 청크 · 검증 · 두 판정 일치 계산.
//   node scripts/csat/map/v62/data/pilot-run.mjs chunks     # local/pilot-input.json → local/chunk-{A,B}-NN.json (있으면 건너뜀)
//   node scripts/csat/map/v62/data/pilot-run.mjs validate   # local/chunk-*-NN.out.json 결함 목록(하나라도 있으면 exit 1)
//   node scripts/csat/map/v62/data/pilot-run.mjs agree      # A·B 통과 행만 비교 → docs/.../pilot-links.json · pilot-agreement.json
// A 트랙 = 원문 + 기존 v3 분석(검증 전 참고) · B 트랙 = 원문만(눈가림). 서로의 출력을 보지 않는다.
// 상태: 각 판정 AI_PROPOSED(research_ai_candidate · R0) → 두 판정 일치 INDEPENDENTLY_CHECKED(research_ai_reviewed · R1, candidateRelevance 에만)
//       불일치 DISPUTED(제3 판정 · 사람 검수 대기). relevance(검토값)는 사람 검수만 정한다 — 여기서는 전부 unknown.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { LOCAL, ROOT, nonHeldTasks, validateChunk, validateRow } from './pilot-lib.mjs'

const OUTDIR = path.join(ROOT, 'docs/csat-learner/v62/data-expansion')
const CHUNK = 10
const hideQuote = (a) => (a?.quote ? { field: a.field, quote_sha256: crypto.createHash('sha256').update(String(a.quote)).digest('hex'), quote_chars: String(a.quote).length } : null)
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')
const input = JSON.parse(fs.readFileSync(path.join(LOCAL, 'pilot-input.json'), 'utf8'))
const byId = new Map(input.rows.map((r) => [r.item_id, r]))
const tasks = nonHeldTasks()
const nChunks = Math.ceil(input.rows.length / CHUNK)
const name = (track, k, out) => path.join(LOCAL, `chunk-${track}-${String(k + 1).padStart(2, '0')}${out ? '.out' : ''}.json`)

function chunks() {
  for (let k = 0; k < nChunks; k++) {
    const rows = input.rows.slice(k * CHUNK, (k + 1) * CHUNK)
    for (const track of ['A', 'B']) {
      const f = name(track, k)
      if (fs.existsSync(f)) continue
      const items = rows.map((r) => ({ item_id: r.item_id, type_id: r.type_id, source: r.source, source_sha256: r.source_sha256, ...(track === 'A' ? { prior_analysis_unverified: r.analysis, prior_traps: r.traps.map((t) => ({ option_no: t.option_no, trap_key: t.trap_key })) } : {}) }))
      fs.writeFileSync(f, JSON.stringify({ track, contract: 'docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md', tasks, items }, null, 1))
    }
  }
  console.log(`청크 ${nChunks} × 트랙 2 → ${path.relative(ROOT, LOCAL)}`)
}

function load(track) {
  const out = new Map()
  const errors = []
  for (let k = 0; k < nChunks; k++) {
    const f = name(track, k, true)
    if (!fs.existsSync(f)) { errors.push(`${path.basename(f)} 없음`); continue }
    const rows = JSON.parse(fs.readFileSync(f, 'utf8')).rows ?? []
    const chunkErr = validateChunk(rows)
    if (chunkErr.length) { errors.push(...chunkErr.map((x) => `${track} ${path.basename(f)}: ${x}`)); continue }
    for (const row of rows) {
      const inp = byId.get(row.item_id)
      if (!inp) { errors.push(`${track} ${row.item_id} 표본 밖`); continue }
      const e = validateRow(row, inp, tasks)
      if (e.length) errors.push(...e.map((x) => `${track} ${row.item_id}: ${x}`))
      else out.set(row.item_id, row)
    }
  }
  for (const id of byId.keys()) if (!out.has(id) && !errors.some((e) => e.includes(id))) errors.push(`${track} ${id} 출력 없음`)
  return { out, errors }
}

function validate() {
  let bad = 0
  for (const t of ['A', 'B']) {
    const { out, errors } = load(t)
    console.log(`${t}: 통과 ${out.size}/${byId.size} · 결함 ${errors.length}`)
    for (const e of errors.slice(0, 60)) console.log('  ' + e)
    bad += errors.length
  }
  process.exit(bad ? 1 : 0)
}

/** Cohen κ(4범주) */
function kappa(pairs) {
  const cats = ['direct', 'indirect', 'not_applicable', 'unknown']
  const n = pairs.length
  if (!n) return null
  const po = pairs.filter(([a, b]) => a === b).length / n
  const pe = cats.reduce((s, c) => s + (pairs.filter(([a]) => a === c).length / n) * (pairs.filter(([, b]) => b === c).length / n), 0)
  return pe === 1 ? null : Number(((po - pe) / (1 - pe)).toFixed(4))
}

function agree() {
  const A = load('A'), B = load('B')
  const links = []
  const pairsAll = []
  const perTask = Object.fromEntries(tasks.map((t) => [t.id, { display: t.display, pairs: [], both_direct: 0, both_indirect: 0, both_na: 0, disputed: 0 }]))
  const items = []
  for (const [id, inp] of byId) {
    const a = A.out.get(id), b = B.out.get(id)
    if (!a || !b) { items.push({ item_id: id, status: 'HUMAN_REVIEW_REQUIRED', reason: !a && !b ? 'A·B 검증 실패' : !a ? 'A 검증 실패' : 'B 검증 실패' }); continue }
    const la = new Map(a.links.map((l) => [l.task_id, l])), lb = new Map(b.links.map((l) => [l.task_id, l]))
    for (const t of tasks) {
      const x = la.get(t.id), y = lb.get(t.id)
      pairsAll.push([x.relevance, y.relevance])
      perTask[t.id].pairs.push([x.relevance, y.relevance])
      const same = x.relevance === y.relevance
      if (same && x.relevance === 'direct') perTask[t.id].both_direct++
      if (same && x.relevance === 'indirect') perTask[t.id].both_indirect++
      if (same && x.relevance === 'not_applicable') perTask[t.id].both_na++
      if (!same) perTask[t.id].disputed++
      links.push({
        item: id, task: t.id, display: t.display,
        relevance: 'unknown',
        candidateRelevance: same && (x.relevance === 'direct' || x.relevance === 'indirect') ? x.relevance : null,
        state: same ? 'INDEPENDENTLY_CHECKED' : 'DISPUTED',
        source: same ? 'research_ai_reviewed' : 'research_ai_candidate',
        tier: same ? 'R1' : 'R0',
        judgments: { A: x.relevance, B: y.relevance },
        // 원문 인용은 커밋하지 않는다(권리) — 필드 · 인용 sha256 만. 원문은 local/chunk-*.out.json
        anchors: { A: hideQuote(x.anchor), B: hideQuote(y.anchor) },
        why: { A: x.why, B: y.why },
        source_sha256: inp.source_sha256,
      })
    }
    items.push({
      item_id: id, type_id: inp.type_id, status: 'INDEPENDENTLY_CHECKED_PARTIAL', source_sha256: inp.source_sha256, analysis_version: inp.analysis?.version ?? null,
      primary_task: { A: a.primary_task, B: b.primary_task, agree: a.primary_task === b.primary_task },
      secondary_tasks: { A: a.secondary_tasks, B: b.secondary_tasks },
      answer_agree: a.answer_logic.answer === b.answer_logic.answer,
      distortion: Object.fromEntries((a.distractors ?? []).map((d) => [d.choice, { A: d.distortion_type, B: (b.distractors ?? []).find((e) => e.choice === d.choice)?.distortion_type ?? null }])),
      directly_observable: { A: a.directly_observable, B: b.directly_observable },
      independent_assessment: { A: a.independent_assessment, B: b.independent_assessment },
    })
  }
  const summary = {
    version: 'map-data-pilot-1',
    input_sha256: sha(input.rows.map((r) => [r.item_id, r.source_sha256])),
    tasks: tasks.length, items: byId.size, pairs: pairsAll.length,
    agreement: pairsAll.length ? Number((pairsAll.filter(([a, b]) => a === b).length / pairsAll.length).toFixed(4)) : null,
    kappa: kappa(pairsAll),
    primary_task_agreement: items.filter((i) => i.primary_task?.agree).length,
    per_task: Object.fromEntries(Object.entries(perTask).map(([k, v]) => [k, { display: v.display, n: v.pairs.length, agreement: v.pairs.length ? Number((v.pairs.filter(([a, b]) => a === b).length / v.pairs.length).toFixed(4)) : null, kappa: kappa(v.pairs), both_direct: v.both_direct, both_indirect: v.both_indirect, both_not_applicable: v.both_na, disputed: v.disputed }])),
    human_review: 0, student_measurement: 0,
    note: '두 AI 판정의 일치는 사람 검수 · 학생 성취가 아니다. relevance 는 전부 unknown — 일치한 direct·indirect 만 candidateRelevance(R1).',
    items_detail: items,
  }
  fs.mkdirSync(OUTDIR, { recursive: true })
  fs.writeFileSync(path.join(OUTDIR, 'pilot-links.json'), JSON.stringify({ version: summary.version, input_sha256: summary.input_sha256, links }, null, 1) + '\n')
  fs.writeFileSync(path.join(OUTDIR, 'pilot-agreement.json'), JSON.stringify(summary, null, 1) + '\n')
  console.log(`쌍 ${summary.pairs} · 일치 ${summary.agreement} · κ ${summary.kappa} · 주 TASK 일치 ${summary.primary_task_agreement}/${byId.size}`)
  for (const [k, v] of Object.entries(summary.per_task)) console.log(`  ${v.display.padEnd(5)} ${k.padEnd(28)} 일치 ${v.agreement} κ ${v.kappa} 직접 ${v.both_direct} 간접 ${v.both_indirect} 무관 ${v.both_not_applicable} 갈림 ${v.disputed}`)
}

const cmd = process.argv[2]
if (cmd === 'chunks') chunks()
else if (cmd === 'validate') validate()
else if (cmd === 'agree') agree()
else { console.error('chunks | validate | agree'); process.exit(2) }
