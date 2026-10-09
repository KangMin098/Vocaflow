// apps/web/src/lib/knowledge/vnext-server.ts
//
// 학습 원리 vNext 로더(2026-10-08) — 탐구 질문 · 연구 서지 · 제품 적용 · 효과 검증. requireAdmin 뒤에서만 부른다(service_role 전용 표).
// DB 오류를 빈 목록으로 삼키지 않는다(server.ts 와 같은 계약). 표가 작아(질문 · 적용 수십 건) 한 번에 읽되 상한을 넘으면 실패로 알린다.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  isAppStatus, isAppSurface, isInquiryRole, isInquiryStatus, isResearchDesign,
  type AppStatus, type AppSurface, type InquiryRole, type InquiryStatus, type ResearchDesign, type TrialResult, type TrialStatus,
} from './vnext-labels'

const LIMIT = 2000
function db(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}
async function read<T>(what: string, q: PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>): Promise<T[]> {
  const { data, error } = await q
  if (error) throw new Error(`${what} 읽기 실패 (${error.code ?? 'unknown'}: ${error.message ?? ''})`)
  const rows = (data ?? []) as T[]
  if (rows.length >= LIMIT) throw new Error(`${what} 이 ${LIMIT} 행을 넘었다 — 페이징이 필요하다`)
  return rows
}
type Row = Record<string, unknown>

export interface Inquiry { id: string; slug: string; question: string; skillIds: string[]; status: InquiryStatus; conclusionItemId: string | null; uncertainty: string | null; updatedAt: string; links: number }
export interface InquiryLink { id: string; inquiryId: string; itemId: string | null; evidenceId: string | null; role: InquiryRole; note: string | null }

export async function listInquiries(): Promise<Inquiry[]> {
  const [rows, links] = await Promise.all([
    read<Row>('탐구 질문', db().from('knowledge_inquiries').select('id,slug,question,skill_ids,status,conclusion_item_id,uncertainty,updated_at').order('updated_at', { ascending: false }).limit(LIMIT)),
    read<Row>('탐구 연결', db().from('knowledge_inquiry_links').select('inquiry_id').limit(LIMIT)),
  ])
  const count = new Map<string, number>()
  for (const l of links) count.set(String(l.inquiry_id), (count.get(String(l.inquiry_id)) ?? 0) + 1)
  return rows.map((r) => ({
    id: String(r.id), slug: String(r.slug), question: String(r.question), skillIds: (r.skill_ids as string[]) ?? [],
    status: isInquiryStatus(r.status) ? r.status : 'open', conclusionItemId: (r.conclusion_item_id as string | null) ?? null,
    uncertainty: (r.uncertainty as string | null) ?? null, updatedAt: String(r.updated_at), links: count.get(String(r.id)) ?? 0,
  }))
}

export async function loadInquiry(slug: string): Promise<{ inquiry: Inquiry; links: InquiryLink[] } | null> {
  const rows = await read<Row>('탐구 질문', db().from('knowledge_inquiries').select('id,slug,question,skill_ids,status,conclusion_item_id,uncertainty,updated_at').eq('slug', slug).limit(1))
  const r = rows[0]
  if (!r) return null
  const links = await read<Row>('탐구 연결', db().from('knowledge_inquiry_links').select('id,inquiry_id,item_id,evidence_id,role,note').eq('inquiry_id', String(r.id)).order('created_at').limit(LIMIT))
  return {
    inquiry: {
      id: String(r.id), slug: String(r.slug), question: String(r.question), skillIds: (r.skill_ids as string[]) ?? [],
      status: isInquiryStatus(r.status) ? r.status : 'open', conclusionItemId: (r.conclusion_item_id as string | null) ?? null,
      uncertainty: (r.uncertainty as string | null) ?? null, updatedAt: String(r.updated_at), links: links.length,
    },
    links: links.map((l) => ({
      id: String(l.id), inquiryId: String(l.inquiry_id), itemId: (l.item_id as string | null) ?? null, evidenceId: (l.evidence_id as string | null) ?? null,
      role: isInquiryRole(l.role) ? l.role : 'uncertain', note: (l.note as string | null) ?? null,
    })),
  }
}

export interface ResearchSource { id: string; citation: string; doi: string | null; url: string | null; design: ResearchDesign; population: string | null; l2Context: boolean | null; year: number | null; note: string | null; evidence: number }
export async function listResearchSources(): Promise<ResearchSource[]> {
  const [rows, ev] = await Promise.all([
    read<Row>('연구 서지', db().from('knowledge_research_sources').select('id,citation,doi,url,design,population,l2_context,year,note').order('created_at', { ascending: false }).limit(LIMIT)),
    read<Row>('연구 근거', db().from('knowledge_evidence').select('research_source_id').eq('source_type', 'research').limit(LIMIT)),
  ])
  const count = new Map<string, number>()
  for (const e of ev) count.set(String(e.research_source_id), (count.get(String(e.research_source_id)) ?? 0) + 1)
  return rows.map((r) => ({
    id: String(r.id), citation: String(r.citation), doi: (r.doi as string | null) ?? null, url: (r.url as string | null) ?? null,
    design: isResearchDesign(r.design) ? r.design : 'expert_opinion', population: (r.population as string | null) ?? null,
    l2Context: (r.l2_context as boolean | null) ?? null, year: (r.year as number | null) ?? null, note: (r.note as string | null) ?? null,
    evidence: count.get(String(r.id)) ?? 0,
  }))
}

export interface Trial { id: string; applicationId: string; design: Record<string, unknown>; status: TrialStatus; synthetic: boolean; result: TrialResult | null; resultSummary: string | null; analyzedAt: string | null; createdAt: string
  /** F7-4 표본이 바뀌어 재계산이 필요하다 — 있으면 결과를 유효 근거로 보이지 않는다(열은 F7 적용 뒤에만 · 없으면 null) */
  reviewRequiredAt: string | null }
export interface Application {
  id: string; itemId: string; surface: AppSurface; surfaceRef: string; version: number; status: AppStatus; statusReason: string | null
  audience: Record<string, unknown>; exclusions: Record<string, unknown>; releasedAt: string | null; updatedAt: string; trials: Trial[]
  /** 이 적용에 묶인 학습자 수행 기록 수(합성 · 실제) */
  attempts: { real: number; synthetic: number }
}
export async function listApplications(): Promise<Application[]> {
  const [apps, trials, attempts] = await Promise.all([
    read<Row>('제품 적용', db().from('knowledge_applications').select('id,item_id,surface,surface_ref,version,status,status_reason,audience,exclusions,released_at,updated_at').order('updated_at', { ascending: false }).limit(LIMIT)),
    read<Row>('효과 검증', db().from('knowledge_trials').select('*').order('created_at').limit(LIMIT)),
    read<Row>('수행 기록', db().from('learning_task_attempts').select('application_id,synthetic').not('application_id', 'is', null).limit(LIMIT)),
  ])
  return apps.map((a) => ({
    id: String(a.id), itemId: String(a.item_id), surface: isAppSurface(a.surface) ? a.surface : 'module_task', surfaceRef: String(a.surface_ref),
    version: Number(a.version), status: isAppStatus(a.status) ? a.status : 'draft', statusReason: (a.status_reason as string | null) ?? null,
    audience: (a.audience as Record<string, unknown>) ?? {}, exclusions: (a.exclusions as Record<string, unknown>) ?? {},
    releasedAt: (a.released_at as string | null) ?? null, updatedAt: String(a.updated_at),
    trials: trials.filter((t) => t.application_id === a.id).map((t) => ({
      id: String(t.id), applicationId: String(t.application_id), design: (t.design as Record<string, unknown>) ?? {}, status: t.status as TrialStatus,
      synthetic: Boolean(t.synthetic), result: (t.result as TrialResult | null) ?? null, resultSummary: (t.result_summary as string | null) ?? null,
      analyzedAt: (t.analyzed_at as string | null) ?? null, createdAt: String(t.created_at),
      reviewRequiredAt: (t.review_required_at as string | null | undefined) ?? null,
    })),
    attempts: {
      real: attempts.filter((x) => x.application_id === a.id && !x.synthetic).length,
      synthetic: attempts.filter((x) => x.application_id === a.id && x.synthetic).length,
    },
  }))
}
