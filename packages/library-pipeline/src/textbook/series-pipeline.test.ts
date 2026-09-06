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

/**
 * **독해가 아닌 시리즈가 남의 조판 기록을 덮지 않는지.**
 *
 * ⚠️ 실측 2026-09-06: 어휘 V5 를 시험 조판했더니 `textbook_volume_renders` 의 band 5 행
 *   제목이 「Vocaflow Reading 4」 → 「Vocaflow Vocab Advanced」로 바뀌었다.
 *   그 표는 `band` 하나로 키를 잡으므로(`onConflict: 'band'`), **발행 중인 시리즈의 기록이
 *   시험 조판 한 번에 지워진다.**
 *
 * 표에 시리즈 칸이 생기기 전까지는 기록을 아예 안 남기는 것이 옳다 — 조판물은 정상으로 나오고,
 * 못 남기는 것은 "이 권이 나갔다" 는 사실뿐이다. 마이그레이션은 사용자 승인이 필요하다.
 */
describe('조판 기록이 남의 시리즈를 안 덮는다', () => {
  // ⚠️ 2026-09-06:  가  하나로 키를 잡던 탓에 어휘 V5 시험
  //   조판이 발행 중인 독해 V5 기록을 덮었다(제목이 「Vocaflow Reading 4」 →
  //   「Vocaflow Vocab Advanced」). 마이그레이션  가
  //    열과  복합 키로 그 자리를 막았고, 아래 셋이 그 보호를 잠근다.

  it('기록에 시리즈를 싣는다 — 빠지면 기본값 reading 으로 들어가 남의 권을 덮는다', () => {
    expect(renderSrc).toContain('series: SERIES,')
  })

  it('앞 기록 조회도 시리즈로 좁힌다 — band 만 보면 남의 권 횟수를 잇는다', () => {
    expect(renderSrc).toContain("eq('series', SERIES)")
  })

  it('충돌 키가 복합 키다 — band 하나면 마이그레이션 전으로 돌아간 것이다', () => {
    expect(renderSrc).toContain("onConflict: 'series,band'")
    // ⚠️ 통짜 검색으로 옛 키를 금지하면 **주석이 걸린다** — 사고 경위를 적은 줄이
    //   그 문자열을 갖고 있다. 실제 호출 형태만 본다.
    expect(renderSrc).not.toMatch(/{ onConflict: .band. }/)
  })

  it('시장 적합도 분모가 독해임을 인정한다 — 어휘 권을 그 분모로 재지 않는다', () => {
    // 어휘 V5 가 9.6% 로 나왔던 자리. 없는 분모를 0 으로 채우지 않는다.
    expect(renderSrc).toContain("SERIES === 'reading'")
    expect(renderSrc).toContain('밀도를 독해 교재로 쟀다')
    // 「빠진 유형」 경고도 같은 분모를 쓰므로 함께 막는다.
    expect(renderSrc).toContain("closedTypes.length && SERIES === 'reading'")
  })
})

/**
 * **시리즈가 달라지면 지표의 분모도 달라진다.**
 *
 * 실측 2026-09-06: 어휘 V5 를 찍었더니 「시장 전체 기준 9.6%」가 나오고 「목표에서 빠진 유형
 * 17개」가 blank·claim·order… **전부 독해 유형**이었다. 어휘 책에 독해 문항이 없는 것은
 * 결함이 아니라 그 책의 정의인데 지표가 감점으로 읽었다 — `market-spec.json` 의 유형 밀도가
 * 코퍼스 75종(그중 60종이 독해) 전체에서 쟀기 때문이다.
 *
 * 고친 뒤 같은 권이 **적합도 100.0% · 시장 기준 「못 잼」 · 자동 검수 10/10** 으로 나온다.
 */
describe('지표가 시리즈를 존중한다', () => {
  it('독해가 아니면 시장 분모를 안 쓴다 — 없는 분모를 0 으로 채우지 않는다', () => {
    expect(renderSrc).toContain('밀도를 독해 교재로 쟀다')
    expect(buildSrc).toContain('밀도를 독해 교재로 쟀다')
  })

  it('「빠진 유형」 경고도 같은 분모를 쓰므로 함께 막는다', () => {
    expect(renderSrc).toContain("closedTypes.length && SERIES === 'reading'")
  })

  it('시리즈 판정이 한 곳에서만 나온다 — 두 곳에서 읽으면 갈린다', () => {
    // `SERIES` 는 인자에서 한 번만 읽는다. 다른 데서 또 만들면 기본값이 갈릴 수 있다.
    const decls = renderSrc.match(/const SERIES = /g) ?? []
    expect(decls.length).toBe(1)
  })
})
