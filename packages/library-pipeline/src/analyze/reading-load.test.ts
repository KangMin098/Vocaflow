// packages/library-pipeline/src/analyze/reading-load.test.ts
//
// 길이 판단이 **버리지 않고 알리는지**를 못 박는다.
// 실측 2026-08-20: 검수 대기에 7,013어 논문 전문(plos)과 13,942어 백과 항목이 있었고,
// 파이프라인 어디에도 본문 길이에 대한 판단이 없었다.

import { describe, expect, it } from 'vitest'

import { ACCEPTED_WORDS_P90, ARTICLE_WPM, assessReadingLoad } from './reading-load'

describe('assessReadingLoad', () => {
  it('발행분 중앙값(855어)은 예외가 아니다', () => {
    const r = assessReadingLoad(855)
    expect(r.overLong).toBe(false)
    expect(r.note).toBeNull()
  })

  it('p90 정확히 그 값까지는 통과한다 — 경계에서 갑자기 막지 않는다', () => {
    expect(assessReadingLoad(ACCEPTED_WORDS_P90).overLong).toBe(false)
    expect(assessReadingLoad(ACCEPTED_WORDS_P90 + 1).overLong).toBe(true)
  })

  it('논문 전문(7,013어)은 표시하되 사유에 비교 대상을 담는다', () => {
    const r = assessReadingLoad(7013)
    expect(r.overLong).toBe(true)
    // "길다" 만으로는 검수자가 판단할 수 없다 — 무엇과 견줘 긴지 있어야 한다.
    expect(r.note).toContain('p90')
    expect(r.note).toContain('7,013')
    expect(r.note).toContain('분')
  })

  it('읽기 시간은 analyze-article 과 같은 속도를 쓴다', () => {
    // 여기가 어긋나면 검수 화면의 분과 목록의 분이 달라진다.
    expect(ARTICLE_WPM).toBe(200)
    expect(assessReadingLoad(400).minutes).toBe(2)
  })

  it('0·null·음수는 1분으로 보고 예외로 삼지 않는다', () => {
    for (const v of [0, null, undefined, -5]) {
      const r = assessReadingLoad(v)
      expect(r.minutes).toBe(1)
      expect(r.overLong).toBe(false)
    }
  })

  it('임계값은 짐작이 아니라 실측이다 — 발행분 p90', () => {
    // 이 숫자가 바뀌면 근거를 다시 재야 한다는 신호다.
    expect(ACCEPTED_WORDS_P90).toBe(2848)
  })
})
