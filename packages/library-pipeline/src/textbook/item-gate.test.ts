// packages/library-pipeline/src/textbook/item-gate.test.ts
//
// 적재 관문 회귀. 지키려는 것은 **규칙이 한 벌이라는 것**이다.
//
// ── 무엇이 있었나 (실측 2026-09-06) ─────────────────────────────────
// 규칙이 `item-drain-import.mjs` 안에만 있어 DB 를 붙잡아야 볼 수 있었다. 그래서 문항을
// 쓸 때마다 손으로 검사기를 새로 짰고, 그 사본이 게이트와 갈렸다 — "선택지 최소/최대
// 길이 비 ≥ 0.85" 라는 **있지도 않은 규칙**으로 멀쩡한 요약 문항 넷을 다시 썼다.
//
// 그 착각을 못 박는 시험이 아래 §길이 단서의 첫 두 건이다.

import { describe, expect, it } from 'vitest'
import {
  answerLengthBias,
  checkDrainItem,
  ANSWER_LEN_RATIO,
  ANSWER_LEN_RATIO_MIN,
  LONGEST_ANSWER_MAX,
  MIN_CHOICE,
} from './item-gate'

/** 관문을 통과하는 최소한의 한 줄. 시험마다 필요한 칸만 덮어쓴다. */
const base = (over: Record<string, unknown> = {}) => ({
  article_id: 'a-1',
  source_title: '테스트 지문',
  // 90~200어 창 안에 들도록 넉넉히. 산문이고 기사 껍데기가 없다.
  passage: Array.from({ length: 120 }, (_, i) => `word${i % 30}`).join(' ') + '.',
  choices: [
    'the first plausible option here',
    'the second plausible option here',
    'the third plausible option here',
    'the fourth plausible option here',
    'the fifth plausible option here',
  ],
  answer: 2,
  rationale_ko:
    '글은 "plausible option" 이라고 말한다. 그래서 ②다. 나머지는 지문에 없는 내용이다.',
  ...over,
})

describe('문항 관문', () => {
  it('갖출 것을 갖춘 문항은 통과한다', () => {
    const v = checkDrainItem(base(), 'topic', 5)
    expect(v.reason).toBeUndefined()
    expect(v.ok).toBe(true)
  })

  it('선택지가 다섯이 아니면 막는다', () => {
    const v = checkDrainItem(base({ choices: ['aaaaaaaaaa', 'bbbbbbbbbb'] }), 'topic', 5)
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/다섯/)
  })

  it('선택지가 서로 겹치면 막는다 — 답이 둘이 된다', () => {
    const c = base().choices.slice()
    c[4] = c[0].toUpperCase() + '!' // 대소문자·구두점만 다르다
    const v = checkDrainItem(base({ choices: c }), 'topic', 5)
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/겹친/)
  })

  it('정답 번호가 1~5 밖이면 막는다', () => {
    expect(checkDrainItem(base({ answer: 0 }), 'topic', 5).ok).toBe(false)
    expect(checkDrainItem(base({ answer: 6 }), 'topic', 5).ok).toBe(false)
  })

  it('너무 짧은 선택지를 막는다', () => {
    const c = base().choices.slice()
    c[3] = 'x'.repeat(MIN_CHOICE - 1)
    expect(checkDrainItem(base({ choices: c }), 'topic', 5).ok).toBe(false)
  })

  it('근거가 지문의 영어를 인용하지 않으면 막는다', () => {
    const v = checkDrainItem(
      base({ rationale_ko: '글의 흐름을 보면 ②가 맞다. 나머지는 아니다.' }),
      'topic',
      5,
    )
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/인용/)
  })

  it('근거가 왜 나머지가 아닌지 안 짚으면 막는다', () => {
    const v = checkDrainItem(
      base({ rationale_ko: '글은 "plausible option" 이라고 말하므로 그것이 답이다.' }),
      'topic',
      5,
    )
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/나머지/)
  })
})

// ── 길이 단서 ───────────────────────────────────────────────────────
// 규칙은 **정답 ÷ 오답 평균**이다. 최소/최대 비가 아니다.
describe('길이 단서', () => {
  it('선택지 길이가 들쭉날쭉해도 정답이 평균에 가까우면 통과한다', () => {
    // 최소/최대 비는 0.5 로 낮지만 — 그것은 규칙이 아니다.
    const choices = [
      'a'.repeat(40),
      'b'.repeat(30), // 정답
      'c'.repeat(20),
      'd'.repeat(30),
      'e'.repeat(30),
    ]
    const lens = choices.map((c) => c.length)
    expect(Math.min(...lens) / Math.max(...lens)).toBeLessThan(0.85) // 사본이 막던 자리
    const v = checkDrainItem(base({ choices, answer: 2 }), 'topic', 5)
    expect(v.reason).toBeUndefined()
    expect(v.ok).toBe(true)
  })

  it('정답이 유일한 최장이어도 그 자체로는 막지 않는다', () => {
    // 5지선다에서 정답이 최장일 확률은 원래 20% 다 — 문항마다 버리면 5분의 1을 버린다.
    const choices = ['a'.repeat(30), 'b'.repeat(32), 'c'.repeat(30), 'd'.repeat(30), 'e'.repeat(30)]
    const v = checkDrainItem(base({ choices, answer: 2 }), 'topic', 5)
    expect(v.ok).toBe(true)
  })

  it('정답이 오답 평균의 1.25배를 넘으면 막는다', () => {
    const choices = ['a'.repeat(20), 'b'.repeat(30), 'c'.repeat(20), 'd'.repeat(20), 'e'.repeat(20)]
    expect(30 / 20).toBeGreaterThan(ANSWER_LEN_RATIO)
    const v = checkDrainItem(base({ choices, answer: 2 }), 'topic', 5)
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/길이만 보고/)
  })

  it('정답이 오답 평균의 0.8배 미만이어도 막는다 — 짧은 쪽도 단서다', () => {
    const choices = ['a'.repeat(30), 'b'.repeat(20), 'c'.repeat(30), 'd'.repeat(30), 'e'.repeat(30)]
    expect(20 / 30).toBeLessThan(ANSWER_LEN_RATIO_MIN)
    const v = checkDrainItem(base({ choices, answer: 2 }), 'topic', 5)
    expect(v.ok).toBe(false)
    expect(v.reason).toMatch(/짧다/)
  })
})

// ── 유형별 조건 ─────────────────────────────────────────────────────
describe('유형별 조건', () => {
  it('빈칸 유형은 지문에 `____` 가 있어야 한다', () => {
    expect(checkDrainItem(base(), 'blank', 5).ok).toBe(false)
    const withBlank = base({ passage: base().passage.replace('word0', '____') })
    expect(checkDrainItem(withBlank, 'blank', 5).ok).toBe(true)
  })

  it('요약 유형은 `(A)`·`(B)` 가 든 요약문이 있어야 한다', () => {
    expect(checkDrainItem(base(), 'summary', 5).ok).toBe(false)
    const ok = base({ summary_sentence: 'The study shows (A) and therefore (B).' })
    expect(checkDrainItem(ok, 'summary', 5).ok).toBe(true)
  })

  it('함의 유형은 밑줄 구절이 지문에 그대로 있어야 한다', () => {
    expect(checkDrainItem(base({ underline: '없는 구절' }), 'implication', 5).ok).toBe(false)
    expect(checkDrainItem(base({ underline: 'word0 word1' }), 'implication', 5).ok).toBe(true)
  })
})

// ── 배치 편향 ───────────────────────────────────────────────────────
describe('배치 길이 편향', () => {
  const item = (lens: number[], answer: number) => ({
    choices: lens.map((n, i) => String.fromCharCode(97 + i).repeat(n)),
    answer,
  })

  it('여덟 건 미만이면 비율을 보지 않는다', () => {
    const bias = answerLengthBias([item([30, 40, 30, 30, 30], 2)])
    expect(bias.enough).toBe(false)
  })

  it('정답이 유일한 최장인 비율을 센다', () => {
    // 열 건 중 다섯 건에서 정답이 유일한 최장 → 50% > 40%
    const rows = [
      ...Array.from({ length: 5 }, () => item([30, 40, 30, 30, 30], 2)),
      ...Array.from({ length: 5 }, () => item([30, 30, 30, 30, 30], 2)),
    ]
    const bias = answerLengthBias(rows)
    expect(bias.longest).toBe(5)
    expect(bias.worst).toBeCloseTo(0.5)
    expect(bias.worst).toBeGreaterThan(LONGEST_ANSWER_MAX)
  })

  it('공동 최장은 세지 않는다 — 고르는 근거가 못 된다', () => {
    const rows = Array.from({ length: 10 }, () => item([40, 40, 30, 30, 30], 2))
    expect(answerLengthBias(rows).longest).toBe(0)
  })

  it('짧은 쪽도 똑같이 센다', () => {
    const rows = [
      ...Array.from({ length: 5 }, () => item([30, 20, 30, 30, 30], 2)),
      ...Array.from({ length: 5 }, () => item([30, 30, 30, 30, 30], 2)),
    ]
    const bias = answerLengthBias(rows)
    expect(bias.shortest).toBe(5)
    expect(bias.longest).toBe(0)
    expect(bias.worst).toBeCloseTo(0.5)
  })
})
