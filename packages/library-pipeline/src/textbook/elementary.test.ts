// packages/library-pipeline/src/textbook/elementary.test.ts
//
// 초등 3종 회귀. 지키려는 것은 **답이 하나인가** 다.
// 운율은 소리가 같은 보기가 하나뿐이어야 하고, 뜻은 겹치면 안 되고,
// 철자 완성은 그 꼴에 맞는 낱말이 사전에 하나뿐이어야 한다.

import { describe, expect, it } from 'vitest'
import {
  buildRhyme,
  buildSpellBlank,
  buildWordMeaning,
  countMatching,
  ELEMENTARY_CHOICES,
  firstSense,
  pickDeterministic,
  type ElementaryWord,
} from './elementary'

const w = (
  word: string,
  meaningKo: string,
  rhymeKey: string | null,
  synonyms: string[] = [],
): ElementaryWord => ({ word, meaningKo, rhymeKey, synonyms })

// `-eɪk` 무리는 실제 교육과정 초등 어휘에서 온 모양이다 — 철자가 달라도 소리가 같다.
const pool: ElementaryWord[] = [
  w('make', '만들다', '-eɪk'),
  w('cake', '케이크', '-eɪk'),
  w('lake', '호수', '-eɪk'),
  w('steak', '스테이크', '-eɪk'),
  w('milk', '우유', '-ɪlk'),
  w('desk', '책상', '-ɛsk'),
  w('song', '노래', '-ɔŋ'),
  w('rice', '쌀', '-aɪs'),
  w('door', '문', '-ɔɹ'),
  w('makes', '만들다', '-eɪks'),
]

describe('파닉스 — 운율 맞추기', () => {
  it('소리가 같은 보기가 정확히 하나다', () => {
    const item = buildRhyme(pool[0]!, pool)
    expect(item).not.toBeNull()
    expect(item!.choices).toHaveLength(ELEMENTARY_CHOICES)
    const key = new Map(pool.map((x) => [x.word, x.rhymeKey]))
    const matching = item!.choices.filter((c) => key.get(c.text) === '-eɪk')
    expect(matching).toHaveLength(1)
    expect(item!.choices[item!.answer - 1]!.text).toBe(item!.answerText)
  })

  it('굴절형은 정답으로도 오답으로도 쓰지 않는다 — 소리가 아니라 철자로 풀린다', () => {
    const item = buildRhyme(pool[0]!, pool)!
    expect(item.choices.map((c) => c.text)).not.toContain('makes')
  })

  it('끝 철자가 같은 낱말은 오답으로 쓰지 않는다 — 소리가 달라도 라임처럼 보인다', () => {
    const tricky = [...pool, w('bike', '자전거', '-aɪk')]
    const item = buildRhyme(tricky[0]!, tricky)!
    // `make` 와 `bike` 는 끝 두 글자가 `ke` 로 같지만 소리는 다르다.
    expect(item.choices.map((c) => c.text)).not.toContain('bike')
  })

  it('각운 정보가 없으면 만들지 않는다', () => {
    expect(buildRhyme(w('make', '만들다', null), pool)).toBeNull()
  })

  it('운율 짝이 없으면 만들지 않는다', () => {
    expect(buildRhyme(w('zebra', '얼룩말', '-ibɹə'), pool)).toBeNull()
  })

  it('멱등하다', () => {
    expect(buildRhyme(pool[0]!, pool)).toEqual(buildRhyme(pool[0]!, pool))
  })
})

describe('낱말 뜻 고르기', () => {
  it('보기 넷 중 하나가 정답이고 뜻이 겹치지 않는다', () => {
    const item = buildWordMeaning(pool[4]!, pool)
    expect(item).not.toBeNull()
    expect(item!.choices).toHaveLength(ELEMENTARY_CHOICES)
    expect(item!.choices[item!.answer - 1]!.text).toBe('우유')
    const texts = item!.choices.map((c) => c.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('유의어는 오답으로 쓰지 않는다 — 답이 둘이 된다', () => {
    const withSyn = [
      w('big', '큰', '-ɪɡ', ['large']),
      w('large', '큰', '-ɑɹdʒ'),
      w('small', '작은', '-ɔl'),
      w('fast', '빠른', '-æst'),
      w('slow', '느린', '-oʊ'),
    ]
    const item = buildWordMeaning(withSyn[0]!, withSyn)
    expect(item).not.toBeNull()
    // `큰` 은 정답이라 한 번은 나온다. 유의어 `large` 가 오답으로 들어오면 **두 번** 나온다.
    const texts = item!.choices.map((c) => c.text)
    expect(texts.filter((t) => t === '큰')).toHaveLength(1)
    expect(item!.choices[item!.answer - 1]!.text).toBe('큰')
  })

  it('한쪽이 다른 쪽을 품는 뜻은 오답으로 쓰지 않는다', () => {
    const overlap = [
      w('apple', '사과', '-æpəl'),
      w('appletree', '사과나무', '-æpəltɹi'),
      w('chair', '의자', '-ɛɹ'),
      w('run', '달리다', '-ʌn'),
      w('sea', '바다', '-i'),
    ]
    const item = buildWordMeaning(overlap[0]!, overlap)
    if (item) expect(item.choices.map((c) => c.text)).not.toContain('사과나무')
  })

  it('뜻의 첫 갈래만 쓴다', () => {
    expect(firstSense('사과; 사과나무')).toBe('사과')
    expect(firstSense('만들다, 만들어 내다')).toBe('만들다')
    expect(firstSense('  달리다  ')).toBe('달리다')
  })

  it('멱등하다', () => {
    expect(buildWordMeaning(pool[4]!, pool)).toEqual(buildWordMeaning(pool[4]!, pool))
  })
})

describe('철자 완성', () => {
  // `c_t` 는 cat·cot·cut 이 다 되므로 문항이 안 된다 — 사전이 그걸 말해 준다.
  const dict = new Set(['cat', 'cot', 'cut', 'milk', 'silk', 'desk', 'zebra', 'zebro'])

  it('그 꼴에 맞는 낱말이 하나뿐일 때만 만든다', () => {
    expect(countMatching('c_t', dict)).toBe(3)
    expect(countMatching('de_k', dict)).toBe(1)
  })

  it('정답이 갈리는 낱말은 만들지 않는다', () => {
    expect(buildSpellBlank(w('cat', '고양이', null), dict)).toBeNull()
  })

  it('정답이 하나면 만든다 — 뜻을 단서로 준다', () => {
    const item = buildSpellBlank(w('desk', '책상', null), dict)
    expect(item).not.toBeNull()
    expect(item!.answerText).toBe('desk')
    expect(item!.promptKo).toContain('책상')
    expect(item!.stem).toMatch(/_/)
    expect(item!.choices).toHaveLength(0) // 단답이다
  })

  it('첫 글자와 마지막 글자는 남긴다 — 붙잡을 자리가 있어야 한다', () => {
    const item = buildSpellBlank(w('desk', '책상', null), dict)!
    const chars = item.stem.split(' ')
    expect(chars[0]).toBe('d')
    expect(chars[chars.length - 1]).toBe('k')
  })

  it('빈칸을 채우면 원문이 된다', () => {
    const item = buildSpellBlank(w('desk', '책상', null), dict)!
    const pattern = item.stem.split(' ').join('')
    const at = pattern.indexOf('_')
    expect(pattern.slice(0, at) + item.answerText[at] + pattern.slice(at + 1)).toBe('desk')
  })

  it('너무 짧거나 긴 낱말은 만들지 않는다', () => {
    expect(buildSpellBlank(w('is', '이다', null), dict)).toBeNull()
    expect(buildSpellBlank(w('extraordinary', '비범한', null), dict)).toBeNull()
  })

  it('멱등하다', () => {
    expect(buildSpellBlank(w('desk', '책상', null), dict)).toEqual(
      buildSpellBlank(w('desk', '책상', null), dict),
    )
  })
})

describe('결정론 고르기', () => {
  it('같은 seed 면 같고 다른 seed 면 다르다', () => {
    const items = pool.slice(0, 6)
    expect(pickDeterministic(items, 3, 'x')).toEqual(pickDeterministic(items, 3, 'x'))
    expect(pickDeterministic(items, 3, 'x')).not.toEqual(pickDeterministic(items, 3, 'y'))
  })
})
