// apps/web/src/app/admin/knowledge/vnext-actions.ts
// 학습 원리 vNext Server Actions(2026-10-08) — 탐구 질문 · 연구 서지 · 근거 축 · 종류 · 제품 적용 · 효과 검증.
// requireAdmin 으로 사람을 확인한 뒤 관리자 클라이언트로 쓴다. 불변식(채택 항목만 적용 · trial 필요 · efficacy 근거 · 이탈 재검토)은
// DB 트리거가 최종 방어선이다(20261008120000) — 여기서는 사람 말로 먼저 막고, 상태 전이는 「읽은 상태 그대로일 때만」 쓴다.

'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAttribution } from '@/lib/knowledge/labels'
import {
  EXTERNAL_LEVELS, KINDS_BY_LAYER, isAppStatus, isAppSurface, isApplicability, isEvidenceLevel, isInquiryRole, isInquiryStatus, isKind,
  type AppStatus,
} from '@/lib/knowledge/vnext-labels'
import { checkAppTransition, checkInquiry, checkResearchSource, checkTrialDesign, type TrialDesign } from '@/lib/knowledge/vnext-rules'
import { isLayer } from '@/lib/knowledge/labels'
import { reviewAfterEvidenceChange } from '@/lib/knowledge/review-cascade'
import { currentItemTask } from '@/lib/knowledge/item-tasks'
import { itemTaskRef, parseItemTaskRef } from '@/lib/knowledge/product-server'

export interface ActionResult<T = unknown> { ok: boolean; data?: T; error?: string }

function db(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}
async function actor(path: string): Promise<string> {
  const admin = await requireAdmin(path)
  return admin.email ?? admin.id
}
function refresh() {
  revalidatePath('/admin/knowledge', 'layout')
}
const msg = (e: unknown, f: string) => (e instanceof Error ? e.message : f)
/** DB 트리거의 거부 문장을 그대로 보여 준다(사람 말로 쓰여 있다) */
const dbError = (e: { message?: string } | null, f: string) => (e?.message ? e.message.replace(/^.*?ERROR:\s*/, '') : f)

// ── 탐구 질문 ─────────────────────────────────────────────────────────────────
export async function createInquiryAction(input: { slug: string; question: string; skillIds: string[] }): Promise<ActionResult<{ slug: string }>> {
  try {
    const who = await actor('/admin/knowledge/lab')
    const bad = checkInquiry(input)
    if (bad) return { ok: false, error: bad }
    const { error } = await db().from('knowledge_inquiries').insert({ slug: input.slug, question: input.question.trim(), skill_ids: input.skillIds, created_by: who, updated_by: who })
    if (error) return { ok: false, error: error.code === '23505' ? '같은 주소 이름이 이미 있습니다' : `저장 실패: ${error.message}` }
    refresh()
    return { ok: true, data: { slug: input.slug } }
  } catch (e) {
    return { ok: false, error: msg(e, '질문 작성 실패') }
  }
}

export async function setInquiryStatusAction(input: { id: string; from: string; to: string; conclusionItemSlug: string | null; uncertainty: string }): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge/lab')
    if (!isInquiryStatus(input.from) || !isInquiryStatus(input.to)) return { ok: false, error: '알 수 없는 상태' }
    let conclusionId: string | null = null
    if (input.to === 'concluded') {
      if (!input.conclusionItemSlug) return { ok: false, error: '결론은 항목(결론 후보)으로 남긴다 — 항목 주소 이름을 고른다' }
      const { data } = await db().from('knowledge_items').select('id').eq('slug', input.conclusionItemSlug).maybeSingle()
      if (!data) return { ok: false, error: '결론 항목을 찾지 못했다' }
      conclusionId = String(data.id)
    }
    const { data, error } = await db().from('knowledge_inquiries')
      .update({ status: input.to, conclusion_item_id: conclusionId, uncertainty: input.uncertainty.trim() || null, updated_by: who, updated_at: new Date().toISOString() })
      .eq('id', input.id).eq('status', input.from).select('id')
    if (error) return { ok: false, error: dbError(error, '저장 실패') }
    if (!data?.length) return { ok: false, error: '그 사이 다른 사람이 상태를 바꿨습니다 — 새로 고친 뒤 다시' }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, '상태 변경 실패') }
  }
}

/** 질문에 항목(주소 이름) 또는 근거(id)를 역할(결론 후보 · 지지 · 반례 · 불확실)로 잇는다 */
export async function linkInquiryAction(input: { inquiryId: string; itemSlug: string | null; evidenceId: string | null; role: string; note: string }): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge/lab')
    if (!isInquiryRole(input.role)) return { ok: false, error: '역할을 고른다' }
    if (!input.itemSlug === !input.evidenceId) return { ok: false, error: '항목이나 근거 중 하나만' }
    let itemId: string | null = null
    if (input.itemSlug) {
      const { data } = await db().from('knowledge_items').select('id').eq('slug', input.itemSlug.trim()).maybeSingle()
      if (!data) return { ok: false, error: '항목을 찾지 못했다(주소 이름)' }
      itemId = String(data.id)
    }
    const { error } = await db().from('knowledge_inquiry_links').insert({ inquiry_id: input.inquiryId, item_id: itemId, evidence_id: input.evidenceId, role: input.role, note: input.note.trim() || null, created_by: who })
    if (error) return { ok: false, error: dbError(error, '연결 실패') }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, '연결 실패') }
  }
}

// ── 연구 서지 · 연구 근거 · 근거 축 ─────────────────────────────────────────────
export async function createResearchSourceAction(input: { citation: string; doi: string; url: string; design: string; population: string; l2Context: 'yes' | 'no' | 'unknown'; year: string; note: string }): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge/lab/research')
    const year = input.year.trim() ? Number(input.year) : null
    const r = { citation: input.citation.trim(), doi: input.doi.trim() || null, url: input.url.trim() || null, design: input.design, year }
    const bad = checkResearchSource(r)
    if (bad) return { ok: false, error: bad }
    const { error } = await db().from('knowledge_research_sources').insert({
      ...r, population: input.population.trim() || null, l2_context: input.l2Context === 'unknown' ? null : input.l2Context === 'yes', note: input.note.trim() || null, created_by: who,
    })
    if (error) return { ok: false, error: error.code === '23505' ? '같은 DOI 서지가 이미 있다' : dbError(error, '저장 실패') }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, '서지 저장 실패') }
  }
}

/** 항목에 연구 근거를 붙인다 — 수준은 DB 가 서지 설계에서 정한다(입력하지 않는다) */
export async function addResearchEvidenceAction(input: { itemId: string; researchSourceId: string; grade: string; attribution: string; applicability: string; applicabilityNote: string; locator: string }): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge/lab/research')
    if (!['A', 'B', 'C'].includes(input.grade)) return { ok: false, error: '출처 확인도는 A · B · C' }
    if (!isAttribution(input.attribution)) return { ok: false, error: '귀속(직접 말함 · 관찰 · 추론)을 고른다' }
    if (!isApplicability(input.applicability)) return { ok: false, error: '적용 적합성을 고른다' }
    // 재검토를 근거 저장 앞에 — 뒤에서 실패해도 항목은 이미 검토 중(fail-closed)
    await reviewAfterEvidenceChange(db(), input.itemId, '연구 근거 추가', who, () => refresh())
    const { error } = await db().from('knowledge_evidence').insert({
      item_id: input.itemId, grade: input.grade, attribution: input.attribution, source_type: 'research', research_source_id: input.researchSourceId,
      applicability: input.applicability, applicability_note: input.applicabilityNote.trim() || null, locator: input.locator.trim() || null, created_by: who,
    })
    if (error) return { ok: false, error: dbError(error, '근거 저장 실패') }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, '근거 저장 실패') }
  }
}

/** 근거의 적용 적합성 · (외부 근거만) 수준을 고친다 — 외부 근거는 실무자 주장 · 전문가 견해 · 평가 안 함까지만(DB 가 막는다) */
export async function setEvidenceAxesAction(input: { evidenceId: string; applicability: string; applicabilityNote: string; evidenceLevel: string | null }): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge')
    if (!isApplicability(input.applicability)) return { ok: false, error: '적용 적합성을 고른다' }
    const patch: Record<string, unknown> = { applicability: input.applicability, applicability_note: input.applicabilityNote.trim() || null }
    if (input.evidenceLevel !== null) {
      if (!isEvidenceLevel(input.evidenceLevel) || !EXTERNAL_LEVELS.includes(input.evidenceLevel)) return { ok: false, error: '외부 근거의 수준은 실무자 주장 · 전문가 견해 · 평가 안 함 — 연구 수준은 연구 서지로' }
      patch.evidence_level = input.evidenceLevel
    }
    const { data: cur, error: e0 } = await db().from('knowledge_evidence').select('item_id, applicability, evidence_level').eq('id', input.evidenceId).single()
    if (e0 || !cur) return { ok: false, error: '근거를 찾지 못했다' }
    // 판단에 쓰는 축(적합성 · 수준)이 실제로 바뀔 때만 재검토 — 메모만 · 같은 값 저장은 채택 사슬을 흔들지 않는다(Codex P2)
    const axisMoved = cur.applicability !== input.applicability || (input.evidenceLevel !== null && cur.evidence_level !== input.evidenceLevel)
    // 재검토를 근거 변경 앞에 — 뒤에서 실패해도 항목은 이미 검토 중(fail-closed)
    if (axisMoved) await reviewAfterEvidenceChange(db(), String(cur.item_id), '근거 축 변경', who, () => refresh())
    const { error } = await db().from('knowledge_evidence').update(patch).eq('id', input.evidenceId)
    if (error) return { ok: false, error: dbError(error, '저장 실패') }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, '저장 실패') }
  }
}

/** 미분류(또는 잘못 분류된) 항목의 종류를 정한다 — 층에 맞는 종류만 */
export async function setItemKindAction(input: { itemId: string; kind: string }): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge/map')
    if (!isKind(input.kind)) return { ok: false, error: '알 수 없는 종류' }
    const { data: item } = await db().from('knowledge_items').select('layer').eq('id', input.itemId).maybeSingle()
    if (!item || !isLayer(item.layer)) return { ok: false, error: '항목을 찾지 못했다' }
    if (!KINDS_BY_LAYER[item.layer].includes(input.kind)) return { ok: false, error: '이 층에 맞지 않는 종류' }
    const { error } = await db().from('knowledge_items').update({ kind: input.kind, updated_by: who }).eq('id', input.itemId)
    if (error) return { ok: false, error: dbError(error, '저장 실패') }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, '저장 실패') }
  }
}

// ── 제품 적용 · 효과 검증 ───────────────────────────────────────────────────────
export async function createApplicationAction(input: { itemSlug: string; surface: string; surfaceRef: string; audience: string; exclusions: string }): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge/design')
    if (!isAppSurface(input.surface)) return { ok: false, error: '적용 표면을 고른다' }
    // 모의평가 문항 키는 대문자 M 을 쓴다(claim-support:M2506-20) — 소문자만 받으면 관리자 화면으로는 모의평가 과제를 낼 수 없었다(2026-10-10)
    if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/.test(input.surfaceRef)) return { ok: false, error: '과제 키는 영문 · 숫자 · : . _ -' }
    if (input.surface === 'csat_item_task') {
      // 문항 과제 키는 코드가 찾는 그대로여야 한다 — 대소문자가 다르면 적용이 켜져도 학습자에게 안 보인다
      const parsed = parseItemTaskRef(input.surfaceRef)
      if (!parsed || itemTaskRef(parsed.taskKey, parsed.itemId) !== input.surfaceRef) return { ok: false, error: '문항 과제 키는 「과제 키:문항」 형식(예: claim-support:2022-20 · claim-support:M2506-20)' }
      // 그 문항에 실제 주석 과제가 있어야 한다 — m2506-20 처럼 없는 문항(m2506#20)을 가리키는 키는 형식이 맞아도 막는다
      if (currentItemTask(parsed.itemId)?.def.key !== parsed.taskKey) return { ok: false, error: `${parsed.itemId} 에는 「${parsed.taskKey}」 주석 과제가 없다(대소문자 · 문항 번호 확인)` }
    }
    const parse = (s: string) => { if (!s.trim()) return {}; try { const v = JSON.parse(s); return v && typeof v === 'object' && !Array.isArray(v) ? v : null } catch { return null } }
    const audience = parse(input.audience)
    const exclusions = parse(input.exclusions)
    if (audience === null || exclusions === null) return { ok: false, error: '대상 · 제외 조건은 JSON 객체(예: {"exam":"suneung"})' }
    const { data: item } = await db().from('knowledge_items').select('id').eq('slug', input.itemSlug.trim()).maybeSingle()
    if (!item) return { ok: false, error: '항목을 찾지 못했다(주소 이름)' }
    const { error } = await db().from('knowledge_applications').insert({ item_id: item.id, surface: input.surface, surface_ref: input.surfaceRef, audience, exclusions, created_by: who, updated_by: who })
    if (error) return { ok: false, error: error.code === '23505' ? '같은 표면 · 과제 키 · 버전이 이미 있다' : dbError(error, '저장 실패') }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, '적용 만들기 실패') }
  }
}

export async function setApplicationStatusAction(input: { id: string; from: string; to: string; reason: string }): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge/product')
    if (!isAppStatus(input.from) || !isAppStatus(input.to)) return { ok: false, error: '알 수 없는 상태' }
    const bad = checkAppTransition(input.from, input.to as AppStatus, input.reason)
    if (bad) return { ok: false, error: bad }
    const patch: Record<string, unknown> = { status: input.to, status_reason: input.reason.trim() || null, updated_by: who }
    if (input.to === 'active') {
      // B7 출시 승인 — 승인자 · 시각 · 사유를 켜는 같은 갱신에 남긴다(중단하면 DB 가 지운다)
      patch.released_at = new Date().toISOString()
      patch.release_approved_by = who
      patch.release_approved_at = patch.released_at
      patch.release_note = input.reason.trim()
    }
    const { data, error } = await db().from('knowledge_applications').update(patch).eq('id', input.id).eq('status', input.from).select('id')
    if (error) return { ok: false, error: dbError(error, '저장 실패') }
    if (!data?.length) return { ok: false, error: '그 사이 다른 사람이 상태를 바꿨습니다 — 새로 고친 뒤 다시' }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, '상태 변경 실패') }
  }
}

export async function createTrialAction(input: { applicationId: string; design: TrialDesign; synthetic: boolean }): Promise<ActionResult> {
  try {
    const who = await actor('/admin/knowledge/design')
    const bad = checkTrialDesign(input.design)
    if (bad) return { ok: false, error: bad }
    const d = input.design
    const { error } = await db().from('knowledge_trials').insert({
      application_id: input.applicationId, synthetic: input.synthetic, created_by: who,
      design: { pre: d.pre, post: d.post, delayed_days: d.delayedDays, transfer: d.transfer, comparison: d.comparison, min_n: d.minN, measures: d.measures },
    })
    if (error) return { ok: false, error: dbError(error, '저장 실패') }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: msg(e, '검증 계획 저장 실패') }
  }
}
