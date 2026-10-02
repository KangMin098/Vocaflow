// apps/web/src/lib/csat/map/__tests__/graph.test.ts

import { describe, expect, it } from 'vitest'

import { pathOf, type GraphEdge } from '../graph'

// GOAL → A → A1 → P1 → T1 · GOAL → B → B1 → P1 · A1 → P2 → T2
const E: GraphEdge[] = [
  { id: 1, from: 'GOAL', to: 'A' },
  { id: 2, from: 'GOAL', to: 'B' },
  { id: 3, from: 'A', to: 'A1' },
  { id: 4, from: 'B', to: 'B1' },
  { id: 5, from: 'A1', to: 'P1' },
  { id: 6, from: 'B1', to: 'P1' },
  { id: 7, from: 'A1', to: 'P2' },
  { id: 8, from: 'P1', to: 'T1' },
  { id: 9, from: 'P2', to: 'T2' },
]

describe('pathOf', () => {
  it('라인을 고르면 상류(영역 · 목표)와 하류(원리 · 트랙)만 — 형제 라인은 제외', () => {
    const p = pathOf('A1', E)
    expect([...p.nodes].sort()).toEqual(['A', 'A1', 'GOAL', 'P1', 'P2', 'T1', 'T2'])
    expect(p.nodes.has('B1')).toBe(false)
    expect([...p.edges].sort((a, b) => a - b)).toEqual([1, 3, 5, 7, 8, 9])
  })

  it('원리를 고르면 그 원리를 쓰는 모든 라인과 영역 · 목표, 그리고 트랙', () => {
    const p = pathOf('P1', E)
    expect([...p.nodes].sort()).toEqual(['A', 'A1', 'B', 'B1', 'GOAL', 'P1', 'T1'])
    expect(p.nodes.has('P2')).toBe(false)
  })

  it('목표를 고르면 전체 하류', () => {
    expect(pathOf('GOAL', E).nodes.size).toBe(9) // 노드 전부(GOAL · A · B · A1 · B1 · P1 · P2 · T1 · T2)
  })

  it('연결이 없는 노드는 자기 자신만', () => {
    const p = pathOf('X', E)
    expect([...p.nodes]).toEqual(['X'])
    expect(p.edges.size).toBe(0)
  })
})
