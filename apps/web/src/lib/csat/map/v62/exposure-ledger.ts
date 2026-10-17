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

/** 원장 한 행(필요한 칸만) — DB-1 content_qualification */
export interface FqRow {
  id: string
  artifact_kind: string
  artifact_ref: string
  artifact_revision: string
  source_revision: string | null
  source_hash: string | null
  gold_revision: string | null
  gold_hash: string | null
  task_id: string
  role: string
  axes: Record<string, { state?: string } | undefined>
  annotation_ref: string | null
  annotation_hash: string | null
  supersedes: string | null
}
export interface FqApprovalRow { id: string; qualification_id: string; scope: string }

export type FqRejection = 'superseded' | 'task' | 'role_axes' | 'source_unbound' | 'gold_unbound' | 'approval_public' | 'approval_assessment' | 'revision_stale' | 'annotation_unbound'

const ASSESS = new Set(['independent_check', 'transfer', 'delayed_check'])
const TEACH = new Set(['source_analysis', 'model_explanation', 'guided_practice'])
const pass = (r: FqRow, k: string) => r.axes?.[k]?.state === 'pass'

/**
 * 원장 행 하나를 지금 공급해도 되는가 — DB fq_role_ok 와 같은 축 규칙 + 결속(원천 · Gold · 현재 revision · 현재 주석 해시) + 철회 안 된 승인.
 * 하나라도 모르면 거절(fail-closed). 학습자 노출(G)은 여기서 보지 않는다 — 공급 시점(unexposedForAssessment).
 * 주석 결속은 I2 정본 칸(content_qualification.annotation_ref · annotation_hash — `_pending_workspace_supply_c_annotation_binding.sql`)으로만 인정한다.
 * 그 칸이 아직 없으면(I2 미적용) 정본 결속을 확인할 수 없으므로 적격 0건이다.
 */
export function fqRowVerdict(
  r: FqRow,
  ctx: { tasks: ReadonlySet<string>; supersededIds: ReadonlySet<string>; approvals: readonly FqApprovalRow[]; revoked: ReadonlySet<string>; currentRevision: string | null; currentAnnotation: string | null },
): { ok: true } | { ok: false; reason: FqRejection } {
  if (ctx.supersededIds.has(r.id)) return { ok: false, reason: 'superseded' }
  if (!ctx.tasks.has(r.task_id)) return { ok: false, reason: 'task' }
  const axesOk = ['A', 'B', 'C', 'F', 'H'].every((k) => pass(r, k)) && (!TEACH.has(r.role) || pass(r, 'D')) && (!ASSESS.has(r.role) || pass(r, 'E'))
  if (!axesOk) return { ok: false, reason: 'role_axes' }
  if (!r.source_revision || !r.source_hash) return { ok: false, reason: 'source_unbound' }
  if (ASSESS.has(r.role) && (!r.gold_revision || !r.gold_hash)) return { ok: false, reason: 'gold_unbound' }
  const live = ctx.approvals.filter((a) => a.qualification_id === r.id && !ctx.revoked.has(a.id))
  if (!live.some((a) => a.scope === 'public')) return { ok: false, reason: 'approval_public' }
  if (ASSESS.has(r.role) && !live.some((a) => a.scope === 'assessment')) return { ok: false, reason: 'approval_assessment' }
  if (!ctx.currentRevision || ctx.currentRevision !== r.artifact_revision) return { ok: false, reason: 'revision_stale' }
  if (!ctx.currentAnnotation || !r.annotation_ref || r.annotation_hash !== ctx.currentAnnotation) return { ok: false, reason: 'annotation_unbound' }
  return { ok: true }
}

/**
 * 정식 자격(I1 content_qualification) reader. 표가 없으면 not_installed(정상 0건과 구별), 다른 오류는 error.
 * 원장은 관리자 전용 RLS 라 학습자 세션으로는 0행이 보인다 — 적격 판정은 서버 전용 클라이언트(`admin`)로만 읽는다.
 * `admin` 이 없거나 원장 · 승인 · 철회 중 하나라도 못 읽으면 적격 0건(installed) 또는 error — 행이 있다고 적격으로 올리지 않는다.
 * 현재 revision 은 DB 정본 함수 supply_artifact_revision(csat_item) 으로, 현재 주석 해시는 `currentAnnotation` 으로 대 본다.
 */
export async function loadFqReader(
  db: SupabaseClient,
  opts: { admin?: SupabaseClient | null; refs?: readonly string[]; tasks?: readonly string[]; currentAnnotation?: (task: string, ref: string) => Promise<string | null> } = {},
): Promise<FqReader> {
  const { data, error, count } = await db.from('content_qualification').select('id', { count: 'exact' }).limit(1)
  if (error) {
    const code = (error as { code?: string }).code
    return code === '42P01' || code === 'PGRST205' ? { status: 'not_installed' } : { status: 'error' }
  }
  if (!Array.isArray(data) || typeof count !== 'number' || count < 0) return { status: 'error' }
  const refs = [...new Set(opts.refs ?? [])]
  const tasks = new Set(opts.tasks ?? [])
  if (!opts.admin || !opts.currentAnnotation || refs.length === 0 || tasks.size === 0) return { status: 'installed', eligible: [] }
  const admin = opts.admin
  const q = await admin.from('content_qualification')
    .select('id, artifact_kind, artifact_ref, artifact_revision, source_revision, source_hash, gold_revision, gold_hash, task_id, role, axes, annotation_ref, annotation_hash, supersedes')
    .eq('artifact_kind', 'csat_item').in('artifact_ref', refs).limit(LIMIT)
  // I2 칸이 없으면(42703 · PGRST204) 정본 주석 결속을 확인할 수 없다 — 오류가 아니라 적격 0건
  const qcode = (q.error as { code?: string } | null)?.code
  if (qcode === '42703' || qcode === 'PGRST204') return { status: 'installed', eligible: [] }
  if (q.error || !Array.isArray(q.data) || q.data.length >= LIMIT) return { status: 'error' }
  const rows = q.data as unknown as FqRow[]
  if (rows.length === 0) return { status: 'installed', eligible: [] }
  // 대체된 행 — 같은 정체성의 다른 행이 supersedes 로 가리키는 행. 대체 행이 다른 문항에 있어도 표 전체에서 찾는다
  const ids = rows.map((r) => r.id)
  const sup = await admin.from('content_qualification').select('supersedes').in('supersedes', ids).limit(LIMIT)
  const ap = await admin.from('content_release_approval').select('id, qualification_id, scope').in('qualification_id', ids).limit(LIMIT)
  if (sup.error || ap.error || !Array.isArray(sup.data) || !Array.isArray(ap.data)) return { status: 'error' }
  const approvals = ap.data as unknown as FqApprovalRow[]
  const rv = approvals.length ? await admin.from('content_release_revocation').select('approval_id').in('approval_id', approvals.map((a) => a.id)).limit(LIMIT) : { data: [], error: null }
  if (rv.error || !Array.isArray(rv.data)) return { status: 'error' }
  const supersededIds = new Set((sup.data as Row[]).map((x) => String(x.supersedes)))
  const revoked = new Set((rv.data as Row[]).map((x) => String(x.approval_id)))
  const eligible: { ref: string; task: string; role: string; qualificationId: string }[] = []
  for (const r of rows) {
    const rev = await admin.rpc('supply_artifact_revision', { p_kind: 'csat_item', p_ref: r.artifact_ref })
    if (rev.error) return { status: 'error' }
    const annotation = await opts.currentAnnotation(r.task_id, r.artifact_ref)
    const v = fqRowVerdict(r, { tasks, supersededIds, approvals, revoked, currentRevision: typeof rev.data === 'string' ? rev.data : null, currentAnnotation: annotation })
    if (v.ok) eligible.push({ ref: r.artifact_ref, task: r.task_id, role: r.role, qualificationId: r.id })
  }
  return { status: 'installed', eligible }
}
