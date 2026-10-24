// apps/web/src/lib/csat/bridge/exposure-reader.ts
//
// H4 — P6 노출 원장 서버 reader(읽기 전용). 학습자 세션 클라이언트로 본인 행만 읽는다(RLS learning_exposures_own_select).
//   표 · 함수가 없으면 not_installed(정상 0건과 구별), 다른 오류 · 잘림은 error — 일부만 읽은 원장을 「노출 없음」 근거로 쓰지 않는다.
//   쓰기(learning_exposure_record)는 하지 않는다 — 기록 경로는 강의 · 판단 장면 owner(T-0147) 몫이다.
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { parseIndependence, type ExposureRow, type IndependenceStatus } from './exposure-consumer'

const LIMIT = 2000
const MISSING = new Set(['42P01', 'PGRST205', 'PGRST202', '42883', '42703', 'PGRST204'])

export type ExposureRead =
  | { status: 'ok'; rows: ExposureRow[]; trackingStartedAt: string | null }
  | { status: 'not_installed' }
  | { status: 'error' }

type Row = Record<string, unknown>
const code = (e: unknown) => (e as { code?: string } | null)?.code ?? ''

export async function readExposures(db: SupabaseClient, userId: string, itemRefs: readonly string[]): Promise<ExposureRead> {
  const refs = [...new Set(itemRefs)]
  const [ex, tr] = await Promise.all([
    refs.length
      ? db.from('learning_exposures').select('item_ref, kind, source, received_at, clock_suspect, analysis_version', { count: 'exact' }).eq('user_id', userId).in('item_ref', refs).limit(LIMIT)
      : Promise.resolve({ data: [] as Row[], error: null, count: 0 }),
    db.from('learning_exposure_tracking').select('started_at').limit(1),
  ])
  if (ex.error || tr.error) return MISSING.has(code(ex.error)) || MISSING.has(code(tr.error)) ? { status: 'not_installed' } : { status: 'error' }
  if (!Array.isArray(ex.data) || ex.count !== ex.data.length || ex.data.length >= LIMIT) return { status: 'error' }
  const rows: ExposureRow[] = []
  for (const r of ex.data as Row[]) {
    if (typeof r.item_ref !== 'string' || (r.kind !== 'answer_direct' && r.kind !== 'decisive_hint') || typeof r.received_at !== 'string') return { status: 'error' }
    rows.push({ itemRef: r.item_ref, kind: r.kind, source: String(r.source), receivedAt: r.received_at, clockSuspect: r.clock_suspect === true, analysisVersion: typeof r.analysis_version === 'number' ? r.analysis_version : null })
  }
  const started = Array.isArray(tr.data) && tr.data[0] && typeof (tr.data[0] as Row).started_at === 'string' ? String((tr.data[0] as Row).started_at) : null
  return { status: 'ok', rows, trackingStartedAt: started }
}

/** 시도별 독립 후보 판정(P6 RPC) — 하나라도 실패하면 그 시도는 null(보류). 함수가 없으면 not_installed */
export async function readIndependence(db: SupabaseClient, attemptIds: readonly string[]): Promise<{ status: 'ok'; byAttempt: Record<string, IndependenceStatus | null> } | { status: 'not_installed' }> {
  const byAttempt: Record<string, IndependenceStatus | null> = {}
  for (const id of [...new Set(attemptIds)]) {
    const r = await db.rpc('learning_attempt_independence', { p_attempt_id: Number(id) })
    if (r.error && MISSING.has(code(r.error))) return { status: 'not_installed' }
    byAttempt[id] = r.error ? null : parseIndependence(r.data)
  }
  return { status: 'ok', byAttempt }
}
