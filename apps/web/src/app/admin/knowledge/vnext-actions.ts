// apps/web/src/app/admin/knowledge/vnext-actions.ts
// 학습 원리 vNext Server Actions — 탐구 질문 · 입장 · 근거 축 · 원리 면 · 학습 설계 · 배포 상태 · 롤백 · 검증 실행.
// 배포 문턱·근거 변화 중단·배포 구간 개폐는 DB 트리거(20261008120000)가 지킨다 — 여기서는 사람 확인과 입력 검사, 낙관적 잠금만.
'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { isLayer } from '@/lib/knowledge/labels'
import {
  DESIGN_TRANSITIONS,
  LEARNER_MODULES,
  ROLE_LAYER,
  isDesignRole,
  isDesignStatus,
  isFacet,
  isFit,
  isInquiryStatus,
  isLearnerModuleKey,
  isResearchLevel,
  isStance,
  type DesignStatus,
} from '@/lib/knowledge/vnext'
import { listRuns, protocolFor, toDesign } from '@/lib/knowledge/vnext-server'

export interface ActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

const STALE = '그 사이 다른 사람이 바꿨습니다 — 새로 고친 뒤 다시 하세요'
const SLUG = /^[a-z0-9][a-z0-9-]{1,80}$/

function db(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}
async function actor(): Promise<string> {
  const admin = await requireAdmin('/admin/knowledge')
  return admin.email ?? admin.id
}
function refresh() {
  revalidatePath('/admin/knowledge', 'layout')
}
function message(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}
/** DB 트리거의 거부 문장을 그대로 보인다(어떤 문턱에 걸렸는지가 거기 있다). */
function dbError(e: { code?: string; message?: string }, what: string): string {
  if (e.code === '23514' || e.code === 'P0001') return e.message ?? what
  if (e.code === '23505') return '이미 같은 것이 있습니다'
  return `${what}: ${e.message ?? e.code ?? ''}`
}

// ── 탐구 질문 ────────────────────────────────────────────────────────
export async function createInquiryAction(input: { slug: string; question: string; capabilityItemId?: string | null }): Promise<ActionResult<{ slug: string }>> {
  try {
    const who = await actor()
    const slug = input.slug.trim()
    const question = input.question.trim()
    if (!SLUG.test(slug)) return { ok: false, error: 'slug 는 소문자·숫자·하이픈 2~81자' }
    if (question.length === 0 || question.length > 500) return { ok: false, error: '질문은 1~500자' }
    const { error } = await db()
      .from('knowledge_inquiries')
      .insert({ slug, question, capability_item_id: input.capabilityItemId || null, status: 'open', created_by: who, updated_by: who })
    if (error) return { ok: false, error: dbError(error, '질문 저장 실패') }
    refresh()
    return { ok: true, data: { slug } }
  } catch (e) {
    return { ok: false, error: message(e, '질문 저장 실패') }
  }
}

export async function updateInquiryAction(input: {
  id: string
  seenUpdatedAt: string
  status: string
  conclusion: string
  uncertainty: string
  nextAction: string
}): Promise<ActionResult> {
  try {
    const who = await actor()
    if (!isInquiryStatus(input.status)) return { ok: false, error: '알 수 없는 상태' }
    const conclusion = input.conclusion.trim()
    const uncertainty = input.uncertainty.trim()
    if (input.status === 'concluded' && (!conclusion || !uncertainty)) {
      return { ok: false, error: '결론에는 결론 문장과 불확실성을 함께 적습니다' }
    }
    const { data, error } = await db()
      .from('knowledge_inquiries')
      .update({
        status: input.status,
        conclusion: conclusion || null,
        uncertainty: uncertainty || null,
        next_action: input.nextAction.trim() || null,
        updated_by: who,
      })
      .eq('id', input.id)
      .eq('updated_at', input.seenUpdatedAt)
      .select('id')
    if (error) return { ok: false, error: dbError(error, '질문 저장 실패') }
    if (!data?.length) return { ok: false, error: STALE }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '질문 저장 실패') }
  }
}

/** 입장 하나 — 항목 slug 또는 근거 id. 반박·반례도 지지와 같은 자리에 둔다. */
export async function addPositionAction(input: {
  inquiryId: string
  itemSlug?: string
  evidenceId?: string
  stance: string
  note: string
}): Promise<ActionResult> {
  try {
    const who = await actor()
    if (!isStance(input.stance)) return { ok: false, error: '알 수 없는 입장' }
    const note = input.note.trim()
    if (note.length === 0 || note.length > 1000) return { ok: false, error: '메모는 1~1000자 — 왜 그 입장인지 적습니다' }
    let itemId: string | null = null
    if (input.itemSlug) {
      const { data, error } = await db().from('knowledge_items').select('id').eq('slug', input.itemSlug.trim()).maybeSingle()
      if (error || !data) return { ok: false, error: '그 slug 의 항목이 없습니다' }
      itemId = String(data.id)
    }
    const evidenceId = input.evidenceId?.trim() || null
    if (!itemId && !evidenceId) return { ok: false, error: '항목 또는 근거를 고릅니다' }
    const { error } = await db()
      .from('knowledge_inquiry_positions')
      .insert({ inquiry_id: input.inquiryId, item_id: itemId, evidence_id: evidenceId, stance: input.stance, note, created_by: who })
    if (error) return { ok: false, error: dbError(error, '입장 저장 실패') }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '입장 저장 실패') }
  }
}

// ── 근거 축 · 원리 면 ────────────────────────────────────────────────
export async function setEvidenceAxesAction(input: { evidenceId: string; researchLevel: string; fit: string; fitNote: string }): Promise<ActionResult> {
  try {
    await actor()
    if (!isResearchLevel(input.researchLevel)) return { ok: false, error: '알 수 없는 연구 수준' }
    if (!isFit(input.fit)) return { ok: false, error: '알 수 없는 적합성' }
    const fitNote = input.fitNote.trim()
    if (fitNote.length > 500) return { ok: false, error: '적합성 메모는 500자 이내' }
    const { data, error } = await db()
      .from('knowledge_evidence')
      .update({ research_level: input.researchLevel, fit: input.fit, fit_note: fitNote || null })
      .eq('id', input.evidenceId)
      .select('id')
    if (error) return { ok: false, error: dbError(error, '근거 축 저장 실패') }
    if (!data?.length) return { ok: false, error: '근거를 찾지 못했습니다' }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '근거 축 저장 실패') }
  }
}

export async function setFacetAction(input: { itemId: string; facet: string | null }): Promise<ActionResult> {
  try {
    const who = await actor()
    if (input.facet !== null && !isFacet(input.facet)) return { ok: false, error: '알 수 없는 면' }
    const { data, error } = await db()
      .from('knowledge_items')
      .update({ facet: input.facet, updated_by: who })
      .eq('id', input.itemId)
      .eq('layer', 'principle')
      .select('id')
    if (error) return { ok: false, error: dbError(error, '면 저장 실패') }
    if (!data?.length) return { ok: false, error: '원리 항목에만 면을 붙입니다' }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '면 저장 실패') }
  }
}

// ── 학습 설계 ────────────────────────────────────────────────────────
export async function createDesignAction(input: {
  slug: string
  title: string
  learnerSummary: string
  procedure: string
  moduleKey: string
  trainTypeIds: string[]
  transferTypeIds: string[]
  inquiryId?: string | null
}): Promise<ActionResult<{ slug: string }>> {
  try {
    const who = await actor()
    const slug = input.slug.trim()
    if (!SLUG.test(slug)) return { ok: false, error: 'slug 는 소문자·숫자·하이픈 2~81자' }
    if (!isLearnerModuleKey(input.moduleKey)) return { ok: false, error: '코드에 있는 학습자 모듈만 고를 수 있습니다' }
    const allowed = LEARNER_MODULES[input.moduleKey].typeIds
    const bad = [...input.trainTypeIds, ...input.transferTypeIds].filter((t) => !allowed.includes(t))
    if (bad.length) return { ok: false, error: `이 모듈이 다루지 않는 유형: ${bad.join(', ')}` }
    if (input.trainTypeIds.length === 0) return { ok: false, error: '훈련 유형을 하나 이상 고릅니다' }
    const steps = input.procedure
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [title, ...rest] = l.split(' — ')
        return rest.length ? { title: title.trim(), detail: rest.join(' — ').trim() } : { title: title.trim() }
      })
    if (steps.length === 0 || steps.length > 12) return { ok: false, error: '절차는 1~12단계(한 줄에 한 단계, 「제목 — 설명」)' }
    const { error } = await db().from('knowledge_designs').insert({
      slug,
      title: input.title.trim(),
      learner_summary: input.learnerSummary.trim(),
      procedure: steps,
      module_key: input.moduleKey,
      train_type_ids: input.trainTypeIds,
      transfer_type_ids: input.transferTypeIds,
      assessment: { thresholds: {} },
      inquiry_id: input.inquiryId || null,
      status: 'draft',
      created_by: who,
      updated_by: who,
    })
    if (error) return { ok: false, error: dbError(error, '설계 저장 실패') }
    refresh()
    return { ok: true, data: { slug } }
  } catch (e) {
    return { ok: false, error: message(e, '설계 저장 실패') }
  }
}

export async function linkDesignItemAction(input: { designId: string; itemSlug: string; role: string }): Promise<ActionResult> {
  try {
    await actor()
    if (!isDesignRole(input.role)) return { ok: false, error: '알 수 없는 역할' }
    const { data: item, error } = await db().from('knowledge_items').select('id,layer').eq('slug', input.itemSlug.trim()).maybeSingle()
    if (error || !item) return { ok: false, error: '그 slug 의 항목이 없습니다' }
    if (!isLayer(item.layer) || ROLE_LAYER[input.role] !== item.layer) {
      return { ok: false, error: `역할 「${input.role}」에는 ${ROLE_LAYER[input.role]} 층 항목만 잇습니다` }
    }
    const { error: e2 } = await db().from('knowledge_design_items').insert({ design_id: input.designId, item_id: item.id, role: input.role })
    if (e2) return { ok: false, error: dbError(e2, '연결 실패') }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '연결 실패') }
  }
}

/**
 * 설계 상태 변경. 「상태 = 본 상태 AND 버전 = 본 버전」 한 문장 UPDATE(낙관적 잠금).
 * 배포 문턱(모든 연결 항목 채택)·배포 구간 개폐는 DB 트리거가 한다 — 거부 문장을 그대로 보인다.
 */
export async function setDesignStatusAction(input: {
  designId: string
  from: string
  to: string
  seenVersion: number
  reason: string
}): Promise<ActionResult> {
  try {
    const who = await actor()
    if (!isDesignStatus(input.from) || !isDesignStatus(input.to)) return { ok: false, error: '알 수 없는 상태' }
    if (!DESIGN_TRANSITIONS[input.from].includes(input.to)) return { ok: false, error: `${input.from} → ${input.to} 는 허용되지 않습니다` }
    const reason = input.reason.trim()
    if ((input.to === 'paused' || input.to === 'retired') && !reason) return { ok: false, error: '중단·종료에는 이유가 필요합니다' }
    const { data, error } = await db()
      .from('knowledge_designs')
      .update({ status: input.to, status_reason: reason || null, updated_by: who })
      .eq('id', input.designId)
      .eq('status', input.from)
      .eq('version', input.seenVersion)
      .select('id')
    if (error) return { ok: false, error: dbError(error, '상태 변경 실패') }
    if (!data?.length) return { ok: false, error: STALE }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '상태 변경 실패') }
  }
}

/**
 * 롤백 — 끝난 배포 구간의 사본(snapshot)으로 설계 내용을 되돌린다. 배포 중이면 먼저 중단해야 한다(DB 가 거부).
 * 내용이 바뀌므로 버전이 오른다 — 되돌린 내용도 새 버전으로 센다(옛 버전 결과와 섞지 않는다).
 */
export async function rollbackDesignAction(input: { designId: string; deploymentId: string; seenVersion: number }): Promise<ActionResult> {
  try {
    const who = await actor()
    const client = db()
    const { data: dep, error } = await client.from('knowledge_deployments').select('design_id,snapshot,ended_at,design_version').eq('id', input.deploymentId).maybeSingle()
    if (error || !dep) return { ok: false, error: '배포 구간을 찾지 못했습니다' }
    if (String(dep.design_id) !== input.designId) return { ok: false, error: '다른 설계의 배포 구간입니다' }
    if (!dep.ended_at) return { ok: false, error: '아직 열린 배포 구간입니다 — 먼저 중단합니다' }
    const s = dep.snapshot as Record<string, unknown>
    const { data, error: e2 } = await client
      .from('knowledge_designs')
      .update({
        learner_summary: s.learner_summary,
        procedure: s.procedure,
        include_conditions: s.include_conditions ?? [],
        exclude_conditions: s.exclude_conditions ?? [],
        train_type_ids: s.train_type_ids ?? [],
        transfer_type_ids: s.transfer_type_ids ?? [],
        assessment: s.assessment ?? {},
        module_key: s.module_key,
        status: 'ready',
        status_reason: `v${dep.design_version} 배포 내용으로 되돌림`,
        updated_by: who,
      })
      .eq('id', input.designId)
      .eq('version', input.seenVersion)
      .neq('status', 'deployed')
      .select('id')
    if (e2) return { ok: false, error: dbError(e2, '롤백 실패') }
    if (!data?.length) return { ok: false, error: STALE }
    refresh()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e, '롤백 실패') }
  }
}

/** 현재 버전의 실학습 기록으로 프로토콜을 계산해 남긴다. 미리보기·합성은 넣지 않는다. */
export async function recordValidationAction(input: { designId: string }): Promise<ActionResult<{ verdict: string }>> {
  try {
    const who = await actor()
    const { data, error } = await db().from('knowledge_designs').select('*').eq('id', input.designId).maybeSingle()
    if (error || !data) return { ok: false, error: '설계를 찾지 못했습니다' }
    const d = toDesign(data)
    const r = protocolFor(await listRuns(d.id), d.version, d.assessment, false)
    const { error: e2 } = await db().from('knowledge_validation_runs').insert({
      design_id: d.id,
      design_version: d.version,
      synthetic: false,
      n_learners: r.nLearners,
      n_runs: r.nRuns,
      metrics: { ...r.metrics, caveats: r.caveats, nQualified: r.nQualified },
      verdict: r.verdict,
      computed_by: who,
    })
    if (e2) return { ok: false, error: dbError(e2, '검증 실행 저장 실패') }
    refresh()
    return { ok: true, data: { verdict: r.verdict } }
  } catch (e) {
    return { ok: false, error: message(e, '검증 실행 실패') }
  }
}

export type { DesignStatus }
