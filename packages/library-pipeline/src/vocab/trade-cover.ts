// packages/library-pipeline/src/vocab/trade-cover.ts
//
// **단어장 표지 — 시중 교재의 문법으로 조판한다.**
//
// ── 왜 (2026-09-26 사용자 지시 「시중 교재 디자인 스타일 · 시리즈·브랜드·단행본 목적에 맞게」) ──
// AI 도판 표지(Editions 풍 → tines 풍)는 서가에서 "그림 카드" 로 읽혔지 **교재** 로 읽히지 않았다.
// 시중 단어장(능률VOCA 4권 실측 · 빠바 · 수능 1 Up · 딥독 · 올림포스 대조)은 전부 **조판물**이다:
//   · 판형 152×225(세로 1.48) — 독해서(4:3)보다 좁고 길다.
//   · 위 30% 급별 색 띠 + 오른쪽 위 2줄 급 표시(「고등 / 기본」) + 흰 선 한 줄.
//   · 브랜드 각인 + 세로 괘선 + 2줄 문구(가는 훅 / 띠 색 굵은 한 줄).
//   · 영문 워드마크를 크게 쌓는다(한 줄 ≈17% H) — 시리즈의 얼굴.
//   · 발 : 「N일 완성 · 표제어 N개」(숫자만 굵게) · 판 도장.
//   · 뒤표지에 시리즈 사다리 — 지금 권만 채운다(「여기가 몇 번째 권」).
//   · 사진이 없다 — 평면 도형 · 선화 · 기하 무늬뿐.
// 로고·도판은 옮기지 않는다 — 문법(격자 · 비율 · 색 규칙)만 옮긴다.
//
// ── 목적 셋 ─────────────────────────────────────────────────────────
//   series     — 뼈대 고정, 권마다 띠 색 · 급 문구 · 사다리 칸만 바뀐다(능률VOCA 식).
//   brand      — 브랜드 각인 자리만 고정, 권마다 틀·주인공이 다르다(출판사 우산 식).
//   standalone — 단행본. 한 권만의 틀과 색(파생본 · 도서 연계).
// 목적은 조판을 바꾸지 않는다 — **명세를 누가 정하느냐**를 가른다(파이프라인 `trade-covers` 가 검증한다).
//
// ── 왜 SVG 문자열인가 ───────────────────────────────────────────────
// `textbook/cover.ts` 와 같은 이유: 매대(React)와 조판기(순수 Node)가 같은 표지를 쓴다.
// 이 파일은 `./vocab-trade-cover` 서브패스로 따로 나간다 — 클라이언트 컴포넌트가 패키지 루트를 import 하면
// 적재 스크립트 의존까지 딸려와 빌드가 깨진다(`./textbook-cover` 와 같은 선례).
//
// ── 수치는 명세에 적지 않는다 ────────────────────────────────────────
// 표제어 수와 완성 일수는 그릴 때 받는다(`TradeCoverFacts`) — DB 실측과 사다리의 하루 분량에서 즉석 계산(I5).

export const TRADE_W = 608
export const TRADE_H = 900
/** 판형 — CSS aspect-ratio 로 그대로 쓴다(152×225). */
export const TRADE_RATIO = '152 / 225'

export const TRADE_MODES = ['series', 'brand', 'standalone'] as const
export type TradeMode = (typeof TRADE_MODES)[number]

export const TRADE_TEMPLATES = ['band', 'sideband', 'glyph', 'slab', 'minimal'] as const
export type TradeTemplate = (typeof TRADE_TEMPLATES)[number]

export interface TradePalette {
  /** 띠(또는 진한 면) */
  band: string
  /** 아래 바탕(옅은 같은 계열) */
  tint: string
  /** 강조 — 문구 굵은 줄 · 사다리 현재 칸 */
  accent: string
  /** 워드마크 먹 */
  ink: string
}

/** `cover_image_meta.trade` — 파이프라인(scripts/vcb/trade-covers)이 적는다. */
export interface TradeCoverSpec {
  mode: TradeMode
  template: TradeTemplate
  /** 각인 — 표지 맨 위/아래 작은 글자(예: 'VOCAFLOW') */
  brand: string
  /** 시리즈 또는 단행본 이름(각인 옆 굵은 이름) */
  series: string
  /** 크게 쌓는 영문 워드마크 줄들(1~3줄, 줄당 ≤ 6자 권장) */
  wordmark: string[]
  /** 오른쪽 위 급 표시 2줄(예: ['고등','기본']) */
  level: [string, string]
  /** 문구 2줄 — [가는 훅, 굵은 한 줄]. 굵은 줄이 비면 권 제목을 쓴다. */
  tagline: [string, string]
  palette: TradePalette
  /** 시리즈 사다리 — 지금 권 번호(1부터)와 전체 권 수. 단행본은 없다. */
  volume?: { index: number; total: number; label?: string } | null
  /** 판 도장(예: '2026 개정') */
  edition?: string | null
}

export interface TradeCoverFacts {
  /** 권 제목(한글) */
  title: string
  /** 표제어 수 — DB 실측 */
  words: number
  /** 하루 분량 — 사다리 계단 값. 없으면 「N일 완성」을 싣지 않는다. */
  perDay?: number | null
}

const FONT = `var(--font-trade, 'Pretendard Variable', Pretendard, 'Noto Sans KR', system-ui, sans-serif)`
const FONT_DISPLAY = `var(--font-trade-display, Inter, 'Pretendard Variable', Pretendard, system-ui, sans-serif)`

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * 글자 폭 추정(em) — 한글·전각 1.0 · 라틴 대문자/숫자 0.72(M·W 0.98) · 소문자 0.56 · 공백·구두점 0.3.
 * 굵은 산세리프 기준의 보수적인 값이다(2026-09-27 미리보기: WHO·MEMO·「Pride and Prejudice」가 판 밖으로 넘쳤다).
 */
export function textEm(s: string, tracking = 0): number {
  let w = 0
  for (const ch of s) {
    if (/[\u3131-\uD79D\u2190-\u21FF\u2248\u266A]/.test(ch)) w += 1
    else if (/[MW]/.test(ch)) w += 0.98 // 가장 넓은 대문자 — 따로 재지 않으면 WHO·MEMO 가 판 밖으로 나갔다
    else if (/[A-Z0-9&!?+]/.test(ch)) w += 0.72
    else if (/[a-z]/.test(ch)) w += 0.56
    else w += 0.3
  }
  return w + tracking * Math.max(0, [...s].length - 1)
}

/** 폭 안에 들어가는 글자 크기 — 기본 크기를 넘지 않는다. tracking 은 em 단위(음수 = 좁게). */
export function fitSize(lines: string[], maxWidth: number, base: number, tracking = 0): number {
  const widest = Math.max(...lines.map((l) => textEm(l, tracking)), 0.01)
  return Math.floor(Math.min(base, maxWidth / widest))
}

/** 한글 제목 줄바꿈 — 띄어쓰기 단위로, 한 줄 maxChars 를 넘기지 않게(낱말을 쪼개지 않는다). */
export function wrapTitle(title: string, maxChars: number, maxLines = 3): string[] {
  const words = title.trim().split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > maxChars && cur) {
      lines.push(cur)
      cur = w
    } else cur = next
  }
  if (cur) lines.push(cur)
  if (lines.length <= maxLines) return lines
  const head = lines.slice(0, maxLines - 1)
  return [...head, lines.slice(maxLines - 1).join(' ')]
}

function text(
  x: number,
  y: number,
  s: string,
  o: { size: number; weight?: number; fill: string; anchor?: 'start' | 'middle' | 'end'; ls?: number; font?: string; opacity?: number },
): string {
  return `<text x="${x}" y="${y}" font-family="${o.font ?? FONT}" font-size="${o.size}" font-weight="${o.weight ?? 400}" fill="${o.fill}"${
    o.anchor ? ` text-anchor="${o.anchor}"` : ''
  }${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.opacity != null ? ` opacity="${o.opacity}"` : ''}>${esc(s)}</text>`
}

/** 발 — 「N일 완성 · 표제어 N개」. 숫자만 굵게. 일수는 하루 분량이 있을 때만. */
function facts(x: number, y: number, f: TradeCoverFacts, fill: string, size = 17): string {
  const days = f.perDay && f.perDay > 0 ? Math.ceil(f.words / f.perDay) : null
  const b = (s: string | number) => `<tspan font-weight="800">${esc(String(s))}</tspan>`
  const parts = [
    ...(days ? [`${b(days)}일 완성`] : []),
    `표제어 ${b(f.words.toLocaleString('en-US'))}개`,
  ]
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}">● ${parts.join(' · ')}</text>`
}

/** 판 도장 — 둥근 테두리 안 한 줄. */
function stamp(xRight: number, y: number, s: string, stroke: string): string {
  const w = s.length * 13 + 28
  return `<g><rect x="${xRight - w}" y="${y - 22}" width="${w}" height="32" rx="16" fill="none" stroke="${stroke}" stroke-width="2"/>${text(
    xRight - w / 2,
    y,
    s,
    { size: 16, weight: 700, fill: stroke, anchor: 'middle' },
  )}</g>`
}

/**
 * 사다리 — 전체 권을 작은 책 칸으로 늘어놓고 지금 권만 채운다(시중 뒤표지의 「여기가 몇 번째」).
 * 색만으로 가르지 않는다: 지금 칸은 채움 + 위에 작은 삼각 표지.
 */
function ladder(x: number, yBase: number, v: NonNullable<TradeCoverSpec['volume']>, on: string, off: string): string {
  const n = Math.max(1, Math.min(v.total, 12))
  const w = 14
  const gap = 6
  let out = ''
  for (let i = 1; i <= n; i++) {
    const h = 16 + i * 4
    const cx = x + (i - 1) * (w + gap)
    const cur = i === v.index
    out += `<rect x="${cx}" y="${yBase - h}" width="${w}" height="${h}" rx="2" fill="${cur ? on : 'none'}" stroke="${cur ? on : off}" stroke-width="2"/>`
    if (cur) out += `<path d="M${cx + w / 2 - 6} ${yBase - h - 12} h12 l-6 8z" fill="${on}"/>`
  }
  return out
}

/** 오른쪽 위 급 표시 — 흰 선 한 줄 + 굵은 2줄. */
function levelBadge(xRight: number, y: number, level: [string, string], fill: string, size = 38): string {
  return `<line x1="${xRight - 84}" y1="${y}" x2="${xRight}" y2="${y}" stroke="${fill}" stroke-width="3"/>${text(xRight, y + size + 8, level[0], {
    size,
    weight: 800,
    fill,
    anchor: 'end',
  })}${text(xRight, y + size * 2 + 14, level[1], { size, weight: 800, fill, anchor: 'end' })}`
}

// ── 틀 ① 띠형 — 시리즈 기본(능률VOCA 문법) ─────────────────────────
function tplBand(s: TradeCoverSpec, f: TradeCoverFacts): string {
  const { band, tint, accent, ink } = s.palette
  const bandH = 270
  const tagBold = s.tagline[1] || f.title
  const wm = s.wordmark.slice(0, 3)
  const wmSize = fitSize(wm, 520, wm.length >= 3 ? 118 : 150, -0.04)
  // 띠 안 도형 — 계단(사다리의 상징). 권 번호만큼 칸이 차오른다.
  const steps = s.volume ? Math.max(1, Math.min(s.volume.total, 8)) : 5
  const lit = s.volume?.index ?? steps
  let motif = ''
  for (let i = 0; i < steps; i++) {
    const h = 34 + i * 22
    motif += `<rect x="${48 + i * 40}" y="${bandH - h}" width="32" height="${h}" fill="${i < lit ? '#ffffff' : 'none'}" stroke="#ffffff" stroke-width="2" opacity="${i < lit ? 0.92 : 0.55}"/>`
  }
  return [
    `<rect width="${TRADE_W}" height="${TRADE_H}" fill="${tint}"/>`,
    `<rect width="${TRADE_W}" height="${bandH}" fill="${band}"/>`,
    text(48, 64, s.brand, { size: 18, weight: 700, fill: '#ffffff', ls: 4, font: FONT_DISPLAY, opacity: 0.9 }),
    motif,
    levelBadge(560, 52, s.level, '#ffffff'),
    // 각인 + 세로 괘선 + 2줄 문구
    text(48, 352, s.series, { size: 50, weight: 900, fill: ink }),
    `<line x1="${60 + s.series.length * 34}" y1="312" x2="${60 + s.series.length * 34}" y2="360" stroke="${ink}" stroke-width="2"/>`,
    text(78 + s.series.length * 34, 330, s.tagline[0], { size: 19, weight: 400, fill: ink }),
    ...wrapTitle(tagBold, 14, 2).map((l, i) => text(78 + s.series.length * 34, 358 + i * 26, l, { size: 22, weight: 800, fill: accent })),
    ...wm.map((l, i) => text(40, 540 + i * wmSize * 0.92, l, { size: wmSize, weight: 900, fill: ink, ls: -wmSize * 0.04, font: FONT_DISPLAY })),
    ...(s.volume ? [ladder(430, 812, s.volume, accent, ink)] : []),
    `<line x1="48" y1="834" x2="560" y2="834" stroke="${ink}" stroke-width="1" opacity="0.25"/>`,
    facts(48, 866, f, ink),
    ...(s.edition ? [stamp(560, 870, s.edition, accent)] : []),
  ].join('')
}

// ── 틀 ② 옆띠형 — 파생본(어원편 문법) ──────────────────────────────
function tplSideband(s: TradeCoverSpec, f: TradeCoverFacts): string {
  const { band, tint, accent, ink } = s.palette
  const sideX = 468
  const title = wrapTitle(s.tagline[1] || f.title, 7, 3)
  const tSize = fitSize(title, 400, 70)
  const wm = s.wordmark.slice(0, 2)
  const wmSize = fitSize(wm, 400, 92, -0.04)
  const vert = s.tagline[0]
  return [
    `<rect width="${TRADE_W}" height="${TRADE_H}" fill="${tint}"/>`,
    `<rect x="${sideX}" width="${TRADE_W - sideX}" height="${TRADE_H}" fill="${band}"/>`,
    text(44, 70, s.brand, { size: 18, weight: 700, fill: ink, ls: 4, font: FONT_DISPLAY, opacity: 0.7 }),
    ...wm.map((l, i) => text(44, 170 + i * wmSize * 0.92, l, { size: wmSize, weight: 900, fill: ink, ls: -wmSize * 0.04, font: FONT_DISPLAY })),
    // 큰 한글 제목
    ...title.map((l, i) => text(44, 420 + i * tSize * 1.12, l, { size: tSize, weight: 900, fill: band })),
    // 알약 급 표시
    `<rect x="44" y="${420 + title.length * tSize * 1.12 + 4}" width="${Math.round(textEm(s.level.join(' ')) * 22) + 36}" height="42" rx="21" fill="${ink}"/>`,
    text(62, 420 + title.length * tSize * 1.12 + 33, s.level.join(' '), { size: 22, weight: 700, fill: tint }),
    // 옆띠 세로 문구 — 위에서 아래로
    `<g transform="translate(${sideX + 78} 120) rotate(90)">${text(0, 0, vert, { size: 26, weight: 700, fill: '#ffffff' })}</g>`,
    ...(s.volume ? [ladder(sideX + 16, 700, s.volume, '#ffffff', 'rgba(255,255,255,.6)')] : []),
    text(sideX + 70, 860, s.series, { size: 20, weight: 900, fill: '#ffffff', anchor: 'middle' }),
    facts(44, 866, f, ink),
    ...(s.edition ? [stamp(440, 810, s.edition, accent)] : []),
  ].join('')
}

// ── 틀 ③ 큰 글자형 — 진한 전면 + 두 색 큰 머리글자(빠바 문법) ────────
function tplGlyph(s: TradeCoverSpec, f: TradeCoverFacts): string {
  const { band, tint, accent } = s.palette
  const glyph = (s.wordmark[0] ?? s.series).slice(0, 3)
  const title = wrapTitle(s.tagline[1] || f.title, 11, 2)
  let grid = ''
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++)
      grid += `<rect x="${44 + c * 176}" y="${96 + r * 108}" width="164" height="96" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.55"/>`
  const chars = [...glyph]
  return [
    `<rect width="${TRADE_W}" height="${TRADE_H}" fill="${band}"/>`,
    text(44, 64, s.brand, { size: 18, weight: 700, fill: tint, ls: 4, font: FONT_DISPLAY, opacity: 0.85 }),
    grid,
    text(64, 176, s.tagline[0], { size: 20, weight: 500, fill: tint }),
    // 원 배지 — 급
    `<circle cx="510" cy="370" r="62" fill="${accent}"/>`,
    text(510, 362, s.level[0], { size: 22, weight: 800, fill: band, anchor: 'middle' }),
    text(510, 392, s.level[1], { size: 22, weight: 800, fill: band, anchor: 'middle' }),
    `<text x="28" y="650" font-family="${FONT_DISPLAY}" font-size="${fitSize([glyph], 552, chars.length >= 3 ? 250 : 330, -0.05)}" font-weight="900" letter-spacing="${-fitSize([glyph], 552, chars.length >= 3 ? 250 : 330, -0.05) * 0.05}">${chars
      .map((ch, i) => `<tspan fill="${i % 2 ? accent : tint}">${esc(ch)}</tspan>`)
      .join('')}</text>`,
    ...title.map((l, i) => text(44, 736 + i * 50, l, { size: 44, weight: 900, fill: tint })),
    ...(s.volume ? [ladder(420, 836, s.volume, accent, tint)] : []),
    facts(44, 868, f, tint),
    text(564, 868, s.series, { size: 18, weight: 800, fill: tint, anchor: 'end' }),
  ].join('')
}

// ── 틀 ④ 하단 판형 — 진한 면 + 사선 + 흰 판에 가늘게/굵게 나눈 제목(수능 1 Up 문법) ──
function tplSlab(s: TradeCoverSpec, f: TradeCoverFacts): string {
  const { band, tint, accent, ink } = s.palette
  const slabY = Math.round(TRADE_H * 0.8)
  const title = wrapTitle(s.tagline[1] || f.title, 12, 2)
  return [
    `<rect width="${TRADE_W}" height="${TRADE_H}" fill="${band}"/>`,
    text(44, 64, s.brand, { size: 18, weight: 700, fill: tint, ls: 4, font: FONT_DISPLAY, opacity: 0.85 }),
    ...(() => {
      const wm = s.wordmark.slice(0, 2)
      const z = fitSize(wm, 500, 170, -0.04)
      return wm.map((l, i) => text(36, 230 + i * z * 0.88, l, { size: z, weight: 900, fill: tint, ls: -z * 0.04, font: FONT_DISPLAY }))
    })(),
    // 사선 한 줄 + 끝 표지
    `<line x1="44" y1="${slabY - 60}" x2="560" y2="330" stroke="${accent}" stroke-width="3"/>`,
    `<circle cx="560" cy="330" r="10" fill="${accent}"/>`,
    `<g transform="translate(572 90) rotate(90)">${text(0, 0, s.tagline[0], { size: 20, weight: 600, fill: tint, opacity: 0.85 })}</g>`,
    levelBadge(520, slabY - 190, s.level, tint, 30),
    `<rect y="${slabY}" width="${TRADE_W}" height="${TRADE_H - slabY}" fill="#ffffff"/>`,
    ...title.map((l, i) => {
      const [first, ...rest] = l.split(' ')
      return `<text x="44" y="${slabY + 56 + i * 44}" font-family="${FONT}" font-size="38" fill="${ink}"><tspan font-weight="300">${esc(first ?? '')}</tspan>${
        rest.length ? `<tspan font-weight="900"> ${esc(rest.join(' '))}</tspan>` : ''
      }</text>`
    }),
    facts(44, TRADE_H - 22, f, ink, 15),
    ...(s.volume ? [ladder(430, TRADE_H - 18, s.volume, accent, ink)] : []),
  ].join('')
}

// ── 틀 ⑤ 담백형 — 옅은 단색 + 오른쪽 정렬 제목 + LEVEL 원(딥독 문법) ──
function tplMinimal(s: TradeCoverSpec, f: TradeCoverFacts): string {
  const { band, tint, accent, ink } = s.palette
  const title = wrapTitle(s.tagline[1] || f.title, 7, 3)
  const n = s.volume?.index
  return [
    `<rect width="${TRADE_W}" height="${TRADE_H}" fill="${tint}"/>`,
    text(44, 70, s.brand, { size: 18, weight: 700, fill: band, ls: 4, font: FONT_DISPLAY }),
    text(44, 104, s.series, { size: 26, weight: 900, fill: ink }),
    // 알약 분류 + LEVEL 원
    `<rect x="44" y="150" width="${s.level[0].length * 22 + 40}" height="44" rx="22" fill="none" stroke="${band}" stroke-width="2"/>`,
    text(64, 180, s.level[0], { size: 22, weight: 700, fill: band }),
    `<circle cx="486" cy="210" r="76" fill="${band}"/>`,
    text(486, 196, n ? 'LEVEL' : s.level[1], { size: n ? 20 : 26, weight: 800, fill: tint, anchor: 'middle', font: FONT_DISPLAY, ls: n ? 3 : 0 }),
    ...(n ? [text(486, 250, String(n), { size: 60, weight: 900, fill: tint, anchor: 'middle', font: FONT_DISPLAY })] : []),
    ...title.map((l, i) => text(560, 480 + i * fitSize(title, 500, 76) * 1.1, l, { size: fitSize(title, 500, 76), weight: 900, fill: band, anchor: 'end' })),
    text(560, 480 + title.length * fitSize(title, 500, 76) * 1.1 + 10, s.tagline[0], { size: 20, weight: 500, fill: ink, anchor: 'end' }),
    ...s.wordmark.slice(0, 1).map((l) => text(44, 790, l, { size: fitSize([l], 340, 64), weight: 900, fill: accent, ls: -2, font: FONT_DISPLAY, opacity: 0.9 })),
    ...(s.volume ? [ladder(420, 812, s.volume, band, ink)] : []),
    facts(44, 866, f, ink),
    ...(s.edition ? [stamp(560, 870, s.edition, band)] : []),
  ].join('')
}

const TEMPLATES: Record<TradeTemplate, (s: TradeCoverSpec, f: TradeCoverFacts) => string> = {
  band: tplBand,
  sideband: tplSideband,
  glyph: tplGlyph,
  slab: tplSlab,
  minimal: tplMinimal,
}

/**
 * 표지 SVG 문자열. `title` 은 스크린리더용 이름이다(표지 그림 자체는 장식이 아니라 정보).
 */
export function tradeCoverSvg(spec: TradeCoverSpec, facts: TradeCoverFacts): string {
  const body = TEMPLATES[spec.template](spec, facts)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TRADE_W} ${TRADE_H}" role="img" aria-label="${esc(
    `${facts.title} 표지`,
  )}" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:100%">${body}</svg>`
}

const HEX = /^#[0-9a-f]{6}$/i

/** 명세 검증 — 파이프라인 import 와 테스트가 같은 규칙을 쓴다. 문제 목록을 돌려준다(빈 배열 = 통과). */
export function validateTradeSpec(x: unknown): string[] {
  const e: string[] = []
  const s = x as Partial<TradeCoverSpec> | null
  if (!s || typeof s !== 'object') return ['명세가 객체가 아니다']
  if (!TRADE_MODES.includes(s.mode as TradeMode)) e.push(`mode: ${String(s.mode)}`)
  if (!TRADE_TEMPLATES.includes(s.template as TradeTemplate)) e.push(`template: ${String(s.template)}`)
  if (!s.brand?.trim()) e.push('brand 비었음')
  if (!s.series?.trim()) e.push('series 비었음')
  if (!Array.isArray(s.wordmark) || s.wordmark.length < 1 || s.wordmark.length > 3 || s.wordmark.some((w) => !w?.trim() || w.length > 8))
    e.push('wordmark: 1~3줄, 줄당 1~8자')
  if (!Array.isArray(s.level) || s.level.length !== 2 || s.level.some((l) => !l?.trim())) e.push('level: 2줄')
  if (!Array.isArray(s.tagline) || s.tagline.length !== 2 || !s.tagline[0]?.trim()) e.push('tagline: [훅, 굵은 줄]')
  const p = s.palette
  if (!p || !(['band', 'tint', 'accent', 'ink'] as const).every((k) => HEX.test(p[k] ?? ''))) e.push('palette: band/tint/accent/ink #rrggbb')
  if (s.mode === 'series' && !s.volume) e.push('series 는 volume(index/total)이 있어야 한다')
  if (s.mode === 'standalone' && s.volume) e.push('standalone 은 volume 을 갖지 않는다')
  if (s.volume && !(s.volume.index >= 1 && s.volume.index <= s.volume.total && s.volume.total <= 12)) e.push('volume: 1 ≤ index ≤ total ≤ 12')
  return e
}
