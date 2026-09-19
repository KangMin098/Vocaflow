// apps/web/src/lib/vcb/covers/lockup.ts
//
// **표지 규격을 DB 에서 읽어 화면이 쓸 수 있는 모양으로 좁힌다.**
//
// ── 왜 이 파일이 생겼나 (실측 2026-09-07) ──────────────────────────
// 브랜드 드레인은 계열 다섯의 표지 규격을 Claude Design 캔버스에서 확정해
// `shared_word_sets.curation_query.brand` 에 각인했다 — 발행 55권 전부. 그런데 그 규격에서
// **화면이 실제로 읽은 것은 `family` 하나뿐**이었다. kicker·권 번호 표기·제목 줄 수·
// 격자 비율·도판 여백·스크림·서체 역할·계열 줄은 적재만 되고 읽는 곳이 없었다.
//
// 더 나쁜 것은 그 값들이 **코드에 사본으로 따로 있었다**는 점이다:
//   · `VOL. {n}` → 저장소 어디에도 렌더가 없었다
//   · kicker `VOCAFLOW VOCABULARY` → 카드는 별도 상수 `VOCAB_SERIES_BRAND` 를 썼다
//   · `scrimStrength 0.35` → `contrast.ts` 는 0.4/0.34 를 들고 있었다 (**이미 갈린 사본**)
//   · `ratio 3:4` → 카드에 `aspect-[3/4]` 로 박혀 있었다
//
// 그래서 규격이 규격이 아니라 장식이었다. 이 파일이 그 통로다 — **DB 가 정본이고,
// 코드 상수는 규격이 없는 권의 하한일 뿐이다.**
//
// ── 없으면 그리지 않는다 ───────────────────────────────────────────
// 각인이 없는 권(도서 챕터·글 단어장 11,044개)에는 `null` 이 돌아간다. 그때 kicker·권 번호는
// **그리지 않는다** — 코드가 기본값을 지어내면 그 순간 두 번째 정본이 생기고, 캔버스를 고쳐도
// 그 권들은 안 따라온다. 색·대비처럼 없으면 화면이 깨지는 것만 `contrast.ts` 의 하한을 쓴다.

import {
  resolveBrandColors,
  type PaletteRole,
  type VocabBrandCanvas,
} from '@vocaflow/library-pipeline/vocab-brand-canvas'

import { coverFamilyOf, type CoverFamily } from './design'

/** 서체 역할 → Tailwind 클래스. 이름이 같은 것은 우연이 아니다(`tailwind.config.ts`). */
const FONT_CLASS = { english: 'font-english', body: 'font-body', mono: 'font-mono' } as const
type FontRole = keyof typeof FONT_CLASS

export interface CoverLockup {
  family: CoverFamily
  /** 계열 줄 — `STRUCTURE · 구조 계열`. 표지에서 색이 무엇을 뜻하는지 말하는 유일한 글자다. */
  seriesLine: string
  /** 표지 맨 위 작은 글자. */
  kicker: string
  /** 권 번호 표기. `{n}` 이 자리다 — 숫자를 여기서 짓지 않는다. */
  volumeFormat: string
  /** 제목 줄 수 상한. */
  titleMaxLines: number
  /** CSS `aspect-ratio` 값 (`3 / 4`). */
  aspectRatio: string
  /** 도판 안쪽 여백(%). */
  plateInset: number
  /** 도판 위 글자를 덮는 정도(0~1). */
  scrimStrength: number
  /** 서체 — 역할이 가리키는 Tailwind 클래스. */
  fontClass: { display: string; body: string; numerals: string }
  /** 계열 듀오톤 — 역할을 따라 푼 값(`resolveBrandColors`). */
  ink: string
  paper: string
}

const isRole = (v: unknown): v is PaletteRole =>
  v === 'ink' || v === 'paper' || v === 'accent' || v === 'spine' || v === 'plate'

const isFontRole = (v: unknown): v is FontRole => typeof v === 'string' && v in FONT_CLASS

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/**
 * jsonb 한 덩어리를 표지가 쓸 수 있는 규격으로 좁힌다. **모양이 안 맞으면 `null`** 이다.
 *
 * ⚠️ 여기서 부분 복구를 하지 않는다(빠진 필드를 기본값으로 채우는 것). 반쯤 채운 규격은
 *   "규격대로 그린 표지" 처럼 보이면서 실제로는 코드 기본값이라, 캔버스를 고쳐도 안 바뀌는
 *   자리가 조용히 생긴다. 전부 있거나 아무것도 없거나 둘 중 하나다.
 */
export function coverLockupOf(
  brand: unknown,
  theme: 'light' | 'dark' = 'light',
): CoverLockup | null {
  if (!brand || typeof brand !== 'object') return null
  const c = brand as Partial<VocabBrandCanvas>

  if (!nonEmpty(c.family) || !nonEmpty(c.seriesLine)) return null
  const family = coverFamilyOf(c.family)
  // `coverFamilyOf` 는 모르는 값을 `list` 로 떨어뜨린다 — 규격에서는 그 관용이 위험하다.
  // 계열이 틀리면 색과 도판이 통째로 다른 책이 된다. 그래서 실제로 아는 값일 때만 받는다.
  if (family !== c.family) return null

  const lockup = c.lockup
  if (!lockup || !nonEmpty(lockup.kicker)) return null
  if (!nonEmpty(lockup.volumeFormat) || !lockup.volumeFormat.includes('{n}')) return null
  const lines = Number(lockup.titleMaxLines)
  if (!Number.isInteger(lines) || lines < 1 || lines > 5) return null

  const grid = c.coverGrid
  if (!grid) return null
  const ratio = /^(\d+):(\d+)$/.exec(String(grid.ratio))
  if (!ratio || Number(ratio[1]) <= 0 || Number(ratio[2]) <= 0) return null
  const inset = Number(grid.plateInset)
  if (!Number.isFinite(inset) || inset < 0 || inset > 40) return null
  const scrim = Number(grid.scrimStrength)
  if (!Number.isFinite(scrim) || scrim < 0 || scrim > 1) return null

  const palette = c.palette
  if (!palette || !isRole(palette.ink) || !isRole(palette.paper)) return null

  const type = c.typography
  if (!type || !isFontRole(type.display) || !isFontRole(type.body) || !isFontRole(type.numerals)) {
    return null
  }

  const { ink, paper } = resolveBrandColors({ family, palette }, theme)

  return {
    family,
    seriesLine: c.seriesLine.trim(),
    kicker: lockup.kicker.trim(),
    volumeFormat: lockup.volumeFormat.trim(),
    titleMaxLines: lines,
    aspectRatio: `${ratio[1]} / ${ratio[2]}`,
    plateInset: inset,
    scrimStrength: scrim,
    fontClass: {
      display: FONT_CLASS[type.display],
      body: FONT_CLASS[type.body],
      numerals: FONT_CLASS[type.numerals],
    },
    ink,
    paper,
  }
}

/**
 * 권 번호 한 줄. 표시할 것이 없으면 **`null` — 자리를 비운다.**
 *
 * ⚠️ `mark` 는 **계단 번호가 아니라 권 이름**이어야 한다(`volumeMark(rung.volumeTitle)`).
 *   교재 표지가 정확히 여기서 틀렸다 — 5단 표지에 `5` 를 찍었는데 같은 카드의 제목은
 *   `Vocaflow Reading 4` 였다. 계단(1~7)과 권 이름(Starter·1~6)이 한 칸 밀려 있어서다.
 *   둘이 한 화면에 나란히 보이므로 학습자는 한 책에서 다른 두 수를 읽는다.
 */
export function volumeLabel(
  format: string,
  mark: string | null | undefined,
): string | null {
  if (!nonEmpty(mark)) return null
  return format.replace('{n}', mark.trim())
}

/** 규격이 서체를 안 준 자리(각인 없는 권)에서 쓰는 하한 — 값이 아니라 토큰 목록이다. */
export const FALLBACK_FONT_CLASS = {
  display: FONT_CLASS.english,
  body: FONT_CLASS.body,
  numerals: FONT_CLASS.mono,
} as const

