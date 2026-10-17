// apps/web/src/lib/csat/map/v62/factory-bridge/lineage.ts
//
// I0-5 — 수요 줄 ↔ 생산 주문 ↔ 실행(cell) ↔ 산출물 N:M 계보 검증(순수 · CONTRACT_ONLY).
// 공장 정본(663f2eee8 order-production-run.ts)이 실제로 주는 값만 쓴다: product_order_id · order_revision · order_hash · cell_id · cell_hash
// · drain_hash(run 식별 — 공장에 runId 필드는 없다) · lineage[](passage_hash · unit_hash · item_ids). 산출물 검수 통과는 공급 승인이 아니다.

export interface OrderRef { productOrderId: string; orderRevision: number; orderHash: string }
export interface CellRef extends OrderRef { cellId: string; cellHash: string; grade: string; day: number }
export interface RunRef { drainHash: string; manifestHash: string | null; cells: CellRef[] }
export interface ArtifactRef { id: string; kind: 'passage' | 'item' | 'explanation' | 'unit' | 'volume'; hash: string; cellId: string; productOrderId: string; orderRevision: number; orderHash: string }
/** 수요 요청 ↔ 주문 연결 한 줄 — 여러 요청이 한 주문을, 한 요청이 여러 주문을 가리킬 수 있다 */
export interface DemandOrderLink { requestId: string; shareKey: string; order: OrderRef }

const HEX64 = /^[0-9a-f]{64}$/

/** 공장 cell_id 형식 — `${product_order_id}:r${order_revision}:d${day}` */
export const cellIdOf = (o: OrderRef, day: number) => `${o.productOrderId}:r${o.orderRevision}:d${day}`

export function verifyLineage(links: readonly DemandOrderLink[], run: RunRef, artifacts: readonly ArtifactRef[]): { ok: boolean; errors: string[]; supplyApproved: false; verification: 'STRUCTURAL_ONLY'; contentVerified: false } {
  const errors: string[] = []
  const id = (s: string) => typeof s === 'string' && s.trim().length > 0
  const positive = (n: number) => Number.isSafeInteger(n) && n > 0
  if (!links.length || !run.cells.length) errors.push('lineage_empty')
  const orders = new Map(links.map((l) => [`${l.order.productOrderId}#${l.order.orderRevision}`, l.order]))
  for (const l of links) {
    if (!id(l.requestId) || !id(l.shareKey) || !id(l.order.productOrderId) || !positive(l.order.orderRevision)) errors.push('order_identity_invalid')
    if (!HEX64.test(l.order.orderHash)) errors.push(`order_hash_invalid:${l.requestId}`)
  }
  // 같은 주문 revision 이 다른 해시로 두 번 나오면 결속이 깨진 것
  for (const l of links) { const o = orders.get(`${l.order.productOrderId}#${l.order.orderRevision}`)!; if (o.orderHash !== l.order.orderHash) errors.push(`order_hash_conflict:${l.order.productOrderId}`) }
  if (!HEX64.test(run.drainHash)) errors.push('drain_hash_invalid')
  if (run.manifestHash !== null && !HEX64.test(run.manifestHash)) errors.push('manifest_hash_invalid')
  const cells = new Map<string, CellRef>()
  for (const c of run.cells) {
    if (!positive(c.day) || !positive(c.orderRevision) || !id(c.grade)) errors.push(`cell_identity_invalid:${c.cellId}`)
    if (cells.has(c.cellId)) errors.push(`cell_duplicate:${c.cellId}`)
    cells.set(c.cellId, c)
    const o = orders.get(`${c.productOrderId}#${c.orderRevision}`)
    if (!o) errors.push(`cell_foreign_order:${c.cellId}`)
    else if (o.orderHash !== c.orderHash) errors.push(`cell_stale_order:${c.cellId}`)
    if (c.cellId !== cellIdOf(c, c.day)) errors.push(`cell_id_shape:${c.cellId}`)
    if (!HEX64.test(c.cellHash)) errors.push(`cell_hash_invalid:${c.cellId}`)
  }
  const artifactIds = new Set<string>()
  for (const a of artifacts) {
    if (!id(a.id) || artifactIds.has(a.id)) errors.push(`artifact_duplicate_or_invalid:${a.id}`)
    artifactIds.add(a.id)
    const c = cells.get(a.cellId)
    if (!c) { errors.push(`artifact_without_cell:${a.id}`); continue }
    if (a.productOrderId !== c.productOrderId || a.orderRevision !== c.orderRevision || a.orderHash !== c.orderHash) errors.push(`artifact_order_mismatch:${a.id}`)
    if (!HEX64.test(a.hash)) errors.push(`artifact_hash_invalid:${a.id}`)
  }
  // 산출물이 검수돼도 공급 승인은 별도(content_release_approval) — 이 함수는 언제나 false
  return { ok: errors.length === 0, errors, supplyApproved: false, verification: 'STRUCTURAL_ONLY', contentVerified: false }
}
