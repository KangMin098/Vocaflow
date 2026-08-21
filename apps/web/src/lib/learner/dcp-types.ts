// apps/web/src/lib/learner/dcp-types.ts
//
// **DCP 문항 유형을 두 갈래로 가른다 — 학습자가 푸는 것과 교재에만 쓰는 것.**
//
// ── 왜 이 파일이 있는가 (2026-08-21) ─────────────────────────────────
// `csat_dcp_items` 는 원래 `order`·`insert` 둘뿐이었고, 그래서 "저장된 것 = 학습자가
// 푸는 것" 이 참이었다. 교재용 유형(`irrelevant`·`word_order`·`vocab_choice`)을 같은
// 테이블에 넣으면서 그 등식이 깨졌는데, `prescribe_today` 는 그대로 유형을 안 가리고
// 5문항을 뽑았다. 실측 **발행 카탈로그 안 42.5%(661/1,556)** 가 화면이 못 그리는 문항으로
// 나갔고, 클라이언트 매퍼가 그것을 `null` 로 버려 학습자는 조용히 문항을 잃었다.
//
// 마이그레이션 `20260821093000` 이 처방에 **허용 목록**을 넣어 막았다. 허용 목록이라
// **새 유형은 기본이 제외**다 — 다음에 유형이 늘어도 저절로 새지 않는다.
//
// 이 파일이 지키는 것은 그다음 위험이다: **유형을 저장해 놓고 어느 갈래인지 정하지 않는 것.**
// 회귀(`__tests__/dcp-playable-types.integration.test.ts`)가 DB 에 실제로 있는 유형을
// 읽어 두 목록 어디에도 없으면 실패한다. 그러면 사람이 분류를 정해야 한다.

/**
 * 학습자가 화면에서 푸는 유형.
 *
 * 여기 넣으려면 **세 곳이 함께** 준비돼야 한다:
 *   ① `dcp-actions.ts` 의 `parseItem` 이 payload 를 읽을 수 있어야 하고
 *   ② `DcpPlayer` 가 그릴 수 있어야 하고
 *   ③ DB 의 `grade_dcp_item` 이 채점할 수 있어야 한다 (모르면 `Unknown type` 예외)
 * 그리고 `prescribe_today` 의 허용 목록에도 더해야 처방이 뽑는다.
 */
export const PLAYABLE_DCP_TYPES = ['order', 'insert'] as const

/**
 * 교재(인쇄물)에만 쓰는 유형 — 학습자 화면에는 나가지 않는다.
 *
 * 지우면 안 된다. 교재 조판이 이 재고를 쓴다.
 */
export const TEXTBOOK_ONLY_DCP_TYPES = ['irrelevant', 'word_order', 'vocab_choice'] as const

export type PlayableDcpType = (typeof PLAYABLE_DCP_TYPES)[number]
export type TextbookOnlyDcpType = (typeof TEXTBOOK_ONLY_DCP_TYPES)[number]

/** 학습자가 풀 수 있는 유형인가. */
export function isPlayableDcpType(type: unknown): type is PlayableDcpType {
  return typeof type === 'string' && (PLAYABLE_DCP_TYPES as readonly string[]).includes(type)
}

/** 두 갈래 어디에도 없는 유형 — 분류가 안 된 것이다. */
export function isClassifiedDcpType(type: string): boolean {
  return (
    (PLAYABLE_DCP_TYPES as readonly string[]).includes(type) ||
    (TEXTBOOK_ONLY_DCP_TYPES as readonly string[]).includes(type)
  )
}
