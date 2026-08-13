// apps/web/src/lib/a11y/touch-target.ts
//
// Tailwind 클래스 문자열에서 요소의 최소 높이를 추정한다 (정적 분석용).
//
// ⚠️ **이것은 지표가 아니라 위치 추적기다.**
// 권위 있는 수치는 실제 렌더 기하를 재는 `tests/e2e/10-a11y-sweep.spec.ts` 다.
// 정적 추정 80건 vs 실측 202건 — 2.5배 차이가 났다(2026-08-13). 정적으로는
//   · 부모가 크기를 주는 요소 (44px label 로 감싼 체크박스)
//   · 렌더 후에야 정해지는 크기 (flex/grid 분배 · 콘텐츠 기반)
//   · 조건부 클래스 (템플릿 리터럴 분기)
// 를 원리적으로 볼 수 없어 **항상 과소 보고**한다.
//
// 그럼에도 남겨두는 이유: 스윕은 "어떤 화면에 몇 건"까지만 알려주고 **파일·줄 번호를
// 주지 못한다**. 고칠 때는 이쪽이 필요하다. 역할 분담이 분명해야 숫자를 혼동하지 않는다.

/** Tailwind spacing 1단위 = 0.25rem = 4px */
const REM = 4

/** WCAG / CLAUDE.md 기준 최소 터치 타겟 */
export const MIN_TOUCH_PX = 44

export interface HeightEstimate {
  px: number
  /** 어떤 클래스에서 유도했는지 — 오탐 추적용 */
  via: string
}

/**
 * className 문자열에서 추정 최소 높이(px). 판정 근거가 없으면 null.
 *
 * 우선순위: min-h-[Npx] → h-[Npx] → h-N → py-N/p-N + 텍스트 높이.
 * **명시적 신호가 없으면 판정하지 않는다** — 추측으로 오탐을 만드느니 놓치는 쪽을 택한다.
 */
export function estimateHeight(cls: string): HeightEstimate | null {
  const minH = cls.match(/min-h-\[(\d+)px\]/)
  if (minH) return { px: Number(minH[1]), via: `min-h-[${minH[1]}px]` }

  const hArb = cls.match(/(?:^|\s)h-\[(\d+)px\]/)
  if (hArb) return { px: Number(hArb[1]), via: `h-[${hArb[1]}px]` }

  const hNum = cls.match(/(?:^|\s)h-(\d+(?:\.\d+)?)(?:\s|$)/)
  if (hNum) return { px: Number(hNum[1]) * REM, via: `h-${hNum[1]}` }

  // py-N (또는 p-N) + 텍스트 줄높이. text-[Npx] 가 없으면 14px 가정 · line-height 1.4
  const py = cls.match(/(?:^|\s)(?:py|p)-(\d+(?:\.\d+)?)(?:\s|$)/)
  if (py) {
    const fs = cls.match(/text-\[(\d+)px\]/)
    const lineH = Math.round((fs ? Number(fs[1]) : 14) * 1.4)
    return { px: Number(py[1]) * REM * 2 + lineH, via: `py-${py[1]}+text` }
  }

  return null
}

/** 추정 높이가 기준 미만인가. 판정 불가(null)는 위반으로 세지 않는다. */
export function isBelowMinTouch(cls: string): boolean {
  const est = estimateHeight(cls)
  return est !== null && est.px < MIN_TOUCH_PX
}
