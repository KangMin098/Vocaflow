// apps/web/src/lib/knowledge/live-chain.ts
// 채택 사슬 판정(순수 · 2026-10-08 Phase 3) — 학습자 노출 게이트 · 관리자 추적 · 재검토 전파가 같은 규칙을 쓴다.
//
// 사슬 = 실행 과제(practice) → 방법(method) → 처리 기제(principle) — `implements` 연결을 위로 따라간다.
// 학습자에게 내보내려면 사슬의 **모든 층**이 채택(adopted) 또는 적용 중(applied)이어야 한다.
// 본질(essence)은 묶음 표지라 노출 조건이 아니다(관리자 추적에는 보인다).
// 위 층이 재검토로 가면 아래 층도 판단 근거가 흔들린 것이다 — cascadeTargets 가 그 아래 층을 고른다.

export type ChainLayer = 'essence' | 'principle' | 'method' | 'practice'
export interface ChainItem {
  id: string
  slug: string
  title: string
  layer: ChainLayer
  kind: string | null
  status: string
  version: number
  efficacy: string
}
export interface ChainLink {
  from_id: string
  to_id: string
  kind: string
}

export const LIVE_STATUSES = ['adopted', 'applied'] as const
export const isLive = (status: string) => (LIVE_STATUSES as readonly string[]).includes(status)
const REQUIRED: readonly ChainLayer[] = ['practice', 'method', 'principle']

export interface ChainBreak {
  layer: ChainLayer
  slug: string | null
  reason: string
}
export interface ChainVerdict {
  live: boolean
  /** 과제 → 방법 → 기제 → 본질 순서(층마다 첫 상위 하나) */
  path: ChainItem[]
  breaks: ChainBreak[]
}

/** 과제 항목에서 위로 — 층마다 implements 상위 하나(여럿이면 살아 있는 것 우선, 그다음 slug 순) */
export function resolveChain(taskId: string, items: readonly ChainItem[], links: readonly ChainLink[]): ChainVerdict {
  const byId = new Map(items.map((i) => [i.id, i]))
  const path: ChainItem[] = []
  const breaks: ChainBreak[] = []
  let cur = byId.get(taskId) ?? null
  if (!cur) return { live: false, path, breaks: [{ layer: 'practice', slug: null, reason: '과제 항목이 없다' }] }
  if (cur.layer !== 'practice') breaks.push({ layer: 'practice', slug: cur.slug, reason: '적용 항목이 실행 과제(practice)가 아니다' })
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    path.push(cur)
    const ups = links
      .filter((l) => l.kind === 'implements' && l.from_id === cur!.id)
      .map((l) => byId.get(l.to_id))
      .filter((x): x is ChainItem => !!x)
      .sort((a, b) => Number(isLive(b.status)) - Number(isLive(a.status)) || a.slug.localeCompare(b.slug))
    cur = ups[0] ?? null
  }
  for (const layer of REQUIRED) {
    const it = path.find((p) => p.layer === layer)
    if (!it) breaks.push({ layer, slug: null, reason: `${layer} 층 연결이 없다` })
    else if (!isLive(it.status)) breaks.push({ layer, slug: it.slug, reason: `채택 전 상태(${it.status})` })
  }
  return { live: breaks.length === 0, path, breaks }
}

/** 이 항목이 재검토 · 반려되거나 문장이 바뀌면 다시 봐야 하는 아래 층 — implements 를 아래로, 지금 살아 있는 것만 */
export function cascadeTargets(itemId: string, items: readonly ChainItem[], links: readonly ChainLink[]): ChainItem[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const out: ChainItem[] = []
  const seen = new Set<string>([itemId])
  const queue = [itemId]
  while (queue.length) {
    const id = queue.shift()!
    for (const l of links) {
      if (l.kind !== 'implements' || l.to_id !== id || seen.has(l.from_id)) continue
      seen.add(l.from_id)
      queue.push(l.from_id)
      const child = byId.get(l.from_id)
      if (child && isLive(child.status)) out.push(child)
    }
  }
  return out
}
