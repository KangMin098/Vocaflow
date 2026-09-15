// packages/wlp/src/__tests__/sentence-index.test.ts
//
// **토큰의 `sentenceIndex` 가 가리키는 문장에 그 토큰이 실제로 들어 있는가.**
//
// 왜 잠그나 — `extract-lemmas` 는 이 인덱스로 낱말의 「첫 등장 문장」을 되찾아
// `library_book_vocabularies.first_sentence` 에 넣고, 그 값이 학습자 플래시카드의
// 예문이 된다. 인덱스가 한 칸이라도 밀리면 **낱말이 없는 예문**이 학습자에게 간다.
// 실측 2026-09-05: 도서 어휘 1,678,029행 중 89,177행(5.31%)이 그 상태였다.
//
// 렌더도 저장도 성공하므로 이 결함은 조용하다. 여기서 시끄럽게 만든다.

import { describe, expect, it } from 'vitest'

import { processText } from '../processor'

/** 인용부호·대시가 섞여도 견디게 — 문장 텍스트와 토큰을 같은 자로 재운다 */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

describe('processText — sentenceIndex 정합', () => {
  const samples: Array<[string, string]> = [
    ['평범한 산문', 'The cat sat on the mat. A dog barked loudly. Then the room fell silent again.'],
    [
      '인용부호와 대시',
      '"I cannot," she said. He replied — quietly, as always — that the willow by the gate had fallen. Nobody moved.',
    ],
    [
      '줄바꿈이 섞인 문단',
      'He kept a shop in Boston.\n\nIn it he took in some small profit.\r\n\r\nThe legible hand of the clerk\nsurprised everyone who saw it.',
    ],
    [
      '약어와 숫자',
      'Dr. Smith arrived at 9 a.m. on Jan. 3, 1901. The cannon was fired twice. Mr. Jones counted 12 of them.',
    ],
    [
      '괄호와 각주 표식',
      'The observations of the judicious Blackstone,70 in reference to the latter, are worth quoting. Hurrying on, he left.',
    ],
  ]

  for (const [label, text] of samples) {
    it(`${label} — 모든 토큰이 자기 문장 안에 있다`, () => {
      const r = processText(text)
      const bad: string[] = []
      for (const s of r.sentences) {
        for (const t of s.tokens) {
          // 공백만인 토큰(줄바꿈)은 문장 텍스트에 남지 않는다 — 낱말의 소속을 묻는 검사이므로 뺀다
          if (!t.surface.trim()) continue
          const owner = r.sentences[t.sentenceIndex]
          if (!owner) { bad.push(`${t.surface}: 문장 ${t.sentenceIndex} 없음`); continue }
          if (!norm(owner.text).includes(t.surface)) {
            bad.push(`"${t.surface}" ∉ [${t.sentenceIndex}] ${norm(owner.text).slice(0, 60)}`)
          }
        }
      }
      expect(bad).toEqual([])
    })
  }

  it('문장 배열의 index 가 배열 위치와 같다', () => {
    const r = processText(samples.map(([, t]) => t).join(' '))
    expect(r.sentences.map((s, i) => s.index === i).every(Boolean)).toBe(true)
  })
})
