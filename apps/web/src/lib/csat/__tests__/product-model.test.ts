// apps/web/src/lib/csat/__tests__/product-model.test.ts
//
// 제품 격자의 **판정 규칙**을 고정한다.
//
// 이 모델이 새로 생긴 이유는 실측 하나였다(2026-09-06): 재고는 네 유형에 걸쳐 70만 문항이
// 있는데 **제품은 독해 한 줄뿐**이라, 어휘·구문·내신 재고가 어느 권에도 안 실리고 있었다.
// 그래서 여기서 지키는 것은 "칸이 언제 팔 수 있는 상태가 되는가" 하나다 —
// 이 판정이 헐거우면 못 낼 책을 낼 수 있다고 세고, 빡빡하면 낼 수 있는 책을 안 낸다.

import { describe, expect, it } from 'vitest'

import {
  CELL_STATUS_KO,
  GENRES,
  ITEMS_PER_VOLUME,
  STEPS,
  catalogCoverage,
  genreCoverage,
  judgeCell,
  type CatalogRow,
} from '../product-model'

describe('judgeCell — 무엇이 없어서 못 내는지 순서대로 말한다', () => {
  const f = (o: Partial<Parameters<typeof judgeCell>[0]>) =>
    judgeCell({ items: 100, explained: 100, blocked: null, ...o })

  it('문항도 해설도 차면 낼 수 있다', () => {
    expect(f({})).toBe('ready')
  })

  it('한 권 규격(60)에 못 미치면 문항 모자람', () => {
    expect(f({ items: ITEMS_PER_VOLUME - 1, explained: 0 })).toBe('needsItems')
  })

  it('문항은 찼는데 해설이 모자라면 해설 모자람 — 해설 없는 책은 혼자 못 푼다', () => {
    expect(f({ items: 1000, explained: ITEMS_PER_VOLUME - 1 })).toBe('needsExplain')
  })

  it('해설은 **전량**이 아니라 한 권 몫만 있으면 된다', () => {
    // 재고 16만에 해설 60 이면 그 권은 낼 수 있다. 전량을 요구하면 큰 칸이 영원히 빨갛고,
    // 그 빨강은 아무 행동도 지시하지 않는다.
    expect(f({ items: 160_000, explained: ITEMS_PER_VOLUME })).toBe('ready')
  })

  it('재고 0 은 「모자람」이 아니라 「없음」이다 — 할 일이 다르다', () => {
    expect(f({ items: 0, explained: 0 })).toBe('empty')
  })

  it('막힌 칸은 재고가 아무리 많아도 막힘이다', () => {
    expect(f({ items: 999_999, explained: 999_999, blocked: '저작권' })).toBe('blocked')
  })

  it('못 잰 것은 0 이 아니다', () => {
    expect(f({ items: null, explained: null })).toBe('unmeasured')
    expect(f({ items: 100, explained: null })).toBe('unmeasured')
  })

  it('막힘이 못 잼보다 앞선다 — 못 재도 못 내는 것은 확실하다', () => {
    expect(f({ items: null, explained: null, blocked: '저작권' })).toBe('blocked')
  })
})

describe('GENRES — 시중 분류와 어긋나지 않는다', () => {
  it('시중 유형 다섯을 전부 들고 있다 (코퍼스 실측 2026-09-06)', () => {
    // `scripts/textbook-corpus/query.mjs stats` 의 「유형」 축 그대로 — 독해 60 · 기출 19 ·
    // 어휘 8 · 구문 5 · 내신 2. 여기가 시중 커버리지의 분모라, 빠지면 커버리지가 부푼다.
    const market = GENRES.filter((g) => g.marketDocs != null)
    expect(market.map((g) => g.name).sort()).toEqual(['구문', '기출', '내신', '독해', '어휘'])
    expect(market.map((g) => g.marketDocs)).toEqual([60, 8, 5, 2, 19])
  })

  it('시장에 없는 칸은 marketDocs 가 null 이다 — 0 이 아니다', () => {
    // 0 이면 "시장이 하나도 안 판다"(사실)이고 null 은 "비교 대상이 없다" 다. 커버리지 분모가 갈린다.
    const platform = GENRES.find((g) => g.id === 'platform')!
    expect(platform.marketDocs).toBeNull()
  })

  it('만들 수 없는 유형은 이유를 들고 있다 — 재고 0 으로만 두면 "더 만들면 되겠네" 로 읽힌다', () => {
    for (const g of GENRES) {
      if (g.itemTypes.length === 0) {
        expect(g.blocked, `${g.name} 이 이유 없이 비어 있다`).toBeTruthy()
      }
    }
  })

  it('기출은 재고가 있어도 상품이 아니다 — 평가원 저작물', () => {
    const past = GENRES.find((g) => g.id === 'pastexam')!
    expect(past.itemTypes).toHaveLength(0)
    expect(past.blocked).toMatch(/평가원|저작/)
  })

  it('문항 유형이 두 장르에 겹쳐도 된다 — 같은 문항이 다른 책에 실린다', () => {
    // 내신은 어휘·구문의 문항을 본문 기준으로 다시 쓴다. 겹침을 금지하면 내신 칸이 빈다.
    const school = GENRES.find((g) => g.id === 'school')!
    const vocab = GENRES.find((g) => g.id === 'vocab')!
    expect(school.itemTypes.some((t) => vocab.itemTypes.includes(t))).toBe(true)
  })

  it('id 가 중복되지 않는다', () => {
    expect(new Set(GENRES.map((g) => g.id)).size).toBe(GENRES.length)
  })

  it('모든 상태에 라벨과 색이 있다', () => {
    for (const k of Object.keys(CELL_STATUS_KO) as (keyof typeof CELL_STATUS_KO)[]) {
      expect(CELL_STATUS_KO[k].label.length).toBeGreaterThan(0)
      expect(CELL_STATUS_KO[k].color).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
})

describe('STEPS — 학령 축은 사다리 정본에서 온다', () => {
  it('7단이고 번호가 이어진다 — 조판이 쓰는 눈금과 같아야 한다', () => {
    expect(STEPS.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7])
    for (const s of STEPS) expect(s.schoolBand.length).toBeGreaterThan(0)
  })
})

const row = (id: string, statuses: string[]): CatalogRow => ({
  genre: GENRES.find((g) => g.id === id)!,
  cells: statuses.map((s, i) => ({
    genre: id as CatalogRow['genre']['id'],
    step: i + 1,
    items: 0,
    explained: 0,
    blocked: null,
    status: s as CatalogRow['cells'][number]['status'],
  })),
  ready: statuses.filter((s) => s === 'ready').length,
})

describe('커버리지 — 못 만드는 칸을 분모에서 뺀다', () => {
  it('막힌 칸은 분모가 아니다 — 넣으면 영원히 100% 가 안 되고 그 수는 아무 말도 안 한다', () => {
    const rows = [row('reading', ['ready', 'ready']), row('pastexam', ['blocked', 'blocked'])]
    expect(catalogCoverage(rows)).toEqual({ ready: 2, buildable: 2, blockedCells: 2 })
  })

  it('시중 유형 커버리지는 낼 수 있는 권이 하나라도 있으면 센다', () => {
    const rows = [
      row('reading', ['ready', 'needsItems']),
      row('vocab', ['needsItems', 'needsItems']),
      row('platform', ['blocked']),
    ]
    // platform 은 시장에 없으므로 분모에서 빠진다
    expect(genreCoverage(rows)).toEqual({ covered: 1, market: 2 })
  })

  it('아무것도 못 내면 0 이다 — 분모는 남는다', () => {
    expect(genreCoverage([row('reading', ['empty'])])).toEqual({ covered: 0, market: 1 })
  })
})
