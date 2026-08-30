// packages/library-pipeline/src/textbook/brand.ts
//
// **교재 브랜딩 — 조판물이 Vocaflow 로 보이게 하는 규격.**
//
// ── 왜 필요한가 (2026-08-30 실측) ───────────────────────────────────
// `render-volume.mjs` 가 **자기 팔레트를 따로 갖고 있었다.** 디자인 토큰과 대조하니
// 다섯 항목이 전부 어긋나 있었다:
//
//   조판기 --accent #7a3b2e (테라코타)  ↔  토큰 --active #B0843A (뮤티드 골드)
//   조판기 --ink    #1a1a1a            ↔  토큰 --t1     #1A1714
//   조판기 --bg     #fbfaf7            ↔  토큰 --bg     #FBFAF6
//   조판기 --line   #d8d4cd            ↔  토큰 --bd     #E0DBD0
//   조판기 Iowan Old Style             ↔  토큰 Lora (v06.39 영문 시그니처)
//
// 루트 CLAUDE.md 는 "CSS Variables 로 테마 제어 — 하드코딩 금지" 라고 적어 두었는데,
// 조판기는 그 밖에 있어서 아무도 안 봤다. **교재는 학습자가 손에 쥐는 물건이라
// 여기서 어긋나면 브랜드가 어긋난 것이다.**
//
// ── 어떻게 다시 어긋나지 않게 하는가 ────────────────────────────────
// 값을 여기 다시 적지 않는다 — `@vocaflow/design-tokens` 에서 **읽는다.**
// 토큰이 바뀌면 교재도 같이 바뀌고, 테스트가 두 곳의 값을 대조한다.

import { colorsDark, colorsLight, fontFamily } from '@vocaflow/design-tokens'

/** 시리즈 이름. 바꾸려면 `series.ts` 의 `SERIES_BRAND` 하나만 고친다. */
export { SERIES_BRAND } from './series'

/**
 * 조판 팔레트 — **토큰에서 읽는다.**
 *
 * 이름이 다른 이유는 조판이 화면이 아니라 지면이기 때문이다(`line` = 괘선,
 * `slot` = 빈칸 표시). 값은 토큰 그대로다.
 */
export const VOLUME_PALETTE = {
  light: {
    ink: colorsLight.t1,
    sub: colorsLight.t3,
    line: colorsLight.bd,
    bg: colorsLight.bg,
    /** 표제·번호에 쓰는 색. 골드는 작은 글자로 쓰면 대비가 모자라 잉크 쪽을 쓴다. */
    accent: colorsLight.activeInk,
    /** 빈칸·밑줄 자리 — 본문과 구별되어야 하지만 튀면 안 된다. */
    slot: colorsLight.p,
  },
  dark: {
    ink: colorsDark.t1,
    sub: colorsDark.t3,
    line: colorsDark.bd,
    bg: colorsDark.bg2,
    accent: colorsDark.activeInk,
    slot: colorsDark.p,
  },
} as const

/** 조판 서체 — 영문 지문은 Lora(v06.39 에서 display 로 승격된 시그니처). */
export const VOLUME_FONTS = {
  /** 지문·문항 본문. 학습자가 읽어야 할 영문은 전부 이 서체다. */
  english: fontFamily.english.join(', '),
  /** 한국어 해설·라벨. */
  body: fontFamily.body.join(', '),
  /** 문항 번호·수치. 자리가 맞아야 표가 읽힌다. */
  mono: fontFamily.mono.join(', '),
} as const

/**
 * 판권면 — 상업 교재가 반드시 싣는 것.
 *
 * 없으면 "누가 언제 만들었고 무엇을 근거로 썼는지" 를 알 수 없다. 특히 **출처 정책**은
 * 이 교재가 공개 저작물에서 왔다는 사실을 밝히는 자리라, 빠지면 법적 근거가 사라진다.
 */
export interface Colophon {
  /** 이 권의 제목. `SERIES_SPINE` 의 `volumeTitle`. */
  title: string
  /** 사다리에서의 자리 — "5단 · 고1". 독자가 다음 권을 고를 수 있어야 한다. */
  ladder: string
  /** 판차. 같은 권을 다시 찍으면 올라간다. */
  edition: string
  /** 발행일 — ISO 날짜. */
  issued: string
  /** 지문 출처 정책 한 줄. */
  sourcePolicy: string
  /** 자동 검수 통과 수 / 전체 — 시중 교재의 "감수" 자리에 해당한다. */
  review: string
}

export interface ColophonInput {
  title: string
  step: number | null
  schoolBand: string | null
  vLevel: number
  issued?: Date
  autoPassed: number
  autoTotal: number
}

/**
 * 판권면을 만든다. **수치를 지어내지 않는다** — 검수 통과 수는 실제 채점 결과를 받는다.
 */
export function buildColophon(input: ColophonInput): Colophon {
  const issued = input.issued ?? new Date()
  const iso = issued.toISOString().slice(0, 10)
  return {
    title: input.title,
    ladder:
      input.step != null && input.schoolBand
        ? `${input.step}단 · ${input.schoolBand}`
        : `V${input.vLevel}`,
    edition: `초판 ${iso.slice(0, 4)}`,
    issued: iso,
    sourcePolicy:
      '지문은 공개 저작물(퍼블릭 도메인·CC)에서 가져와 학습용으로 편집했고, 각 지문 아래에 출처를 밝힌다.',
    review: `자동 검수 ${input.autoPassed}/${input.autoTotal} 통과`,
  }
}

/**
 * 사다리 일곱 단 중 이 권의 자리를 문자열로 그린다.
 *
 * 시중 교재는 뒤표지에 시리즈 전체를 싣고 지금 권을 표시한다 — 독자가 **다음에 무엇을
 * 살지** 알 수 있어야 하기 때문이다. 숫자만 적으면 그 일을 못 한다.
 */
export function ladderStrip(step: number | null, total = 7): string[] {
  return Array.from({ length: total }, (_, i) => {
    const n = i + 1
    return n === step ? `[${n}]` : `${n}`
  })
}

/** 조판 팔레트 한 벌. 라이트·다크가 **같은 키**를 가져야 테마가 짝을 이룬다. */
export interface VolumePalette {
  ink: string
  sub: string
  line: string
  bg: string
  accent: string
  slot: string
}

/**
 * 조판 CSS 변수 블록 — 세 테마 상태를 모두 낸다.
 *
 * 무표시(system)가 기본값이라 **라이트는 bare `:root` 에 있어야 한다.**
 * 미디어 쿼리 안에만 두면 테마를 고르지 않은 독자가 색을 잃는다.
 */
export function volumeCssVariables(): string {
  const decl = (p: VolumePalette): string =>
    `--ink:${p.ink};--sub:${p.sub};--line:${p.line};--bg:${p.bg};--accent:${p.accent};--slot:${p.slot}`
  const l = decl(VOLUME_PALETTE.light)
  const d = decl(VOLUME_PALETTE.dark)
  return [
    `:root{${l}}`,
    `@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){${d}}}`,
    `:root[data-theme="dark"]{${d}}`,
  ].join('\n')
}

/**
 * 브랜드 규격의 **지문** — 조판 CSS 변수 + 서체 스택을 한 문자열로 해시한 값.
 *
 * ── 무엇에 쓰나 ─────────────────────────────────────────────────────
 * 조판기가 이 값을 조판 기록(`textbook_volume_renders.brand_fingerprint`)에 남긴다.
 * 나중에 토큰이 바뀌면 현재 지문이 달라지므로, **화면이 "이 권은 옛 규격으로
 * 조판됐다" 를 말할 수 있다.** 색을 DB 에 복사해 두면 정본이 둘이 되므로 그러지 않는다.
 *
 * FNV-1a 를 쓰는 이유는 의존성 없이 어디서나(노드·브라우저·스크립트) 같은 값이
 * 나와야 하기 때문이다. 암호학적 용도가 아니다 — 같은지 다른지만 본다.
 */
export function brandFingerprint(): string {
  const material = [
    volumeCssVariables(),
    VOLUME_FONTS.english,
    VOLUME_FONTS.body,
    VOLUME_FONTS.mono,
  ].join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < material.length; i += 1) {
    h ^= material.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** 규격 한 줄 — 화면이 표로 그린다. */
export interface BrandSpecRow {
  key: string
  /** 지면에서 이것이 무슨 자리인지. 색 이름을 그대로 쓰면 관리자가 못 읽는다. */
  label: string
  light: string
  dark: string
}

/**
 * 조판 규격을 사람이 읽을 표로 낸다.
 *
 * **여기서 값을 적지 않는다** — `VOLUME_PALETTE` 를 읽고, 그 팔레트는 토큰을 읽는다.
 * 화면·테스트·조판기가 전부 같은 한 곳을 본다.
 */
export function brandSpecRows(): BrandSpecRow[] {
  const rows: ReadonlyArray<[keyof VolumePalette, string]> = [
    ['ink', '본문 잉크'],
    ['sub', '보조 글자 — 출처·해설 꼬리말'],
    ['line', '괘선 — 표·구분선'],
    ['bg', '지면 바탕'],
    ['accent', '표제·문항 번호'],
    ['slot', '빈칸·밑줄 자리'],
  ]
  return rows.map(([key, label]) => ({
    key,
    label,
    light: VOLUME_PALETTE.light[key],
    dark: VOLUME_PALETTE.dark[key],
  }))
}
