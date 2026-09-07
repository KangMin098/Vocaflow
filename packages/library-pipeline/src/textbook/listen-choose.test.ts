// packages/library-pipeline/src/textbook/listen-choose.test.ts
//
// **듣기 문항의 실패는 "듣지 않고도 풀린다" 이다.**
//
// 다른 유형은 정답이 갈리는 것이 위험이었다(단답=정답 유일성 · 객관식=오답 무해성).
// 듣기는 다르다 — 정답이 하나여도 **오답이 엉뚱하면 첫소리만 듣고 배제**되고,
// 그러면 학습자가 듣기가 아니라 눈치로 푼다. 문항은 멀쩡해 보이고 정답률도 높게 나온다.
// 그래서 여기서 재는 것은 **오답이 정답과 겨룰 만한가**다.
//
// 라이선스도 함께 잰다. Commons 발음 파일은 대부분 CC BY-SA 3.0 이라 **출처 표기가 의무**고,
// 표기 없이 실으면 문항이 아니라 위반이다.

import { describe, expect, it } from 'vitest'

import { buildListenChoose, commonsAudioTitle, type WordAudio } from './listen-choose'
import { ELEMENTARY_CHOICES, type ElementaryWord } from './elementary'

const w = (word: string, meaningKo: string, rhymeKey: string | null): ElementaryWord => ({
  word,
  meaningKo,
  rhymeKey,
})

/** `-æt` 각운 무리 + 나머지. 실제 `rhyme_key` 는 강세 모음부터의 각운이다. */
const POOL: ElementaryWord[] = [
  w('cat', '고양이', 'æt'),
  w('hat', '모자', 'æt'),
  w('bat', '박쥐', 'æt'),
  w('mat', '깔개', 'æt'),
  w('dog', '개', 'ɔɡ'),
  w('sun', '해', 'ʌn'),
  w('book', '책', 'ʊk'),
  w('tree', '나무', 'iː'),
]

const audio: WordAudio = { url: 'https://upload.wikimedia.org/x/En-us-cat.ogg', attribution: 'Wikimedia Commons · CC BY-SA 3.0' }
const audioOf = (word: string) => (word === 'cat' ? audio : null)

describe('듣고 고르기 — 듣지 않고 풀 수 없어야 한다', () => {
  const item = buildListenChoose(POOL[0]!, POOL, audioOf)

  it('4지선다이고 정답이 제시 낱말이다', () => {
    expect(item).not.toBeNull()
    expect(item!.choices).toHaveLength(ELEMENTARY_CHOICES)
    expect(item!.answerText).toBe('cat')
    expect(item!.choices[item!.answer - 1]!.text).toBe('cat')
  })

  it('오답이 같은 각운이다 — 첫소리를 들어야 갈린다', () => {
    const wrong = item!.choices.filter((_, i) => i !== item!.answer - 1).map((c) => c.text)
    const keyOf = new Map(POOL.map((x) => [x.word, x.rhymeKey]))
    // 같은 각운 후보가 셋 있으므로 전부 그쪽에서 와야 한다.
    for (const t of wrong) expect(keyOf.get(t)).toBe('æt')
  })

  it('화면에 낱말을 보여 주지 않는다 — 보여 주면 듣기가 아니다', () => {
    expect(item!.stem).toBe('')
  })

  it('보기에 같은 낱말이 두 번 들어가지 않는다', () => {
    const texts = item!.choices.map((c) => c.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('음원과 출처 표기를 함께 싣는다', () => {
    expect(item!.audio.url).toContain('En-us-cat.ogg')
    expect(item!.audio.attribution).toContain('CC BY-SA')
  })

  it('출처 표기가 없으면 만들지 않는다 — CC BY-SA 의 BY 를 못 지킨다', () => {
    const noAttrib = buildListenChoose(POOL[0]!, POOL, () => ({ url: 'https://x/y.ogg', attribution: '' }))
    expect(noAttrib).toBeNull()
  })

  it('음원이 없으면 만들지 않는다', () => {
    expect(buildListenChoose(POOL[0]!, POOL, () => null)).toBeNull()
  })

  it('굴절·파생형은 오답으로 쓰지 않는다 — 소리가 거의 같아 답이 둘처럼 들린다', () => {
    const withInflection = [...POOL, w('cats', '고양이들', 'æts')]
    const it2 = buildListenChoose(POOL[0]!, withInflection, audioOf)!
    expect(it2.choices.map((c) => c.text)).not.toContain('cats')
  })

  it('오답 후보가 모자라면 만들지 않는다', () => {
    expect(buildListenChoose(POOL[0]!, [POOL[0]!, POOL[1]!], audioOf)).toBeNull()
  })

  it('같은 낱말이면 늘 같은 문항이 나온다', () => {
    const a = buildListenChoose(POOL[0]!, POOL, audioOf)!
    const b = buildListenChoose(POOL[0]!, POOL, audioOf)!
    expect(a.answer).toBe(b.answer)
    expect(a.choices.map((c) => c.text)).toEqual(b.choices.map((c) => c.text))
  })

  it('각운이 없는 낱말도 길이가 비슷한 오답으로 만든다', () => {
    const noRhyme = w('milk', '우유', null)
    const item2 = buildListenChoose(noRhyme, [...POOL, noRhyme], () => audio)
    expect(item2).not.toBeNull()
    expect(item2!.answerText).toBe('milk')
  })
})

describe('Commons 파일 이름 규약', () => {
  it('규약대로 제목을 만든다 — 존재 확인은 호출 쪽 몫이다', () => {
    expect(commonsAudioTitle('Cat')).toBe('File:En-us-cat.ogg')
    expect(commonsAudioTitle('cat', 'uk')).toBe('File:En-uk-cat.ogg')
  })
})
