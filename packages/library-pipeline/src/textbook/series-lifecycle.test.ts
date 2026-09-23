// packages/library-pipeline/src/textbook/series-lifecycle.test.ts
//
// 시리즈 생애 판정의 회귀. 지키는 것은 셋이다:
//   ① **못 잰 것은 못 잼으로** — 그럴듯한 자리를 대신 돌려주지 않는다
//   ② **출고가 끝이 아니다** — 옛 규격 권이 있으면 개정으로 떨어진다
//   ③ **다음 자리가 늘 있다** — 시장 분모가 우리 분자보다 크다

import { describe, expect, it } from 'vitest'

import { MARKET_SERIES_TOTAL, SERIES_CATALOG } from './series-catalog'
import {
  LIFECYCLE_KO,
  MARKET_SERIES_BY_KIND,
  TRIGGER_KO,
  judgeLifecycle,
  nextActionOf,
  portfolioCoverage,
  seriesGaps,
  type LifecycleInput,
} from './series-lifecycle'

/** 「다 갖춰진 출고 시리즈」 — 각 검사가 한 칸만 비틀어 쓴다. */
const shipping: LifecycleInput = {
  intent: 'active',
  rungs: 7,
  publishedVolumes: 7,
  readyVolumes: 0,
  staleVolumes: 0,
}

describe('judgeLifecycle — 못 잰 것을 메우지 않는다', () => {
  it('조판 기록을 못 읽었으면 null 이다 — 「아직 안 찍었네」로 읽힐 값을 안 돌려준다', () => {
    expect(judgeLifecycle({ ...shipping, publishedVolumes: null })).toBeNull()
  })

  it('나간 권은 있는데 규격 지문을 못 쟀으면 null 이다', () => {
    // 출고냐 개정이냐가 **이 한 칸으로 갈린다.** 모르는 채 「출고」로 적으면 옛 규격 권이
    // 매대에 남고, 그것을 되돌릴 신호가 화면에서 사라진다.
    expect(judgeLifecycle({ ...shipping, staleVolumes: null })).toBeNull()
  })

  it('한 권도 안 나갔는데 재고를 못 쟀으면 null 이다', () => {
    expect(
      judgeLifecycle({ ...shipping, publishedVolumes: 0, readyVolumes: null }),
    ).toBeNull()
  })
})

describe('judgeLifecycle — 자리', () => {
  it('계단이 없으면 발의다 — 잴 것이 아직 없다', () => {
    expect(judgeLifecycle({ ...shipping, rungs: 0, publishedVolumes: null })).toBe('proposed')
  })

  it('접은 시리즈는 아무것도 다시 안 잰다', () => {
    expect(judgeLifecycle({ ...shipping, intent: 'retired' })).toBe('retired')
  })

  it('나간 권이 있으면 출고다', () => {
    expect(judgeLifecycle(shipping)).toBe('shipping')
  })

  it('나갔어도 옛 규격 권이 섞이면 개정이다 — 출고에서 멈추지 않는다', () => {
    expect(judgeLifecycle({ ...shipping, staleVolumes: 2 })).toBe('revising')
  })

  it('안 찍었는데 찍을 수 있으면 생산이다', () => {
    expect(judgeLifecycle({ ...shipping, publishedVolumes: 0, readyVolumes: 3 })).toBe('producing')
  })

  it('안 찍었고 찍을 것도 없으면 기획이다', () => {
    expect(judgeLifecycle({ ...shipping, publishedVolumes: 0, readyVolumes: 0 })).toBe('planned')
  })
})

describe('nextActionOf — 어느 자리에서도 할 일이 있다', () => {
  it('여섯 자리 전부가 빈 문자열이 아닌 다음 걸음을 낸다', () => {
    for (const life of Object.keys(LIFECYCLE_KO) as (keyof typeof LIFECYCLE_KO)[]) {
      const s = nextActionOf(life, { readyVolumes: 1, staleVolumes: 1, seriesId: 'vocab' })
      expect(s.trim().length, `${life} 의 다음 걸음이 비었다`).toBeGreaterThan(0)
    }
  })

  it('못 쟀으면 그렇다고 말한다 — 조판을 권하지 않는다', () => {
    const s = nextActionOf(null, { readyVolumes: null, staleVolumes: null, seriesId: 'vocab' })
    expect(s).toContain('못 쟀다')
  })

  it('생산 자리의 명령에 --series 가 실린다', () => {
    // ⚠️ 밴드만 주면 조합기가 독해 사다리를 보고 **독해 권**을 낸다(실측 2026-09-06).
    const s = nextActionOf('producing', { readyVolumes: 2, staleVolumes: 0, seriesId: 'syntax' })
    expect(s).toContain('--series syntax')
  })
})

describe('다음 유형 — 이 목록이 비는 날은 오지 않는다', () => {
  it('유형별 시장 분포의 합이 시장 총수와 같다', () => {
    // 둘이 갈리면 「우리 3 / 시장 22」의 분모가 조용히 거짓이 된다.
    const sum = Object.values(MARKET_SERIES_BY_KIND).reduce((a, b) => a + b, 0)
    expect(sum).toBe(MARKET_SERIES_TOTAL)
  })

  it('지금 카탈로그는 모든 칸에서 시장보다 적다 — 늘 다음 자리가 있다', () => {
    for (const g of seriesGaps(SERIES_CATALOG)) {
      expect(g.ours, `${g.kind} 이 시장 칸을 넘었다`).toBeLessThanOrEqual(g.market)
    }
    const cov = portfolioCoverage(SERIES_CATALOG)
    expect(cov.ours).toBeLessThan(cov.market)
  })

  it('막힌 칸은 지워지지 않고 이유를 달고 남는다', () => {
    const gaps = seriesGaps(SERIES_CATALOG, { school: '교과서 본문이 출판사 저작물이다' })
    const school = gaps.find((g) => g.kind === 'school')
    expect(school?.blockedWhy).toBe('교과서 본문이 출판사 저작물이다')
  })

  it('접은 시리즈는 분자에서 빠진다 — 못 사는 것을 「판다」로 세지 않는다', () => {
    const withRetired = [
      ...SERIES_CATALOG,
      { ...SERIES_CATALOG[0]!, id: 'reading', intent: 'retired' as const },
    ]
    const before = portfolioCoverage(SERIES_CATALOG).ours
    expect(portfolioCoverage(withRetired).ours).toBe(before)
  })
})

describe('카탈로그가 계약을 지킨다', () => {
  it('시리즈마다 발의 근거가 있다 — 계기 · 근거 · 날짜 셋 다', () => {
    for (const s of SERIES_CATALOG) {
      expect(TRIGGER_KO[s.origin.trigger], `${s.id} 의 계기가 열거형 밖이다`).toBeDefined()
      expect(s.origin.evidence.trim().length, `${s.id} 의 근거가 비었다`).toBeGreaterThan(10)
      expect(s.origin.since, `${s.id} 의 날짜가 ISO 가 아니다`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('접지 않은 시리즈에는 절판 사유가 없다 — 둘이 함께 있으면 어느 쪽이 참인지 모른다', () => {
    for (const s of SERIES_CATALOG) {
      if (s.intent !== 'retired') expect(s.retiredWhy, `${s.id}`).toBeNull()
      else expect(s.retiredWhy?.trim().length ?? 0).toBeGreaterThan(0)
    }
  })

  it('kind 가 시장 분포의 키 안에 있다 — 없는 칸에 앉으면 분모가 안 붙는다', () => {
    for (const s of SERIES_CATALOG) {
      expect(Object.keys(MARKET_SERIES_BY_KIND), `${s.id}`).toContain(s.kind)
    }
  })
})
