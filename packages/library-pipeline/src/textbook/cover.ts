// packages/library-pipeline/src/textbook/cover.ts
//
// **표지를 만든다 — 매대에서 상품으로 보이려면 표지가 있어야 한다.**
//
// ── 왜 (2026-09-01 실측) ────────────────────────────────────────────
// 매대 시각 상품성을 국내 교재 출판사와 같은 자로 재 보니 이랬다
// (`scripts/textbook/shelf-visual-probe.mjs`):
//
//   축                    우리      NE능률     다락원
//   첫화면 이미지 면적     0.56%      5.3%     31.9%   ← 1/57
//   표지 크기            196px²   15,336px²      —     ← 1/78
//
// 196px² 는 14×14 다 — **표지가 아니라 아이콘**이다. 우리 카드에는 표지가 아예 없었고
// (46×64 CSS 그라디언트 칩이라 이미지로 세지지도 않는다), 그래서 화면이 "텍스트 위주" 로
// 읽혔다. 매대에서 먼저 일어나는 일은 고르는 것이 아니라 **눈에 걸리는 것**이고 그 일은
// 이미지가 한다.
//
// ── 왜 그림이 아니라 조판인가 ───────────────────────────────────────
// 지문이 열세 곳(NASA·PLOS·VOA…)에서 온다. 어느 한 그림도 그 전부를 대표하지 못하고,
// 대표하는 척하면 표지가 내용을 오해하게 만든다. 그래서 표지는 **조판물**이다 —
// 시리즈명 · 권 번호 · 학령 · 깊이 표시 넷만 싣는다.
//
// 대신 표지가 **거짓말을 하지 않는다**: 깊이 표시는 `SERIES_SPINE` 의 실제 계단이고,
// 색은 `@vocaflow/design-tokens` 에서 온다(여기서 색을 적지 않는다 — 조판기가 자기 팔레트를
// 따로 갖고 있다가 다섯 항목이 어긋난 적이 있다).
//
// ── 왜 SVG 문자열인가 ───────────────────────────────────────────────
// 매대(React)와 조판기(`render-volume.mjs`, 순수 Node)가 **같은 표지**를 써야 한다.
// 문자열이면 양쪽이 그대로 쓴다. 그리고 인라인 SVG 라서 `var(--…)` 토큰과 페이지 서체를
// 그대로 물려받는다 — 테마 전환이 공짜로 따라온다(`<img>` 였다면 둘 다 잃는다).

import { SERIES_BRAND, SERIES_SPINE, type SeriesRung } from './series'

/**
 * 표지에 찍는 시리즈명 — 플랫폼 이름을 뗀 짧은 형태.
 *
 * ⚠️ 이름의 정본은 `SERIES_BRAND` 다. 여기서는 **표기 방식만** 정한다(표지는 좁아서
 *   긴 이름이 안 들어간다). 시리즈 이름이 확정되면 저 상수 하나만 바꾸면 된다.
 *
 * ⚠️ 이 파일이 `./textbook-cover` 서브패스로 따로 나가는 이유: 매대는 **클라이언트
 *   컴포넌트**라 패키지 루트를 import 하면 적재 스크립트의 `child_process` 까지 딸려와
 *   빌드가 깨진다(실측 2026-09-01 — 화면이 500). `./vocab-brand` 와 같은 선례다.
 */
export const COVER_BRAND: string = SERIES_BRAND.split(' ').slice(-1)[0] ?? SERIES_BRAND

/** 표지 비율 — 국내 교재 표지의 통상 비(5:7). 크기는 부르는 쪽이 정한다. */
export const COVER_RATIO = 5 / 7

/**
 * 매대 목록에 쓰는 기본 크기. **면적이 곧 상품성**이라 근거를 적어 둔다 —
 * NE능률 표지 실측 15,336px²(≈124×124)이 기준선이고, 112×157 = 17,584px² 로 그것을 넘는다.
 */
export const COVER_LIST_WIDTH = 112

export interface CoverSpec {
  /** 시리즈명. `SERIES_BRAND` 에서 온다 — 표지에서 짓지 않는다. */
  brand: string
  /** 권 번호(사다리 계단). 1~7. */
  step: number
  /** 사다리 전체 칸 수. 깊이 표시가 몇 칸인지 정한다. */
  totalSteps: number
  /** 학령. "초등 저학년" 등. */
  schoolBand: string
  /** 아직 못 펼치는 권인가 — 표지를 흐리게 하고 깊이 표시를 비운다. */
  pending?: boolean
}

/** 사다리 한 칸에서 표지 사양을 만든다. 화면이 계단 정보를 다시 조립하지 않게. */
export function coverSpecOf(
  rung: Pick<SeriesRung, 'step' | 'schoolBand' | 'volumeTitle'>,
  brand: string,
  totalSteps: number = SERIES_SPINE.length,
  pending = false,
): CoverSpec {
  return { brand, step: rung.step, totalSteps, schoolBand: rung.schoolBand, pending }
}

const esc = (s: string): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/**
 * 깊이 표시 — 일곱 칸 중 이 권의 칸만 채운다.
 *
 * 오른쪽으로 갈수록 길어진다. **진도 막대가 아니라 눈금**이다 — 채워진 칸은
 * "여기까지 왔다" 가 아니라 "이 책은 이 깊이다" 를 말한다.
 */
function depthMark(spec: CoverSpec, x: number, baseY: number, w: number): string {
  const n = spec.totalSteps
  const gap = 3
  const barW = Math.max(2, (w - gap * (n - 1)) / n)
  const minH = 5
  const maxH = 20
  const bars: string[] = []
  for (let i = 0; i < n; i += 1) {
    const h = minH + ((maxH - minH) * i) / (n - 1)
    const on = !spec.pending && i + 1 === spec.step
    bars.push(
      `<rect x="${(x + i * (barW + gap)).toFixed(1)}" y="${(baseY - h).toFixed(1)}" ` +
        `width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="1" ` +
        `fill="${on ? 'var(--active, #B0843A)' : 'var(--bd, #E0DBD0)'}"/>`,
    )
  }
  return bars.join('')
}

/**
 * 표지 SVG. **인라인으로 넣는다** — `<img src>` 로 쓰면 토큰도 서체도 못 물려받는다.
 *
 * @param width 표지 가로(px). 세로는 5:7 로 따라온다.
 */
export function coverSvg(spec: CoverSpec, width: number = COVER_LIST_WIDTH): string {
  const W = Math.round(width)
  const H = Math.round(width / COVER_RATIO)
  const pad = Math.max(7, Math.round(W * 0.1))
  const inner = W - pad * 2

  // 권 번호는 표지에서 가장 큰 것이다 — 서가에서 책등처럼 읽힌다.
  const numSize = Math.round(H * 0.30)
  const brandSize = Math.max(6, Math.round(W * 0.072))
  const bandSize = Math.max(7, Math.round(W * 0.082))

  const ink = spec.pending ? 'var(--t3, #8A8278)' : 'var(--t1, #1A1714)'
  const ground = spec.pending ? 'var(--bg3, #ECE6DA)' : 'var(--bg2, #F4F0E9)'

  return [
    `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"`,
    ` aria-label="${esc(spec.brand)} ${spec.step}권 표지 — ${esc(spec.schoolBand)}"`,
    ` xmlns="http://www.w3.org/2000/svg">`,
    // 지면 + 테두리. 테두리가 없으면 밝은 바탕에서 표지가 배경에 녹는다.
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="3" fill="${ground}"`,
    ` stroke="var(--bd, #E0DBD0)"/>`,
    // 책등 — 왼쪽 얇은 띠. 표지가 "책" 으로 읽히게 하는 가장 싼 장치다.
    `<rect x="0.5" y="0.5" width="${Math.max(3, Math.round(W * 0.035))}" height="${H - 1}" rx="3"`,
    ` fill="var(--active, #B0843A)" opacity="${spec.pending ? 0.25 : 0.85}"/>`,
    // 시리즈명
    `<text x="${pad}" y="${pad + brandSize}" font-family="Lora, Georgia, serif"`,
    ` font-size="${brandSize}" font-weight="600" letter-spacing="${(brandSize * 0.22).toFixed(2)}"`,
    ` fill="var(--activeInk, #7E5A1B)">${esc(spec.brand.toUpperCase())}</text>`,
    // 권 번호
    `<text x="${pad}" y="${Math.round(H * 0.60)}" font-family="Lora, Georgia, serif"`,
    ` font-size="${numSize}" font-weight="600" fill="${ink}">${spec.step}</text>`,
    // 학령
    `<text x="${pad}" y="${Math.round(H * 0.60) + bandSize + 6}" font-family="'DM Sans', system-ui, sans-serif"`,
    ` font-size="${bandSize}" fill="var(--t2, #4A443E)">${esc(spec.schoolBand)}</text>`,
    // 깊이 표시
    depthMark(spec, pad, H - pad, inner),
    `</svg>`,
  ].join('')
}
