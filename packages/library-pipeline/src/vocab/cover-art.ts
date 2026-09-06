// packages/library-pipeline/src/vocab/cover-art.ts
//
// **표지 도판을 그린다 — 수집하지 않고.**
//
// ── 무엇이 바뀌나 ──────────────────────────────────────────────────
// 지금까지 표지는 Openverse 에서 **찾아온 사진**이었다(PD 판화를 흑백화 + 듀오톤).
// 그 방식은 결이 맞는 대신 두 가지가 늘 문제였다:
//
//   ① **한 유형이 여러 권이면 검색어를 두고 경쟁한다** — 주제별 단어장 17권이 전부
//      `world atlas map` 하나를 두고 다퉜고, 한 권만 도판을 받고 열여섯이 그라디언트로
//      떨어졌다(`covers/design.ts` 의 실측 기록).
//   ② 외부 이미지라 라이선스 표기·가용성·화질이 우리 손 밖에 있다.
//
// 그래서 **그린다.** 계열마다 도형 문법을 정하고, 권마다 그 문법 안에서 변주한다.
// 실제 출판사가 시리즈를 내는 방식과 같다 — 한 시각 체계, 권마다 다른 판.
//
// ── 왜 결정적이어야 하는가 ─────────────────────────────────────────
// 표지는 학습자가 "그 책이 뭐였지" 를 되살리는 손잡이다. 볼 때마다 그림이 바뀌면 손잡이가
// 아니다. 그래서 **슬러그에서 시드를 뽑아** 같은 권이면 언제나 같은 그림이 나오게 한다.
// 서버 렌더와 클라이언트 렌더가 갈리지 않는 이유이기도 하다(hydration).
//
// ── 색을 담지 않는다 ───────────────────────────────────────────────
// 여기서 나오는 것은 **선(path)뿐**이다. 색은 `FAMILY_DUOTONE` 이 토큰에서 읽어 칠한다.
// 이 저장소가 팔레트 사본으로 두 번 어긋난 뒤 정한 규칙이다.

import type { CoverFamily } from './brand'

// ── 결정적 난수 ─────────────────────────────────────────────────────

/** 문자열 → 32bit 시드 (xmur3). 같은 슬러그면 언제나 같은 값. */
export function seedOf(input: string): number {
  let h = 1779033703 ^ input.length
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^= h >>> 16) >>> 0
}

/** mulberry32 — 작고 빠르고 재현된다. 표지 하나에 수십 번만 부른다. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── 도판 ────────────────────────────────────────────────────────────

export interface CoverArt {
  family: CoverFamily
  /** 같은 슬러그면 같은 값 — 표지가 손잡이 노릇을 하려면 변하면 안 된다. */
  seed: number
  viewBox: string
  /** 선화 path 의 `d` 속성들. 색은 담지 않는다. */
  paths: string[]
  /** 점(원)으로 찍는 것 — 성좌·열매처럼 선만으로는 안 되는 것. */
  dots: Array<{ cx: number; cy: number; r: number }>
}

const W = 212
const H = 172
const round = (n: number): number => Math.round(n * 10) / 10

/**
 * 계열 다섯의 **도형 문법**.
 *
 * 계열이 다르면 그리는 것이 다르고, 같은 계열이면 **같은 문법 안에서** 달라진다.
 * 그래야 서가에서 계열이 구별되면서도 권이 구별된다.
 */
type Drawer = (r: () => number) => Pick<CoverArt, 'paths' | 'dots'>

/** 목록 — 세어서 줄 세운 것. 막대의 수·높이·격자 밀도가 변한다. */
const drawList: Drawer = (r) => {
  const bars = 5 + Math.floor(r() * 4) // 5~8
  const gap = (W - 48) / bars
  const paths: string[] = [`M24 ${H - 24} H${W - 24}`, `M24 ${H - 24} V24`]
  for (let i = 0; i < bars; i += 1) {
    /*
      ⚠️ **절대 좌표로 쓴다.** 상대 명령(`v-93`)으로 쓰면 회귀가 좌표 범위를 볼 때 그
      -93 을 판 밖 좌표로 읽는다 — 실제로는 y=148 에서 y=55 로 가는 정상 선이었다.
      판정이 뜻을 가지려면 판에 적힌 수가 곧 자리여야 한다.
    */
    const h = 16 + Math.floor(r() * (H - 74))
    const x = round(30 + i * gap)
    const w = round(gap * 0.52)
    const top = round(H - 24 - h)
    paths.push(`M${x} ${H - 24} L${x} ${top} L${round(x + w)} ${top} L${round(x + w)} ${H - 24}`)
  }
  // 눈금선 — 두세 줄. 어느 높이인지는 권마다 다르다.
  const rules = 2 + Math.floor(r() * 2)
  for (let i = 0; i < rules; i += 1) {
    const y = round(34 + r() * (H - 80))
    paths.push(`M28 ${y} H${W - 28}`)
  }
  return { paths, dots: [] }
}

/** 구조 — 조각으로 나눠 본 것. 가지 수·각도·열매 자리가 변한다. */
const drawStructure: Drawer = (r) => {
  const paths: string[] = [`M${W / 2} ${H - 20} V${H / 2 - 4}`]
  const dots: CoverArt['dots'] = []
  const branches = 3 + Math.floor(r() * 3) // 3~5
  for (let i = 0; i < branches; i += 1) {
    const side = i % 2 === 0 ? -1 : 1
    const from = round(H / 2 + 30 - i * 14)
    const dx = round(side * (34 + r() * 32))
    const dy = round(-(28 + r() * 34))
    const cx = round(W / 2 + dx * 0.45)
    const cy = round(from + dy * 0.75)
    const ex = round(W / 2 + dx)
    const ey = round(from + dy)
    paths.push(`M${W / 2} ${from} C ${cx} ${cy}, ${ex - dx * 0.15} ${ey + 8}, ${ex} ${ey}`)
    dots.push({ cx: ex, cy: ey, r: round(3 + r() * 2.5) })
  }
  paths.push(`M${W / 2 - 22} ${H - 20} H${W / 2 + 22}`)
  return { paths, dots }
}

/** 원서 — 이야기 속에서 만난 것. 펼침 각도와 글줄 수가 변한다. */
const drawCorpus: Drawer = (r) => {
  const lift = 8 + r() * 12
  const mid = W / 2
  const paths: string[] = [
    `M26 ${round(44 + lift)} C 60 ${round(32 + lift)}, 90 ${round(36 + lift)}, ${mid} 46`
    + ` C ${round(mid + 14)} ${round(36 + lift)}, ${W - 60} ${round(32 + lift)}, ${W - 26} ${round(44 + lift)}`
    + ` L${W - 26} ${H - 34} C ${W - 60} ${round(H - 44)}, ${round(mid + 14)} ${round(H - 40)}, ${mid} ${H - 30}`
    + ` C 90 ${round(H - 40)}, 60 ${round(H - 44)}, 26 ${H - 34} Z`,
    `M${mid} 46 V${H - 30}`,
  ]
  const lines = 3 + Math.floor(r() * 2)
  for (let i = 0; i < lines; i += 1) {
    const y = round(66 + i * 20 + r() * 4)
    paths.push(`M42 ${y} C 64 ${round(y - 7)}, 84 ${round(y - 5)}, ${round(mid - 10)} ${y}`)
    paths.push(`M${round(mid + 10)} ${y} C ${round(mid + 30)} ${round(y - 5)}, ${W - 60} ${round(y - 7)}, ${W - 42} ${y}`)
  }
  return { paths, dots: [] }
}

/** 전달 — 매일 같은 자리로 돌아오는 것. 눈금 수와 바늘 각도가 변한다. */
const drawDelivery: Drawer = (r) => {
  const cx = W / 2
  const cy = H / 2
  const R = 58
  const paths: string[] = [`M${cx} ${cy - R} A ${R} ${R} 0 1 1 ${round(cx - 0.01)} ${cy - R}`]
  const ticks = 8 + Math.floor(r() * 5) * 2 // 8·10·12·14·16
  for (let i = 0; i < ticks; i += 1) {
    const a = (i / ticks) * Math.PI * 2
    const inner = R - (i % 3 === 0 ? 12 : 6)
    paths.push(
      `M${round(cx + Math.sin(a) * inner)} ${round(cy - Math.cos(a) * inner)}`
      + ` L${round(cx + Math.sin(a) * R)} ${round(cy - Math.cos(a) * R)}`,
    )
  }
  const h1 = r() * Math.PI * 2
  const h2 = r() * Math.PI * 2
  paths.push(`M${cx} ${cy} L${round(cx + Math.sin(h1) * 34)} ${round(cy - Math.cos(h1) * 34)}`)
  paths.push(`M${cx} ${cy} L${round(cx + Math.sin(h2) * 46)} ${round(cy - Math.cos(h2) * 46)}`)
  return { paths, dots: [{ cx, cy, r: 3 }] }
}

/** 고유 — 이 플랫폼만 그리는 지도. 별자리의 별 수와 배치가 변한다. */
const drawUnique: Drawer = (r) => {
  const cx = W / 2
  const cy = H / 2
  const R = 64
  const paths: string[] = [`M${cx} ${cy - R} A ${R} ${R} 0 1 1 ${round(cx - 0.01)} ${cy - R}`]
  const dots: CoverArt['dots'] = []
  const stars = 5 + Math.floor(r() * 4) // 5~8
  const pts: Array<[number, number]> = []
  for (let i = 0; i < stars; i += 1) {
    const a = (i / stars) * Math.PI * 2 + r() * 0.8
    const d = 18 + r() * (R - 26)
    const x = round(cx + Math.sin(a) * d)
    const y = round(cy - Math.cos(a) * d)
    pts.push([x, y])
    dots.push({ cx: x, cy: y, r: round(2.5 + r() * 1.8) })
  }
  // 별을 잇는 선 — 이웃끼리만 잇는다. 전부 이으면 그물이 되어 별자리로 안 읽힌다.
  for (let i = 1; i < pts.length; i += 1) {
    if (r() < 0.25) continue
    paths.push(`M${pts[i - 1]![0]} ${pts[i - 1]![1]} L${pts[i]![0]} ${pts[i]![1]}`)
  }
  return { paths, dots }
}

const DRAWERS: Record<CoverFamily, Drawer> = {
  list: drawList,
  structure: drawStructure,
  corpus: drawCorpus,
  delivery: drawDelivery,
  unique: drawUnique,
}

/**
 * 한 권의 표지 도판.
 *
 * `key` 는 보통 세트 슬러그다. **id 를 넣지 않는다** — id 가 바뀌면(재발행) 표지가 바뀌는데,
 * 학습자에게는 같은 책이다. 슬러그가 없으면 제목으로 떨어진다.
 */
export function coverArtFor(family: CoverFamily, key: string): CoverArt {
  const seed = seedOf(`${family}:${key}`)
  const r = rng(seed)
  const { paths, dots } = DRAWERS[family](r)
  return { family, seed, viewBox: `0 0 ${W} ${H}`, paths, dots }
}
