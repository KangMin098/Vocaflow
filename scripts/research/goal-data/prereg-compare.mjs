// scripts/research/goal-data/prereg-compare.mjs
//
// v2.5 사전 등록(V2_5_PREREGISTRATION rev3) 비교 계산 — 지표 · 분모 · 판정 규칙을 이 파일에 고정한다(동결 대상 · sha256 을 사전 등록에 기록).
//   node scripts/research/goal-data/prereg-compare.mjs
// 쌍: (A,B) = b9-v24 의 A/B(v2.4 · 기준선) · (C,D) = b9t-v25 의 A/B(v2.5) · (E,F) = b9t-v24 의 A/B(v2.4 대조).
// 순서 규칙: 여섯 판정이 모두 있고 검증을 끝낸 뒤에만 계산한다. 유효 대상이 12 미만이면 지표를 계산하지 않고 b10 확장 신호만 낸다.
// 출력(생성물): docs/research/goal-data-batches/D2-task-mapping/v2_5-comparison.json
import fs from 'node:fs'
import path from 'node:path'

import { ROOT, nonHeldTasks } from '../../csat/map/v62/data/pilot-lib.mjs'

import { makeValidator } from './d2-validate.mjs'

const LOCAL = path.join(ROOT, 'scripts/research/goal-data/local')
const OUT = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping/v2_5-comparison.json')
const MIN_TARGETS = 12
const TOL = 0.05
// 「대상 외 영향」 을 보는 TASK — v2.5 가 주 TASK 선택 기준으로 다루는 E2 · E3 를 뺀 나머지
const NON_TARGET_TASKS = ['r.central_meaning', 'r.inference', 'e.task_demand', 'r.discourse_structure']
const CATS = ['direct', 'indirect', 'not_applicable', 'unknown']

const all = nonHeldTasks()
function loadPair(batch) {
  const input = JSON.parse(fs.readFileSync(path.join(LOCAL, batch, 'input.json'), 'utf8'))
  const tasks = all.filter((t) => input.tasks.includes(t.id))
  const V = makeValidator(input, tasks)
  const read = (track) => {
    const files = fs.readdirSync(path.join(LOCAL, batch)).filter((f) => f.startsWith(`chunk-${track}-`) && f.endsWith('.out.json'))
    if (!files.length) return null
    const rows = files.flatMap((f) => JSON.parse(fs.readFileSync(path.join(LOCAL, batch, f), 'utf8')).rows ?? [])
    // 트랙 전체 이유 반복에 걸리면 그 트랙 전체 무효(d2-run 과 같은 규칙)
    if (V.reasons(rows).length) return new Map()
    return new Map(rows.filter((r) => !V.row(r).length).map((r) => [r.item_id, r]))
  }
  return { input, tasks, x: read('A'), y: read('B') }
}

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

const AB = loadPair('b9-v24'), CD = loadPair('b9t-v25'), EF = loadPair('b9t-v24')
const missing = [['A', AB.x], ['B', AB.y], ['C', CD.x], ['D', CD.y], ['E', EF.x], ['F', EF.y]].filter(([, m]) => m === null).map(([t]) => t)
if (missing.length) { console.error(`판정 출력 없음: ${missing.join(',')} — 여섯 판정이 모두 있어야 계산한다`); process.exit(2) }

// 유효 대상 = 대상 문항 중 여섯 판정이 모두 검증을 통과한 문항(비교 배치 입력 순서 그대로)
const targetIds = CD.input.rows.map((r) => r.item_id)
const valid = targetIds.filter((id) => [AB.x, AB.y, CD.x, CD.y, EF.x, EF.y].every((m) => m.has(id)))
const result = { generated_by: 'scripts/research/goal-data/prereg-compare.mjs', registration: 'V2_5_PREREGISTRATION rev3', targets: targetIds.length, valid_targets: valid.length, invalid_targets: targetIds.filter((id) => !valid.includes(id)) }

if (valid.length < MIN_TARGETS) {
  result.decision = 'insufficient_extend_b10'
  result.note = `유효 대상 ${valid.length} < ${MIN_TARGETS} — 지표를 계산하지 않는다. 사전 지정 b10(M2309 대상 유형)을 같은 절차로 판정해 합친 뒤 다시 실행한다.`
} else {
  const tasks = CD.tasks.map((t) => t.id)
  const ab = metrics(AB.x, AB.y, valid, tasks), cd = metrics(CD.x, CD.y, valid, tasks), ef = metrics(EF.x, EF.y, valid, tasks)
  const nullRowsCD = valid.flatMap((id) => [CD.x.get(id), CD.y.get(id)]).filter((r) => r.primary_task === null).length
  const cond = {
    primary_gain: cd.primary_agreement - ef.primary_agreement > 0,
    link_agreement_kept: cd.link_agreement >= ef.link_agreement - TOL,
    link_kappa_kept: cd.link_kappa === null || ef.link_kappa === null ? null : cd.link_kappa >= ef.link_kappa - TOL,
    non_target_unchanged: Math.abs(cd.non_target_agreement - ef.non_target_agreement) <= TOL,
  }
  result.pairs = { AB_v24_baseline: ab, CD_v25: cd, EF_v24_control: ef }
  result.differences = { primary_CD_minus_EF: cd.primary_agreement - ef.primary_agreement, link_agreement_CD_minus_EF: cd.link_agreement - ef.link_agreement, link_kappa_CD_minus_EF: cd.link_kappa === null || ef.link_kappa === null ? null : cd.link_kappa - ef.link_kappa, non_target_CD_minus_EF: cd.non_target_agreement - ef.non_target_agreement }
  result.null_primary_rows_CD = nullRowsCD
  result.automatic_conditions = cond
  // κ 가 null 이면 판단 불가 — 봉인 후보로 올리지 않는다
  const auto = Object.values(cond).every((v) => v === true)
  result.manual_conditions_pending = ['primary_discordant 전 문항 원문 대조(CD · EF) — v2.5 쪽 판정이 계약 문구로 설명되는가', '독립 검증의 (C,D) 표본 10 원문 대조 반박 0', 'v2.5 절별 적용 범위 문서 대조(대상 외 영향 0)']
  result.decision = auto ? 'seal_candidate_pending_manual' : 'not_seal'
  result.rule = '값은 반올림 없이 비교한다(보고만 4자리). 유형별 결론을 내지 않는다(대상 유형별 n 2–4) — 전체 결론만.'
}
fs.writeFileSync(OUT, JSON.stringify(result, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Number(v.toFixed(4)) : v), 1) + '\n')
console.log(JSON.stringify({ valid: result.valid_targets, decision: result.decision, differences: result.differences ?? null }, null, 1))
