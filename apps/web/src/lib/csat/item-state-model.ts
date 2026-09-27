// apps/web/src/lib/csat/item-state-model.ts
//
// **문항 상태의 순수 모델** — 타입 · 사유 이름 · 「아직 안 읽음」 상수.
//
// 서버 조회는 `item-state.ts` 가 갖는다. 그 파일은 `server-only` 를 import 하므로
// 화면(`'use client'`)이 거기서 타입 하나라도 가져오면 라우트가 통째로 500 이 난다
// (실측 2026-09-23 에 ⑦ 검수에서 한 번 겪었다). 이 저장소의 기존 갈래를 그대로 따른다 —
// `factory-model` / `factory.ts` · `review-defects-model` / `review-defects.ts`.

/** 사유 코드 → 사람이 읽을 이름. 닫힌 열거형이라 화면이 묶을 수 있다. */
export const REASON_KO: Record<string, string> = {
  review_fail: '3인 검수 반려',
  review_revise: '3인 검수 수정 요청',
  no_explanation: '해설 없음',
  off_ladder: '사다리 밖',
  spec_stale: '규격이 바뀌었다',
  source_blocked: '원문이 막혔다',
}

export interface ItemStateView {
  /** 표를 **실제로 읽었는가**. false = 저장소가 없다(0건과 다르다). */
  available: boolean
  error: string | null
  /** 막힌 문항 수. 못 읽었으면 null. */
  blocked: number | null
  /** 사유 코드별 수 — 많은 순. */
  byReason: { code: string; n: number }[]
}

export const UNREAD_ITEM_STATE: ItemStateView = {
  available: false,
  error: null,
  blocked: null,
  byReason: [],
}
