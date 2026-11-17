// apps/web/src/lib/csat/map/v62/maintenance-state.ts
//
// T-0082 — 「지금 확인 통과 + 유지(MAINTAIN)」 표시 투영. 새 판정이 아니다: V4 TaskPlan 의 need · achievement 를 읽기만 한다.
//   지금 운영 확인(CHECK)은 통과했고, 다른 날 유지 확인은 승인된 간격 · 도구가 없어 아직 열 수 없다(NOT_ESTABLISHED).
//   이 상태를 「앞 단계 미완료」 · 「자료만 채우면 지금 유지 확인 가능」 · 숙달 · 목표 달성으로 보이지 않는다.
//   같은 회차는 해소 뒤 시도로 다시 판정되지 않으므로(skill-diagnosis) 남은 혼자 확인 링크를 다음 필수 풀이로 올리지 않는다.

import type { TaskPlan } from '../v4/plan'

export function maintainPassed(p: Pick<TaskPlan, 'need' | 'achievement'> | null | undefined): boolean {
  return !!p && p.need === 'MAINTAIN' && p.achievement === 'resolved'
}

/** 화면 공용 문구(상단 · 요약 · TASK 자세히 · Workspace 목록이 같은 말을 쓴다) */
export const MAINTAIN_PASSED_LABEL = '지금 확인은 통과했어요 — 다른 날 유지 확인은 기준(간격 · 도구)이 아직 정해지지 않아 열지 않았어요. 숙달 · 목표 달성 판정이 아니에요.'
