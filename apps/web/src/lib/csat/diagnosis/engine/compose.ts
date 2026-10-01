// apps/web/src/lib/csat/diagnosis/engine/compose.ts
//
// 진단 테스트 출제 — 순수 함수(seed 를 받아 결정적). 서버 페이지가 풀을 읽어 넘긴다.

import type { ItemMeta } from './types'

/** 진단 테스트 출제 — 역량이 고르게 덮이도록 풀에서 고른다(라운드로빈 · 결정적 순서) */
export function composeDiagnosticTest(pool: ItemMeta[], size: number, seed: number): string[] {
  const rng = mulberry32(seed)
  const shuffled = [...pool].sort((a, b) => a.itemId.localeCompare(b.itemId))
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const covered: Record<string, number> = {}
  const picked: ItemMeta[] = []
  const rest = [...shuffled]
  while (picked.length < size && rest.length > 0) {
    // 지금까지 가장 덜 덮인 역량을 가장 많이 덮는 문항
    let best = 0
    let bestScore = -Infinity
    rest.forEach((m, i) => {
      const score = Object.entries(m.attributes).reduce((s, [a, w]) => s + (w ?? 0) / (1 + (covered[a] ?? 0)), 0)
      if (score > bestScore) { bestScore = score; best = i }
    })
    const [m] = rest.splice(best, 1)
    picked.push(m)
    for (const [a, w] of Object.entries(m.attributes)) covered[a] = (covered[a] ?? 0) + (w ?? 0)
  }
  return picked.map((m) => m.itemId)
}

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

