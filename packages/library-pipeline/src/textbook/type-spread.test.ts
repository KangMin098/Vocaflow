// packages/library-pipeline/src/textbook/type-spread.test.ts
import { describe, expect, it } from 'vitest'

import { V_TO_MARKET_BUCKET } from './level-chart'
import { SERIES_SPINE } from './series'
import { measureSkew, measureSpread, measureVolumeSpread, schoolOfBucket } from './type-spread'

/** 시중 실측(`market-spec.json` typeCoverage.perDocument.bySchool.*.median · 2026-09-01). */
const MARKET = { 초등: 4, 중등: 4, 고등: 9 } as const

describe('schoolOfBucket — 눈금을 새로 만들지 않는다', () => {
  it('정본 버킷을 학교급으로 옮긴다', () => {
    expect(schoolOfBucket('초6')).toBe('초등')
    expect(schoolOfBucket('중1')).toBe('중등')
    expect(schoolOfBucket('고1')).toBe('고등')
    expect(schoolOfBucket('고3')).toBe('고등')
  })

  it('모르는 값은 null — 짐작으로 학교급을 주지 않는다', () => {
    expect(schoolOfBucket(null)).toBeNull()
    expect(schoolOfBucket('')).toBeNull()
    expect(schoolOfBucket('대학')).toBeNull()
  })

  it('사다리 전 밴드가 학교급을 갖는다 — 못 옮기는 밴드가 있으면 리포트에 구멍이 난다', () => {
    for (const rung of SERIES_SPINE) {
      const lead = rung.vLevels[0]!
      expect(schoolOfBucket(V_TO_MARKET_BUCKET[lead] ?? null), `V${lead}`).not.toBeNull()
    }
  })
})

describe('measureVolumeSpread', () => {
  const base = {
    band: 5,
    schoolBand: '고1',
    marketBucket: '고1',
    declaredTypes: ['blank', 'order', 'insert', 'title'],
  }

  it('선언했는데 안 실린 유형을 이름으로 낸다 — 수만 내면 무엇을 채울지 모른다', () => {
    const r = measureVolumeSpread({ ...base, printedTypes: ['order', 'insert'] }, MARKET)
    expect(r.declared).toBe(4)
    expect(r.printed).toBe(2)
    expect(r.absent).toEqual(['blank', 'title'])
    expect(r.unexpected).toEqual([])
  })

  it('선언에 없는데 실린 유형도 잡는다 — 사다리와 조합기가 어긋난 자국이다', () => {
    const r = measureVolumeSpread({ ...base, printedTypes: ['order', 'vocab_choice'] }, MARKET)
    expect(r.unexpected).toEqual(['vocab_choice'])
  })

  it('중복으로 넣어도 종 수로 센다', () => {
    const r = measureVolumeSpread({ ...base, printedTypes: ['order', 'order', 'order'] }, MARKET)
    expect(r.printed).toBe(1)
  })

  it('시중 중앙값 미만이면 behind — 지수는 분자/분모 그대로다', () => {
    const r = measureVolumeSpread({ ...base, printedTypes: ['order', 'insert', 'blank'] }, MARKET)
    expect(r.market).toBe(9)
    expect(r.index).toBeCloseTo(3 / 9, 6)
    expect(r.state).toBe('behind')
  })

  it('중앙값 이상이면 ahead', () => {
    const printedTypes = Array.from({ length: 9 }, (_, i) => `t${i}`)
    const r = measureVolumeSpread({ ...base, declaredTypes: printedTypes, printedTypes }, MARKET)
    expect(r.state).toBe('ahead')
    expect(r.index).toBe(1)
  })

  // ⚠️ 이 저장소가 이미 겪은 사고 — 못 잰 것을 0 이나 통과로 뭉개면 거짓 초록이 된다.
  it('시중 기준선이 없으면 unmeasured — 0 으로도 1 로도 뭉개지 않는다', () => {
    const r = measureVolumeSpread(
      { ...base, marketBucket: '대학', printedTypes: ['order'] },
      MARKET,
    )
    expect(r.market).toBeNull()
    expect(r.index).toBeNull()
    expect(r.state).toBe('unmeasured')
  })

  it('기준선이 0 이어도 나누지 않는다 — Infinity 를 우위로 적지 않는다', () => {
    const r = measureVolumeSpread({ ...base, printedTypes: ['order'] }, { 고등: 0 })
    expect(r.index).toBeNull()
    expect(r.state).toBe('unmeasured')
  })

  it('지면이 비면 printed 0 — 스냅샷은 실제 조합 결과라 「못 쟀다」가 아니다', () => {
    const r = measureVolumeSpread({ ...base, printedTypes: [] }, MARKET)
    expect(r.printed).toBe(0)
    expect(r.state).toBe('behind')
  })
})

describe('measureSpread — 사다리 전체', () => {
  const volumes = [
    { band: 1, schoolBand: '초등 저학년', marketBucket: '초6', declaredTypes: ['rhyme', 'word_meaning', 'spell_blank', 'blank'], printedTypes: ['rhyme', 'word_meaning', 'spell_blank'] },
    { band: 5, schoolBand: '고1', marketBucket: '고1', declaredTypes: ['blank', 'order', 'insert'], printedTypes: ['order', 'insert'] },
    { band: 9, schoolBand: '대학', marketBucket: null, declaredTypes: ['blank'], printedTypes: ['blank'] },
  ]

  it('권별 판정을 세고, 못 잰 권을 따로 센다', () => {
    const r = measureSpread(volumes, MARKET)
    expect(r.ahead).toBe(0)
    expect(r.behind).toBe(2)
    expect(r.unmeasured).toBe(1)
  })

  it('어느 권에도 안 실린 유형만 absentEverywhere 에 남는다', () => {
    const r = measureSpread(volumes, MARKET)
    // blank 는 V9 에 실렸으므로 전체 기준으로는 빠지지 않는다.
    expect(r.absentEverywhere).toEqual([])
  })

  it('한 권에서만 빠진 유형은 그 권의 absent 에만 있다', () => {
    const r = measureSpread(volumes, MARKET)
    expect(r.volumes[1]!.absent).toEqual(['blank'])
  })

  it('전 권에서 빠진 유형은 전체 목록에 오른다', () => {
    const r = measureSpread(
      [{ band: 5, schoolBand: '고1', marketBucket: '고1', declaredTypes: ['blank', 'order'], printedTypes: ['order'] }],
      MARKET,
    )
    expect(r.absentEverywhere).toEqual(['blank'])
  })

  it('하나도 못 재면 평균 지수는 null — 0 이 아니다', () => {
    const r = measureSpread([volumes[2]!], MARKET)
    expect(r.meanIndex).toBeNull()
  })

  it('평균 지수는 견줄 수 있었던 권만으로 낸다', () => {
    const r = measureSpread(volumes, MARKET)
    expect(r.meanIndex).toBeCloseTo((3 / 4 + 2 / 9) / 2, 6)
  })
})

// ── 왜 시차 검사가 생겼나 (실측 2026-09-13) ─────────────────────────
// 이 자의 첫 판이 「사다리가 19종을 선언해 놓고 지면에 4종만 실린다」고 답했고, 그 답으로
// 리포트와 CHANGELOG 를 썼다. 그런데 스냅샷 시점(09-07)의 사다리를 git 에서 꺼내 보니
// 선언이 **4종**이었다 — 지면과 정확히 같았다. 19 는 그날 17:26 커밋이 넓힌 값이다.
// **조합기를 범인으로 지목했는데 결백했다.** 그 오독을 다시 못 하게 여기서 잠근다.
describe('measureSkew — 두 입력의 시각이 어긋났는가', () => {
  it('스냅샷이 사다리보다 낡으면 stale', () => {
    const r = measureSkew('2026-09-07T14:14:23Z', '2026-09-13T08:26:00Z')
    expect(r?.stale).toBe(true)
  })

  it('스냅샷이 사다리보다 새로우면 stale 이 아니다 — 그때의 차이는 진짜 결함이다', () => {
    const r = measureSkew('2026-09-14T00:00:00Z', '2026-09-13T08:26:00Z')
    expect(r?.stale).toBe(false)
  })

  it('같은 시각이면 stale 이 아니다', () => {
    expect(measureSkew('2026-09-13T08:26:00Z', '2026-09-13T08:26:00Z')?.stale).toBe(false)
  })

  // ⚠️ 못 잰 것을 false 로 뭉개면 시차가 조용히 숨는다 — 그러면 첫 판의 오독이 되풀이된다.
  it('한쪽이 없거나 못 읽는 값이면 null — false 로 뭉개지 않는다', () => {
    expect(measureSkew(null, '2026-09-13T08:26:00Z')).toBeNull()
    expect(measureSkew('2026-09-07T14:14:23Z', undefined)).toBeNull()
    expect(measureSkew('어제', '2026-09-13T08:26:00Z')).toBeNull()
    expect(measureSkew('2026-09-07T14:14:23Z', '내일')).toBeNull()
  })

  it('measureSpread 가 시각을 받으면 보고서에 함께 낸다', () => {
    const vols = [{ band: 5, schoolBand: '고1', marketBucket: '고1', declaredTypes: ['blank', 'order'], printedTypes: ['order'] }]
    const r = measureSpread(vols, MARKET, { printedAt: '2026-09-07T14:14:23Z', declaredAt: '2026-09-13T08:26:00Z' })
    expect(r.skew?.stale).toBe(true)
    // 결손 자체는 그대로 낸다 — 시차는 **읽는 법**을 바꾸지 판정을 지우지 않는다.
    expect(r.absentEverywhere).toEqual(['blank'])
  })

  it('시각을 안 주면 skew 는 null', () => {
    const r = measureSpread([], MARKET)
    expect(r.skew).toBeNull()
  })
})
