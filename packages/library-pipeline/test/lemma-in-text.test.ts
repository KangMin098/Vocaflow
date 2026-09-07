// packages/library-pipeline/test/lemma-in-text.test.ts
// 유령 어휘 구조적 차단 회귀 — v06.35.
//
// 배경: winkNLP 의 무가드 lemmatize 폴백은 하나가 아니다.
//   136권(4,539챕터·1,423만 단어) 감사에서 두 경로가 나왔다 —
//     명사: crimen→criman · hymen→hyman  (lemmatizeNoun 의 men$→man$ 무가드 return)
//     동사: outmaneuvered→outmaneuvere   (사전에 없는 어간에서 어미만 떼고 멈춤)
//   규칙을 하나씩 뒤쫓는 대신 **결과를 검사한다**: 이 챕터 본문에 그 형태가 한 번도
//   안 나왔다면 표면형으로 되돌린다. 결함 04(유령 어휘)는 정의상 "본문에 없는 말"이라
//   이 판정이 클래스를 통째로 닫는다.
//
// 되돌린 값(표면형)은 본문에서 온 것이므로 항상 실재한다. DB 15티어가 표면형에서
// 더 나은 표제어를 찾는다는 것은 17단어 실측에서 13:1 로 확인했다.

import { describe, it, expect } from 'vitest'
import { extractBookLemmas } from '../src/analyze/extract-lemmas'
import type { ChapterSegment } from '../src/types'

function chapter(content: string): ChapterSegment {
  return {
    chapter_idx: 1,
    title: 'Test',
    content,
    word_count: content.split(/\s+/).length,
    char_start: 0,
    char_end: content.length,
  } as ChapterSegment
}

/** 추출된 표제어 집합 (검사 편의) */
function lemmasOf(text: string): Set<string> {
  return new Set(extractBookLemmas([chapter(text)]).occurrences.keys())
}

describe('본문에 없는 표제어 차단', () => {
  it('동사 무가드 폴백이 만든 유령을 표면형으로 되돌린다 (outmaneuvere)', () => {
    const out = lemmasOf(
      'Only then had he perceived what was so obvious to an experienced sea-fighter: ' +
        'he had delayed too long and Captain Blood had outmaneuvered him completely.',
    )
    expect(out.has('outmaneuvere')).toBe(false)
    expect(out.has('outmaneuvered')).toBe(true)
  })

  it('명사 -men 무가드 폴백이 만든 유령도 남지 않는다 (criman·swimman)', () => {
    const out = lemmasOf(
      'The Latins by crimen meant only such sins as may be made appear before a judge. ' +
        'Or theirs that swimmen in possession of the river.',
    )
    expect(out.has('criman')).toBe(false)
    expect(out.has('swimman')).toBe(false)
    expect(out.has('crimen')).toBe(true)
    expect(out.has('swimmen')).toBe(true)
  })

  it('표제어가 본문에 실재하면 그대로 쓴다 (굴절 해소를 막지 않는다)', () => {
    // 'ran' 과 'run' 이 둘 다 본문에 있으므로 표제어 run 이 유지된다
    const out = lemmasOf('He ran across the field. Children run every morning before breakfast.')
    expect(out.has('run')).toBe(true)
  })

  it('표제어가 본문에 없으면 표면형을 남긴다 — 손실이 아니라 DB 해소로 넘김', () => {
    // 본문에 단수 'policeman' 이 없다 → 표면형 policemen 유지
    // (DB inflection 티어가 policeman 으로 해소하는 것을 실측 확인)
    const out = lemmasOf('The policemen gathered quietly near the harbour gate that evening.')
    expect(out.has('policemen')).toBe(true)
    expect(out.has('policeman')).toBe(false)
  })

  it('추출된 모든 표제어는 본문에 실재한다 (불변식)', () => {
    const text =
      'The fishermen and the watchmen had outmaneuvered the gentlemen who becomen weary. ' +
      'Scrooge signed it, and the clergymen departed. Seamen swimmen through frozen waters.'
    const tokens = new Set(text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [])
    for (const lemma of lemmasOf(text)) {
      expect(tokens.has(lemma), `표제어 "${lemma}" 가 본문에 없다`).toBe(true)
    }
  })
})
