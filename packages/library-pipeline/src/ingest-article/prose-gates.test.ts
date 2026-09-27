// packages/library-pipeline/src/ingest-article/prose-gates.test.ts
//
// 임계값이 **실측에서 나왔다는 것**을 붙잡아 두는 회귀다.
// 수를 바꾸려는 사람이 여기서 먼저 걸리고, 왜 그 수인지 읽게 된다.

import { describe, expect, it } from 'vitest'
import {
  ENGLISH_FUNCTION_RATIO_MIN,
  LATIN_RATIO_MIN,
  englishFunctionWordRatio,
  expandLigatures,
  joinColumnBlocks,
  joinLineBreakHyphens,
  judgeEnglishBody,
  latinRatio,
  looksLikeShreddedProse,
  screenBody,
  unglueSentencePunctuation,
} from './prose-gates'

/** 기능어가 정상 밀도로 섞인 영어 산문 — 50토큰을 넘겨야 판정이 열린다. */
const ENGLISH = (
  'The question of whether a city should charge drivers to enter its centre is not a new one. ' +
  'Supporters argue that the charge reduces traffic and that the money can be spent on buses and trains. ' +
  'Critics reply that the cost falls on people who have no other way to reach their work. ' +
  'Both sides agree that the roads are crowded, but they do not agree on who should pay for the cure. ' +
  'A fair scheme would therefore have to protect those with the fewest alternatives.'
).repeat(2)

/** 라틴문자지만 영어가 아닌 글 — ①로는 못 잡고 ②로만 잡힌다(G-o 가 말하는 바로 그 경우). */
const GERMAN = (
  'Die Frage, ob eine Stadt von Fahrern eine Gebuehr für die Einfahrt in das Zentrum verlangen sollte, ' +
  'wird seit langem diskutiert. Befürworter sagen, dass die Gebuehr den Verkehr verringert und dass ' +
  'das Geld für Busse und Bahnen verwendet werden kann. Kritiker entgegnen, dass die Kosten jene treffen, ' +
  'die keinen anderen Weg zur Arbeit haben. Beide Seiten stimmen darin überein, dass die Strassen voll sind.'
).repeat(3)

/** 비라틴 문자 — ①에서 걸린다. */
const RUSSIAN = (
  'Вопрос о том, должен ли город взимать плату с водителей за въезд в центр, обсуждается давно. ' +
  'Сторонники утверждают, что плата уменьшает движение и что деньги можно потратить на автобусы. '
).repeat(4)

describe('judgeEnglishBody — 선언이 아니라 본문으로 판정한다', () => {
  it('영어 산문을 영어로 본다', () => {
    const v = judgeEnglishBody(ENGLISH)
    expect(v.english).toBe(true)
    expect(v.undecidable).toBe(false)
  })

  it('라틴문자를 쓰는 비영어를 잡는다 — 라틴문자 비율만으로는 못 잡는 경우', () => {
    const v = judgeEnglishBody(GERMAN)
    expect(v.latin).toBeGreaterThan(LATIN_RATIO_MIN) // ①은 통과한다
    expect(v.english).toBe(false) // ②에서 걸린다
    expect(v.functionWords).toBeLessThan(ENGLISH_FUNCTION_RATIO_MIN)
  })

  it('비라틴 문자를 잡는다', () => {
    const v = judgeEnglishBody(RUSSIAN)
    expect(v.latin).toBeLessThan(LATIN_RATIO_MIN)
    expect(v.english).toBe(false)
  })

  it('짧은 본문은 「비영어」가 아니라 「판정 불가」다', () => {
    // ⚠️ 결측을 비영어로 세면 「이 원천은 영어가 아니다」는 없는 진단이 만들어진다.
    //    같은 실수를 「짧다 vs 없다」에서 세 번 했다(OLH 875건 중 853이 결측이었다).
    const v = judgeEnglishBody('A short abstract.')
    expect(v.undecidable).toBe(true)
    expect(v.english).toBe(false)
    expect(v.why).toContain('판정 불가')
  })

  it('실측 27편의 간격을 임계값이 갈라놓는다', () => {
    // 영어 최소 0.266 · 비영어(라틴문자) 최대 0.061 — 사이가 비어 있다.
    expect(ENGLISH_FUNCTION_RATIO_MIN).toBeGreaterThan(0.061)
    expect(ENGLISH_FUNCTION_RATIO_MIN).toBeLessThan(0.266)
    // 영어 문서는 전부 라틴 0.99 이상, 비영어는 0.108 이하였다.
    expect(LATIN_RATIO_MIN).toBeGreaterThan(0.108)
    expect(LATIN_RATIO_MIN).toBeLessThan(0.99)
  })

  it('영어 기능어 비율이 실측 대역 안에 든다', () => {
    const r = englishFunctionWordRatio(ENGLISH)
    expect(r).toBeGreaterThan(0.25)
    expect(r).toBeLessThan(0.55)
  })

  it('라틴문자 비율은 숫자·문장부호를 세지 않는다', () => {
    expect(latinRatio('abc 123 !!! ...')).toBe(1)
  })
})

describe('G-j — 문장부호가 다음 낱말에 붙는 것', () => {
  it('대문자가 뒤따를 때만 띄운다', () => {
    expect(unglueSentencePunctuation('the roads are full.Critics reply'))
      .toBe('the roads are full. Critics reply')
  })

  it('약어를 쪼개지 않는다 — 소문자가 뒤따르면 건드리지 않는다', () => {
    expect(unglueSentencePunctuation('for example, e.g. buses')).toBe('for example, e.g. buses')
    expect(unglueSentencePunctuation('see www.example.com today')).toBe('see www.example.com today')
  })

  it('닫는 따옴표·괄호 뒤에서도 동작한다', () => {
    expect(unglueSentencePunctuation('he said "yes".Then he left'))
      .toBe('he said "yes". Then he left')
  })
})

describe('G-p — 리가처와 줄바꿈 하이픈', () => {
  it('합자를 푼다', () => {
    expect(expandLigatures('Sheﬃeld beneﬁts')).toBe('Sheffield benefits')
  })

  it('줄바꿈 하이픈을 이을 때 하이픈을 지우지 않는다', () => {
    // ⚠️ 지우면 `three-dimensional` 이 `threedimensional` 이 되고 되돌릴 수 없다.
    expect(joinLineBreakHyphens('three-\ndimensional space')).toBe('three-dimensional space')
    expect(joinLineBreakHyphens('three-\n  dimensional space')).toBe('three-dimensional space')
  })

  it('대문자로 이어지는 줄은 낱말이 잘린 것이 아니다 — 잇지 않는다', () => {
    expect(joinLineBreakHyphens('long-\nTerm heading')).toBe('long-\nTerm heading')
  })
})

describe('G-q — 2단 조판 블록 잇기', () => {
  it('문장 중간에서 끊긴 블록을 잇는다', () => {
    expect(joinColumnBlocks(['The charge reduces traffic and the', 'money can be spent on buses.']))
      .toEqual(['The charge reduces traffic and the money can be spent on buses.'])
  })

  it('종결부호로 끝난 블록에는 안 붙인다', () => {
    expect(joinColumnBlocks(['The charge reduces traffic.', 'money can be spent on buses.']))
      .toHaveLength(2)
  })

  it('대문자로 시작하는 블록은 제목일 수 있으므로 안 붙인다', () => {
    expect(joinColumnBlocks(['The charge reduces traffic and the', 'Methods'])).toHaveLength(2)
  })

  it('「종결부호로 끝나야 산문」 규칙을 그냥 걸면 본문이 날아간다', () => {
    // 실측: 본문 80블록 중 28이 단 경계 — 먼저 안 이으면 12,171어가 778어가 된다.
    const blocks = ['A charge on drivers reduces the number of cars that', 'enter the centre each day.']
    const naive = blocks.filter((b) => /[.!?]$/.test(b))
    expect(naive).toHaveLength(1) // 앞 블록을 통째로 버린다
    expect(joinColumnBlocks(blocks)).toHaveLength(1) // 이어 붙이면 한 문장으로 남는다
    expect(joinColumnBlocks(blocks)[0]).toContain('reduces the number of cars that enter')
  })
})

describe('G-k — JATS list-item 폭발', () => {
  it('진짜 목록은 통과시킨다', () => {
    expect(looksLikeShreddedProse(['buses', 'trains', 'bicycles'])).toBe(false)
  })

  it('문장 길이 항목이 수백 개면 산문이 쪼개진 것이다', () => {
    const shredded = Array.from(
      { length: 300 },
      () => 'Supporters argue that the charge reduces traffic and pays for public transport.',
    )
    expect(looksLikeShreddedProse(shredded)).toBe(true)
  })
})

describe('screenBody — 정규화를 먼저 하고 판정을 나중에 한다', () => {
  it('합자가 풀린 뒤에 영어 판정이 돌아간다', () => {
    const r = screenBody(ENGLISH.replace(/fi/g, 'ﬁ'))
    expect(r.fixes.ligatures).toBeGreaterThan(0)
    expect(r.text).not.toMatch(/[ﬀ-ﬆ]/)
    expect(r.ok).toBe(true)
  })

  it('블록 배열을 주면 먼저 이어 붙인다', () => {
    const r = screenBody(['The charge reduces traffic and the', 'money can be spent on buses.'])
    expect(r.text).toContain('traffic and the money')
  })

  it('떨어져도 정규화된 본문을 돌려준다 — 왜 떨어졌는지 보려면 필요하다', () => {
    const r = screenBody(GERMAN)
    expect(r.ok).toBe(false)
    expect(r.text.length).toBeGreaterThan(0)
    expect(r.reasons[0]).toContain('영어 기능어')
  })

  it('고친 곳의 수를 센다', () => {
    const r = screenBody('the roads are full.Critics reply. ' + ENGLISH)
    expect(r.fixes.unglued).toBeGreaterThan(0)
  })
})
