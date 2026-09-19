// packages/library-pipeline/src/vocab/typeset.test.ts
//
// 조판기가 **지어내지 않는가**, 그리고 **시중 지면과 같은 자리에 앉히는가**.
//
// 지면 지수(`scripts/vocab/design-benchmark.mts`)는 브라우저에서 재므로 개발 서버가 흔들리면
// 같이 흔들린다. 조판 규칙 자체는 여기서 잠근다 — 이 층이 맞으면 남는 문제는 렌더뿐이다.

import { describe, expect, it } from 'vitest'
import { clozeOf, isInflection, isUsableForm, posLabel, typesetVocabSet, type TypesetWord } from './typeset'

const w = (over: Partial<TypesetWord> & { word: string }): TypesetWord => ({
  meaningsKo: [{ pos: 'noun', meaning: '뜻', example: null, example_ko: null }],
  ...over,
})

describe('품사 약물', () => {
  it('시중 지면과 같은 한 글자로 옮긴다', () => {
    expect(posLabel('noun')).toBe('명')
    expect(posLabel('verb')).toBe('동')
    expect(posLabel('adjective')).toBe('형')
    expect(posLabel('adverb')).toBe('부')
  })

  it('모르는 품사는 **지어내지 않고 뺀다**', () => {
    expect(posLabel('particle')).toBeNull()
    expect(posLabel(null)).toBeNull()
    expect(posLabel('')).toBeNull()
  })
})

describe('굴절형 / 파생어 가르기', () => {
  it('굴절 어미만 붙은 것은 굴절형이다', () => {
    expect(isInflection('regular', 'regulars')).toBe(true)
    expect(isInflection('make', 'making')).toBe(true) // e 탈락
    expect(isInflection('stop', 'stopped')).toBe(true) // 자음 중복
    expect(isInflection('carry', 'carried')).toBe(true) // y → i
  })

  it('어간이 달라지면 파생어다 — 다른 칸에 실려야 한다', () => {
    expect(isInflection('regular', 'regularly')).toBe(false)
    expect(isInflection('regular', 'irregular')).toBe(false)
    expect(isInflection('detect', 'detective')).toBe(false)
  })
})

describe('빈칸 문항', () => {
  it('표제어를 지운다', () => {
    expect(clozeOf('He was a regular customer.', 'regular')).toBe('He was a _______ customer.')
  })

  it('예문에 표제어가 없으면 **문항을 만들지 않는다** (틀린 문항보다 없는 문항이 낫다)', () => {
    expect(clozeOf('He was a customer.', 'regular')).toBeNull()
  })

  it('낱말 경계를 지킨다 — 부분 일치로 남의 낱말을 지우지 않는다', () => {
    expect(clozeOf('The regularity is high.', 'regular')).toBeNull()
  })
})

describe('조판', () => {
  const words: TypesetWord[] = [
    w({
      word: 'regular',
      meaningsKo: [
        { pos: 'adjective', meaning: '규칙적인', example: 'He was a regular customer.', example_ko: '그는 단골이었다.' },
        { pos: 'noun', meaning: '단골', example: null, example_ko: null },
      ],
      ipa: '/ɹˈɛɡjəlɚ/',
      synonyms: ['steady'],
      antonyms: ['irregular'],
      koreanLearnerNote: '잦다는 뜻이 아니다.',
      inflectionForms: ['regulars', 'regularly', 'irregular'],
    }),
    w({ word: 'steady', meaningsKo: [{ pos: 'adjective', meaning: '꾸준한', example: 'Keep a steady pace.', example_ko: '꾸준한 속도를 유지해라.' }] }),
    w({ word: 'detect', meaningsKo: [{ pos: 'verb', meaning: '감지하다', example: null, example_ko: null }], inflectionForms: ['detective'] }),
    w({ word: 'decade' }),
  ]

  it('통번호는 권을 관통해 네 자리로 찍힌다', () => {
    const s = typesetVocabSet({ title: 'T', wordsPerDay: 2, words })
    const nos = s.parts.flatMap((p) => p.days.flatMap((d) => d.entries.map((e) => e.no)))
    expect(nos).toEqual(['0001', '0002', '0003', '0004'])
  })

  it('하루치가 정해진 대로 잘린다', () => {
    const s = typesetVocabSet({ title: 'T', wordsPerDay: 2, words })
    expect(s.studyPlan.days).toBe(2)
    expect(s.studyPlan.perDay).toBe(2)
    expect(s.parts[0]!.days.map((d) => d.entries.length)).toEqual([2, 2])
  })

  it('뜻이 하나면 번호를 붙이지 않는다 — 번호가 하나뿐인 목록은 번호가 아니다', () => {
    const s = typesetVocabSet({ title: 'T', wordsPerDay: 4, words })
    const entries = s.parts[0]!.days[0]!.entries
    expect(entries[0]!.senses.map((x) => x.n)).toEqual([1, 2])
    expect(entries[1]!.senses.map((x) => x.n)).toEqual([null])
  })

  it('굴절형과 파생어를 다른 칸에 앉힌다', () => {
    const s = typesetVocabSet({ title: 'T', wordsPerDay: 4, words })
    const regular = s.parts[0]!.days[0]!.entries[0]!
    expect(regular.inflections).toEqual(['regulars'])
    expect(regular.derived).toEqual(['regularly', 'irregular'])
  })

  it('상호참조는 **이 권 안에 있는 낱말만** 잇는다', () => {
    const s = typesetVocabSet({ title: 'T', wordsPerDay: 2, words })
    const regular = s.parts[0]!.days[0]!.entries[0]!
    // steady 는 이 권에 있고(2번째), irregular 는 없다.
    expect(regular.crossRefs.map((r) => r.word)).toEqual(['steady'])
    expect(regular.crossRefs[0]!.day).toBe(1)
  })

  it('빈칸 문항은 예문이 있는 표제어에서만 나온다', () => {
    const s = typesetVocabSet({ title: 'T', wordsPerDay: 4, words })
    const test = s.parts[0]!.days[0]!.test
    expect(test.meaning).toHaveLength(4)
    expect(test.cloze.map((c) => c.answer)).toEqual(['regular', 'steady'])
  })

  it('누적 복습은 주기가 0 이면 만들지 않는다', () => {
    const s = typesetVocabSet({ title: 'T', wordsPerDay: 1, reviewEveryDays: 0, words })
    expect(s.reviews).toHaveLength(0)
  })

  it('누적 복습은 앞의 날짜를 묶는다', () => {
    const s = typesetVocabSet({ title: 'T', wordsPerDay: 1, reviewEveryDays: 2, words })
    expect(s.studyPlan.days).toBe(4)
    expect(s.reviews.map((r) => r.coversDays)).toEqual([[1, 2], [3, 4]])
  })

  it('색인은 알파벳순이고 몇째 날인지 함께 적는다', () => {
    const s = typesetVocabSet({ title: 'T', wordsPerDay: 2, words })
    expect(s.index.map((x) => x.word)).toEqual(['decade', 'detect', 'regular', 'steady'])
    expect(s.index.find((x) => x.word === 'decade')!.day).toBe(2)
  })

  it('묶음이 있으면 그것을 그대로 PART 로 쓴다 — 조판기가 다시 나누지 않는다', () => {
    const grouped = words.map((x, i) => ({ ...x, groupKey: i < 2 ? 'g1' : 'g2', groupLabel: i < 2 ? '앞' : '뒤' }))
    const s = typesetVocabSet({ title: 'T', wordsPerDay: 2, words: grouped })
    expect(s.parts.map((p) => p.label)).toEqual(['앞', '뒤'])
  })
})

describe('장치 목록은 **채워진 것만** 센다', () => {
  it('값이 없으면 그 장치를 적지 않는다', () => {
    const bare = typesetVocabSet({
      title: 'T',
      wordsPerDay: 2,
      words: [
        { word: 'aa', meaningKo: '가' },
        { word: 'bb', meaningKo: '나' },
        { word: 'cc', meaningKo: '다' },
      ],
    })
    expect(bare.apparatus).not.toContain('exampleEn')
    expect(bare.apparatus).not.toContain('usageNote')
    expect(bare.apparatus).not.toContain('derivedRow')
    expect(bare.apparatus).not.toContain('crossRef')
    expect(bare.apparatus).not.toContain('rootHeader')
    // 번호·러닝헤드·색인·테스트·회독은 데이터 없이도 성립한다.
    expect(bare.apparatus).toEqual(
      expect.arrayContaining(['entryNumber', 'runningHead', 'index', 'dailyTest', 'checkbox']),
    )
  })

  it('재료가 있으면 시중 17종 중 열여섯을 채운다 (품사 약물까지)', () => {
    const rich = typesetVocabSet({
      title: 'T',
      wordsPerDay: 2,
      principle: '어근 하나가 챕터 하나',
      words: [
        w({
          word: 'regular',
          meaningsKo: [
            { pos: 'adjective', meaning: '규칙적인', example: 'He was a regular customer.', example_ko: '그는 단골이었다.' },
            { pos: 'noun', meaning: '단골', example: null, example_ko: null },
          ],
          ipa: '/x/',
          synonyms: ['steady'],
          koreanLearnerNote: '노트',
          inflectionForms: ['regulars', 'regularly'],
        }),
        w({ word: 'steady', meaningsKo: [{ pos: 'adjective', meaning: '꾸준한', example: 'Keep a steady pace.', example_ko: '꾸준히.' }] }),
        w({ word: 'detect' }),
        w({ word: 'decade' }),
      ],
    })
    // 17종 중 채워지지 않는 것은 없다 — 위 재료가 전부를 건드린다.
    expect(rich.apparatus).toHaveLength(17)
  })
})

describe('굴절 판정에 품사가 든다 (2026-09-07)', () => {
  it('동사의 `-er` 는 **파생**이다 — follower 는 활용형이 아니다', () => {
    expect(isInflection('follow', 'follower', 'verb')).toBe(false)
    expect(isInflection('follow', 'followed', 'verb')).toBe(true)
  })

  it('형용사의 `-er`·`-est` 는 굴절이다 (비교급·최상급)', () => {
    expect(isInflection('fast', 'faster', 'adjective')).toBe(true)
    expect(isInflection('fast', 'fastest', 'adjective')).toBe(true)
  })

  it('품사를 모르면 보수적으로 — 파생으로 둔다 (지면의 괄호는 활용형 자리다)', () => {
    expect(isInflection('follow', 'follower')).toBe(false)
  })

  it('낱말이 아닌 조각은 아예 싣지 않는다 — `파생 ff` 가 지면에 찍혔다', () => {
    expect(isUsableForm('ff')).toBe(false)
    expect(isUsableForm('12')).toBe(false)
    expect(isUsableForm('followers')).toBe(true)
  })

  it('조판이 그 조각을 걸러 낸다', () => {
    const s = typesetVocabSet({
      title: 'T',
      wordsPerDay: 4,
      words: [
        {
          word: 'follow',
          meaningsKo: [{ pos: 'verb', meaning: '따라가다', example: null, example_ko: null }],
          inflectionForms: ['ff', 'followed', 'follower', 'followers'],
        },
      ],
    })
    const e = s.parts[0]!.days[0]!.entries[0]!
    expect(e.inflections).toEqual(['followed'])
    expect(e.derived).toEqual(['follower', 'followers'])
  })
})

describe('불규칙 동사는 표로 잡는다 (2026-09-07)', () => {
  it('어미 규칙이 못 잡던 굴절을 활용형으로 센다', () => {
    for (const [base, form] of [
      ['throw', 'threw'], ['throw', 'thrown'], ['begin', 'began'], ['break', 'broken'],
      ['go', 'went'], ['buy', 'bought'], ['write', 'written'], ['take', 'taken'],
    ] as const) {
      expect(isInflection(base, form, 'verb'), `${base} → ${form}`).toBe(true)
    }
  })

  it('같은 어간의 **파생어**는 여전히 파생이다 — 표가 파생까지 삼키면 안 된다', () => {
    expect(isInflection('throw', 'thrower', 'verb')).toBe(false)
    expect(isInflection('write', 'writer', 'verb')).toBe(false)
    expect(isInflection('build', 'builder', 'verb')).toBe(false)
  })

  it('표에 없는 낱말은 종전대로 — 규칙만 본다', () => {
    expect(isInflection('walk', 'walked', 'verb')).toBe(true)
    expect(isInflection('walk', 'walker', 'verb')).toBe(false)
  })

  it('조판이 불규칙을 활용형 칸에 앉힌다', () => {
    const s = typesetVocabSet({
      title: 'T',
      wordsPerDay: 4,
      words: [
        {
          word: 'throw',
          meaningsKo: [{ pos: 'verb', meaning: '던지다', example: null, example_ko: null }],
          inflectionForms: ['threw', 'thrown', 'throws', 'thrower'],
        },
      ],
    })
    const e = s.parts[0]!.days[0]!.entries[0]!
    expect(e.inflections.sort()).toEqual(['threw', 'thrown', 'throws'])
    expect(e.derived).toEqual(['thrower'])
  })
})
