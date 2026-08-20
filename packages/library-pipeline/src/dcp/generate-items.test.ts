// packages/library-pipeline/src/dcp/generate-items.test.ts
// CTP DCP T2 결정론 문항 생성 — 정합성 + 멱등 검증.

import { describe, expect, it } from 'vitest'

import { generateDcpItems, explainDcpEligibility } from './generate-items'

// 적격 문단(5문장 · 각 6단어+ · 앵커 양호) + 부적격(3문장/heading) 혼합.
const CONTENT = [
  'The global demand for food has risen sharply over the past century. Farmers responded by adopting new technologies and methods. Yields per hectare increased dramatically across most regions. Governments supported this shift with subsidies and research funding. The result was a food system optimized for volume above all else.',
  '',
  'Short heading paragraph.',
  '',
  'Consumers increasingly express concern about animal welfare standards today. Surveys across many countries show broad support for reform. Yet the products people actually buy tell a different story. Price and convenience continue to dominate everyday purchasing decisions. This gap between stated values and behaviour puzzles many researchers.',
].join('\n')

describe('generateDcpItems', () => {
  const items = generateDcpItems(CONTENT, 'test-ref')

  it('적격 문단만 문항 생성 (2문단 × order+insert = 4)', () => {
    expect(items).toHaveLength(4)
    expect(items.filter((i) => i.type === 'order')).toHaveLength(2)
    expect(items.filter((i) => i.type === 'insert')).toHaveLength(2)
  })

  it('order — presented 는 원본 문장의 순열 (source_order 로 복원 가능)', () => {
    const order = items.find((i) => i.type === 'order')!
    const presented = order.payload.presented as string[]
    const src = order.answer_key.source_order as number[]
    expect(presented).toHaveLength(5)
    expect([...src].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]) // 순열
    expect(src).not.toEqual([0, 1, 2, 3, 4]) // 항등(원래 순서) 아님
  })

  it('insert — remaining 는 1문장 빠진 나머지, position 은 유효 범위', () => {
    const ins = items.find((i) => i.type === 'insert')!
    const remaining = ins.payload.remaining as string[]
    const gapCount = ins.payload.gap_count as number
    const pos = ins.answer_key.position as number
    expect(remaining).toHaveLength(gapCount - 1)
    expect(pos).toBeGreaterThanOrEqual(1) // 첫 문장 아님(앵커 보존)
    expect(pos).toBeLessThan(gapCount)
    expect(ins.payload.insert_sentence).toBeTruthy()
  })

  it('결정론(멱등) — 같은 (content, ref) 는 항상 동일 산출', () => {
    const again = generateDcpItems(CONTENT, 'test-ref')
    expect(again).toEqual(items)
  })

  it('ref 다르면 셔플 다름 (seed 반영)', () => {
    const other = generateDcpItems(CONTENT, 'other-ref')
    const a = (items.find((i) => i.type === 'order')!.answer_key.source_order as number[]).join('')
    const b = (other.find((i) => i.type === 'order')!.answer_key.source_order as number[]).join('')
    expect(a).not.toEqual(b)
  })

  it('인용·URL 보일러플레이트 문단 배제', () => {
    const boiler =
      'This article can be cited as: Jane Doe (2026) published online at OurWorldinData.org. ' +
      'Retrieved from https://ourworldindata.org/example for the analysis here. ' +
      'The data source is licensed under Creative Commons attribution rules today. ' +
      'All rights reserved to the respective original data providers globally.'
    const only = generateDcpItems(boiler, 'boiler-ref')
    expect(only).toHaveLength(0)
  })
})

// ── 적격 진단 (실측 2026-08-18) ─────────────────────────────────────────
//
// 재저작 드레인 첫 판이 문항 0 을 냈는데, 그때는 "왜" 를 말할 방법이 없었다. 원인은
// 콘텐츠가 아니라 **줄바꿈**이었다 — 문단을 단일 개행으로 나눠 놓아 189어 글 전체가
// 한 문단(21문장)으로 잡혔다. 0 이 "안 맞음" 인지 "안 돌았음" 인지 구별되지 않으면
// 운영자는 손쓸 데가 없다.
describe('explainDcpEligibility', () => {
  it('빈 줄이 없으면 전체가 한 문단으로 잡혀 문항이 0 이 된다', () => {
    // 실측 사례: 189어 글을 단일 개행으로 나눠 놨더니 21문장 한 문단이 됐다.
    const sentences = [
      'Romania shut down its only nuclear power plant on Thursday.',
      'Hot dry weather had pushed the river far below its usual level.',
      'The plant takes water from that river to cool its reactors.',
      'It has no other source of cooling water nearby.',
      'A reactor cannot run safely without enough cooling water.',
      'So the company stopped the plant entirely that day.',
      'The station usually makes about twenty percent of the electricity.',
      'That is a large share for a single power plant.',
    ]
    const oneLinePerSentence = sentences.join('\n')
    const d = explainDcpEligibility(oneLinePerSentence)
    expect(d).toHaveLength(1)
    expect(d[0]!.sentences).toBe(sentences.length)
    // 2026-08-21 — 8문장 한 덩어리는 **순서는 못 만들지만 삽입은 만든다.**
    //   실제 수능 삽입 지문이 6~8문장이라, 상한을 10까지 열었다(재고 병목이었다).
    expect(d[0]!.order).toBe(false)
    expect(d[0]!.insert).toBe(true)
    expect(d[0]!.reason).toContain('삽입만')
    expect(generateDcpItems(oneLinePerSentence, 'ref')).toHaveLength(1)

    // 같은 문장을 빈 줄로 4+4 로 나누면 두 문단 모두 **순서·삽입 둘 다** 나온다 — 줄바꿈 하나의 차이다.
    const split = sentences.slice(0, 4).join(' ') + '\n\n' + sentences.slice(4).join(' ')
    expect(explainDcpEligibility(split).every((x) => x.eligible)).toBe(true)
    expect(generateDcpItems(split, 'ref')).toHaveLength(4)
  })

  it('빈 줄로 나누면 문단별로 판정한다', () => {
    const doc = [
      'A nuclear station needs a steady supply of cool water for its reactors.',
      'This dependence became a liability when the river fell far below its usual level.',
      'The operator had already idled one of the two reactors the previous month.',
      'On Thursday it powered down the second unit as well.',
    ].join(' ')
    const d = explainDcpEligibility(doc + '\n\n' + doc)
    expect(d).toHaveLength(2)
    expect(d.every((x) => x.eligible)).toBe(true)
    expect(generateDcpItems(doc + '\n\n' + doc, 'ref').length).toBe(4)
  })

  it('사유는 실제 생성 결과와 어긋나지 않는다', () => {
    // 규칙을 두 번 적으면 갈린다 — 진단이 적격이라고 한 문단 수 × 2 가 문항 수여야 한다.
    const docs = [
      'Alpha beta gamma delta epsilon zeta.\n\nOne two three four five six seven.',
      'A nuclear station needs a steady supply of cool water for its reactors. This dependence became a liability when the river fell far below its usual level. The operator had already idled one of the two reactors the previous month. On Thursday it powered down the second unit as well.',
      'It has no other source of cooling water at all. The plant takes water from that river to cool its reactors. A reactor cannot run safely without enough cooling water. So the company stopped the plant entirely on Thursday.',
    ]
    for (const doc of docs) {
      const eligible = explainDcpEligibility(doc).filter((d) => d.eligible).length
      expect(generateDcpItems(doc, 'seed').length).toBe(eligible * 2)
    }
  })
})
