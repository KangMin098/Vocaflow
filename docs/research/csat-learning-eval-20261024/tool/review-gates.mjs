// docs/research/csat-learning-eval-20261024/tool/review-gates.mjs
// 이중 에이전트 검수(Claude Code = A · Codex = B) 판정의 엄격 검증과 합의 집계. 규칙은 판정 전에 고정한다(11_DUAL_AGENT_REVIEW.md).

export const FAILURE_CODES = [
  'LEX_BAIT', 'REVERSAL', 'OFF_TOPIC', 'PARTIAL_TRUE', 'OUTSIDE_KNOWLEDGE', 'AGENT_SWAP', 'SCOPE_OVER', 'SCOPE_UNDER', 'CAUSE_REVERSAL',
  'REF_ANTECEDENT_CUT', 'LEX_REPEAT_LURE', 'CLOSER_MISPLACE', 'SEQ_REVERSAL', 'CONNECTIVE_CLASH', 'FIRST_MENTION_VIOLATION', 'COND_RESULT_CUT',
  'GENERAL_SPECIFIC_REVERSAL', 'ENUM_CUT', 'OTHER_ATLAS',
]
export const FUNCTION_VERDICTS = ['SAME', 'DIFFERENT', 'UNSURE']
export const ORIGINAL_VERDICTS = ['CONFIRM', 'REJECT', 'UNSURE']
export const MIN_REASON = 15
export const COPY_LIMIT = 30
export const AGREEMENT_FLOOR = 0.85

const isInt = (v) => Number.isInteger(v)
const norm = (s) => String(s || '').replace(/[\s·]/g, '')

/** 판정 파일 하나를 패킷과 대조해 검사한다. 오류가 하나라도 있으면 그 판정 파일은 집계하지 않는다. */
export function validateJudgments(judgments, packet) {
  const errors = []
  const items = Array.isArray(judgments && judgments.items) ? judgments.items : []
  if (!judgments || typeof judgments.reviewer !== 'string') errors.push('reviewer: 필요')
  const byId = new Map(packet.items.map((p) => [p.item_id, p]))
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
    if (!p) { errors.push(`${at}: 패킷에 없는 문항`); continue }
    if (seen.has(j.item_id)) errors.push(`${at}: 중복`)
    seen.add(j.item_id)
    const n = p.sentences.length
    const inRange = (arr, where) => {
      if (!Array.isArray(arr) || arr.length === 0) { errors.push(`${where}: 문장 번호 필요`); return }
      for (const x of arr) if (!isInt(x) || x < 1 || x > n) errors.push(`${where}: 문장 번호 ${x} 범위 밖(1~${n})`)
    }
    const passage = p.sentences.map((s) => s.s).join(' ')
    const copied = (text) => {
      const t = String(text || '')
      for (let i = 0; i + COPY_LIMIT <= t.length; i += 1) if (passage.includes(t.slice(i, i + COPY_LIMIT))) return true
      return false
    }
    // 원문 확인
    if (!j.original || !ORIGINAL_VERDICTS.includes(j.original.verdict)) errors.push(`${at}.original.verdict: ${ORIGINAL_VERDICTS.join('|')}`)
    else addReason(`${at}.original.reason`, j.original.reason)
    // 근거
    if (!j.evidence) errors.push(`${at}.evidence: 필요`)
    else {
      inRange(j.evidence.decisive, `${at}.evidence.decisive`)
      for (const [k, alt] of (j.evidence.accepted_alternatives || []).entries()) inRange(alt, `${at}.evidence.accepted_alternatives[${k}]`)
      addReason(`${at}.evidence.reason`, j.evidence.reason)
      if (copied(j.evidence.reason)) errors.push(`${at}.evidence.reason: 지문 ${COPY_LIMIT}자 이상 복사`)
    }
    // 가까운 오답
    const nd = j.near_distractor
    if (!nd) errors.push(`${at}.near_distractor: 필요`)
    else {
      if (!isInt(nd.option) || nd.option < 1 || nd.option > 5 || nd.option === p.official_answer) errors.push(`${at}.near_distractor.option: 정답 아닌 1~5`)
      if (!FAILURE_CODES.includes(nd.failure_code)) errors.push(`${at}.near_distractor.failure_code: 코드표 밖 ${nd.failure_code}`)
      inRange(nd.counter_evidence, `${at}.near_distractor.counter_evidence`)
      addReason(`${at}.near_distractor.reason`, nd.reason)
      if (copied(nd.reason)) errors.push(`${at}.near_distractor.reason: 지문 ${COPY_LIMIT}자 이상 복사`)
    }
    // 같은 원리(후보만)
    if (p.role === 'candidate') {
      if (!j.anchor_function || !FUNCTION_VERDICTS.includes(j.anchor_function.verdict)) errors.push(`${at}.anchor_function.verdict: ${FUNCTION_VERDICTS.join('|')}`)
      else {
        addReason(`${at}.anchor_function.reason`, j.anchor_function.reason)
        addReason(`${at}.anchor_function.non_application`, j.anchor_function.non_application)
      }
    }
    // revision 충돌
    const want = (p.revision_conflicts || []).map((c) => c.option)
    const got = new Map((j.revision_options || []).map((r) => [r.option, r]))
    for (const c of p.revision_conflicts || []) {
      const r = got.get(c.option)
      if (!r) { errors.push(`${at}.revision_options: ${c.option}번 판정 없음`); continue }
      const allowed = [...new Set(Object.values(c.labels_by_version))]
      if (r.chosen_label !== 'NONE' && !allowed.includes(r.chosen_label)) errors.push(`${at}.revision_options[${c.option}]: 버전에 있는 라벨 또는 NONE`)
      addReason(`${at}.revision_options[${c.option}].reason`, r.reason)
    }
    for (const o of got.keys()) if (!want.includes(o)) errors.push(`${at}.revision_options: 충돌 없는 ${o}번`)
  }
  for (const p of packet.items) if (!seen.has(p.item_id)) errors.push(`item ${p.item_id}: 판정 없음`)
  return { ok: errors.length === 0, errors }
}

const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b)
  const inter = [...A].filter((x) => B.has(x)).length
  const uni = new Set([...A, ...B]).size
  return uni ? inter / uni : 0
}

/** A·B 합의. 칸마다 일치 여부와 수용 값. 게이트별 일치율이 AGREEMENT_FLOOR 미만이면 그 게이트는 전 문항 미반영. */
export function aggregate(a, b, packet) {
  const A = new Map(a.items.map((x) => [x.item_id, x]))
  const B = new Map(b.items.map((x) => [x.item_id, x]))
  const rows = []
  for (const p of packet.items) {
    const x = A.get(p.item_id), y = B.get(p.item_id)
    const row = { item_id: p.item_id, role: p.role }
    row.original = { agree: x.original.verdict === y.original.verdict, accepted: x.original.verdict === 'CONFIRM' && y.original.verdict === 'CONFIRM', a: x.original.verdict, b: y.original.verdict }
    const jac = jaccard(x.evidence.decisive, y.evidence.decisive)
    const inter = x.evidence.decisive.filter((s) => y.evidence.decisive.includes(s))
    row.evidence = { agree: jac >= 0.5 && inter.length > 0, jaccard: Number(jac.toFixed(3)), gold: jac >= 0.5 ? inter : null, a: x.evidence.decisive, b: y.evidence.decisive }
    const nx = x.near_distractor, ny = y.near_distractor
    row.near_distractor = { agree: nx.option === ny.option && nx.failure_code === ny.failure_code, option_agree: nx.option === ny.option, a: `${nx.option}:${nx.failure_code}`, b: `${ny.option}:${ny.failure_code}` }
    if (p.role === 'candidate') {
      const vx = x.anchor_function.verdict, vy = y.anchor_function.verdict
      row.anchor_function = { agree: vx === vy, accepted: vx === vy && vx !== 'UNSURE' ? vx : null, a: vx, b: vy }
    }
    row.revision_options = (p.revision_conflicts || []).map((c) => {
      const rx = x.revision_options.find((r) => r.option === c.option), ry = y.revision_options.find((r) => r.option === c.option)
      const agree = rx.chosen_label === ry.chosen_label
      return { option: c.option, agree, accepted_label: agree && rx.chosen_label !== 'NONE' ? rx.chosen_label : null, a: rx.chosen_label, b: ry.chosen_label }
    })
    rows.push(row)
  }
  const rate = (pick) => { const v = rows.flatMap(pick); return { n: v.length, agree: v.filter(Boolean).length, rate: v.length ? Number((v.filter(Boolean).length / v.length).toFixed(3)) : null } }
  const gates = {
    original: rate((r) => [r.original.agree]),
    evidence: rate((r) => [r.evidence.agree]),
    near_distractor: rate((r) => [r.near_distractor.agree]),
    anchor_function: rate((r) => (r.anchor_function ? [r.anchor_function.agree] : [])),
    revision_options: rate((r) => r.revision_options.map((o) => o.agree)),
  }
  for (const g of Object.values(gates)) g.reflect = g.rate !== null && g.rate >= AGREEMENT_FLOOR
  return { floor: AGREEMENT_FLOOR, gates, rows }
}
