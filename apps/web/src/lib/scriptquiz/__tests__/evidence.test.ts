// apps/web/src/lib/scriptquiz/__tests__/evidence.test.ts
import { describe, expect, it } from 'vitest'
import { buildEvidenceChoice, locateEvidence, locateSingleEvidence, normalizeForMatch, splitSentences } from '../evidence'

const PASSAGE = [
  'Mina walked to the library after school every Tuesday.',
  'She liked the quiet room on the second floor because nobody talked there.',
  '“I can finally hear my own thoughts,” she told her brother.',
  'Her brother preferred the noisy park near the station.',
  'One day the library closed early for repairs to the old roof.',
  'Mina sat on the steps and read until the sun went down.',
].join(' ')

describe('splitSentences', () => {
  it('문장부호·닫는 따옴표·단락에서 자른다', () => {
    const s = splitSentences(`${PASSAGE}\n\nA new paragraph starts here!`)
    expect(s).toHaveLength(7)
    expect(s[2]).toBe('“I can finally hear my own thoughts,” she told her brother.')
    expect(s[6]).toBe('A new paragraph starts here!')
  })
})

describe('locateEvidence', () => {
  const sentences = splitSentences(PASSAGE)
  it('따옴표·대소문자 차이를 무시하고 근거 문장을 찾는다', () => {
    expect(locateEvidence(sentences, '"i can finally hear my own thoughts"')).toEqual([2])
  })
  it('생략부호 조각은 각각 찾아 여러 문장에 걸칠 수 있다', () => {
    expect(locateEvidence(sentences, 'the library closed early... read until the sun went down')).toEqual([4, 5])
  })
  it('본문에 없는 근거는 빈 배열 — 비슷한 문장을 근거로 세우지 않는다', () => {
    expect(locateEvidence(sentences, 'The museum opened late on Sundays for visitors.')).toEqual([])
  })
  it('너무 짧은 조각은 쓰지 않는다', () => {
    expect(locateEvidence(sentences, 'the ... she')).toEqual([])
  })
})

describe('locateSingleEvidence — 근거 전체가 한 문장에 유일하게 대응할 때만', () => {
  const body = splitSentences(
    'She liked the quiet room because nobody talked there. He left. The bus came late that rainy morning. Her friend waited near the gate for an hour. They both laughed at the old joke again.',
  )
  it('한 문장 안의 조각들이면 그 문장', () => {
    expect(locateSingleEvidence(body, 'she liked the quiet room ... nobody talked there')).toBe(0)
  })
  it('snippet 이 두 문장 전체에 걸치면 null (Codex 반례 1)', () => {
    expect(locateSingleEvidence(body, 'She liked the quiet room because nobody talked there. He left.')).toBeNull()
  })
  it('짧은 조각이 섞이면 null (Codex 반례 2)', () => {
    expect(locateSingleEvidence(body, 'nobody talked there...He left.')).toBeNull()
  })
  it('조각 하나라도 본문에 없으면 null (Codex 반례 3)', () => {
    expect(locateSingleEvidence(body, 'nobody talked there...the museum opened late on Sundays')).toBeNull()
  })
  it('낱말 일부는 맞지 않는다 — men 이 women 문장을 근거로 세우지 않는다 (Codex 반례 4)', () => {
    const passage =
      'The women were waiting outside the station. The bus came late that rainy morning. Her friend waited near the gate for an hour. They both laughed at the old joke again.'
    expect(locateSingleEvidence(splitSentences(passage), 'men were waiting outside')).toBeNull()
    expect(buildEvidenceChoice(passage, 'men were waiting outside', 'q')).toBeNull()
    expect(locateSingleEvidence(splitSentences(passage), 'women were waiting outside')).toBe(0)
  })
  it('한 조각이 여러 문장에 맞으면 null', () => {
    const rep = splitSentences('The quiet room was open today. The quiet room was open today again.')
    expect(locateSingleEvidence(rep, 'the quiet room was open today')).toBeNull()
  })
  it('그 세 반례에서 피커도 생기지 않는다', () => {
    const passage = body.join(' ')
    for (const s of [
      'She liked the quiet room because nobody talked there. He left.',
      'nobody talked there...He left.',
      'nobody talked there...the museum opened late on Sundays',
    ]) expect(buildEvidenceChoice(passage, s, 'q')).toBeNull()
  })
})

describe('buildEvidenceChoice', () => {
  it('후보 4개 · 근거 1개 포함 · 방해 문장은 근거와 겹치지 않는다', () => {
    const c = buildEvidenceChoice(PASSAGE, 'nobody talked there', 'q-1')!
    expect(c.sentences).toHaveLength(4)
    expect(c.sentences[c.evidenceIndex]).toContain('nobody talked there')
    const others = c.sentences.filter((_, i) => i !== c.evidenceIndex)
    expect(others.every((s) => !normalizeForMatch(s).includes('nobody talked there'))).toBe(true)
    expect(new Set(c.sentences).size).toBe(4)
  })
  it('같은 문항이면 늘 같은 후보·순서(결정적)', () => {
    expect(buildEvidenceChoice(PASSAGE, 'nobody talked there', 'q-1')).toEqual(
      buildEvidenceChoice(PASSAGE, 'nobody talked there', 'q-1'),
    )
  })
  it('근거가 여러 문장에 걸치면 한 문장을 물을 수 없어 null', () => {
    expect(buildEvidenceChoice(PASSAGE, 'the library closed early... read until the sun went down', 'q-2')).toBeNull()
  })
  it('근거 문장이 본문에 반복되면 위치가 정해지지 않아 null', () => {
    const twice = `${PASSAGE} She liked the quiet room on the second floor because nobody talked there.`
    expect(buildEvidenceChoice(twice, 'nobody talked there', 'q-3')).toBeNull()
  })
  it('근거를 못 찾거나 본문·근거가 비면 null', () => {
    expect(buildEvidenceChoice(PASSAGE, 'not in this passage at all, really', 'q')).toBeNull()
    expect(buildEvidenceChoice('', 'nobody talked there', 'q')).toBeNull()
    expect(buildEvidenceChoice(PASSAGE, '', 'q')).toBeNull()
  })
  it('다른 문장이 3개 미만이면 null', () => {
    expect(buildEvidenceChoice('Only one sentence here is long enough. And another one is here.', 'only one sentence here', 'q')).toBeNull()
  })
})

describe('장 표식(수집 메타데이터)은 근거 후보가 아니다', () => {
  const RS = String.fromCharCode(0x1e)
  const marker = (n: string, t: string) => `CHAPTER ${n}. ${t}${RS}https://standardebooks.org/ebooks/aesop/fables/v-s-vernon-jones/text/single-page#fable-${n}`
  const body = [
    marker('29', 'The Fox and the Grapes'),
    'A hungry Fox saw some fine bunches of Grapes hanging from a vine. He did his best to reach them by jumping as high as he could into the air. But it was all in vain, for they were just out of reach. So he gave up trying and walked away with an air of dignity. He said he thought the Grapes were sour after all.',
    marker('30', 'The Mice in Council'),
    'Once upon a time all the Mice met together in Council to plan their escape.',
  ].join('\n\n')

  it('RS 표식 단락의 제목·URL 조각은 문장으로 나오지 않는다', () => {
    const s = splitSentences(body)
    expect(s.some((x) => /standardebooks|org\/ebooks|CHAPTER/.test(x))).toBe(false)
    expect(s).toContain('He said he thought the Grapes were sour after all.')
  })
  it('피커 후보에도 메타데이터가 섞이지 않고 등록 근거 대조는 그대로', () => {
    const c = buildEvidenceChoice(body, 'he thought the Grapes were sour after all', 'q-fox')!
    expect(c).not.toBeNull()
    expect(c.sentences.some((x) => /http|org\/|CHAPTER/.test(x))).toBe(false)
    expect(c.sentences[c.evidenceIndex]).toContain('sour after all')
  })
  it('RS 없는 정상 CHAPTER 제목 줄·URL 이 든 보통 문장은 남는다', () => {
    const plain = ['CHAPTER I. A Plain Title Line', 'Visit https://example.org for more, she said.'].join('\n')
    const s = splitSentences(plain)
    expect(s.some((x) => x.startsWith('CHAPTER I'))).toBe(true)
    expect(s.some((x) => x.includes('example'))).toBe(true)
  })
})
