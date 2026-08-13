// apps/web/src/lib/dictation/__tests__/adaptation.test.ts
//
// 받아쓰기의 두 판정 로직을 고정한다. 둘 다 화면에 안 보이는데 학습 결과를 바꾼다:
//   ① 청취 폭 적응 — 어떤 문장을 고를 것인가 (난이도)
//   ② 타깃 등급 — 그 단어를 언제 다시 만날 것인가 (FSRS)
//
// 특히 ②는 틀리면 조용히 망가진다. 정답을 열어 보고 옮겨 적은 것을 '맞혔다'로 세면
// 복습 간격이 늘어나 **가장 모르는 단어가 다시 안 나온다** — 화면상 아무 증상이 없다.

import { describe, it, expect } from 'vitest'

import { pickBySpan, spanBand } from '../source'
import { evaluateTargets, reduceTargetRatings } from '../targets'
import { deriveErrorTags } from '../error-tags'
import type { WordResult } from '../types'

// ── ① 청취 폭 적응 ────────────────────────────────────────────────

describe('spanBand', () => {
  it('기록이 없으면 짧은 쪽부터 — 첫 경험이 좌절이면 두 번째가 없다', () => {
    for (const empty of [null, undefined, 0]) {
      const band = spanBand(empty)
      expect(band.lo).toBe(4)
      expect(band.hi).toBe(14)
    }
  })

  it('상한은 폭의 1.5배 (i+1) 이되 34단어를 넘지 않는다', () => {
    expect(spanBand(12).hi).toBe(18)
    expect(spanBand(20).hi).toBe(30)
    // 30 * 1.5 = 45 → MAX_WORDS 로 잘린다
    expect(spanBand(30).hi).toBe(34)
    expect(spanBand(100).hi).toBe(34)
  })

  it('하한은 폭의 0.6배 — 너무 쉬우면 인출이 일어나지 않는다', () => {
    expect(spanBand(20).lo).toBe(12)
  })

  it('어떤 폭에서도 lo < hi 이고 하한이 4 아래로 내려가지 않는다', () => {
    for (let span = 1; span <= 60; span++) {
      const b = spanBand(span)
      expect(b.lo).toBeGreaterThanOrEqual(4)
      expect(b.lo).toBeLessThan(b.hi)
      expect(b.hi).toBeLessThanOrEqual(34)
    }
  })
})

describe('pickBySpan', () => {
  const s = (words: number, tag: string) => ({ text: Array(words).fill(tag).join(' '), tag })

  it('원본 순서를 보존한다 — 길이순으로 재정렬하면 이야기가 무너진다', () => {
    const items = [s(30, 'a'), s(10, 'b'), s(28, 'c'), s(12, 'd'), s(11, 'e')]
    const picked = pickBySpan(items, 3, { lo: 8, hi: 14 })
    expect(picked.map((p) => p.tag)).toEqual(['b', 'd', 'e'])
  })

  it('길이대 안의 문장을 우선 고른다', () => {
    const items = [s(33, 'long1'), s(12, 'fit1'), s(34, 'long2'), s(13, 'fit2')]
    const picked = pickBySpan(items, 2, { lo: 10, hi: 16 })
    expect(picked.map((p) => p.tag)).toEqual(['fit1', 'fit2'])
  })

  it('길이대 안이 부족하면 가장 덜 벗어난 것으로 채운다', () => {
    // 목표 10~16. 안에는 1개뿐 → 17(초과 1) 이 30(초과 14) 보다 먼저 채워져야 한다
    const items = [s(30, 'far'), s(12, 'fit'), s(17, 'near')]
    const picked = pickBySpan(items, 2, { lo: 10, hi: 16 })
    expect(picked.map((p) => p.tag)).toEqual(['fit', 'near'])
  })

  it('요청 수가 전체 이상이면 그대로 돌려준다', () => {
    const items = [s(5, 'a'), s(40, 'b')]
    expect(pickBySpan(items, 2, { lo: 10, hi: 16 })).toHaveLength(2)
    expect(pickBySpan(items, 9, { lo: 10, hi: 16 })).toHaveLength(2)
  })
})

// ── ② 타깃 등급 (FSRS) ───────────────────────────────────────────

function wr(expected: string, actual: string, status: WordResult['status']): WordResult {
  return { expected, actual, status, similarity: status === 'correct' ? 1 : 0.5 }
}

const BASE = {
  expected: 'The vulnerability was obvious.',
  targetWords: ['vulnerability'],
  targetForms: {},
  wordResults: [
    wr('the', 'the', 'correct'),
    wr('vulnerability', 'vulnerability', 'correct'),
    wr('was', 'was', 'correct'),
    wr('obvious', 'obvious', 'correct'),
  ],
  hintsUsed: 0,
  maxHintLevel: 0,
  replayCount: 0,
  skipped: false,
}

describe('evaluateTargets', () => {
  it('한 번 듣고 힌트 없이 맞히면 Easy(4)', () => {
    const [o] = evaluateTargets({ ...BASE, replayCount: 1 })
    expect(o.hit).toBe(true)
    expect(o.rating).toBe(4)
  })

  it('여러 번 듣고 맞히면 Good(3)', () => {
    const [o] = evaluateTargets({ ...BASE, replayCount: 4 })
    expect(o.rating).toBe(3)
  })

  it('약한 힌트(1~3단계)를 쓰면 Hard(2)', () => {
    const [o] = evaluateTargets({ ...BASE, hintsUsed: 1, maxHintLevel: 1 })
    expect(o.rating).toBe(2)
  })

  it('정답 보기(4단계)는 맞게 적혔어도 Again(1) — 인출이 없었다', () => {
    const [o] = evaluateTargets({ ...BASE, hintsUsed: 1, maxHintLevel: 4 })
    expect(o.hit).toBe(false)
    expect(o.rating).toBe(1)
  })

  it('건너뛰면 Again(1)', () => {
    const [o] = evaluateTargets({ ...BASE, skipped: true })
    expect(o.rating).toBe(1)
  })

  it('철자만 흔들리면 Hard(2) — 소리는 잡았다', () => {
    const [o] = evaluateTargets({
      ...BASE,
      wordResults: [
        wr('the', 'the', 'correct'),
        wr('vulnerability', 'vulnerabilty', 'misspelled'),
      ],
    })
    expect(o.hit).toBe(false)
    expect(o.partial).toBe(true)
    expect(o.rating).toBe(2)
  })
})

describe('reduceTargetRatings', () => {
  it('같은 단어를 여러 문장에서 만나면 가장 낮은 등급을 채택한다', () => {
    const m = reduceTargetRatings([
      { word: 'grove', rating: 4 },
      { word: 'grove', rating: 1 },
      { word: 'phantom', rating: 3 },
    ])
    // 관대한 쪽으로 평균 내면 놓친 단어의 복습이 늦어진다
    expect(m.get('grove')).toBe(1)
    expect(m.get('phantom')).toBe(3)
  })
})

// ── ③ 오류 태그 (누적 리포트의 원천) ──────────────────────────────

describe('deriveErrorTags', () => {
  it('관사 누락을 article 로 잡는다', () => {
    const tags = deriveErrorTags({
      expected: 'She opened the door.',
      actual: 'She opened door.',
      wordResults: [
        wr('she', 'she', 'correct'),
        wr('opened', 'opened', 'correct'),
        wr('the', '', 'missing'),
        wr('door', 'door', 'correct'),
      ],
    })
    expect(tags).toContain('article')
  })

  it('어미 누락을 inflection 으로 잡는다', () => {
    const tags = deriveErrorTags({
      expected: 'He walked home.',
      actual: 'He walk home.',
      wordResults: [wr('walked', 'walk', 'wrong')],
    })
    expect(tags).toContain('inflection')
  })

  it('동음 혼동을 homophone 으로 잡는다', () => {
    const tags = deriveErrorTags({
      expected: 'their house',
      actual: 'there house',
      wordResults: [wr('their', 'there', 'wrong')],
    })
    expect(tags).toContain('homophone')
  })

  it('단어는 다 맞고 자리만 바뀌면 word-order', () => {
    const tags = deriveErrorTags({
      expected: 'never had he seen it',
      actual: 'he had never seen it',
      wordResults: [wr('never', 'he', 'wrong')],
    })
    expect(tags).toContain('word-order')
  })

  it('뒷부분이 통째로 비면 tail-drop — 문장이 길었다는 신호', () => {
    const words = ['the', 'old', 'man', 'walked', 'slowly', 'down', 'the', 'quiet', 'street', 'alone']
    const tags = deriveErrorTags({
      expected: words.join(' '),
      actual: words.slice(0, 7).join(' '),
      wordResults: words.map((w, i) =>
        i < 7 ? wr(w, w, 'correct') : wr(w, '', 'missing'),
      ),
    })
    expect(tags).toContain('tail-drop')
  })

  it('타깃을 놓치면 missed-target', () => {
    const tags = deriveErrorTags({
      expected: 'a capacious pocket',
      actual: 'a spacious pocket',
      wordResults: [wr('capacious', 'spacious', 'wrong')],
      missedTargets: ['capacious'],
    })
    expect(tags).toContain('missed-target')
  })

  it('완벽하게 받아쓰면 태그가 없다 — 없는 약점을 만들지 않는다', () => {
    expect(
      deriveErrorTags({
        expected: 'She opened the door.',
        actual: 'She opened the door.',
        wordResults: [
          wr('she', 'she', 'correct'),
          wr('opened', 'opened', 'correct'),
          wr('the', 'the', 'correct'),
          wr('door', 'door', 'correct'),
        ],
      }),
    ).toEqual([])
  })
})
