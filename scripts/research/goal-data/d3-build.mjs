// scripts/research/goal-data/d3-build.mjs
//
// D3 — 출제 원리 · 정답/오답 설계를 D2 의 검증 통과 출력(A · B 두 독립 판정)에서 모은다. 새 판정을 만들지 않는다.
//   node scripts/research/goal-data/d3-build.mjs
// 입력(읽기 전용 · git 제외 원본): 1차 표본 = <map-data-expansion 워크트리>/scripts/csat/map/v62/data/local · 2차 = scripts/research/goal-data/local/b2-v2
// 원문 인용은 커밋하지 않는다 — 결정 지점은 sha256 만. 설계 가설은 「가설」이며 출제 의도 사실이 아니다.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { ROOT, nonHeldTasks } from '../../csat/map/v62/data/pilot-lib.mjs'

import { makeValidator } from './d2-validate.mjs'

const OUT = path.join(ROOT, 'docs/research/goal-data-batches/D3-principles')
const PILOT1 = process.env.PILOT1_LOCAL ?? path.resolve(ROOT, '../Vocaflow-map-data-expansion/scripts/csat/map/v62/data/local')
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex')
const all = nonHeldTasks()
const SOURCES = [
  { batch: 'pilot-1', dir: PILOT1, input: path.join(PILOT1, 'pilot-input.json'), tasks: all },
  ...['b2-v2', 'b3-insert', 'b4-v21', 'b5-v22', 'b6-v23', 'b7-v24', 'b8-v24', 'b9-v24', 'b11-v24', 'b12-v24', 'b13-v24', 'b14-v24', 'b15-v24', 'b16-v24', 'b17-v24', 'b18-v24'].map((b) => ({ batch: b, dir: path.join(ROOT, 'scripts/research/goal-data/local', b), input: path.join(ROOT, 'scripts/research/goal-data/local', b, 'input.json'), tasks: all.filter((t) => t.kind !== 'integrated') })),
].filter((s) => fs.existsSync(s.input))
// pilot-1 · b2-v2 의 삽입 문항은 주어진 문장 오독으로 무효 — b3-insert 재판정으로 대체한다(T-0088 정정)
const SUPERSEDED_BATCHES = new Set(['pilot-1', 'b2-v2'])
// 도표: 수치가 문항 필드에 없다(원천 결손) — 근거 미확인으로 분리한다
const SOURCE_GAP_TYPES = { 'R-CHART': 'chart_missing' }

/** D2 와 같은 계약 검사(d2-validate · T-0107 P1)를 통과한 행만 — 청크 반복 · 트랙 전체 선택 이유 반복에 걸리면 그 범위를 쓰지 않는다 */
function passed(src, track, V) {
  const out = new Map(), allRows = []
  for (const f of fs.readdirSync(src.dir).filter((f) => f.startsWith(`chunk-${track}-`) && f.endsWith('.out.json'))) {
    const rows = JSON.parse(fs.readFileSync(path.join(src.dir, f), 'utf8')).rows ?? []
    allRows.push(...rows)
    if (V.chunk(rows).length) continue
    for (const r of rows) if (V.byId.has(r.item_id) && !V.row(r).length) out.set(r.item_id, r)
  }
  if (V.reasons(allRows).length) out.clear()
  return out
}

const reasoning = [], distractors = []
const inputs = []
for (const src of SOURCES) {
  const input = JSON.parse(fs.readFileSync(src.input, 'utf8'))
  // 입력에 판정 TASK 가 기록돼 있으면 그 부분 집합으로 검증한다(b5 이후)
  if (input.tasks) src.tasks = all.filter((t) => input.tasks.includes(t.id))
  inputs.push({ batch: src.batch, items: input.rows.length, input_sha256: crypto.createHash('sha256').update(JSON.stringify(input.rows.map((r) => [r.item_id, r.source_sha256]))).digest('hex') })
  const byId = new Map(input.rows.map((r) => [r.item_id, r]))
  const V = makeValidator(input, src.tasks, { legacyV1: src.batch === 'pilot-1' })
  const A = passed(src, 'A', V), B = passed(src, 'B', V)
  for (const [id, inp] of byId) {
    const a = A.get(id), b = B.get(id)
    if (!a || !b) continue
    if (inp.type_id === 'R-INSERT' && SUPERSEDED_BATCHES.has(src.batch)) continue
    const gap = SOURCE_GAP_TYPES[inp.type_id] ?? (/도표|graph|chart/i.test(String(inp.source.stem)) ? 'chart_missing' : null)
    const answers = inp.source.answers?.length ? inp.source.answers : [inp.source.answer]
    reasoning.push({
      batch: src.batch, item_id: id, exam_id: inp.exam_id, type_id: inp.type_id, source_sha256: inp.source_sha256,
      status: 'AI_PROPOSED_TWO_TRACK', evidence: gap ? `source_gap:${gap}` : 'source_text',
      stem_demand: { A: a.stem_demand, B: b.stem_demand },
      passage_structure: { A: a.passage_structure, B: b.passage_structure },
      decision_path: { A: a.decision_path.summary, B: b.decision_path.summary, locus_sha256: { A: sha(a.decision_path.quote), B: sha(b.decision_path.quote) }, same_locus: sha(a.decision_path.quote) === sha(b.decision_path.quote) },
      answer: answers, answer_logic: { A: a.answer_logic.why, B: b.answer_logic.why },
      design_hypothesis: { A: a.design_hypothesis, B: b.design_hypothesis, note: '가설 — 원문에서 확인되지 않은 출제 의도를 사실로 쓰지 않는다' },
      primary_task: { A: a.primary_task, B: b.primary_task, agree: a.primary_task === b.primary_task },
      teaching_principles: { A: a.teaching_principles, B: b.teaching_principles },
      // A 트랙만 기존 v3 분석을 참고했다 — 기존 분석과의 차이는 A 의 판정이 원문 근거로 덮었는지로만 남는다(공식 해설은 DB 에 없다)
      prior_analysis: inp.analysis ? { version: inp.analysis.version, status: inp.analysis.status } : null,
    })
    for (const da of a.distractors ?? []) {
      const db = (b.distractors ?? []).find((d) => d.choice === da.choice)
      distractors.push({
        batch: src.batch, item_id: id, type_id: inp.type_id, choice: da.choice, evidence: gap ? `source_gap:${gap}` : 'source_text',
        distortion: { A: da.distortion_type, B: db?.distortion_type ?? null, agree: !!db && da.distortion_type === db.distortion_type },
        design: { A: da.design, B: db?.design ?? null }, why: { A: da.why, B: db?.why ?? null },
        prior_trap_keys: (inp.traps ?? []).filter((t) => t.option_no === da.choice).map((t) => t.trap_key),
      })
    }
  }
}

// ── 원리 묶음: 유형 × (두 판정이 일치한 왜곡 유형) — 근거 미확인 문항 제외 ──
const groups = {}
for (const d of distractors.filter((d) => d.evidence === 'source_text')) {
  const g = (groups[d.type_id ?? '?'] ??= { items: new Set(), options: 0, agreed: 0, distortions: {} })
  g.items.add(`${d.batch}:${d.item_id}`); g.options++
  if (d.distortion.agree) { g.agreed++; g.distortions[d.distortion.A] = (g.distortions[d.distortion.A] ?? 0) + 1 }
}
const principleGroups = Object.fromEntries(Object.entries(groups).sort().map(([type, g]) => [type, {
  items: g.items.size, wrong_options: g.options, distortion_agreement: Number((g.agreed / g.options).toFixed(3)),
  agreed_distortions: Object.fromEntries(Object.entries(g.distortions).sort((x, y) => y[1] - x[1])),
  primary_task_pairs: reasoning.filter((r) => r.type_id === type && r.evidence === 'source_text').reduce((m, r) => { const k = r.primary_task.agree ? r.primary_task.A : `${r.primary_task.A}|${r.primary_task.B}`; m[k] = (m[k] ?? 0) + 1; return m }, {}),
  small_sample: g.items.size < 5,
}]))
const totals = {
  items: reasoning.length, items_source_gap: reasoning.filter((r) => r.evidence !== 'source_text').length,
  primary_task_agree: reasoning.filter((r) => r.primary_task.agree).length,
  same_decision_locus: reasoning.filter((r) => r.decision_path.same_locus).length,
  wrong_options: distractors.length, distortion_agree: distractors.filter((d) => d.distortion.agree).length,
  distortion_agree_source_text: distractors.filter((d) => d.evidence === 'source_text' && d.distortion.agree).length,
  wrong_options_source_text: distractors.filter((d) => d.evidence === 'source_text').length,
}
fs.mkdirSync(OUT, { recursive: true })
const jl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
fs.writeFileSync(path.join(OUT, 'item-reasoning.jsonl'), jl(reasoning))
fs.writeFileSync(path.join(OUT, 'distractor-logic.jsonl'), jl(distractors))
fs.writeFileSync(path.join(OUT, 'principle-groups.json'), JSON.stringify({ generated_by: 'scripts/research/goal-data/d3-build.mjs', generated_at: new Date().toISOString(), inputs, totals, note: '두 AI 판정에서 모은 가설 · 분류다. 사람 검수 · Gold · 출제 의도 사실이 아니다. 5문항 미만 유형은 small_sample — 일반화 금지.', groups: principleGroups }, null, 1) + '\n')
console.log(JSON.stringify({ inputs, totals }, null, 1))
for (const [t, g] of Object.entries(principleGroups)) console.log(t.padEnd(12), g.items, g.distortion_agreement, JSON.stringify(g.agreed_distortions).slice(0, 110))
