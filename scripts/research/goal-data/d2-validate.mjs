// scripts/research/goal-data/d2-validate.mjs
//
// D2 계약 검사(v2 반사실 · v2.2 부분 집합 · 삽입 격리 · v2.3 주 수행 범위 · v2.4 E2 고정표 · 주 TASK 선택 이유) — d2-run · d3-build 공용.
// T-0107 P1: D3 는 D2 와 같은 검사를 통과한 행만 쓴다. 1차 표본 검증기(validateRow · validateChunk)는 그대로 부르고 계약 검사만 더한다.
import { validateChunk, validateRow } from '../../csat/map/v62/data/pilot-lib.mjs'

export const V22_PLUS = ['v2.2', 'v2.3', 'v2.4']
// v2.4 §1 E2 고정표 — 대상 없는 전체 판단 문항 · 순서 = 무관, 내용 일치 · 안내문 = direct
const E2_NA_TYPES = ['R-PURPOSE', 'R-CLAIM', 'R-GIST', 'R-TOPIC', 'R-TITLE', 'R-MOOD', 'R-ORDER', 'X-TITLE', 'X-ORDER']
const E2_DIRECT_TYPES = ['R-FACT', 'R-NOTICE', 'X-FACT']
// 주 수행이 확대 6 TASK(R5 · R6 · E1 · E3 · R4 · E2) 안에 있는 유형 — 어법 · 어휘 · 지칭 · 무관 · 심경 · 삽입 · 함축은 문항마다 판단
const IN_SUBSET_TYPES = ['R-FACT', 'R-NOTICE', 'X-FACT', 'R-BLANK', 'R-SUMMARY', 'R-GIST', 'R-TOPIC', 'R-TITLE', 'X-TITLE', 'R-CLAIM', 'R-PURPOSE', 'R-ORDER', 'X-ORDER']
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
const answerSet = (src) => (src.answers?.length ? src.answers : src.answer != null ? [src.answer] : [])
const fieldText = (src, f) => (f === 'choices' ? (src.choices ?? []).map((c) => (typeof c === 'string' ? c : JSON.stringify(c))).join(' ') : String(src[f] ?? ''))
// 선택 이유의 「틀」 — 인용 · 영어 낱말 · 숫자 · 선지 기호 · 문항 id 를 걷어 내고 남은 한국어 골격(같은 문장에 낱말만 바꿔 끼운 템플릿을 잡는다)
const skeleton = (s) => norm(s).replace(/「[^」]*」|"[^"]*"|'[^']*'|“[^”]*”/g, '').replace(/[A-Za-z][A-Za-z'’.-]*/g, '').replace(/[0-9①-⑤#]+/g, '').replace(/[\s·,.:;()\-—→/]+/g, '')
const isSingleDirect = (s) => /^direct\s*단일/.test(norm(s))

/** 배치 입력(input.json)과 판정 TASK 목록으로 검사기를 만든다. legacyV1 = pilot-1(계약 v1 — 반사실 · 이후 규칙 없음) */
export function makeValidator(input, tasks, { legacyV1 = false } = {}) {
  const subset = !!input.tasks
  const byId = new Map(input.rows.map((r) => [r.item_id, r]))
  const reasonsRequired = input.contract === 'v2.4'

  function v2(row, inp) {
    if (legacyV1) return []
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
  /** v2.2 — 삽입 문항 격리(E2 unknown · 독립 평가 부적격) */
  function v22(row, inp) {
    if (!V22_PLUS.includes(input.contract) || inp.type_id !== 'R-INSERT') return []
    const errs = []
    const e2 = (row.links ?? []).find((l) => l.task_id === 'e.evidence_location')
    if (e2 && e2.relevance !== 'unknown') errs.push('삽입 문항 E2 는 unknown(v2.2 §3)')
    if (row.independent_assessment?.eligibility !== 'not_suitable') errs.push('삽입 문항 independent_assessment 는 not_suitable(v2.2 §3)')
    return errs
  }
  /** v2.3 — 부분 집합 primary 의 뜻(§1). v2.4 는 유형상 주 수행이 6 TASK 안인 문항에 「범위 밖」 표시를 거부한다(b7 A-02 가 20행 전부 true 로 둔 결함) */
  function v23(row, inp) {
    if (!['v2.3', 'v2.4'].includes(input.contract)) return []
    if (typeof row.main_performance_outside_subset !== 'boolean') return ['main_performance_outside_subset(true|false) 없음(v2.3 §1)']
    if (input.contract === 'v2.4' && row.main_performance_outside_subset && IN_SUBSET_TYPES.includes(inp.type_id)) return [`${inp.type_id} 의 주 수행은 판정 TASK 안 — main_performance_outside_subset 는 false(v2.3 §1)`]
    return []
  }
  /** v2.4 — 주 TASK 선택 이유(§3) · E2 고정표(§1) */
  function v24(row, inp) {
    const errs = []
    if (reasonsRequired && norm(row.primary_reason).length < 15) errs.push('primary_reason(문항 고유 선택 이유 15자 이상) 없음(v2.4 §3)')
    if (input.contract !== 'v2.4') return errs
    const e2 = (row.links ?? []).find((l) => l.task_id === 'e.evidence_location')
    if (e2 && E2_NA_TYPES.includes(inp.type_id) && e2.relevance !== 'not_applicable') errs.push(`${inp.type_id} 의 E2 는 not_applicable(v2.4 §1)`)
    if (e2 && E2_DIRECT_TYPES.includes(inp.type_id) && e2.relevance !== 'direct') errs.push(`${inp.type_id} 의 E2 는 direct(v2.4 §1)`)
    return errs
  }

  /** 한 행 — 1차 검증기 + 계약 검사. primary-null 면제는 v2.2 이상 · 부분 집합 · 명시적 secondary=[] · direct 0 일 때만(T-0103 · T-0104) */
  function row(rowOut) {
    const inp = byId.get(rowOut.item_id)
    if (!inp) return ['배치 밖']
    const noDirect = subset && V22_PLUS.includes(input.contract) && rowOut.primary_task === null && Array.isArray(rowOut.secondary_tasks) && rowOut.secondary_tasks.length === 0 && !(rowOut.links ?? []).some((l) => l.relevance === 'direct')
    return [...validateRow(rowOut, inp, tasks).filter((x) => !(noDirect && x.startsWith('주 TASK '))), ...v2(rowOut, inp), ...v22(rowOut, inp), ...v23(rowOut, inp), ...v24(rowOut, inp)]
  }
  /** 한 청크 — 1차 반복 검사. 계약이 고정 문구를 요구하는 삽입 E2 unknown(v2.2 §3)은 반복 검사에서 뺀다 */
  function chunk(rows) {
    return validateChunk(V22_PLUS.includes(input.contract) ? rows.map((r) => (byId.get(r.item_id)?.type_id === 'R-INSERT' ? { ...r, links: (r.links ?? []).filter((l) => !(l.task_id === 'e.evidence_location' && l.relevance === 'unknown')) } : r)) : rows)
  }
  /**
   * 트랙 전체(모든 청크) — 주 TASK 선택 이유 반복(T-0107: 3행 완전 일치만 잡던 것을 보강)
   *   완전 반복 2행 이상 · 템플릿(골격) 반복 3행 이상(「direct 단일」 형식 행은 골격 검사 제외) · 청크 경계를 넘어 센다
   */
  function reasons(allRows) {
    const withReason = allRows.filter((r) => typeof r.primary_reason === 'string')
    if (!reasonsRequired && !withReason.length) return []
    const errs = []
    const exact = new Map(), skel = new Map()
    for (const r of withReason) {
      const k = norm(r.primary_reason)
      exact.set(k, [...(exact.get(k) ?? []), r.item_id])
      // 「direct 단일」 예외는 실제로 direct 가 하나이고 그것이 primary 일 때만(T-0108 P1: 접두어만으로 다중 direct 행이 골격 검사를 우회했다)
      if (isSingleDirect(k)) {
        const directs = (r.links ?? []).filter((l) => l.relevance === 'direct').map((l) => l.task_id)
        if (directs.length === 1 && directs[0] === r.primary_task) continue
        errs.push(`${r.item_id}: primary_reason 이 「direct 단일」 인데 direct 링크 ${directs.length}개(${directs.join(',') || '없음'}) · primary ${r.primary_task} — 허위 단일 표지`)
      }
      const s = skeleton(k)
      if (s.length >= 6) skel.set(s, [...(skel.get(s) ?? []), r.item_id])
    }
    for (const [k, ids] of exact) if (ids.length >= 2) errs.push(`primary_reason 완전 반복 ${ids.length}행(${ids.slice(0, 3).join(',')}): 「${k.slice(0, 30)}」`)
    for (const [s, ids] of skel) if (ids.length >= 3) errs.push(`primary_reason 템플릿 반복 ${ids.length}행(${ids.slice(0, 3).join(',')}): 골격 「${s.slice(0, 24)}」`)
    return errs
  }
  return { row, chunk, reasons, byId }
}
