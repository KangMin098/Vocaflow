// apps/web/src/lib/learner/__tests__/session-queue.test.ts
//
// 허브 큐의 **불일치 금지** 계약.
//
// 배경: /flashcard · /spellforge 허브는 버킷을 상수로 갖고 있었다(5/12/3/23 · 4/12/2/18).
// 그걸 실데이터로 바꾸면서 새로 생길 수 있는 결함은 mock 과 종류가 다르다 —
// **화면이 말하는 개수와 시작을 눌렀을 때 나오는 개수가 어긋나는 것**이다.
// 학습자에게는 그것도 거짓말이고, mock 보다 찾기 어렵다(숫자가 그럴싸하게 움직이므로).
//
// 그래서 여기서 지키는 것은 "값이 맞나" 가 아니라 **"합계가 세션과 같나"** 다.

import { describe, expect, it } from 'vitest'

import { bucketsOf, overdueOf, emptySessionQueue, type QueuedWord } from '../session-queue'

function w(word: string, state: QueuedWord['state'], overdue = false): QueuedWord {
  return { word, state, overdue }
}

/** 급한 것 먼저 — fetchStudyVocabularies 의 정렬(next_review_at ASC)을 모사한 표본. */
const SAMPLE: QueuedWord[] = [
  w('bribe', 'risk', true),
  w('inherit', 'risk', true),
  w('vex', 'shaky', true),
  w('candid', 'shaky'),
  w('quell', 'shaky'),
  w('ledger', 'new'),
  w('tacit', 'stable'),
  w('opaque', 'risk'),
  w('ferment', 'stable'),
]

describe('bucketsOf — 합계 불일치 금지', () => {
  it('limit 없으면 합계가 전체 세션 크기와 같다', () => {
    const sum = bucketsOf(SAMPLE).reduce((s, b) => s + b.count, 0)
    expect(sum).toBe(SAMPLE.length)
  })

  it('limit 을 주면 합계가 정확히 그 개수다 — 고른 길이와 화면이 어긋나면 안 된다', () => {
    for (const limit of [0, 1, 3, 5, 9]) {
      const sum = bucketsOf(SAMPLE, limit).reduce((s, b) => s + b.count, 0)
      expect(sum, `limit=${limit} 에서 합계가 어긋났다`).toBe(limit)
    }
  })

  it('limit 이 세션보다 크면 있는 것만 센다 (없는 카드를 만들지 않는다)', () => {
    const sum = bucketsOf(SAMPLE, 50).reduce((s, b) => s + b.count, 0)
    expect(sum).toBe(SAMPLE.length)
  })

  it('음수 limit 도 0으로 다룬다 (쿼리스트링은 아무 값이나 올 수 있다)', () => {
    expect(bucketsOf(SAMPLE, -5).reduce((s, b) => s + b.count, 0)).toBe(0)
  })
})

describe('bucketsOf — 미리보기는 실제로 먼저 만날 단어', () => {
  it('앞에서부터 최대 3개 채운다', () => {
    const risk = bucketsOf(SAMPLE).find((b) => b.kind === 'risk')
    // opaque 는 4번째 risk 가 아니라 3번째다(bribe·inherit·opaque) — 3개까지만 담는다
    expect(risk?.preview).toEqual(['bribe', 'inherit', 'opaque'])
    const shaky = bucketsOf(SAMPLE).find((b) => b.kind === 'shaky')
    expect(shaky?.preview).toEqual(['vex', 'candid', 'quell'])
  })

  it('limit 안에 없는 단어는 미리보기에도 안 나온다', () => {
    // limit=3 → bribe·inherit·vex 까지만. opaque(8번째 risk)는 빠져야 한다.
    const risk = bucketsOf(SAMPLE, 3).find((b) => b.kind === 'risk')
    expect(risk?.preview).toEqual(['bribe', 'inherit'])
    expect(risk?.preview).not.toContain('opaque')
  })

  it('개수 0인 버킷에는 preview 키를 붙이지 않는다 (빈 배열이 흐린 카드에 렌더되지 않게)', () => {
    const only = bucketsOf([w('a', 'stable')])
    const risk = only.find((b) => b.kind === 'risk')
    expect(risk).toEqual({ kind: 'risk', count: 0 })
    expect(risk).not.toHaveProperty('preview')
  })
})

describe('bucketsOf — 4칸 계약', () => {
  it('단어가 없어도 4 버킷을 급한 순서로 돌려준다', () => {
    expect(bucketsOf([]).map((b) => b.kind)).toEqual(['risk', 'shaky', 'new', 'stable'])
    expect(bucketsOf([]).every((b) => b.count === 0)).toBe(true)
  })
})

describe('overdueOf', () => {
  it('bucketsOf 와 같은 slice 규칙을 쓴다 — 두 숫자가 다른 모집단을 세면 안 된다', () => {
    expect(overdueOf(SAMPLE)).toBe(3)
    expect(overdueOf(SAMPLE, 3)).toBe(3)
    expect(overdueOf(SAMPLE, 2)).toBe(2)
    expect(overdueOf(SAMPLE, 0)).toBe(0)
  })

  it('세션 크기를 절대 넘지 않는다', () => {
    for (const limit of [0, 1, 4, 9, 99]) {
      const size = bucketsOf(SAMPLE, limit).reduce((s, b) => s + b.count, 0)
      expect(overdueOf(SAMPLE, limit)).toBeLessThanOrEqual(size)
    }
  })
})

describe('emptySessionQueue', () => {
  it('빈 큐는 단어 0 · 전체 0 · 상한 미달', () => {
    expect(emptySessionQueue()).toEqual({ words: [], vocabTotal: 0, capped: false })
  })

  it('두 번 불러도 서로를 오염시키지 않는다', () => {
    const a = emptySessionQueue()
    a.words.push(w('x', 'new'))
    expect(emptySessionQueue().words).toHaveLength(0)
  })
})
