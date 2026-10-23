// scripts/research/goal-data/prereg-compare.mjs
//
// v2.5 사전 등록(V2_5_PREREGISTRATION rev4) 비교 계산 — 지표 · 분모 · 판정 규칙을 이 파일에 고정한다(동결 대상).
//   node scripts/research/goal-data/prereg-compare.mjs
// 쌍: (A,B) = <b>-v24 의 A/B(v2.4 기준선) · (C,D) = <b>t-v25 의 A/B(v2.5) · (E,F) = <b>t-v24 의 A/B(v2.4 대조). <b> = b9(필수) · b10(확장 — 있을 때만).
// 행 유효성은 d2-run 과 같은 공용 로더(d2-validate.loadTrack: 청크 반복 → 청크 배제 · 행 결함 → 행 배제 · 트랙 이유 반복 → 트랙 배제)로 판정한다(T-0115 RECHECK-P1-01).
// 순서 규칙: 여섯 판정이 모두 있을 때만 계산. b9 유효 대상 < 12 이면 지표를 계산하지 않고 b10 확장 신호만 낸다. b10 은 그 신호 뒤에만 존재할 수 있다.
// 출력(생성물): docs/research/goal-data-batches/D2-task-mapping/v2_5-comparison.json
import fs from 'node:fs'
import path from 'node:path'

import { ROOT, nonHeldTasks } from '../../csat/map/v62/data/pilot-lib.mjs'

import { chunkSize, loadTrack, makeValidator } from './d2-validate.mjs'

const LOCAL = path.join(ROOT, 'scripts/research/goal-data/local')
const OUT = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping/v2_5-comparison.json')
const MIN_TARGETS = 12
const TOL = 0.05
const INDEPENDENT_SAMPLE = 10
// 「대상 외 영향」 을 보는 TASK — v2.5 가 주 TASK 선택 기준으로 다루는 E2 · E3 를 뺀 나머지
const NON_TARGET_TASKS = ['r.central_meaning', 'r.inference', 'e.task_demand', 'r.discourse_structure']
const CATS = ['direct', 'indirect', 'not_applicable', 'unknown']
const all = nonHeldTasks()

/** 한 배치의 A/B 트랙을 공용 로더로 읽는다 — 출력 파일이 하나도 없으면 null */
function loadPair(batch) {
  const dir = path.join(LOCAL, batch)
  const input = JSON.parse(fs.readFileSync(path.join(dir, 'input.json'), 'utf8'))
  const tasks = all.filter((t) => input.tasks.includes(t.id))
  const V = makeValidator(input, tasks)
  const ids = input.rows.map((r) => r.item_id)
  const nChunks = Math.ceil(input.rows.length / chunkSize(batch))
  const has = (track) => fs.readdirSync(dir).some((f) => f.startsWith(`chunk-${track}-`) && f.endsWith('.out.json'))
  return { input, tasks, x: has('A') ? loadTrack(dir, 'A', nChunks, V, ids).out : null, y: has('B') ? loadTrack(dir, 'B', nChunks, V, ids).out : null }
}
const exists = (batch) => fs.existsSync(path.join(LOCAL, batch, 'input.json'))

/** Cohen κ(4범주) — 분모 0 이거나 기대 일치 1 이면 null */
function kappa(pairs) {
  const n = pairs.length
  if (!n) return null
  const po = pairs.filter(([a, b]) => a === b).length / n
  const pe = CATS.reduce((s, c) => s + (pairs.filter(([a]) => a === c).length / n) * (pairs.filter(([, b]) => b === c).length / n), 0)
  return pe === 1 ? null : (po - pe) / (1 - pe)
}
const rel = (row, task) => row.links.find((l) => l.task_id === task)?.relevance ?? 'unknown'
function metrics(x, y, ids, tasks) {
  const primaryEq = ids.filter((id) => (x.get(id).primary_task ?? null) === (y.get(id).primary_task ?? null))
  const linkPairs = ids.flatMap((id) => tasks.map((t) => [rel(x.get(id), t), rel(y.get(id), t)]))
  const ntPairs = ids.flatMap((id) => NON_TARGET_TASKS.map((t) => [rel(x.get(id), t), rel(y.get(id), t)]))
  return {
    n_items: ids.length,
    primary_agreement: primaryEq.length / ids.length,
    primary_discordant: ids.filter((id) => !primaryEq.includes(id)).map((id) => ({ item: id, x: x.get(id).primary_task ?? null, y: y.get(id).primary_task ?? null })),
    link_pairs: linkPairs.length,
    link_agreement: linkPairs.filter(([a, b]) => a === b).length / linkPairs.length,
    link_kappa: kappa(linkPairs),
    non_target_agreement: ntPairs.filter(([a, b]) => a === b).length / ntPairs.length,
  }
}
/** 한 표본 묶음(b9 또는 b10)의 세 쌍과 유효 대상 */
function trio(b) {
  const AB = loadPair(`${b}-v24`), CD = loadPair(`${b}t-v25`), EF = loadPair(`${b}t-v24`)
  const missing = [['A', AB.x], ['B', AB.y], ['C', CD.x], ['D', CD.y], ['E', EF.x], ['F', EF.y]].filter(([, m]) => m === null).map(([t]) => `${b}:${t}`)
  const targetIds = CD.input.rows.map((r) => r.item_id)
  const valid = missing.length ? [] : targetIds.filter((id) => [AB.x, AB.y, CD.x, CD.y, EF.x, EF.y].every((m) => m.has(id)))
  return { b, AB, CD, EF, missing, targetIds, valid }
}

const b9 = trio('b9')
if (b9.missing.length) { console.error(`판정 출력 없음: ${b9.missing.join(',')} — 여섯 판정이 모두 있어야 계산한다`); process.exit(2) }
const result = { generated_by: 'scripts/research/goal-data/prereg-compare.mjs', registration: 'V2_5_PREREGISTRATION rev4', b9: { targets: b9.targetIds.length, valid: b9.valid.length, invalid: b9.targetIds.filter((id) => !b9.valid.includes(id)) } }
const b10Present = exists('b10-v24')
if (b9.valid.length >= MIN_TARGETS && b10Present) { console.error('b9 유효 대상이 12 이상인데 b10 이 있다 — 사전 등록 위반(b10 은 확장 신호 뒤에만 만든다)'); process.exit(3) }

let groups = [b9]
if (b9.valid.length < MIN_TARGETS) {
  if (!b10Present) {
    result.decision = 'insufficient_extend_b10'
    result.note = `b9 유효 대상 ${b9.valid.length} < ${MIN_TARGETS} — 지표를 계산하지 않는다. 사전 지정 b10(M2309 대상 유형)을 같은 절차로 판정해 합친 뒤 다시 실행한다.`
  } else {
    const b10 = trio('b10')
    if (b10.missing.length) { console.error(`b10 판정 출력 없음: ${b10.missing.join(',')}`); process.exit(2) }
    result.b10 = { targets: b10.targetIds.length, valid: b10.valid.length, invalid: b10.targetIds.filter((id) => !b10.valid.includes(id)) }
    groups = [b9, b10]
    if (b9.valid.length + b10.valid.length < MIN_TARGETS) { result.decision = 'insufficient_after_b10'; result.note = 'b9 + b10 유효 대상이 12 미만 — 결론을 내지 않는다(사전 등록 §3 · 추가 확장 없음).' }
  }
}

if (!result.decision) {
  // 묶음 합집합 — b9 유효 대상 전부 뒤에 b10 유효 대상 전부(순서 고정 · 고르지 않음)
  const join = (key) => new Map(groups.flatMap((g) => [...g[key[0]][key[1]]]))
  const ids = groups.flatMap((g) => g.valid)
  const X = { AB: [join(['AB', 'x']), join(['AB', 'y'])], CD: [join(['CD', 'x']), join(['CD', 'y'])], EF: [join(['EF', 'x']), join(['EF', 'y'])] }
  const tasks = b9.CD.tasks.map((t) => t.id)
  const ab = metrics(...X.AB, ids, tasks), cd = metrics(...X.CD, ids, tasks), ef = metrics(...X.EF, ids, tasks)
  const nullRowsCD = ids.flatMap((id) => [X.CD[0].get(id), X.CD[1].get(id)]).filter((r) => r.primary_task === null).length
  const cond = {
    primary_gain: cd.primary_agreement - ef.primary_agreement > 0,
    link_agreement_kept: cd.link_agreement >= ef.link_agreement - TOL,
    link_kappa_kept: cd.link_kappa === null || ef.link_kappa === null ? null : cd.link_kappa >= ef.link_kappa - TOL,
    non_target_unchanged: Math.abs(cd.non_target_agreement - ef.non_target_agreement) <= TOL,
  }
  // 독립 원문 대조 표본 — 유효 대상을 (시험 id, 문항 번호) 오름차순으로 정렬한 앞 10(무작위 · 결과 열람 후 선택 없음)
  const order = (id) => { const [e, n] = id.split('#'); return [e, Number(n)] }
  const independent = [...ids].sort((p, q) => { const [ep, np] = order(p), [eq, nq] = order(q); return ep < eq ? -1 : ep > eq ? 1 : np - nq }).slice(0, INDEPENDENT_SAMPLE)
  result.valid_targets = ids.length
  result.pairs = { AB_v24_baseline: ab, CD_v25: cd, EF_v24_control: ef }
  result.differences = { primary_CD_minus_EF: cd.primary_agreement - ef.primary_agreement, link_agreement_CD_minus_EF: cd.link_agreement - ef.link_agreement, link_kappa_CD_minus_EF: cd.link_kappa === null || ef.link_kappa === null ? null : cd.link_kappa - ef.link_kappa, non_target_CD_minus_EF: cd.non_target_agreement - ef.non_target_agreement }
  result.null_primary_rows_CD = nullRowsCD
  result.automatic_conditions = cond
  result.independent_review_sample_CD = independent
  result.manual_conditions_pending = ['primary_discordant 전 문항 원문 대조(CD · EF 전수 — 독립 표본과 별도) — v2.5 쪽 판정이 계약 문구로 설명되는가', '독립 검증의 (C,D) 표본 10(independent_review_sample_CD) 원문 대조 반박 0', 'v2.5 절별 적용 범위 문서 대조(대상 외 영향 0)']
  result.decision = Object.values(cond).every((v) => v === true) ? 'seal_candidate_pending_manual' : 'not_seal'
  result.rule = '값은 반올림 없이 비교한다(보고만 4자리). κ null 이면 판단 불가 → 봉인하지 않는다. 조건은 전부 충족해야 한다. 유형별 결론을 내지 않는다 — 전체 결론만.'
}
fs.writeFileSync(OUT, JSON.stringify(result, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Number(v.toFixed(4)) : v), 1) + '\n')
console.log(JSON.stringify({ b9_valid: b9.valid.length, decision: result.decision, differences: result.differences ?? null }, null, 1))
