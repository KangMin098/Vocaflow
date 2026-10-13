// apps/web/src/lib/csat/home-suggestion.ts
//
// **지도 홈(`/csat`)의 첫 제안 하나 — 기존 상태에서 고르기만 한다.** (v3 M1 · CSAT_LEARNER_UX_V3 §7)
//
// 새 진단 점수 · DB 컬럼 · 인기/정답률/예상 약점 순위를 만들지 않는다. 입력은 이미 있는 것뿐이다:
//   지도 loader 결과(ok · preparing · error) · 문항에서 돌아온 안전한 복귀 문맥 · 기기 기록의 진행 중 세트 ·
//   핵심 학습 지도가 이미 고른 「먼저 확인할 것」(learnerPath().focus).
// 우선순위(UX §7): 오류/권한 → 탐구 복귀 → 진행 중 과제 이어서 → 독립 확인 필요 → 기록만 있음 → 기록 없음.
//   지도 준비 중(테이블 · 시드 전)은 판정이 아니라 「아직 그릴 수 없다」 — 오류와 구별한다.
// 「확인 필요 · 기록 없음 · 기록만」 은 지도의 초점 카드가 그대로 첫 제안이다(홈이 같은 판정을 다시 쓰지 않는다).
// 조회 오류를 기록 0 으로 삼키지 않는다 — map 이 error 면 기록 상태를 추정하지 않는다.

import type { Focus } from './map/learner-path'

export type MapLoadState = 'ok' | 'preparing' | 'error' | 'withheld'
export type HomeSuggestion = 'error' | 'withheld' | 'return' | 'resume' | 'continue_check' | 'continue_plan' | 'goal' | 'check' | 'no_records' | 'records_only' | 'preparing'
/** 지도 초점 + 목표 미설정(지도 초점 카드가 「목표 정하기」 를 먼저 보이는 상태) */
export type HomeFocusKind = Focus['kind'] | 'goal'

export interface HomeSuggestionInput {
  map: MapLoadState
  /** 지도가 ok 일 때 핵심 지도가 고른 초점 */
  focusKind: HomeFocusKind | null
  /** 문항에서 「학습 지도로」 로 돌아왔다(검증된 문항 slug 가 있을 때만 true) */
  returned: boolean
  /** 기기 기록의 진행 중 세트 — 아직 못 읽었으면 null(이어서 판정을 미룬다) */
  activeSet: boolean | null
  /** 지도에서 하던 일(lib/csat/map/home-progress) — 확인 중 과제 · 계획량에 못 미친 저장 계획. 지도가 ok 일 때만 의미 */
  mapProgress?: { check: boolean; plan: boolean } | null
}

/** 핵심 지도 초점 → 홈 제안 종류. 초점 카드가 행동을 맡는다 */
export function focusSuggestion(kind: HomeFocusKind | null): HomeSuggestion {
  switch (kind) {
    case 'goal':
      return 'goal'
    case 'step':
    case 'distinguish':
    case 'direct':
      return 'check'
    case 'record':
      return 'no_records'
    case 'more':
    case 'pending':
    case 'none':
      return 'records_only'
    default:
      return 'preparing'
  }
}

export function pickHomeSuggestion(i: HomeSuggestionInput): HomeSuggestion {
  if (i.map === 'error') return 'error'
  // 보류 시험 기록이 있어 관찰값을 싣지 않았다 — 권한 · 보류 안내(기록 없음으로 말하지 않는다)
  if (i.map === 'withheld') return 'withheld'
  if (i.returned) return 'return'
  if (i.activeSet) return 'resume'
  // 지도에서 하던 일 — 확인을 시작한 과제가 저장 계획보다 먼저(확인 판정이 계획을 바꾼다)
  if (i.map === 'ok' && i.mapProgress?.check) return 'continue_check'
  if (i.map === 'ok' && i.mapProgress?.plan) return 'continue_plan'
  if (i.map === 'preparing') return 'preparing'
  return focusSuggestion(i.focusKind)
}

/** 홈의 복귀 문맥 — `?from=item&item=<slug>`. slug 는 문항 slug 형식만(자유 문자열 · 외부 주소를 받지 않는다) */
export function parseHomeReturn(from: string | undefined, item: string | undefined): string | null {
  if (from !== 'item' || !item) return null
  // 회차 id 는 영숫자뿐(`2026` · `2014A` · `M2309` · `H2603G3`), 번호는 숫자 — toItemSlug 형식
  return /^[0-9A-Z]{4,12}-[0-9]{1,2}$/.test(item) ? item : null
}

/** 지도 과제 키(복귀 문맥) — 영숫자 · 하이픈 · 밑줄 · 점 · 콜론만, 80자 이하. 자유 문자열 · 주소를 받지 않는다 */
export function parseHomeTask(task: string | undefined): string | null {
  return task && /^[A-Za-z0-9_.:-]{1,80}$/.test(task) ? task : null
}
