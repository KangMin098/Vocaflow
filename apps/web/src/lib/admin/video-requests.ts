// apps/web/src/lib/admin/video-requests.ts
//
// **영상 요청 — 화면이 읽는 것.** 쓰기는 `app/admin/video/actions.ts` 의 RPC 호출만.
//
// 요청의 대상 목록은 기획 보드(`loadPlan`)와 **같은 출처**에서 만든다 — 규칙 편 구성요소
// (`platformComponents`)와 권별 후보. 대상 목록을 따로 만들면 기획에 보이는 자리와 요청할 수
// 있는 자리가 갈린다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DesignChecks,
  RequestAudience,
  RequestDesign,
  RequestPhase,
  RequestPlan,
  RequestPurpose,
  ReviewDecision,
} from '@vocaflow/video-factory/requests'

import { platformComponents } from '@/lib/video/components'
import type { PlanBoard } from './video-console-shape'

type AdminClient = SupabaseClient

export interface VideoDomain {
  id: string
  label: string
  description: string
  target_kinds: string[]
  allow_custom_target: boolean
  default_formats: string[]
  enabled: boolean
  sort: number
}

export interface RequestTarget {
  key: string
  label: string
  kind: string
  /** 이 대상 뒤의 재고 — 못 셌으면 null. 0 이면 요청은 되지만 화면이 경고한다 */
  backing: number | null
  /** 이미 규칙 편이 있는가 — 있으면 설계의 출발점이 된다 */
  hasRuleVideo: boolean
}

export interface VideoRequestRow {
  id: string
  domain_id: string
  target_key: string
  target_label: string
  purpose: RequestPurpose
  audience: RequestAudience
  formats: string[]
  memo: string
  video_id: string | null
  phase: RequestPhase
  current_rev: number
  error: string | null
  created_at: string
  updated_at: string
}

export interface RevisionRow {
  rev: number
  plan: RequestPlan
  design: RequestDesign
  checks: DesignChecks | Record<string, never>
  author: string
  created_at: string
}

export interface ReviewRow {
  rev: number
  decision: ReviewDecision
  comment: string
  created_at: string
}

export interface EvaluationRow {
  rev: number
  spec: { pass?: number; fail?: number; unknown?: number; axes?: { label: string; verdict: string; value: string; limit?: string }[] }
  outcome: {
    started?: number | null
    completed?: number | null
    completionRate?: number | null
    verdict?: string
    note?: string | null
    cta?: { verdict: string; note: string }
  }
  measured_at: string
}

export interface JobRow {
  stage: string
  error: string | null
  seconds: number | null
  updated_at: string
}

export interface RequestBoard {
  /** 마이그레이션 전이면 null — 탭이 「아직 없다」를 말한다(빈 목록과 구분) */
  ready: boolean
  domains: VideoDomain[]
  targets: RequestTarget[]
  requests: VideoRequestRow[]
}

export interface RequestDetail {
  request: VideoRequestRow
  domain: VideoDomain | null
  revisions: RevisionRow[]
  reviews: ReviewRow[]
  evaluations: EvaluationRow[]
  job: JobRow | null
}

/** 대상 후보 — 규칙 편 구성요소 + 기획 보드의 권별 후보(재고 포함) */
export function requestTargets(plan: PlanBoard): RequestTarget[] {
  const rule: RequestTarget[] = platformComponents().map((c) => ({
    key: c.id,
    label: c.name,
    kind: c.kind,
    backing: null,
    hasRuleVideo: true,
  }))
  const volumes: RequestTarget[] = [...plan.next, ...plan.blocked].map((r) => ({
    key: r.id,
    label: r.name,
    kind: r.kind,
    backing: r.backing,
    hasRuleVideo: false,
  }))
  return [...rule, ...volumes]
}

export async function loadRequestBoard(db: AdminClient, plan: PlanBoard): Promise<RequestBoard> {
  const [d, r] = await Promise.all([
    db.from('video_domains').select('*').order('sort'),
    db.from('video_requests').select('*').order('created_at', { ascending: false }).limit(200),
  ])
  // 표가 없으면(마이그레이션 전) 오류다 — 0건으로 삼키지 않는다
  if (d.error || r.error) return { ready: false, domains: [], targets: [], requests: [] }
  return {
    ready: true,
    domains: (d.data ?? []) as VideoDomain[],
    targets: requestTargets(plan),
    requests: (r.data ?? []) as VideoRequestRow[],
  }
}

export async function loadRequestDetail(db: AdminClient, id: string): Promise<RequestDetail | null> {
  const { data: request, error } = await db.from('video_requests').select('*').eq('id', id).maybeSingle()
  if (error || !request) return null
  const req = request as VideoRequestRow
  const [domain, revisions, reviews, evaluations, job] = await Promise.all([
    db.from('video_domains').select('*').eq('id', req.domain_id).maybeSingle(),
    db.from('video_request_revisions').select('rev,plan,design,checks,author,created_at').eq('request_id', id).order('rev', { ascending: false }),
    db.from('video_request_reviews').select('rev,decision,comment,created_at').eq('request_id', id).order('created_at', { ascending: false }),
    db.from('video_request_evaluations').select('rev,spec,outcome,measured_at').eq('request_id', id).order('rev', { ascending: false }),
    req.video_id
      ? db.from('video_jobs').select('stage,error,seconds,updated_at').eq('video_id', req.video_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  return {
    request: req,
    domain: (domain.data as VideoDomain | null) ?? null,
    revisions: (revisions.data ?? []) as RevisionRow[],
    reviews: (reviews.data ?? []) as ReviewRow[],
    evaluations: (evaluations.data ?? []) as EvaluationRow[],
    job: (job.data as JobRow | null) ?? null,
  }
}
