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
/** 삽입 E2 계약 고정 문구(v2.2 §3) — not_observable 반복 검사에서 정확히 이 문자열만 예외(T-0123 RECHECK-P1-02) */
export const FIXED_INSERT_E2 = new Set(['삽입 경계 판정은 R2 · R4 의 수행 — E2 분리 불가(v2.2 §3)', '삽입 문항 E2 분리 불가'])
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
  /** 구조화된 트랙 전체 결함 — { msg, ids(관련 문항 전부), kind, text }. 청크 단위 실행기는 문자열을 역해석하지 않고 이것을 쓴다(T-0124 P1-01 · P1-02) */
  function reasonsDetail(allRows) {
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
        errs.push({ ids: [r.item_id], kind: '허위 direct 단일', text: '', msg: `${r.item_id}: primary_reason 이 「direct 단일」 인데 direct 링크 ${directs.length}개(${directs.join(',') || '없음'}) · primary ${r.primary_task} — 허위 단일 표지` })
      }
      const s = skeleton(k)
      if (s.length >= 6) skel.set(s, [...(skel.get(s) ?? []), r.item_id])
    }
    for (const [k, ids] of exact) if (ids.length >= 2) errs.push({ ids, kind: 'primary_reason 완전 반복', text: k.slice(0, 30), msg: `primary_reason 완전 반복 ${ids.length}행(${ids.slice(0, 3).join(',')}): 「${k.slice(0, 30)}」` })
    for (const [s, ids] of skel) if (ids.length >= 3) errs.push({ ids, kind: 'primary_reason 템플릿 반복', text: s.slice(0, 24), msg: `primary_reason 템플릿 반복 ${ids.length}행(${ids.slice(0, 3).join(',')}): 골격 「${s.slice(0, 24)}」` })
    // not_observable why — 문항 id 를 지운 같은 설명이 3문항 이상이면 문항 고유 판정이 아니다(b14 B-01: 44개가 한 틀).
    //   행 비율 기준은 고유 줄을 덧붙이면 우회돼 버렸다(T-0123 RECHECK-P1-01) → 설명 하나하나를 문항 단위로 센다.
    //   예외는 계약 고정 문구의 **정확한 문자열**만(삽입 문항 E2 — v2.2 §3). TASK · 유형만 보는 예외는 아무 설명이나 통과시켰다(RECHECK-P1-02).
    //   b14 부터 적용 — 그 전 배치의 반복(b3 B · b8 A · b9t A · b13 A)은 알려진 결함으로 기록하고 소급 배제하지 않는다(mapping-review §18)
    if (reasonsRequired && BATCH_NO >= 14) {
      const nob = new Map()
      for (const r of allRows) for (const n of r.not_observable ?? []) {
        if (typeof n?.why !== 'string') continue
        const k = norm(n.why.split(r.item_id).join('#'))
        if (n.task_id === 'e.evidence_location' && byId.get(r.item_id)?.type_id === 'R-INSERT' && FIXED_INSERT_E2.has(k)) continue
        nob.set(k, new Set([...(nob.get(k) ?? []), r.item_id]))
      }
      for (const [k, ids] of nob) if (ids.size >= 3) errs.push({ ids: [...ids], kind: 'not_observable why 틀 반복', text: k.slice(0, 30), msg: `not_observable why 틀 반복 ${ids.size}문항(${[...ids].slice(0, 3).join(',')}): 「${k.slice(0, 30)}」` })
    }
    return errs
  }
  const reasons = (allRows) => reasonsDetail(allRows).map((e) => e.msg)
  return { row, chunk, reasons, reasonsDetail, byId }
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
    // 청크 소유권(T-0125 RECHECK-P1-01): 행 문항이 그 청크 입력에 없으면 배제 — checkChunk 와 같은 결함 집합
    const owned = chunkItems(dir, track, k + 1)
    for (const row of rows) {
      if (owned && !owned.has(row.item_id)) { errors.push(`${track} ${row.item_id}: ${path.basename(f)} 의 문항이 아니다`); continue }
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

/**
 * 한 청크만 검사(분석자용 `validate A NN` · T-0124) — 문자열을 역해석하지 않고 직접 센다.
 *   이 청크: 출력 파일 · 문항 누락 · 청크 반복 검사 · 행 검사 → 항상 이 청크 결함.
 *   트랙 전체 반복(reasonsDetail): 관련 문항 **전부** 중 이 청크 문항이 하나라도 있으면 이 청크 결함(다른 청크 문항 번호는 내보내지 않음),
 *   없으면 trackExcluded 상태로만 알린다(내용 없음 · 이 청크 결함에 안 섞임 — 이 청크 누락은 위에서 이미 셌다).
 */
/** 청크 입력의 문항 집합 — 입력 파일이 없으면(옛 배치 · 사전 등록 경로) null 로 검사를 건너뛴다 */
function chunkItems(dir, track, k) {
  const p = path.join(dir, `chunk-${track}-${String(k).padStart(2, '0')}.json`)
  return fs.existsSync(p) ? new Set((JSON.parse(fs.readFileSync(p, 'utf8')).items ?? []).map((r) => r.item_id)) : null
}

/** 문항 번호 꼴(2021#18 · M2306#22 · 2014A#20) — 청크 출력에서 이 청크 밖 번호를 가린다(T-0125 RECHECK-P1-02: 자유 서술 안의 다른 청크 id 노출) */
const ITEM_ID = /\b(?:M?\d{4}[AB]?)#\d{1,2}\b/g

export function checkChunk(dir, track, nn, nChunks, V) {
  const own = JSON.parse(fs.readFileSync(path.join(dir, `chunk-${track}-${nn}.json`), 'utf8')).items.map((r) => r.item_id)
  const ownSet = new Set(own)
  const mine = []
  const f = path.join(dir, `chunk-${track}-${nn}.out.json`)
  const rows = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).rows ?? [] : null
  if (!rows) mine.push(`${path.basename(f)} 없음`)
  else {
    const got = new Set(rows.map((r) => r.item_id))
    for (const id of own) if (!got.has(id)) mine.push(`${id} 출력 없음`)
    for (const r of rows) if (!ownSet.has(r.item_id)) mine.push(`${r.item_id} 이 청크 문항이 아니다`)
    const ce = V.chunk(rows)
    if (ce.length) mine.push(...ce.map((x) => `청크: ${x}`))
    else for (const r of rows.filter((x) => ownSet.has(x.item_id))) mine.push(...V.row(r).map((x) => `${r.item_id}: ${x}`))
  }
  const all = []
  for (let k = 0; k < nChunks; k++) {
    const g = path.join(dir, `chunk-${track}-${String(k + 1).padStart(2, '0')}.out.json`)
    if (fs.existsSync(g)) all.push(...(JSON.parse(fs.readFileSync(g, 'utf8')).rows ?? []))
  }
  let trackExcluded = false
  for (const e of V.reasonsDetail(all)) {
    const hit = e.ids.filter((id) => ownSet.has(id))
    if (hit.length) mine.push(`트랙 ${e.kind}(이 청크 문항 ${hit.join(',')} · 전체 ${e.ids.length}문항)${e.text ? `: 「${e.text}」` : ''}`)
    else trackExcluded = true
  }
  const masked = mine.map((e) => e.replace(ITEM_ID, (id) => (ownSet.has(id) ? id : '(다른 문항)')))
  return { own, mine: masked, trackExcluded }
}
