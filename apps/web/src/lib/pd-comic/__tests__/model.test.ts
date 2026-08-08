// apps/web/src/lib/pd-comic/__tests__/model.test.ts
//
// PDCP 공용 모델 회귀.
//
// 여기서 지키려는 사실 두 가지:
//   ① 단계 목록은 드레인 전이표와 **같은 순서**여야 한다. 어긋나면 stepper 가
//      실제 진행과 다른 칸을 켜고, 운영자가 "멈췄다/진행 중"을 오판한다.
//   ② `stageIndex` 는 모르는 상태에 -1 을 준다. 0(대기)으로 뭉개면 실패·보관 같은
//      비단계 상태가 정상 대기처럼 보인다(실제로 그렇게 뭉개져 있었다).

import { describe, expect, it } from 'vitest'

import { PD_STAGES, stageIndex } from '../model'

/** 드레인 라우트(app/api/pdcp/drain)의 전이표와 손으로 맞춘 사본 — 어긋나면 여기서 깨진다. */
const DRAIN_TRANSITIONS: Array<[string, string]> = [
  ['queued', 'acquired'],
  ['acquired', 'restored'],
  ['restored', 'segmented'],
  ['segmented', 'ocr'],
  ['ocr', 'review'],
]

describe('PD_STAGES', () => {
  it('취득 전 대기 상태부터 발행까지 7단계', () => {
    expect(PD_STAGES.map((s) => s.key)).toEqual([
      'queued',
      'acquired',
      'restored',
      'segmented',
      'ocr',
      'review',
      'published',
    ])
  })

  it('모든 단계에 한국어 라벨이 있다', () => {
    for (const s of PD_STAGES) expect(s.label.trim().length).toBeGreaterThan(0)
  })

  it('키가 중복되지 않는다 (중복 시 stepper 칩이 두 번 그려진다)', () => {
    expect(new Set(PD_STAGES.map((s) => s.key)).size).toBe(PD_STAGES.length)
  })

  it('드레인 전이표의 각 단계가 바로 다음 단계로 이어진다', () => {
    for (const [from, to] of DRAIN_TRANSITIONS) {
      expect(stageIndex(to), `${from} → ${to}`).toBe(stageIndex(from) + 1)
    }
  })

  it('드레인 대상은 published 를 뺀 앞 단계들과 정확히 일치한다', () => {
    const drainable = DRAIN_TRANSITIONS.map(([from]) => from)
    expect(drainable).toEqual(PD_STAGES.slice(0, -2).map((s) => s.key))
  })
})

describe('stageIndex', () => {
  it('단계 키를 순서 인덱스로 돌려준다', () => {
    expect(stageIndex('queued')).toBe(0)
    expect(stageIndex('ocr')).toBe(4)
    expect(stageIndex('published')).toBe(PD_STAGES.length - 1)
  })

  it('단계가 아닌 상태는 -1 — 0 으로 뭉개지 않는다', () => {
    expect(stageIndex('failed')).toBe(-1)
    expect(stageIndex('archived')).toBe(-1)
    expect(stageIndex('')).toBe(-1)
  })
})
