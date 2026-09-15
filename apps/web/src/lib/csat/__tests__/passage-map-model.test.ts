// apps/web/src/lib/csat/__tests__/passage-map-model.test.ts
//
// 지문 지도의 판단부 회귀. 화면은 `renderToString` 으로만 볼 수 있으므로,
// «칩을 눌렀을 때 무엇이 열리는가» 는 전부 여기서 지킨다.

import { describe, expect, it } from 'vitest'

import type { SkeletonSentence } from '../passage-skeleton'
import { countsAsOpen, initialAnchorId, mapState, offMapChoices, segments, widthPct, type MapAnchor } from '../passage-map-model'

const ANCHORS: MapAnchor[] = [
  { id: 'reject:1', label: '①', kind: 'reject', detail: '①은 이래서 아니다' },
  { id: 'answer', label: '③', kind: 'answer', detail: '③이 답인 이유' },
  { id: 'reject:2', label: '②', kind: 'reject', detail: '②는 이래서 아니다' },
]
const PLACEMENTS = [
  { id: 'reject:1', sentences: [1] },
  { id: 'answer', sentences: [4, 5] },
  { id: 'reject:2', sentences: [] },
]

describe('initialAnchorId — 정답 근거를 먼저 세운다', () => {
  it('오답이 앞에 있어도 정답 근거를 고른다', () => {
    // 오답부터 보여 주면 "내가 왜 틀렸나" 로 시작해 자책이 앞선다(철학 3).
    expect(initialAnchorId(ANCHORS)).toBe('answer')
  })

  it('정답 근거가 없으면 첫 번째를 고른다', () => {
    expect(initialAnchorId(ANCHORS.filter((a) => a.kind !== 'answer'))).toBe('reject:1')
  })

  it('앵커가 없으면 null', () => {
    expect(initialAnchorId([])).toBeNull()
  })
})

describe('mapState — 누른 것에 맞는 막대가 열리는가', () => {
  it('정답을 고르면 그 문장들이 열린다', () => {
    const s = mapState(ANCHORS, PLACEMENTS, 'answer')
    expect(s.active?.id).toBe('answer')
    expect(s.lit).toEqual([4, 5])
    expect(s.notFound).toBe(false)
  })

  it('다른 칩을 누르면 열린 곳이 바뀐다 — 매칭이 따라 움직인다', () => {
    expect(mapState(ANCHORS, PLACEMENTS, 'reject:1').lit).toEqual([1])
    expect(mapState(ANCHORS, PLACEMENTS, 'answer').lit).toEqual([4, 5])
  })

  it('위치를 못 찾은 근거는 notFound 로 알린다 — 조용히 아무 일도 안 일어나면 안 된다', () => {
    const s = mapState(ANCHORS, PLACEMENTS, 'reject:2')
    expect(s.active?.id).toBe('reject:2')
    expect(s.lit).toEqual([])
    expect(s.notFound).toBe(true)
    // 설명은 그대로 남아야 한다 — 막다른 화면을 만들지 않는다.
    expect(s.active?.detail).toBe('②는 이래서 아니다')
  })

  it('없는 id 에는 아무것도 열지 않는다', () => {
    expect(mapState(ANCHORS, PLACEMENTS, 'nope')).toEqual({ active: null, lit: [], notFound: false })
    expect(mapState(ANCHORS, PLACEMENTS, null).active).toBeNull()
  })

  it('배치 정보가 아예 없는 앵커도 notFound 다 (빠뜨리지 않는다)', () => {
    const s = mapState(ANCHORS, [], 'answer')
    expect(s.notFound).toBe(true)
  })
})

const sent = (chars: number, reveals: SkeletonSentence['reveals'] = []): SkeletonSentence => ({ chars, reveals })

describe('segments — 문장 안의 «어디» 를 그린다', () => {
  it('앞뒤가 가려지고 가운데만 드러난다', () => {
    const s = sent(100, [{ anchorId: 'answer', start: 30, end: 40, text: 'ten chars!' }])
    expect(segments(s, s.reveals)).toEqual([
      { chars: 30 },
      { chars: 10, text: 'ten chars!' },
      { chars: 60 },
    ])
  })

  it('문장 처음부터 드러나면 앞 가림이 없다', () => {
    const s = sent(20, [{ anchorId: 'a', start: 0, end: 5, text: 'abcde' }])
    expect(segments(s, s.reveals)).toEqual([{ chars: 5, text: 'abcde' }, { chars: 15 }])
  })

  it('문장 끝까지 드러나면 뒤 가림이 없다', () => {
    const s = sent(10, [{ anchorId: 'a', start: 5, end: 10, text: 'fghij' }])
    expect(segments(s, s.reveals)).toEqual([{ chars: 5 }, { chars: 5, text: 'fghij' }])
  })

  it('조각 길이의 합이 문장 길이와 같다 — 막대가 늘거나 줄지 않는다', () => {
    const s = sent(80, [
      { anchorId: 'a', start: 10, end: 20, text: '0123456789' },
      { anchorId: 'b', start: 50, end: 60, text: 'abcdefghij' },
    ])
    expect(segments(s, s.reveals).reduce((a, x) => a + x.chars, 0)).toBe(80)
  })

  it('겹치는 두 앵커에서 같은 글자를 두 번 내지 않는다', () => {
    // 두 번 그리면 화면에 같은 낱말이 두 번 나와 «지문이 그렇게 생겼나» 로 읽힌다.
    const s = sent(30, [
      { anchorId: 'a', start: 5, end: 15, text: 'AAAAABBBBB' },
      { anchorId: 'b', start: 10, end: 20, text: 'BBBBBCCCCC' },
    ])
    const segs = segments(s, s.reveals)
    expect(segs.reduce((a, x) => a + x.chars, 0)).toBe(30)
    expect(segs.map((x) => x.text ?? '').join('')).toBe('AAAAABBBBBCCCCC')
  })

  it('드러난 것이 없으면 통짜 가림 하나다', () => {
    expect(segments(sent(42), [])).toEqual([{ chars: 42 }])
  })
})

describe('countsAsOpen — 계측 수가 부풀지 않는가', () => {
  it('다른 칩을 누르면 센다', () => {
    expect(countsAsOpen('answer', 'reject:1')).toBe(true)
  })

  it('같은 칩을 다시 눌러도 안 센다 — 한 사람이 10을 만들 수 있다', () => {
    expect(countsAsOpen('answer', 'answer')).toBe(false)
  })

  it('아무것도 안 열린 상태에서 처음 누르면 센다', () => {
    expect(countsAsOpen(null, 'answer')).toBe(true)
  })
})

describe('widthPct', () => {
  it('가장 긴 문장이 100% 다', () => {
    expect(widthPct(200, 200)).toBe(100)
  })

  it('아주 짧은 문장도 보인다 — 0 이면 «문장이 없다» 로 읽힌다', () => {
    expect(widthPct(1, 500)).toBe(6)
  })

  it('0 으로 나누지 않는다', () => {
    expect(widthPct(0, 0)).toBe(6)
  })
})

describe('offMapChoices — 모든 선지는 칩이거나 글이거나', () => {
  const ds = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }]

  it('지도가 하나도 못 들면 전부 글로 내려온다 — 이것이 실제로 깨져 있던 경우다', () => {
    // 실측 2026-09-15: 골격 589 중 136문항이 answer 앵커 하나뿐인데 조건이 문항 단위라
    // 오답 분석 544문단(평균 867자)이 화면에서 통째로 사라져 있었다.
    expect(offMapChoices(ds, ['answer'])).toEqual(ds)
  })

  it('지도가 든 선지만 빠진다', () => {
    expect(offMapChoices(ds, ['answer', 'reject:2', 'reject:5']).map((d) => d.n)).toEqual([1, 3, 4])
  })

  it('지도가 전부 들면 비어 있다 — 같은 내용을 두 번 쌓지 않는다', () => {
    expect(offMapChoices(ds, ['answer', 'reject:1', 'reject:2', 'reject:3', 'reject:4', 'reject:5'])).toEqual([])
  })

  it('골격이 없으면(앵커 0) 전부 글이다 — 지금까지의 산문 화면 그대로', () => {
    expect(offMapChoices(ds, [])).toEqual(ds)
  })

  it('answer 앵커는 선지를 가리지 않는다 — id 를 접두사로 비교하면 ①이 사라진다', () => {
    // `reject:1` 과 `answer` 를 뭉뚱그려 비교하는 구현을 막는다.
    expect(offMapChoices([{ n: 1 }], ['answer']).map((d) => d.n)).toEqual([1])
  })

  it('없는 번호의 앵커는 아무것도 빼지 않는다', () => {
    expect(offMapChoices(ds, ['reject:9']).map((d) => d.n)).toEqual([1, 2, 3, 4, 5])
  })

  it('원래 배열을 건드리지 않고 순서를 지킨다', () => {
    const src = [{ n: 3 }, { n: 1 }, { n: 2 }]
    expect(offMapChoices(src, ['reject:1']).map((d) => d.n)).toEqual([3, 2])
    expect(src.map((d) => d.n)).toEqual([3, 1, 2])
  })
})
