// apps/web/src/lib/csat/__tests__/passage-skeleton.test.ts
//
// 이 파일이 지키는 것은 두 가지고, **둘째가 더 중요하다.**
//   ① 강조가 맞는 자리에 가는가
//   ② **원문이 새지 않는가** — 골격은 «글자 없는 모양» 이어야 한다.
//      여기가 뚫리면 우리는 평가원 지문을 재배포하는 것이 된다. 기능 결함은 눈에 띄지만
//      이 결함은 안 띈다 — 화면은 멀쩡히 잘 도니까.

import { describe, expect, it } from 'vitest'

import { buildSkeleton, splitSentences } from '../passage-skeleton'

const PASSAGE =
  'Climate change is a crisis of imagination. Disasters resist the novel. ' +
  'Environmental change can be imperceptible; it proceeds slowly, only occasionally ' +
  'producing spectacular events. Dr. Smith noted that 3.5 degrees is the threshold. ' +
  'The changes occurred gradually.'

/** 반환 객체 안의 모든 문자열을 모은다 — 새는 곳이 어디든 여기 걸린다. */
function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) for (const x of v) allStrings(x, out)
  else if (v && typeof v === 'object') for (const x of Object.values(v)) allStrings(x, out)
  return out
}

describe('splitSentences', () => {
  it('문장 수를 센다', () => {
    expect(splitSentences(PASSAGE)).toHaveLength(5)
  })

  it('약어에서 끊지 않는다 — Dr. 는 문장 끝이 아니다', () => {
    const s = splitSentences('Dr. Smith went home. He slept.')
    expect(s).toHaveLength(2)
  })

  it('소수점에서 끊지 않는다', () => {
    const s = splitSentences('It rose 3.5 degrees. Then it fell.')
    expect(s).toHaveLength(2)
  })

  it('같은 지문은 언제나 같은 분할이다', () => {
    expect(splitSentences(PASSAGE)).toEqual(splitSentences(PASSAGE))
  })

  it('빈 지문에 빈 배열', () => {
    expect(splitSentences('')).toEqual([])
  })
})

describe('buildSkeleton — 강조가 맞는 자리로 가는가', () => {
  it('인용문이 걸친 문장을 찾는다', () => {
    const { placements } = buildSkeleton(PASSAGE, [
      { id: 'answer', quote: 'it proceeds slowly' },
    ])
    expect(placements[0].sentences).toEqual([2])
  })

  it('드러난 글자가 실제로 인용문이다 — 오프셋이 밀리지 않았다는 뜻', () => {
    const { skeleton } = buildSkeleton(PASSAGE, [{ id: 'answer', quote: 'it proceeds slowly' }])
    const r = skeleton.sentences[2].reveals[0]
    expect(r.text).toBe('it proceeds slowly')
  })

  it('문장 두 개에 걸친 인용을 문장마다 잘라 담는다', () => {
    const { skeleton, placements } = buildSkeleton(PASSAGE, [
      { id: 'answer', quote: 'Disasters resist the novel. Environmental change can be imperceptible' },
    ])
    expect(placements[0].sentences).toEqual([1, 2])
    expect(skeleton.sentences[1].reveals).toHaveLength(1)
    expect(skeleton.sentences[2].reveals).toHaveLength(1)
    // 두 조각을 이으면 인용문이 된다 (사이 공백 제외)
    const joined = skeleton.sentences[1].reveals[0].text + ' ' + skeleton.sentences[2].reveals[0].text
    expect(joined).toContain('Disasters resist the novel.')
    expect(joined).toContain('Environmental change can be imperceptible')
  })

  it('못 찾은 앵커를 조용히 버리지 않는다 — 빈 sentences 로 남는다', () => {
    // 버려 버리면 화면이 "근거를 못 찾았다" 를 말할 수 없고, 학습자는 그냥
    // 아무 일도 안 일어난 버튼을 누르게 된다.
    const { placements } = buildSkeleton(PASSAGE, [
      { id: 'answer', quote: 'this sentence is not in the passage' },
    ])
    expect(placements).toHaveLength(1)
    expect(placements[0]).toEqual({ id: 'answer', sentences: [] })
  })

  it('앵커 여럿의 순서와 id 를 지킨다', () => {
    const { placements } = buildSkeleton(PASSAGE, [
      { id: 'reject:1', quote: 'Disasters resist the novel' },
      { id: 'nope', quote: 'absent' },
      { id: 'answer', quote: 'occurred gradually' },
    ])
    expect(placements.map((p) => p.id)).toEqual(['reject:1', 'nope', 'answer'])
    expect(placements[1].sentences).toEqual([])
  })

  it('reveal 의 start·end 가 text 와 일치한다 — 막대 안의 강조 위치가 밀리지 않는다', () => {
    // 화면은 이 두 수로 막대 안에서 강조 구간을 잡는다. text 만 맞고 좌표가 밀리면
    // 엉뚱한 자리가 칠해지는데, text 는 멀쩡하므로 눈으로 안 잡힌다.
    const { skeleton } = buildSkeleton(PASSAGE, [
      { id: 'answer', quote: 'it proceeds slowly' },
      { id: 'reject:1', quote: 'Disasters resist the novel' },
    ])
    const reveals = skeleton.sentences.flatMap((s, i) => s.reveals.map((r) => ({ r, chars: s.chars })))
    expect(reveals.length).toBeGreaterThan(0)
    for (const { r, chars } of reveals) {
      expect(r.end - r.start).toBe(r.text.length)
      expect(r.start).toBeGreaterThanOrEqual(0)
      expect(r.end).toBeLessThanOrEqual(chars)
    }
  })

  it('막대 길이의 합이 지문 길이를 넘지 않는다', () => {
    const { skeleton } = buildSkeleton(PASSAGE, [])
    const sum = skeleton.sentences.reduce((a, s) => a + s.chars, 0)
    expect(sum).toBeLessThanOrEqual(skeleton.chars)
    expect(skeleton.chars).toBe(PASSAGE.length)
  })
})

describe('buildSkeleton — 경계: 원문이 새지 않는가', () => {
  it('앵커가 없으면 문자열이 하나도 안 나간다', () => {
    const { skeleton } = buildSkeleton(PASSAGE, [])
    expect(allStrings(skeleton)).toEqual([])
  })

  it('나가는 문자열은 전부 인용문 안이다', () => {
    const anchors = [
      { id: 'answer', quote: 'it proceeds slowly' },
      { id: 'reject:1', quote: 'Disasters resist the novel' },
    ]
    const { skeleton } = buildSkeleton(PASSAGE, anchors)
    const strings = allStrings(skeleton).filter((s) => !anchors.some((a) => a.id === s))
    expect(strings.length).toBeGreaterThan(0)
    for (const s of strings) {
      expect(anchors.some((a) => a.quote.includes(s))).toBe(true)
    }
  })

  it('드러난 글자의 총량이 인용문 총량을 넘지 않는다', () => {
    const anchors = [{ id: 'answer', quote: 'it proceeds slowly' }]
    const { skeleton } = buildSkeleton(PASSAGE, anchors)
    const revealed = skeleton.sentences.flatMap((s) => s.reveals).reduce((a, r) => a + r.text.length, 0)
    const quoted = anchors.reduce((a, x) => a + x.quote.length, 0)
    expect(revealed).toBeLessThanOrEqual(quoted)
  })

  it('지문의 한 문장이 통째로 나가지 않는다 (앵커가 그 문장 일부일 때)', () => {
    const { skeleton } = buildSkeleton(PASSAGE, [{ id: 'answer', quote: 'resist the novel' }])
    const joined = allStrings(skeleton).join(' ')
    expect(joined).not.toContain('Disasters resist the novel.')
  })
})
