// packages/library-pipeline/src/textbook/academic-reading.test.ts
import { describe, expect, it } from 'vitest'
import {
  DOMAIN_TARGET_MIX,
  PRODUCT_FAMILIES,
  READING_PROGRESSION,
  READING_SKILLS,
  readingLicenseBlockers,
  readingSourceRole,
  readingTargetSchema,
  SOURCE_SCORE_WEIGHTS,
} from './academic-reading'
import {
  validateReadingAnalysis,
  validateReadingItem,
  validateReadingPresentation,
} from './academic-reading-contract'

import { analysis, quote, rights, target } from './academic-reading-fixtures'

describe('Academic Reading targeting', () => {
  it('언어 중1 수준에서도 고1 독자·사고 목표를 따로 지정한다', () => {
    expect(
      readingTargetSchema.parse({ ...target, age_band: 'high_1', reasoning_band: 'high_1' })
        .passage_v_level
    ).toBe(3)
  })
  it('어휘 밴드 밖 V-Level과 빈 능력 목표를 막는다', () => {
    expect(readingTargetSchema.safeParse({ ...target, passage_v_level: 11 }).success).toBe(false)
    expect(readingTargetSchema.safeParse({ ...target, skills: [] }).success).toBe(false)
  })
  it('원천 역할은 직접 생성·연령 anchor·발견·벤치마크를 구분한다', () => {
    expect(readingSourceRole('frym')).toBe('age_anchor')
    expect(readingSourceRole('nih_news_in_health')).toBe('generation')
    for (const s of ['openalex', 'europe_pmc', 'doaj', 'econstor'])
      expect(readingSourceRole(s)).toBe('discovery')
    for (const s of ['kice', 'openstax', 'the_conversation'])
      expect(readingSourceRole(s)).toBe('benchmark')
    expect(readingSourceRole('unregistered')).toBe('restricted')
  })
  it('원천·AI 권리 미확인과 ShareAlike 미이행을 막는다', () => {
    expect(readingLicenseBlockers({ ...rights, canonical_source: 'kice' }, target)).not.toEqual([])
    expect(readingLicenseBlockers({ ...rights, ai_processing: 'unknown' }, target)).not.toEqual([])
    expect(readingLicenseBlockers({ ...rights, share_alike: true }, target)).not.toEqual([])
    expect(readingLicenseBlockers(rights, target)).toEqual([]) // 이미지 사용은 이 텍스트 계약에 없다.
  })
  it('자료를 발명해서 다지문·도표 제품군을 선언할 수 없다', () => {
    expect(
      readingTargetSchema.safeParse({ ...target, family: 'P13', skills: ['R11'] }).success
    ).toBe(false)
    expect(
      readingTargetSchema.safeParse({ ...target, family: 'P14', skills: ['R12'] }).success
    ).toBe(false)
  })
  it('100점 및 분야 목표는 사용자 설계값으로 총합을 유지한다', () => {
    expect(Object.values(SOURCE_SCORE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
    expect(Object.values(DOMAIN_TARGET_MIX).reduce((a, b) => a + b, 0)).toBe(100)
    expect(Object.keys(READING_SKILLS)).toHaveLength(14)
    expect(Object.keys(PRODUCT_FAMILIES)).toHaveLength(20)
    expect(Object.keys(READING_PROGRESSION)).toHaveLength(7)
  })
})
describe('본문과 근거에 묶인 독해 분석', () => {
  it('지문·문항 사고 수준과 난이도를 독립적으로 보존한다', () => {
    const result = validateReadingAnalysis(target, analysis, quote, quote)
    expect(result.ok).toBe(true)
    expect(analysis.passage_profile.overall_level.level).toBe(4)
    expect(analysis.item_plan[0]?.item_reasoning_level).toBe(7)
    expect(analysis.item_plan[0]?.item_difficulty).toBe(5)
  })
  it('열 분석축 중 하나라도 빠지면 보류한다', () => {
    const bad = structuredClone(analysis) as unknown as { passage_profile: Record<string, unknown> }
    delete bad.passage_profile.inference_level
    expect(validateReadingAnalysis(target, bad, quote, quote).ok).toBe(false)
  })
  it('원문과 각색문 근거를 각각 검증한다', () => {
    expect(
      validateReadingAnalysis(target, analysis, 'A different original source.', quote).ok
    ).toBe(false)
    expect(
      validateReadingAnalysis(target, analysis, quote, 'A different adapted passage.').ok
    ).toBe(false)
  })
  it('요청한 skill 누락·본문에 없는 근거·연령 부적합을 막는다', () => {
    expect(
      validateReadingAnalysis({ ...target, skills: ['R4', 'R7'] }, analysis, quote, quote).ok
    ).toBe(false)
    const bad = structuredClone(analysis)
    bad.item_plan[0]!.evidence = ['An invented evidence sentence.']
    expect(validateReadingAnalysis(target, bad, quote, quote).ok).toBe(false)
    const unsafe = structuredClone(analysis)
    unsafe.passage_profile.age_appropriateness.appropriate = false
    expect(validateReadingAnalysis(target, unsafe, quote, quote).ok).toBe(false)
  })
  it('문항 payload에서 지문 수준·타깃·능력·근거의 변조를 막는다', () => {
    const item = {
      version: 1,
      target,
      skill: 'R4',
      passage_level: 4,
      item_reasoning_level: 7,
      item_difficulty: 5,
      difficulty_evidence: 'Main idea requires separating details.',
      evidence: [quote],
    }
    expect(validateReadingItem(item, target, 'topic', quote, 4)).toBeNull()
    expect(
      validateReadingItem({ ...item, passage_level: 7 }, target, 'topic', quote, 4)
    ).not.toBeNull()
    expect(validateReadingItem({ ...item, skill: 'R8' }, target, 'topic', quote, 4)).not.toBeNull()
    expect(
      validateReadingItem(
        { ...item, evidence: ['A fabricated sentence.'] },
        target,
        'topic',
        quote,
        4
      )
    ).not.toBeNull()
    expect(
      validateReadingItem(
        { ...item, target: { ...target, age_band: 'high_1' } },
        target,
        'topic',
        quote,
        4
      )
    ).not.toBeNull()
  })
  it('원본 근거만 남기고 실제 제시문을 바꾸는 우회를 차단한다', () => {
    expect(
      validateReadingPresentation({ passage: 'A fabricated unrelated passage.' }, quote, 'topic')
    ).not.toBeNull()
    expect(validateReadingPresentation({ passage: quote }, quote, 'topic')).toBeNull()
  })
  it('빈칸/어휘 문제는 지정된 한 구간의 치환만 허용한다', () => {
    expect(
      validateReadingPresentation({ passage: 'Warm water ____ ocean habitats.' }, quote, 'blank')
    ).toBeNull()
    expect(
      validateReadingPresentation({ passage: 'Cold water ____ ocean habitats.' }, quote, 'blank')
    ).not.toBeNull()
    expect(
      validateReadingPresentation(
        {
          passage_edited: 'Warm water preserves ocean habitats.',
          swapped: { from: 'changes', to: 'preserves' },
        },
        quote,
        'long_vocab'
      )
    ).toBeNull()
    expect(
      validateReadingPresentation(
        {
          passage_edited: 'Cold water preserves ocean habitats.',
          swapped: { from: 'changes', to: 'preserves' },
        },
        quote,
        'long_vocab'
      )
    ).not.toBeNull()
  })
})
