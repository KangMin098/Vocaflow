// scripts/csat/retain-record.mjs
//
// **보관 판정 기록 한 건의 모양 — 적재기와 검사기가 같은 규칙을 쓴다.**
//
// 기준: docs/source-check/criteria.md §3(v1). 보관 판정은 `keep`·`hold`·`discard` 셋이고,
// 쓰임새 칸(연령 × 유형 × 목적 × 난이도 + 플랫폼 속성)과 **샘플 문단 가공 시도**를 반드시 남긴다.
// 규칙을 두 곳(적재기·검사기)에 따로 쓰면 한쪽만 고쳐져 어긋난다 — 이 파일 하나를 부른다.

import {
  RETENTION_VERDICTS, HOLD_REASONS, SLOT_AGES, SLOT_PURPOSES, SLOT_TYPES, SLOT_PLATFORM, SLOT_LEVEL,
  SOURCE_USES, HARMFUL, UNFIT, CRITERIA_VERSION,
} from './gate-rules.mjs'

const BASES = new Set(['full', 'windows'])
export const WINDOW_VERDICTS = new Set(['use', 'narrative', 'reject'])
/** 창 판정 중 전문(C)으로 넘길 것 — 보관이 아닌 것 전부 · 판정자가 올린 것. 폐기는 되돌릴 수 없어 창만으로 정하지 않는다. */
export const needsFullRead = (r) => (r.basis ?? 'full') === 'windows' && (r.retention !== 'keep' || r.escalate === true)

const BLOCKED = new Set([...HARMFUL, ...UNFIT, 'poetry-drama'])
const AXES = { ages: SLOT_AGES, purposes: SLOT_PURPOSES, types: SLOT_TYPES, platform: SLOT_PLATFORM }

/** 칸이 하나라도 있는가 — 연령 · 목적 · 난이도가 있고, 기존 유형 또는 플랫폼 속성이 하나 이상. */
export const hasSlot = (s) =>
  !!s && s.ages?.length > 0 && s.purposes?.length > 0 && s.levels?.length > 0 && (s.types?.length > 0 || s.platform?.length > 0)

/** 문제 목록(빈 배열이면 통과). `at` 은 메시지 앞머리. */
export function retainProblems(r, at = '') {
  const p = []
  if (!RETENTION_VERDICTS.has(r.retention)) p.push(`${at} retention 값이 아니다: ${r.retention}`)
  if (r.criteria_version !== CRITERIA_VERSION) p.push(`${at} criteria_version 이 현행(${CRITERIA_VERSION})이 아니다: ${r.criteria_version}`)
  if (typeof r.genre !== 'string' || !r.genre) p.push(`${at} genre 없음`)
  if (typeof r.why !== 'string' || r.why.trim().length < 12) p.push(`${at} why 가 12자 미만`)
  if (r.retention === 'hold' && !HOLD_REASONS.has(r.hold_reason)) p.push(`${at} hold 인데 hold_reason 이 없거나 모른다: ${r.hold_reason}`)
  if (r.retention !== 'hold' && r.hold_reason !== undefined) p.push(`${at} hold 가 아닌데 hold_reason 이 있다`)
  if (r.retention === 'keep' && BLOCKED.has(r.genre)) p.push(`${at} 모순: keep + 차단 장르 ${r.genre}`)

  const s = r.slots
  if (!s || typeof s !== 'object') p.push(`${at} slots 없음`)
  else {
    for (const [axis, vocab] of Object.entries(AXES)) {
      if (!Array.isArray(s[axis])) { p.push(`${at} slots.${axis} 가 배열이 아니다`); continue }
      const bad = s[axis].filter((x) => !vocab.has(x))
      if (bad.length) p.push(`${at} slots.${axis} 모르는 값: ${bad.join(',')}`)
    }
    if (!Array.isArray(s.levels) || s.levels.some((x) => !SLOT_LEVEL.test(x))) p.push(`${at} slots.levels 는 V0~V11 배열이다`)
    // 채울 칸이 없으면 폐기 — 칸이 있는데 폐기하는 것은 가공이 안 되거나 차단 장르일 때뿐이다.
    if (r.retention === 'keep' && !hasSlot(s)) p.push(`${at} keep 인데 채울 칸이 없다(연령·목적·난이도·유형 중 빈 축)`)
  }

  const pr = r.processing
  if (!pr || typeof pr !== 'object') p.push(`${at} processing 없음 — 샘플 문단 가공 시도를 기록해야 한다`)
  else {
    for (const k of ['detachable', 'standsAlone', 'vocabAdjustable']) if (typeof pr[k] !== 'boolean') p.push(`${at} processing.${k} 가 참·거짓이 아니다`)
    if (typeof pr.sample !== 'string' || pr.sample.trim().split(/\s+/).length < 3) p.push(`${at} processing.sample(시도한 문단 첫 낱말들) 없음`)
    if (typeof pr.note !== 'string' || pr.note.trim().length < 8) p.push(`${at} processing.note 없음`)
    if (r.retention === 'keep' && !(pr.detachable || pr.standsAlone || pr.vocabAdjustable)) p.push(`${at} keep 인데 가공 시도가 하나도 안 됐다`)
  }

  if (r.uses !== undefined) {
    if (!Array.isArray(r.uses) || r.uses.some((u) => !SOURCE_USES.has(u))) p.push(`${at} 모르는 uses: ${JSON.stringify(r.uses)}`)
  }

  // 창 판정(criteria.md §13) — 창만 읽은 판정은 창마다 내용 판정을 남긴다. 창 개수 대조는 검사기가 청크와 한다.
  const basis = r.basis ?? 'full'
  if (!BASES.has(basis)) p.push(`${at} basis 는 full·windows 뿐이다: ${basis}`)
  if (r.escalate !== undefined && typeof r.escalate !== 'boolean') p.push(`${at} escalate 는 참·거짓이다`)
  if (basis === 'windows') {
    const wv = r.window_verdicts
    if (!Array.isArray(wv) || !wv.length) p.push(`${at} 창 판정인데 window_verdicts 가 없다`)
    else wv.forEach((w, i) => {
      if (!WINDOW_VERDICTS.has(w?.verdict)) p.push(`${at} window_verdicts[${i}].verdict 는 use·narrative·reject 다: ${w?.verdict}`)
      if (w?.i !== i) p.push(`${at} window_verdicts[${i}].i 는 창 순번(${i})이다: ${w?.i}`)
      if (typeof w?.genre !== 'string' || !w.genre) p.push(`${at} window_verdicts[${i}].genre 없음`)
      if (w?.verdict !== 'reject' && BLOCKED.has(w?.genre)) p.push(`${at} window_verdicts[${i}] 모순: ${w?.verdict} + 차단 장르 ${w?.genre}`)
      if (!Array.isArray(w?.uses) || w.uses.some((u) => !SOURCE_USES.has(u))) p.push(`${at} window_verdicts[${i}].uses 모르는 값: ${JSON.stringify(w?.uses)}`)
      else if ((w.verdict === 'reject') !== (w.uses.length === 0)) p.push(`${at} window_verdicts[${i}] reject 면 uses 가 비고, 아니면 하나 이상이다`)
    })
    if (r.retention === 'keep' && Array.isArray(wv) && wv.length && wv.every((w) => w?.verdict === 'reject')) p.push(`${at} 모순: keep 인데 쓸 창이 하나도 없다`)
  } else {
    if (r.window_verdicts !== undefined) p.push(`${at} 전문 판정에 window_verdicts 가 있다`)
    if (r.escalate !== undefined) p.push(`${at} 전문 판정에 escalate 가 있다(전문이 마지막 단계다)`)
  }
  return p
}

/** 적재할 `gate.retain` 값 — 시각(`at`)은 적재기가 붙인다. 없는 키는 넣지 않는다(jsonb 비교가 매번 변경으로 보인다). */
export function retainRecord(r) {
  return {
    retention: r.retention,
    ...(r.retention === 'hold' ? { hold_reason: r.hold_reason } : {}),
    genre: r.genre,
    why: r.why,
    slots: { ages: r.slots.ages, purposes: r.slots.purposes, types: r.slots.types, levels: r.slots.levels, platform: r.slots.platform },
    processing: { detachable: r.processing.detachable, standsAlone: r.processing.standsAlone, vocabAdjustable: r.processing.vocabAdjustable, sample: r.processing.sample, note: r.processing.note },
    ...(r.uses ? { uses: r.uses } : {}),
    criteria_version: r.criteria_version,
    basis: r.basis ?? 'full',
    ...(r.basis === 'windows' ? { window_verdicts: r.window_verdicts.map((w) => ({ i: w.i, verdict: w.verdict, genre: w.genre, uses: w.uses })) } : {}),
    ...(r.round ? { round: r.round } : {}),
    by: 'chunk-llm',
  }
}
