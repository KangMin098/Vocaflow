// packages/library-pipeline/src/textbook/explain-items.test.ts
//
// 표본은 **DB 에 실제로 들어 있는 모양**을 그대로 옮겼다(2026-08-30 실측 payload).
// 지어낸 모양으로 통과시키면 적재할 때 전부 null 로 떨어진다.

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import {
  EXPLANATION_CHARS,
  trimExplanation,
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

  // ── 왜 이 회귀가 생겼나 (실측 2026-09-13) ─────────────────────────
  // `headNounAfter` 가 `sentence.split(/s+/)` 였다 — 백슬래시 하나가 빠져 **리터럴 s 로**
  // 쪼갰다. 그 결과 머리 명사가 `"aretypicallyorganizedloo"` 로 나오고, 뭉개진 토큰이
  // 단수로 판정돼 해설이 「단수이므로 These 가 맞다」는 자기모순을 적었다.
  //
  // ⚠️ **위 두 검사가 그것을 통과시켰다.** 「지시어」와 「that」이 들어 있는지만 봤고,
  //   「수식어를 명사라고 지목하지 않는다」는 *없어야 할 낱말*만 봐서 **토큰이 통째로
  //   뭉개졌을 때 오히려 조용히 통과**한다(없는 낱말은 당연히 안 들어 있다).
  //   그래서 여기서는 **지목한 낱말이 그 문장에 실제로 있는 낱말인지**를 본다.
  it('머리 명사로 지목한 낱말이 그 문장에 실제로 있는 낱말이다', () => {
    const sentence =
      'This collectives are typically organized loosely within state and national networks that provide training.'
    const e = explainUnderlinedGrammar(
      {
        sentences: [sentence],
        underlines: [
          { word: 'This', label: '①', tokenIdx: 0, sentenceIdx: 0 },
          { word: 'that', label: '②', tokenIdx: 11, sentenceIdx: 0 },
        ],
      },
      { rule: 'demonstrative', original: 'These', position: 1 },
    )
    expect(e).not.toBeNull()
    const named = /"([^"]+)"\s*가 (?:복수|단수)이므로/.exec(e!.ko)
    expect(named, `머리 명사를 지목하지 않았다: ${e!.ko}`).not.toBeNull()
    const tokens = sentence.split(/\s+/).map((t) => t.replace(/[^A-Za-z'-]/g, '').toLowerCase())
    expect(tokens, `지문에 없는 낱말을 지목했다: ${named![1]}`).toContain(named![1]!.toLowerCase())
    // 복수 명사를 단수라고 부르지 않는다 — 뭉개진 토큰은 대개 단수로 판정된다.
    expect(e!.ko).toContain('복수이므로')
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
    // ⚠️ 낱말 뒤의 자리 표시`(N문장)`는 붙어도 되고 없어도 된다(문장을 못 찾으면 생략한다).
    //   여기서 잠그는 것은 **짝의 수와 차례**이지 꾸밈이 아니다.
    expect(e.ko).toMatch(/① "a"[^·]*· ② "a"[^·]*· ③ "a"/)
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

// ── 왜 이 회귀가 생겼나 (실측 2026-09-13) ───────────────────────────
// 3인 검수가 막은 지면 문항 163개의 사유 947건을 계열로 접으니 **해설이 1위(17.0% · 117문항)**
// 였고, 그 안에서 되풀이되는 지적이 하나였다:
//
//   "해설이 「나머지 ① meant · ③ agriculture … 는 앞뒤 내용과 어긋나지 않는다」 한 줄로
//    뭉개, 왜 나머지가 아닌지를 하나도 짚지 않는다."
//   "① 이 낱말조차 아니라는 사실을 짚지 못한다."
//
// 그 문장은 생성기가 **확인할 수 없는 의미 판정**이었다. DB 실측으로 어휘 20,903 ·
// 어법 17,619 = **38,522문항**이 그 단정을 싣고 있었다. 기존 29종은 이것을 못 잡았다 —
// 「나머지」가 들어 있는지만 봤지 **무엇을 주장하는지**는 안 봤기 때문이다.
//
// ⚠️ 이 파일의 다른 해설(explainBlankWord)은 이미 「없는 것을 지어내지 않는다」를 지키고
//   있었다. 같은 파일에서 한 곳만 원칙이 깨져 있었고, 그것을 회귀가 아니라 사람이 찾았다.
describe('해설은 확인하지 않은 것을 단정하지 않는다', () => {
  /** 되살아나면 안 되는 문장들 — 전부 생성기가 확인할 수 없는 의미 판정이다. */
  const FORBIDDEN = [
    '앞뒤 내용과 어긋나지 않는다',
    '뒤 낱말과 어긋나지 않아 그대로 맞다',
    // ⚠️ 제작 정보 — 학습자에게는 「원문」이 없다. 인쇄하면 이 유형을 「바뀐 낱말 하나 찾기」로
    //   푸는 법을 가르친다(3인 검수가 여러 청크에서 각자 독립으로 짚었다).
    '지문 그대로다',
    '바꾼 자리는',
  ]

  const vocabPayload = {
    sentences: [
      'Cities that raise parking fees see traffic fall.',
      'The same study found that lower fees raise traffic again.',
      'A third city cut fees and watched congestion raise sharply.',
    ],
    underlines: [
      { word: 'raise', label: '①', sentenceIdx: 0 },
      { word: 'lower', label: '②', sentenceIdx: 1 },
      { word: 'raise', label: '③', sentenceIdx: 2 },
    ],
  }

  it('어휘 해설이 나머지를 「맞다」고 판정하지 않는다', () => {
    const e = explainVocabChoice(vocabPayload, { original: 'fall', position: 3 })
    expect(e).not.toBeNull()
    for (const f of FORBIDDEN) expect(e!.ko).not.toContain(f)
    // 제작 정보 대신 **확인되는 자리**를 적는다 — 학습자가 그 문장으로 가서 견줄 수 있다.
    expect(e!.ko).toContain('문장) 의 자리는')
  })

  it('어법 해설도 나머지를 「맞다」고 판정하지 않는다', () => {
    const e = explainUnderlinedGrammar(
      {
        sentences: ['A viewer facing an new image has no order to follow.'],
        underlines: [{ word: 'an', label: '①', tokenIdx: 3, sentenceIdx: 0 }, { word: 'a', label: '②', tokenIdx: 0, sentenceIdx: 0 }],
      },
      { answer: 1, original: 'a' },
    )
    expect(e).not.toBeNull()
    for (const f of FORBIDDEN) expect(e!.ko).not.toContain(f)
    // 제작 정보 대신 **확인되는 자리**를 적는다 — 학습자가 그 문장으로 가서 견줄 수 있다.
    expect(e!.ko).toContain('문장) 의 자리는')
  })

  // 이 유형의 근거는 「원래 낱말이 다른 자리에 그대로 남아 있다」는 것이다
  // (vocab-choice.ts — 바꿀 낱말은 글 안에 두 번 이상 나와야 한다).
  it('원래 낱말이 다른 문장에 남아 있으면 그 자리를 찾아 보여 준다', () => {
    const e = explainVocabChoice(vocabPayload, { original: 'raise', position: 2 })
    expect(e).not.toBeNull()
    expect(e!.ko).toContain('그대로 남아 있다')
  })

  // ⚠️ 못 찾은 것을 「있다」로 적는 것이 바로 이 파일이 고친 결함이다.
  it('다른 자리에 없으면 그 문장을 아예 언급하지 않는다', () => {
    const e = explainVocabChoice(vocabPayload, { original: 'plummet', position: 2 })
    expect(e).not.toBeNull()
    expect(e!.ko).not.toContain('그대로 남아 있다')
  })

  // 굴절형을 원형이라고 말하지 않는다 — 이 유형은 굴절형을 일부러 안 건드린다.
  it('부분 일치로 굴절형을 잡지 않는다', () => {
    const e = explainVocabChoice(
      {
        sentences: ['Fees raised traffic.', 'Nothing else here.'],
        underlines: [{ word: 'cut', label: '①', sentenceIdx: 0 }, { word: 'x', label: '②', sentenceIdx: 1 }],
      },
      { original: 'raise', position: 1 },
    )
    expect(e!.ko).not.toContain('그대로 남아 있다')
  })

  // 소스 자기무력화 가드 — 문장을 지우고 검사만 남기면 이 회귀가 아무것도 안 지킨다.
  it('금지 문장이 소스에서 실제로 사라졌다', () => {
    const src = readFileSync(new URL('./explain-items.ts', import.meta.url), 'utf8')
    // 주석에는 남아 있어도 된다(왜 고쳤는지의 근거다). 템플릿 리터럴 안에 있으면 안 된다.
    const code = src
      .split(/\r?\n/)
      .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
      .join('\n')
    for (const f of FORBIDDEN) expect(code, f).not.toContain(f)
  })
})

// ── 왜 이 회귀가 생겼나 (실측 2026-09-13) ───────────────────────────
// 해설 10만 건을 다시 쓰고 **표본을 눈으로 읽다가** 나왔다:
//
//   ④ 가 틀렸다. "Importantly, remyelinated lesions lacked GPR17 immunoreactivity,…"
//   관사 규칙이다 — "model"은 자음 소리로 시작하므로 "a" 가 맞고 "an" 는 틀리다.
//
// **인용문에 model 이 없다.** quoteAround 가 초점을 indexOf(부분 문자열)로 찾아서,
// 관사 "an" 이 Import**an**tly 의 5번째 자리에 걸렸다. 창이 문장 첫머리에 잡히고
// 정작 틀린 자리는 창 밖으로 밀려난다. 어법 두 유형(52,544건)의 밑줄은 전부
// a·an·this·that 같은 짧은 낱말이라 **구조적으로 이 함정 위에 있었다.**
//
// ⚠️ 스크립트의 자체 점검은 「인용 100%」라고 찍었다 — 인용이 **있는지**만 보고
//   그 인용이 **틀린 자리를 담고 있는지**는 안 봤기 때문이다.
describe('인용은 틀린 자리를 담는다', () => {
  const sentence =
    'Importantly, remyelinated lesions lacked GPR17 immunoreactivity, and the researchers therefore built an model of oligodendrocyte maturation across regions.'

  it('짧은 기능어가 남의 낱말 속에 걸리지 않는다', () => {
    const e = explainUnderlinedGrammar(
      {
        sentences: [sentence],
        underlines: [
          { word: 'an', label: '①', tokenIdx: 11, sentenceIdx: 0 },
          { word: 'the', label: '②', tokenIdx: 7, sentenceIdx: 0 },
        ],
      },
      { rule: 'article', original: 'a', position: 1 },
    )
    expect(e).not.toBeNull()
    // 규칙이 지목한 뒤 낱말이 인용문 안에 있어야 학습자가 확인할 수 있다.
    const named = /"([^"]+)"[^"]*?(?:모음|자음) 소리로/.exec(e!.ko)
    expect(named, e!.ko).not.toBeNull()
    const m = /"([^"]*…[^"]*)"/.exec(e!.ko)
    // ⚠️ 못 찾으면 ko 전체로 물러서지 않는다 — 규칙 문장에도 그 낱말이 있어 **허수 통과**한다.
    expect(m, `인용을 못 찾았다: ${e!.ko}`).not.toBeNull()
    const quoted = m![1]!
    expect(quoted, `인용에 "${named![1]}" 가 없다: ${quoted}`).toContain(named![1]!)
  })

  it('틀린 낱말 자체도 인용 안에 있다', () => {
    const e = explainUnderlinedGrammar(
      {
        sentences: [sentence],
        underlines: [{ word: 'an', label: '①', tokenIdx: 11, sentenceIdx: 0 }, { word: 'the', label: '②', tokenIdx: 7, sentenceIdx: 0 }],
      },
      { rule: 'article', original: 'a', position: 1 },
    )
    const quoted = /"([^"]*…[^"]*)"/.exec(e!.ko)?.[1] ?? ""
    expect(quoted, `인용이 잘리지 않았다: ${e!.ko}`).not.toBe("")
    expect(quoted).toMatch(/\ban\b/)
  })
})

/**
 * **글자 수로만 자르면 낱말과 인용이 가운데서 끊긴다** (3인 검수 실측 2026-09-14).
 *
 * 지면에 실리던 것:
 *     … 문장에 그대로 남아 있다 — "…after initially denying any Libyan respo…
 *
 * `responsibility` 가 낱말 가운데서 잘렸고 여는 따옴표가 닫히지 않았다. DB 실측 —
 * 해설 506,279건 중 **17,467건**이 인용을 연 채로 끝났고 따옴표 홀수가 **18,211건**이었다.
 * 서로 다른 청크의 검수자 둘이 독립으로 같은 자국을 짚었다(`respo…` · `hav…`).
 */
describe('trimExplanation — 낱말도 인용도 가운데서 끊지 않는다', () => {
  const LONG =
    '정답은 5번이다. 원래 낱말 "responsibility" 는 네 번째 문장에 그대로 남아 있다 — "Libya agreed to pay compensation to the families of the victims after initially denying any Libyan responsibility for the bombing".'

  it('상한 안이면 손대지 않는다 — 멀쩡한 해설에 줄임표를 붙이지 않는다', () => {
    expect(trimExplanation(LONG, 500)).toBe(LONG)
    expect(trimExplanation(LONG, 500)).not.toContain('…')
  })

  it('상한을 넘지 않는다 — 닫는 따옴표까지 세고 자른다', () => {
    for (const max of [120, 150, 180, 200, 240]) {
      expect(trimExplanation(LONG, max).length, `max=${max}`).toBeLessThanOrEqual(max)
    }
  })

  it('낱말 가운데서 끊지 않는다 — 마지막 토큰이 원문에 통째로 있다', () => {
    for (const max of [120, 150, 180, 200, 240]) {
      const out = trimExplanation(LONG, max)
      const last = out.replace(/[…"]+$/, '').trimEnd().split(' ').pop() ?? ''
      expect(LONG, `max=${max} · 잘린 조각 "${last}"`).toContain(last)
    }
  })

  it('인용을 연 채로 끝내지 않는다 — 따옴표 수가 늘 짝수다', () => {
    for (const max of [120, 150, 180, 200, 240]) {
      const out = trimExplanation(LONG, max)
      expect((out.match(/"/g) ?? []).length % 2, `max=${max} · ${out}`).toBe(0)
    }
  })

  // ⚠️ 인용을 **버리지** 않는다 — 시중 원문 인용률 49.7% 가 기준선이고, 학습자가 자기
  //   오답을 지문에서 확인하는 장치다. 닫아서 지킨다.
  it('인용을 통째로 버리지 않는다 — 닫아서 남긴다', () => {
    const out = trimExplanation(LONG, 200)
    expect(out).toContain('"')
    expect(out).toContain('Libya')
  })

  // ⚠️ 문장 끝에서 자를 수 있으면 **완결된 문장**으로 끝난다 — 줄임표를 안 붙인다.
  it('따옴표가 없으면 따옴표를 만들지 않는다', () => {
    const noQuote = '정답은 5번이다. '.repeat(40)
    const out = trimExplanation(noQuote, 120)
    // ⚠️ 문장 끝에서 자를 수 있으면 **완결된 문장**으로 끝난다 — 줄임표를 안 붙인다.
    //   줄임표는 문장 가운데서 자를 수밖에 없을 때의 표시다.
    expect(out).not.toContain('"')
    expect(out.length).toBeLessThanOrEqual(120)
    expect(out.endsWith('다.')).toBe(true)
  })
})

/**
 * **「따옴표 짝이 맞다」와 「말이 끝났다」는 다르다** (실측 2026-09-14).
 *
 * 낱말 경계 자르기만 넣고 55,238건을 다시 썼더니 **6,177건**이 이렇게 끝났다:
 *
 *     … 원래 낱말 "global" 는 2번째 문장에 그대로 남아 있다 —…
 *
 * 이음표에서 끊겨 **인용을 약속해 놓고 아무것도 안 준다.** 따옴표는 짝이 맞아 앞 검사를
 * 통과했다. 해설의 각 부분이 완결된 문장이므로 마지막 완결 문장까지만 실으면 깨끗하다.
 */
describe('trimExplanation — 약속만 남기고 끊지 않는다', () => {
  const PROMISE =
    '정답은 ⑤ 다. 문제 문장은 "The tide rose twice that night and the boats pulled hard at their lines." 인데, 이 자리에는 "fell" 가 와야 뜻이 이어진다. 나머지 ① "Economic"(1문장) · ③ "study"(5문장) 의 자리는 각각 그 문장에서 확인할 수 있다. 원래 낱말 "global" 는 2번째 문장에 그대로 남아 있다 — "…a global market for seed that had not existed before…".'

  it('이음표만 남기고 끊지 않는다', () => {
    for (const max of [160, 200, 240, 260]) {
      const out = trimExplanation(PROMISE, max)
      expect(out.replace(/…"?$/, '').trimEnd(), `max=${max} · ${out}`).not.toMatch(/[—–:,·-]$/)
    }
  })

  it('문장 끝에서 자를 수 있으면 그렇게 한다 — 완결된 문장으로 끝난다', () => {
    // 원문이 282자라 상한을 그보다 낮춰야 실제로 잘린다.
    const out = trimExplanation(PROMISE, 240)
    expect(out.endsWith('다.'), out).toBe(true)
  })

  it('상한은 여전히 지킨다', () => {
    for (const max of [160, 200, 240, 260]) {
      expect(trimExplanation(PROMISE, max).length, `max=${max}`).toBeLessThanOrEqual(max)
    }
  })

  it('따옴표 짝은 여전히 맞는다', () => {
    for (const max of [160, 200, 240, 260]) {
      const out = trimExplanation(PROMISE, max)
      expect((out.match(/"/g) ?? []).length % 2, `max=${max} · ${out}`).toBe(0)
    }
  })

  // ⚠️ 문장 끝이 너무 앞이면 그쪽으로 되돌리지 않는다 — 해설이 최소 길이 아래로 떨어진다.
  it('첫 문장이 상한의 60% 아래면 낱말 경계로 물러선다', () => {
    const oneLong = `정답은 ⑤ 다. ${'the tide rose twice that night '.repeat(30)}`
    const out = trimExplanation(oneLong, 400)
    expect(out.length).toBeGreaterThan(240)
    expect(out.endsWith('…')).toBe(true)
  })
})

/**
 * **조사를 템플릿에 박지 않는다** (3인 검수 실측 2026-09-14).
 *
 * `josa()` 헬퍼가 있는데도 여러 자리가 `가`·`는`·`를` 를 그대로 박고 있었다. 지면에
 * `"spring" 는` · `"rising" 가` · `"their necks" 를` 가 인쇄됐고, 한 검수자가
 * **10건 중 6건이 틀렸다**고 셌다. 영어 낱말은 한국어 끝소리로 받침을 판정한다.
 */
describe('해설의 조사 — 앞말 받침을 본다', () => {
  const payload = {
    sentences: [
      'The spring rains came early that year and the river rose.',
      'By April the spring was over and the fields were dry.',
      'Farmers watched the autumn sky for the first clouds.',
    ],
    underlines: [
      { word: 'autumn', label: '①', sentenceIdx: 0 },
      { word: 'spring', label: '②', sentenceIdx: 1 },
      { word: 'autumn', label: '③', sentenceIdx: 2 },
    ],
  }

  it('받침 있는 낱말 뒤에 `는`·`가` 를 붙이지 않는다', () => {
    const e = explainVocabChoice(payload, { original: 'spring', position: 1 })
    expect(e).not.toBeNull()
    // spring 스프링 → 받침 있음 → `은`/`이`
    expect(e!.ko, e!.ko).not.toContain('"spring" 는')
    expect(e!.ko, e!.ko).not.toContain('"spring" 가')
  })

  it('받침을 실제로 가려 쓴다 — 같은 문장에서 둘이 갈린다', () => {
    // study 스터디(받침 없음) vs system 시스템(받침 있음)
    const e = explainUnderlinedGrammar(
      {
        sentences: ['A viewer facing an new image has no order to follow.'],
        underlines: [
          { word: 'an', label: '①', tokenIdx: 3, sentenceIdx: 0 },
          { word: 'a', label: '②', tokenIdx: 0, sentenceIdx: 0 },
        ],
      },
      { answer: 1, original: 'a' },
    )
    expect(e).not.toBeNull()
    // `a` 는 받침이 없으니 `가`, `an` 은 받침(ㄴ)이 있으니 `은`.
    expect(e!.ko).toContain('"a"가')
    expect(e!.ko).toContain('"an"은')
  })
})
