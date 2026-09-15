// apps/web/src/lib/csat/__tests__/trap-atlas.test.ts
//
// **오답 지도가 말하는 것을 잠근다.**
//
// 이 화면의 주장은 산문이 아니라 수치다 — 「아홉 가지가 60%」 「26유형 중 13~17유형에 걸친다」.
// 그 주장은 구운 JSON 에서 나오고, JSON 은 DB 가 바뀌면 다시 구워진다. 그러니 **주장이 성립하는
// 조건 자체**를 검사해야 한다: 분포에 아직 틈이 있는가, 합이 맞는가, 비율이 100%를 넘지 않는가.
//
// ⚠️ 특정 수(389·3,208)를 못 박지 않는다 — 분석이 늘면 그 수는 바뀌는 것이 정상이고,
//    바뀔 때마다 빨개지는 검사는 곧 주석 처리된다. 대신 **구조**를 검사한다.

import { describe, expect, it } from 'vitest'

import {
  ATLAS_TYPES,
  CORPUS,
  DETECTOR,
  TRAPS,
  UNIVERSAL,
  UNIVERSAL_MIN_TYPES,
  rankFor,
  standoutFor,
  universalCoverage,
} from '../trap-atlas'

describe('오답 지도 — 구운 값의 정합', () => {
  it('코퍼스 수치가 서로 모순되지 않는다', () => {
    expect(CORPUS.analyzed).toBeGreaterThan(0)
    expect(CORPUS.analyzed).toBeLessThanOrEqual(CORPUS.items)
    expect(CORPUS.distractors).toBeGreaterThan(CORPUS.items) // 문항마다 오답이 여럿이다
    expect(CORPUS.recent).toBeLessThanOrEqual(CORPUS.distractors)
    expect(CORPUS.named).toBeLessThanOrEqual(CORPUS.distractors)
    expect(CORPUS.year_min).toBeLessThan(CORPUS.year_max)
  })

  it('이름 붙은 함정의 합이 코퍼스의 named 와 같다', () => {
    // 다르면 굽는 쪽과 읽는 쪽이 다른 것을 세고 있다는 뜻이다 — 화면의 「60%」가 거짓이 된다.
    expect(TRAPS.reduce((a, t) => a + t.n, 0)).toBe(CORPUS.named)
  })

  it('함정마다 by_type 의 합이 n 과 같다', () => {
    for (const t of TRAPS) {
      const sum = Object.values(t.by_type).reduce((a, b) => a + b, 0)
      expect(`${t.key}:${sum}`).toBe(`${t.key}:${t.n}`)
      expect(Object.keys(t.by_type).length).toBe(t.types)
      expect(t.recent).toBeLessThanOrEqual(t.n)
      expect(t.items).toBeLessThanOrEqual(t.n)
    }
  })

  it('예시는 실재하는 유형을 가리키고 슬러그가 문항 id 와 일관된다', () => {
    const typeIds = new Set(ATLAS_TYPES.map((t) => t.id))
    for (const t of TRAPS) {
      for (const ex of t.examples) {
        expect(typeIds.has(ex.type_id)).toBe(true)
        expect(ex.slug).toBe(ex.item_id.replace('#', '-'))
        expect(ex.reject.length).toBeGreaterThan(10)
      }
    }
  })
})

describe('오답 지도 — 「가로지른다」는 주장', () => {
  it('범용 함정과 유형특화 함정 사이에 아직 틈이 있다', () => {
    // 이 화면의 이야기 전체가 이 틈 위에 서 있다. 틈이 사라지면 「아홉 가지」라는 말도
    // 근거를 잃으므로, 임계값을 조용히 옮기는 대신 **여기서 빨개져야** 한다.
    const universalMin = Math.min(...UNIVERSAL.map((t) => t.types))
    const boundMax = Math.max(...TRAPS.filter((t) => t.types < UNIVERSAL_MIN_TYPES).map((t) => t.types))
    expect(universalMin).toBeGreaterThanOrEqual(UNIVERSAL_MIN_TYPES)
    expect(boundMax).toBeLessThan(UNIVERSAL_MIN_TYPES)
    // 틈이 실제로 벌어져 있는가 — 붙어 있으면 경계가 임의가 된다
    expect(universalMin - boundMax).toBeGreaterThanOrEqual(3)
  })

  it('범용 함정이 오답의 절반을 넘게 덮는다', () => {
    const c = universalCoverage()
    expect(c.kinds).toBeGreaterThanOrEqual(5)
    expect(c.kinds).toBeLessThanOrEqual(12) // 외울 수 있는 수여야 한다 (원칙 6)
    expect(c.pct).toBeGreaterThan(50)
  })

  it('범용 함정에는 「잡는 법」이 빠짐없이 있다', () => {
    // 잡는 법 없는 함정은 학습자에게 **이름만 늘려 준 것**이다.
    for (const t of UNIVERSAL) expect(`${t.key}:${Boolean(DETECTOR[t.key])}`).toBe(`${t.key}:true`)
  })
})

describe('rankFor — 범위를 바꾸면 다시 센다', () => {
  it('전체 범위의 합(이름 붙은 것 + 그 밖)이 총수와 같다', () => {
    const r = rankFor(null)
    expect(r.rows.reduce((a, x) => a + x.n, 0) + r.other.n).toBe(r.total)
    expect(r.total).toBe(CORPUS.distractors)
  })

  it('유형마다 합이 그 유형의 오답 수와 같다', () => {
    for (const t of ATLAS_TYPES) {
      const r = rankFor(t.id)
      const sum = r.rows.reduce((a, x) => a + x.n, 0) + r.other.n
      expect(`${t.id}:${sum}`).toBe(`${t.id}:${t.distractors}`)
      expect(r.other.n).toBeGreaterThanOrEqual(0)
    }
  })

  it('비율이 0~100 을 벗어나지 않는다', () => {
    for (const scope of [null, ...ATLAS_TYPES.map((t) => t.id)]) {
      for (const recent of [false, true]) {
        const r = rankFor(scope, recent)
        const total = r.rows.reduce((a, x) => a + x.pct, 0) + r.other.pct
        if (r.total === 0) {
          expect(total).toBe(0)
          continue
        }
        expect(total).toBeGreaterThan(99.9)
        expect(total).toBeLessThan(100.1)
      }
    }
  })

  it('내림차순으로 정렬돼 있고 0인 줄은 빼고 준다', () => {
    const r = rankFor('R-BLANK')
    expect(r.rows.every((x) => x.n > 0)).toBe(true)
    for (let i = 1; i < r.rows.length; i++) expect(r.rows[i - 1]!.n).toBeGreaterThanOrEqual(r.rows[i]!.n)
  })

  it('유형을 고르면 그 유형의 예시를 우선 내민다', () => {
    // 다른 유형 예시를 그대로 보여 주면 학습자는 「이 유형에서 이렇게 나온다」로 잘못 읽는다.
    for (const t of ATLAS_TYPES.slice(0, 8)) {
      for (const row of rankFor(t.id).rows) {
        const own = TRAPS.find((x) => x.key === row.key)!.examples.filter((e) => e.type_id === t.id)
        if (own.length) expect(row.examples.every((e) => e.type_id === t.id)).toBe(true)
      }
    }
  })

  it('최근 4개년만 보면 수치가 전체 이하다', () => {
    const all = rankFor(null)
    const recent = rankFor(null, true)
    expect(recent.total).toBeLessThanOrEqual(all.total)
    const allOf = new Map(all.rows.map((r) => [r.key, r.n]))
    for (const r of recent.rows) expect(r.n).toBeLessThanOrEqual(allOf.get(r.key) ?? 0)
  })
})

describe('standoutFor — 카드가 같은 말을 반복하지 않는다', () => {
  it('상위 함정만 되풀이하지 않는다', () => {
    // 전체 1~3위를 그대로 내밀면 26장의 카드가 전부 같은 말을 한다. 그건 정보가 아니다.
    const top3 = new Set(rankFor(null).rows.slice(0, 3).map((r) => r.key))
    const picked = ATLAS_TYPES.map((t) => standoutFor(t.id).slice(0, 3).map((r) => r.key))
    const withStandout = picked.filter((p) => p.length > 0)
    expect(withStandout.length).toBeGreaterThan(ATLAS_TYPES.length / 2)
    const onlyTop3 = withStandout.filter((p) => p.every((k) => top3.has(k)))
    expect(onlyTop3.length).toBeLessThan(withStandout.length / 2)
  })

  it('고른 함정은 그 유형에서 실제로 전체보다 잦다', () => {
    const base = new Map(rankFor(null).rows.map((r) => [r.key, r.pct]))
    for (const t of ATLAS_TYPES) {
      for (const s of standoutFor(t.id)) {
        expect(`${t.id}/${s.key}`).toBe(`${t.id}/${s.key}`)
        expect(s.pct).toBeGreaterThan(base.get(s.key) ?? 0)
        expect(s.n).toBeGreaterThanOrEqual(4)
      }
    }
  })
})
