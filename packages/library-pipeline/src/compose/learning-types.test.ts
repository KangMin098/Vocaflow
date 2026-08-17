// packages/library-pipeline/src/compose/learning-types.test.ts
// ACP §20 — 학습 유형이 소스·처리·결과물을 가르는지.
//
// 지키는 것: 유형이 정해지면 나머지가 **따라 정해져야** 한다. 유형을 골랐는데
// 소스·길이·활동이 전부 같다면 이 축은 이름만 있는 것이다.

import { describe, expect, it } from 'vitest'

import { COMPOSE_ACTIVITIES } from './activities'
import {
  LEARNING_TYPES,
  buildJobSpec,
  composableTracks,
  renderJobBrief,
  sourcesForType,
  trackCoverage,
  validateLearningTypes,
  type LearningTrack,
} from './learning-types'

describe('레지스트리 정합', () => {
  it('키와 spec.track 이 일치한다', () => {
    for (const [k, v] of Object.entries(LEARNING_TYPES)) expect(v.track).toBe(k)
  })

  it('활동 키와 주제가 실재한다 (오타 잠금)', () => {
    expect(validateLearningTypes()).toEqual([])
  })

  it('축 값은 VRL 실측 어휘를 쓴다', () => {
    // shared_dictionary.track_levels 키 6종 (2026-08-17 실측)
    expect(Object.keys(LEARNING_TYPES).sort()).toEqual([
      'academic_english',
      'business_english',
      'conversational',
      'csat_korean',
      'general_proficiency',
      'literary',
    ])
  })
})

describe('유형이 실제로 다른 것을 만든다', () => {
  const composable = (Object.keys(LEARNING_TYPES) as LearningTrack[]).filter(
    (t) => LEARNING_TYPES[t].composable,
  )

  it('길이가 유형마다 다르다 — 수능이 가장 짧다', () => {
    const csat = LEARNING_TYPES['csat_korean'].compose.words
    const academic = LEARNING_TYPES['academic_english'].compose.words
    expect(csat.max).toBeLessThan(academic.min)
    // 서가 평균(1,100어)으로 쓰면 유형 연습이 안 된다
    expect(csat.max).toBeLessThanOrEqual(200)
  })

  it('문장 길이가 밴드를 따라간다 — 일반 영어가 가장 짧다', () => {
    const byLen = composable
      .map((t) => [t, LEARNING_TYPES[t].compose.avgSentenceWords] as const)
      .sort((a, b) => a[1] - b[1])
    expect(byLen[0]![0]).toBe('conversational')
    expect(byLen[byLen.length - 1]![0]).toBe('academic_english')
  })

  it('활동 세트가 유형마다 다르다', () => {
    const sets = composable.map((t) => LEARNING_TYPES[t].activities.join(','))
    expect(new Set(sets).size).toBe(sets.length)
  })

  it('수능만 순서·삽입을 붙인다 — 그게 수능 문항 유형이다', () => {
    expect(LEARNING_TYPES['csat_korean'].activities).toContain('order')
    expect(LEARNING_TYPES['csat_korean'].activities).toContain('insert')
    expect(LEARNING_TYPES['conversational'].activities).not.toContain('order')
    expect(LEARNING_TYPES['business_english'].activities).not.toContain('insert')
  })

  it('회화만 듣기 계열이 핵심이고 토론으로 끝난다', () => {
    const conv = LEARNING_TYPES['conversational'].activities
    expect(conv).toContain('shadowing')
    expect(conv).toContain('dictation')
    expect(conv).toContain('discussion')
    expect(LEARNING_TYPES['academic_english'].activities).not.toContain('shadowing')
  })

  it('어휘 기능이 유형 목표를 반영한다', () => {
    expect(LEARNING_TYPES['conversational'].skills).toContain('idiom')
    expect(LEARNING_TYPES['business_english'].skills).toContain('collocation')
    expect(LEARNING_TYPES['csat_korean'].skills).toContain('polysemy')
  })

  it('작성 지시가 검사 가능한 문장으로 쓰여 있다 (모호한 형용사 금지)', () => {
    for (const t of composable) {
      const ds = LEARNING_TYPES[t].compose.directives
      expect(ds.length).toBeGreaterThanOrEqual(3)
      for (const d of ds) expect(d.length).toBeGreaterThan(10)
    }
  })
})

describe('literary — 재저작 대상이 아니다', () => {
  it('composable=false 이고 발주가 서지 않는다', () => {
    expect(LEARNING_TYPES['literary'].composable).toBe(false)
    const plan = sourcesForType('literary')
    expect(plan.feasible).toBe(false)
    expect(plan.blocker).toContain('재저작 대상이 아니다')
  })

  it('사유가 라이선스가 아니라 "서사는 사실이 아니다" 로 적혀 있다', () => {
    expect(LEARNING_TYPES['literary'].note).toContain('서사는 사실이 아니다')
    expect(LEARNING_TYPES['literary'].note).toContain('LCP')
  })

  it('발주 사양을 만들려 하면 거부한다', () => {
    const r = buildJobSpec('literary', 6)
    expect('error' in r).toBe(true)
  })
})

describe('sourcesForType — 유형이 소스를 고른다', () => {
  it('수능은 환경·과학 소스를 받는다', () => {
    const p = sourcesForType('csat_korean')
    expect(p.feasible).toBe(true)
    expect(p.sources.map((s) => s.key)).toContain('noaa')
    expect(p.sources.map((s) => s.key)).toContain('voa')
  })

  it('비즈니스는 통신사·지표 소스를 받는다', () => {
    const p = sourcesForType('business_english')
    expect(p.feasible).toBe(true)
    const keys = p.sources.map((s) => s.key)
    expect(keys).toContain('owid')
    expect(keys.some((k) => ['reuters', 'ap', 'bbc', 'dw', 'koreaherald'].includes(k))).toBe(true)
  })

  it('유형마다 받는 소스 조합이 다르다', () => {
    const csat = sourcesForType('csat_korean').sources.map((s) => s.key).sort().join(',')
    const biz = sourcesForType('business_english').sources.map((s) => s.key).sort().join(',')
    expect(csat).not.toBe(biz)
  })

  it('막힌 주제는 사유와 함께 남는다 (조용히 빠지지 않는다)', () => {
    const p = sourcesForType('academic_english')
    for (const b of p.blockedTopics) expect(b.blocker.length).toBeGreaterThan(0)
  })

  it('재저작 가능한 유형 5종 — literary 만 빠진다', () => {
    expect(composableTracks().sort()).toEqual([
      'academic_english',
      'business_english',
      'conversational',
      'csat_korean',
      'general_proficiency',
    ])
  })
})

describe('buildJobSpec', () => {
  it('유형 밴드 안이면 사양을 만든다', () => {
    const r = buildJobSpec('csat_korean', 6)
    expect('error' in r).toBe(false)
    if ('error' in r) return
    expect(r.words.max).toBeLessThanOrEqual(200)
    expect(r.activities).toContain('order')
    expect(r.skillFocus).toBe('single_word')
  })

  it('밴드 밖 레벨은 조용히 보정하지 않고 거부한다', () => {
    // 보정하면 "수능 유형인데 V2" 발주가 성공한 것처럼 보이고 산출물이 어디에도 안 맞는다.
    const r = buildJobSpec('csat_korean', 2)
    expect('error' in r).toBe(true)
    if (!('error' in r)) return
    expect(r.error).toContain('V4–V8')
  })

  it('유형이 쓰지 않는 register 는 거부한다', () => {
    const r = buildJobSpec('academic_english', 8, { register: 'narrative' })
    expect('error' in r).toBe(true)
  })

  it('유형이 쓰지 않는 어휘 기능은 거부한다', () => {
    const r = buildJobSpec('academic_english', 8, { skillFocus: 'idiom' })
    expect('error' in r).toBe(true)
  })
})

describe('renderJobBrief — drain 프롬프트에 그대로 들어간다', () => {
  it('유형·목표·지시·활동이 모두 담긴다', () => {
    const job = buildJobSpec('conversational', 4)
    if ('error' in job) throw new Error(job.error)
    const brief = renderJobBrief(job)
    expect(brief).toContain('생활 회화')
    expect(brief).toContain('V4')
    expect(brief).toContain('구동사')
    expect(brief).toContain(COMPOSE_ACTIVITIES['shadowing']!.label)
  })
})

describe('trackCoverage — Admin 소스 화면 표시원', () => {
  it('유형 6종을 전부 돌려주고 literary 는 불가로 표시된다', () => {
    const rows = trackCoverage()
    expect(rows).toHaveLength(6)
    expect(rows.find((r) => r.track === 'literary')!.feasible).toBe(false)
    expect(rows.find((r) => r.track === 'csat_korean')!.sources).toContain('noaa')
  })
})
