// packages/library-pipeline/src/dcp/generate-items.test.ts
// CTP DCP T2 결정론 문항 생성 — 정합성 + 멱등 검증.

import { describe, expect, it } from 'vitest'

import { generateDcpItems } from './generate-items'

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
