// apps/web/src/lib/knowledge/find-feedback.ts
// 계약 C — FIND 결과 → 진단 환류(순수 · 2026-10-09 PROPOSED · docs/csat-learner/MAP_CONTRACTS_ABC.md §C).
// 정본 VNEXT §10 · §14: 지도 상태(basis · 단계 관찰)와 처방 개방을 바꾸는 것은 verified_diagnosis 뿐이다.
// 그래서 이 함수는 basis 를 바꾸지 않고 「그 단계의 지금 할 일 순서 · 다음 행동 · 우선 확인 힌트」만 낸다.
// confirmed_need(FIND · 문항 2) ≠ cause_confirmed(EED §9 · 8조건) ≠ verified_diagnosis — 이름을 섞지 않는다.
import type { FindOutcome, FindState } from './find-outcome'

export type FindNextAction =
  /** 확인 문항을 하나 더(in_progress · mixed · untried) */
  | 'confirm_more'
  /** 확인된 학습 요구 → 다른 지문으로 한 번 더 확인(FIND 확장 · 결정 D-7(c)). 처방(TRANSFER)은 verified 뒤에만 열린다 */
  | 'recheck_other_passage'
  /** 이 단계는 지금 넘어가도 된다 — 다음 단계 FIND */
  | 'next_step'
  /** 확인 문항 자체가 모자라다 — 준비 중 */
  | 'await_items'

export interface FindFeedback {
  state: FindState
  /** 단계 시트 「지금 할 일」 정렬 가중치 — 클수록 위(확인된 학습 요구가 맨 위, 필요 없음은 맨 아래) */
  order: number
  nextAction: FindNextAction
  /** 우선 확인 후보에 넣을지 — **결정 대기(계약 D-2)** 라 지금은 항상 false. cause_confirmed 칸과 섞지 않는다 */
  prioritySignal: false
  /** 지도 상태 · basis 를 바꾸는가 — 계약상 항상 false(verified 경로가 승인되기 전) */
  changesDiagnosisBasis: false
}

const ORDER: Record<FindState, number> = { confirmed_need: 3, in_progress: 2, mixed: 2, untried: 1, not_needed: 0 }

export function findFeedback(o: Pick<FindOutcome, 'state' | 'needsMoreItems'> & { targets?: number }): FindFeedback {
  const noTargets = o.targets === 0
  const nextAction: FindNextAction =
    noTargets ? 'await_items'
      : o.state === 'confirmed_need' ? 'recheck_other_passage'
        : o.state === 'not_needed' ? 'next_step'
          : o.needsMoreItems ? 'await_items'
            : 'confirm_more'
  return { state: o.state, order: ORDER[o.state], nextAction, prioritySignal: false, changesDiagnosisBasis: false }
}

/** 단계 시트의 FIND 과제 정렬 — 확인된 학습 요구 먼저, 같으면 원래 순서 유지(안정 정렬) */
export function orderFindTasks<T>(tasks: readonly T[], feedbackOf: (t: T) => FindFeedback | null): T[] {
  return tasks
    .map((t, i) => ({ t, i, o: feedbackOf(t)?.order ?? 1 }))
    .sort((a, b) => b.o - a.o || a.i - b.i)
    .map((x) => x.t)
}
