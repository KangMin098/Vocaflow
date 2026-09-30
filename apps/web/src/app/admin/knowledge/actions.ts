// apps/web/src/app/admin/knowledge/actions.ts
// 학습 원리 등록부 Server Actions — 상태 변경 · 항목 작성 · 층 연결 · 근거 연결.
// knowledge_* 는 service_role 전용이라 requireAdmin 으로 사람을 확인한 뒤 관리자 클라이언트로 쓴다.
// 상태 전이 기록은 DB 트리거(knowledge_items_track)가 남긴다 — 여기서 따로 쓰지 않는다.

'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { isLayer, isStatus, type ItemStatus } from '@/lib/knowledge/labels'
import {
  checkExternalEvidence,
  checkImplements,
  checkNewItem,
  checkTaxonomyIds,
  checkTransition,
  type NewItemInput,
} from '@/lib/knowledge/rules'
import { listTaxonomy } from '@/lib/knowledge/server'

export interface ActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

const LINK_KINDS = ['implements', 'contrasts', 'complements', 'condition_variant', 'duplicate_candidate'] as const

/** 동시 저장에서 진 쪽이 보는 문장 — 화면도움말(knowledge-item cautions)이 같은 문장을 인용한다. */
const STALE_STATUS_ERROR = '그 사이 다른 사람이 상태를 바꿨습니다 — 새로 고친 뒤 다시 판단하세요'

function db(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

async function actor(path: string): Promise<string> {
  const admin = await requireAdmin(path)
  return admin.email ?? admin.id
}

function refresh(slug?: string) {
  revalidatePath('/admin/knowledge', 'layout')
  if (slug) revalidatePath(`/admin/knowledge/item/${slug}`)
}

function message(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

async function evidenceCount(client: SupabaseClient, itemId: string): Promise<number> {
  const { count, error } = await client
    .from('knowledge_evidence')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', itemId)
  // count ?? 0 금지 — 셀 수 없으면 채택을 막는 쪽으로 실패한다
  if (error || count === null) throw new Error('근거 수를 세지 못했습니다')
  return count
}

export async function setItemStatusAction(
  itemId: string,
  to: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge/review')
    if (!isStatus(to)) return { ok: false, error: '알 수 없는 상태입니다' }
    const client = db()
    const { data: item, error } = await client
      .from('knowledge_items')
      .select('status,slug')
      .eq('id', itemId)
      .single()
    if (error || !item) return { ok: false, error: '항목을 찾지 못했습니다' }
    const from = item.status as ItemStatus
    const rule = checkTransition({ from, to, reason, evidenceCount: await evidenceCount(client, itemId) })
    if (!rule.ok) return rule
    const { data: changed, error: e2 } = await client
      .from('knowledge_items')
      .update({ status: to, status_reason: reason.trim() || null, updated_by: who })
      .eq('id', itemId)
      .eq('status', from) // 그 사이 다른 사람이 바꿨으면 덮지 않는다
      .select('id')
    if (e2) return { ok: false, error: `저장 실패: ${e2.message}` }
    // 조건부 UPDATE 는 0행이어도 오류가 없다 — 바뀐 행이 없으면 성공이라고 말하지 않는다
    if (!changed || changed.length === 0) {
      return { ok: false, error: STALE_STATUS_ERROR }
    }
    refresh(String(item.slug))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '상태 변경 실패') }
  }
}

export async function createItemAction(input: NewItemInput): Promise<ActionResult<{ slug: string }>> {
  try {
    const who = await actor('/admin/knowledge')
    if (!isLayer(input.layer)) return { ok: false, error: '알 수 없는 층입니다' }
    const rule = checkNewItem(input)
    if (!rule.ok) return rule
    // 분류 ID 는 클라이언트를 믿지 않는다 — 최신 스냅샷 분류에 실제로 있고 차원이 맞는지 서버에서 본다
    const taxonomyRule = checkTaxonomyIds(input.skillIds, input.conditionIds, await listTaxonomy())
    if (!taxonomyRule.ok) return taxonomyRule
    const { error } = await db()
      .from('knowledge_items')
      .insert({
        layer: input.layer,
        slug: input.slug,
        title: input.title.trim(),
        statement: input.statement.trim(),
        skill_ids: input.skillIds,
        condition_ids: input.conditionIds,
        // 사람이 쓴 항목은 곧바로 검토 중 — 「추출됨」은 드레인 몫이다
        status: 'in_review',
        created_by: who,
        updated_by: who,
      })
    if (error) {
      return { ok: false, error: error.code === '23505' ? '같은 주소 이름이 이미 있습니다' : `저장 실패: ${error.message}` }
    }
    refresh(input.slug)
    return { ok: true, data: { slug: input.slug } }
  } catch (e) {
    return { ok: false, error: message(e, '항목 작성 실패') }
  }
}

export async function addLinkAction(
  fromId: string,
  toId: string,
  kind: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge')
    if (!(LINK_KINDS as readonly string[]).includes(kind)) return { ok: false, error: '알 수 없는 연결 종류입니다' }
    if (reason.trim().length === 0) return { ok: false, error: '연결 이유가 필요합니다' }
    if (fromId === toId) return { ok: false, error: '자기 자신과는 잇지 않습니다' }
    const client = db()
    const { data: rows, error } = await client.from('knowledge_items').select('id,layer,slug').in('id', [fromId, toId])
    if (error || rows?.length !== 2) return { ok: false, error: '항목을 찾지 못했습니다' }
    const from = rows.find((r) => r.id === fromId)!
    const to = rows.find((r) => r.id === toId)!
    if (kind === 'implements' && isLayer(from.layer) && isLayer(to.layer)) {
      const rule = checkImplements(from.layer, to.layer)
      if (!rule.ok) return rule
    }
    const { error: e2 } = await client
      .from('knowledge_links')
      .insert({ from_id: fromId, to_id: toId, kind, reason: reason.trim(), created_by: who })
    if (e2) return { ok: false, error: e2.code === '23505' ? '이미 같은 연결이 있습니다' : `저장 실패: ${e2.message}` }
    refresh(String(from.slug))
    refresh(String(to.slug))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '연결 실패') }
  }
}

export async function addExternalEvidenceAction(input: {
  itemId: string
  grade: string
  attribution: string
  url: string
  title: string
  locator: string
  note: string
}): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge')
    if (!['A', 'B', 'C'].includes(input.grade)) return { ok: false, error: '등급은 A·B·C 중 하나입니다' }
    if (!['stated', 'inferred'].includes(input.attribution)) return { ok: false, error: '귀속을 고르세요' }
    const rule = checkExternalEvidence(input)
    if (!rule.ok) return rule
    const client = db()
    const { data: item } = await client.from('knowledge_items').select('slug').eq('id', input.itemId).single()
    const { error } = await client.from('knowledge_evidence').insert({
      item_id: input.itemId,
      grade: input.grade,
      attribution: input.attribution,
      source_type: 'external',
      external_url: input.url,
      external_title: input.title.trim(),
      locator: input.locator.trim() || null,
      note: input.note.trim() || null,
      created_by: who,
    })
    if (error) return { ok: false, error: `저장 실패: ${error.message}` }
    refresh(item ? String(item.slug) : undefined)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '근거 연결 실패') }
  }
}

/** 기출 원천을 근거로 — 등급은 원천의 등급을 그대로 쓴다. 미확인(G)은 근거가 될 수 없다. */
export async function addCsatEvidenceAction(input: {
  itemId: string
  passageSha256: string
  attribution: string
  note: string
}): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge')
    if (!['stated', 'inferred'].includes(input.attribution)) return { ok: false, error: '귀속을 고르세요' }
    const client = db()
    const { data: origin, error } = await client
      .from('knowledge_csat_origins')
      .select('grade')
      .eq('passage_sha256', input.passageSha256)
      .single()
    if (error || !origin) return { ok: false, error: '기출 원천을 찾지 못했습니다' }
    if (origin.grade === 'G') return { ok: false, error: '미확인(G) 원천은 근거로 쓸 수 없습니다' }
    const { data: item } = await client.from('knowledge_items').select('slug').eq('id', input.itemId).single()
    const { error: e2 } = await client.from('knowledge_evidence').insert({
      item_id: input.itemId,
      grade: origin.grade,
      attribution: input.attribution,
      source_type: 'csat_origin',
      csat_passage_sha256: input.passageSha256,
      note: input.note.trim() || null,
      created_by: who,
    })
    if (e2) return { ok: false, error: `저장 실패: ${e2.message}` }
    refresh(item ? String(item.slug) : undefined)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '근거 연결 실패') }
  }
}
