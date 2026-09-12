// apps/web/src/lib/dictation/__tests__/targets-graded.test.ts
//
// **완벽하게 받아썼는데 「놓쳤어요」라고 말하던 것.**
//
// 실측 2026-09-05 — 정답 문장을 100% 그대로 입력해도 79,764문장 중 **898(1.13%)** 이
// `hit=false, rating=2` 였다. 원인은 둘이다:
//   ① 타깃이 그 문장에 실제로 없는데(세트 경로가 lemma 를 검증 없이 심는다) 채점기가
//      "등급을 매기지 않는다" 고 주석에 쓰고 **실제로는 rating 2 를 돌려줬다.** 화면은 주황
//      칩으로 「놓쳤어요」라 말하고, 그 2 가 FSRS 로 실려 복습 간격까지 줄였다.
//   ② 폴백이 `lemma.slice(0, max(3, len-2))` 접두사라 5자 이하 lemma 는 앞 3글자만 비교했다 —
//      `wax`→`waxen` · `prim`→`primness` · `savor`→`savour` 처럼 **다른 낱말**로 채점됐다
//      (79,764문장 중 1,516 = 1.90%).
// 렌더도 저장도 성공하므로 조용하다. 여기서 시끄럽게 만든다.

import { describe, expect, it } from 'vitest'

import { evaluateTargets, reduceTargetRatings } from '../targets'
import type { WordResult } from '../types'

const ok = (expected: string): WordResult => ({ expected, actual: expected, status: 'correct' }) as WordResult
const sentence = (s: string) => s.split(' ').map(ok)

const base = {
  targetForms: {},
  hintsUsed: 0,
  maxHintLevel: 0,
  replayCount: 1,
  skipped: false,
}

describe('evaluateTargets — 채점이 성립하지 않으면 학습자 탓으로 돌리지 않는다', () => {
  it('문장에 없는 타깃은 graded=false — 놓친 것도 아니고 FSRS 에도 안 간다', () => {
    const expected = 'Women and children wept together.'
    const [o] = evaluateTargets({ ...base, expected, targetWords: ['tumulus'], wordResults: sentence(expected) })
    expect(o!.graded).toBe(false)
    expect(reduceTargetRatings([o!]).size).toBe(0)
  })

  it('문장에 있는 타깃을 정확히 받아쓰면 graded=true · hit=true', () => {
    const expected = 'The wolf lay on the stable roof.'
    const [o] = evaluateTargets({ ...base, expected, targetWords: ['wolf'], wordResults: sentence(expected) })
    expect(o!.graded).toBe(true)
    expect(o!.hit).toBe(true)
    expect(reduceTargetRatings([o!]).get('wolf')).toBe(4)
  })

  it('규칙 굴절형은 폴백 없이도 잡힌다 (studies → study)', () => {
    const expected = 'She studies every night.'
    const [o] = evaluateTargets({ ...base, expected, targetWords: ['study'], wordResults: sentence(expected) })
    expect(o!.graded).toBe(true)
    expect(o!.hit).toBe(true)
  })

  it('접두사만 같은 다른 낱말로 채점하지 않는다 (wax ↔ waxen)', () => {
    const expected = 'Her waxen face turned away.'
    const [o] = evaluateTargets({ ...base, expected, targetWords: ['wax'], wordResults: sentence(expected) })
    // `waxen` 은 `wax` 의 굴절형이 아니다 — 채점 근거가 될 수 없다
    expect(o!.graded).toBe(false)
  })

  it('접두사만 같은 다른 낱말로 채점하지 않는다 (prim ↔ primness)', () => {
    const expected = 'Such primness annoyed him.'
    const [o] = evaluateTargets({ ...base, expected, targetWords: ['prim'], wordResults: sentence(expected) })
    expect(o!.graded).toBe(false)
  })

  it('사전 굴절형(불규칙)은 여전히 잡힌다 (trod → tread)', () => {
    const expected = 'O bitterest of all paths I ever trod.'
    const [o] = evaluateTargets({
      ...base,
      expected,
      targetWords: ['tread'],
      targetForms: { tread: ['trod', 'trodden'] },
      wordResults: sentence(expected),
    })
    expect(o!.graded).toBe(true)
    expect(o!.hit).toBe(true)
  })

  it('건너뛴 문항은 채점이 성립한다 — Again 이 맞다', () => {
    const expected = 'The wolf lay there.'
    const [o] = evaluateTargets({ ...base, expected, targetWords: ['wolf'], wordResults: [], skipped: true })
    expect(o!.graded).toBe(true)
    expect(o!.rating).toBe(1)
  })

  it('reduceTargetRatings 는 graded=false 를 건너뛰고 나머지는 최저 등급을 택한다', () => {
    const m = reduceTargetRatings([
      { word: 'a', rating: 4, graded: true },
      { word: 'a', rating: 2, graded: true },
      { word: 'b', rating: 2, graded: false },
      { word: 'c', rating: 3 },
    ])
    expect(m.get('a')).toBe(2)
    expect(m.has('b')).toBe(false)
    expect(m.get('c')).toBe(3)
  })
})
