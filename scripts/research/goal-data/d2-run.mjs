// scripts/research/goal-data/d2-run.mjs
//
// D2 문항↔TASK 매핑 배치 — 청크 · 검증 · A/B 일치(계약 v2: 18 원자 TASK · indirect 반사실 필수).
//   node scripts/research/goal-data/d2-run.mjs <batch> chunks|validate|agree
// 검증은 1차 표본 검증기(validateRow · validateChunk)를 그대로 쓰고 v2 반사실 검사만 더한다. 재실행 안전(있는 청크는 건너뜀).
// agree 출력(생성물): docs/research/goal-data-batches/D2-task-mapping/<batch>-{item-task-links,disputed-links}.jsonl · <batch>-agreement.json
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { ROOT, nonHeldTasks, validateChunk, validateRow } from '../../csat/map/v62/data/pilot-lib.mjs'

const [batch, cmd] = process.argv.slice(2)
const LOCAL = path.join(ROOT, 'scripts/research/goal-data/local', String(batch))
const OUTDIR = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping')
// b4 이후는 20문항 청크(분석자 수를 동시 실행 한도 안에 둔다)
const CHUNK = /^b[4-9]/.test(String(batch)) ? 20 : 10
// b2-v2 는 v2 로 판정했다 — 그 뒤 배치만 v2.1 을 더한다
const CONTRACTS = ['docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md', 'docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2.md', ...(batch === 'b2-v2' ? [] : ['docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_1.md'])]
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')
const hideQuote = (a) => (a?.quote ? { field: a.field, quote_sha256: sha(String(a.quote)), quote_chars: String(a.quote).length } : null)
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
const input = JSON.parse(fs.readFileSync(path.join(LOCAL, 'input.json'), 'utf8'))
const byId = new Map(input.rows.map((r) => [r.item_id, r]))
// v2: 통합 관찰(kind=integrated)은 문항 단위 판정에서 뺀다
const tasks = nonHeldTasks().filter((t) => t.kind !== 'integrated')
const nChunks = Math.ceil(input.rows.length / CHUNK)
const name = (track, k, out) => path.join(LOCAL, `chunk-${track}-${String(k + 1).padStart(2, '0')}${out ? '.out' : ''}.json`)
const answerSet = (src) => (src.answers?.length ? src.answers : src.answer != null ? [src.answer] : [])
const fieldText = (src, f) => (f === 'choices' ? (src.choices ?? []).map((c) => (typeof c === 'string' ? c : JSON.stringify(c))).join(' ') : String(src[f] ?? ''))

/** v2 추가 검사 — indirect 는 반사실(특정 오답 또는 결정 지점 원문)을 지목해야 한다 */
function validateV2(row, inp) {
  const errs = []
  const wrong = Array.from({ length: (inp.source.choices ?? []).length }, (_, k) => k + 1).filter((n) => !answerSet(inp.source).includes(n))
  for (const l of row.links ?? []) {
    if (l.relevance !== 'indirect') continue
    const c = l.counterfactual
    if (!c || norm(c.how).length < 15) errs.push(`${l.task_id} indirect 인데 반사실(counterfactual.how) 없음`)
    else if (c.kind === 'choice') { if (!wrong.includes(c.choice)) errs.push(`${l.task_id} 반사실 선지 ${c.choice} 가 오답 번호가 아니다`) }
    else if (c.kind === 'locus') { const f = c.field ?? 'passage'; if (norm(c.quote).length < 3 || !norm(fieldText(inp.source, f)).includes(norm(c.quote))) errs.push(`${l.task_id} 반사실 위치 인용이 원문에 없다`) }
    else errs.push(`${l.task_id} counterfactual.kind 는 choice|locus`)
  }
  return errs
}

function chunks() {
  fs.mkdirSync(LOCAL, { recursive: true })
  for (let k = 0; k < nChunks; k++) {
    const rows = input.rows.slice(k * CHUNK, (k + 1) * CHUNK)
    for (const track of ['A', 'B']) {
      const f = name(track, k)
      if (fs.existsSync(f)) continue
      const items = rows.map((r) => ({ item_id: r.item_id, type_id: r.type_id, source: r.source, source_sha256: r.source_sha256, ...(r.insert_split ? { insert_split: r.insert_split } : {}), ...(track === 'A' ? { prior_analysis_unverified: r.analysis, prior_traps: r.traps.map((t) => ({ option_no: t.option_no, trap_key: t.trap_key })) } : {}) }))
      fs.writeFileSync(f, JSON.stringify({ batch, track, contracts: CONTRACTS, tasks, items }, null, 1))
    }
  }
  console.log(`${batch}: 청크 ${nChunks} × 트랙 2 · TASK ${tasks.length} → ${path.relative(ROOT, LOCAL)}`)
}

function load(track) {
  const out = new Map(), errors = []
  for (let k = 0; k < nChunks; k++) {
    const f = name(track, k, true)
    if (!fs.existsSync(f)) { errors.push(`${path.basename(f)} 없음`); continue }
    const rows = JSON.parse(fs.readFileSync(f, 'utf8')).rows ?? []
    const ce = validateChunk(rows)
    if (ce.length) { errors.push(...ce.map((x) => `${track} ${path.basename(f)}: ${x}`)); continue }
    for (const row of rows) {
      const inp = byId.get(row.item_id)
      if (!inp) { errors.push(`${track} ${row.item_id} 배치 밖`); continue }
      const e = [...validateRow(row, inp, tasks), ...validateV2(row, inp)]
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
    for (const e of errors.slice(0, 80)) console.log('  ' + e)
    bad += errors.length
  }
  process.exit(bad ? 1 : 0)
}

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
  const linked = [], disputed = [], all = []
  const per = Object.fromEntries(tasks.map((t) => [t.id, { display: t.display, pairs: [], both_direct: 0, both_indirect: 0, both_na: 0, disputed: 0 }]))
  const items = []
  for (const [id, inp] of byId) {
    const a = A.out.get(id), b = B.out.get(id)
    if (!a || !b) { items.push({ item_id: id, status: 'HUMAN_REVIEW_REQUIRED', reason: !a && !b ? 'A·B 검증 실패' : !a ? 'A 검증 실패' : 'B 검증 실패' }); continue }
    const la = new Map(a.links.map((l) => [l.task_id, l])), lb = new Map(b.links.map((l) => [l.task_id, l]))
    for (const t of tasks) {
      const x = la.get(t.id), y = lb.get(t.id), same = x.relevance === y.relevance
      all.push([x.relevance, y.relevance]); per[t.id].pairs.push([x.relevance, y.relevance])
      if (same) per[t.id][{ direct: 'both_direct', indirect: 'both_indirect', not_applicable: 'both_na' }[x.relevance] ?? 'disputed'] += x.relevance === 'unknown' ? 0 : 1
      else per[t.id].disputed++
      const rec = {
        batch, item: id, exam_id: inp.exam_id, type_id: inp.type_id, task: t.id, display: t.display,
        relevance: 'unknown',
        candidateRelevance: same && (x.relevance === 'direct' || x.relevance === 'indirect') ? x.relevance : null,
        state: same ? 'INDEPENDENTLY_CHECKED' : 'DISPUTED', tier: same ? 'R1' : 'R0',
        judgments: { A: x.relevance, B: y.relevance },
        anchors: { A: hideQuote(x.anchor), B: hideQuote(y.anchor) },
        counterfactual: { A: x.counterfactual ? { kind: x.counterfactual.kind, choice: x.counterfactual.choice ?? null, how: x.counterfactual.how } : null, B: y.counterfactual ? { kind: y.counterfactual.kind, choice: y.counterfactual.choice ?? null, how: y.counterfactual.how } : null },
        why: { A: x.why, B: y.why },
        directly_observable: { A: (a.directly_observable ?? []).includes(t.id), B: (b.directly_observable ?? []).includes(t.id) },
        source_sha256: inp.source_sha256,
      }
      if (same && rec.candidateRelevance) linked.push(rec)
      if (!same) disputed.push(rec)
    }
    items.push({
      item_id: id, exam_id: inp.exam_id, type_id: inp.type_id, source_sha256: inp.source_sha256, analysis_version: inp.analysis?.version ?? null,
      primary_task: { A: a.primary_task, B: b.primary_task, agree: a.primary_task === b.primary_task },
      directly_observable_both: (a.directly_observable ?? []).filter((t) => (b.directly_observable ?? []).includes(t)),
      independent_assessment: { A: a.independent_assessment?.eligibility, B: b.independent_assessment?.eligibility },
      // 독립 평가 부적격(둘 중 하나라도 not_suitable) → 교수 사례 · 간접 관찰 후보
      use: a.independent_assessment?.eligibility === 'candidate_if_unexposed' && b.independent_assessment?.eligibility === 'candidate_if_unexposed' ? 'independent_check_candidate' : 'teaching_case_or_indirect',
    })
  }
  const summary = {
    batch, contracts: CONTRACTS.map((c) => ({ path: c, sha256: sha(fs.readFileSync(path.join(ROOT, c), 'utf8').replace(/\r\n/g, '\n')) })),
    input_sha256: sha(input.rows.map((r) => [r.item_id, r.source_sha256])), rule: input.rule,
    tasks: tasks.length, items: byId.size, pairs: all.length,
    agreement: all.length ? Number((all.filter(([p, q]) => p === q).length / all.length).toFixed(4)) : null,
    kappa: kappa(all), primary_task_agreement: items.filter((i) => i.primary_task?.agree).length,
    per_task: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, { display: v.display, n: v.pairs.length, agreement: v.pairs.length ? Number((v.pairs.filter(([p, q]) => p === q).length / v.pairs.length).toFixed(4)) : null, kappa: kappa(v.pairs), both_direct: v.both_direct, both_indirect: v.both_indirect, both_not_applicable: v.both_na, disputed: v.disputed }])),
    human_review: 0, student_measurement: 0,
    note: '두 AI 판정의 일치는 사람 검수 · 학생 성취가 아니다. relevance 는 전부 unknown — 일치한 direct·indirect 만 candidateRelevance(R1).',
    items_detail: items,
  }
  fs.mkdirSync(OUTDIR, { recursive: true })
  const jl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
  fs.writeFileSync(path.join(OUTDIR, `${batch}-item-task-links.jsonl`), jl(linked))
  fs.writeFileSync(path.join(OUTDIR, `${batch}-disputed-links.jsonl`), jl(disputed))
  fs.writeFileSync(path.join(OUTDIR, `${batch}-agreement.json`), JSON.stringify(summary, null, 1) + '\n')
  console.log(`쌍 ${summary.pairs} · 일치 ${summary.agreement} · κ ${summary.kappa} · 주 TASK 일치 ${summary.primary_task_agreement}/${byId.size} · R1 ${linked.length} · 갈림 ${disputed.length}`)
  for (const v of Object.values(summary.per_task)) console.log(`  ${v.display.padEnd(5)} 일치 ${v.agreement} κ ${v.kappa} 직접 ${v.both_direct} 간접 ${v.both_indirect} 무관 ${v.both_not_applicable} 갈림 ${v.disputed}`)
}

if (cmd === 'chunks') chunks()
else if (cmd === 'validate') validate()
else if (cmd === 'agree') agree()
else { console.error('<batch> chunks | validate | agree'); process.exit(2) }
