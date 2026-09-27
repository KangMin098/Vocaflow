// apps/web/src/lib/csat/approvals.ts
//
// **교재 공장 승인 기록** — 되돌릴 수 없는 동작 앞에 남는 한 행.
//
// ── 왜 생겼나 (실측 2026-09-23 · DD-69 B5) ──────────────────────────
// `csat_*` · `textbook_*` 전체에 승인 컬럼이 **0개**였다. 즉 이 파이프라인에는 「사람이
// 봤다」는 흔적이 어디에도 없었고, 그 결과가 실측으로 드러났다 — 3인 검수 1/60 인 권이
// 카탈로그에 「냈음」으로 서고 공개 URL 로 열려 있었다. 게이트가 없어서가 아니라
// **게이트를 지난 흔적을 남길 자리가 없어서**다.
//
// ⚠️ **표가 없을 수 있다.** 마이그레이션 `20260923060000` 적용 전에는 조회가 오류다.
//   그 오류를 빈 배열로 뭉개면 화면이 「승인이 하나도 없다」고 **거짓말**한다 —
//   「저장소가 없다」와 「아직 아무도 승인 안 했다」는 할 일이 정반대다
//   (마이그레이션 적용 vs 승인 누르기). `my-shelf-query.ts` 가 세운 그 규칙을 따른다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

export type ApprovalStage =
  | 'evidence'
  | 'source'
  | 'market'
  | 'blueprint'
  | 'material'
  | 'author'
  | 'explain'
  | 'review'
  | 'press'

export type ApprovalSubjectKind = 'volume' | 'item' | 'article' | 'type' | 'gate' | 'run'
export type ApprovalDecision = 'approved' | 'rejected' | 'withdrawn'

export interface ApprovalRow {
  stage: ApprovalStage
  subjectKind: ApprovalSubjectKind
  subjectId: string
  decision: ApprovalDecision
  reason: string | null
  decidedBy: string
  decidedAt: string
}

export interface ApprovalView {
  /** 표를 **실제로 읽었는가**. false = 저장소가 없다(0건과 다르다). */
  available: boolean
  error: string | null
  /** 대상별 **최신** 결정. 키는 `<subjectKind>:<subjectId>`. */
  latest: Map<string, ApprovalRow>
}

export const UNREAD_APPROVALS: ApprovalView = {
  available: false,
  error: null,
  latest: new Map(),
}

const KEY = (kind: string, id: string) => `${kind}:${id}`

/** 그 단계의 승인 기록을 읽는다. 대상마다 **최신 한 건**만 남긴다. */
export async function loadApprovals(stage: ApprovalStage): Promise<ApprovalView> {
  const db = createAdminClient() as unknown as SupabaseClient
  const { data, error } = await db
    .from('csat_pipeline_approvals')
    .select('stage, subject_kind, subject_id, decision, reason, decided_by, decided_at')
    .eq('stage', stage)
    // 최신이 먼저 — 아래에서 처음 본 것만 남긴다.
    .order('decided_at', { ascending: false })
    .limit(500)

  if (error) {
    // 표가 없거나 조회가 깨졌다 — **0건으로 적지 않는다.**
    return { ...UNREAD_APPROVALS, error: `승인 기록을 못 읽었다: ${error.message}` }
  }

  const latest = new Map<string, ApprovalRow>()
  for (const r of (data ?? []) as Record<string, string>[]) {
    const key = KEY(r.subject_kind!, r.subject_id!)
    if (latest.has(key)) continue // 이미 더 최신 것을 봤다
    latest.set(key, {
      stage: r.stage as ApprovalStage,
      subjectKind: r.subject_kind as ApprovalSubjectKind,
      subjectId: r.subject_id!,
      decision: r.decision as ApprovalDecision,
      reason: r.reason ?? null,
      decidedBy: r.decided_by!,
      decidedAt: r.decided_at!,
    })
  }
  return { available: true, error: null, latest }
}

/** 그 대상의 최신 결정. 없으면 `null` — 「아직 아무도 안 봤다」다. */
export function approvalOf(
  view: ApprovalView,
  kind: ApprovalSubjectKind,
  id: string,
): ApprovalRow | null {
  return view.latest.get(KEY(kind, id)) ?? null
}

export interface RecordApprovalInput {
  stage: ApprovalStage
  subjectKind: ApprovalSubjectKind
  subjectId: string
  decision: ApprovalDecision
  /** 반려·철회는 **10자 이상**이어야 한다(DB CHECK 와 같은 규칙 — 여기서 먼저 막는다). */
  reason?: string | null
  decidedBy: string
  /** 무엇을 보고 결정했나 — 그때의 눈금값. 나중에 「그때는 이랬다」를 재구성하는 유일한 근거다. */
  evidence?: Record<string, unknown>
}

export interface RecordApprovalResult {
  ok: boolean
  error?: string
}

/**
 * 승인 한 건을 남긴다.
 *
 * ⚠️ 실패를 **던지지 않고 값으로** 돌려준다 — 예외로 올리면 화면이 빈 오류 화면이 되고
 *   무엇이 실패했는지가 사라진다(`sourcing/actions.ts` 가 `/admin/db` 에서 배운 것).
 */
export async function recordApproval(input: RecordApprovalInput): Promise<RecordApprovalResult> {
  const reason = input.reason?.trim() || null
  if (input.decision !== 'approved' && (reason == null || reason.length < 10)) {
    // DB CHECK 이 막기 전에 여기서 막는다 — 사유 없는 반려는 다음 세션에게
    // 「막혔다」만 남기고 무엇을 고쳐야 하는지는 안 남긴다.
    return { ok: false, error: '반려·철회는 사유를 10자 이상 적어야 한다' }
  }

  const db = createAdminClient() as unknown as SupabaseClient
  const { error } = await db.from('csat_pipeline_approvals').insert({
    stage: input.stage,
    subject_kind: input.subjectKind,
    subject_id: input.subjectId,
    decision: input.decision,
    reason,
    decided_by: input.decidedBy,
    evidence: input.evidence ?? {},
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
