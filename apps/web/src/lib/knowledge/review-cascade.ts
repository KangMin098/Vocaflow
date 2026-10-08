// apps/web/src/lib/knowledge/review-cascade.ts
// 재검토 전파(Phase 3 · 2026-10-08) — Server Action 들이 함께 쓴다. 'use server' 파일 밖에 둔다(거기서 export 하면
// 인증 없이 부를 수 있는 액션이 된다). 호출하는 쪽이 requireAdmin 을 먼저 통과한 뒤에만 부른다.
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { cascadeTargets, isLive } from './live-chain'
import { loadChainGraph } from './product-server'

/**
 * 재검토 전파(Phase 3 · 2026-10-08) — 위 층이 재검토 · 반려로 가거나 문장이 바뀌면, 그 항목을 구현하는 아래 층 중
 * 채택 · 적용 중인 것을 모두 「검토 중」으로 돌린다. 각 항목이 검토 중으로 가면 DB 트리거가 그 항목의 active 적용을
 * 자동 중단한다(knowledge_items_pause_applications) — 학습자 화면에서 내려간다. 조건부 UPDATE(상태가 그대로일 때만).
 * 돌려준 값 = 실제로 돌린 항목 slug.
 */
export async function cascadeReview(client: SupabaseClient, itemId: string, why: string, who: string, refresh: (slug?: string) => void): Promise<string[]> {
  const graph = await loadChainGraph(client)
  const done: string[] = []
  for (const child of cascadeTargets(itemId, graph.items, graph.links)) {
    const { data, error } = await client
      .from('knowledge_items')
      .update({ status: 'in_review', status_reason: why, updated_by: who })
      .eq('id', child.id)
      // 읽은 상태가 아니라 「지금 살아 있으면」 — 그 사이 adopted → applied 로 바뀌어도 빠지지 않게(Codex P1)
      .in('status', ['adopted', 'applied'])
      .select('slug')
    if (error) throw new Error(`재검토 전파 실패(${child.slug}): ${error.message}`)
    if (data?.length) { done.push(child.slug); refresh(child.slug) }
  }
  return done
}


/**
 * 근거가 바뀌었다(추가 · 축 변경 · 철회) — 채택 · 적용 중인 항목은 채택 판단의 근거 집합이 달라졌으므로 「검토 중」으로 돌리고
 * 아래 층에 전파한다. 살아 있지 않은 항목(검토 중 · 추출됨)은 그대로 — 아직 판단 전이다.
 */
export async function reviewAfterEvidenceChange(client: SupabaseClient, itemId: string, what: string, who: string, refresh: (slug?: string) => void): Promise<string[]> {
  const { data: item, error } = await client.from('knowledge_items').select('slug,status').eq('id', itemId).single()
  if (error || !item) throw new Error('근거가 바뀐 항목을 찾지 못했다')
  if (!isLive(String(item.status))) return []
  const { data, error: e2 } = await client
    .from('knowledge_items')
    .update({ status: 'in_review', status_reason: `${what} — 채택 근거 집합이 바뀌었다(재검토)`, updated_by: who })
    .eq('id', itemId)
    .in('status', ['adopted', 'applied'])
    .select('id')
  if (e2) throw new Error(`재검토 전환 실패: ${e2.message}`)
  if (!data?.length) return []
  refresh(String(item.slug))
  return [String(item.slug), ...(await cascadeReview(client, itemId, `상위 「${item.slug}」 ${what} — 연쇄 재검토`, who, refresh))]
}

/** 변경 **전에** 부른다 — 지금 살아 있는 아래 층(재검토 대상 후보). DB 트리거(20261008140000)가 먼저 전파해도 보고할 목록을 잃지 않게 */
export async function liveDescendants(client: SupabaseClient, itemId: string): Promise<{ id: string; slug: string }[]> {
  const graph = await loadChainGraph(client)
  return cascadeTargets(itemId, graph.items, graph.links).map((i) => ({ id: i.id, slug: i.slug }))
}

/** 변경 뒤 — 후보 중 실제로 살아 있지 않게 된 것(DB 트리거든 앱 전파든) */
export async function reviewedNow(client: SupabaseClient, before: { id: string; slug: string }[]): Promise<string[]> {
  if (before.length === 0) return []
  const { data, error } = await client.from('knowledge_items').select('id, status').in('id', before.map((b) => b.id))
  if (error) throw new Error(`전파 결과 확인 실패: ${error.message}`)
  const dead = new Set((data ?? []).filter((r) => !isLive(String(r.status))).map((r) => String(r.id)))
  return before.filter((b) => dead.has(b.id)).map((b) => b.slug)
}
