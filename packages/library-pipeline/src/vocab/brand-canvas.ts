// packages/library-pipeline/src/vocab/brand-canvas.ts
//
// **브랜드 캔버스 — Claude Design 이 만든 시리즈 규격이 파이프라인에 들어오는 자리.**
//
// ── 왜 필요한가 ────────────────────────────────────────────────────
// 단어장 표지는 지금 **자동 수집 + 듀오톤**이다(`covers/design.ts`): PD 도판을 Openverse 에서
// 찾아 계열 색으로 누른다. 그것만으로도 서가가 한 시리즈로 읽히지만, **브랜드는 아니다** —
// 로고 lockup 도, 권 번호 표기도, 표지 격자도, 시리즈 부제도 정해진 적이 없다.
// 그 결정은 눈으로 보고 손으로 옮겨야 하는 종류라 코드로 짜 넣을 수 없다.
//
// 그래서 **Claude Design 캔버스**를 파이프라인 단계로 둔다 —
// 아트보드에서 계열 다섯의 표지 규격을 그려 확정하고, 그 결과를 이 타입으로 받아 적재한다.
// 사람이 캔버스에서 값을 바꾸면 다시 내보내 같은 문으로 들어온다.
//
// ── 절대 규칙: 색을 값으로 적지 않는다 ──────────────────────────────
// 이 저장소는 같은 사고를 두 번 겪었다 — 교재 조판기가 자기 팔레트를 따로 갖고 있어 다섯
// 항목이 전부 토큰과 어긋났고(`textbook/brand.ts`), 단어장 표지도 듀오톤 색 10개를 손으로
// 적어 두었다가 그중 둘만 토큰의 사본이었다(`covers/design.ts`).
//
// **그래서 캔버스는 hex 를 담을 수 없다.** 담으면 `validateBrandCanvas` 가 거절한다.
// 담는 것은 **역할 이름**(`ink`·`paper`·`accent`)뿐이고, 실제 색은 `FAMILY_DUOTONE` 과
// `CATALOG_PALETTE` 가 토큰에서 읽는다. 토큰이 바뀌면 브랜드도 따라 바뀐다.

import { FAMILY_DUOTONE, type CoverFamily } from './brand'

/** 계열 다섯 — `blueprints.ts` 의 `family` 와 같은 눈금이다. */
export const BRAND_FAMILIES = Object.keys(FAMILY_DUOTONE.light) as CoverFamily[]

/** 표지에서 색이 하는 일. 값이 아니라 **자리 이름**이다. */
export type PaletteRole = 'ink' | 'paper' | 'accent' | 'spine' | 'plate'

/** 서체도 이름으로만 — 값은 `CATALOG_FONTS` 가 토큰에서 읽는다. */
export type FontRole = 'english' | 'body' | 'mono'

export interface VocabBrandCanvas {
  family: CoverFamily
  /** 계열 부제 — 표지 상단에 브랜드와 함께 앉는 한 줄. */
  seriesLine: string
  /** 결 — 이 계열의 시각 방향 한 줄. `covers/design.ts` 의 `FAMILY_GRAIN.grain` 과 같은 자리. */
  grain: string
  /** 표지 lockup — 무엇이 어느 자리에 오는가. */
  lockup: {
    /** 표지 맨 위 작은 글자. 보통 시리즈 브랜드. */
    kicker: string
    /** 권 번호 표기 규격. `{n}` 이 번호 자리다. */
    volumeFormat: string
    /**
     * 제목이 넘칠 때 몇 줄까지 허용하나.
     *
     * ⚠️ **이 값은 480×640 판형이 아니라 화면의 실제 표지에서 재야 한다** (실측 2026-09-07).
     *   캔버스는 480px 폭에서 그려졌고 거기서는 2줄이 30자를 담는다. 그런데 제품의 표지는
     *   격자 타일에서 **150px** 이라 같은 2줄이 14자밖에 못 담는다 —
     *   발행 55권의 제목은 최장 35자(`Pride and Prejudice 1~5장 · 다시 만날 단어`)이고
     *   20자 이상이 6권이다. 2 를 그대로 화면에 적용하면 그 여섯 권의 제목이 잘린다.
     *
     *   그래서 상한을 5 까지 연다. **캔버스가 정본이라는 말은 캔버스가 늘 옳다는 뜻이 아니라,
     *   틀렸을 때 코드가 아니라 캔버스를 고친다는 뜻이다.**
     */
    titleMaxLines: 1 | 2 | 3 | 4 | 5
  }
  /** 표지 격자 — 도판이 앉는 비율과 여백. */
  coverGrid: {
    /** `3:4` 처럼 가로:세로. */
    ratio: string
    /** 도판 안쪽 여백(%). 0 이면 꽉 차게. */
    plateInset: number
    /** 도판 위 글자가 읽히도록 덮는 정도(0~1). */
    scrimStrength: number
  }
  /** 색 — **역할 이름만.** hex 를 넣으면 검증에서 걸린다. */
  palette: Record<'ink' | 'paper' | 'accent', PaletteRole>
  typography: { display: FontRole; body: FontRole; numerals: FontRole }
  /** Claude Design 캔버스 주소 — 사람이 손으로 다듬는 자리. 없을 수 있다. */
  canvasUrl: string | null
  designedAt: string
  designedBy: 'claude-design'
}

/**
 * **규격의 씨앗** — 계열이 달라도 같은 값들.
 *
 * 캔버스가 정본이지만 캔버스는 DB 에 있고, 아트보드(`brand-drain-artboards.mts`)는 그 규격을
 * **그림으로** 보여 주는 자리다. 둘이 각자 숫자를 들고 있으면 반드시 갈린다 —
 * 실제로 아트보드는 「최대 2줄」을 문자열로 박아 두고 있었다(2026-09-07 발견).
 *
 * 그래서 여기 한 벌만 둔다: 아트보드가 이것을 그리고, 드레인 산출물(`chunk-NN.out.json`)이
 * 이것을 담고, 화면은 DB 에 적재된 그 값을 읽는다. **화면이 이 상수를 직접 읽지 않는다** —
 * 읽으면 DB 를 고쳐도 표지가 안 따라오고, 그 순간 캔버스가 다시 장식이 된다.
 */
export const BRAND_LOCKUP_SPEC = {
  kicker: 'VOCAFLOW VOCABULARY',
  volumeFormat: 'VOL. {n}',
  /** 4 인 이유는 `titleMaxLines` 주석에 있다 — 480px 판형이 아니라 150px 타일에서 잰 값이다. */
  titleMaxLines: 4,
} as const satisfies VocabBrandCanvas['lockup']

export const BRAND_COVER_GRID = {
  ratio: '3:4',
  plateInset: 8,
  /**
   * 0.35 — 제목 띠에서 흰 글자의 대비 하한이 **9.28:1**(다크 corpus)로 WCAG AA(4.5) 의 두 배다.
   * 실측 2026-09-07: 계열 10벌(라이트·다크) 전부 9.28~18.89.
   */
  scrimStrength: 0.35,
} as const satisfies VocabBrandCanvas['coverGrid']

/** hex·rgb·hsl 어느 형태든 **색 값**이면 잡는다. */
const COLOR_VALUE = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\s*\(/i

export interface BrandCanvasProblem {
  field: string
  message: string
}

/**
 * 캔버스가 적재할 수 있는 상태인가.
 *
 * **비어 있는 것을 통과시키지 않는다** — 빈 브랜드가 적재되면 다음 export 가 "이미 했다" 로
 * 세어 그 계열이 영영 빈 채로 남는다(CLAUDE.md §드레인 규칙: import 는 빈 값을 넣지 않는다).
 */
export function validateBrandCanvas(input: unknown): BrandCanvasProblem[] {
  const problems: BrandCanvasProblem[] = []
  const c = input as Partial<VocabBrandCanvas> | null
  if (!c || typeof c !== 'object') return [{ field: '(root)', message: '객체가 아니다' }]

  if (!c.family || !BRAND_FAMILIES.includes(c.family)) {
    problems.push({ field: 'family', message: `계열이 아니다 (${BRAND_FAMILIES.join('·')})` })
  }
  for (const [field, min] of [['seriesLine', 2], ['grain', 6]] as const) {
    const v = (c as Record<string, unknown>)[field]
    if (typeof v !== 'string' || v.trim().length < min) {
      problems.push({ field, message: `${min}자 이상이어야 한다 — 빈 값은 적재하지 않는다` })
    }
  }
  if (!c.lockup || typeof c.lockup.kicker !== 'string' || c.lockup.kicker.trim() === '') {
    problems.push({ field: 'lockup.kicker', message: '표지 맨 위 글자가 비었다' })
  }
  if (!c.lockup || typeof c.lockup.volumeFormat !== 'string' || !c.lockup.volumeFormat.includes('{n}')) {
    problems.push({ field: 'lockup.volumeFormat', message: '번호 자리 `{n}` 이 없다' })
  }
  // 줄 수는 **표지가 실제로 읽는 값**이다 — 범위를 벗어난 값이 들어오면 제목이 통째로
  // 사라지거나(0) 클램프가 풀린다. 빈 값과 같은 급으로 막는다.
  if (!c.lockup || ![1, 2, 3, 4, 5].includes(Number(c.lockup.titleMaxLines))) {
    problems.push({ field: 'lockup.titleMaxLines', message: '1~5 줄이어야 한다' })
  }
  if (!c.coverGrid || !Number.isFinite(c.coverGrid.plateInset)
      || c.coverGrid.plateInset < 0 || c.coverGrid.plateInset > 40) {
    problems.push({ field: 'coverGrid.plateInset', message: '0~40(%) 이어야 한다' })
  }
  if (!c.coverGrid || !/^\d+:\d+$/.test(String(c.coverGrid.ratio))) {
    problems.push({ field: 'coverGrid.ratio', message: '`3:4` 형태여야 한다' })
  }
  if (!c.coverGrid || !(c.coverGrid.scrimStrength >= 0 && c.coverGrid.scrimStrength <= 1)) {
    problems.push({ field: 'coverGrid.scrimStrength', message: '0~1 이어야 한다' })
  }

  /*
    색 값 금지 — 이 검사가 이 파일의 존재 이유다. 캔버스 어디에든 hex/rgb 가 들어오면
    그 순간 토큰이 정본이 아니게 되고, 토큰을 고쳐도 서가가 따라오지 않는다.
  */
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'string') {
      if (COLOR_VALUE.test(v)) {
        problems.push({ field: path, message: '색 값을 담을 수 없다 — 역할 이름만 (토큰이 정본)' })
      }
      return
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k)
    }
  }
  walk(c, '')

  const ROLES: PaletteRole[] = ['ink', 'paper', 'accent', 'spine', 'plate']
  for (const k of ['ink', 'paper', 'accent'] as const) {
    const role = c.palette?.[k]
    if (!role || !ROLES.includes(role)) {
      problems.push({ field: `palette.${k}`, message: `역할 이름이어야 한다 (${ROLES.join('·')})` })
    }
  }
  const FONTS: FontRole[] = ['english', 'body', 'mono']
  for (const k of ['display', 'body', 'numerals'] as const) {
    const f = c.typography?.[k]
    if (!f || !FONTS.includes(f)) {
      problems.push({ field: `typography.${k}`, message: `서체 역할이어야 한다 (${FONTS.join('·')})` })
    }
  }
  if (c.designedBy !== 'claude-design') {
    problems.push({ field: 'designedBy', message: "'claude-design' 이어야 한다" })
  }
  if (typeof c.designedAt !== 'string' || Number.isNaN(Date.parse(c.designedAt))) {
    problems.push({ field: 'designedAt', message: 'ISO 시각이어야 한다 — 낡았는지 볼 수 있어야 한다' })
  }
  return problems
}

/**
 * 캔버스의 색을 **지금 토큰으로** 푼다.
 *
 * 규격은 역할만 들고 있으므로 실제 색은 늘 여기서 나온다 — 화면도 리포트도 이 함수를 쓴다.
 * 그래서 토큰이 바뀌면 표지가 같은 턴에 따라 바뀐다.
 */
export function resolveBrandColors(
  canvas: Pick<VocabBrandCanvas, 'family' | 'palette'>,
  theme: 'light' | 'dark' = 'light',
): { ink: string; paper: string } {
  const duo = FAMILY_DUOTONE[theme][canvas.family]
  /*
    **역할을 실제로 따라간다.** 예전에는 `duo.ink`·`duo.paper` 를 그대로 돌려주어
    `palette` 가 무엇을 적든 결과가 같았다 — 그러면 규격이 규격이 아니라 장식이 된다.
    듀오톤이 가진 자리는 둘(`ink`·`paper`)뿐이고, `accent`·`spine`·`plate` 는 서가 팔레트
    (`CATALOG_PALETTE`)의 자리라 여기서 풀 수 없다. 그래서 그 셋이 오면 자연스러운 짝으로
    떨어뜨린다 — 표지가 사라지는 것보다 낫다.
  */
  const pick = (role: PaletteRole, fallback: 'ink' | 'paper'): string =>
    role === 'ink' || role === 'paper' ? duo[role] : duo[fallback]
  return { ink: pick(canvas.palette.ink, 'ink'), paper: pick(canvas.palette.paper, 'paper') }
}
