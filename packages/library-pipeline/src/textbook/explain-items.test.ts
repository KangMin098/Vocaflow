// packages/library-pipeline/src/textbook/explain-items.test.ts
//
// 표본은 **DB 에 실제로 들어 있는 모양**을 그대로 옮겼다(2026-08-30 실측 payload).
// 지어낸 모양으로 통과시키면 적재할 때 전부 null 로 떨어진다.

import { describe, expect, it } from 'vitest'
import {
  EXPLANATION_CHARS,
  explainBlankWord,
  explainElementary,
  explainGrammarFix,
  explainIrrelevant,
  explainItem,
  explainUnderlinedGrammar,
  explainUnitVocab,
  explainVocabChoice,
  explainWordOrder,
  inferRule,
} from './explain-items'

const SENTENCES = [
  'Show one painting to two groups, give each group a different title for it, and they will describe two different scenes.',
  'One group notices the sky; the other notices the small figure in the corner.',
  'This happens because a title tells the eye where to begin.',
  'A viewer facing a new image has no order to follow, so the first words attached to it become an kind of route through the frame.',
  'Once that route is set, the details along it feel important and the rest fades into background.',
]

describe('explainUnitVocab', () => {
  const payload = {
    target: 'image',
    choices: [
      { text: '목초지', label: '①' },
      { text: '죽일 수 없는', label: '②' },
      { text: '이미지', label: '③' },
      { text: '덤프 빈', label: '④' },
    ],
    prompt_ko: '본문의 밑줄 친 "image" 의 뜻으로 알맞은 것은?',
    sentences: SENTENCES,
  }

  it('정답 뜻과 오답 배제를 함께 쓴다', () => {
    const e = explainUnitVocab(payload, { answer: 3 })
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('③ "이미지"')
    expect(e!.ko).toContain('목초지')
    expect(e!.hasWrongOption).toBe(true)
  })

  it('낱말이 쓰인 본문 문장을 인용한다', () => {
    const e = explainUnitVocab(payload, { answer: 3 })
    expect(e!.ko).toContain('A viewer facing a new image')
    expect(e!.hasCitation).toBe(true)
  })

  it('시장 규격 길이 안에 든다', () => {
    const e = explainUnitVocab(payload, { answer: 3 })!
    expect(e.ko.length).toBeGreaterThanOrEqual(EXPLANATION_CHARS.min)
    expect(e.ko.length).toBeLessThanOrEqual(EXPLANATION_CHARS.max)
  })

  it('정답 번호가 범위 밖이면 쓰지 않는다', () => {
    expect(explainUnitVocab(payload, { answer: 9 })).toBeNull()
    expect(explainUnitVocab(payload, {})).toBeNull()
  })
})

describe('explainUnderlinedGrammar', () => {
  const payload = {
    sentences: SENTENCES,
    underlines: [
      { word: 'a', label: '①', tokenIdx: 9, sentenceIdx: 0 },
      { word: 'a', label: '②', tokenIdx: 3, sentenceIdx: 2 },
      { word: 'a', label: '③', tokenIdx: 3, sentenceIdx: 3 },
      { word: 'an', label: '④', tokenIdx: 19, sentenceIdx: 3 },
    ],
  }

  it('틀린 밑줄과 규칙, 나머지가 맞는 이유를 쓴다', () => {
    const e = explainUnderlinedGrammar(payload, { answer: 4, original: 'a' })
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('④')
    expect(e!.ko).toContain('관사')
    expect(e!.ko).toContain('나머지')
    expect(e!.hasWrongOption).toBe(true)
  })

  it('지시어 규칙도 같은 자리에서 쓴다', () => {
    const demo = {
      sentences: [
        'The people who ruled the roads also wanted one fixed way to measure a route.',
        'As a result, the stones did more than count.',
        'They turned a rough path into a road with a shape.',
        'Later, signs of metal and paint took over those work, yet the idea behind them did not change.',
        'Every sign standing beside a road today is a quiet copy of those first counting stones.',
      ],
      underlines: [
        { word: 'a', label: '①', tokenIdx: 13, sentenceIdx: 0 },
        { word: 'a', label: '②', tokenIdx: 1, sentenceIdx: 1 },
        { word: 'a', label: '③', tokenIdx: 2, sentenceIdx: 2 },
        { word: 'those', label: '④', tokenIdx: 8, sentenceIdx: 3 },
        { word: 'a', label: '⑤', tokenIdx: 4, sentenceIdx: 4 },
      ],
    }
    const e = explainUnderlinedGrammar(demo, { rule: 'demonstrative', original: 'that', position: 4 })
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('지시어')
    expect(e!.ko).toContain('that')
  })

  it('수식어를 명사라고 지목하지 않는다 — 사실이 틀린 해설은 없느니만 못하다', () => {
    // 실측에서 나온 결함: `those AI-focused data centers` 를 두고
    // "AI-focused 가 단수이므로" 라고 썼다. AI-focused 는 형용사다.
    const e = explainUnderlinedGrammar(
      {
        sentences: [
          'It might be surprising those AI-focused data centers consume less on aggregate than older ones.',
        ],
        underlines: [{ word: 'those', label: '①', tokenIdx: 4, sentenceIdx: 0 }],
      },
      { rule: 'demonstrative', original: 'that', position: 1 },
    )
    expect(e).not.toBeNull()
    expect(e!.ko).not.toContain('AI-focused"가')
    expect(e!.ko).not.toContain('AI-focused"은')
  })

  it('나머지 밑줄은 라벨과 낱말을 짝지어 보인다', () => {
    const e = explainUnderlinedGrammar(payload, { answer: 4, original: 'a' })!
    // 라벨 3개면 낱말도 3개가 붙어야 한다 — 낱말만 중복 제거하면 수가 어긋난다.
    expect(e.ko).toMatch(/① "a" · ② "a" · ③ "a"/)
  })

  it('원래 형태가 없으면 쓰지 않는다', () => {
    expect(explainUnderlinedGrammar(payload, { answer: 4 })).toBeNull()
  })
})

describe('explainVocabChoice', () => {
  const payload = {
    sentences: [
      'On any average day, 165,000 people die globally.',
      'That’s 60 million a year.',
      'What do they die from?',
      "To answer this, my colleagues built an interactive visualization of causes of death across the world. In this article, I'll give a few snapshots of how this compares across countries at same income levels.",
      'But the real power is in exploring the tool for yourself.',
    ],
    underlines: [
      { word: 'average', label: '①', sentenceIdx: 0 },
      { word: 'That’s', label: '②', sentenceIdx: 1 },
      { word: 'same', label: '③', sentenceIdx: 3 },
      { word: 'power', label: '④', sentenceIdx: 4 },
      { word: 'Cancers', label: '⑤', sentenceIdx: 4 },
    ],
  }

  it('바꿔 넣은 문장을 보여 준다', () => {
    const e = explainVocabChoice(payload, { original: 'different', position: 3 })
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('③')
    expect(e!.ko).toContain('different')
    expect(e!.ko).toContain('different income levels')
    expect(e!.hasWrongOption).toBe(true)
  })
})

describe('explainBlankWord', () => {
  const payload = {
    hint: 'g… (주다)',
    stem: 'Show one painting to two groups, _____ each group a different title for it, and they will describe two different scenes.',
    prompt_ko: '문맥과 뜻에 맞게 빈칸에 알맞은 낱말을 쓰시오.',
    sentence_idx: 0,
  }

  it('힌트가 무엇을 주는지와 완성 문장을 쓴다', () => {
    const e = explainBlankWord(payload, { text: 'give' })
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('give')
    expect(e!.ko).toContain('첫 글자 g')
    expect(e!.ko).toContain('주다')
    expect(e!.hasCitation).toBe(true)
  })

  it('선택지가 없으므로 오답 배제를 지어내지 않는다', () => {
    const e = explainBlankWord(payload, { text: 'give' })!
    expect(e.hasWrongOption).toBe(false)
  })
})

describe('explainGrammarFix', () => {
  it('틀린 관사 자리를 찾아 고친 문장을 보인다', () => {
    const e = explainGrammarFix(
      {
        stem: 'Show one painting to two groups, give each group an different title for it, and they will describe two different scenes.',
        prompt_ko: '어법상 틀린 낱말을 찾아 바르게 고쳐 쓰시오.',
      },
      { rule: 'article', text: 'a' },
    )
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('an')
    expect(e!.ko).toContain('a different title')
    expect(e!.hasCitation).toBe(true)
  })

  it('규칙을 어긴 자리가 없으면 쓰지 않는다 — 지어내지 않는다', () => {
    const e = explainGrammarFix(
      { stem: 'This is a correct sentence with a good article.' },
      { rule: 'article', text: 'a' },
    )
    expect(e).toBeNull()
  })
})

describe('explainWordOrder', () => {
  it('정답 문장과 어순 근거를 쓴다', () => {
    const e = explainWordOrder(
      {
        bank: ['to', 'a', 'tells', 'happens', 'eye', 'the', 'this', 'because', 'title', 'begin', 'where'],
        context: 'One group notices the sky; the other notices the small figure in the corner.',
        sentence_idx: 2,
      },
      { sentence: 'This happens because a title tells the eye where to begin.' },
    )
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('This happens because')
    expect(e!.ko).toContain('11개')
  })
})

describe('explainIrrelevant', () => {
  // 2026-08-30 DB 실측 payload 를 그대로 옮겼다.
  const PAYLOAD = {
    intro:
      "An important source of heterogeneity in the transmission of monetary policy among local governments is eliminated when it is assumed that the central bank's policy rate and the borrowing costs of local governments are one to one.",
    sentences: [
      'This eliminates the possibility that the borrowing costs of local governments will react differently to monetary policy shocks.',
      'In the benchmark model, there is symmetry among local governments.',
      'To examine the impact of heterogeneity in local government borrowing cost responses, we set the borrowing cost response of region 1 to 0.43 (75th percentile) and the borrowing cost response of region 2 to 0.24, as in the benchmark model.',
      'Abstract Humanitarian crises disrupt the continuous care required for non-communicable diseases (NCDs), yet evidence on effective health-system responses remains fragmented.',
      "Fig 6 illustrates the monetary shock's impulse response when there is heterogeneity in local government borrowing cost responses.",
    ],
  }

  it('시장 3규격을 한 번에 만족한다 — 길이·오답 배제·원문 인용', () => {
    const e = explainIrrelevant(PAYLOAD, { position: 4, overlap_gap: 1 })
    expect(e).not.toBeNull()
    expect(e!.ko.length).toBeGreaterThanOrEqual(EXPLANATION_CHARS.min)
    expect(e!.ko.length).toBeLessThanOrEqual(EXPLANATION_CHARS.max)
    expect(e!.hasWrongOption).toBe(true)
    expect(e!.hasCitation).toBe(true)
    expect(e!.writer).toBe('irrelevant')
  })

  it('정답 문장을 번호와 함께 인용한다', () => {
    const e = explainIrrelevant(PAYLOAD, { position: 4 })
    expect(e!.ko).toContain('④')
    expect(e!.ko).toContain('Abstract Humanitarian crises')
  })

  it('정답 문장에만 있는 낱말을 근거로 든다 — 인상이 아니라 확인 가능한 증거', () => {
    const e = explainIrrelevant(PAYLOAD, { position: 4 })
    // humanitarian·crises·diseases 는 도입부·나머지 문장 어디에도 없다.
    expect(e!.ko).toMatch(/humanitarian|crises|diseases|continuous|fragmented/)
  })

  it('화제어가 겹치면 나머지 문장 쪽 근거도 든다', () => {
    const e = explainIrrelevant(PAYLOAD, { position: 4 })
    expect(e!.ko).toContain('나머지 문장은')
    expect(e!.ko).toMatch(/governments|borrowing|monetary|heterogeneity|policy/)
  })

  it('position 이 범위를 벗어나면 쓰지 않는다 — 빈 값을 넣느니 세는 편이 낫다', () => {
    expect(explainIrrelevant(PAYLOAD, { position: 0 })).toBeNull()
    expect(explainIrrelevant(PAYLOAD, { position: 9 })).toBeNull()
    expect(explainIrrelevant(PAYLOAD, {})).toBeNull()
  })

  it('도입부나 문장이 모자라면 쓰지 않는다', () => {
    expect(explainIrrelevant({ sentences: PAYLOAD.sentences }, { position: 4 })).toBeNull()
    expect(explainIrrelevant({ intro: PAYLOAD.intro, sentences: ['a', 'b'] }, { position: 1 })).toBeNull()
  })

  it('갈래가 irrelevant 를 explainItem 으로 이어 준다', () => {
    const e = explainItem('irrelevant', PAYLOAD, { position: 4 })
    expect(e?.writer).toBe('irrelevant')
  })
})

describe('inferRule', () => {
  it('정답 형태에서 규칙을 되짚는다', () => {
    expect(inferRule('a')).toBe('article')
    expect(inferRule('an')).toBe('article')
    expect(inferRule('those')).toBe('demonstrative')
    expect(inferRule('running')).toBeNull()
  })
})

describe('explainItem 갈래', () => {
  it('모르는 유형에는 null 을 준다 — 빈 문자열이 아니다', () => {
    expect(explainItem('order', {}, {})).toBeNull()
    expect(explainItem('nope', {}, {})).toBeNull()
  })

  it('유형에 맞는 작성기를 고른다', () => {
    const e = explainItem('unit_vocab', {
      target: 'image',
      choices: [
        { text: '목초지', label: '①' }, { text: '죽일 수 없는', label: '②' },
        { text: '이미지', label: '③' }, { text: '덤프 빈', label: '④' },
      ],
      sentences: SENTENCES,
    }, { answer: 3 })
    expect(e?.writer).toBe('unit_vocab')
  })
})

describe('explainElementary — 초등 저학년 3종', () => {
  const CH = [
    { label: '①', text: '사과' }, { label: '②', text: '책' },
    { label: '③', text: '물' }, { label: '④', text: '집' },
  ]

  it('낱말 뜻 — 시장 최소 길이(75자)를 넘는다', () => {
    // ⚠️ 처음엔 짧아서 40문항이 통째로 해설 없이 나갔다. 기준을 낮추는 대신
    //    **참인 정보**(오답이 같은 교육과정 목록의 다른 낱말 뜻이라는 사실)를 더해 넘겼다.
    const e = explainElementary('word_meaning', 'apple', CH, 1, '사과')
    expect(e).not.toBeNull()
    expect(e!.ko.length).toBeGreaterThanOrEqual(EXPLANATION_CHARS.min)
    expect(e!.hasWrongOption).toBe(true)
  })

  it('운율 — 끝소리를 근거로 든다', () => {
    const e = explainElementary('rhyme', 'cat', [
      { label: '①', text: 'hat' }, { label: '②', text: 'dog' },
      { label: '③', text: 'sun' }, { label: '④', text: 'pen' },
    ], 1, 'hat')
    expect(e!.ko).toContain('끝소리')
    expect(e!.hasWrongOption).toBe(true)
  })

  it('철자 완성 — 보기가 없으므로 오답 배제를 지어내지 않는다', () => {
    const e = explainElementary('spell_blank', 'c_t', [], 0, 'cat')
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('cat')
    expect(e!.hasWrongOption).toBe(false)
  })

  it('정답 낱말이 없으면 쓰지 않는다', () => {
    expect(explainElementary('rhyme', 'cat', CH, 1, '')).toBeNull()
  })
})
