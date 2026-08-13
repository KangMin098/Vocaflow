// apps/web/src/lib/admin/pending-words/__tests__/triage.test.ts
//
// pending_words 분류 회귀 — 관리자가 "무슨 조치를 해야 하는가" 를 잘못 판단하면
// 사전이 오염된다. 네 갈래가 섞이지 않는지 고정한다.

import { describe, expect, it } from 'vitest'

import { classifyPending, triageCandidates } from '../triage'

/** 실측 기반 사전 상태 — 어기는 있고 파생형은 없는 상황 (2026-08-13 shared_dictionary) */
const DICT = new Set([
  'glamorous',
  'label',
  'sell',
  'sugar',
  'carbon',
  'leader',
  'machine',
  'learning',
  'kilowatt',
  'hours',
  'first',
  'generation',
  'optimise',
  'optimisation',
  'colour',
  'analyse',
  'centre',
])

describe('triageCandidates — 사전에 물어볼 후보 생성', () => {
  it('하이픈 부분을 후보로 낸다', () => {
    expect(triageCandidates('machine-learning')).toEqual(
      expect.arrayContaining(['machine', 'learning']),
    )
  })

  it('미국식 철자의 영국식 변이를 후보로 낸다', () => {
    expect(triageCandidates('optimize')).toEqual(expect.arrayContaining(['optimise']))
    expect(triageCandidates('color')).toEqual(expect.arrayContaining(['colour']))
  })

  it('극성 반전 파생의 어기를 후보로 낸다', () => {
    expect(triageCandidates('unglamorous')).toEqual(expect.arrayContaining(['glamorous']))
    expect(triageCandidates('sugarless')).toEqual(expect.arrayContaining(['sugar']))
  })

  it('빈 입력에 안전하다', () => {
    expect(triageCandidates('')).toEqual([])
    expect(triageCandidates('   ')).toEqual([])
  })
})

describe('classifyPending — 네 갈래', () => {
  it('부분이 모두 해석되는 하이픈 전체형 → 노이즈', () => {
    expect(classifyPending('machine-learning', DICT)).toBe('hyphen_compound')
    expect(classifyPending('kilowatt-hours', DICT)).toBe('hyphen_compound')
    expect(classifyPending('first-generation', DICT)).toBe('hyphen_compound')
  })

  it('부분이 사전에 없으면 노이즈가 아니다', () => {
    expect(classifyPending('sorbent-bed', DICT)).toBe('genuine_gap')
  })

  it('영국식 철자가 사전에 있으면 → 해석기 구멍', () => {
    // 이 버킷에 항목이 뜨면 사전이 아니라 resolve_dict_headword 를 고쳐야 한다.
    expect(classifyPending('optimize', DICT)).toBe('spelling_variant')
    expect(classifyPending('optimization', DICT)).toBe('spelling_variant')
    expect(classifyPending('analyze', DICT)).toBe('spelling_variant')
    expect(classifyPending('center', DICT)).toBe('spelling_variant')
  })

  it('어기가 사전에 있는 극성 반전 파생 → 파생형', () => {
    expect(classifyPending('unglamorous', DICT)).toBe('derived_form')
    expect(classifyPending('mislabel', DICT)).toBe('derived_form')
    expect(classifyPending('sugarless', DICT)).toBe('derived_form')
    expect(classifyPending('carbonless', DICT)).toBe('derived_form')
    expect(classifyPending('leaderless', DICT)).toBe('derived_form')
  })

  it('어디에도 안 걸리면 → 진성 갭 (등재 1순위)', () => {
    expect(classifyPending('sorbents', DICT)).toBe('genuine_gap')
    expect(classifyPending('ppm', DICT)).toBe('genuine_gap')
    expect(classifyPending('geochemist', DICT)).toBe('genuine_gap')
    expect(classifyPending('mineralized', DICT)).toBe('genuine_gap')
  })

  it('어기가 사전에 없는 부정 접두사형은 진성 갭', () => {
    // un- 이 붙었다는 사실만으로 파생형으로 분류하면 안 된다 — 어기가 있어야 한다.
    expect(classifyPending('unobtainium', DICT)).toBe('genuine_gap')
  })

  it('하이픈이 다른 규칙과 겹쳐도 하이픈 노이즈가 우선', () => {
    const dict = new Set([...DICT, 'self'])
    expect(classifyPending('self-optimize', dict)).not.toBe('spelling_variant')
  })

  it('대소문자·공백에 견딘다', () => {
    expect(classifyPending('  Optimize  ', DICT)).toBe('spelling_variant')
  })
})
