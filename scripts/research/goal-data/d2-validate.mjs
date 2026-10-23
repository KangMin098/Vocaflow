// scripts/research/goal-data/d2-validate.mjs
//
// D2 계약 검사(v2 반사실 · v2.2 부분 집합 · 삽입 격리 · v2.3 주 수행 범위 · v2.4 E2 고정표 · 주 TASK 선택 이유) — d2-run · d3-build 공용.
// T-0107 P1: D3 는 D2 와 같은 검사를 통과한 행만 쓴다. 1차 표본 검증기(validateRow · validateChunk)는 그대로 부르고 계약 검사만 더한다.
import fs from 'node:fs'
import path from 'node:path'

import { validateChunk, validateRow } from '../../csat/map/v62/data/pilot-lib.mjs'

export const V22_PLUS = ['v2.2', 'v2.3', 'v2.4', 'v2.5']
// v2.4 규칙(E2 고정표 · 주 TASK 선택 이유 · 범위 밖 가드)은 v2.5 에도 그대로 적용된다
const V24_PLUS = ['v2.4', 'v2.5']
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
  const reasonsRequired = V24_PLUS.includes(input.contract)
  const BATCH_NO = Number(/^b(\d+)-/.exec(String(input.batch))?.[1] ?? 0)

  function v2(row, inp) {
    if (legacyV1) return []
    const errs = []
    // 오답 분석 목록에 공식 정답 선지가 들어가면 거부한다(b11 B-02 가 M2309#41 정답 ③ 을 오답으로 넣었다 — 1차 검증기는 누락만 본다)
    for (const d of row.distractors ?? []) if (answerSet(inp.source).includes(d.choice)) errs.push(`오답 목록에 정답 ${d.choice} 가 있다`)
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
    if (!['v2.3', ...V24_PLUS].includes(input.contract)) return []
    if (typeof row.main_performance_outside_subset !== 'boolean') return ['main_performance_outside_subset(true|false) 없음(v2.3 §1)']
    if (V24_PLUS.includes(input.contract) && row.main_performance_outside_subset && IN_SUBSET_TYPES.includes(inp.type_id)) return [`${inp.type_id} 의 주 수행은 판정 TASK 안 — main_performance_outside_subset 는 false(v2.3 §1)`]
    return []
  }
  /** v2.4 — 주 TASK 선택 이유(§3) · E2 고정표(§1) */
  function v24(row, inp) {
    const errs = []
    if (reasonsRequired && norm(row.primary_reason).length < 15) errs.push('primary_reason(문항 고유 선택 이유 15자 이상) 없음(v2.4 §3)')
    if (!V24_PLUS.includes(input.contract)) return errs
    const e2 = (row.links ?? []).find((l) => l.task_id === 'e.evidence_location')
    if (e2 && E2_NA_TYPES.includes(inp.type_id) && e2.relevance !== 'not_applicable') errs.push(`${inp.type_id} 의 E2 는 not_applicable(v2.4 §1)`)
    if (e2 && E2_DIRECT_TYPES.includes(inp.type_id) && e2.relevance !== 'direct') errs.push(`${inp.type_id} 의 E2 는 direct(v2.4 §1)`)
    return errs
  }

  /** v2.5 — 일치 · 불일치 · 안내문에서 E1 은 주 TASK 가 아니다(§1) */
  function v25(row, inp) {
    if (input.contract !== 'v2.5') return []
    return E2_DIRECT_TYPES.includes(inp.type_id) && row.primary_task === 'e.task_demand' ? [`${inp.type_id} 에서 E1 은 주 TASK 가 아니다(v2.5 §1)`] : []
  }

  /** 한 행 — 1차 검증기 + 계약 검사. primary-null 면제는 v2.2 이상 · 부분 집합 · 명시적 secondary=[] · direct 0 일 때만(T-0103 · T-0104) */
  function row(rowOut) {
    const inp = byId.get(rowOut.item_id)
    if (!inp) return ['배치 밖']
    const indirectSet = (rowOut.links ?? []).filter((l) => l.relevance === 'indirect').map((l) => l.task_id).sort()
    const secondaryOk = Array.isArray(rowOut.secondary_tasks) && (input.contract === 'v2.5'
      ? JSON.stringify([...rowOut.secondary_tasks].sort()) === JSON.stringify(indirectSet)   // v2.5 §3: indirect 를 secondary 에 남긴다
      : rowOut.secondary_tasks.length === 0)
    const noDirect = subset && V22_PLUS.includes(input.contract) && rowOut.primary_task === null && secondaryOk && !(rowOut.links ?? []).some((l) => l.relevance === 'direct')
    // 같은 TASK 를 directly_observable 과 not_observable 양쪽에 두지 않는다(T-0122 P1-02 · b5–b14 61행은 기록 · b15 부터 거부)
    const both = BATCH_NO >= 15 ? (rowOut.not_observable ?? []).map((n) => n?.task_id).filter((t) => (rowOut.directly_observable ?? []).includes(t)) : []
    return [...validateRow(rowOut, inp, tasks).filter((x) => !(noDirect && x.startsWith('주 TASK '))), ...v2(rowOut, inp), ...v22(rowOut, inp), ...v23(rowOut, inp), ...v24(rowOut, inp), ...v25(rowOut, inp), ...both.map((t) => `관측 ${t} 가 directly_observable · not_observable 양쪽에 있다`)]
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
    // not_observable why — 문항 id 만 바꾼 같은 문장이 3문항 이상이면 문항 고유 판정이 아니다(b14 B-01: 44개가 한 틀).
    // b14 부터 적용 — b8 · b13 A 트랙의 기존 반복은 알려진 결함으로 기록(mapping-review §18)하고 소급 배제하지 않는다
    if (reasonsRequired && BATCH_NO >= 14) {
      const nob = new Map()
      for (const r of allRows) for (const n of r.not_observable ?? []) {
        if (typeof n?.why !== 'string') continue
        // 계약 고정 문구(삽입 E2 — v2.2 §3)는 문항마다 같아도 정당하다(T-0121 P1-01: b3 B · b6 A 를 잘못 배제)
        if (n.task_id === 'e.evidence_location' && byId.get(r.item_id)?.type_id === 'R-INSERT') continue
        const k = norm(n.why.split(r.item_id).join('#'))
        nob.set(k, new Set([...(nob.get(k) ?? []), r.item_id]))
      }
      // 행 단위로 묶는다(T-0121 P1-01): 반복 문장(3문항↑)이 그 행 설명의 절반 이상인 행만 「틀 행」 — 한 줄만 겹치고 나머지가 문항 고유인 행(b3 B)은 정당
      const rep = new Set([...nob].filter(([, ids]) => ids.size >= 3).map(([k]) => k))
      const tmplRows = new Map()
      for (const r of allRows) {
        const ws = (r.not_observable ?? []).filter((n) => typeof n?.why === 'string' && !(n.task_id === 'e.evidence_location' && byId.get(r.item_id)?.type_id === 'R-INSERT')).map((n) => norm(n.why.split(r.item_id).join('#')))
        const hit = ws.filter((k) => rep.has(k))
        if (ws.length && hit.length * 2 >= ws.length) for (const k of hit) tmplRows.set(k, [...(tmplRows.get(k) ?? []), r.item_id])
      }
      for (const [k, ids] of tmplRows) if (new Set(ids).size >= 3) errs.push(`not_observable why 틀 반복 ${new Set(ids).size}문항(${[...new Set(ids)].slice(0, 3).join(',')}): 「${k.slice(0, 30)}」`)
    }
    return errs
  }
  return { row, chunk, reasons, byId }
}

/** 청크 크기 — b2 · b3 만 10, 그 뒤 배치는 20(d2-run · prereg-compare 공용) */
export const chunkSize = (batch) => (['b2-v2', 'b3-insert'].includes(String(batch)) ? 10 : 20)

/**
 * 한 트랙 출력 로더(d2-run · prereg-compare 공용 · T-0115 RECHECK-P1-01):
 *   청크 반복 검사(V.chunk) 실패 → 그 청크 전체 배제 · 행 검사(V.row) 실패 → 그 행 배제 · 트랙 전체 선택 이유 반복(V.reasons) → 트랙 전체 배제
 */
export function loadTrack(dir, track, nChunks, V, ids) {
  const out = new Map(), errors = [], allRows = []
  for (let k = 0; k < nChunks; k++) {
    const f = path.join(dir, `chunk-${track}-${String(k + 1).padStart(2, '0')}.out.json`)
    if (!fs.existsSync(f)) { errors.push(`${path.basename(f)} 없음`); continue }
    const rows = JSON.parse(fs.readFileSync(f, 'utf8')).rows ?? []
    allRows.push(...rows)
    const ce = V.chunk(rows)
    if (ce.length) { errors.push(...ce.map((x) => `${track} ${path.basename(f)}: ${x}`)); continue }
    for (const row of rows) {
      const e = V.row(row)
      if (e.length) errors.push(...e.map((x) => `${track} ${row.item_id}: ${x}`))
      else out.set(row.item_id, row)
    }
  }
  const re = V.reasons(allRows)
  if (re.length) { errors.push(...re.map((x) => `${track} 트랙: ${x}`)); out.clear() }
  for (const id of ids) if (!out.has(id) && !errors.some((e) => e.includes(id))) errors.push(`${track} ${id} 출력 없음`)
  return { out, errors }
}
