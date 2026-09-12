// apps/web/src/lib/text-extract/__tests__/source-sentence.test.ts
//
// 단어장 예문 = "학습자가 그 단어를 실제로 만난 문장" (학습원칙 #5 Context-Dependent).
// 이 계약이 깨지면 학습자는 **자기가 배우는 형태가 들어있지 않은 문장**을 예문으로 받는다.
//
// v06.35 실측 결함: 호출부가 인자를 뒤집어 넘기고 있었다.
//   extract_vocabulary_for_user_v2 의 반환 컬럼 `matched_via_surface` 는 이름과 달리
//   **표제어(headword)** 를 담고, `word` 가 원문 표면형이다. 호출부는 이름만 보고
//   (표제어, 표면형) 순으로 넘겨 1단계(정확 표면형 탐색)가 표제어를 찾고 있었다.

import { describe, expect, it } from 'vitest'

import { buildSentenceIndex, firstSentenceContaining } from '../source-sentence'

describe('firstSentenceContaining — 인자 계약', () => {
  // 표제어와 표면형이 **서로 다른 문장**에 등장하는 원문.
  // 인자를 뒤집으면 1단계가 표제어 문장을 먼저 잡아 잘못된 예문을 돌려준다.
  const text =
    'We capture carbon directly at the smokestack. ' +
    'The newest unit captures far more than the original design did.'
  const sentences = buildSentenceIndex(text)

  it('표면형이 있는 문장을 돌려준다 (표제어만 있는 문장이 아니라)', () => {
    const got = firstSentenceContaining(sentences, 'captures', 'capture')
    expect(got).not.toBeNull()
    expect(got!.toLowerCase()).toContain('captures')
  })

  it('인자를 뒤집으면 엉뚱한 문장이 나온다 — 회귀 방지용 반례 고정', () => {
    // 이것이 수정 전 호출부의 동작이었다. 계약을 어기면 이렇게 된다는 것을 명시적으로 남긴다.
    const swapped = firstSentenceContaining(sentences, 'capture', 'captures')
    expect(swapped).not.toBeNull()
    expect(swapped!.toLowerCase()).not.toContain('captures')
  })

  it('표면형이 원문에 없으면 표제어 굴절 탐색으로 폴백한다', () => {
    const got = firstSentenceContaining(sentences, null, 'capture')
    expect(got).not.toBeNull()
    expect(got!.toLowerCase()).toContain('capture')
  })

  it('둘 다 못 찾으면 null — 호출부가 사전 예문으로 폴백할 수 있게', () => {
    expect(firstSentenceContaining(sentences, 'basalt', 'basalt')).toBeNull()
  })
})

describe('firstSentenceContaining — 파생형 예문', () => {
  const text =
    'Nothing seemed to daunt her in those early years. ' +
    'Scaling this to a full industry is daunting, and I will not pretend otherwise.'
  const sentences = buildSentenceIndex(text)

  it('파생 표면형(daunting)을 배우면 그 형태가 든 문장을 준다', () => {
    const got = firstSentenceContaining(sentences, 'daunting', 'daunt')
    expect(got).not.toBeNull()
    expect(got!.toLowerCase()).toContain('daunting')
  })
})
