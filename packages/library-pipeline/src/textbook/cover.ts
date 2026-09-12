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
import { seriesInk } from './series-ink'

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

/**
 * **계단마다 다른 잉크색** — 표지가 서로 구별되게 하는 유일한 장치다.
 *
 * ── 왜 (2026-09-01 실측) ──────────────────────────────────────────
 * 표지를 만들고 나서 재 보니 **일곱 권의 평균색이 전부 같은 베이지**였다
 * (#E9E3DA~#ECE6DD — 채널당 3/255 차이는 숫자 획 때문이지 색이 다른 게 아니다).
 * 즉 표지 식별률이 **1종 / 7권 = 14%** 였다. 같은 자로 잰 시중은:
 *
 *     NE능률   표지 10개 · 서로 다른 것 **10종**(100%)
 *     다락원   표지 25개 · 서로 다른 것 **23종**(92%)
 *
 * 매대에서 일곱 권이 한 권처럼 보이면 학습자는 고를 것이 하나라고 읽는다.
 *
 * ── 왜 이 색들인가 ────────────────────────────────────────────────
 * · **명도·채도를 고정하고 색상만 돌린다** — 실제 교재 시리즈가 쓰는 방식이다.
 *   그래야 일곱 권이 *다른 책*이 아니라 *같은 시리즈의 다른 권*으로 읽힌다.
 * · 학령 순서를 색으로도 읽히게 따뜻함(초등) → 차가움(고등)으로 돌린다.
 * · **마지막 단은 브랜드 잉크**(`p` #0F2540)로 맺는다 — 사다리 끝이 브랜드 색이다.
 * · 깊이는 색이 아니라 **깊이 표시**가 말한다(§depthMark). 색은 *어느 권인가*만 말한다.
 *
 * ── 실측 (2026-09-01) ─────────────────────────────────────────────
 * 종이(#F4F0E9) 대비: 5.23 ~ 13.60 — **일곱 색 전부 AA(4.5) 통과**.
 * 가장 가까운 두 색의 RGB 거리 **40.0**(5단↔6단) — 눈으로 갈린다.
 *
 * ⚠️ **토큰에 없는 값이다.** 토큰은 액센트를 하나만 갖는다(단일 tint 원칙) — 시리즈
 *   식별색은 그 원칙이 다루는 대상이 아니다(앱 UI 가 아니라 상품 표지다). 그래서
 *   여기 적되 **근거와 실측을 함께** 남긴다. 바꿀 때는 위 두 수치를 다시 재야 한다.
 */
export const RUNG_INK: readonly string[] = [
  '#735C26', // 1단 초등 저학년 — 황토
  '#702933', // 2단 초등 고학년 — 벽돌
  '#6E2B65', // 3단 중학 1-2   — 자주
  '#442B6E', // 4단 중학 3     — 보라
  '#295170', // 5단 고1        — 청
  '#297056', // 6단 고2        — 녹
  '#0F2540', // 7단 고3·수능   — 브랜드 잉크
]

/** 그 계단의 잉크. 사다리 밖(못 앉힌 권)은 브랜드 잉크로 떨어진다. */
export function rungInk(step: number): string {
  return RUNG_INK[step - 1] ?? RUNG_INK[RUNG_INK.length - 1]!
}

/** 표지 비율 — 국내 교재 표지의 통상 비(5:7). 크기는 부르는 쪽이 정한다. */
export const COVER_RATIO = 5 / 7

/**
 * 매대 목록에 쓰는 기본 크기. **면적이 곧 상품성**이라 근거를 적어 둔다 —
 * NE능률 표지 실측 15,336px²(≈124×124)이 기준선이고, 112×157 = 17,584px² 로 그것을 넘는다.
 */
export const COVER_LIST_WIDTH = 112

/**
 * 권 이름에서 **표지에 찍을 표시**만 떼어낸다 — `Vocaflow Reading 4` → `4`, `… Starter` → `Starter`.
 *
 * ── 왜 필요한가 (실측 2026-09-07, 표지를 처음 굽어 보고 알았다) ─────────
 * 표지는 `step`(1~7)을 크게 찍고 카드 제목은 `volumeTitle`(Starter·1~6)을 쓴다.
 * 둘은 **한 칸씩 밀려 있고 같은 카드에 나란히 보인다** — 5단 표지에 큰 `5` 가 찍히는데
 * 바로 옆 제목은 `Vocaflow Reading 4` 다. 학습자는 한 책에서 다른 두 수를 읽는다.
 *
 * 계단이 몇 단인지는 **깊이 표시가 이미 말한다**(칠단 중 다섯째 칸). 그러니 큰 글자는
 * 계단이 아니라 **이 책의 이름**이어야 한다.
 */
export function volumeMark(volumeTitle: string, seriesBrand: string = SERIES_BRAND): string {
  const t = volumeTitle.trim()
  if (t.startsWith(seriesBrand)) {
    const rest = t.slice(seriesBrand.length).trim()
    if (rest) return rest
  }
  const parts = t.split(/\s+/)
  return parts[parts.length - 1] ?? t
}

export interface CoverSpec {
  /** 시리즈명. `SERIES_BRAND` 에서 온다 — 표지에서 짓지 않는다. */
  brand: string
  /** 권 번호(사다리 계단). 1~7. */
  step: number
  /**
   * **표지에 크게 찍는 이 책의 이름** — `4` · `Starter`.
   *
   * 없으면 `step` 으로 떨어진다(옛 호출자 호환). 새 호출자는 `coverSpecOf` 가 채워 준다.
   */
  volume?: string
  /**
   * 한 줄 주제 — 매대 카드가 쓰는 것과 **같은 문장**을 받는다(`taglineOf(rung.rationale)`).
   *
   * ⚠️ 여기서 문장을 짓지 않는다. 표지와 카드가 다른 말을 하면 그 자체가 결함이다.
   *   그리고 파이프라인은 웹 쪽 `shelf-copy` 를 import 하지 않는다 — 방향이 반대다.
   */
  subject?: string
  /** 사다리 전체 칸 수. 깊이 표시가 몇 칸인지 정한다. */
  totalSteps: number
  /** 학령. "초등 저학년" 등. */
  schoolBand: string
  /** 아직 못 펼치는 권인가 — 표지를 흐리게 하고 깊이 표시를 비운다. */
  pending?: boolean
  /**
   * **시리즈 액센트(hex).** 주면 그 색상으로 깊이 램프를 만든다.
   *
   * ⚠️ 없으면 `RUNG_INK`(단별 일곱 색)로 떨어진다 — 시리즈가 하나였을 때의 동작이고,
   *   독해 시리즈는 지금도 그것을 쓴다. 시리즈가 여럿이면 **같은 단의 세 권이 같은 색**이
   *   되므로(실측 2026-09-06) 액센트를 줘야 매대에서 갈린다.
   */
  accent?: string
}

/** 사다리 한 칸에서 표지 사양을 만든다. 화면이 계단 정보를 다시 조립하지 않게. */
export function coverSpecOf(
  rung: Pick<SeriesRung, 'step' | 'schoolBand' | 'volumeTitle'>,
  brand: string,
  totalSteps: number = SERIES_SPINE.length,
  pending = false,
  /** 한 줄 주제. 매대 카드와 **같은 문장**을 넘긴다(`taglineOf(rung.rationale)`). */
  subject?: string,
): CoverSpec {
  return {
    brand,
    step: rung.step,
    // 큰 글자는 계단이 아니라 **이 책의 이름**이다 — 안 그러면 표지와 제목이 다른 수를 말한다.
    volume: volumeMark(rung.volumeTitle),
    totalSteps,
    schoolBand: rung.schoolBand,
    pending,
    ...(subject ? { subject } : {}),
  }
}

/** 깊이 표시 칸의 최소 높이 — 큰 글자 자리를 잡을 때도 같은 값을 써야 어긋나지 않는다. */
const minDepth = (height: number): number => Math.max(3, height * 0.032)

const esc = (s: string): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/**
 * 깊이 표시 — 일곱 칸 중 이 권의 칸만 채운다.
 *
 * 오른쪽으로 갈수록 길어진다. **진도 막대가 아니라 눈금**이다 — 채워진 칸은
 * "여기까지 왔다" 가 아니라 "이 책은 이 깊이다" 를 말한다.
 */
function depthMark(
  spec: CoverSpec,
  x: number,
  baseY: number,
  w: number,
  /** 채워진 칸의 색. 색면 위에 얹히므로 부르는 쪽이 정한다(종이색으로 뒤집는다). */
  onColor: string,
  /** 표지 세로 — 칸 높이를 판형에 비례시키려고 받는다. */
  height: number,
): string {
  const n = spec.totalSteps
  // ⚠️ 칸 높이를 **고정 px 로 두면 큰 판에서 사라진다** (실측 2026-09-07: 290px 격자에서
  //   표지는 2.6배가 되는데 눈금은 그대로 5~20px 라 발치의 점처럼 보였다). 판형에 비례시킨다.
  const gap = Math.max(2, w * 0.027)
  const barW = Math.max(2, (w - gap * (n - 1)) / n)
  const minH = minDepth(height)
  const maxH = Math.max(minH + 2, height * 0.127)
  const bars: string[] = []
  for (let i = 0; i < n; i += 1) {
    const h = minH + ((maxH - minH) * i) / (n - 1)
    const on = !spec.pending && i + 1 === spec.step
    bars.push(
      `<rect x="${(x + i * (barW + gap)).toFixed(1)}" y="${(baseY - h).toFixed(1)}" ` +
        `width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="1" ` +
        `fill="${on ? onColor : 'rgba(255,255,255,0.34)'}"/>`,
    )
  }
  return bars.join('')
}

/**
 * 표지 SVG. **인라인으로 넣는다** — `<img src>` 로 쓰면 토큰도 서체도 못 물려받는다.
 *
 * @param width 표지 가로(px). 세로는 5:7 로 따라온다.
 */
/**
 * 유동 폭 옵션 — 격자 진열에서 표지를 **칸 전체 폭**으로 깐다.
 *
 * 실측 2026-09-01: 격자 카드가 표지를 옆에 두니(132px) 데스크톱 이미지 면적이 4.48% 로
 * 다락원(31.9%)의 1/7 이었다. 상업 격자는 표지를 위에 전폭으로 둔다 — 그때 표지 하나가
 * 290×406 = 117,740px² 가 되어 화면을 채운다.
 *
 * ⚠️ 유동일 때 width/height 를 **적지 않는다.** 적으면 CSS 가 못 늘린다 —
 *   viewBox 만 두고 크기는 부모가 정하게 한다.
 */
export interface CoverOptions {
  /** 칸 전체 폭으로 늘린다.  는 좌표계 기준값으로만 쓰인다. */
  fluid?: boolean
}

export function coverSvg(
  spec: CoverSpec,
  width: number = COVER_LIST_WIDTH,
  opts: CoverOptions = {},
): string {
  const W = Math.round(width)
  const H = Math.round(width / COVER_RATIO)
  const pad = Math.max(7, Math.round(W * 0.1))
  const inner = W - pad * 2

  // 권 번호는 표지에서 가장 큰 것이다 — 서가에서 책등처럼 읽힌다.
  const numSize = Math.round(H * 0.30)
  const brandSize = Math.max(6, Math.round(W * 0.072))
  const bandSize = Math.max(7, Math.round(W * 0.082))

  // 계단 색이 표지의 주인공이다 — 권 번호·책등·깊이 표시가 같은 색을 쓴다.
  // 액센트를 주면 그 시리즈의 색상으로, 아니면 단별 일곱 색으로.
  const rung = spec.accent
    ? seriesInk(spec.accent, spec.step, spec.totalSteps)
    : rungInk(spec.step)
  const ink = spec.pending ? 'var(--t3, #8A8278)' : rung
  const ground = spec.pending ? 'var(--bg3, #ECE6DA)' : 'var(--bg2, #F4F0E9)'

  // ── 색면 비율 ───────────────────────────────────────────────────
  // 실측 2026-09-01: 계단 색을 책등(폭 3.5%)과 숫자에만 넣었더니 일곱 권의 **평균색이
  // 여전히 전부 베이지**였다(#E4E2DD~#EBE5DB). 색이 있어도 면적이 없으면 매대에서
  // 구별되지 않는다 — 시중 교재 표지가 큰 색면을 쓰는 이유가 이것이다.
  //
  // 그래서 아래 42% 를 계단 색으로 채우고 권 번호를 종이색으로 반전시킨다.
  // 위 58% 는 종이 그대로 — **일곱 권이 같은 시리즈로 읽히는 것은 그 종이와 서체다.**
  const bandTop = Math.round(H * 0.58)
  const bandH = H - bandTop

  // ── 책등 ────────────────────────────────────────────────────────
  // 실제 책은 왼쪽에 등이 있다. 표지를 정면으로만 그리면 **종이 한 장**으로 읽히고,
  // 서가에 세워 둔 물건으로 안 읽힌다. 폭은 판형에 비례한다(4.4% — 112px 표지에서 5px).
  //
  // ⚠️ 사각형으로 그리면 바깥 테두리의 `rx=3` 밖으로 모서리가 삐져나온다.
  //   `clipPath` 를 쓰면 표지가 여럿일 때 id 가 충돌하므로(매대에 일곱 장이 깔린다)
  //   **왼쪽 두 모서리만 둥근 path** 로 직접 그린다 — id 가 없으니 충돌도 없다.
  const spineW = Math.max(3, Math.round(W * 0.044))

  // ── 한 줄 주제 ──────────────────────────────────────────────────
  //
  // ⚠️ 여기 있던 **「글줄 리듬」 네 줄을 걷어냈다** (실측 2026-09-07 — 표지를 처음 굽어 봤다).
  //   회색 둥근 막대 넷은 이 저장소의 스켈레톤과 모양이 같아서 **「아직 안 불러온 카드」로
  //   읽힌다.** 290px 격자에서 특히 그렇다. 매대에서 상품으로 보이려고 넣은 장치가 정반대로
  //   "미완성" 신호가 됐다.
  //
  //   원래 목적(이미지 면적 0 탈출)은 **이 막대가 아니라 표지 SVG 자체**가 이미 해결한다 —
  //   `shelf-visual-probe.mjs` 는 이미지 요소의 면적을 세지, 그 안의 도형을 세지 않는다.
  //
  //   그 자리에는 **정보**를 넣는다: 매대 카드가 쓰는 한 줄 주제와 같은 문장이다.
  //   표지와 카드가 다른 말을 하면 그 자체가 결함이므로 **문장을 여기서 짓지 않고 받는다.**
  const subjectSize = Math.max(6.5, Math.round(W * 0.062))
  const subjectTop = pad + brandSize + Math.round(H * 0.052)
  // 한글은 1em 에 가깝다 — 넘치면 SVG 는 오류 없이 **조용히 잘리므로** 들어갈 크기로 줄인다.
  const subjectFit = (inner - spineW) / Math.max(1, (spec.subject?.length ?? 1) * 1.0)
  const subjectFont = Math.max(6, Math.min(subjectSize, subjectFit))
  const subject = spec.subject
    ? `<text x="${pad + spineW}" y="${(subjectTop + subjectFont).toFixed(1)}" ` +
      `font-family="Lora, Georgia, serif" font-style="italic" font-size="${subjectFont.toFixed(1)}" ` +
      `fill="${spec.pending ? 'var(--t3, #8A8278)' : rung}" opacity="0.82">${esc(spec.subject)}</text>`
    : ''

  // 학령 칩 — 글자만 두면 표지에서 안 읽힌다. 테두리를 둘러 **고르는 값**으로 만든다.
  //
  // ⚠️ **긴 라벨이 표지 밖으로 넘쳤다**(실측 2026-09-06 — "고3 / 수능 상위" 11자가
  //   112px 표지에서 칩 폭 113px 로 계산돼 오른쪽이 잘렸다). SVG 는 넘쳐도 오류를 내지
  //   않고 **조용히 잘린다** — 그래서 폭을 재는 대신 **들어갈 크기로 글자를 줄인다.**
  //   한글은 1em 에 가깝고 라틴·공백은 그보다 좁아, 1.02em 은 넉넉한 상한이다.
  const chipPadX = Math.max(4, Math.round(W * 0.045))
  const chipAvail = inner - spineW
  const chipFont = Math.max(
    6,
    Math.min(bandSize, (chipAvail - chipPadX * 2) / (spec.schoolBand.length * 1.02)),
  )
  const chipH = Math.round(chipFont * 1.9)
  const chipY = bandTop - Math.round(H * 0.045) - chipH
  const chipW = Math.min(
    chipAvail,
    Math.round(spec.schoolBand.length * chipFont * 1.02) + chipPadX * 2,
  )

  // ── 큰 글자 ─────────────────────────────────────────────────────
  // 숫자 한 자(`4`)일 때가 기준이고, 낱말(`Starter`)이면 들어갈 만큼 줄인다.
  // 깊이 표시 위로 한 칸 띄운다 — 앞 판은 숫자와 눈금이 맞닿아 붙어 보였다.
  const mark = spec.volume ?? String(spec.step)
  const markMax = Math.round(bandH * 0.62)
  const markFit = (inner - spineW) / Math.max(1, mark.length * 0.62)
  const markSize = Math.max(9, Math.min(markMax, markFit))
  const depthTop = H - pad - Math.max(minDepth(H) + 2, H * 0.127)
  const markBaseline = Math.min(
    bandTop + Math.round(bandH * 0.62),
    depthTop - Math.max(3, H * 0.018),
  )

  return [
    `<svg viewBox="0 0 ${W} ${H}"${opts.fluid ? ' style="width:100%;height:auto;display:block"' : ` width="${W}" height="${H}"`} role="img"`,
    ` aria-label="${esc(spec.brand)} ${spec.step}권 표지 — ${esc(spec.schoolBand)}"`,
    ` xmlns="http://www.w3.org/2000/svg">`,
    // 지면 + 테두리. 테두리가 없으면 밝은 바탕에서 표지가 배경에 녹는다.
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="3" fill="${ground}"`,
    ` stroke="var(--bd, #E0DBD0)"/>`,
    // 책등 — 왼쪽 두 모서리만 둥글다.
    `<path d="M${spineW + 0.5} 0.5 H3.5 a3 3 0 0 0 -3 3 V${H - 3.5} a3 3 0 0 0 3 3 H${spineW + 0.5} Z"`,
    ` fill="${spec.pending ? 'var(--bg3, #ECE6DA)' : rung}"/>`,
    // 계단 색면 — 표지를 구별시키는 것은 여기다.
    `<path d="M0.5 ${bandTop} H${W - 0.5} V${H - 3.5} a3 3 0 0 1 -3 3 H3.5 a3 3 0 0 1 -3 -3 Z"`,
    ` fill="${spec.pending ? 'var(--bg3, #ECE6DA)' : rung}"/>`,
    // 시리즈명 — 종이 쪽에 앉는다.
    `<text x="${pad + spineW}" y="${pad + brandSize}" font-family="Lora, Georgia, serif"`,
    ` font-size="${brandSize}" font-weight="600" letter-spacing="${(brandSize * 0.22).toFixed(2)}"`,
    ` fill="${spec.pending ? 'var(--t3, #8A8278)' : rung}">${esc(spec.brand.toUpperCase())}</text>`,
    subject,
    // 학령 — 종이 쪽. 고르는 사람이 가장 먼저 확인하는 값이라 색면 위에 얹지 않는다.
    `<rect x="${pad + spineW}" y="${chipY}" width="${chipW}" height="${chipH}" rx="${(chipH / 2).toFixed(1)}"`,
    ` fill="none" stroke="var(--bd, #E0DBD0)"/>`,
    `<text x="${pad + spineW + chipPadX}" y="${chipY + Math.round(chipH * 0.7)}" font-family="'DM Sans', system-ui, sans-serif"`,
    ` font-size="${chipFont.toFixed(1)}" fill="var(--t2, #4A443E)">${esc(spec.schoolBand)}</text>`,
    // 이 책의 이름 — 색면 위에 종이색으로 반전. 서가에서 책등처럼 읽힌다.
    //
    // ⚠️ 여기 `spec.step` 을 찍고 있었다 — 그래서 5단 표지의 큰 글자가 `5` 인데 바로 옆
    //   카드 제목은 `Vocaflow Reading 4` 였다(실측 2026-09-07). 계단은 아래 깊이 표시가
    //   이미 말하므로, 큰 글자는 **책 이름**을 말한다.
    `<text x="${pad + spineW}" y="${markBaseline.toFixed(1)}" font-family="Lora, Georgia, serif"`,
    ` font-size="${markSize.toFixed(1)}" font-weight="600"`,
    ` fill="${spec.pending ? 'var(--t3, #8A8278)' : 'var(--bg, #FBFAF6)'}">${esc(mark)}</text>`,
    // 깊이 표시 — 색면 위라 종이색으로 뒤집는다.
    depthMark(
      spec,
      pad + spineW,
      H - pad,
      inner - spineW,
      spec.pending ? 'var(--bd, #E0DBD0)' : 'var(--bg, #FBFAF6)',
      H,
    ),
    `</svg>`,
  ].join('')
}
