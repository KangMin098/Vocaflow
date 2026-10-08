// apps/web/src/app/admin/knowledge/actions.ts
// 학습 원리 등록부 Server Actions — 상태 변경 · 항목 작성 · 층 연결 · 근거 연결.
// knowledge_* 는 service_role 전용이라 requireAdmin 으로 사람을 확인한 뒤 관리자 클라이언트로 쓴다.
// 상태 전이 기록은 DB 트리거(knowledge_items_track)가 남긴다 — 여기서 따로 쓰지 않는다.

'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAttribution, isLayer, isStatus, type ItemStatus } from '@/lib/knowledge/labels'
import {
  checkExternalEvidence,
  checkImplements,
  checkNewItem,
  checkTaxonomyIds,
  checkTransition,
  type NewItemInput,
} from '@/lib/knowledge/rules'
import { listTaxonomy } from '@/lib/knowledge/server'
import { KINDS_BY_LAYER, isKind } from '@/lib/knowledge/vnext-labels'
import { isLive } from '@/lib/knowledge/live-chain'
import { cascadeReview, reviewAfterEvidenceChange } from '@/lib/knowledge/review-cascade'

export interface ActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

const LINK_KINDS = ['implements', 'contrasts', 'complements', 'condition_variant', 'duplicate_candidate'] as const

/** 동시 저장에서 진 쪽이 보는 문장 — 화면도움말(knowledge-item cautions)이 같은 문장을 인용한다. */
const STALE_STATUS_ERROR = '그 사이 다른 사람이 상태를 바꿨습니다 — 새로 고친 뒤 다시 판단하세요'
/** 화면을 연 뒤 근거가 추가·삭제·변경됐을 때 — 본 근거와 저장된 근거가 다르면 판단하지 않는다. */
/** 화면을 연 뒤 문장이 바뀌었을 때 — 본 문장과 저장된 문장이 다르면 판단하지 않는다. */
const STALE_STATEMENT_ERROR = '화면을 연 뒤 문장이 바뀌었습니다 — 새로 고쳐 문장을 다시 읽은 뒤 판단하세요'
const STALE_EVIDENCE_ERROR = '화면을 연 뒤 근거가 바뀌었습니다 — 새로 고쳐 근거를 다시 확인한 뒤 판단하세요'

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

/**
 * 상태 변경. `seenEvidenceVersion` = 화면이 그 항목을 그릴 때 읽은 근거 집합 버전.
 * 「상태 = 읽은 상태 AND 근거 버전 = 본 버전」 인 한 문장 UPDATE 라, 비교와 변경 사이에 끼어들 틈이 없다.
 * 근거 버전은 근거가 추가·삭제·변경(원천 재등급 포함)될 때마다 DB 트리거가 올린다(20261001120000).
 */
export async function setItemStatusAction(
  itemId: string,
  to: string,
  reason: string,
  seenEvidenceVersion: number,
  /** 화면이 읽은 문장 버전 — 그 사이 문장이 바뀌었으면(다른 사람이 고침) 본 적 없는 문장을 채택하지 않는다(Codex P1 · 2026-10-08) */
  seenVersion: number,
): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge/review')
    if (!isStatus(to)) return { ok: false, error: '알 수 없는 상태입니다' }
    if (!Number.isSafeInteger(seenEvidenceVersion) || seenEvidenceVersion < 0) {
      return { ok: false, error: '화면의 근거 버전을 알 수 없습니다 — 새로 고친 뒤 다시 판단하세요' }
    }
    const client = db()
    const { data: item, error } = await client
      .from('knowledge_items')
      .select('status,slug,evidence_version,version')
      .eq('id', itemId)
      .single()
    if (error || !item) return { ok: false, error: '항목을 찾지 못했습니다' }
    // 이미 달라졌으면 규칙 검사 전에 돌려보낸다 — 아래 조건부 UPDATE 가 최종 방어선이다
    if (Number(item.evidence_version) !== seenEvidenceVersion) return { ok: false, error: STALE_EVIDENCE_ERROR }
    if (!Number.isSafeInteger(seenVersion) || Number(item.version) !== seenVersion) return { ok: false, error: STALE_STATEMENT_ERROR }
    const from = item.status as ItemStatus
    const rule = checkTransition({ from, to, reason, evidenceCount: await evidenceCount(client, itemId) })
    if (!rule.ok) return rule
    const { data: changed, error: e2 } = await client
      .from('knowledge_items')
      .update({ status: to, status_reason: reason.trim() || null, updated_by: who })
      .eq('id', itemId)
      .eq('status', from) // 그 사이 다른 사람이 상태를 바꿨으면 덮지 않는다
      .eq('evidence_version', seenEvidenceVersion) // 그 사이 근거가 바뀌었으면 본 것과 다르다
      .eq('version', seenVersion) // 그 사이 문장이 바뀌었으면 본 것과 다르다
      .select('id')
    if (e2) return { ok: false, error: `저장 실패: ${e2.message}` }
    // 조건부 UPDATE 는 0행이어도 오류가 없다 — 바뀐 행이 없으면 성공이라고 말하지 않는다
    if (!changed || changed.length === 0) {
      const { data: now } = await client.from('knowledge_items').select('status,evidence_version,version').eq('id', itemId).single()
      const evidenceMoved = now && Number(now.evidence_version) !== seenEvidenceVersion
      const statementMoved = now && Number(now.version) !== seenVersion
      return { ok: false, error: evidenceMoved ? STALE_EVIDENCE_ERROR : statementMoved ? STALE_STATEMENT_ERROR : STALE_STATUS_ERROR }
    }
    refresh(String(item.slug))
    if (to === 'in_review' || to === 'rejected') {
      const moved = await cascadeReview(client, itemId, `상위 「${item.slug}」 ${to === 'rejected' ? '반려' : '재검토'} — 연쇄 재검토`, who, refresh)
      return { ok: true, data: { cascaded: moved } }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '상태 변경 실패') }
  }
}

/**
 * 문장 고치기 — 버전은 DB 트리거가 올린다(knowledge_items_track). 채택 · 적용 중이던 항목은 채택한 문장이 아니게 됐으므로
 * 자신도 「검토 중」으로 돌리고, 아래 층에 재검토를 전파한다. `seenVersion` = 화면이 읽은 버전(그 사이 바뀌었으면 덮지 않는다).
 */
export async function editStatementAction(itemId: string, statement: string, seenVersion: number): Promise<ActionResult<{ cascaded: string[] }>> {
  try {
    const who = await actor('/admin/knowledge')
    const text = statement.trim()
    if (text.length === 0 || text.length > 1500) return { ok: false, error: '문장은 1~1500자입니다' }
    const client = db()
    const { data: item, error } = await client.from('knowledge_items').select('slug,status,statement,version').eq('id', itemId).single()
    if (error || !item) return { ok: false, error: '항목을 찾지 못했습니다' }
    if (Number(item.version) !== seenVersion) return { ok: false, error: '그 사이 문장이 바뀌었습니다 — 새로 고친 뒤 다시' }
    if (String(item.statement) === text) return { ok: false, error: '바뀐 곳이 없습니다' }
    const live = isLive(String(item.status))
    const patch: Record<string, unknown> = { statement: text, updated_by: who }
    if (live) { patch.status = 'in_review'; patch.status_reason = '문장 변경 — 채택한 문장이 아니다(재검토)' }
    // 읽은 상태 · 버전 그대로일 때만 — 그 사이 누가 채택했으면(상태 변경) 「검토 중 전환 없는 문장 변경」이 되지 않게 실패시킨다(Codex P1)
    const { data: changed, error: e2 } = await client.from('knowledge_items').update(patch).eq('id', itemId).eq('version', seenVersion).eq('status', item.status).select('id')
    if (e2) return { ok: false, error: `저장 실패: ${e2.message}` }
    if (!changed?.length) return { ok: false, error: '그 사이 문장이나 상태가 바뀌었습니다 — 새로 고친 뒤 다시' }
    refresh(String(item.slug))
    const cascaded = await cascadeReview(client, itemId, `상위 「${item.slug}」 문장 변경 — 연쇄 재검토`, who, refresh)
    return { ok: true, data: { cascaded } }
  } catch (e) {
    return { ok: false, error: message(e, '문장 저장 실패') }
  }
}

export async function createItemAction(input: NewItemInput): Promise<ActionResult<{ slug: string }>> {
  try {
    const who = await actor('/admin/knowledge')
    if (!isLayer(input.layer)) return { ok: false, error: '알 수 없는 층입니다' }
    const rule = checkNewItem(input)
    if (!rule.ok) return rule
    // 종류: essence · principle 은 사람이 고른다(기본값이 정하면 안 된다 — 마이그레이션 20261008120000 계약)
    const kind = input.kind ?? (input.layer === 'method' ? 'method' : input.layer === 'practice' ? 'task' : null)
    if (!isKind(kind) || !KINDS_BY_LAYER[input.layer].includes(kind)) {
      return { ok: false, error: '종류를 고르세요 — 본질은 역량 목표/묶음, 원리는 언어 처리 기제/학습 기제' }
    }
    // 분류 ID 는 클라이언트를 믿지 않는다 — 최신 스냅샷 분류에 실제로 있고 차원이 맞는지 서버에서 본다
    const taxonomyRule = checkTaxonomyIds(input.skillIds, input.conditionIds, await listTaxonomy())
    if (!taxonomyRule.ok) return taxonomyRule
    const { error } = await db()
      .from('knowledge_items')
      .insert({
        layer: input.layer,
        kind,
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
    if (!isAttribution(input.attribution)) return { ok: false, error: '귀속을 고르세요' }
    const rule = checkExternalEvidence(input)
    if (!rule.ok) return rule
    const client = db()
    const { data: item } = await client.from('knowledge_items').select('slug').eq('id', input.itemId).single()
    // 재검토를 근거 저장 **앞에** 한다 — 뒤에서 실패해도 항목은 이미 검토 중(학습자에게서 내려감 · fail-closed). 트랜잭션은 DB 가드 SQL 후보 몫
    await reviewAfterEvidenceChange(client, input.itemId, '근거 추가', who, refresh)
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
    if (!isAttribution(input.attribution)) return { ok: false, error: '귀속을 고르세요' }
    const client = db()
    const { data: origin, error } = await client
      .from('knowledge_csat_origins')
      .select('grade')
      .eq('passage_sha256', input.passageSha256)
      .single()
    if (error || !origin) return { ok: false, error: '기출 원천을 찾지 못했습니다' }
    if (origin.grade === 'G') return { ok: false, error: '미확인(G) 원천은 근거로 쓸 수 없습니다' }
    const { data: item } = await client.from('knowledge_items').select('slug').eq('id', input.itemId).single()
    await reviewAfterEvidenceChange(client, input.itemId, '근거 추가(기출 원천)', who, refresh)
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
