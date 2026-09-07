// apps/web/src/lib/learner/__tests__/source-label.test.ts
//
// 소스 라벨 드리프트 락.
//
// 학습자가 읽는 이름은 두 군데서만 정한다(apps/web/CLAUDE.md). 그런데 발행사 이름이
// `plan-activities` 와 `source-meta` 두 곳에 **각자** 적혀 있던 동안 조용히 갈렸다 —
// 소스가 늘어나도 한쪽만 따라왔고, 재저작 글은 계획·허브 레일에 내부 키 `original` 이
// 그대로 찍혔다. `??` 폴백이라 터지지도 않아서 화면을 열어 보기 전엔 알 수 없었다.
//
// 이 테스트는 "발행사 이름의 정본은 SOURCE_META 하나" 를 못 박는다.

import { describe, expect, it } from 'vitest'

import { SOURCE_META } from '@/lib/articles/source-meta'
import { articleSourceLabel, TEXT_ORIGIN_LABEL } from '@/lib/learner/plan-activities'

describe('소스 라벨', () => {
  it('SOURCE_META 에 있는 발행사는 전부 사람이 읽는 이름을 받는다', () => {
    const raw = Object.keys(SOURCE_META).filter((k) => articleSourceLabel(k) === k)
    expect(raw).toEqual([])
  })

  it('재저작 글은 내부 키가 아니라 우리 이름으로 보인다', () => {
    expect(articleSourceLabel('original')).toBe(SOURCE_META['original']!.short)
    expect(articleSourceLabel('original')).not.toBe('original')
  })

  it('내가 넣은 본문의 출처는 발행사와 키가 겹치지 않는다', () => {
    // 겹치면 한 맵이 다른 맵을 가려 엉뚱한 이름이 나온다.
    for (const k of Object.keys(TEXT_ORIGIN_LABEL)) {
      expect(SOURCE_META[k]).toBeUndefined()
    }
  })

  it('모르는 소스는 터지지 않고 읽을 만하게 폴백한다', () => {
    expect(articleSourceLabel('some_new_wire')).toBe('some new wire')
    expect(articleSourceLabel(null)).toBe('Other')
  })
})
