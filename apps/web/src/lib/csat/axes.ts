// apps/web/src/lib/csat/axes.ts
//
// **두 축은 절대 합치지 않는다 — 소재(무엇이 나오나)와 형식(어떻게 나오나).**
//
// ── 왜 이 파일이 필요한가 ────────────────────────────────────────────
// 기출 분석이 「주제별 요약」으로 퇴행하는 경로는 하나다: **소재와 형식을 한 축에 섞는 것.**
// 섞는 순간 "환경 문제가 자주 나온다" 같은 말이 나오는데, 그건 시험 대비가 아니다 —
// 평가원이 고르는 것은 소재이고 **재는 것은 형식**이기 때문이다. 같은 환경 지문이
// 빈칸으로도 순서로도 나온다.
//
// 그래서 두 축에 **다른 색·다른 자리**를 준다. 색을 여기 한 곳에서만 정하면 화면들이
// 저마다 파랑을 고르는 일이 없다.
//
// ⚠️ **하드코딩 색을 쓰지 않는다**(CLAUDE.md §절대 하지 않을 것). 아래는 전부 토큰
//   참조이고, 새 색을 만들지 않고 이미 있는 토큰에 **의미를 부여**한 것이다.
//   (브리프 E3 은 "hex 로 명명" 이라 했지만, 이 저장소는 토큰이 SSoT 다 — 같은 목적을
//   토큰 바인딩으로 이룬다. 역할 수는 E3 이 요구한 4~6 안이다: 5.)
//
// ⚠️ **색만으로 축을 가르지 않는다**(접근성 · CLAUDE.md). 각 축은 색 + **자리**
//   (형식은 행 머리, 소재는 열 머리) + 기호를 함께 쓴다. 색약 사용자가 자리로 구별한다.

/** 이 값이 쓰이는 자리. 화면이 `style` 에 그대로 꽂는다. */
export interface AxisInk {
  /** 선·글자 색 토큰. */
  fg: string
  /** 배경 토큰(옅은 면). */
  bg: string
  /** 색 말고 이 축을 알아보게 하는 기호. */
  mark: string
  label: string
  /** 라벨이 말하지 않는 것. 화면 도움말·툴팁이 그대로 쓴다. */
  says: string
}

/**
 * 역할 5개 — 이 화면군이 쓰는 의미색 전부다. 늘리기 전에 여기 없는 이유를 적는다.
 *
 * ⚠️ **「내 오답」 색은 일부러 없다.** ⑥⑦(훈련·검증)은 지금 안 짓기로 했고
 *   (`steps.ts` — `csat_item_attempts` 14행), 안 지을 화면의 색을 미리 정하면
 *   그 색이 맞는지 아무도 확인할 수 없다. 더구나 오답에 빨강을 쓰는 것은
 *   CLAUDE.md 철학 3(정답률 빨간 글씨 압박 금지)에 바로 걸린다 — Memory Decay 의
 *   `risk` 가 같은 빨강을 쓰지만 그쪽은 **기억 상태**지 학습자의 실패가 아니다.
 *   ⑦ 을 지을 때 그 화면에서 정한다.
 */
export const AXIS: Record<'format' | 'topic' | 'density' | 'hard' | 'anchor', AxisInk> = {
  /** **형식 축** — 유형·출제 방식. 시험이 재는 것. */
  format: {
    fg: 'var(--info-ink)',
    bg: 'var(--info-light)',
    mark: '◆',
    label: '형식',
    says: '어떻게 묻는가 — 빈칸·순서·어법처럼 평가원이 재는 방식',
  },
  /** **소재 축** — 주제·분야. 시험이 고르는 것. 형식과 **절대 같은 색을 쓰지 않는다.** */
  topic: {
    fg: 'var(--bronze)',
    bg: 'var(--bg2)',
    mark: '●',
    label: '소재',
    says: '무엇에 대한 글인가 — 같은 소재가 여러 형식으로 나온다',
  },
  /** 히트맵 셀 농도의 최고점. 낮은 쪽은 `--bg2` 에서 단계로 간다. */
  density: {
    fg: 'var(--p)',
    bg: 'var(--bg2)',
    mark: '▪',
    label: '출제 빈도',
    says: '그 해 그 유형이 몇 번 나왔는가',
  },
  /**
   * 3점(고배점) 문항.
   *
   * ⚠️ **`--error-*` 를 쓰지 않는다.** 어려움은 실패가 아니고, 빨강은 학습자를 압박한다
   *   (CLAUDE.md 철학 3 Empathetic Feedback · 「정답률 빨간 글씨」 금지).
   */
  hard: {
    fg: 'var(--warning-ink)',
    bg: 'var(--warning-light)',
    mark: '▲',
    label: '3점',
    says: '배점이 높은 문항 — 시간 배분이 달라진다',
  },
  /** 정답 근거가 확정되는 자리. `LocusBar` 가 이미 쓰는 색과 같아야 한다. */
  anchor: {
    fg: 'var(--active-ink)',
    bg: 'var(--active-light)',
    mark: '▮',
    label: '근거',
    says: '정답이 확정되는 지문 속 자리',
  },
}

/**
 * 히트맵 셀 농도 — **5칸**.
 *
 * ⚠️ 연속 농도를 쓰지 않는 이유: 눈은 연속 명도를 정확히 못 읽는다. 칸을 끊으면
 *   "이 칸이 저 칸보다 진하다" 가 판정 가능해지고, 무엇보다 **셀 안에 숫자를 함께 적으므로**
 *   농도는 훑기용 보조 신호다(색 단독 정보전달 금지).
 */
export const DENSITY_STEPS = 5

/**
 * 0~max 를 0~4 단계로. `max` 가 0 이면 전부 0 단계다(0 으로 나누지 않는다).
 *
 * ⚠️ **0 과 1 을 같은 단계로 두지 않는다.** 한 번이라도 나온 칸은 안 나온 칸과 다르다 —
 *   "이 유형은 그 해에 없었다" 가 기출 분석에서 가장 중요한 정보 중 하나다.
 */
export function densityStep(n: number, max: number): number {
  if (n <= 0) return 0
  if (max <= 1) return DENSITY_STEPS - 1
  const ratio = (n - 1) / (max - 1)
  return 1 + Math.round(ratio * (DENSITY_STEPS - 2))
}

/** 그 단계의 배경 — 0 은 빈 칸이라 면을 깔지 않는다. */
export function densityBg(step: number): string {
  if (step <= 0) return 'transparent'
  // `--p` 를 단계별 투명도로 깐다. 새 색을 만들지 않고 농도만 준다.
  const alpha = [0, 0.14, 0.3, 0.5, 0.74][Math.min(step, DENSITY_STEPS - 1)]
  return `color-mix(in srgb, var(--p) ${Math.round(alpha * 100)}%, transparent)`
}

/**
 * 그 농도 위의 글자색 — 진한 칸에서 본문색을 쓰면 안 읽힌다.
 * 경계를 3 으로 둔 것은 위 alpha 표에서 0.5 부터 면이 글자를 먹기 시작하기 때문이다.
 */
export const densityFg = (step: number): string => (step >= 3 ? 'var(--bg)' : 'var(--t1)')
