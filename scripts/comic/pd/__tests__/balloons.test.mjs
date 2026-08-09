// scripts/comic/pd/__tests__/balloons.test.mjs
//
// 말풍선 영역 검출 회귀.
//
// 이 층이 있는 이유가 곧 테스트할 사실이다 — OCR 텍스트 박스를 그대로 지우면
// 말풍선 하나가 조각 여럿으로 잡혀 사이에 글자가 남고, 남은 흔적을 생성 모델이
// "글자 비슷한 것"으로 재현한다(실측: Classics Illustrated #27 캡션 1개 = 6조각).
//
// 이미지 없이 검증 가능한 부분(박스 병합·후퇴 규칙)을 여기서 고정한다.
// 실제 이미지 검출은 GPU 도, 고정 표본도 필요해 CLI `--erase-only` 로 사람이 눈으로 본다.

import { describe, expect, it } from 'vitest'

import { mergeOverlaps } from '../balloons.mjs'

const box = (x, y, w, h, via = 'balloon') => ({ x, y, w, h, via })

describe('mergeOverlaps', () => {
  it('겹치는 박스를 하나로 합친다', () => {
    const out = mergeOverlaps([box(0.1, 0.1, 0.2, 0.2), box(0.2, 0.2, 0.2, 0.2)])
    expect(out).toHaveLength(1)
    expect(out[0].x).toBeCloseTo(0.1)
    expect(out[0].y).toBeCloseTo(0.1)
    expect(out[0].w).toBeCloseTo(0.3)
    expect(out[0].h).toBeCloseTo(0.3)
  })

  it('떨어진 박스는 합치지 않는다 — 나란한 두 말풍선이 하나로 뭉치면 안 된다', () => {
    const out = mergeOverlaps([box(0.0, 0.0, 0.2, 0.2), box(0.5, 0.0, 0.2, 0.2)])
    expect(out).toHaveLength(2)
  })

  it('세 조각이 사슬로 이어지면 하나로 — 캡션 한 줄씩 잡힌 경우', () => {
    const out = mergeOverlaps([
      box(0.10, 0.80, 0.30, 0.04),
      box(0.35, 0.82, 0.30, 0.04),
      box(0.60, 0.83, 0.25, 0.04),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].x).toBeCloseTo(0.10)
    expect(out[0].x + out[0].w).toBeCloseTo(0.85)
  })

  it('하나라도 실제 풍선이면 합친 결과도 풍선으로 본다', () => {
    const out = mergeOverlaps([
      box(0.1, 0.1, 0.2, 0.2, 'text-fallback'),
      box(0.2, 0.2, 0.2, 0.2, 'balloon'),
    ])
    expect(out[0].via).toBe('balloon')
  })

  it('둘 다 후퇴면 후퇴로 남는다 — 검수에서 "풍선 못 찾음"이 보여야 한다', () => {
    const out = mergeOverlaps([
      box(0.1, 0.1, 0.2, 0.2, 'text-fallback'),
      box(0.2, 0.2, 0.2, 0.2, 'text-fallback'),
    ])
    expect(out[0].via).toBe('text-fallback')
  })

  it('빈 입력에도 터지지 않는다', () => {
    expect(mergeOverlaps([])).toEqual([])
  })

  it('원본 배열을 건드리지 않는다', () => {
    const input = [box(0.1, 0.1, 0.2, 0.2), box(0.2, 0.2, 0.2, 0.2)]
    const snapshot = JSON.stringify(input)
    mergeOverlaps(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})
