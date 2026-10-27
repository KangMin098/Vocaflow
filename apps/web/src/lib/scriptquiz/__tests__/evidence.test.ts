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
