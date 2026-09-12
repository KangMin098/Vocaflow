// apps/web/src/lib/textbook/shelf-scale.ts
//
// 매대의 **타이포 스케일 정본** — 여기 없는 크기는 매대에 쓰지 않는다.
//
// ── 왜 상수 파일까지 만들었나 (실측 2026-09-01) ──────────────────────
// 실제 브라우저로 재 봤더니 이 화면 하나가 서로 다른 font-size 를 **14종** 쓰고 있었다
// (앱 공통 헤더가 보태는 것은 17px 하나뿐 — 나머지 전부 매대가 만든 것이다).
// 그중 9px·9.5px·10px·10.5px·11px·11.5px·12px·12.5px — **9~12.5px 사이에만 여덟 종**이었다.
// 0.5px 차이는 위계를 만들지 못한다. 만들지 못하는 위계를 여덟 겹 쌓으면 남는 것은
// "전부 작은 회색 글씨" 뿐이고, 그게 이 화면이 얇아 보인 진짜 이유다.
// (상업 기준선 NE능률은 같은 자로 11종. 우리가 더 난잡했다.)
//
// ⚠️ 이 표는 **장식이 아니라 계약**이다. `__tests__/shelf-scale.test.ts` 가 매대 컴포넌트의
//    `text-[…px]` 를 전부 긁어 이 표에 없는 값이 있으면 실패시킨다. 새 크기가 정말 필요하면
//    표를 먼저 고치고 — 그때 "왜 여섯 번째 크기가 필요한가" 를 한 번은 생각하게 된다.
//
// ⚠️ 스케일에 없는 크기를 쓰고 싶어지면 대개 **크기가 아니라 다른 축**이 필요한 것이다.
//    굵기(font-weight) · 색(--t1/--t2) · 자간 · 여백으로 먼저 풀 것.

/**
 * 허용 크기(px). 배수 간격이 아니라 **역할**로 고른다 —
 * 역할이 없으면 크기도 없다.
 */
export const SHELF_TYPE_SCALE = {
  /** 라벨·눈금 — 대문자 mono 아이브로우, 축 이름, 표지의 'STEP' */
  micro: 10,
  /** 수치·메타 — 학령·V레벨·문항 수처럼 훑는 값 */
  meta: 11,
  /** 보조 본문 — 태그라인, 매대 팻말, 도움 문구 */
  small: 12,
  /** 본문 — 읽으라고 내놓는 글 */
  body: 13,
  /** 낱권 제목 (앱 공통 헤더도 이 크기를 쓴다 — 일부러 맞췄다) */
  title: 17,
  /** 매대 제목 (h2) */
  display: 22,
  /** 표지의 계단 번호 — 숫자 하나뿐이라 크기가 곧 형태다 */
  numeral: 26,
} as const

export type ShelfTypeRole = keyof typeof SHELF_TYPE_SCALE

/** 검사용 집합. 테스트와 화면이 **같은 목록**을 본다. */
export const SHELF_TYPE_SIZES: readonly number[] = Object.values(SHELF_TYPE_SCALE)

/** `text-[17px]` 처럼 쓰기 위한 Tailwind 임의값 클래스. */
export function textSize(role: ShelfTypeRole): string {
  return `text-[${SHELF_TYPE_SCALE[role]}px]`
}
