// packages/library-pipeline/src/textbook/series-catalog.test.ts
//
// **시리즈 정의가 헐거워지는 것을 막는다.**
//
// 시리즈를 하나 더 세우는 것은 싸다 — 상수를 몇 줄 적으면 된다. 그래서 위험하다:
// 재고도 없는 단을 정의하면 카탈로그가 즉시 「낼 수 있다」로 세고, 관리자는 조판을 돌려
// **빈 권**을 받는다. 이 저장소는 그 사고를 이미 겪었다(헤드라인이 못 만드는 18권을 세던 일).
//
// 그래서 여기서 잠그는 것은 셋이다:
//   · 계단의 학령 눈금이 `series.ts` 정본과 **같은가** — 눈금이 둘이면 조판과 화면이 갈린다
//   · 정의한 유형이 실제 저장 유형인가 — 오타 하나가 그 단을 조용히 0으로 만든다
//   · `shipping` 을 함부로 늘리지 않는가 — 안 찍은 것을 찍었다고 세면 그 화면은 못 믿는다

import { describe, expect, it } from 'vitest'

import { SERIES_BRAND, SERIES_SPINE, SERIES_TYPE_LABEL_KO } from './series'
import {
  MARKET_SERIES_TOTAL,
  SCHOOL_SERIES_BLOCKED,
  SERIES_CATALOG,
  seriesShipping,
} from './series-catalog'

describe('시리즈 목록', () => {
  it('id 가 겹치지 않는다', () => {
    const ids = SERIES_CATALOG.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('브랜드 이름이 겹치지 않는다 — 같은 이름의 두 시리즈는 매대에서 한 권이 된다', () => {
    const brands = SERIES_CATALOG.map((s) => s.brand)
    expect(new Set(brands).size).toBe(brands.length)
  })

  it('표지 색이 겹치지 않는다 — 색이 같으면 나란히 놓았을 때 같은 시리즈로 읽힌다', () => {
    const accents = SERIES_CATALOG.map((s) => s.accent)
    expect(new Set(accents).size).toBe(accents.length)
  })

  it('독해 시리즈는 사다리 정본을 그대로 쓴다 — 베껴 두면 갈린다', () => {
    const reading = SERIES_CATALOG.find((s) => s.id === 'reading')!
    expect(reading.brand).toBe(SERIES_BRAND)
    expect(reading.rungs).toBe(SERIES_SPINE)
  })
})

describe('계단이 정본 눈금을 벗어나지 않는다', () => {
  it('모든 단이 `series.ts` 의 학령·레벨과 같다', () => {
    for (const s of SERIES_CATALOG) {
      for (const r of s.rungs) {
        const base = SERIES_SPINE.find((b) => b.step === r.step)
        expect(base, `${s.brand} ${r.step}단이 정본에 없다`).toBeTruthy()
        expect(r.schoolBand, `${s.brand} ${r.step}단 학령이 정본과 다르다`).toBe(base!.schoolBand)
        expect(r.vLevels, `${s.brand} ${r.step}단 레벨이 정본과 다르다`).toEqual(base!.vLevels)
      }
    }
  })

  it('단 번호가 시리즈 안에서 안 겹치고 오름차순이다', () => {
    for (const s of SERIES_CATALOG) {
      const steps = s.rungs.map((r) => r.step)
      expect(new Set(steps).size, `${s.brand} 에 같은 단이 둘 있다`).toBe(steps.length)
      expect([...steps].sort((a, b) => a - b), `${s.brand} 단 순서가 뒤섞였다`).toEqual(steps)
    }
  })

  it('모든 단이 유형을 하나 이상 갖는다 — 빈 단은 빈 권이 된다', () => {
    for (const s of SERIES_CATALOG) {
      for (const r of s.rungs) {
        expect(r.types.length, `${s.brand} ${r.step}단에 유형이 없다`).toBeGreaterThan(0)
      }
    }
  })

  it('정의한 유형이 전부 실재하는 유형이다 — 오타 하나가 그 단을 조용히 0으로 만든다', () => {
    for (const s of SERIES_CATALOG) {
      for (const r of s.rungs) {
        for (const t of r.types) {
          expect(SERIES_TYPE_LABEL_KO[t], `${s.brand} ${r.step}단의 \`${t}\` 에 이름표가 없다`).toBeTruthy()
        }
      }
    }
  })

  it('권 이름이 브랜드로 시작한다 — 매대에서 시리즈가 안 읽히면 낱권이 된다', () => {
    for (const s of SERIES_CATALOG) {
      for (const r of s.rungs) {
        expect(r.volumeTitle.startsWith(s.brand), `${r.volumeTitle} 이 ${s.brand} 로 안 시작한다`).toBe(
          true,
        )
      }
    }
  })

  it('왜 이 유형 구성인가를 모든 단이 적는다 — 근거 없는 배합은 짐작이다', () => {
    for (const s of SERIES_CATALOG) {
      for (const r of s.rungs) {
        expect(r.rationale.length, `${s.brand} ${r.step}단에 근거가 없다`).toBeGreaterThan(20)
      }
    }
  })
})

describe('찍은 것과 정의한 것을 가른다', () => {
  it('draft 는 다음 한 걸음을 반드시 갖는다 — 없으면 막다른 화면이다', () => {
    for (const s of SERIES_CATALOG.filter((x) => x.status === 'draft')) {
      expect(s.nextStep, `${s.brand} 에 다음 걸음이 없다`).toBeTruthy()
    }
  })

  it('shipping 은 다음 걸음이 없다 — 이미 나갔다', () => {
    for (const s of SERIES_CATALOG.filter((x) => x.status === 'shipping')) {
      expect(s.nextStep).toBeNull()
    }
  })

  it('지금 나가는 시리즈는 하나뿐이고, 시장은 그보다 훨씬 많다', () => {
    const n = seriesShipping()
    // ⚠️ 이 부등식이 이 파일의 존재 이유다. 여기가 뒤집히면(우리가 시장보다 많아지면)
    //   분모를 다시 재야 한다 — 코퍼스가 낡은 것이지 우리가 이긴 것이 아닐 수 있다.
    expect(n.shipping).toBeLessThan(n.market)
    expect(n.defined).toBeLessThanOrEqual(n.market)
    expect(n.market).toBe(MARKET_SERIES_TOTAL)
  })

  it('시장 시리즈 수의 합이 총수를 넘지 않는다 — 분모를 부풀리지 않는다', () => {
    const claimed = SERIES_CATALOG.reduce((n, s) => n + s.marketSeries, 0)
    expect(claimed).toBeLessThanOrEqual(MARKET_SERIES_TOTAL)
  })

  it('내신은 시리즈로 세우지 않고 이유를 남긴다 — 재고가 있다고 상품이 되지 않는다', () => {
    expect(SERIES_CATALOG.some((s) => (s.id as string) === 'school')).toBe(false)
    expect(SCHOOL_SERIES_BLOCKED).toContain('BYO')
  })
})
