// apps/web/src/lib/csat/bridge/exposure-reader.ts
//
// H4 — P6 노출 원장 서버 reader(읽기 전용). 쓰기(learning_exposure_record)는 하지 않는다 — 기록 경로는 판단 장면 owner(T-0147) 몫이다.
//   인증 경계: 사용자 id 를 인자로 받지 않는다 — 학습자 세션 클라이언트의 auth.getUser() 로 서버가 확인한 사용자만 쓰고,
//   RLS(learning_exposures_own_select)가 본인 행만 돌려준다. 로그인이 없으면 unauthenticated(빈 원장으로 보지 않는다).
//   K6-a: 문항으로 걸러 읽지 않고 그 학습자 원장 전체를 읽는다(같은 지문의 다른 문항 노출을 놓치지 않게). 지문 키는 앱 원장과 같은 정규화 해시.
//   표 · 함수가 없으면 not_installed(정상 0건과 구별), 다른 오류 · 잘림은 error — 일부만 읽은 원장을 「노출 없음」 근거로 쓰지 않는다.
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizedPassageKey } from '../map/v62/exposure-ledger'
import { parseIndependence, type ExposureRow, type IndependenceStatus } from './exposure-consumer'

const LIMIT = 2000
const MISSING = new Set(['42P01', 'PGRST205', 'PGRST202', '42883', '42703', 'PGRST204'])

export type ExposureRead =
  | { status: 'ok'; rows: ExposureRow[]; trackingStartedAt: string | null }
  | { status: 'not_installed' }
  | { status: 'unauthenticated' }
  | { status: 'error' }

type Row = Record<string, unknown>
const code = (e: unknown) => (e as { code?: string } | null)?.code ?? ''

/** db = 학습자 세션 클라이언트(lib/supabase/server createClient) — 서버 전용 클라이언트를 넘기면 getUser 가 사용자를 주지 않아 unauthenticated */
export async function readExposures(db: SupabaseClient): Promise<ExposureRead> {
  const { data: auth, error: authErr } = await db.auth.getUser()
  if (authErr || !auth?.user?.id) return { status: 'unauthenticated' }
  const userId = auth.user.id
  const [ex, tr] = await Promise.all([
    db.from('learning_exposures').select('item_ref, kind, source, received_at, clock_suspect, analysis_version', { count: 'exact' }).eq('user_id', userId).limit(LIMIT),
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

/** 문항(`시험#번호`) → 정규화 지문 키. 조회 실패면 null(전체 판정 보류), 지문이 비면 그 문항만 키 없음 */
export async function readPassageKeys(db: SupabaseClient, itemRefs: readonly string[]): Promise<Record<string, string> | null> {
  const exams = [...new Set(itemRefs.map((x) => x.split('#')[0]).filter(Boolean))]
  const out: Record<string, string> = {}
  for (let i = 0; i < exams.length; i += 10) {
    const { data, error } = await db.from('csat_items').select('exam_id, no, passage').in('exam_id', exams.slice(i, i + 10))
    if (error || !Array.isArray(data)) return null
    for (const row of data as { exam_id: string; no: number; passage: unknown }[]) {
      const k = normalizedPassageKey(row.passage)
      if (k) out[`${row.exam_id}#${row.no}`] = k
    }
  }
  return out
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
