// apps/web/src/lib/csat/map/graph.ts
//
// 학습 지도 그래프 — 선택한 노드의 연결 경로(강조할 노드 · 연결선)를 구한다. 순수 함수.
// 모든 연결선은 왼쪽 → 오른쪽(목표 → 영역 → 라인 → 원리 → 트랙)이라, 경로 = 상류(왼쪽)로 가는 조상 + 하류(오른쪽)로 가는 자손.
// 형제(같은 영역의 다른 라인 등)는 경로가 아니므로 흐리게 남는다.

export interface GraphEdge {
  id: number
  from: string
  to: string
}

export interface Path {
  nodes: Set<string>
  edges: Set<number>
}

export function pathOf(selected: string, edges: GraphEdge[]): Path {
  const out = new Map<string, GraphEdge[]>()
  const into = new Map<string, GraphEdge[]>()
  for (const e of edges) {
    ;(out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e)
    ;(into.get(e.to) ?? into.set(e.to, []).get(e.to)!).push(e)
  }
  const nodes = new Set<string>([selected])
  const picked = new Set<number>()
  const walk = (start: string, next: Map<string, GraphEdge[]>, other: (e: GraphEdge) => string) => {
    const seen = new Set<string>([start])
    const stack = [start]
    while (stack.length > 0) {
      const cur = stack.pop() as string
      for (const e of next.get(cur) ?? []) {
        picked.add(e.id)
        const n = other(e)
        nodes.add(n)
        if (!seen.has(n)) {
          seen.add(n)
          stack.push(n)
        }
      }
    }
  }
  walk(selected, out, (e) => e.to) // 하류 — 오른쪽
  walk(selected, into, (e) => e.from) // 상류 — 왼쪽
  return { nodes, edges: picked }
}
