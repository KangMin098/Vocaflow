// apps/web/src/lib/csat/diagnosis/server.ts
//
// 진단 엔진과 DB 사이. 표를 읽어 EngineInput 을 조립하고, 시험 기록을 채점해 저장하고,
// 스냅샷을 새로 쌓는다. **service role 클라이언트를 받는다** — 호출하는 라우트가 먼저
// 로그인(학습자 본인) 또는 requireAdmin 을 확인해야 한다. userId 는 항상 그 확인에서 온다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { keysetSelect } from '@/lib/supabase/keyset-select'

import { embargoedExamIds, embargoedItemIds, examRevealDecision } from '../embargo-gate'
import { EC_PILOT } from '../ec-pilot/config'
import { isContentEligible } from '../ec-pilot/targets'
import { mapEvidenceFor } from '../map/evidence'
import { recordQuality } from './engine/record-quality'
import { selectByChunks, selectSmall } from './fetch'

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
  const rows = await keysetSelect<{ trap_key: string; family: string | null }, string>(
    (cursor, limit) => {
      const q = db.from('csat_dx_trap_family').select('trap_key, family').order('trap_key').limit(limit)
      return cursor === null ? q : q.gt('trap_key', cursor)
    },
    (row) => row.trap_key,
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
  // 문항당 역량 ≤ 9행 · 함정 ≤ 5행 → 100문항 묶음이면 900·500행으로 상한 아래
  const attrs = await selectByChunks<{ item_id: string; attribute_code: AttributeCode; weight: number }>(
    ids,
    100,
    (chunk) => db.from('csat_dx_item_attribute').select('item_id, attribute_code, weight').in('item_id', chunk),
    'csat_dx_item_attribute',
  )
  const traps = await selectByChunks<{ item_id: string; option_no: number; trap_key: string }>(
    ids,
    100,
    (chunk) => db.from('csat_dx_option_trap').select('item_id, option_no, trap_key').in('item_id', chunk),
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
  // 회차당 정답 45행 · 문항 ≤ 28행 → 20회차 묶음이면 900·560행
  const exams = await selectByChunks<{ id: string; diagnosis_ready: boolean }>(
    ids,
    500,
    (chunk) => db.from('csat_exams').select('id, diagnosis_ready').in('id', chunk),
    'csat_exams',
  )
  const keys = await selectByChunks<{ exam_id: string; no: number; answers: number[]; points: number }>(
    ids,
    20,
    (chunk) => db.from('csat_dx_answer_key').select('exam_id, no, answers, points').in('exam_id', chunk),
    'csat_dx_answer_key',
  )
  const items = await selectByChunks<ItemRow>(
    ids,
    20,
    (chunk) => db.from('csat_items').select('id, exam_id, no, official_error_rate, ebs_linked').in('exam_id', chunk),
    'csat_items',
  )
  const metas = await itemMetas(db, items)
  const out: Record<string, ExamMeta> = {}
  for (const e of exams) out[e.id] = { id: e.id, ready: Boolean(e.diagnosis_ready), key: [], items: {} }
  for (const k of keys) out[k.exam_id]?.key.push({ no: k.no, answers: k.answers, points: k.points })
  for (const e of Object.values(out)) e.key.sort((a, b) => a.no - b.no)
  for (const m of metas) if (out[m.examId]) out[m.examId].items[m.no] = m
  return out
}

export async function loadItems(db: Db, itemIds: string[]): Promise<Record<string, ItemMeta>> {
  const ids = [...new Set(itemIds.filter(Boolean))]
  const items = await selectByChunks<ItemRow>(
    ids,
    500,
    (chunk) => db.from('csat_items').select('id, exam_id, no, official_error_rate, ebs_linked').in('id', chunk),
    'csat_items',
  )
  return Object.fromEntries((await itemMetas(db, items)).map((m) => [m.itemId, m]))
}

interface SessionRow {
  id: string
  created_at: string
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
  return (await loadSessionsWithWatermark(db, userId)).sessions
}

/**
 * 세션 + 입력 워터마크(포함된 세션 중 가장 늦게 저장된 created_at). 스냅샷의 inputs_as_of 로 쓴다 —
 * 동시에 두 기록이 저장돼 계산이 엇갈려도 **더 많은 기록을 본 스냅샷**이 최신으로 정렬된다.
 */
export async function loadSessionsWithWatermark(db: Db, userId: string): Promise<{ sessions: SessionIn[]; watermark: string | null }> {
  const sessionsAll = (
    await keysetSelect<SessionRow, string>(
      (cursor, limit) => {
        const q = db.from('csat_dx_session').select('id, exam_id, mode, taken_at, raw_score, created_at').eq('user_id', userId).order('id').limit(limit)
        return cursor === null ? q : q.gt('id', cursor)
      },
      (row) => row.id,
      'csat_dx_session',
    )
  ).sort((a, b) => a.taken_at.localeCompare(b.taken_at) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  // Reveal Gate — 보류 시험(오답 원인 Pilot 수집 중)의 기록은 진단 입력에서 뺀다. 스냅샷 · 지도가 그 정오 · 점수를 품지 않게(판정 실패면 전부 보류)
  const held = await embargoedExamIds(sessionsAll.map((s) => s.exam_id).filter((x): x is string => Boolean(x)))
  const sessions = sessionsAll.filter((s) => !s.exam_id || !held.has(s.exam_id))
  // 세션당 응답 ≤ 45행 → 20세션 묶음이면 900행
  const responses = await selectByChunks<ResponseRow>(
    sessions.map((s) => s.id),
    20,
    (chunk) => db.from('csat_dx_response').select('session_id, item_no, item_id, chosen_option, is_correct, confidence').in('session_id', chunk),
    'csat_dx_response',
  )
  responses.sort((a, b) => a.item_no - b.item_no)
  // 진단 테스트(시험 id 없음) 응답도 문항 단위로 — 보류 시험 문항의 정오는 입력에 넣지 않는다(판정 실패면 전부 뺀다)
  const heldItems = await embargoedItemIds(responses.map((r) => r.item_id).filter((x): x is string => Boolean(x)))
  if (heldItems.size) responses.splice(0, responses.length, ...responses.filter((r) => !r.item_id || !heldItems.has(r.item_id)))
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
  const watermark = sessions.reduce<string | null>((m, x) => (m === null || x.created_at > m ? x.created_at : m), null)
  return { sessions: [...bySession.values()], watermark }
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
export async function buildInput(db: Db, userId: string, now: Date): Promise<{ input: EngineInput; settingsId: number; watermark: string | null }> {
  const [{ id, settings }, { sessions, watermark }, trapFamily, profile] = await Promise.all([
    loadActiveSettings(db),
    loadSessionsWithWatermark(db, userId),
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
    // 입력 신선도 = 기록과 프로필 중 가장 늦은 것 — 목표를 바꾼 계산이 옛 목표 계산에 밀리지 않게
    watermark: [watermark, profile?.valid_from ?? null].filter((x): x is string => Boolean(x)).sort().at(-1) ?? null,
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

/**
 * 저장하지 않고 지금 입력으로 진단 · 지도 지표를 계산한다. 저장된 스냅샷이 옛 엔진 버전일 때
 * 지도가 그 값(예: 품질 판정 전 일괄 입력 기록이 섞인 관찰값)을 보이지 않도록 쓴다.
 */
export async function computeSnapshotNow(db: Db, userId: string, now: Date) {
  const { input } = await buildInput(db, userId, now)
  const result = ENGINE.diagnose(input)
  const map = await mapEvidenceFor(db, input)
  return {
    result,
    evidence: { ...result.evidence, adjusted: result.adjusted, trend: result.trend, ...(map.evidence ?? {}), mapStatus: map.status },
  }
}

/** 전체 재계산 후 스냅샷 한 행을 더한다(덮어쓰지 않는다) */
export async function recomputeSnapshot(
  db: Db,
  userId: string,
  trigger: SnapshotTrigger,
  now: Date,
  sessionId: string | null = null,
): Promise<{ id: string; result: DiagnosisResult }> {
  const { input, settingsId, watermark } = await buildInput(db, userId, now)
  const result = ENGINE.diagnose(input)
  // 학습 지도용 값(A·B·C 성취율) — 지도 전용 처리 전체가 map/evidence 안에서 격리된다(실패해도 던지지 않는다)
  const map = await mapEvidenceFor(db, input)
  const { data, error } = await db.from('csat_dx_snapshot').insert({
    user_id: userId,
    trigger,
    session_id: sessionId,
    engine_version: result.engineVersion,
    settings_id: settingsId,
    // 입력 워터마크 — 이 계산이 본 가장 늦은 기록. 최신 리포트는 이것으로 고른다(snapshot.ts)
    inputs_as_of: watermark ?? now.toISOString(),
    raw_score: result.rawScore,
    adjusted_score: result.ability,
    grade_est: result.gradeEst,
    attribute_mastery: result.attributeMastery,
    trap_vulnerability: result.trapVulnerability,
    habit_flags: result.habitFlags,
    forecast: result.forecast,
    confidence: result.confidence,
    recommended_lines: result.recommendedLines,
    evidence: { ...result.evidence, adjusted: result.adjusted, trend: result.trend, ...(map.evidence ?? {}), mapStatus: map.status },
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
  /** 오답 원인 Pilot 참가자(설정 · taxonomy 관문 통과 — ec-pilot/server pilotOpen). 아니어도 그 시험에 활성 capture 가 있으면 DB 가 보류 행을 만든다 */
  participant?: boolean
}

export class SubmissionError extends Error {}

/** 저장 결과. held 면 점수 · 등급 · 틀린 문항을 싣지 않는다(Reveal Gate — 요청자 무관 시험 보류 포함) */
export type SubmitResult =
  | { held: false; sessionId: string; raw: number; grade: number | null; ready: boolean; snapshotId: string; wrong: number[] }
  | { held: true; sessionId: string; ready: boolean; snapshotId: string; gateFailure: boolean }

/**
 * 시험 기록 한 회를 채점해 저장하고 스냅샷을 쌓는다.
 * 저장은 **단일 진입** `csat_ec_record_session_held`(서비스) — 기록 저장과 보류(capture) 행 생성이 한 트랜잭션이다.
 * 결과(점수 · 정오)는 embargo-gate 를 지난 뒤에만 읽는다.
 */
export async function submitExamSession(db: Db, sub: ExamSubmission, now: Date): Promise<SubmitResult> {
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
  // 봉인 대상 = 정오 무관(고른 답이 있고 문항 id 가 있는 번호 전부). 증거 적격 = 기록 품질 trusted(정오를 보지 않는다)
  //   표 제약(evidence_eligible or 대상 0)에 맞춰 적격이 아니면 대상을 비운다 — 보류 행은 그래도 생긴다
  const evidenceEligible = recordQuality(responses.map((r) => ({ no: r.item_no, chosen: r.chosen_option }))).status === 'trusted'
  //   대상은 수집 화면과 **같은 내용 적격**(isContentEligible — 듣기 · 무응답 · 발문/선지 없음 · body_ok 거짓 제외)으로 봉인한다.
  //   다르면 화면이 못 보여 주는 대상이 남아 완료 RPC 가 보류를 풀지 못한다
  let targets: number[] = []
  if (evidenceEligible) {
    const { data: bodies, error: be } = await db.from('csat_items').select('no, stem, choices, body_ok').eq('exam_id', sub.examId)
    if (be) throw new Error(`문항 조회 실패: ${be.message}`)
    const byNo = new Map((bodies ?? []).map((b) => [b.no as number, b]))
    targets = responses.filter((r) => r.item_id).map((r) => {
      const b = byNo.get(r.item_no)
      return { itemNo: r.item_no, chosen: r.chosen_option, stem: (b?.stem as string | null) ?? null, passage: null, choices: Array.isArray(b?.choices) ? (b.choices as string[]) : null, bodyOk: b?.body_ok === true }
    }).filter(isContentEligible).map((c) => c.itemNo)
  }
  const { data: saved0, error } = await db.rpc('csat_ec_record_session_held', {
    p_participant: sub.participant === true,
    p_taxonomy: EC_PILOT.taxonomyVersion,
    p_config: { probe_cap: EC_PILOT.probeCapPerSession, correct_controls: EC_PILOT.correctControls, entered_by: sub.enteredBy },
    p_targets: targets,
    p_evidence_eligible: evidenceEligible,
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
  if (error) {
    if (error.message.includes('같은 기록 키로')) throw new SubmissionError('이 기록은 이미 다른 내용으로 저장됐어요. 「새 기록 입력」으로 다시 넣어 주세요')
    throw new Error(`기록 저장 실패: ${error.message}`)
  }
  const sessionId = (saved0 as { session_id?: string } | null)?.session_id
  if (!sessionId) throw new Error('기록 저장 실패: 세션 id 가 없다')
  // 같은 clientKey 재전송이면 RPC 는 처음 저장한 세션을 돌려준다 — 이번 요청의 채점이 아니라 저장된 값을 답한다
  const { data: saved, error: se } = await db.from('csat_dx_session').select('exam_id, mode, taken_at').eq('id', sessionId).single()
  if (se) throw new Error(`저장 확인 실패: ${se.message}`)
  await assertSameSubmission(db, sessionId, responses, saved.exam_id === sub.examId && saved.mode === sub.mode && saved.taken_at === sub.takenAt)
  const snapshot = await snapshotForSession(db, sub.userId, sessionId, now)
  // Reveal Gate — 이 기록이 보류(capture)이거나 그 시험이 보류(요청자 무관)면 점수 · 정오를 읽지 않고 돌려준다
  const capture = (saved0 as { held?: boolean }).held === true
  const decision = capture ? 'embargo' : await examRevealDecision(sub.examId)
  if (decision !== 'open') return { held: true, sessionId, ready: exam.ready, snapshotId: snapshot.id, gateFailure: decision === 'failure' }
  const [{ data: score, error: ge }, { data: wrongRows, error: we }] = await Promise.all([
    db.from('csat_dx_session').select('raw_score, grade').eq('id', sessionId).single(),
    db.from('csat_dx_response').select('item_no').eq('session_id', sessionId).eq('is_correct', false),
  ])
  if (ge) throw new Error(`저장 확인 실패: ${ge.message}`)
  if (we) throw new Error(`오답 조회 실패: ${we.message}`)
  const wrong = (wrongRows ?? []).map((r) => r.item_no as number).sort((x, y) => x - y)
  return { held: false, sessionId, raw: score.raw_score as number, grade: score.grade as number | null, ready: exam.ready, snapshotId: snapshot.id, wrong }
}

/**
 * 같은 clientKey 재전송인데 내용이 다르면 거부한다 — RPC 는 처음 저장한 세션을 돌려주므로, 그대로 두면
 * 화면에 보이는 답과 저장된 답이 갈린 채 「저장했어요」가 뜬다. 학습자는 「새 기록 입력」으로 다시 넣는다.
 */
async function assertSameSubmission(
  db: Db,
  sessionId: string,
  sent: { item_no: number; item_id: string | null; chosen_option: number | null; confidence: string }[],
  sameMeta: boolean,
) {
  const { data, error } = await db.from('csat_dx_response').select('item_no, item_id, chosen_option, confidence').eq('session_id', sessionId)
  if (error) throw new Error(`저장 확인 실패: ${error.message}`)
  const stored = new Map((data ?? []).map((r) => [r.item_no as number, `${r.item_id ?? ''}|${r.chosen_option ?? ''}|${r.confidence}`]))
  const same = sameMeta && stored.size === sent.length && sent.every((r) => stored.get(r.item_no) === `${r.item_id ?? ''}|${r.chosen_option ?? ''}|${r.confidence}`)
  if (!same) throw new SubmissionError('이 기록은 이미 다른 내용으로 저장됐어요. 「새 기록 입력」으로 다시 넣어 주세요')
}

/** 이 세션으로 이미 쌓인 스냅샷이 있으면 그것을 쓴다(재전송이 같은 진단을 두 번 쌓지 않게). 없을 때만 계산 */
async function snapshotForSession(db: Db, userId: string, sessionId: string, now: Date): Promise<{ id: string }> {
  const { data, error } = await db.from('csat_dx_snapshot').select('id').eq('user_id', userId).eq('session_id', sessionId).limit(1).maybeSingle()
  if (error) throw new Error(`스냅샷 조회 실패: ${error.message}`)
  if (data) return { id: data.id as string }
  try {
    return await recomputeSnapshot(db, userId, 'session', now, sessionId)
  } catch (e) {
    // 동시에 온 재전송이 먼저 스냅샷을 넣었다(세션당 하나 — 고유 인덱스 csat_dx_snapshot_once_per_session)
    if (e instanceof Error && e.message.includes('csat_dx_snapshot_once_per_session')) {
      const { data: again, error: ae } = await db.from('csat_dx_snapshot').select('id').eq('user_id', userId).eq('session_id', sessionId).limit(1).maybeSingle()
      if (ae || !again) throw e
      return { id: again.id as string }
    }
    throw e
  }
}

/** 기록 한 회 삭제 — 본인(userId) 세션만. 응답은 FK cascade 로 함께 지워지고, 그 세션을 가리키던 스냅샷은 session_id 가 비워진다 */
export async function deleteExamSession(db: Db, userId: string, sessionId: string): Promise<boolean> {
  const { data, error } = await db.from('csat_dx_session').delete().eq('id', sessionId).eq('user_id', userId).select('id')
  if (error) throw new Error(`기록 삭제 실패: ${error.message}`)
  const found = (data ?? []).length > 0
  // 스냅샷 정리는 지운 기록이 없어도 한다 — 앞선 요청이 기록만 지우고 정리 중에 실패했으면 재시도가 여기서 마무리한다(멱등)
  // 스냅샷은 기록에서 만든 파생값이다 — 지운 기록을 본 스냅샷이 「최신」으로 남지 않게 지우고, 남은 기록으로 하나 다시 쌓는다
  const { error: se } = await db.from('csat_dx_snapshot').delete().eq('user_id', userId)
  if (se) throw new Error(`스냅샷 정리 실패: ${se.message}`)
  const { count, error: ce } = await db.from('csat_dx_session').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  if (ce) throw new Error(`기록 수 조회 실패: ${ce.message}`)
  if ((count ?? 0) > 0) await recomputeSnapshot(db, userId, 'session', new Date())
  return found
}

/** 시험 기록 입력에서 고를 수 있는 시험(정답표가 있는 회차) */
export async function listScorableExams(db: Db) {
  // 1번 정답 행 = 정답표가 있는 회차 하나 — 회차 수만큼이라 작다
  const keys = await selectSmall<{ exam_id: string }>(
    () => db.from('csat_dx_answer_key').select('exam_id').eq('no', 1),
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
