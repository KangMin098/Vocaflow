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
import { looksNarrative, peopleRatio, NARRATIVE_FLOOR } from '../../../../scripts/csat/lib-narrative.mjs'

describe('서사 판정', () => {
  it('문턱은 장문 지칭 실측 최솟값(0.0382) 아래에 있다', () => {
    // 문턱을 실측보다 높이면 **만들 수 있던 글까지 버린다** — 그 성질을 못 박는다.
    expect(NARRATIVE_FLOOR).toBeLessThan(0.0382)
    expect(NARRATIVE_FLOOR).toBeGreaterThan(0)
  })

  it('사람이 나오는 글을 통과시킨다', () => {
    const story =
      'He set the box down and looked at her. She had not moved since he came in, ' +
      'and his hands were shaking as he spoke her name.'
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
