// apps/web/src/lib/scriptquiz/__tests__/evidence.test.ts
import { describe, expect, it } from 'vitest'
import { buildEvidenceChoice, locateEvidence, normalizeForMatch, splitSentences } from '../evidence'

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
