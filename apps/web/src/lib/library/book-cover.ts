// apps/web/src/lib/library/book-cover.ts
//
// v06.32 모던 — 큐레이션된 8색 팔레트 (Linear/Notion/Apple Books 현대 미학).
// 채도 높은 인터넷 그리드도 아니고, 엔틱 무채도 아닌, 모던 flat 디자인.

interface CoverInput {
  title: string
  bookVLevel: number | null
  coverFrom?: string | null
  coverTo?: string | null
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

export function bookCover({
  title,
  bookVLevel,
  coverFrom,
  coverTo,
}: CoverInput): CoverGradient {
  if (coverFrom && coverTo) {
    // DB 가 준 색은 검증하지 않고 쓰되, **잉크는 그 색에서 정한다.**
    return { from: coverFrom, to: coverTo, textTone: inkFor(coverFrom, coverTo) }
  }
  const hash = titleHash(title)
  const palette = PLATFORM_PALETTE[hash % PLATFORM_PALETTE.length]!
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
