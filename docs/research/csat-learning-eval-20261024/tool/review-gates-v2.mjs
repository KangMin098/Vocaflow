// docs/research/csat-learning-eval-20261024/tool/review-gates-v2.mjs
// 이중 에이전트 검수 v2(13_DUAL_AGENT_REVIEW_V2.md): 원문 내용/데이터 결함 분리 · 조건 기반 같은 원리 · 매력 오답 판단 순서 · 합의≠반영.
// v1(review-gates.mjs)은 T-0149 기록 보존을 위해 그대로 둔다.

import { FAILURE_CODES, MIN_REASON, COPY_LIMIT, AGREEMENT_FLOOR } from './review-gates.mjs'

export { FAILURE_CODES, AGREEMENT_FLOOR }
export const CONTENT_VERDICTS = ['CONFIRM', 'REJECT', 'UNSURE']
export const DATA_DEFECTS = ['NONE', 'CHOICES_ARE_FRAGMENTS', 'FOOTNOTE_IN_CHOICE', 'GIVEN_SENTENCE_MERGED', 'PASSAGE_TRUNCATED', 'OTHER']
export const CONDITION_IDS = ['C1', 'C2', 'C3']
const MET = [true, false, 'unsure']

/** 조건 → verdict: 셋 다 true → SAME, 하나라도 false → DIFFERENT, 그 밖 UNSURE */
export function deriveVerdict(conditions) {
  const m = CONDITION_IDS.map((id) => (conditions.find((c) => c.id === id) || {}).met)
  if (m.some((x) => x === false)) return 'DIFFERENT'
  if (m.every((x) => x === true)) return 'SAME'
  return 'UNSURE'
}

const norm = (s) => String(s || '').replace(/[\s·]/g, '')

export function validateJudgmentsV2(judgments, packet) {
  const errors = []
  const items = Array.isArray(judgments && judgments.items) ? judgments.items : []
  if (!judgments || typeof judgments.reviewer !== 'string') errors.push('reviewer: 필요')
  const targets = packet.items.filter((p) => p.role === 'candidate')
  const byId = new Map(targets.map((p) => [p.item_id, p]))
  const seen = new Set()
  const reasons = new Map()
  const addReason = (where, text) => {
    const t = String(text || '').trim()
    if (t.length < MIN_REASON) errors.push(`${where}: 이유가 ${MIN_REASON}자 미만`)
    const key = norm(t)
    if (key && reasons.has(key)) errors.push(`${where}: 이유가 ${reasons.get(key)} 와 같다(상투 이유 금지)`)
    else reasons.set(key, where)
  }
  for (const j of items) {
    const p = byId.get(j.item_id)
    const at = `item ${j.item_id}`
    if (!p) { errors.push(`${at}: 판정 대상(후보)이 아님`); continue }
    if (seen.has(j.item_id)) errors.push(`${at}: 중복`)
    seen.add(j.item_id)
    const n = p.sentences.length
    const inRange = (arr, where, allowEmpty = false) => {
      if (!Array.isArray(arr) || (!allowEmpty && arr.length === 0)) { errors.push(`${where}: 문장 번호 필요`); return }
      for (const x of arr) if (!Number.isInteger(x) || x < 1 || x > n) errors.push(`${where}: 문장 번호 ${x} 범위 밖(1~${n})`)
    }
    const passage = p.sentences.map((s) => s.s).join(' ') + ' ' + p.choices.map((c) => c.text).join(' ')
    const copied = (text) => {
      const t = String(text || '')
      for (let i = 0; i + COPY_LIMIT <= t.length; i += 1) if (passage.includes(t.slice(i, i + COPY_LIMIT))) return true
      return false
    }
    const reasonOk = (where, text) => { addReason(where, text); if (copied(text)) errors.push(`${where}: 지문·선지 ${COPY_LIMIT}자 이상 복사`) }

    // 원문
    const o = j.original
    if (!o || !CONTENT_VERDICTS.includes(o.content_verdict)) errors.push(`${at}.original.content_verdict: ${CONTENT_VERDICTS.join('|')}`)
    else {
      if (!Array.isArray(o.data_defects) || o.data_defects.length === 0 || o.data_defects.some((d) => !DATA_DEFECTS.includes(d))) errors.push(`${at}.original.data_defects: ${DATA_DEFECTS.join('|')} 중 1개 이상`)
      else if (o.data_defects.includes('NONE') && o.data_defects.length > 1) errors.push(`${at}.original.data_defects: NONE 과 다른 결함을 같이 쓸 수 없다`)
      reasonOk(`${at}.original.reason`, o.reason)
    }
    // 같은 원리
    const f = j.anchor_function
    if (!f || !Array.isArray(f.conditions)) errors.push(`${at}.anchor_function.conditions: 필요`)
    else {
      for (const id of CONDITION_IDS) {
        const c = f.conditions.find((x) => x.id === id)
        if (!c) { errors.push(`${at}.anchor_function.${id}: 없음`); continue }
        if (!MET.includes(c.met)) errors.push(`${at}.anchor_function.${id}.met: true|false|"unsure"`)
        inRange(c.evidence, `${at}.anchor_function.${id}.evidence`, c.met === 'unsure')
        reasonOk(`${at}.anchor_function.${id}.note`, c.note)
      }
      if (f.verdict !== deriveVerdict(f.conditions)) errors.push(`${at}.anchor_function.verdict: 조건에서 정해지는 값(${deriveVerdict(f.conditions)})과 다름`)
      reasonOk(`${at}.anchor_function.counterexample_condition`, f.counterexample_condition)
    }
    // 매력 오답
    const nd = j.near_distractor
    if (!nd) errors.push(`${at}.near_distractor: 필요`)
    else {
      if (!Number.isInteger(nd.option) || nd.option < 1 || nd.option > 5 || nd.option === p.official_answer) errors.push(`${at}.near_distractor.option: 정답 아닌 1~5`)
      if (!FAILURE_CODES.includes(nd.primary_code)) errors.push(`${at}.near_distractor.primary_code: 코드표 밖 ${nd.primary_code}`)
      inRange(nd.counter_evidence, `${at}.near_distractor.counter_evidence`)
      reasonOk(`${at}.near_distractor.reason`, nd.reason)
      reasonOk(`${at}.near_distractor.code_decision_path`, nd.code_decision_path)
    }
    // revision
    const want = (p.revision_conflicts || []).map((c) => c.option)
    const got = new Map((j.revision_options || []).map((r) => [r.option, r]))
    for (const c of p.revision_conflicts || []) {
      const r = got.get(c.option)
      if (!r) { errors.push(`${at}.revision_options: ${c.option}번 판정 없음`); continue }
      const allowed = [...new Set(Object.values(c.labels_by_version))]
      if (r.chosen_label !== 'NONE' && !allowed.includes(r.chosen_label)) errors.push(`${at}.revision_options[${c.option}]: 버전에 있는 라벨 또는 NONE`)
      inRange(r.evidence, `${at}.revision_options[${c.option}].evidence`)
      reasonOk(`${at}.revision_options[${c.option}].reason`, r.reason)
    }
    for (const o2 of got.keys()) if (!want.includes(o2)) errors.push(`${at}.revision_options: 충돌 없는 ${o2}번`)
  }
  for (const p of targets) if (!seen.has(p.item_id)) errors.push(`item ${p.item_id}: 판정 없음`)
  return { ok: errors.length === 0, errors }
}

/**
 * 합의 집계. 값은 pair_agreed_value(합의)일 뿐이고, reflected_value 는 일치율 하한과 감사(audit)를 모두 통과한 게이트에서만 채운다.
 * audit: {gate: {pass: bool, failed_items: []}} — 감사 전에는 비워 두어 reflected 가 생기지 않는다.
 */
export function aggregateV2(a, b, packet, audit = {}) {
  const A = new Map(a.items.map((x) => [x.item_id, x]))
  const B = new Map(b.items.map((x) => [x.item_id, x]))
  const rows = []
  for (const p of packet.items.filter((q) => q.role === 'candidate')) {
    const x = A.get(p.item_id), y = B.get(p.item_id)
    const row = { item_id: p.item_id }
    const ov = x.original.content_verdict === y.original.content_verdict
    row.original = { agree: ov, pair_agreed_value: ov && x.original.content_verdict === 'CONFIRM' ? 'CONFIRM' : null, a: x.original.content_verdict, b: y.original.content_verdict, data_defects_union: [...new Set([...x.original.data_defects, ...y.original.data_defects])].filter((d) => d !== 'NONE') }
    const va = x.anchor_function.verdict, vb = y.anchor_function.verdict
    const condAgree = Object.fromEntries(CONDITION_IDS.map((id) => [id, x.anchor_function.conditions.find((c) => c.id === id).met === y.anchor_function.conditions.find((c) => c.id === id).met]))
    row.anchor_function = { agree: va === vb, pair_agreed_value: va === vb && va !== 'UNSURE' ? va : null, a: va, b: vb, conditions_agree: condAgree }
    const nx = x.near_distractor, ny = y.near_distractor
    const nagree = nx.option === ny.option && nx.primary_code === ny.primary_code
    row.near_distractor = { agree: nagree, pair_agreed_value: nagree ? { option: nx.option, code: nx.primary_code, counter_evidence_union: [...new Set([...nx.counter_evidence, ...ny.counter_evidence])].sort((m, k) => m - k) } : null, a: `${nx.option}:${nx.primary_code}`, b: `${ny.option}:${ny.primary_code}` }
    row.revision_options = (p.revision_conflicts || []).map((c) => {
      const rx = x.revision_options.find((r) => r.option === c.option), ry = y.revision_options.find((r) => r.option === c.option)
      const agree = rx.chosen_label === ry.chosen_label
      return { option: c.option, agree, pair_agreed_value: agree && rx.chosen_label !== 'NONE' ? rx.chosen_label : null, a: rx.chosen_label, b: ry.chosen_label }
    })
    rows.push(row)
  }
  const rate = (pick) => { const v = rows.flatMap(pick); const k = v.filter(Boolean).length; return { n: v.length, agree: k, rate: v.length ? Number((k / v.length).toFixed(3)) : null } }
  const gates = {
    original: rate((r) => [r.original.agree]),
    anchor_function: rate((r) => [r.anchor_function.agree]),
    near_distractor: rate((r) => [r.near_distractor.agree]),
    revision_options: rate((r) => r.revision_options.map((o) => o.agree)),
  }
  for (const [g, s] of Object.entries(gates)) {
    s.meets_floor = s.rate !== null && s.rate >= AGREEMENT_FLOOR
    s.audit = audit[g] || null
    s.reflect = s.meets_floor && !!(audit[g] && audit[g].pass)
  }
  for (const r of rows) {
    const failed = (g) => (audit[g] && Array.isArray(audit[g].failed_items) ? audit[g].failed_items : [])
    r.original.reflected_value = gates.original.reflect && !failed('original').includes(r.item_id) ? r.original.pair_agreed_value : null
    r.anchor_function.reflected_value = gates.anchor_function.reflect ? r.anchor_function.pair_agreed_value : null
    r.near_distractor.reflected_value = gates.near_distractor.reflect ? r.near_distractor.pair_agreed_value : null
    for (const o of r.revision_options) o.reflected_value = gates.revision_options.reflect ? o.pair_agreed_value : null
  }
  return { floor: AGREEMENT_FLOOR, gates, rows }
}
