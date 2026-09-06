// packages/library-pipeline/src/textbook/series-pipeline.test.ts
//
// **카탈로그가 약속한 권을 파이프라인이 실제로 찍을 수 있는지** 본다.
//
// ⚠️ 이 검사가 없어서 같은 사고를 두 번 냈다:
//   ① (유형 × 학령) 격자가 「낼 수 있는데 안 낸 책 18권」이라고 적었는데 조합기는 그 권을
//      만들 줄 몰랐다.
//   ② 시리즈 축으로 바꾸며 어휘·구문 12권을 「찍기만 하면 된다」고 적었는데, 그때도 조합기는
//      `--band` 만 받고 독해 사다리 하나만 알았다 — **화면을 고치면서 같은 거짓을 새로 만들었다.**
//
// 두 번 다 원인이 같다: **화면이 아는 것과 스크립트가 아는 것이 다른데 아무도 대조하지 않았다.**
// 그래서 여기서는 정의(`series-catalog.ts`)와 스크립트(`build-volume`·`render-volume`·
// `volume-pool`)를 **소스로 대조한다**. 스크립트는 `.mjs` 라 타입체크가 안 보므로
// 이 대조가 유일한 그물이다.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { SERIES_CATALOG } from './series-catalog'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..', '..')
const read = (f: string) => readFileSync(join(REPO, 'scripts', 'textbook', f), 'utf8')

const buildSrc = read('build-volume.mjs')
const renderSrc = read('render-volume.mjs')
const poolSrc = read('volume-pool.mjs')

describe('시리즈를 스크립트가 안다', () => {
  it('조합기와 조판기가 `--series` 를 받는다 — 안 받으면 밴드만 보고 독해 권을 낸다', () => {
    for (const [name, src] of [
      ['build-volume', buildSrc],
      ['render-volume', renderSrc],
    ] as const) {
      expect(src, `${name} 이 --series 를 안 읽는다`).toContain("arg('series')")
      expect(src, `${name} 이 seriesId 를 안 넘긴다`).toContain('seriesId: SERIES')
    }
  })

  it('풀을 그 단의 유형으로 **좁힌다** — 안 좁히면 어휘 권에 독해 문항이 실린다', () => {
    expect(poolSrc).toContain('seriesRungOf(seriesId, band)')
    // 좁힌 사실을 로그로 남겨야 관리자가 "왜 문항이 줄었지" 를 안 묻는다.
    expect(poolSrc).toContain('로 좁혔다')
    // 좁히고 0 이 되면 **그 사실을 말한다** — 조용히 빈 권을 내면 안 된다.
    expect(poolSrc).toContain('이 단은 지금 찍을 수 없다')
  })

  it('기본값이 독해다 — 옛 명령이 그대로 돌아야 한다', () => {
    for (const src of [buildSrc, renderSrc]) {
      expect(src).toMatch(/arg\('series'\) \?\? 'reading'/)
    }
  })

  it('제목이 시리즈를 따른다 — 독해 사다리만 보면 어휘 권도 Reading 으로 찍힌다', () => {
    expect(renderSrc).toContain('SERIES_CATALOG.find((x) => x.id === SERIES)')
    expect(renderSrc).toContain('seriesDef.rungs.find((r) => r.vLevels.includes(BAND))')
    expect(renderSrc).not.toContain("rung?.volumeTitle ?? `Vocaflow Reading V${BAND}`")
  })

  it('정의된 모든 시리즈·단이 명령으로 지정 가능하다 — 화면이 약속한 권이 전부 닿는다', () => {
    // 카탈로그가 칸을 그리면 관리자는 그 칸을 찍으려 한다. 지정할 수 없는 칸이 하나라도
    // 있으면 그 칸은 「찍기만 하면 됨」이라고 적어도 못 찍는다.
    for (const s of SERIES_CATALOG) {
      for (const r of s.rungs) {
        expect(r.vLevels.length, `${s.brand} ${r.step}단에 레벨이 없다 — --band 로 못 짚는다`)
          .toBeGreaterThan(0)
      }
    }
  })

  it('배럴이 아니라 서브패스로 읽는다 — 배럴은 child_process 를 끌어온다', () => {
    for (const src of [renderSrc, poolSrc]) {
      expect(src).toContain('@vocaflow/library-pipeline/textbook-series-catalog')
    }
  })
})
