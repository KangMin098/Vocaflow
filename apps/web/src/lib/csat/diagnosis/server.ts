// apps/web/src/lib/csat/diagnosis/server.ts
//
// 진단 엔진과 DB 사이. 표를 읽어 EngineInput 을 조립하고, 시험 기록을 채점해 저장하고,
// 스냅샷을 새로 쌓는다. **service role 클라이언트를 받는다** — 호출하는 라우트가 먼저
// 로그인(학습자 본인) 또는 requireAdmin 을 확인해야 한다. userId 는 항상 그 확인에서 온다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { pagedSelect, pagedSelectIn } from '@/lib/supabase/paged-select'

import { ruleEngineV1 } from './engine/rule-v1'
import { gradeOf, scoreAnswers } from './engine/scoring'
import type {
  AttributeCode,
  DiagnosisResult,
  EngineInput,
  EngineSettings,
  ExamMeta,
  ItemMeta,
  KeyRow,
  ResponseConfidence,
  SessionIn,
  SessionMode,
} from './engine/types'

export const ENGINE = ruleEngineV1

type Db = SupabaseClient

export interface ActiveSettings {
  id: number
  settings: EngineSettings
}

export async function loadActiveSettings(db: Db): Promise<ActiveSettings> {
  const { data, error } = await db.from('csat_dx_settings').select('id, settings').eq('active', true).maybeSingle()
  if (error) throw new Error(`진단 설정 조회 실패: ${error.message}`)
  if (!data) throw new Error('활성 진단 설정이 없다 — /admin/csat/settings 에서 저장해야 한다')
  return { id: data.id as number, settings: data.settings as EngineSettings }
}

export async function loadTrapFamily(db: Db): Promise<Record<string, string | null>> {
  const rows = await pagedSelect<{ trap_key: string; family: string | null }>(
    (from, to) => db.from('csat_dx_trap_family').select('trap_key, family').order('trap_key').range(from, to),
    'csat_dx_trap_family',
  )
  return Object.fromEntries(rows.map((r) => [r.trap_key, r.family]))
}

interface ItemRow {
  id: string
  exam_id: string
  no: number
  official_error_rate: number | null
  ebs_linked: boolean | null
}

async function itemMetas(db: Db, items: ItemRow[]): Promise<ItemMeta[]> {
  const ids = items.map((i) => i.id)
  const attrs = await pagedSelectIn<{ item_id: string; attribute_code: AttributeCode; weight: number }>(
    ids,
    (chunk, from, to) =>
      db.from('csat_dx_item_attribute').select('item_id, attribute_code, weight').in('item_id', chunk)
        .order('item_id').order('attribute_code').range(from, to),
    'csat_dx_item_attribute',
  )
  const traps = await pagedSelectIn<{ item_id: string; option_no: number; trap_key: string }>(
    ids,
    (chunk, from, to) =>
      db.from('csat_dx_option_trap').select('item_id, option_no, trap_key').in('item_id', chunk)
        .order('item_id').order('option_no').range(from, to),
    'csat_dx_option_trap',
  )
  const byItem = new Map<string, ItemMeta>()
  for (const i of items) {
    byItem.set(i.id, {
      itemId: i.id,
      examId: i.exam_id,
      no: i.no,
      errorRate: i.official_error_rate === null ? null : Number(i.official_error_rate),
      ebsLinked: i.ebs_linked,
      attributes: {},
      optionTraps: {},
    })
  }
  for (const a of attrs) {
    const m = byItem.get(a.item_id)
    if (m && a.weight > 0) m.attributes[a.attribute_code] = a.weight
  }
  for (const t of traps) {
    const m = byItem.get(t.item_id)
    if (m) m.optionTraps[t.option_no] = t.trap_key
  }
  return [...byItem.values()]
}

export async function loadExams(db: Db, examIds: string[]): Promise<Record<string, ExamMeta>> {
  const ids = [...new Set(examIds.filter(Boolean))]
  if (ids.length === 0) return {}
  const { data: exams, error } = await db.from('csat_exams').select('id, diagnosis_ready').in('id', ids)
  if (error) throw new Error(`시험 조회 실패: ${error.message}`)
  const keys = await pagedSelectIn<{ exam_id: string; no: number; answers: number[]; points: number }>(
    ids,
    (chunk, from, to) =>
      db.from('csat_dx_answer_key').select('exam_id, no, answers, points').in('exam_id', chunk)
        .order('exam_id').order('no').range(from, to),
    'csat_dx_answer_key',
  )
  const items = await pagedSelectIn<ItemRow>(
    ids,
    (chunk, from, to) =>
      db.from('csat_items').select('id, exam_id, no, official_error_rate, ebs_linked').in('exam_id', chunk)
        .order('id').range(from, to),
    'csat_items',
  )
  const metas = await itemMetas(db, items)
  const out: Record<string, ExamMeta> = {}
  for (const e of exams ?? []) out[e.id] = { id: e.id, ready: Boolean(e.diagnosis_ready), key: [], items: {} }
  for (const k of keys) out[k.exam_id]?.key.push({ no: k.no, answers: k.answers, points: k.points })
  for (const m of metas) if (out[m.examId]) out[m.examId].items[m.no] = m
  return out
}

export async function loadItems(db: Db, itemIds: string[]): Promise<Record<string, ItemMeta>> {
  const ids = [...new Set(itemIds.filter(Boolean))]
  const items = await pagedSelectIn<ItemRow>(
    ids,
    (chunk, from, to) =>
      db.from('csat_items').select('id, exam_id, no, official_error_rate, ebs_linked').in('id', chunk).order('id').range(from, to),
    'csat_items',
  )
  return Object.fromEntries((await itemMetas(db, items)).map((m) => [m.itemId, m]))
}

interface SessionRow {
  id: string
  exam_id: string | null
  mode: SessionMode
  taken_at: string
  raw_score: number | null
}
interface ResponseRow {
  session_id: string
  item_no: number
  item_id: string | null
  chosen_option: number | null
  is_correct: boolean
  confidence: ResponseConfidence
}

export async function loadSessions(db: Db, userId: string): Promise<SessionIn[]> {
  const sessions = await pagedSelect<SessionRow>(
    (from, to) =>
      db.from('csat_dx_session').select('id, exam_id, mode, taken_at, raw_score').eq('user_id', userId)
        .order('taken_at').order('id').range(from, to),
    'csat_dx_session',
  )
  const responses = await pagedSelectIn<ResponseRow>(
    sessions.map((s) => s.id),
    (chunk, from, to) =>
      db.from('csat_dx_response').select('session_id, item_no, item_id, chosen_option, is_correct, confidence')
        .in('session_id', chunk).order('session_id').order('item_no').range(from, to),
    'csat_dx_response',
  )
  const bySession = new Map<string, SessionIn>()
  for (const s of sessions) {
    bySession.set(s.id, { id: s.id, examId: s.exam_id, mode: s.mode, takenAt: s.taken_at, rawScore: s.raw_score, responses: [] })
  }
  for (const r of responses) {
    bySession.get(r.session_id)?.responses.push({
      itemNo: r.item_no,
      itemId: r.item_id,
      chosen: r.chosen_option,
      isCorrect: r.is_correct,
      confidence: r.confidence,
    })
  }
  return [...bySession.values()]
}

export interface ProfileRow {
  id: string
  valid_from: string
  grade_level: string
  goal_type: string
  goal_detail: { min_rule?: string; target_grade?: number }
  background: Record<string, string>
  weekly_hours: number | null
}

export async function loadLatestProfile(db: Db, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await db.from('csat_dx_profile_hist')
    .select('id, valid_from, grade_level, goal_type, goal_detail, background, weekly_hours')
    .eq('user_id', userId).order('valid_from', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(`프로필 조회 실패: ${error.message}`)
  return (data as ProfileRow | null) ?? null
}

/** 학습자 한 명의 EngineInput 을 조립한다 */
export async function buildInput(db: Db, userId: string, now: Date): Promise<{ input: EngineInput; settingsId: number }> {
  const [{ id, settings }, sessions, trapFamily, profile] = await Promise.all([
    loadActiveSettings(db),
    loadSessions(db, userId),
    loadTrapFamily(db),
    loadLatestProfile(db, userId),
  ])
  const sc = settings.scenario_exams
  const examIds = [
    ...sessions.map((s) => s.examId).filter((x): x is string => Boolean(x)),
    settings.reference_exam, sc.hard, sc.normal, sc.easy,
  ].filter((x): x is string => Boolean(x))
  const diagItemIds = sessions.filter((s) => s.mode === 'diagnostic')
    .flatMap((s) => s.responses.map((r) => r.itemId)).filter((x): x is string => Boolean(x))
  const [exams, items] = await Promise.all([loadExams(db, examIds), loadItems(db, diagItemIds)])
  const targetGrade = profile?.goal_detail?.target_grade
  return {
    settingsId: id,
    input: {
      now,
      settings,
      sessions,
      exams,
      items,
      trapFamily,
      target: typeof targetGrade === 'number' ? { grade: targetGrade } : null,
    },
  }
}

export type SnapshotTrigger = 'session' | 'profile' | 'admin' | 'settings'

/** 전체 재계산 후 스냅샷 한 행을 더한다(덮어쓰지 않는다) */
export async function recomputeSnapshot(
  db: Db,
  userId: string,
  trigger: SnapshotTrigger,
  now: Date,
  sessionId: string | null = null,
): Promise<{ id: string; result: DiagnosisResult }> {
  const { input, settingsId } = await buildInput(db, userId, now)
  const result = ENGINE.diagnose(input)
  const { data, error } = await db.from('csat_dx_snapshot').insert({
    user_id: userId,
    trigger,
    session_id: sessionId,
    engine_version: result.engineVersion,
    settings_id: settingsId,
    inputs_as_of: now.toISOString(),
    raw_score: result.rawScore,
    adjusted_score: result.ability,
    grade_est: result.gradeEst,
    attribute_mastery: result.attributeMastery,
    trap_vulnerability: result.trapVulnerability,
    habit_flags: result.habitFlags,
    forecast: result.forecast,
    confidence: result.confidence,
    recommended_lines: result.recommendedLines,
    evidence: { ...result.evidence, adjusted: result.adjusted, trend: result.trend },
  }).select('id').single()
  if (error) throw new Error(`스냅샷 저장 실패: ${error.message}`)
  return { id: data.id as string, result }
}

export interface ExamSubmission {
  userId: string
  examId: string
  mode: 'live' | 'retake'
  takenAt: string
  totalMinutes: number | null
  clientKey: string
  enteredBy: 'learner' | 'admin'
  choices: Record<number, number | null>
  flags: Record<number, ResponseConfidence>
}

export class SubmissionError extends Error {}

/** 시험 기록 한 회를 채점해 저장하고 스냅샷을 쌓는다 */
export async function submitExamSession(db: Db, sub: ExamSubmission, now: Date) {
  const exams = await loadExams(db, [sub.examId])
  const exam = exams[sub.examId]
  if (!exam) throw new SubmissionError('없는 시험이다')
  if (exam.key.length !== 45) throw new SubmissionError('이 시험은 아직 정답표가 없어 채점할 수 없다')
  const { settings } = await loadActiveSettings(db)
  const scored = scoreAnswers(exam.key, sub.choices, sub.flags)
  const grade = gradeOf(scored.raw, settings.grade_cuts)
  const responses = scored.answers.map((a) => ({
    item_no: a.itemNo,
    item_id: exam.items[a.itemNo]?.itemId ?? null,
    chosen_option: a.chosen,
    is_correct: a.isCorrect,
    confidence: a.confidence,
  }))
  const { data: sessionId, error } = await db.rpc('csat_dx_record_session', {
    p_session: {
      user_id: sub.userId,
      exam_id: sub.examId,
      mode: sub.mode,
      taken_at: sub.takenAt,
      total_minutes: sub.totalMinutes,
      entered_by: sub.enteredBy,
      client_key: sub.clientKey,
      raw_score: scored.raw,
      grade,
    },
    p_responses: responses,
  })
  if (error) throw new Error(`기록 저장 실패: ${error.message}`)
  const snapshot = await recomputeSnapshot(db, sub.userId, 'session', now, sessionId as string)
  return { sessionId: sessionId as string, raw: scored.raw, grade, ready: exam.ready, snapshotId: snapshot.id }
}

export interface DiagnosticSubmission {
  userId: string
  clientKey: string
  takenAt: string
  answers: { itemId: string; chosen: number | null; confidence: ResponseConfidence }[]
}

/** 진단 테스트 제출 — 문항 정답은 csat_items 에서 서버가 판정한다 */
export async function submitDiagnosticSession(db: Db, sub: DiagnosticSubmission, now: Date) {
  const ids = sub.answers.map((a) => a.itemId)
  const { data: pool, error: pe } = await db.from('csat_dx_pool').select('item_id').eq('active', true).in('item_id', ids)
  if (pe) throw new Error(`진단 풀 조회 실패: ${pe.message}`)
  const inPool = new Set((pool ?? []).map((p) => p.item_id as string))
  if (ids.some((id) => !inPool.has(id)) || new Set(ids).size !== ids.length) throw new SubmissionError('진단 테스트 문항이 아니다')
  const { data: items, error } = await db.from('csat_items').select('id, answer, answers').in('id', ids)
  if (error) throw new Error(`문항 조회 실패: ${error.message}`)
  const key = new Map((items ?? []).map((i) => [i.id as string, ((i.answers as number[] | null)?.length ? i.answers : [i.answer]) as number[]]))
  const responses = sub.answers.map((a, idx) => ({
    item_no: idx + 1,
    item_id: a.itemId,
    chosen_option: a.chosen,
    is_correct: a.chosen !== null && (key.get(a.itemId) ?? []).includes(a.chosen),
    confidence: a.confidence,
  }))
  const { data: sessionId, error: re } = await db.rpc('csat_dx_record_session', {
    p_session: { user_id: sub.userId, exam_id: null, mode: 'diagnostic', taken_at: sub.takenAt, client_key: sub.clientKey, entered_by: 'learner' },
    p_responses: responses,
  })
  if (re) throw new Error(`기록 저장 실패: ${re.message}`)
  const snapshot = await recomputeSnapshot(db, sub.userId, 'session', now, sessionId as string)
  return { sessionId: sessionId as string, correct: responses.filter((r) => r.is_correct).length, total: responses.length, snapshotId: snapshot.id }
}

/** 시험 기록 입력에서 고를 수 있는 시험(정답표가 있는 회차) */
export async function listScorableExams(db: Db) {
  const keys = await pagedSelect<{ exam_id: string }>(
    (from, to) => db.from('csat_dx_answer_key').select('exam_id').eq('no', 1).order('exam_id').range(from, to),
    'csat_dx_answer_key',
  )
  const ids = keys.map((k) => k.exam_id)
  if (ids.length === 0) return []
  const { data, error } = await db.from('csat_exams').select('id, label, kind, year, month, diagnosis_ready').in('id', ids)
  if (error) throw new Error(`시험 목록 조회 실패: ${error.message}`)
  return (data ?? []).sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.month ?? 0) - (a.month ?? 0)) as {
    id: string; label: string; kind: string; year: number | null; month: number | null; diagnosis_ready: boolean
  }[]
}

export type { KeyRow }
