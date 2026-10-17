// apps/web/src/lib/csat/map/v62/exposure-ledger.ts
//
// 학습자 노출 원장 reader(읽기 전용 · 서버). assessment-exposure.ts 의 판정 입력을 만든다.
// 원장 6개를 모두 읽는다 — G2 시도 · G2 세션(삭제 포함) · 함정 훈련 · 문제지 풀이 · 복습 큐 · 진단 응답(#281 E01: 앞의 둘만 세면 trap 노출이 빠진다).
// 원장 하나라도 실패하거나 창(LIMIT)을 채우면 status=error — 일부만 읽은 결과를 「미노출」 근거로 쓰지 않는다.
// 지문 식별은 정규화(소문자 · 공백 하나) 해시 — 같은 지문을 공유한 다른 문항도 노출로 본다.
import 'server-only'
import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { canonicalJson } from './canonical-json'
import type { ExposureEvent, ExposureLedger, ExposureSource, FqReader } from './assessment-exposure'

const LIMIT = 2000

type Row = Record<string, unknown>

const ev = (itemRef: string, source: ExposureSource, o: Partial<ExposureEvent> = {}): ExposureEvent => ({
  itemRef, source, taskKey: null, activity: null, phase: null, helpLevel: null, sessionId: null, contentHash: null, deleted: false, ...o,
})

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** 정규화 지문 키 — 빈 지문은 키가 없다(식별 불가 → unknown) */
export function normalizedPassageKey(passage: unknown): string | null {
  if (passage === null || passage === undefined) return null
  // Normalize source strings BEFORE JSON encoding turns newlines/tabs into
  // escape sequences. Object ordering is still canonical and deterministic.
  const normalize = (v: unknown): unknown => typeof v === 'string' ? v.toLowerCase().replace(/\s+/g, ' ').trim() : Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)])) : v
  const value = canonicalJson(normalize(passage))
  if (value === '""' || value === '[]' || value === '{}' || value === 'null') return null
  return createHash('sha256').update(value).digest('hex')
}

export async function loadExposureLedger(db: SupabaseClient, userId: string, candidates: readonly string[]): Promise<ExposureLedger> {
  const [att, sess, trap, paper, queue, dx] = await Promise.all([
    db.from('learning_task_attempts').select('item_ref, task_key, activity, phase, help_level, session_id, content_hash', { count: 'exact' }).eq('user_id', userId).not('item_ref', 'is', null).limit(LIMIT),
    db.from('learning_sessions').select('id, item_ref, activity, phase, task_key, deleted_at', { count: 'exact' }).eq('user_id', userId).not('item_ref', 'is', null).limit(LIMIT),
    db.from('csat_trap_attempts').select('item_id', { count: 'exact' }).eq('user_id', userId).limit(LIMIT),
    db.from('csat_session_attempts').select('item_id', { count: 'exact' }).eq('user_id', userId).limit(LIMIT),
    db.from('csat_review_queue').select('item_id', { count: 'exact' }).eq('user_id', userId).limit(LIMIT),
    db.from('csat_dx_response').select('item_id, csat_dx_session!inner(user_id)', { count: 'exact' }).eq('csat_dx_session.user_id', userId).not('item_id', 'is', null).limit(LIMIT),
  ])
  const results: [ExposureSource, { data: unknown; error: unknown; count: number | null }][] = [['g2_attempt', att], ['g2_session', sess], ['trap', trap], ['paper', paper], ['review_queue', queue], ['dx_response', dx]]
  // PostgREST can cap rows below LIMIT. A missing count is not zero.
  const failed = results.filter(([, r]) => r.error || !Array.isArray(r.data) || r.count !== r.data.length || r.data.length >= LIMIT).map(([s]) => s)
  if (failed.length) return { status: 'error', failed }
  const events: ExposureEvent[] = []
  for (const r of att.data as Row[]) {
    const item = str(r.item_ref)
    if (item) events.push(ev(item, 'g2_attempt', { taskKey: str(r.task_key), activity: str(r.activity), phase: str(r.phase), helpLevel: str(r.help_level), sessionId: str(r.session_id), contentHash: str(r.content_hash) }))
  }
  for (const r of sess.data as Row[]) {
    const item = str(r.item_ref)
    if (item) events.push(ev(item, 'g2_session', { taskKey: str(r.task_key), activity: str(r.activity), phase: str(r.phase), sessionId: str(r.id), deleted: r.deleted_at !== null && r.deleted_at !== undefined }))
  }
  for (const [source, res] of [['trap', trap], ['paper', paper], ['review_queue', queue], ['dx_response', dx]] as const) {
    for (const r of res.data as Row[]) {
      const item = str(r.item_id)
      if (item) events.push(ev(item, source))
    }
  }
  const refs = [...new Set([...candidates, ...events.map((e) => e.itemRef)])]
  const exams = [...new Set(refs.map((x) => x.split('#')[0]).filter(Boolean))]
  const passageKeys: Record<string, string> = {}
  for (let i = 0; i < exams.length; i += 10) {
    const { data, error } = await db.from('csat_items').select('exam_id, no, passage').in('exam_id', exams.slice(i, i + 10))
    if (error || !Array.isArray(data)) return { status: 'error', failed: ['g2_attempt'] }
    for (const row of data as { exam_id: string; no: number; passage: unknown }[]) {
      const k = normalizedPassageKey(row.passage)
      if (k) passageKeys[`${row.exam_id}#${row.no}`] = k
    }
  }
  return { status: 'ok', events, passageKeys }
}

/**
 * 정식 자격(I1 content_qualification) reader. 표가 없으면 not_installed(정상 0건과 구별), 다른 오류는 error.
 * 표가 생겨도 이 저장소에는 아직 역할 · TASK · hash 결속 판정기가 없다 — 그 전까지 적격 목록은 비워 둔다(행이 있다고 적격으로 올리지 않는다).
 */
export async function loadFqReader(db: SupabaseClient): Promise<FqReader> {
  const { data, error, count } = await db.from('content_qualification').select('id', { count: 'exact' }).limit(1)
  if (!error) return Array.isArray(data) && typeof count === 'number' && count >= 0 ? { status: 'installed', eligible: [] } : { status: 'error' }
  const code = (error as { code?: string }).code
  if (code === '42P01' || code === 'PGRST205') return { status: 'not_installed' }
  return { status: 'error' }
}
