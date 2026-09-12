// packages/library-pipeline/test/syllable-hyphen.test.ts
// 음절 하이픈 표기 파편 차단 회귀 — v06.35.
//
// 배경: Ozma of Oz 의 Tiktok 로봇은 음절을 끊어 말한다 — "lit-tle", "rev-o-lu-tion",
//   "per-fect", "in-vent-or". winkNLP 는 이런 표기를 쪼개서
//       lit-tle → lit[word] -[punct] tle[word]
//   `tle` · `jur` · `peo` · `ture` · `cean` 같은 조각이 학습 어휘로 들어갔다.
//   316권 감사에서 104권 236건 — 음절 표기가 많은 아동서에 집중됐고, 그런 책이
//   초급 학습자용이라 영향이 상대적으로 크다.
//
// 판정 근거: winkNLP 는 **정상 복합어를 하나로 유지**한다(`co-operation`[word]).
//   그러니 "하이픈이 공백 없이 붙은 토큰" 이 곧 음절 파편이고, 복합어는 다치지 않는다.
//
// 이 결함은 keepLemmaOnlyIfInText 가 못 잡는다 — 그 검사는 **표제어**가 본문에 있는지를
//   보는데, 파편은 표면형 자체가 조각이라 lemma == surface 로 통과한다.

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

function lemmasOf(text: string): Set<string> {
  return new Set(extractBookLemmas([chapter(text)]).occurrences.keys())
}

describe('음절 하이픈 표기 파편 차단', () => {
  it('음절 조각을 학습 어휘로 넣지 않는다 (lit-tle → tle)', () => {
    const out = lemmasOf('"Good morn-ing, lit-tle girl," said the machine politely.')
    expect(out.has('tle')).toBe(false)
    expect(out.has('lit')).toBe(false)
    expect(out.has('ing')).toBe(false)
    expect(out.has('morn')).toBe(false)
  })

  it('여러 음절로 끊긴 긴 단어도 조각이 남지 않는다 (rev-o-lu-tion)', () => {
    const out = lemmasOf('There was a rev-o-lu-tion in the Land of Ev last year.')
    for (const frag of ['rev', 'lu', 'tion']) expect(out.has(frag)).toBe(false)
  })

  it('정상 복합어는 그대로 학습 어휘가 된다 (co-operation)', () => {
    // winkNLP 가 하이픈 복합어를 하나의 토큰으로 유지하므로 파편 판정에 걸리지 않는다
    const out = lemmasOf('The co-operation between them lasted many years.')
    expect(out.has('co-operation')).toBe(true)
  })

  it('하이픈이 없는 일반 문장은 영향을 받지 않는다', () => {
    const out = lemmasOf('The machine walked toward the princess and spoke politely.')
    expect(out.has('machine')).toBe(true)
    expect(out.has('politely')).toBe(true)
  })

  it('문장부호로 쓰인 대시는 앞뒤 단어를 죽이지 않는다', () => {
    // normalizePunctuation 이 em-dash 를 '--' 로 바꾸므로 공백 없이 붙는 경우가 생긴다.
    // 그 경우까지 파편으로 보면 실단어를 잃는다 — 단일 하이픈만 파편 신호로 쓴다.
    const out = lemmasOf('She paused--then answered the curious traveller quietly.')
    expect(out.has('paused')).toBe(true)
    expect(out.has('traveller')).toBe(true)
  })
})
