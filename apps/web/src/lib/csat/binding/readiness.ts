// apps/web/src/lib/csat/binding/readiness.ts
// 유형별 실제 콘텐츠 준비도 — 결속된 문항(BoundItem)을 세어 「근거 결속을 쓸 수 있는 문항 수」와 막는 이유를 낸다.
// 상수 없이 매번 데이터에서 계산한다(I5). ready 는 block 등급 이유가 하나도 없는 문항이다.
import { D_TOOL_TYPES, type BoundItem } from './adapter'
import { BLOCK_SEVERITY, type BlockReason } from './types'

export type TypeReadiness = {
  typeId: string
  total: number
  ready: number
  /** D 판단 도구에 넘길 수 있는 문항(ready + 단일 정답) — D 도구가 없는 유형은 null */
  toolReady: number | null
  blocked: Partial<Record<BlockReason, number>>
  warned: Partial<Record<BlockReason, number>>
  /** 차단 이유별 대표 문항 3개 — 리포트에서 바로 열어 보게 */
  examples: Partial<Record<BlockReason, string[]>>
}

export const isBlocking = (r: BlockReason) => BLOCK_SEVERITY[r] === 'block'

export function itemReady(b: BoundItem): boolean {
  return !b.reasons.some(isBlocking)
}

export function readinessByType(items: BoundItem[]): TypeReadiness[] {
  const by = new Map<string, TypeReadiness>()
  for (const b of items) {
    const t = b.typeId ?? '(유형 없음)'
    const r = by.get(t) ?? { typeId: t, total: 0, ready: 0, toolReady: D_TOOL_TYPES.has(t) ? 0 : null, blocked: {}, warned: {}, examples: {} }
    r.total += 1
    const ready = itemReady(b)
    if (ready) r.ready += 1
    if (ready && r.toolReady != null && !b.answer.multiple) r.toolReady += 1
    for (const reason of b.reasons) {
      const bucket = isBlocking(reason) ? r.blocked : r.warned
      bucket[reason] = (bucket[reason] ?? 0) + 1
      const ex = (r.examples[reason] ??= [])
      if (ex.length < 3) ex.push(b.id)
    }
    by.set(t, r)
  }
  return [...by.values()].sort((a, b) => a.typeId.localeCompare(b.typeId))
}

export function totals(rows: TypeReadiness[]): { total: number; ready: number; toolReady: number; blocked: Partial<Record<BlockReason, number>>; warned: Partial<Record<BlockReason, number>> } {
  const blocked: Partial<Record<BlockReason, number>> = {}
  const warned: Partial<Record<BlockReason, number>> = {}
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.blocked)) blocked[k as BlockReason] = (blocked[k as BlockReason] ?? 0) + (v ?? 0)
    for (const [k, v] of Object.entries(r.warned)) warned[k as BlockReason] = (warned[k as BlockReason] ?? 0) + (v ?? 0)
  }
  return {
    total: rows.reduce((s, r) => s + r.total, 0),
    ready: rows.reduce((s, r) => s + r.ready, 0),
    toolReady: rows.reduce((s, r) => s + (r.toolReady ?? 0), 0),
    blocked,
    warned,
  }
}
