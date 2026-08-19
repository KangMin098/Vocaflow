// packages/library-pipeline/src/analyze/declared-level.ts
//
// **발행사가 스스로 밝힌 난이도와 우리 추정이 어긋나는가.**
//
// ── 왜 (실측 2026-08-20) ─────────────────────────────────────────────
// VOA Learning English 는 콘텐츠마다 Level 1/2/3 을 **명시**한다(`VOA_FEEDS.level`).
// 우리 CEFR 추정과 대조했더니 **정확히 역전돼 있었다**:
//
//   피드                      VOA 선언   우리 추정 (편수)          평균어수
//   lets-learn-english        Level 1    A1~A2 1 · B1 7 · B2 5      732
//   american-stories          Level 3    A1~A2 5 · B1 6 · B2 0    1,700
//
// 가장 쉬운 피드가 가장 어렵게, 가장 어려운 피드가 가장 쉽게 나왔다. 실제 글을 보면:
//
//   A2 · 1,766어 · 신뢰도 0.65   'The Tell-Tale Heart' by Edgar Allan Poe
//   A2 · 1,673어 · 신뢰도 0.95   'The Gift of the Magi,' by O. Henry
//   A2 · 1,688어 · 신뢰도 0.95   The Purloined Letter by Edgar Allan Poe
//
// **19세기 미국 문학 각색이 A2 다.** 그것도 신뢰도 0.95 라 아무도 의심하지 않는다.
// A2 로 알고 연 학습자는 못 읽는다.
//
// 원인은 추정이 **어휘 빈도**에 기대기 때문이다. 서사체는 낱말이 흔해서 쉽게 보이지만
// 통사가 복잡하다 — "It is impossible to say how first the idea entered my brain; but
// once conceived, it haunted me day and night." 낱말은 전부 A1~B1 인데 문장은 B2+ 다.
//
// ── 무엇을 하고 무엇을 안 하나 ───────────────────────────────────────
// **덮어쓰지 않는다.** 발행사의 레벨은 프로그램 단위 라벨이고 우리 추정은 이 글의 실측이라,
// 어느 쪽이 옳은지는 글마다 다르다. 대신 **둘이 크게 어긋나면 알린다** — 두 신호가
// 2밴드 이상 벌어진 글은 어느 쪽 값도 그대로 믿을 수 없다는 뜻이다.
// `lexical_noise`·`assessReadingLoad` 와 같은 태도다: 재료를 주고 판단은 사람이 한다.
//
// ⚠️ 추정기를 고치는 것이 근본 해법이지만(통사 복잡도를 신호에 넣기), 그건 별도 작업이다.
//   여기서 급히 바꾸면 이미 매겨진 256편의 레벨이 한꺼번에 흔들린다.

/** CEFR 오름차순 — 밴드 거리 계산의 기준. */
export const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrBand = (typeof CEFR_ORDER)[number]

/**
 * VOA 가 밝힌 Level → 기대 CEFR 밴드.
 *
 * VOA 공개 기준의 어휘 규모에 맞춘 것이다 — Level 1 약 1,500 낱말, Level 2 약 2,500,
 * Level 3 약 3,000 이상. 정밀한 환산이 아니라 **크게 어긋났는지 보는 눈금**이다.
 */
export const DECLARED_LEVEL_CEFR: Record<number, readonly CefrBand[]> = {
  1: ['A1', 'A2'],
  2: ['B1'],
  3: ['B2'],
}

/** 이 정도 벌어지면 두 신호 중 하나는 틀렸다고 본다. */
export const CONTRADICTION_BANDS = 2

export interface LevelCrossCheck {
  /** 발행사가 레벨을 밝히지 않는 소스면 false — 대조 자체가 불가능하다. */
  comparable: boolean
  /** 밴드 거리. 기대 범위 안이면 0. */
  gapBands: number
  contradicts: boolean
  /** 사람이 읽는 한 줄. 모순이 아니면 null. */
  note: string | null
}

/**
 * 발행사 선언 레벨과 우리 추정을 대조한다.
 *
 * 순수 함수다 — 피드 정의를 직접 보지 않고 `declaredLevel` 을 받는다. 그래야 VOA 말고
 * 다른 소스가 레벨을 밝히기 시작해도 이 함수를 안 고친다.
 */
export function crossCheckDeclaredLevel(
  declaredLevel: number | null | undefined,
  detected: string | null | undefined,
): LevelCrossCheck {
  const expected = declaredLevel != null ? DECLARED_LEVEL_CEFR[declaredLevel] : undefined
  const idx = CEFR_ORDER.indexOf(detected as CefrBand)
  if (!expected || expected.length === 0 || idx < 0) {
    return { comparable: false, gapBands: 0, contradicts: false, note: null }
  }
  const bounds = expected.map((b) => CEFR_ORDER.indexOf(b))
  const lo = Math.min(...bounds)
  const hi = Math.max(...bounds)
  const gapBands = idx < lo ? lo - idx : idx > hi ? idx - hi : 0
  if (gapBands < CONTRADICTION_BANDS) {
    return { comparable: true, gapBands, contradicts: false, note: null }
  }
  const dir = idx < lo ? '쉽게' : '어렵게'
  return {
    comparable: true,
    gapBands,
    contradicts: true,
    // 어느 쪽이 옳다고 말하지 않는다 — 말할 수 없기 때문이다. 벌어진 사실만 적는다.
    note:
      `레벨 신호 충돌 — 발행사 선언 Level ${declaredLevel}(기대 ${expected.join('~')})인데 ` +
      `추정은 ${detected}. ${gapBands}밴드 ${dir} 나왔다. 어느 쪽도 그대로 믿을 수 없다.`,
  }
}
