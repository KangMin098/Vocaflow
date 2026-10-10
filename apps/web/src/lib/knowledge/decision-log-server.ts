// apps/web/src/lib/knowledge/decision-log-server.ts
//
// 학습 결정 기록(2026-10-10 · 20261010034932_learning_decisions) — 학습 지도가 단계마다 내린 원리 기반 추천을
// 그때의 근거(관찰 · 정책 버전 · 원리 · 방법 · 과제 id 와 버전 · 적용 · 대상 조건 · 원리 근거 id)와 함께 남긴다.
// 서버가 다시 계산한 결정만 쓴다(클라이언트 값을 믿지 않는다) · 같은 근거의 같은 결정은 fingerprint 로 한 번만.
// 실패해도 학습 지도는 그린다 — 기록만 빠지고 서버 로그에 남는다.
import 'server-only'

import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createAdminClient } from '@/lib/supabase/admin'

import type { LearningDecision } from './learning-decision'

export interface DecisionLogEntry {
  decision: LearningDecision
  application: { id: string; version: number; audience: Record<string, unknown> } | null
}

/** 같은 학습자 · 같은 근거 · 같은 결정이면 같은 값 — 화면을 다시 열어도 한 번만 남는다 */
export function decisionFingerprint(e: DecisionLogEntry): string {
  const t = e.decision.trace
  return createHash('sha256')
    .update(JSON.stringify([t.policyVersion, t.stepKey, t.findTaskId, e.decision.action, t.focus, t.observation, t.versions, t.principleId, t.methodId, t.taskId, e.application?.id ?? null, e.application?.version ?? null]))
    .digest('hex')
}

export async function recordDecisions(userId: string, synthetic: boolean, entries: readonly DecisionLogEntry[], client: SupabaseClient = createAdminClient() as unknown as SupabaseClient): Promise<{ written: number }> {
  const real = entries.filter((e) => e.decision.action !== 'no_principle')
  if (real.length === 0) return { written: 0 }
  // 원리에 연결된 근거 id — 결정 당시 스냅숏(나중에 근거가 바뀌어도 이 결정이 무엇에 기댔는지 남는다)
  const principleIds = [...new Set(real.map((e) => e.decision.trace.principleId).filter((x): x is string => !!x))]
  const evidenceBy = new Map<string, string[]>()
  if (principleIds.length) {
    const { data, error } = await client.from('knowledge_evidence').select('id,item_id').in('item_id', principleIds).limit(1000)
    if (error) throw new Error(`근거 조회 실패: ${error.message}`)
    for (const r of (data ?? []) as { id: string; item_id: string }[]) evidenceBy.set(r.item_id, [...(evidenceBy.get(r.item_id) ?? []), r.id])
  }
  const rows = real.map((e) => {
    const t = e.decision.trace
    return {
      user_id: userId,
      step_key: t.stepKey,
      find_task_id: t.findTaskId,
      policy_version: t.policyVersion,
      action: e.decision.action,
      focus: t.focus,
      observation: t.observation,
      reason: e.decision.reason.slice(0, 2000),
      principle_id: t.principleId,
      principle_version: t.versions.principle,
      method_id: t.methodId,
      method_version: t.versions.method,
      task_id: t.taskId,
      task_version: t.versions.task,
      application_id: e.application?.id ?? null,
      application_version: e.application?.version ?? null,
      applicability: e.application?.audience ?? {},
      evidence_ids: t.principleId ? evidenceBy.get(t.principleId) ?? [] : [],
      synthetic,
      fingerprint: decisionFingerprint(e),
    }
  })
  const { data, error } = await client.from('learning_decisions').upsert(rows, { onConflict: 'user_id,fingerprint', ignoreDuplicates: true }).select('id')
  if (error) throw new Error(`결정 기록 실패: ${error.message}`)
  return { written: data?.length ?? 0 }
}
