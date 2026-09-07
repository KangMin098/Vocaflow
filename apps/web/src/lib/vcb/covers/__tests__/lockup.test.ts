// apps/web/src/lib/vcb/covers/__tests__/lockup.test.ts
//
// **규격이 화면에 닿는 통로를 잠근다.**
//
// 이 파일이 필요한 이유는 실측 하나다(2026-09-07): 브랜드 드레인이 표지 규격 여덟 항목을
// 발행 55권에 각인해 두었는데 **화면이 읽은 것은 `family` 하나뿐**이었다. 나머지 일곱은
// DB 에 있고, 코드에는 값이 따로 있고, 아무도 오류를 보지 못했다 —
// `scrimStrength` 는 캔버스 0.35 / 코드 0.4 로 **이미 갈려 있었다.**
//
// 그런 어긋남은 타입도 렌더도 안 잡는다. 잡히는 자리는 여기뿐이다.

import { describe, expect, it } from 'vitest'

import { FAMILY_GRAIN, FAMILY_GRAIN_DARK } from '../design'
import { coverLockupOf, volumeLabel } from '../lockup'
import { SCRIM_AT_TITLE, titleContrast } from '../contrast'

/** DB 에 실제로 각인된 모양 그대로 (`chunk-02.out.json` = structure). */
const IMPRINT = {
  family: 'structure',
  seriesLine: 'STRUCTURE · 구조 계열',
  grain: '해부와 분해 — 조각으로 나눠 본 것',
  lockup: { kicker: 'VOCAFLOW VOCABULARY', volumeFormat: 'VOL. {n}', titleMaxLines: 4 },
  coverGrid: { ratio: '3:4', plateInset: 8, scrimStrength: 0.35 },
  palette: { ink: 'ink', paper: 'paper', accent: 'accent' },
  typography: { display: 'english', body: 'body', numerals: 'mono' },
  canvasUrl: 'https://claude.ai/code/artifact/f2cce3c7-7b5f-4803-82f0-c8489473b615',
  designedAt: '2026-09-06T12:15:03.399Z',
  designedBy: 'claude-design',
}

describe('각인 → 규격 — 여덟 항목이 전부 화면 쪽으로 건너온다', () => {
  it('캔버스가 정한 값을 그대로 낸다', () => {
    const lockup = coverLockupOf(IMPRINT)
    expect(lockup).not.toBeNull()
    expect(lockup!.kicker).toBe('VOCAFLOW VOCABULARY')
    expect(lockup!.volumeFormat).toBe('VOL. {n}')
    expect(lockup!.titleMaxLines).toBe(4)
    expect(lockup!.plateInset).toBe(8)
    expect(lockup!.scrimStrength).toBe(0.35)
    expect(lockup!.seriesLine).toBe('STRUCTURE · 구조 계열')
  })

  it('비율은 CSS 가 읽는 모양으로 바뀐다 — `3:4` 는 CSS 값이 아니다', () => {
    expect(coverLockupOf(IMPRINT)!.aspectRatio).toBe('3 / 4')
  })

  it('색은 값이 아니라 **역할**을 따라간다 — 규격이 둘을 바꿔 적으면 표지도 바뀐다', () => {
    const normal = coverLockupOf(IMPRINT)!
    expect(normal.ink).toBe(FAMILY_GRAIN.structure.ink)
    expect(normal.paper).toBe(FAMILY_GRAIN.structure.paper)

    const swapped = coverLockupOf({
      ...IMPRINT,
      palette: { ink: 'paper', paper: 'ink', accent: 'accent' },
    })!
    expect(swapped.ink).toBe(FAMILY_GRAIN.structure.paper)
    expect(swapped.paper).toBe(FAMILY_GRAIN.structure.ink)
  })

  it('테마를 따라간다 — 다크에서 같은 역할이 다른 값을 푼다', () => {
    expect(coverLockupOf(IMPRINT, 'dark')!.ink).toBe(FAMILY_GRAIN_DARK.structure.ink)
  })

  it('서체는 역할 → 토큰 클래스다 (값을 적지 않는다)', () => {
    const f = coverLockupOf(IMPRINT)!.fontClass
    expect(f).toEqual({ display: 'font-english', body: 'font-body', numerals: 'font-mono' })
  })
})

describe('모양이 안 맞으면 null — 반쯤 채운 규격을 만들지 않는다', () => {
  it('각인이 없으면 null', () => {
    expect(coverLockupOf(null)).toBeNull()
    expect(coverLockupOf(undefined)).toBeNull()
    expect(coverLockupOf({})).toBeNull()
  })

  it.each([
    ['lockup', { ...IMPRINT, lockup: undefined }],
    ['kicker 빈 값', { ...IMPRINT, lockup: { ...IMPRINT.lockup, kicker: '  ' } }],
    ['번호 자리 없음', { ...IMPRINT, lockup: { ...IMPRINT.lockup, volumeFormat: 'VOL.' } }],
    ['줄 수 범위 밖', { ...IMPRINT, lockup: { ...IMPRINT.lockup, titleMaxLines: 9 } }],
    ['비율 형태', { ...IMPRINT, coverGrid: { ...IMPRINT.coverGrid, ratio: '4' } }],
    ['스크림 범위 밖', { ...IMPRINT, coverGrid: { ...IMPRINT.coverGrid, scrimStrength: 1.4 } }],
    ['여백 범위 밖', { ...IMPRINT, coverGrid: { ...IMPRINT.coverGrid, plateInset: 90 } }],
    ['서체 역할 아님', { ...IMPRINT, typography: { ...IMPRINT.typography, body: 'Inter' } }],
    ['색 역할 아님', { ...IMPRINT, palette: { ...IMPRINT.palette, ink: '#2E7D5A' } }],
    ['계열 아님', { ...IMPRINT, family: 'etymology' }],
  ])('%s → null (표지는 종전 모습으로 떨어진다)', (_label, broken) => {
    expect(coverLockupOf(broken)).toBeNull()
  })

  /*
    ⚠️ 계열만은 관대하면 안 된다. `coverFamilyOf` 는 모르는 값을 `list` 로 떨어뜨리는데,
    그 관용을 규격에 적용하면 **다른 계열의 색과 도판을 단 책**이 조용히 나온다.
    색이 계열을 말하는 표지에서 그것은 틀린 정보다.
  */
  it('모르는 계열을 list 로 구제하지 않는다', () => {
    expect(coverLockupOf({ ...IMPRINT, family: 'unknown-family' })).toBeNull()
  })
})

describe('권 번호 — 계단이 아니라 권 이름', () => {
  it('{n} 자리에 표시를 넣는다', () => {
    expect(volumeLabel('VOL. {n}', '4')).toBe('VOL. 4')
    expect(volumeLabel('VOL. {n}', 'Starter')).toBe('VOL. Starter')
  })

  it('표시가 없으면 **자리를 비운다** — 0 이나 미정을 지어내지 않는다', () => {
    expect(volumeLabel('VOL. {n}', null)).toBeNull()
    expect(volumeLabel('VOL. {n}', '   ')).toBeNull()
  })
})

describe('스크림 — 규격 값으로도 제목이 읽히는가', () => {
  /*
    캔버스 0.35 는 코드 하한 0.4 보다 **덜 누른다.** 그래서 규격을 따르는 순간 대비가 내려간다 —
    이 검사가 없으면 「캔버스를 정본으로」가 곧 「제목이 안 읽힌다」가 될 수 있다.
    계열 다섯 × 라이트·다크 열 벌을 전부 잰다.
  */
  const scrim = coverLockupOf(IMPRINT)!.scrimStrength

  it.each(Object.keys(FAMILY_GRAIN))('%s — 규격 스크림에서도 AA(4.5) 위', (family) => {
    for (const grain of [FAMILY_GRAIN, FAMILY_GRAIN_DARK]) {
      const ink = grain[family as keyof typeof FAMILY_GRAIN].ink
      for (const kind of ['card', 'hero'] as const) {
        expect(titleContrast(ink, kind, scrim)).toBeGreaterThan(4.5)
      }
    }
  })

  it('하한은 규격이 없을 때만 쓴다 — 값을 주면 그 값으로 잰다', () => {
    const ink = FAMILY_GRAIN.corpus.ink
    expect(titleContrast(ink, 'card')).toBeCloseTo(titleContrast(ink, 'card', SCRIM_AT_TITLE.card), 6)
    expect(titleContrast(ink, 'card', scrim)).not.toBeCloseTo(titleContrast(ink, 'card'), 2)
  })
})
