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

export function bookCover({
  title,
  bookVLevel,
  coverFrom,
  coverTo,
}: CoverInput): CoverGradient {
  if (coverFrom && coverTo) {
    return { from: coverFrom, to: coverTo, textTone: 'light' }
  }
  const hash = titleHash(title)
  const palette = PLATFORM_PALETTE[hash % PLATFORM_PALETTE.length]!
  const [lFrom, lTo] = vLevelLightness(bookVLevel)
  const from = `hsl(${palette.hue1} ${palette.sat}% ${lFrom}%)`
  const to = `hsl(${palette.hue2} ${palette.sat}% ${lTo}%)`
  return { from, to, textTone: 'light' }
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
