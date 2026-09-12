// packages/library-pipeline/src/textbook/series-ink.ts
//
// **시리즈마다 다른 표지 색 — 한 색상(hue), 단마다 다른 깊이.**
//
// ── 왜 필요한가 (실측 2026-09-06) ────────────────────────────────────
// 표지 색이 `RUNG_INK[step]` 하나로 정해져 있었다. 시리즈가 하나일 때는 그것이 옳았다 —
// 일곱 색이 일곱 단을 갈랐다. 그런데 시리즈를 셋으로 늘리자 **같은 단의 세 권이 같은 색**이
// 됐다. 매대에 나란히 놓으면 「Reading 5」와 「Vocab 5」가 한 시리즈로 읽힌다.
//
// 시중이 푸는 방식이 이것이다: **브랜드가 색상을 갖고, 단이 그 안에서 깊이를 갖는다.**
// 리딩튜터 주니어/챌린저가 같은 초록 계열의 다른 명도인 것과 같다.
//
// ── 어떻게 만드나 ────────────────────────────────────────────────────
// 시리즈의 액센트 하나(`SeriesDef.accent`)에서 색상(H)과 채도(S)를 가져와 **그대로 두고**,
// 단마다 깊이만 바꾼다. 색상이 같아야 한 시리즈로 읽힌다.
//
// ⚠️ **깊이의 자는 명도가 아니라 대비다.** 처음엔 HSL 의 L 을 램프로 잡았는데 색상마다
//   결과가 갈렸다 — 같은 L 에서 초록은 종이색 글자가 4.29:1 로 안 읽혔고, 보라는 기존
//   램프보다 훨씬 어두웠다. **명도는 사람이 보는 밝기가 아니다.** 회귀가 둘 다 잡았다.
//   그래서 목표 대비를 정하고 명도를 이분 탐색으로 푼다. 자세한 근거는 아래 상수에.

/** 표지 색면 위에 얹는 종이색. 대비를 재는 상대다. */
export const COVER_PAPER = '#F4F0E9'

/**
 * 목표 **대비** 범위 — `RUNG_INK` 실측(2026-09-06).
 *
 * ⚠️ 처음엔 명도(HSL의 L)를 램프로 잡았는데 **색상마다 결과가 갈렸다.** 같은 L=0.34 에서
 *   초록은 대비 4.29:1(안 읽힘)이고, 같은 L=0.15 에서 보라는 기존 램프보다 훨씬 어두웠다.
 *   명도는 사람이 보는 밝기가 아니다 — 회귀가 그것을 잡았다.
 *
 *   그래서 **대비를 목표로 잡고 명도를 푼다.** 자는 기존 램프다:
 *   `RUNG_INK` 일곱 색의 종이색 대비가 5.21 ~ 13.60 이고, 그 램프는 이미 표지에서 검증됐다.
 *   범위 안에 있으면 어느 색상이든 「기존 표지만큼 읽힌다」가 보장된다.
 */
const CONTRAST_TOP = 5.4
const CONTRAST_BOTTOM = 12.5

interface Hsl {
  h: number
  s: number
  l: number
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`색이 6자리 hex 가 아니다: ${hex}`)
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHsl([r, g, b]: [number, number, number]): Hsl {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6
  else if (max === G) h = ((B - R) / d + 2) / 6
  else h = ((R - G) / d + 4) / 6
  return { h, s, l }
}

function hslToHex({ h, s, l }: Hsl): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    const a = s * Math.min(l, 1 - l)
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255)
  }
  const hex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

/** WCAG 상대 휘도. 대비를 **재서** 정하려고 둔다 — 눈으로 고르면 어두운 칸이 새어 나간다. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 두 색의 대비비(1~21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * 그 시리즈의 그 단이 쓰는 잉크.
 *
 * @param accent 시리즈 액센트(hex). 색상·채도를 여기서 가져온다.
 * @param step   몇 단인가 (1부터).
 * @param totalSteps 시리즈의 단 수. 명도 간격이 여기서 나온다.
 *
 * 단이 하나뿐이면 범위 가운데를 쓴다 — 나누기 0 을 피하려고 끝값을 쓰면 그 시리즈만
 * 유독 어둡거나 밝아진다.
 */
export function seriesInk(accent: string, step: number, totalSteps: number): string {
  const { h, s } = rgbToHsl(hexToRgb(accent))
  // 채도가 너무 낮으면 세 시리즈가 다 회색으로 수렴한다 — 하한을 둔다.
  const sat = Math.max(0.22, s)
  const span = Math.max(1, totalSteps - 1)
  const t = totalSteps <= 1 ? 0.5 : Math.min(1, Math.max(0, (step - 1) / span))
  const target = CONTRAST_TOP + (CONTRAST_BOTTOM - CONTRAST_TOP) * t

  // 대비는 명도에 **단조**라(어두울수록 종이와의 대비가 커진다) 이분 탐색으로 푼다.
  // 닫힌 식으로 풀 수도 있지만 sRGB 감마가 껴 있어 식이 길어지고, 스무 번이면 충분히 맞는다.
  // ⚠️ 상한이 0.5 면 **채도 높은 보라·파랑이 경계에 붙는다.** 그 색상은 명도를 올려도
  //   휘도가 낮아서(파랑 성분의 시감 가중치가 0.07) 목표 대비까지 밝아지질 못한다 —
  //   실측 2026-09-06: 어휘(#8B5CF6)의 1·2단이 둘 다 #530df2 로 붙었다. 회귀가 잡았다.
  let lo = 0.05
  let hi = 0.78
  let best = hslToHex({ h, s: sat, l: (lo + hi) / 2 })
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2
    best = hslToHex({ h, s: sat, l: mid })
    if (contrastRatio(best, COVER_PAPER) < target) hi = mid
    else lo = mid
  }
  return best
}

/** 한 시리즈의 단 전체 잉크. 회귀와 화면이 함께 쓴다. */
export function seriesInkRamp(accent: string, totalSteps: number): string[] {
  return Array.from({ length: totalSteps }, (_, i) => seriesInk(accent, i + 1, totalSteps))
}

/** 두 색의 RGB 거리 — 「눈으로 갈리는가」를 재는 자. `cover.ts` 가 쓰던 것과 같은 자다. */
export function rgbDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}
