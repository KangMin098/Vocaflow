// scripts/csat/checklist-exp/decide.mjs
//
// **실험 2 — 체크리스트 답 → 보관 판정 규칙.** 판정자는 예/아니요만 답하고, keep/hold/discard 는 여기서 계산한다.
// 질문 정의: docs/source-check/checklist-draft.md (정본 기준은 criteria.md v6 — 이 규칙은 실험용 v7 후보다).
// 기준을 개정하면 이 함수만 바뀌고 저장된 답으로 전량을 다시 계산한다 — 재판정이 필요 없다는 것이 이 실험의 가설이다.

export const QUESTIONS = [
  'blocked', 'needsVisual', 'truncated', 'listOnly', 'linked', 'mainPoint', 'narrative', 'notice',
  'detachable', 'standsAlone', 'vocabAdjustable', 'factsMany', 'stereotypeCore', 'gap',
]

/** 답이 모두 있고 형이 맞는지. 빠진 키 목록을 돌려준다(빈 배열이면 온전). */
export function missingAnswers(a) {
  if (!a || typeof a !== 'object') return [...QUESTIONS]
  return QUESTIONS.filter((k) => (k === 'blocked' ? !(a[k] === null || typeof a[k] === 'string') : typeof a[k] !== 'boolean'))
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
  if (!a.linked) return { retention: 'discard', rule: 'notLinked' }
  if (!(a.detachable || a.standsAlone || a.vocabAdjustable)) return { retention: 'discard', rule: 'noProcessing' }
  if (a.gap) return { retention: 'hold', rule: 'gap', hold_reason: 'criteria-gap' }
  return { retention: 'keep', rule: 'keep' }
}
