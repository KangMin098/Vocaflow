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
    ...(r.round ? { round: r.round } : {}),
    by: 'chunk-llm',
  }
}
