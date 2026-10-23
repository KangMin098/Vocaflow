// scripts/csat/map/v62/data/batch-run.mjs
//
// 문항↔TASK 링크 배치(TASK 일부만 판정) — 청크 · 검증 · A/B 일치.
//   node scripts/csat/map/v62/data/batch-run.mjs chunks   <batch>
//   node scripts/csat/map/v62/data/batch-run.mjs validate <batch> [chunk-prefix]
//   node scripts/csat/map/v62/data/batch-run.mjs agree    <batch>
// batch:
//   rules-v2 — 표본 40문항을 RULES_V2 대상 9 TASK 로 A/B 재판정(둘 다 원문만). v1 κ 와 비교해 규칙 효과를 잰다.
//   r5r6     — 표본 밖 평가원 · 수능 전 문항의 R5 · R6(v1 계약, v1 에서 κ ≥ .85).
// 청크 · 출력은 local/<batch>/(git 제외). 결과 상태는 pilot-run 과 같다: 일치 → R1 후보 · 갈림 → DISPUTED · relevance 는 unknown.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { LOCAL, ROOT, nonHeldTasks, validateLinkChunk, validateLinkRow } from './pilot-lib.mjs'

const BATCHES = {
  'rules-v2': { input: 'pilot-input.json', tasks: ['e.evidence_location', 'r.relation', 'v.core_meaning', 'v.semantic_relation', 'r.discourse_structure', 'e.task_demand', 'r.o.global_meaning_model', 's.o.sentence_meaning_model', 'e.o.final_judgment'], chunk: 20, contracts: ['docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md', 'docs/csat-learner/v62/data-expansion/RULES_V2.md'] },
  'rules-v21': { input: 'pilot-input.json', tasks: ['e.evidence_location', 'r.relation', 'v.core_meaning', 'v.semantic_relation', 'r.discourse_structure', 'e.task_demand', 'r.o.global_meaning_model', 's.o.sentence_meaning_model', 'e.o.final_judgment'], chunk: 20, contracts: ['docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md', 'docs/csat-learner/v62/data-expansion/RULES_V2.md'] },
  // 발문 수정(source-fixes.json) 문항의 수정 후 재판정 — r5r6 는 이 문항들을 계속 제외한다
  'r5r6-fix': { input: 'fix-input.json', tasks: ['r.central_meaning', 'r.inference'], chunk: 10, contracts: ['docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md'] },
  'r5r6-fix2': { input: 'fix2-input.json', tasks: ['r.central_meaning', 'r.inference'], chunk: 11, contracts: ['docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md'] },
  r5r6: { input: 'expand-input.json', tasks: ['r.central_meaning', 'r.inference'], chunk: 48, contracts: ['docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md'] },
}
const [cmd, batch, only] = process.argv.slice(2)
const cfg = BATCHES[batch]
if (!cfg) { console.error(`batch: ${Object.keys(BATCHES).join(' | ')}`); process.exit(2) }
const DIR = path.join(LOCAL, batch)
const OUTDIR = path.join(ROOT, 'docs/csat-learner/v62/data-expansion')
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')
const input = JSON.parse(fs.readFileSync(path.join(LOCAL, cfg.input), 'utf8'))
const byId = new Map(input.rows.map((r) => [r.item_id, r]))
// task_distinction 에서 인접 TASK 를 짐작하지 않게 비보류 21 정의 전체를 참고로 준다(T-0089 P1-01: R4 를 「세부 확인」으로 오정의)
const allDefs = nonHeldTasks()
const defs = allDefs.filter((t) => cfg.tasks.includes(t.id))
if (defs.length !== cfg.tasks.length) throw new Error('정의에 없는 TASK 가 batch 에 있다')
const nChunks = Math.ceil(input.rows.length / cfg.chunk)
const name = (track, k, out) => path.join(DIR, `chunk-${track}-${String(k + 1).padStart(2, '0')}${out ? '.out' : ''}.json`)
// 원천 결함 문항(coverage-audit integrity) — 판정이 일치해도 R1 후보로 올리지 않는다
const coverage = JSON.parse(fs.readFileSync(path.join(OUTDIR, 'coverage.json'), 'utf8'))
// 현재 결함(가드) + 수정 전 오염 발문으로 판정한 문항(source-fixes.json — 수정 후 r5r6-fix 로 재판정). r5r6-fix 자신은 수정 후 입력이라 제외하지 않는다
const fixes = JSON.parse(fs.readFileSync(path.join(OUTDIR, 'source-fixes.json'), 'utf8')).fixes.map((x) => x.item)
const defective = new Set([...(coverage.integrity?.duplicate_long_stems ?? []).flat(), ...(coverage.integrity?.stem_format ?? []).map((x) => x.item), ...(batch.startsWith('r5r6-fix') ? [] : fixes)])
// 독립 검증(T-0089) 표본 판정 — 관련성 unclear 인 R1 후보는 내리고, 계약 위반은 표시만 한다(관련성 값은 confirmed)
const reviewFile = path.join(OUTDIR, 'review/verdict.json')
const review = new Map(fs.existsSync(reviewFile) ? (JSON.parse(fs.readFileSync(reviewFile, 'utf8')).sampling?.rows ?? []).map((r) => [`${r.item_id}|${r.task_id}`, r]) : [])
const hideQuote = (a) => (a?.quote ? { field: a.field, quote_sha256: sha(String(a.quote)), quote_chars: String(a.quote).length } : null)

function chunks() {
  fs.mkdirSync(DIR, { recursive: true })
  for (let k = 0; k < nChunks; k++) {
    const items = input.rows.slice(k * cfg.chunk, (k + 1) * cfg.chunk).map((r) => ({ item_id: r.item_id, type_id: r.type_id, source: r.source, source_sha256: r.source_sha256 }))
    for (const track of ['A', 'B']) {
      const f = name(track, k)
      if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({ batch, track, contracts: cfg.contracts, tasks: defs, reference_tasks: allDefs, items }, null, 1))
    }
  }
  console.log(`${batch}: 문항 ${input.rows.length} · 청크 ${nChunks} × 트랙 2 → ${path.relative(ROOT, DIR)}`)
}

function load(track) {
  const out = new Map()
  const errors = []
  for (let k = 0; k < nChunks; k++) {
    const f = name(track, k, true)
    const base = path.basename(f)
    if (only && !base.startsWith(only)) continue
    if (!fs.existsSync(f)) { errors.push(`${base} 없음`); continue }
    let rows
    try { rows = JSON.parse(fs.readFileSync(f, 'utf8')).rows ?? [] } catch (e) { errors.push(`${base}: JSON 파싱 실패(작성 중이거나 깨짐) — ${e.message.slice(0, 60)}`); continue }
    const ce = validateLinkChunk(rows)
    if (ce.length) { errors.push(...ce.map((x) => `${base}: ${x}`)); continue }
    const want = input.rows.slice(k * cfg.chunk, (k + 1) * cfg.chunk).map((r) => r.item_id)
    for (const id of want) if (!rows.some((r) => r.item_id === id)) errors.push(`${base}: ${id} 출력 없음`)
    for (const row of rows) {
      const inp = byId.get(row.item_id)
      if (!inp || !want.includes(row.item_id)) { errors.push(`${base}: ${row.item_id} 청크 밖`); continue }
      const e = validateLinkRow(row, inp, cfg.tasks)
      if (e.length) errors.push(...e.map((x) => `${base} ${row.item_id}: ${x}`))
      else out.set(row.item_id, row)
    }
  }
  return { out, errors }
}

function kappa(pairs) {
  const cats = ['direct', 'indirect', 'not_applicable', 'unknown']
  const n = pairs.length
  if (!n) return null
  const po = pairs.filter(([a, b]) => a === b).length / n
  const pe = cats.reduce((s, c) => s + (pairs.filter(([a]) => a === c).length / n) * (pairs.filter(([, b]) => b === c).length / n), 0)
  return pe === 1 ? null : Number(((po - pe) / (1 - pe)).toFixed(4))
}

/** direct 여부만(direct vs 나머지) — 목표 관련도에서 가장 무거운 판정의 안정성 */
function binaryKappa(pairs) {
  const b = pairs.map(([a, c]) => [a === 'direct' ? 'direct' : 'unknown', c === 'direct' ? 'direct' : 'unknown'])
  return kappa(b)
}

if (cmd === 'chunks') chunks()
else if (cmd === 'validate') {
  let bad = 0
  for (const t of ['A', 'B']) { const { out, errors } = load(t); console.log(`${t}: 통과 ${out.size} · 결함 ${errors.length}`); for (const e of errors.slice(0, 40)) console.log('  ' + e); bad += errors.length }
  process.exit(bad ? 1 : 0)
} else if (cmd === 'agree') {
  const A = load('A'), B = load('B')
  const links = [], per = Object.fromEntries(cfg.tasks.map((t) => [t, []]))
  let missing = 0
  for (const [id, inp] of byId) {
    const a = A.out.get(id), b = B.out.get(id)
    if (!a || !b) { missing++; continue }
    for (const t of cfg.tasks) {
      const x = a.links.find((l) => l.task_id === t), y = b.links.find((l) => l.task_id === t)
      if (!defective.has(id)) per[t].push([x.relevance, y.relevance])
      const same = x.relevance === y.relevance
      const bad = defective.has(id)
      const rv = review.get(`${id}|${t}`)
      const unclear = same && rv?.relevance_verdict === 'unclear'
      const ok = !bad && same && !unclear
      links.push({ item: id, task: t, relevance: 'unknown', candidateRelevance: ok && (x.relevance === 'direct' || x.relevance === 'indirect') ? x.relevance : null, state: bad ? 'SOURCE_DEFECT' : unclear ? 'REVIEW_UNCLEAR' : same ? 'INDEPENDENTLY_CHECKED' : 'DISPUTED', source: ok ? 'research_ai_reviewed' : 'research_ai_candidate', tier: ok ? 'R1' : 'R0', ...(rv ? { review_T0089: { relevance: rv.relevance_verdict, contract: rv.contract_verdict, flags: (rv.flags ?? []).map((g) => g.kind) } } : {}), judgments: { A: x.relevance, B: y.relevance }, anchors: { A: hideQuote(x.anchor), B: hideQuote(y.anchor) }, why: { A: x.why, B: y.why }, source_sha256: inp.source_sha256 })
    }
  }
  const all = Object.values(per).flat()
  const dist = (ps) => ps.reduce((m, [a, b]) => { if (a === b) m[a] = (m[a] ?? 0) + 1; else m.disputed = (m.disputed ?? 0) + 1; return m }, {})
  const summary = {
    batch, input_sha256: sha(input.rows.map((r) => [r.item_id, r.source_sha256])), items: byId.size, items_missing: missing, pairs: all.length,
    agreement: all.length ? Number((all.filter(([a, b]) => a === b).length / all.length).toFixed(4)) : null, kappa: kappa(all),
    source_defect_items: [...defective].filter((id) => byId.has(id)),
    per_task: Object.fromEntries(Object.entries(per).map(([t, ps]) => [t, { n: ps.length, direct_binary_kappa: binaryKappa(ps), agreement: ps.length ? Number((ps.filter(([a, b]) => a === b).length / ps.length).toFixed(4)) : null, kappa: kappa(ps), ...dist(ps) }])),
    review_T0089: { sampled: [...review.keys()].filter((k) => byId.has(k.split('|')[0])).length, note: 'R1 direct 표본 30 중 관련성 confirmed 29 · unclear 1(후보 내림). 계약 위반(인접 TASK 오정의 · 유형 지름길)은 관련성 값이 아니라 설명 문장의 결함 — 이 배치의 task_distinction 은 근거로 쓰지 않는다(청크에 인접 정의가 없었다).' },
    task_distinction_reliable: batch !== 'r5r6',
    human_review: 0, student_measurement: 0,
    note: '두 AI 판정의 일치는 사람 검수 · 학생 성취가 아니다. relevance 는 전부 unknown — 일치한 direct·indirect 만 candidateRelevance(R1).',
  }
  fs.writeFileSync(path.join(OUTDIR, `${batch}-links.json`), JSON.stringify({ batch, input_sha256: summary.input_sha256, links }, null, 1) + '\n')
  fs.writeFileSync(path.join(OUTDIR, `${batch}-agreement.json`), JSON.stringify(summary, null, 1) + '\n')
  console.log(`${batch}: 쌍 ${summary.pairs} · 일치 ${summary.agreement} · κ ${summary.kappa} · 누락 문항 ${missing}`)
  for (const [t, v] of Object.entries(summary.per_task)) console.log(`  ${t.padEnd(28)} 일치 ${v.agreement} κ ${v.kappa} ${JSON.stringify(v)}`)
} else { console.error('chunks | validate | agree'); process.exit(2) }
