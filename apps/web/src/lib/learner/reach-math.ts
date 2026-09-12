// apps/web/src/lib/learner/reach-math.ts
//
// **사정권의 순수 계산부** — 레벨을 카탈로그 권수로 번역한다. 서버 코드 없음.
//
// ⚠️ 이 파일에 `server-only` 를 넣지 말 것. 셸 패널(클라이언트 컴포넌트)이 `V_LEVEL_MAX` 를
//    읽는다. 처음에는 이 상수가 `library-reach.ts`(server-only)에 있었고, 그 순간
//    **모듈 그래프가 깨져 `/login` 을 포함한 모든 라우트가 500** 이 됐다 —
//    `today-status.ts` 머리 주석이 경고하던 바로 그 실패를 그대로 반복한 것이다.
//    조회는 `library-reach.ts` 가 맡고, 값과 계산은 여기 있다.

/** V-Level 축의 상한 — 4축 VRL 정의(0~11). */
export const V_LEVEL_MAX = 11

export interface LevelReach {
  /** 진단 전이면 null */
  vLevel: number | null
  /** 지금 읽을 수 있는 책 (book_v_level <= vLevel + 1) */
  open: number
  /** 한 계단 올라가면 **추가로** 열리는 책 */
  unlockNext: number
  /** 발행된 전체 도서 */
  total: number
}

/** 누적 — `level` 이하 레벨의 책 수. */
export function cumulative(byLevel: readonly number[], level: number): number {
  let sum = 0
  for (let i = 0; i <= Math.min(level, byLevel.length - 1); i++) sum += byLevel[i]
  return sum
}

/**
 * 사정권 계산.
 *
 * i+1 규칙: 읽을 수 있는 책 = `book_v_level <= vLevel + 1`. Krashen 의 i+1 을 그대로 쓴다 —
 * /library 추천이 이미 같은 기준으로 말하고 있어("i+1 수준에 맞춘 도서") 두 표면이 다른
 * 정의를 쓰면 학습자가 세는 수가 달라진다.
 *
 * 진단 전(`vLevel === null`)이면 `open` 은 0이다. **0을 "없다" 로 읽지 말 것** —
 * 화면은 이때 `total`(전체 카탈로그)을 약속으로 쓴다: "진단하면 이 중에서 골라 드려요".
 */
export function computeReach(
  byLevel: readonly number[],
  total: number,
  vLevel: number | null,
): LevelReach {
  if (vLevel === null || vLevel <= 0) return { vLevel: null, open: 0, unlockNext: 0, total }
  const open = cumulative(byLevel, vLevel + 1)
  const next = cumulative(byLevel, vLevel + 2)
  return { vLevel, open, unlockNext: Math.max(0, next - open), total }
}
