// packages/library-pipeline/src/textbook/middle-short.test.ts
//
// **단답은 채점이 문자열 비교라, 정답이 하나가 아니면 조용히 학습자를 틀리게 만든다.**
//
// 객관식은 보기가 다섯 개라 "답이 둘" 이면 검수자 눈에 띈다. 단답은 안 그렇다 —
// 문항은 멀쩡해 보이고, 학습자가 맞는 답을 써도 채점기가 틀렸다고 한다.
// 그래서 이 파일이 재는 것은 문항 모양이 아니라 **정답의 유일성**이다.

import { describe, expect, it } from 'vitest'

import { buildBlankWord, buildGrammarFix, BLANK_WORD_LEN } from './middle-short'

/** 사전 대역 — 모듈을 순수하게 두려고 주입받는 자리다. */
const DICT: Record<string, string> = {
  telescope: '망원경',
  planet: '행성',
  discovered: '발견하다',
  scientists: '과학자',
  distant: '먼',
  surface: '표면',
  water: '물',
  found: '찾다',
  large: '큰',
}
const meaningOf = (w: string) => DICT[w] ?? null

describe('빈칸에 낱말 쓰기 — 정답이 하나로 좁혀질 때만 낸다', () => {
  const sentence = 'Scientists discovered a distant planet with a rocky surface.'

  it('빈칸과 단서를 함께 낸다 — 단서 없이 내면 답이 여럿이 된다', () => {
    const item = buildBlankWord(sentence, null, meaningOf)
    expect(item).not.toBeNull()
    expect(item!.stem).toContain('_____')
    // 첫 글자 + 우리말 뜻이 붙어야 답이 하나로 좁혀진다.
    expect(item!.hint).toMatch(/^[a-z]….+/)
    expect(item!.hint).toContain(DICT[item!.answerText]!)
  })

  it('정답이 원문 낱말이고 빈칸이 하나다', () => {
    const item = buildBlankWord(sentence, null, meaningOf)!
    expect(sentence.toLowerCase()).toContain(item.answerText)
    expect(item.stem.match(/_____/g)).toHaveLength(1)
  })

  it('같은 낱말이 두 번 나오면 만들지 않는다 — 다른 자리도 답이 되어 채점이 갈린다', () => {
    // "water" 가 둘. 어느 쪽을 지워도 학습자는 맞게 쓰는데 위치가 다를 수 있다.
    const dup = 'The water below the surface met the water above it today.'
    const item = buildBlankWord(dup, null, (w) => (w === 'water' ? '물' : null))
    expect(item).toBeNull()
  })

  it('기능어는 지우지 않는다 — 문법이 자리를 정해 주거나, 다른 기능어도 들어간다', () => {
    const item = buildBlankWord(sentence, null, () => '아무뜻')
    expect(item).not.toBeNull()
    expect(['a', 'the', 'with', 'and']).not.toContain(item!.answerText)
  })

  it('사전에 없는 낱말만 있으면 만들지 않는다 — 단서를 못 준다', () => {
    const item = buildBlankWord(sentence, null, () => null)
    expect(item).toBeNull()
  })

  it('첫 낱말은 지우지 않는다 — 첫 글자 단서가 대문자라 정보를 흘린다', () => {
    const item = buildBlankWord(sentence, null, meaningOf)!
    expect(item.stem.startsWith('_____')).toBe(false)
  })

  it('대문자로 시작하는 낱말은 지우지 않는다 — 고유명사는 뜻으로 안 좁혀진다', () => {
    const proper = 'The rover landed near Olympus and sent back pictures.'
    const item = buildBlankWord(proper, null, () => '올림푸스')
    if (item) expect(/^[A-Z]/.test(item.answerText)).toBe(false)
  })

  it('길이 범위를 지킨다 — 짧으면 답이 보이고 길면 철자 시험이 된다', () => {
    const item = buildBlankWord(sentence, null, meaningOf)!
    expect(item.answerText.length).toBeGreaterThanOrEqual(BLANK_WORD_LEN.min)
    expect(item.answerText.length).toBeLessThanOrEqual(BLANK_WORD_LEN.max)
  })

  it('같은 문장이면 늘 같은 문항이 나온다 — 재생성해도 정답이 바뀌면 안 된다', () => {
    const a = buildBlankWord(sentence, null, meaningOf)!
    const b = buildBlankWord(sentence, null, meaningOf)!
    expect(a.answerText).toBe(b.answerText)
    expect(a.stem).toBe(b.stem)
  })
})

describe('어법 고쳐 쓰기 — 망가뜨릴 자리가 하나일 때만 낸다', () => {
  it('부정관사를 망가뜨리고 원형을 정답으로 둔다', () => {
    // "a distant" 하나만 후보다(뒤 낱말이 자음으로 시작).
    const item = buildGrammarFix('Scientists found a distant planet last year.', null)
    expect(item).not.toBeNull()
    expect(item!.rule).toBe('article')
    expect(item!.answerText).toBe('a')
    expect(item!.stem).toContain('an distant')
  })

  it('망가뜨릴 자리가 둘 이상이면 만들지 않는다 — 다른 쪽을 고쳐도 맞는 답이다', () => {
    // 부정관사 후보가 둘("a distant" · "a rocky").
    const item = buildGrammarFix('They saw a distant planet and a rocky moon nearby.', null)
    expect(item).toBeNull()
  })

  it('망가뜨릴 자리가 없으면 만들지 않는다', () => {
    const item = buildGrammarFix('The results were published in several journals worldwide.', null)
    expect(item).toBeNull()
  })

  it('단서를 주지 않는다 — 찾는 것 자체가 과제다', () => {
    const item = buildGrammarFix('Scientists found a distant planet last year.', null)!
    expect(item.hint).toBeNull()
  })

  it('바꾼 낱말 말고는 원문 그대로다 — 다른 데가 달라지면 정답이 흐려진다', () => {
    const src = 'Scientists found a distant planet last year.'
    const item = buildGrammarFix(src, null)!
    const before = src.split(/\s+/)
    const after = item.stem.split(/\s+/)
    expect(after).toHaveLength(before.length)
    const diff = after.filter((w, i) => w !== before[i])
    expect(diff).toHaveLength(1)
  })
})

describe('두 유형이 함께 지키는 문턱', () => {
  it.each([
    ['너무 짧은 문장', 'It rained.'],
    ['끝 부호 없음', 'Scientists found a distant planet last year'],
  ])('%s 은 만들지 않는다', (_label, s) => {
    expect(buildBlankWord(s, null, meaningOf)).toBeNull()
    expect(buildGrammarFix(s, null)).toBeNull()
  })

  it('앞 문장을 문맥으로 실어 준다 — 우리말 해석이 없으므로 그 자리를 대신한다', () => {
    const ctx = 'Astronomers watched the sky for months.'
    const item = buildBlankWord('Scientists discovered a distant planet with a rocky surface.', ctx, meaningOf)!
    expect(item.context).toBe(ctx)
  })
})
