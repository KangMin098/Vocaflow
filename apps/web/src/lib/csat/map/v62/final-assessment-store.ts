// apps/web/src/lib/csat/map/v62/final-assessment-store.ts
// Read/bind the learner-declared final assessment (20261023082930_csat_goal_final_assessment.sql — approval required).
// Missing table/RPC = not installed (attainment stays unconfirmed). Other errors propagate or surface as read_error; never an empty binding.
import type { SupabaseClient } from '@supabase/supabase-js'

import { GoalVersionConflictError, loadLatestGoal } from '../v4/plan-store'
import { parseFinalBinding, type FinalAssessmentBinding, type FinalBindingRead } from './final-assessment'

const MISSING = new Set(['42P01', 'PGRST205', '42883', 'PGRST202'])
export class FinalAssessmentUnavailableError extends Error {}
export class FinalAssessmentInputError extends Error {}
export class FinalAssessmentConflictError extends Error {}

type Row = { id: number; goal_version_id: number; assessment_date: string; created_at: string }
const bindingOf = (r: Row): FinalAssessmentBinding => ({ id: Number(r.id), goalVersionId: Number(r.goal_version_id), date: r.assessment_date, createdAt: r.created_at })

export async function loadFinalAssessment(db: SupabaseClient, userId: string, goalVersionId: number | null): Promise<FinalBindingRead> {
  if (goalVersionId === null) return { status: 'ok', binding: null }
  const { data, error } = await db.from('csat_map_goal_final_assessment').select('id, goal_version_id, assessment_date, created_at')
    .eq('user_id', userId).eq('goal_version_id', goalVersionId).limit(1)
  if (error) return error.code && MISSING.has(error.code) ? { status: 'not_installed' } : { status: 'error' }
  const r = (data ?? [])[0] as Row | undefined
  return { status: 'ok', binding: r ? bindingOf(r) : null }
}

export async function bindFinalAssessment(db: SupabaseClient, userId: string, body: unknown): Promise<{ binding: FinalAssessmentBinding; reused: boolean }> {
  const raw = (body as Record<string, unknown> | null)?.clientKey
  if (typeof raw !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw)) throw new FinalAssessmentInputError('요청 키 형식이 맞지 않아요')
  const byKey = async () => {
    const { data, error } = await db.from('csat_map_goal_final_assessment').select('id, goal_version_id, assessment_date, created_at').eq('user_id', userId).eq('client_key', raw).limit(1)
    if (error) {
      if (error.code && MISSING.has(error.code)) throw new FinalAssessmentUnavailableError('최종 평가 저장 구조가 아직 적용되지 않았어요 — 저장하지 않았어요')
      throw new Error(`최종 평가 확인 실패: ${error.message}`)
    }
    const r = (data ?? [])[0] as Row | undefined
    return r ? bindingOf(r) : null
  }
  const b = body as Record<string, unknown>
  const same = (x: FinalAssessmentBinding) => x.goalVersionId === b.goalVersionId && x.date === b.date
  // Replay first: an exact earlier success stays valid even after the goal moved on.
  const prior = await byKey()
  if (prior) {
    if (!same(prior)) throw new FinalAssessmentConflictError('같은 요청 키로 다른 최종 평가가 왔어요 — 화면을 새로 고쳐 주세요')
    return { binding: prior, reused: true }
  }
  const parsed = parseFinalBinding(body, await loadLatestGoal(db, userId))
  if (!parsed.ok) {
    if (parsed.code === 'goal_changed') throw new GoalVersionConflictError(parsed.error)
    throw new FinalAssessmentInputError(parsed.error)
  }
  const { error } = await db.rpc('csat_map_goal_final_assessment_bind', { p_user: userId, p_goal: parsed.goalVersionId, p_date: parsed.date, p_client_key: raw })
  if (error) {
    if (error.code && MISSING.has(error.code)) throw new FinalAssessmentUnavailableError('최종 평가 저장 구조가 아직 적용되지 않았어요 — 저장하지 않았어요')
    if (error.code === 'PT409' && error.message === 'goal_changed') throw new GoalVersionConflictError('목표가 다른 화면에서 바뀌었어요 — 새로고침한 뒤 다시 확인해 주세요')
    if (error.code === 'PT409' && error.message === 'final_assessment_bound') throw new FinalAssessmentConflictError('이 목표의 최종 평가는 이미 정해졌어요 — 바꾸려면 목표를 새로 저장해요')
    if (error.code === '22023') throw new FinalAssessmentInputError('최종 평가 응시일이 목표 조건과 맞지 않아요')
    throw new Error(`최종 평가 저장 실패: ${error.message}`)
  }
  // Acknowledge only the immutable committed row.
  const committed = await byKey()
  if (!committed || !same(committed)) throw new Error('최종 평가 저장 결과를 확인하지 못했어요 — 같은 요청으로 다시 시도해 주세요')
  return { binding: committed, reused: false }
}
