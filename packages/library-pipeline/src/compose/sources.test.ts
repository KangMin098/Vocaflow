// packages/library-pipeline/src/compose/sources.test.ts
// ACP §20 — 사실 출처 레지스트리 회귀.
//
// 이 테스트가 지키는 것은 목록이 아니라 **발주 전에 실현 가능성을 먼저 묻는다**는 규약이다.
// 불가능한 주제로 발주가 나가면 수집·작성 비용을 다 쓴 뒤 I12 에서 버려진다.

import { describe, expect, it } from 'vitest'

import {
  EXCLUDED_FACT_SOURCES,
  FACT_SOURCES,
  feasibleTopics,
  planFactSources,
} from './sources'

describe('FACT_SOURCES 레지스트리', () => {
  it('키와 spec.key 가 일치한다', () => {
    for (const [k, v] of Object.entries(FACT_SOURCES)) expect(v.key).toBe(k)
  })

  it('약관 위험이 있는 소스는 채택 목록에 없다 (1단계는 PD/CC 공개 자료만)', () => {
    const risky = Object.values(FACT_SOURCES).filter((s) => s.termsRisk !== 'none')
    expect(risky.map((s) => s.key)).toEqual([])
  })

  it('제외 사유가 라이선스가 아니라 사실 출처 적합성으로 적혀 있다', () => {
    const ted = EXCLUDED_FACT_SOURCES.find((e) => e.key === 'ted')
    expect(ted).toBeDefined()
    expect(ted!.reason).toContain('단일 출처')
  })
})

describe('planFactSources', () => {
  it('기후 주제는 1차원(NOAA) + 교차원(VOA) 으로 발주 가능', () => {
    const p = planFactSources('the-natural-world-weather')
    expect(p.primary.map((s) => s.key)).toContain('noaa')
    expect(p.corroborating.map((s) => s.key)).toContain('voa')
    expect(p.independentPublishers).toBeGreaterThanOrEqual(2)
    expect(p.feasible).toBe(true)
    expect(p.blocker).toBeNull()
  })

  it('건강 주제는 1차원(NIH)은 있으나 교차원이 없어 발주 불가', () => {
    // health-* 는 topic_corpus 에서 TED(재사용 불가)로만 덮인 칸이다. 재저작으로 열려면
    // 교차 확인원이 하나 더 필요하다 — 레지스트리가 그 사실을 먼저 말해야 한다.
    const p = planFactSources('health-mental-health')
    expect(p.primary.map((s) => s.key)).toEqual(['nih'])
    expect(p.feasible).toBe(false)
    expect(p.blocker).toContain('교차 확인원이 없다')
  })

  it('1차 사실원이 없는 주제는 보도만으로 발주하지 않는다', () => {
    const p = planFactSources('sport')
    expect(p.primary).toEqual([])
    expect(p.feasible).toBe(false)
    expect(p.blocker).toContain('1차 사실원이 없다')
  })

  it('Wikipedia 는 모든 주제를 덮지만 독립 출처로 세지 않는다', () => {
    // 백과를 교차원으로 인정하면 실질 단일 출처인 글이 I12 를 통과해 버린다.
    const p = planFactSources('sport')
    expect(p.background.map((s) => s.key)).toContain('wikipedia')
    expect(p.corroborating).toEqual([])
    expect(p.independentPublishers).toBe(0)
    expect(p.feasible).toBe(false)
  })

  it('수집 실적 0인 소스(wikinews)는 기본 계획에서 빠지고 includeIdle 로만 보인다', () => {
    const base = planFactSources('politics-and-society-social-issues')
    const idle = planFactSources('politics-and-society-social-issues', { includeIdle: true })
    expect(base.corroborating.map((s) => s.key)).not.toContain('wikinews')
    expect(idle.corroborating.map((s) => s.key)).toContain('wikinews')
  })
})

describe('feasibleTopics', () => {
  it('지금 발주 가능한 주제만 돌려준다', () => {
    const topics = feasibleTopics()
    expect(topics).toContain('the-natural-world-weather')
    expect(topics).toContain('politics-and-society-social-issues')
    // 교차원 없는 칸은 빠진다 — 발주 화면 선택지가 곧 실현 가능성이다.
    expect(topics).not.toContain('health-mental-health')
    expect(topics).not.toContain('sport')
  })

  it('현재 발주 가능 주제 = 5개 (능력 스냅샷 — 소스가 늘면 여기가 먼저 바뀐다)', () => {
    expect(feasibleTopics()).toEqual([
      'health-health-and-fitness',
      'politics-and-society-social-issues',
      'science-and-technology',
      'the-natural-world-the-environment',
      'the-natural-world-weather',
    ])
  })

  it('병목은 1차원이 아니라 교차 확인원이다 — 전부 VOA 한 곳에 매달려 있다', () => {
    // 1차 사실원은 6곳(usgs·noaa·nasa·nih·elife·owid)이나 교차 확인원은 VOA 뿐이라,
    // VOA 가 안 덮는 주제는 1차원이 있어도 전부 발주 불가다. 다음에 추가할 소스는
    // 또 다른 기관이 아니라 **두 번째 독립 교차원**이어야 한다.
    const feasible = feasibleTopics()
    for (const t of feasible) {
      expect(planFactSources(t).corroborating.map((s) => s.key)).toEqual(['voa'])
    }
    // 1차원은 있는데 교차원이 없어 막힌 주제들
    for (const t of [
      'the-natural-world-geography',
      'time-and-space-space',
      'health-mental-health',
      'science-and-technology-biology',
      'work-and-business-business',
    ]) {
      const p = planFactSources(t)
      expect(p.primary.length).toBeGreaterThan(0)
      expect(p.blocker).toContain('교차 확인원이 없다')
    }
  })
})
