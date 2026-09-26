// apps/web/src/lib/csat/review-defects-model.ts
//
// **⑦ 검수 결함의 순수 모델** — 타입 · 라벨 · 「아직 안 읽음」 상수.
//
// 서버 조회는 `review-defects.ts` 가 갖는다. 그 파일은 `server-only` 를 import 하므로
// 화면(`'use client'`)이 거기서 타입 하나라도 가져오면 **빌드가 깨진다**
// (실측 2026-09-23: ⑦ 검수 화면이 500 — "You're importing a component that needs server-only").
// 이 저장소는 같은 갈래를 이미 여러 번 냈다 — `factory-model` / `factory.ts`,
// `factory-lab-model` / `factory-views`. 여기도 같은 규칙을 따른다.

/** 교재 문항 검수의 세 눈. `csat_item_reviews.persona` 와 같은 값이다. */
export const PERSONA_KO: Record<string, string> = {
  setter: '출제자',
  analyst: '오답분석가',
  tutor: '현장강사',
}

export const VERDICT_KO: Record<string, string> = {
  pass: '통과',
  revise: '수정',
  fail: '반려',
}

export interface ReviewDefect {
  itemId: string
  /** 문항 유형(`csat_dcp_items.type`). 못 찾으면 null — 지어내지 않는다. */
  type: string | null
  /** V레벨. 못 찾으면 null. */
  vLevel: number | null
  persona: string
  verdict: 'revise' | 'fail'
  /** `findings` 의 첫 줄. 비었으면 null 이고 화면이 「사유가 기록되지 않았다」로 적는다. */
  says: string | null
  reviewedAt: string
}

export interface ReviewDefectView {
  /**
   * 조회를 **실제로 했는가**. `false` 면 표를 못 읽은 것이고 「0건」과 다르다.
   */
  available: boolean
  loadError: string | null

  /** 판정이 붙은 문항 수(전 판정 기준). */
  itemsReviewed: number | null
  /** 그중 서로 다른 3인이 **전부 pass** 한 문항 수 — 조판이 요구하는 것. */
  itemsAllPass: number | null
  /** 그중 미해소 `revise`/`fail` 을 단 문항 수. 이것이 막고 있는 수다. */
  itemsBlocked: number | null

  /** 판정 수 — 페르소나 × 판정. 「무엇이 몇 개 걸렸나」. */
  byVerdict: Record<string, number>
  /** 밴드 × 판정 매트릭스. 못 찾은 밴드는 `null` 키로 모은다(0 으로 세지 않는다). */
  matrix: { vLevel: number | null; pass: number; revise: number; fail: number; items: number }[]

  /** 화면에 그리는 앞쪽 몇 건. 정렬: 반려 먼저 · 최신 먼저. */
  rows: ReviewDefect[]
}

/**
 * **아직 안 읽은 상태.** `available: false` 는 「0건」이 아니라 「못 읽었다」다.
 *
 * 화면의 기본값으로도 쓴다 — 호출부가 이 값을 안 넘기면 화면은 「못 잼」을 그린다.
 * 기본값을 빈 결과(0건)로 두면 배선을 빠뜨린 화면이 **거짓 안심**을 그리고, 그것은
 * 이 저장소가 반복해서 겪은 결함이다(`count ?? 0`).
 */
export const UNREAD_REVIEW_DEFECTS: ReviewDefectView = {
  available: false,
  loadError: null,
  itemsReviewed: null,
  itemsAllPass: null,
  itemsBlocked: null,
  byVerdict: {},
  matrix: [],
  rows: [],
}
