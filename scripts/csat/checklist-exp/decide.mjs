// scripts/csat/checklist-exp/decide.mjs
//
// **실험 2 — 체크리스트 답 → 보관 판정 규칙.** 판정자는 질문에만 답하고, keep/hold/discard 는 여기서 계산한다.
// 질문 정의: docs/source-check/checklist-draft.md (정본 기준은 criteria.md v6 — 이 규칙은 실험용 v7 후보다).
// 기준을 개정하면 이 함수만 바뀌고 저장된 답으로 전량을 다시 계산한다 — 재판정이 필요 없다는 것이 이 실험의 가설이다.
//
// 판 두 벌을 함께 둔다 — v1 답(첫 측정 200편)을 v1 규칙으로 다시 채점할 수 있어야 비교가 선다.
//   v1: `linked` 예/아니요 → 경계선 단신 22건이 true 로 접혀 폐기 재현율 48% (docs/reports/checklist-exp-20260926.md)
//   v2: `linkage` 세 값 + `strippedRemains` — 판정자가 note 에만 적던 「연결이 가늘다」를 답으로 받는다

export const QUESTIONS = [
  'blocked', 'needsVisual', 'truncated', 'listOnly', 'linked', 'mainPoint', 'narrative', 'notice',
  'detachable', 'standsAlone', 'vocabAdjustable', 'factsMany', 'stereotypeCore', 'gap',
]
export const QUESTIONS_V2 = [...QUESTIONS.filter((k) => k !== 'linked'), 'linkage', 'strippedRemains']
export const LINKAGE = ['strong', 'thin', 'none']

/** 답의 판 — `linkage` 가 있으면 v2. */
export const versionOf = (a) => (a && typeof a === 'object' && 'linkage' in a ? 2 : 1)

/** 답이 모두 있고 형이 맞는지. 빠진 키 목록을 돌려준다(빈 배열이면 온전). */
export function missingAnswers(a) {
  const keys = versionOf(a) === 2 ? QUESTIONS_V2 : QUESTIONS
  if (!a || typeof a !== 'object') return [...keys]
  return keys.filter((k) => {
    if (k === 'blocked') return !(a[k] === null || typeof a[k] === 'string')
    if (k === 'linkage') return !LINKAGE.includes(a[k])
    return typeof a[k] !== 'boolean'
  })
}

/**
 * @returns {{ retention: 'keep'|'hold'|'discard', rule: string, hold_reason?: string }}
 * `rule` 은 결정을 낸 규칙 — 오판이 나오면 어느 질문이 틀렸는지 거슬러 올라가는 열쇠다.
 */
export function decide(a) {
  if (a.blocked) return { retention: 'discard', rule: `blocked:${a.blocked}` }
  if (a.stereotypeCore) return { retention: 'discard', rule: 'stereotypeCore' }
  if (a.needsVisual) return { retention: 'discard', rule: 'needsVisual' }
  if (a.truncated) return { retention: 'hold', rule: 'truncated', hold_reason: 'incomplete-source' }
  const prose = a.mainPoint || a.narrative || a.notice
  if (!(prose || a.factsMany)) return { retention: 'discard', rule: 'noSlot' }
  if (a.listOnly && !prose) return { retention: 'discard', rule: 'listOnly' }

  if (versionOf(a) === 2) {
    if (a.linkage === 'none') return { retention: 'discard', rule: 'linkNone' }
    // criteria §3-2 「칸 하나만 수치 나열」 · v6 짧은 사실 단신 — 연결이 흐름을 이루지 못하고, 수치·이름을 걷으면 남는 것이 없다
    if (a.linkage !== 'strong' && !a.strippedRemains) return { retention: 'discard', rule: 'thinAndStripped' }
  } else if (!a.linked) {
    return { retention: 'discard', rule: 'notLinked' }
  }

  if (!(a.detachable || a.standsAlone || a.vocabAdjustable)) return { retention: 'discard', rule: 'noProcessing' }
  if (versionOf(a) === 2 && a.linkage === 'thin') return { retention: 'hold', rule: 'linkThin', hold_reason: 'borderline' }
  if (a.gap) return { retention: 'hold', rule: 'gap', hold_reason: 'criteria-gap' }
  return { retention: 'keep', rule: 'keep' }
}
