// apps/web/src/lib/dictation/__tests__/hint.test.ts
//
// 힌트 사다리의 **순서**를 고정한다.
//
// 왜 테스트가 필요한가: 순서가 뒤집혀도 화면은 멀쩡하다. 버튼 4개가 그대로 뜨고
// 눌리면 무언가 보인다. 실제로 2026-08-15 이전에는 1·2 가 뒤집혀 있었고
// (첫 글자 -5 가 길이 표시 -3 보다 먼저), 아무 테스트도 그걸 몰랐다.
// 그 상태에서는 순서대로 누른 학습자가 **필요보다 많은 도움을 먼저** 받고
// 벌점은 되레 내려간다 — 학습 설계가 조용히 무너지는 종류의 결함이다.

import { describe, expect, it } from 'vitest'

import { HINT_STAGES } from '../hint'

const SENTENCE = 'The morning sun rose over the quiet village.'

describe('HINT_STAGES — 사다리는 단조 증가한다', () => {
  it('레벨이 1..4 로 빠짐없이 오름차순이다', () => {
    expect(HINT_STAGES.map((s) => s.level)).toEqual([1, 2, 3, 4])
  })

  it('벌점이 레벨과 함께 **커진다** (아껴 쓰면 이득이라는 계약)', () => {
    const costs = HINT_STAGES.map((s) => Math.abs(s.penalty))
    for (let i = 1; i < costs.length; i += 1) {
      expect(costs[i], `L${i + 1} 이 L${i} 보다 싸다 — 순서가 뒤집혔다`).toBeGreaterThan(costs[i - 1])
    }
  })

  it('뒤 단계일수록 **더 많이 알려준다** (드러난 글자 수로 잰다)', () => {
    // 길이 표시는 글자를 하나도 안 드러내고, 첫 글자는 단어 수만큼 드러내고,
    // 정답은 전부 드러낸다. 이 순서가 곧 scaffolding 이다.
    const revealed = (out: string) => (out.match(/[a-zA-Z]/g) ?? []).length
    const lengths = revealed(HINT_STAGES[0].show(SENTENCE))
    const firstLetters = revealed(HINT_STAGES[1].show(SENTENCE))
    const answer = revealed(HINT_STAGES[3].show(SENTENCE))

    expect(lengths, '길이 표시가 글자를 드러낸다').toBe(0)
    expect(firstLetters).toBeGreaterThan(lengths)
    expect(answer).toBeGreaterThan(firstLetters)
  })

  it('정답 공개는 마지막 단계다 (evaluateTargets 가 level 4 를 Again 으로 읽는다)', () => {
    expect(HINT_STAGES[HINT_STAGES.length - 1].level).toBe(4)
    expect(HINT_STAGES[3].show(SENTENCE)).toBe(SENTENCE)
  })

  it('번역이 없으면 뜻 힌트가 그 사실을 말한다 (빈 문자열로 침묵하지 않는다)', () => {
    const out = HINT_STAGES[2].show(SENTENCE, undefined)
    expect(out.trim().length).toBeGreaterThan(0)
    expect(out).not.toBe(SENTENCE)
  })
})
