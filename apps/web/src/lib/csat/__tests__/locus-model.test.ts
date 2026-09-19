// apps/web/src/lib/csat/__tests__/locus-model.test.ts
//
// 이 요약은 학습자가 **규칙으로 외울** 문장이 된다. 그래서 여기서 가장 조심하는 것은
// 틀린 계산이 아니라 **과장**이다 — 60% 에 「대개」를 붙이면 그 말이 규칙이 되어 버린다.

import { describe, expect, it } from 'vitest'

import { MIN_SAMPLE, bandOf, locusSentence, summarizeLocus } from '../locus-model'

const rep = (v: number, n: number) => Array.from({ length: n }, () => v)

describe('bandOf — 경계', () => {
  it.each([
    [0, 'head'],
    [0.19, 'head'],
    [0.2, 'early'],
    [0.39, 'early'],
    [0.4, 'mid'],
    [0.6, 'late'],
    [0.79, 'late'],
    [0.8, 'end'],
    [1, 'end'],
  ])('%f → %s', (rel, key) => {
    expect(bandOf(rel)).toBe(key)
  })
})

describe('summarizeLocus', () => {
  it('표본이 적으면 null — 없는 규칙을 있는 척하지 않는다', () => {
    expect(summarizeLocus(rep(1, MIN_SAMPLE - 1))).toBeNull()
    expect(summarizeLocus([])).toBeNull()
  })

  it('딱 MIN_SAMPLE 이면 낸다', () => {
    expect(summarizeLocus(rep(1, MIN_SAMPLE))?.n).toBe(MIN_SAMPLE)
  })

  it('범위를 벗어난 값은 버린다 — 버린 뒤 표본이 모자라면 null', () => {
    expect(summarizeLocus([...rep(1, 3), ...rep(5, 20), ...rep(-1, 20)])).toBeNull()
  })

  it('구간이 0 이어도 자리를 지킨다 — 빠지면 사라진 걸로 읽힌다', () => {
    const s = summarizeLocus(rep(1, 10))!
    expect(s.bands).toHaveLength(5)
    expect(s.bands.map((b) => b.label)).toEqual(['앞머리', '앞', '가운데', '뒤', '끝'])
    expect(s.bands.find((b) => b.key === 'head')?.count).toBe(0)
  })

  it('평균과 비율이 맞는다', () => {
    const s = summarizeLocus([...rep(1, 8), ...rep(0, 2)])!
    expect(s.n).toBe(10)
    expect(s.avg).toBeCloseTo(0.8)
    expect(s.top.key).toBe('end')
    expect(s.top.share).toBeCloseTo(0.8)
  })

  it('뒤+끝 비율을 따로 센다', () => {
    const s = summarizeLocus([...rep(0.7, 5), ...rep(0.9, 5)])!
    expect(s.lateShare).toBeCloseTo(1)
  })

  it('동점이면 뒤쪽을 고른다 — 전체 분포가 뒤로 치우쳐 있다', () => {
    const s = summarizeLocus([...rep(0.1, 5), ...rep(0.9, 5)])!
    expect(s.top.key).toBe('end')
  })
})

describe('locusSentence — 과장하지 않는가', () => {
  it('100% 일 때만 «전부» 라고 말한다', () => {
    expect(locusSentence(summarizeLocus(rep(1, 12))!)).toContain('전부')
  })

  it('99% 면 «전부» 라고 말하지 않는다', () => {
    const s = summarizeLocus([...rep(1, 99), ...rep(0.1, 1)])!
    expect(locusSentence(s)).not.toContain('전부')
    expect(locusSentence(s)).toContain('99%')
  })

  it('한 구간이 60% 를 넘으면 그 구간을 말한다', () => {
    const s = summarizeLocus([...rep(0.9, 7), ...rep(0.1, 3)])!
    expect(locusSentence(s)).toContain('끝')
    expect(locusSentence(s)).toContain('70%')
  })

  it('한 구간은 약한데 뒤쪽이 몰려 있으면 «뒤쪽» 으로 묶어 말한다', () => {
    // 뒤 50% + 끝 50% → 한 구간은 50% 지만 뒤쪽 합은 100%.
    const s = summarizeLocus([...rep(0.7, 5), ...rep(0.9, 5)])!
    expect(s.top.share).toBeLessThan(0.6)
    expect(locusSentence(s)).toContain('뒤쪽')
  })

  it('흩어져 있으면 «고르게 흩어져» 라고 말한다 — 없는 규칙을 만들지 않는다', () => {
    const s = summarizeLocus([
      ...rep(0.1, 2), ...rep(0.3, 2), ...rep(0.5, 2), ...rep(0.7, 2), ...rep(0.9, 2),
    ])!
    const line = locusSentence(s)
    expect(line).toContain('고르게 흩어져')
    expect(line).not.toContain('대개')
  })
})
