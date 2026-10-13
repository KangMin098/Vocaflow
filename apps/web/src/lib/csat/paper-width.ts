// apps/web/src/lib/csat/paper-width.ts
//
// **기출 원문 열 폭 — 선호 폭과 표시 폭을 가른다.** (기출 탐구 작업공간 W1)
//
// 학습자가 고른 폭(선호)은 기기에 남기고, 화면에 보이는 폭(표시)은 지금 본문 폭에서 메인 프레임이 최소 폭을 지킬 만큼만이다.
//   좁아지면 표시만 줄이고 선호는 덮어쓰지 않는다 → 다시 넓어지면 선호로 돌아간다. 오래된 큰 저장 값도 같은 제한으로 안전하게.
// 메인 최소 폭 = 하단 도크 네 요소(제목 한 줄 + 아이콘 조작 영역 44×2 + 안쪽 여백) + 요소 간격 + 프레임 바깥 여백(측정 명세 spec.json).

export const PAPER_MIN = 256
/** 메인 작업 프레임이 남겨야 할 최소 폭(px) — 도크 제목이 잘리지 않고 아이콘 조작 영역이 겹치지 않는 폭 */
export const MAIN_MIN = 712

/** 기본 폭 — 1280 에서 약 304~320, 1440 에서 약 344~360(승인 목표). 저장된 선호가 있으면 그것이 먼저다 */
export function defaultPaperWidth(viewport: number): number {
  return Math.round(Math.min(360, Math.max(304, viewport * 0.2445)))
}

/** 이 본문 폭에서 원문 열이 가질 수 있는 최대 폭 */
export function maxPaperWidth(bodyWidth: number): number {
  return Math.max(PAPER_MIN, Math.min(bodyWidth - MAIN_MIN, Math.round(bodyWidth * 0.7)))
}

/** 표시 폭 — 선호를 지금 본문 폭의 범위로 자른다 */
export function shownPaperWidth(preferred: number, bodyWidth: number): number {
  return Math.round(Math.min(maxPaperWidth(bodyWidth), Math.max(PAPER_MIN, preferred)))
}
