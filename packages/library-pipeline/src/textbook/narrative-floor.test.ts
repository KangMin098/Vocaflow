// packages/library-pipeline/src/textbook/narrative-floor.test.ts
//
// 서사 판정 회귀. 지키려는 것은 **문턱이 실측에서 왔는가** 다.
//
// ── 무엇이 있었나 (실측 2026-09-06) ─────────────────────────────────
// V7 권에서 `mood`·`long_reference` 가 계속 0 이었다. 문항을 못 만든 것이 아니라
// **그 문항이 설 지문이 없었다** — 상위 밴드 재고 17,900편 중 인물 대명사가 있는 글이
// plos 13,514편에 37편, elife 287편에 0편이었다.
//
// 문턱은 짐작이 아니라 **이미 만든 문항**에서 가져왔다:
//   long_reference 39편 최소 0.0382 · mood 45편 최소 0.0051 · implication 35편 전부 0
// 장문 지칭이 가장 빡빡하므로 그 최솟값 아래로 문턱을 둔다(0.03).

import { describe, expect, it } from 'vitest'
// 정본은 스크립트 쪽에 있다 — 사본을 두면 둘이 갈린다.
import {
  looksNarrative,
  peopleRatio,
  speechCount,
  NARRATIVE_FLOOR,
  SPEECH_FLOOR,
} from '../../../../scripts/csat/lib-narrative.mjs'

describe('서사 판정', () => {
  it('문턱은 장문 지칭 실측 최솟값(0.0382) 아래에 있다', () => {
    // 문턱을 실측보다 높이면 **만들 수 있던 글까지 버린다** — 그 성질을 못 박는다.
    expect(NARRATIVE_FLOOR).toBeLessThan(0.0382)
    expect(NARRATIVE_FLOOR).toBeGreaterThan(0)
  })

  it('사람이 나오는 글을 통과시킨다', () => {
    // ⚠️ 이 fixture 는 나중에 고쳤다. 처음에는 "…as he spoke her name" 으로 끝나 발화
    //   동사가 없었는데, 판정에 발화 조건이 붙으면서 계약이 바뀌었다(아래 §발화 동사).
    //   **사람이 나오는 것만으로는 서사가 아니다** — 그것이 이번에 배운 것이다.
    const story =
      'He set the box down and looked at her. She had not moved since he came in. ' +
      '"You are late," she said, and his hands were shaking.'
    expect(peopleRatio(story)).toBeGreaterThan(NARRATIVE_FLOOR)
    expect(looksNarrative(story)).toBe(true)
  })

  it('사람이 없는 설명문을 막는다', () => {
    const paper =
      'The results indicate that all three bacterial strains can substantially enhance ' +
      'the shear strength of soil under the tested conditions.'
    expect(peopleRatio(paper)).toBe(0)
    expect(looksNarrative(paper)).toBe(false)
  })

  it('1인칭·2인칭은 세지 않는다 — 설명문에도 흔하다', () => {
    // 논문 초록이 "We hypothesized …" 로 열리는 일은 잦다. 그것을 서사로 세면 안 된다.
    const weVoice = 'We hypothesized that the half-life may be a limiting factor, and we measured it.'
    expect(peopleRatio(weVoice)).toBe(0)
    expect(looksNarrative(weVoice)).toBe(false)
  })

  it('빈 글은 0 이다', () => {
    expect(peopleRatio('')).toBe(0)
    expect(peopleRatio(null)).toBe(0)
    expect(looksNarrative('')).toBe(false)
  })

  it('낱말 안에 든 철자는 세지 않는다 — `the` 안의 `he` 같은 것', () => {
    const noPeople = 'The theatre there had shed its old sheen, and the shelves were bare.'
    expect(peopleRatio(noPeople)).toBe(0)
  })
})

// ── 발화 동사 (실측 2026-09-06) ──────────────────────────────────────
// 인물 밀도만으로 뽑았더니 심경 몫 다섯 편 중 한 편만 문항이 됐다. 나머지는 사람이
// 나오되 평론·전기였다. 기존 문항을 다시 재 보니 표지가 하나 더 있었다:
//   long_reference 39편 중 38편(97%) · mood 46편 중 34편(74%) 에 발화 동사
//   인용부호는 둘 다 0 — 지문 정제에서 사라져 지표로 못 쓴다
describe('발화 동사', () => {
  it('이야기와 전기를 가른다 — 인물 밀도가 못 하던 일이다', () => {
    const story = 'He set the box down. "Where have you been?" she asked. He said nothing at all.'
    const biography =
      'His admiration for Mr. Gladstone is to be explained by his failures rather than his successes.'
    // 인물 밀도는 둘 다 통과시킨다 — 그래서 잣대가 하나 더 필요했다.
    expect(peopleRatio(story)).toBeGreaterThan(NARRATIVE_FLOOR)
    expect(peopleRatio(biography)).toBeGreaterThan(NARRATIVE_FLOOR)
    expect(looksNarrative(story)).toBe(true)
    expect(looksNarrative(biography)).toBe(false)
  })

  it('발화 하한은 심경 지문을 살리는 쪽에 맞춘다', () => {
    // 둘로 올리면 long_reference(97%)는 살지만 mood 지문의 절반이 날아간다.
    expect(SPEECH_FLOOR).toBe(1)
  })

  it('발화 동사를 센다', () => {
    expect(speechCount('He said so, and she replied, and then he asked again.')).toBe(3)
    expect(speechCount('The paper reported a rise in temperature.')).toBe(0)
  })

  it('사람이 없으면 발화가 있어도 서사가 아니다', () => {
    // 논문에도 "reported/said" 는 나온다 — 두 조건을 함께 걸어야 논문이 걸러진다.
    expect(looksNarrative('The authors said the effect was small, and the reviewers asked for more data.')).toBe(false)
  })
})
