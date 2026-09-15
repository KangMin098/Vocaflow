// packages/library-pipeline/src/vocab/brand.ts
//
// **단어장 브랜딩 — 카탈로그가 한 출판사의 서가로 보이게 하는 규격.**
//
// ── 왜 필요한가 (2026-08-30 실측) ───────────────────────────────────
// `/library/vocab` 은 발행 세트 **70권**을 격자로 늘어놓는다. 그런데 그 70권에는
// 출판사가 없었다 — 시리즈 이름도, 판권면도, 사다리에서의 자리도 없다. 학습자가 보는 것은
// 제목과 이모지뿐이라 **누가 무슨 기준으로 만든 것인지 알 수 없다.**
//
// 시중 단어장은 그 반대다. 능률VOCA 한 권을 집으면 표지에 시리즈가 있고, 뒤에 사다리가
// 있고(다음에 뭘 살지), 판권면에 발행일·판차가 있다. **그게 있어야 "출판물" 로 읽힌다.**
//
// 교재 쪽은 이 문제를 이미 풀었다(`textbook/brand.ts`) — 그때 배운 것이 하나 있다:
//
//   > 조판기가 **자기 팔레트를 따로 갖고 있었다.** 디자인 토큰과 대조하니 다섯 항목이
//   > 전부 어긋나 있었다.
//
// 단어장 표지도 같은 상태다. `apps/web/src/lib/vcb/covers/design.ts` 의 `FAMILY_GRAIN` 이
// 듀오톤 색 10개를 **손으로 적어** 갖고 있고, 그중 둘은 토큰값의 사본이다
// (`#2E7D5A` = success · `#9C3A30` 계열). 사본이라 토큰이 바뀌어도 따라오지 않는다.
// **그래서 여기서도 값을 다시 적지 않는다 — 토큰에서 읽는다.**

import {
  colorsDark, colorsLight, fontFamily, iosColors, iosColorsDark,
} from '@vocaflow/design-tokens'

export {
  VOCAB_SERIES_BRAND, VOCAB_SPINE, vocabRungs, rungForVLevel, opensAtStep,
  stepOpeningBlueprint, resolveLadderStep,
} from './series'
export type { VocabRung, VocabBlueprintId } from './series'

/**
 * 카탈로그 팔레트 — **토큰에서 읽는다.**
 *
 * 이름이 화면 토큰과 다른 이유는 여기가 **서가**이기 때문이다(`spine` = 책등,
 * `plate` = 표지 도판이 앉는 자리). 값은 토큰 그대로다.
 */
export const CATALOG_PALETTE = {
  light: {
    ink: colorsLight.t1,
    sub: colorsLight.t3,
    line: colorsLight.bd,
    bg: colorsLight.bg,
    /** 시리즈명·권 번호. 골드는 작은 글자로 대비가 모자라 잉크 쪽을 쓴다. */
    accent: colorsLight.activeInk,
    /** 책등 — 서가에서 권을 가르는 색. */
    spine: colorsLight.p,
    /** 표지 도판이 앉는 바탕. */
    plate: colorsLight.bg2,
  },
  dark: {
    ink: colorsDark.t1,
    sub: colorsDark.t3,
    line: colorsDark.bd,
    bg: colorsDark.bg2,
    accent: colorsDark.activeInk,
    spine: colorsDark.p,
    plate: colorsDark.bg3,
  },
} as const

/**
 * 팔레트 한 벌. 라이트·다크가 **같은 키**를 가져야 테마가 짝을 이룬다.
 *
 * ⚠️ `typeof CATALOG_PALETTE.light` 로 두면 `as const` 때문에 값이 **리터럴 타입**이 되어
 *   다크 팔레트를 같은 함수에 못 넘긴다(`'#F0EAE0' is not assignable to '#1A1714'`).
 *   그래서 필드를 `string` 으로 여는 인터페이스를 따로 선언한다 — 교재 쪽도 같은 이유로
 *   `VolumePalette` 를 갖고 있다.
 */
export interface CatalogPalette {
  ink: string
  sub: string
  line: string
  bg: string
  accent: string
  spine: string
  plate: string
}

/** 카탈로그 서체 — 표제어는 영문 시그니처(Lora), 뜻풀이는 본문체. */
export const CATALOG_FONTS = {
  /** 표제어. 학습자가 읽어야 할 영문은 전부 이 서체다. */
  english: fontFamily.english.join(', '),
  /** 한국어 뜻·해설. */
  body: fontFamily.body.join(', '),
  /** 번호·수치. 자리가 맞아야 표가 읽힌다. */
  mono: fontFamily.mono.join(', '),
} as const

/**
 * 계열 듀오톤 — 표지 도판을 누르는 색.
 *
 * **다섯 계열이 `blueprints.ts` 의 `family` 와 같은 눈금이다.** 출처가 제각각인 PD 도판도
 * 같은 색으로 누르면 한 시리즈로 읽힌다 — 카테고리 칩이 못 하던 일을 표지가 한다.
 *
 * ⚠️ 값을 여기서 정하지 않는다. 토큰의 색을 **역할로** 골라 쓴다:
 *   list=info(세어서 줄 세운 것 — 도표의 찬 파랑) · structure=success(갈라져 자란 것 — 식물도감) ·
 *   corpus=warning(이야기·오래된 종이 — 세피아) · delivery=p(반복·기계 — 시계 판화의 짙은 잉크) ·
 *   unique=ios purple(이 플랫폼만 그리는 성좌도 — Admin 액센트와 같은 계열).
 *   어느 것도 학습 상태를 뜻하는 자리가 아니라 Memory Decay 4색과 의미가 충돌하지 않는다.
 *
 * ⚠️ **알파가 있는 토큰을 쓰지 않는다.** `ink` 는 `mix-blend-multiply`, `paper` 는
 *   `mix-blend-screen` 으로 도판 위에 얹힌다 — 반투명 값을 넣으면 블렌드가 흐려져
 *   계열 색이 구별되지 않는다. 그래서 `t3`(rgba)·다크의 `*Light`(rgba) 대신 solid 를 고른다.
 */
export const FAMILY_DUOTONE = {
  light: {
    list: { ink: colorsLight.info, paper: colorsLight.infoLight },
    structure: { ink: colorsLight.success, paper: colorsLight.successLight },
    corpus: { ink: colorsLight.warning, paper: colorsLight.warningLight },
    delivery: { ink: colorsLight.p, paper: colorsLight.pLight },
    unique: { ink: iosColors.purple, paper: iosColors.purpleTint },
  },
  dark: {
    list: { ink: colorsDark.info, paper: colorsDark.bg3 },
    structure: { ink: colorsDark.success, paper: colorsDark.bg3 },
    corpus: { ink: colorsDark.warning, paper: colorsDark.bg3 },
    delivery: { ink: colorsDark.p, paper: colorsDark.bg3 },
    unique: { ink: iosColorsDark.purple, paper: colorsDark.bg3 },
  },
} as const

export type CoverFamily = keyof typeof FAMILY_DUOTONE.light

/**
 * 판권면 — 상업 단어장이 반드시 싣는 것.
 *
 * 없으면 "누가 언제 만들었고 표제어를 무엇으로 골랐는지" 를 알 수 없다. 특히 **선정 근거**는
 * 단어장에서 판권면보다 중요하다 — 학습자가 "왜 하필 이 낱말들인가" 를 묻기 때문이고,
 * 시중 단어장이 서문에서 가장 먼저 답하는 질문이기도 하다.
 */
export interface VocabColophon {
  /** 이 권의 제목. */
  title: string
  /** 사다리에서의 자리 — "5단 · 고1". 학습자가 다음 권을 고를 수 있어야 한다. */
  ladder: string
  /** 판차. 같은 권을 다시 뽑으면 올라간다. */
  edition: string
  /** 발행일 — ISO 날짜. */
  issued: string
  /** 표제어를 무엇으로 골랐는가 — 청사진의 조직 원리 한 줄. */
  selection: string
  /** 표제어 수 · 하루치 · 며칠. 시장의 `DAY` 관례를 그대로 쓴다. */
  volume: string
  /** 뜻·예문의 출처 정책 한 줄. */
  sourcePolicy: string
  /** 자동 검수 통과 수 / 전체 — 시중 단어장의 "감수" 자리에 해당한다. */
  review: string
}

export interface VocabColophonInput {
  title: string
  step: number | null
  schoolBand: string | null
  vLevel: number
  /** 청사진의 `organizing_principle`. 지어내지 않는다 — 컴포저가 남긴 값을 받는다. */
  selection: string
  wordCount: number
  wordsPerDay: number
  issued?: Date
  autoPassed: number
  autoTotal: number
}

/**
 * 판권면을 만든다. **수치를 지어내지 않는다** — 표제어 수·검수 통과 수는 실측을 받는다.
 *
 * `wordsPerDay` 가 0 이하면 며칠짜리인지 셀 수 없으므로 그 줄을 낱말 수만으로 적는다.
 * (0 으로 나눠 `Infinity일` 이 찍히는 것을 막는다 — 판권면은 학습자가 보는 면이다.)
 */
export function buildVocabColophon(input: VocabColophonInput): VocabColophon {
  const issued = input.issued ?? new Date()
  const iso = issued.toISOString().slice(0, 10)
  const days = input.wordsPerDay > 0 ? Math.ceil(input.wordCount / input.wordsPerDay) : null
  return {
    title: input.title,
    ladder:
      input.step != null && input.schoolBand
        ? `${input.step}단 · ${input.schoolBand}`
        : `V${input.vLevel}`,
    edition: `초판 ${iso.slice(0, 4)}`,
    issued: iso,
    selection: input.selection,
    volume:
      days != null
        ? `표제어 ${input.wordCount.toLocaleString()} · 하루 ${input.wordsPerDay} · ${days}일`
        : `표제어 ${input.wordCount.toLocaleString()}`,
    sourcePolicy:
      '표제어는 공개 말뭉치·공개 어휘 목록에서 골랐고, 뜻과 예문은 이 서비스가 직접 썼다.',
    review: `자동 검수 ${input.autoPassed}/${input.autoTotal} 통과`,
  }
}

/**
 * 사다리 일곱 단 중 이 권의 자리를 그린다.
 *
 * 시중 단어장은 뒤표지에 시리즈 전체를 싣고 지금 권을 표시한다 — 학습자가 **다음에 무엇을
 * 볼지** 알 수 있어야 하기 때문이다. 숫자만 적으면 그 일을 못 한다.
 */
export function ladderStrip(step: number | null, total = 7): string[] {
  return Array.from({ length: total }, (_, i) => {
    const n = i + 1
    return n === step ? `[${n}]` : `${n}`
  })
}

/**
 * 카탈로그 CSS 변수 블록 — 세 테마 상태를 모두 낸다.
 *
 * 무표시(system)가 기본값이라 **라이트는 bare `:root` 에 있어야 한다.**
 * 미디어 쿼리 안에만 두면 테마를 고르지 않은 학습자가 색을 잃는다.
 */
export function catalogCssVariables(): string {
  const decl = (p: CatalogPalette): string =>
    `--ink:${p.ink};--sub:${p.sub};--line:${p.line};--bg:${p.bg}`
    + `;--accent:${p.accent};--spine:${p.spine};--plate:${p.plate}`
  const l = decl(CATALOG_PALETTE.light)
  const d = decl(CATALOG_PALETTE.dark)
  return [
    `:root{${l}}`,
    `@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){${d}}}`,
    `:root[data-theme="dark"]{${d}}`,
  ].join('\n')
}

/**
 * 브랜드 규격의 **지문** — 팔레트 + 듀오톤 + 서체를 한 문자열로 해시한 값.
 *
 * 세트를 발행할 때 이 값을 기록해 두면, 나중에 토큰이 바뀌었을 때 현재 지문과 달라지므로
 * **화면이 "이 권은 옛 규격으로 만들어졌다" 를 말할 수 있다.** 색을 DB 에 복사해 두면
 * 정본이 둘이 되므로 그러지 않는다.
 *
 * FNV-1a 를 쓰는 이유는 의존성 없이 어디서나(노드·브라우저·스크립트) 같은 값이 나와야
 * 하기 때문이다. 암호학적 용도가 아니다 — 같은지 다른지만 본다.
 */
export function vocabBrandFingerprint(): string {
  const material = [
    catalogCssVariables(),
    JSON.stringify(FAMILY_DUOTONE),
    CATALOG_FONTS.english,
    CATALOG_FONTS.body,
    CATALOG_FONTS.mono,
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
  /** 서가에서 이것이 무슨 자리인지. 색 이름을 그대로 쓰면 관리자가 못 읽는다. */
  label: string
  light: string
  dark: string
}

/**
 * 카탈로그 규격을 사람이 읽을 표로 낸다.
 *
 * **여기서 값을 적지 않는다** — `CATALOG_PALETTE` 를 읽고, 그 팔레트는 토큰을 읽는다.
 * 화면·테스트·컴포저가 전부 같은 한 곳을 본다.
 */
export function vocabBrandSpecRows(): BrandSpecRow[] {
  const rows: ReadonlyArray<[keyof CatalogPalette, string]> = [
    ['ink', '표제어 잉크'],
    ['sub', '보조 글자 — 뜻풀이·출처'],
    ['line', '괘선 — 표·구분선'],
    ['bg', '지면 바탕'],
    ['accent', '시리즈명·권 번호'],
    ['spine', '책등 — 서가에서 권을 가르는 색'],
    ['plate', '표지 도판 바탕'],
  ]
  return rows.map(([key, label]) => ({
    key,
    label,
    light: CATALOG_PALETTE.light[key],
    dark: CATALOG_PALETTE.dark[key],
  }))
}
