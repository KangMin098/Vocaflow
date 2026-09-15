// packages/library-pipeline/src/textbook/readability-parity.test.ts
//
// **두 자가 같은 답을 내는가.**
//
// 시중 79종은 `scripts/textbook-corpus/analyze.mjs` 의 구현으로 재어졌고(초3~4 3.33 ·
// 중1 7.60 · 중3 10.67), 우리 지문은 이 패키지의 구현으로 잰다. **둘이 갈리면
// "중1 교재는 7.60인데 우리 지문은 6.6" 같은 비교가 전부 무의미해진다** — 그런데 그 사실이
// 어디에서도 오류로 드러나지 않는다. 값이 그럴듯하게 나오기 때문이다.
//
// 그래서 여기서 맞대 본다. 코퍼스 도구는 저장소 밖 자료를 다루는 독립 실행물이라 자기
// 사본을 유지하는 것이 맞고, 대신 **사본이 갈렸는지는 이 테스트가 말한다.**

import { describe, expect, it } from 'vitest'

import { syllables as pkgSyllables } from './readability'

/**
 * ⚠️ `analyze.mjs` 는 **import 하는 것만으로 최상위 코드가 돈다** — 처음 정적 import 로
 *   맞대 봤더니 테스트 도중 코퍼스 분석이 실제로 실행됐다("분석 0 · 최신이라 건너뜀 94").
 *   지금은 읽기만 하지만 그 도구는 코퍼스 store 에 쓰기도 하고, store 가 없는 자리에서는
 *   import 자체가 터진다. **테스트가 남의 도구를 돌리면 안 된다.**
 *
 *   그래서 동적으로 부르고, 못 부르면 **조용히 통과시키는 대신 건너뛴다** —
 *   "맞대 보지 못했다" 와 "같았다" 는 다른 결과이고, 그 차이를 화면에 남긴다.
 */
async function loadCorpusSyllables(): Promise<((w: string) => number) | null> {
  try {
    const m = await import(/* @vite-ignore */ '../../../../scripts/textbook-corpus/analyze.mjs')
    return (m as { syllables?: (w: string) => number }).syllables ?? null
  } catch {
    return null
  }
}

/** 음절 규칙이 갈리기 쉬운 자리를 모았다 — 묵음 e · -ed · -es · -le · 앞머리 y · 짧은 낱말. */
const WORDS = [
  'a',
  'I',
  'the',
  'cat',
  'make',
  'made',
  'makes',
  'baked',
  'table',
  'little',
  'yellow',
  'year',
  'yes',
  'rhythm',
  'science',
  'photosynthesis',
  'unhappiness',
  'queue',
  'idea',
  'radio',
  'quiet',
  'every',
  'people',
  'water',
  'river',
  'village',
  'family',
  'morning',
  'turtle',
  'disappears',
  'gently',
  'beside',
  'extraordinary',
  'consequently',
  'chlorophyll',
  'atmospheric',
  'instrumentation',
  'banana',
  'orange',
  'apple',
  'played',
  'wanted',
  'boxes',
  'wishes',
  'flies',
  'coat',
  'clear',
  'happy',
  'laughs',
  'calls',
  'home',
  'wet',
  'mind',
  'rains',
]

describe('가독성 눈금 — 패키지 ↔ 코퍼스 도구', () => {
  it('음절 세는 법이 낱말마다 같다', async ({ skip }) => {
    const corpusSyllables = await loadCorpusSyllables()
    if (!corpusSyllables) skip() // 맞대 보지 못했다 — 같았다고 적지 않는다

    const diffs: string[] = []
    for (const w of [...WORDS, '', '   ', '123', '!!!', '—']) {
      const a = pkgSyllables(w)
      const b = corpusSyllables!(w)
      if (a !== b) diffs.push(`${JSON.stringify(w)}: 패키지 ${a} vs 코퍼스 ${b}`)
    }
    // 하나라도 갈리면 시중 사다리와 우리 값을 견줄 수 없다.
    expect(diffs).toEqual([])
  })

  it('패키지 구현은 코퍼스가 없어도 고정된 답을 낸다', () => {
    // 맞대기가 건너뛰어지는 자리에서도 **이 표는 반드시 도는다** —
    // 음절 규칙이 조용히 바뀌면 여기서 걸린다.
    expect(WORDS.filter((w) => pkgSyllables(w) === 1).length).toBeGreaterThan(0)
    expect(pkgSyllables('make')).toBe(1)
    expect(pkgSyllables('banana')).toBe(3)
    expect(pkgSyllables('little')).toBe(2)
    expect(pkgSyllables('')).toBe(0)
  })
})
