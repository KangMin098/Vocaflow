// apps/web/src/lib/echo/__tests__/word-signal.test.ts
//
// 이 변환은 **틀려도 화면이 멀쩡한** 종류다 — 잘못 세면 청각 처방만 조용히 어긋난다.
// 실데이터가 짚어 준 위험 세 가지를 규칙으로 못 박는다:
//   ① 마이크 실패(전 축 0)를 오답으로 세면 "발음이 약하다" 는 처방이 장비 문제에서 나온다
//      (실측 6건 중 4건이 발화 실패였다)
//   ② 인식이 못 알아들은 발화를 성적으로 읽으면 조용한 마이크가 학습 이력이 된다
//   ③ 문장 하나로 든 단어 전부를 통과시키면 청각 면이 실제보다 부풀려진다

import { describe, expect, it } from 'vitest'

import { computeShadowMatch } from '@/lib/workspace/shadow-match'

import type { ComparisonScore } from '../dtw-comparator'
import {
  MAX_WORDS_PER_UTTERANCE,
  SOUND_HIT_MIN,
  TRANSCRIPT_TRUST_MIN,
  heardLemma,
  isCredibleUtterance,
  lemmasInSentence,
  soundRecords,
  type SoundLemma,
} from '../word-signal'

const score = (pitch: number, energy: number, timing: number, overall: number): ComparisonScore => ({
  pitch,
  energy,
  timing,
  overall,
})

const lemma = (word: string, forms: string[] = []): SoundLemma => ({
  id: `id-${word}`,
  word,
  forms,
})

/** 실제 전사가 오는 경로 그대로 — 손으로 Set 을 짜면 정규화 규칙이 갈라진다. */
const fromTranscript = (sentence: string, transcript: string) => {
  const m = computeShadowMatch(sentence, transcript)
  return { transcriptRatio: m.ratio, matchedKeys: m.matchedKeys }
}

/** 인식 미측정(미지원 브라우저·인식 실패) */
const noTranscript = { transcriptRatio: null, matchedKeys: null }

describe('isCredibleUtterance — 측정 실패와 낮은 수행을 가른다', () => {
  it('전 축 0 은 발화가 아니다 (voiced 프레임 부족 = 무음·마이크 실패)', () => {
    expect(isCredibleUtterance(score(0, 0, 0, 0))).toBe(false)
  })

  it('프로소디 두 축이 바닥이고 길이만 맞은 것도 신호가 아니다', () => {
    // 실측 (p0, e0, t90, overall 27) — timing 은 발화 길이 비율뿐이라 잡음으로도 맞는다
    expect(isCredibleUtterance(score(0, 0, 90, 27))).toBe(false)
  })

  it('한 축이라도 살아 있으면 발화로 본다', () => {
    // 실측 (p0, e63, t0, overall 19) — 낮지만 실제 수행이다
    expect(isCredibleUtterance(score(0, 63, 0, 19))).toBe(true)
  })

  it('낮은 점수는 걸러지지 않는다 — 게이트는 실패한 측정만 막는다', () => {
    expect(isCredibleUtterance(score(23, 55, 74, 48))).toBe(true)
  })
})

describe('lemmasInSentence · heardLemma — 단어 단위 근거', () => {
  const sentence = 'He was whispering near the harbour.'

  it('문장에 없는 단어는 대상이 아니다', () => {
    const got = lemmasInSentence(sentence, [lemma('harbour'), lemma('mountain')])
    expect(got.map((l) => l.word)).toEqual(['harbour'])
  })

  it('굴절형으로 발화해도 그 단어를 말한 것이다', () => {
    const { matchedKeys } = fromTranscript(sentence, 'he was whispering near the harbour')
    expect(heardLemma(sentence, lemma('whisper', ['whispering']), matchedKeys)).toBe(true)
  })

  it('안 들린 단어는 들은 것으로 세지 않는다', () => {
    // 'harbour' 를 빠뜨린 전사
    const { matchedKeys } = fromTranscript(sentence, 'he was whispering near the')
    expect(heardLemma(sentence, lemma('harbour'), matchedKeys)).toBe(false)
  })
})

describe('soundRecords — 인식이 있을 때 (단어 단위 근거)', () => {
  const sentence = 'The harbour was quiet and solemn.'
  const lemmas = [lemma('harbour'), lemma('solemn')]

  it('들은 단어는 성공, 못 들은 단어는 오답 — 한 발화가 서로 다른 판정을 낳는다', () => {
    const recs = soundRecords({
      sentence,
      score: score(60, 60, 60, 60), // 프로소디는 기준 미만이지만 판정에 쓰이지 않는다
      lemmas,
      ...fromTranscript(sentence, 'the harbour was quiet and'),
    })
    expect(recs).toHaveLength(2)
    expect(recs.every((r) => r.evidence === 'transcript')).toBe(true)
    expect(recs.find((r) => r.lemma.word === 'harbour')?.isCorrect).toBe(true)
    expect(recs.find((r) => r.lemma.word === 'solemn')?.isCorrect).toBe(false)
  })

  it('인식 경로에는 단어 수 상한이 없다 — 단어마다 근거가 따로 있으므로', () => {
    const long = 'The extraordinary magistrate ate a solemn fig beside the quiet harbour.'
    const many = [lemma('extraordinary'), lemma('magistrate'), lemma('solemn'), lemma('harbour')]
    const recs = soundRecords({
      sentence: long,
      score: score(80, 80, 80, 80),
      lemmas: many,
      ...fromTranscript(long, long),
    })
    expect(recs).toHaveLength(4)
    expect(recs.length).toBeGreaterThan(MAX_WORDS_PER_UTTERANCE)
  })

  it('인식이 못 미더우면 아무것도 남기지 않는다 (화면이 "잘 안 들렸어요" 라고 말한 발화)', () => {
    const recs = soundRecords({
      sentence,
      score: score(80, 80, 80, 80), // 프로소디가 좋아도 구제하지 않는다
      lemmas,
      transcriptRatio: TRANSCRIPT_TRUST_MIN - 0.01,
      matchedKeys: new Set(['harbour']),
    })
    expect(recs).toEqual([])
  })
})

describe('soundRecords — 인식이 없을 때 (문장 단위 보조 근거)', () => {
  const sentence = 'The harbour was quiet.'
  const lemmas = [lemma('harbour'), lemma('quiet')]

  it('측정 실패면 아무것도 남기지 않는다 (오답으로도 남기지 않는다)', () => {
    expect(soundRecords({ sentence, score: score(0, 0, 0, 0), lemmas, ...noTranscript })).toEqual([])
  })

  it('기준 이상이면 성공 — 근거는 prosody 로 표시된다', () => {
    const recs = soundRecords({
      sentence,
      score: score(77, 56, 95, SOUND_HIT_MIN),
      lemmas,
      ...noTranscript,
    })
    expect(recs.map((r) => r.isCorrect)).toEqual([true, true])
    expect(recs.every((r) => r.evidence === 'prosody')).toBe(true)
  })

  it('기준 미만이지만 발화는 있었으면 오답으로 센다', () => {
    const recs = soundRecords({
      sentence,
      score: score(23, 55, 74, SOUND_HIT_MIN - 1),
      lemmas,
      ...noTranscript,
    })
    expect(recs.map((r) => r.isCorrect)).toEqual([false, false])
  })

  it('상한을 넘으면 긴 단어가 우선이다 (프로소디 곡선의 큰 몫을 차지하므로)', () => {
    const long = 'The extraordinary magistrate ate a fig by the sea.'
    const recs = soundRecords({
      sentence: long,
      score: score(80, 80, 80, 80),
      lemmas: [lemma('fig'), lemma('sea'), lemma('magistrate'), lemma('extraordinary')],
      ...noTranscript,
    })
    expect(recs).toHaveLength(MAX_WORDS_PER_UTTERANCE)
    expect(recs.map((r) => r.lemma.word)).toEqual(['extraordinary', 'magistrate', 'fig'])
  })

  it('내 단어가 없는 문장은 어휘 신호가 아니다', () => {
    const recs = soundRecords({
      sentence: 'Nothing of mine here.',
      score: score(80, 80, 80, 80),
      lemmas,
      ...noTranscript,
    })
    expect(recs).toEqual([])
  })

  it('경계값은 포함이다', () => {
    expect(SOUND_HIT_MIN).toBe(70)
    const recs = soundRecords({ sentence, score: score(70, 70, 70, 70), lemmas, ...noTranscript })
    expect(recs[0].isCorrect).toBe(true)
  })
})
