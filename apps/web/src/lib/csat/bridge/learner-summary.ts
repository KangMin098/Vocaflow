// apps/web/src/lib/csat/bridge/learner-summary.ts
//
// 학습지도 공유 화면에 넘길 「기출분석 한 건」 요약 계약(순수). 학습자가 지도에서 확인할 여섯 질문에 답한다:
//   왜 이 기출인가 · 어떤 판단 능력인가 · 목표에서의 역할 · 지금 받은 도움 · 이해한 것과 아직 미확인 · 다음 실제 학습.
//   다음 학습은 제안일 뿐 강제하지 않는다(optional). 유효 평가 없이 「해소」 · 「목표 달성」 문장을 만들지 않는다.

import { meaningOfExposure, type ActivityMeaning } from './activity-meaning'
import type { Entry } from './entry'
import { skillClaimOf, type EvidenceFeed, type SkillClaim } from './evidence-feed'
import type { ExposureRow } from './exposure-consumer'

export interface LearnerSummary {
  item: string
  why: string
  skills: string[]
  goalRole: string
  help: { observed: ActivityMeaning[]; external: 'UNKNOWN' }
  understood: { claim: SkillClaim; text: string }[]
  unconfirmed: string[]
  next: { kind: 'independent_check' | 'more_analysis' | 'wait_for_material'; text: string; optional: true }
  learningEffect: 'NOT_EVALUATED'
}

const CLAIM_TEXT: Record<SkillClaim, string> = {
  repeated_independent_success: '서로 다른 글에서 도움 없이 거듭 맞혔어요(이 화면이 관측한 범위 안). 숙달 여부는 지도가 판단해요.',
  single_independent_success: '한 글에서 도움 없이 맞혔어요. 다른 글에서도 되는지는 아직 몰라요.',
  independent_but_incorrect: '도움 없이 풀어 봤지만 아직 맞히지 못했어요.',
  no_valid_evidence: '아직 혼자 판단한 기록이 없어요 — 분석을 본 것만으로는 이해를 확인할 수 없어요.',
}

export function learnerSummary(entry: Entry, exposures: readonly ExposureRow[] | null, feed: EvidenceFeed, hasUnseenCheck: boolean | null): LearnerSummary {
  const r = entry.rationale
  const why = `${r.why.need}${r.why.confirmed ? '' : '(근거 부족 — 약점으로 확정하지 않았어요)'} · ${r.why.basis === 'attempted_check_item' ? '이미 풀어 본 확인 문항이라 해설을 봐도 확인 기록을 해치지 않아요' : '연구에서 이 판단 능력의 사례로 합의된 문항이에요(사람 검수 전)'}`
  const goalRole = r.goalRole.status === 'linked' ? `목표 시험에서 이 능력이 걸린 문항 ${r.goalRole.items}개 · 회당 ${r.goalRole.pointsPerExam}점 — 점수 상승을 약속하지는 않아요` : r.goalRole.status === 'goal_not_set' ? '목표를 정하지 않아 목표에서의 역할은 계산하지 않았어요' : '목표와의 연결을 확인하지 못했어요'
  const observed = exposures === null ? [] : exposures.filter((e) => e.itemRef === entry.item).map((e) => meaningOfExposure(e.source))
  const understood = r.skills.map((s) => { const c = skillClaimOf(feed, s.id); return { claim: c.claim, text: `${s.label}: ${CLAIM_TEXT[c.claim]}` } })
  const unconfirmed = [
    ...(exposures === null ? ['받은 도움 기록을 읽지 못했어요 — 도움 여부는 미확인이에요'] : []),
    ...(feed.held.length ? [`판단 보류된 수행 ${feed.held.length}건 — 혼자 풀었는지 확인할 수 없어요`] : []),
    '다른 날에도 유지되는지(지연 확인)는 아직 측정하지 않아요',
  ]
  const independentOk = understood.some((u) => u.claim === 'single_independent_success' || u.claim === 'repeated_independent_success')
  const next: LearnerSummary['next'] = hasUnseenCheck
    ? { kind: 'independent_check', text: independentOk ? '다른 글에서 한 번 더 혼자 판단해 볼 수 있어요' : '아직 안 본 확인 문항으로 혼자 판단해 볼 수 있어요', optional: true }
    : hasUnseenCheck === false
      ? { kind: 'wait_for_material', text: '혼자 확인할 새 문항이 아직 없어요 — 자료가 준비되면 알려 드려요', optional: true }
      : { kind: 'more_analysis', text: '확인 문항 상태를 읽지 못했어요 — 분석을 더 볼 수 있어요', optional: true }
  return { item: entry.item, why, skills: r.skills.map((s) => s.label), goalRole, help: { observed, external: 'UNKNOWN' }, understood, unconfirmed, next, learningEffect: 'NOT_EVALUATED' }
}
