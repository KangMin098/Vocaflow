// apps/web/src/lib/library/book-cover.ts
//
// v06.32 모던 — 큐레이션된 8색 팔레트 (Linear/Notion/Apple Books 현대 미학).
// 채도 높은 인터넷 그리드도 아니고, 엔틱 무채도 아닌, 모던 flat 디자인.

interface CoverInput {
  title: string
  bookVLevel: number | null
  coverFrom?: string | null
  coverTo?: string | null
  /**
   * 단어장 유형(`VOCAB_CATEGORIES` 의 id). 주면 **색상이 유형을 말한다.**
   * 안 주거나 모르는 값이면 종전대로 제목 해시로 떨어진다 — 조용히 한 색으로 몰지 않는다.
   */
  category?: string | null
}

interface CoverGradient {
  from: string
  to: string
  textTone: 'light' | 'dark'
}

/**
 * v06.32 — Vocaflow 플랫폼 정합 8색 팔레트.
 * 디자인 토큰 정합: --p (#3B82F6 blue) + Sidebar 5그룹 accent (스크립트 보라 · 단어 인디고 ·
 * 익히기 핑크 · 정복 앰버 · 완성 시안) + emerald/rose/slate 보조.
 *
 * 모던 flat 디자인 — sat 55-70% (Linear/Notion/Apple HIG 표준 sweet spot).
 * 너무 채도 높으면 눈 피로, 너무 낮으면 muddy. 이 범위가 sweet spot.
 */
/**
 * **유형마다 고정 색상** — 표지가 *어떤 단어장인지*를 색으로 말하게 한다.
 *
 * ── 왜 (2026-09-01) ────────────────────────────────────────────────
 * 그 전까지 표지 색은 `titleHash % 팔레트 8` 이었다. 서로 다르긴 했지만 **유형과 무관**해서,
 * 같은 '수능·내신' 두 권이 다른 색이 되고 '유아' 와 '공무원' 이 같은 색이 될 수 있었다.
 * 즉 **카테고리 예측 가능성이 0** 이다 — 색이 아무것도 말하지 않는다.
 *
 * 교재 표지(`textbook/cover.ts` RUNG_INK)와 같은 원리를 쓴다:
 *   **색상 = 유형 · 명도 = 수준**. 두 축이 겹치지 않아 한 표지가 둘을 동시에 말한다.
 * 명도는 아래 `vLevelLightness` 가 이미 하고 있었다 — 색상만 유형에 묶으면 된다.
 *
 * ⚠️ 여기 없는 유형은 **해시로 떨어진다**(아래 fallback). 조용히 한 색으로 몰면
 *   새 카테고리가 생겼을 때 전부 같은 표지가 된다.
 */
const CATEGORY_HUE: Record<string, { hue1: number; hue2: number; sat: number }> = {
  // 열 유형을 **색상환에 36° 간격으로 고르게** 앉힌다. 균등 간격이 아니면 어딘가 두 유형이
  // 붙는다 — 첫 배치(임의 간격)에서 중등↔테마가 RGB 거리 22.4 로 사실상 같은 색이었다.
  etymology: { hue1: 20, hue2: 32, sat: 42 }, // 어원 — 고서 갈색
  preschool: { hue1: 56, hue2: 44, sat: 58 }, // 유아 — 호박
  elementary: { hue1: 92, hue2: 80, sat: 48 }, // 초등 — 새싹
  themed: { hue1: 128, hue2: 140, sat: 44 }, // 테마 — 숲
  middle: { hue1: 164, hue2: 176, sat: 50 }, // 중등 — 청록
  high: { hue1: 200, hue2: 212, sat: 58 }, // 고등 — 하늘
  csat: { hue1: 236, hue2: 248, sat: 62 }, // 수능·내신 — 인디고(가장 진지한 자리)
  eng_test: { hue1: 272, hue2: 284, sat: 54 }, // 공인영어 — 보라
  civil: { hue1: 308, hue2: 320, sat: 50 }, // 공무원 — 자주
  business: { hue1: 344, hue2: 356, sat: 52 }, // 비즈니스 — 벽돌
}

const PLATFORM_PALETTE: Array<{ name: string; hue1: number; hue2: number; sat: number }> = [
  { name: 'blue',    hue1: 217, hue2: 230, sat: 70 }, // Vocaflow primary --p
  { name: 'indigo',  hue1: 244, hue2: 258, sat: 65 }, // 단어 그룹
  { name: 'violet',  hue1: 262, hue2: 278, sat: 60 }, // 스크립트 그룹
  { name: 'cyan',    hue1: 189, hue2: 200, sat: 65 }, // 완성 그룹
  { name: 'pink',    hue1: 330, hue2: 345, sat: 62 }, // 익히기 그룹
  { name: 'amber',   hue1: 38,  hue2: 28,  sat: 65 }, // 정복 그룹
  { name: 'emerald', hue1: 160, hue2: 175, sat: 55 }, // success
  { name: 'slate',   hue1: 215, hue2: 222, sat: 22 }, // neutral mid
]

function titleHash(title: string): number {
  let sum = 0
  for (let i = 0; i < title.length; i++) sum += title.charCodeAt(i)
  return sum
}

/**
 * V-Level → lightness 두 stop.
 * 모던 mid-dark range — 흰 텍스트 가독성 + 시각 피로 최소.
 */
function vLevelLightness(v: number | null): [number, number] {
  if (v == null) return [44, 34]
  if (v <= 2) return [52, 42]
  if (v <= 5) return [46, 36]
  if (v <= 8) return [40, 30]
  return [34, 24]
}

/**
 * 색 문자열 → 상대 휘도(WCAG). `#rrggbb` · `rgb()` · `hsl()` 을 읽는다.
 * 모르는 형식이면 `null` — 그때는 추측하지 않고 기존 동작(흰 글자)을 유지한다.
 */
function relativeLuminance(color: string): number | null {
  let r: number, g: number, b: number

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color.trim())
  const hsl = /^hsla?\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/i.exec(color.trim())

  if (hex) {
    const v = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1]
    r = parseInt(v.slice(0, 2), 16)
    g = parseInt(v.slice(2, 4), 16)
    b = parseInt(v.slice(4, 6), 16)
  } else if (rgb) {
    const parts = rgb[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    if (parts.length < 3 || parts.some(Number.isNaN)) return null
    ;[r, g, b] = parts
  } else if (hsl) {
    // 휘도만 필요하므로 HSL → RGB 를 정식으로 변환한다.
    const hDeg = Number(hsl[1]) % 360
    const s = Number(hsl[2]) / 100
    const l = Number(hsl[3]) / 100
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((hDeg / 60) % 2) - 1))
    const m = l - c / 2
    const seg = Math.floor(hDeg / 60) % 6
    const [r1, g1, b1] = [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ][seg]
    r = Math.round((r1 + m) * 255)
    g = Math.round((g1 + m) * 255)
    b = Math.round((b1 + m) * 255)
  } else {
    return null
  }

  const f = (v: number) => {
    const t = v / 255
    return t <= 0.03928 ? t / 12.92 : Math.pow((t + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/**
 * 표지 위에 **흰 글자를 얹어도 되는가.**
 *
 * ⚠️ 왜 필요한가 (실측 2026-08-22): 생성 표지는 명도 24~52% 라 흰 글자가 안전하지만,
 *    **DB 가 준 표지색은 아무 값이나 올 수 있다.** 그런데 코드가 `textTone: 'light'` 를
 *    **무조건** 돌려주고 있었고, 화면은 그 필드를 **아예 읽지 않은 채** `text-white` 를 박아 뒀다.
 *    옅은 민트색 표지의 책 제목이 **1.1:1** — 사실상 보이지 않았다
 *    (`Introduction to Sociology` · `/wordvault`·`/library`).
 *    `drop-shadow` 로 읽히게 만들고 있었지만 **그림자는 WCAG 가 세지 않는다.**
 *
 * 기준은 흰 글자가 4.5:1 을 넘는 휘도다(L ≤ 0.1833). 두 색 중 **밝은 쪽**으로 판정한다 —
 * 그라디언트라 밝은 끝에서 글자가 사라지면 그 표지는 실패한 것이다.
 */
function inkFor(from: string, to: string): 'light' | 'dark' {
  const a = relativeLuminance(from)
  const b = relativeLuminance(to)
  if (a === null || b === null) return 'light' // 모르는 형식은 기존 동작 유지
  const lighter = Math.max(a, b)
  return lighter <= MAX_LUM_FOR_WHITE ? 'light' : 'dark'
}

/** 흰 글자가 AA 를 넘는 최대 휘도. 1.05 / (L + 0.05) ≥ 4.5 */
const MAX_LUM_FOR_WHITE = 0.1833

/**
 * 생성 표지를 **흰 글자가 안전한 밝기까지 낮춘다.**
 *
 * ⚠️ 왜 잉크를 뒤집는 것만으로 부족한가 (실측 2026-08-22):
 *    흰 글자는 L ≤ 0.183, 어두운 잉크(#1A1714)는 L ≥ 0.214 를 요구한다.
 *    그 **사이(0.183~0.214)는 어느 잉크도 4.5:1 을 못 넘는 사각지대**다.
 *    `hsl(215 22% 52%)` (L=0.209) 가 정확히 거기 있었다 — 흰 글자 4.05 · 검은 글자 4.44.
 *
 *    명도 표(`vLevelLightness`)를 통째로 내려 봐도 **사각지대에 빠지는 조합이 자리만 바뀐다**
 *    (-2%p → hue38, -4%p → hue189 …). 색상마다 휘도가 달라서 한 숫자로는 못 맞춘다.
 *    그래서 표를 고치는 대신, **색이 스스로 안전한 곳까지 내려간다.**
 *    색상(hue)과 채도는 그대로라 팔레트의 의도는 유지된다.
 */
function darkenUntilSafe(hue: number, sat: number, lightness: number): string {
  let l = lightness
  for (let i = 0; i < 60 && l > 4; i++) {
    const css = `hsl(${hue} ${sat}% ${l}%)`
    const lum = relativeLuminance(css)
    if (lum === null || lum <= MAX_LUM_FOR_WHITE) return css
    l -= 1
  }
  return `hsl(${hue} ${sat}% ${Math.max(l, 4)}%)`
}

/**
 * 주어진 **바탕색 위에서** AA(4.5) 를 넘을 때까지 색을 내린다.
 * `darkenUntilSafe` 는 *흰 글자* 기준이라 옅은 바탕 위 글자에는 쓸 수 없다(§CategoryIdentity.ink).
 */
function darkenUntilContrast(hue: number, sat: number, startL: number, against: string): string {
  const bg = relativeLuminance(against)
  let l = startL
  for (let i = 0; i < 60 && l > 4; i++) {
    const css = `hsl(${hue} ${sat}% ${l}%)`
    const fg = relativeLuminance(css)
    if (bg === null || fg === null) return css
    if ((bg + 0.05) / (fg + 0.05) >= 4.5) return css
    l -= 1
  }
  return `hsl(${hue} ${sat}% ${Math.max(l, 4)}%)`
}

export function bookCover({
  title,
  bookVLevel,
  coverFrom,
  coverTo,
  category,
}: CoverInput): CoverGradient {
  if (coverFrom && coverTo) {
    // DB 가 준 색은 검증하지 않고 쓰되, **잉크는 그 색에서 정한다.**
    return { from: coverFrom, to: coverTo, textTone: inkFor(coverFrom, coverTo) }
  }
  // 유형이 있으면 유형이 색상을 정한다. 없으면 종전대로 제목 해시.
  const byCategory = category ? CATEGORY_HUE[category] : undefined
  const hash = titleHash(title)
  const palette = byCategory ?? PLATFORM_PALETTE[hash % PLATFORM_PALETTE.length]!
  const [lFrom, lTo] = vLevelLightness(bookVLevel)
  // 생성 표지는 **흰 글자를 보장한다** — 밝은 색상은 안전한 밝기까지 스스로 내려간다.
  const from = darkenUntilSafe(palette.hue1, palette.sat, lFrom)
  const to = darkenUntilSafe(palette.hue2, palette.sat, lTo)
  return { from, to, textTone: inkFor(from, to) }
}

/**
 * CEFR → V-Level (표지 명도 매핑용). 기본값 6 → Pinocchio 와 동일한 mid-dark 톤.
 * 단어장/스크립트가 도서와 같은 무채도 높은(형광 아닌) 톤을 갖도록.
 */
/**
 * 한 유형의 **시각 정체성 한 벌** — 표지·칩·상세 시트가 같은 색을 쓰게 하는 유일한 출처.
 *
 * ── 왜 (실측 2026-09-01) ──────────────────────────────────────────
 * 유형 색 표가 **두 개**였다. `VocabSetCarousel` 의 `CATEGORY_COLOR`(형광 tailwind-400
 * 계열 9종)와 위 `CATEGORY_HUE`(10종)가 서로 다른 말을 하고 있었다 —
 * 같은 '수능·내신' 이 **칩에서는 호박색, 표지에서는 인디고**였다.
 * 게다가 `CATEGORY_COLOR` 에는 `preschool` 이 없어서 유아 단어장이 **조용히 테마 색**으로
 * 떨어졌다(빠진 줄 알 방법이 화면에 없다).
 *
 * 그래서 표를 하나로 합치고 여기서 파생시킨다. 새 유형을 더할 곳도 `CATEGORY_HUE` 한 곳이다.
 */
/** 유형을 대표하는 기준 수준. 특정 권이 아니라 갈래를 말하는 자리라 가운데를 쓴다. */
const REFERENCE_V_LEVEL = 6

export interface CategoryIdentity {
  /** 흰 글자를 얹는 면(활성 칩·상세 시트 버튼). `darkenUntilSafe` 가 AA 를 보장한다. */
  accent: string
  /** 옅은 바탕(비활성 칩). */
  tint: string
  /**
   * `tint` 위에 얹는 글자색.
   *
   * ⚠️ **`accent` 를 쓰면 안 된다** — `accent` 는 *흰 글자가 얹히는* 밝기까지만 내려간
   * 색이라, 거의 흰 `tint` 위에서는 4.5 를 못 넘는다(실측 2026-09-01: 고등 4.19 ·
   * 중등 4.16 · 초등 4.18 · 테마별 4.13 — 여덟 중 넷이 미달이었다).
   * 그래서 **그 바탕을 기준으로 다시** 내린 색을 따로 둔다.
   */
  ink: string
  /** 표지 그라디언트 두 끝. 명도는 부르는 쪽의 수준(V-Level)이 정한다. */
  from: string
  to: string
}

/**
 * 그 유형의 정체성. **모르는 유형이면 `null`** — 조용히 다른 유형의 색을 빌려주지 않는다
 * (빌려주면 화면은 멀쩡해 보이고 표만 틀린다). 부르는 쪽이 중립색으로 처리한다.
 */
export function categoryIdentity(category: string | null | undefined): CategoryIdentity | null {
  const h = category ? CATEGORY_HUE[category] : undefined
  if (!h) return null
  // ── 무엇이 유형을 말하는가 (실측 2026-09-01) ──────────────────────
  // **글자색(`ink`)이 말한다** — 여덟 유형의 ink 는 표지와 같은 색이라 서로 RGB 37.3 이상
  // 떨어져 있다. `tint` 는 그 뒤를 받치는 옅은 바탕일 뿐이다.
  //
  // 바탕만으로 유형을 말하게 하려 했으나 **원리상 불가능했다** — 거의 흰 색끼리는 멀어질 수
  // 없다: L=91% 에서 최소 거리 6.8 · 88% 에서 10.0 · 84% 까지 내려도 15.5 로,
  // 눈으로 갈리는 30 에 한참 못 미친다. 더 내리면 칩 행이 시끄러워져 Calm UI 를 깬다.
  // 그래서 바탕은 88% 에서 멈추고(거리 10.0 — 있는지 알 만큼) 구별은 글자가 진다.
  const tint = `hsl(${h.hue1} ${Math.round(h.sat * 0.8)}% 88%)`
  // 그라디언트는 **표지에게 물어본다** — 여기서 명도를 또 적으면 그 순간 두 값이 갈린다.
  // 실제로 처음엔 46/36 이라 적었다가 표지의 40/30 과 어긋났고, 계약 테스트가 잡았다.
  // 상세 시트는 특정 권이 아니라 유형을 대표하므로 중간 수준(V6)을 기준으로 삼는다.
  const cover = bookCover({ title: '', bookVLevel: REFERENCE_V_LEVEL, category })
  return {
    accent: darkenUntilSafe(h.hue1, h.sat, 40),
    tint,
    ink: darkenUntilContrast(h.hue1, h.sat, 34, tint),
    from: cover.from,
    to: cover.to,
  }
}

export function cefrToVLevel(cefr: string | null | undefined): number {
  switch (cefr) {
    case 'A1':
      return 1
    case 'A2':
      return 2
    case 'B1':
      return 4
    case 'B2':
      return 6
    case 'C1':
      return 8
    case 'C2':
      return 10
    default:
      return 6
  }
}

export function bookTilt(title: string, indexInShelf: number, totalInShelf: number): number {
  const sum = titleHash(title)
  const base = (sum % 5) - 2
  if (indexInShelf === totalInShelf - 1 && totalInShelf > 1) return base - 2
  return base
}

export function bookThickness(title: string): number {
  const sum = titleHash(title)
  return 14 + (sum % 9)
}
