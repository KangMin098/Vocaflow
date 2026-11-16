// apps/web/src/lib/csat/bridge/activity-meaning.ts
//
// H3 — 기출분석 활동의 교육적 의미(순수). 「봤다 · 확인했다」와 「혼자 판단했다」를 섞지 않는다.
//   정답 열람 · 강의 시청 = 수행이 아니다(도움 노출) · 해설 뒤 확인 = 도움 받은 수행 · 독립 수행 = 관측 범위 안 첫 독립 시도 ·
//   숙달 신호 = 같은 사고 기능의 서로 다른 문항(다른 지문)에서 독립 수행이 거듭 관찰된 것. 숙달 판정 자체는 지도 엔진(skillDiagnosis) 몫이다.

import type { ExposureLevel, IndependenceStatus } from './exposure-consumer'

export type ActivityKind = 'answer_viewed' | 'lecture_viewed' | 'post_explanation_check' | 'helped_attempt' | 'independent_attempt' | 'held_attempt' | 'not_evidence'

export interface ActivityMeaning {
  kind: ActivityKind
  /** 원장에 남은 수행인가(제출 · 정오가 있는 시도) */
  performed: boolean
  /** 독립 판단 근거로 지도에 공급할 수 있는가 */
  independent: boolean
  /** 학습자에게 보일 문장 */
  label: string
}

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  answer_viewed: '정답을 확인했어요 — 혼자 푼 기록은 아니에요',
  lecture_viewed: '해설 강의를 봤어요 — 이해를 도운 자료이고, 혼자 판단한 기록은 아니에요',
  post_explanation_check: '해설을 본 뒤 다시 풀었어요 — 도움 받은 확인으로 남겨요',
  helped_attempt: '도움을 받으며 풀었어요 — 도움 받은 수행으로 남겨요',
  independent_attempt: '도움 없이 처음 풀었어요 — 독립 판단 기록이에요(이 화면이 관측한 범위 안)',
  held_attempt: '혼자 풀었는지 확인할 수 없어 판단을 보류했어요',
  not_evidence: '연습 · 반복 기록이에요 — 판단 근거로 세지 않아요',
}

const m = (kind: ActivityKind, performed: boolean, independent = false): ActivityMeaning => ({ kind, performed, independent, label: ACTIVITY_LABEL[kind] })

/** 노출 사건(시도 없음) — 정답 열람 · 강의 단서 */
export function meaningOfExposure(source: string): ActivityMeaning {
  return source.startsWith('lecture_') ? m('lecture_viewed', false) : m('answer_viewed', false)
}

/** 시도 하나의 의미 — P6 독립 후보 판정 + 노출 수준(H4) 둘 다 독립일 때만 independent_attempt */
export function meaningOfAttempt(independence: IndependenceStatus | null, level: ExposureLevel): ActivityMeaning {
  if (independence === 'helped' || independence === 'after_exposure' || level === 'X3') return m('post_explanation_check', true)
  if (level === 'X2') return m('helped_attempt', true)
  if (independence === 'not_check_phase' || independence === 'repeat') return m('not_evidence', true)
  if (independence === 'independent_candidate' && (level === 'X0' || level === 'X1')) return m('independent_attempt', true, true)
  return m('held_attempt', true)
}
