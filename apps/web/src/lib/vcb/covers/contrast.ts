// apps/web/src/lib/vcb/covers/contrast.ts
//
// **표지 제목이 읽히는가 — 겹쳐 칠한 층을 실제로 합성해서 잰다.**
//
// ── 왜 상수를 여기로 옮겼나 ────────────────────────────────────────
// 표지는 층이 넷이다: 계열 잉크 → 밝기 보정(DEEPEN) → 도판 → 스크림. 그 위에 흰 제목이 온다.
// 층이 하나라도 바뀌면 대비가 바뀌는데, **눈으로는 "좀 어두워졌네" 밖에 알 수 없다.**
// 실제로 첫 구현에서 잉크와 지면을 뒤집어 칠했다가 제목이 안 읽히는 것을 스크린샷으로야 알았다
// (2026-09-07). 그때 코드는 아무 오류도 내지 않았다.
//
// 그래서 층 값을 컴포넌트가 아니라 **여기에** 두고, 컴포넌트와 회귀가 같은 값을 읽는다.
// 값을 컴포넌트에 두면 회귀는 사본을 재게 되고, 사본은 반드시 갈린다.

/**
 * 계열마다 잉크의 밝기가 다르다(`corpus` 는 앰버, `delivery` 는 짙은 네이비). 그대로 두면
 * 어떤 권은 제목이 읽히고 어떤 권은 안 읽힌다 — 한 번 눌러 같은 밝기 띠에 앉힌다.
 * 색상(hue)은 그대로라 계열 식별은 유지된다.
 */
export const DEEPEN_TOP = 0.3
export const DEEPEN_BOTTOM = 0.42

/**
 * 스크림 — 제목이 앉는 62% 지점에서 한 번 더 누른다.
 *
 * ⚠️ **이것은 규격이 아니라 하한이다** (2026-09-07). 스크림의 정본은 브랜드 캔버스의
 *   `coverGrid.scrimStrength` 이고 DB 의 각인에서 온다(`covers/lockup.ts`). 여기 값은
 *   각인이 없는 권 — 도서 챕터·글 단어장 — 이 쓰는 것이다.
 *
 *   두 값이 갈려 있었다는 것 자체가 이 파일이 경고하던 사고였다: 캔버스는 0.35 를 정하고
 *   화면은 0.4/0.34 를 쓰고 있었고, 아무도 오류를 보지 못했다.
 */
export const SCRIM_AT_TITLE = { card: 0.4, hero: 0.34 } as const

/**
 * 도판이 판면 안에서 물러나는 여백(%).
 *
 * 아래(`PLATE_TITLE_BAND`)만 크게 비운다 — 제목이 앉는 자리다. 균등 여백이면 도판이 제목과
 * 겹쳐 둘 다 흐려진다. 옆·위는 규격(`coverGrid.plateInset`)이 정하고, 없으면 이 값을 쓴다.
 */
export const PLATE_INSET_FALLBACK = 11
export const PLATE_TITLE_BAND = 33

/** 제목이 앉는 세로 위치(0~1). `GradientBookCover` 가 가운데 아래에 그린다. */
export const TITLE_BAND = 0.62

export function deepenCss(): string {
  return `linear-gradient(180deg, rgba(12,10,8,${DEEPEN_TOP}) 0%, rgba(12,10,8,${DEEPEN_BOTTOM}) 100%)`
}

/**
 * `strength` 는 브랜드 각인이 정한 값(`coverGrid.scrimStrength`). 없으면 하한으로 떨어진다.
 *
 * 위·아래 기울기(head·shoulder·end)는 규격에 없다 — 규격이 말하는 것은 **제목 띠에서
 * 얼마나 누르는가** 하나이고, 나머지는 그 값이 자연스럽게 이어지도록 하는 형태다.
 */
export function scrimCss(kind: 'card' | 'hero', strength?: number | null): string {
  const mid = strength ?? SCRIM_AT_TITLE[kind]
  const end = kind === 'card' ? 0.6 : 0.52
  const head = kind === 'card' ? 0.1 : 0.08
  const shoulder = kind === 'card' ? 0.05 : 0.04
  return `linear-gradient(180deg, rgba(0,0,0,${head}) 0%, rgba(0,0,0,${shoulder}) 30%, rgba(0,0,0,${mid}) ${Math.round(TITLE_BAND * 100)}%, rgba(0,0,0,${end}) 100%)`
}

// ── 합성과 대비 ─────────────────────────────────────────────────────

type Rgb = [number, number, number]

export function parseHex(h: string): Rgb {
  const v = h.replace('#', '').trim()
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb
}

/** `fg` 를 알파 `a` 로 `bg` 위에 얹는다. */
export function composite(fg: Rgb, a: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((i) => fg[i]! * a + bg[i]! * (1 - a)) as Rgb
}

function relativeLuminance(c: Rgb): number {
  const f = c.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * f[0]! + 0.7152 * f[1]! + 0.0722 * f[2]!
}

/** WCAG 명도 대비비. 4.5 이상이면 본문 크기에서도 AA 다. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((p, q) => q - p)
  return (hi! + 0.05) / (lo! + 0.05)
}

/**
 * 제목 띠에서 흰 글자의 대비.
 *
 * **도판은 계산에 넣지 않는다** — 선이라 면적이 작고, 넣으면 권마다 값이 달라져 회귀가
 * 흔들린다. 도판 선은 대비를 **올리는** 쪽(밝은 선)이라 이 값은 하한이다.
 */
export function titleContrast(
  inkHex: string,
  kind: 'card' | 'hero' = 'card',
  strength?: number | null,
): number {
  const ink = parseHex(inkHex)
  const deepAlpha = DEEPEN_TOP + (DEEPEN_BOTTOM - DEEPEN_TOP) * TITLE_BAND
  const deepened = composite([12, 10, 8], deepAlpha, ink)
  const scrimmed = composite([0, 0, 0], strength ?? SCRIM_AT_TITLE[kind], deepened)
  return contrastRatio([255, 255, 255], scrimmed)
}
