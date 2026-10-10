// apps/web/src/lib/csat/map/load.ts
//
// 내 진단 「학습 지도」 데이터 로더 — 서버가 service role 로 읽어 모델(model.ts)을 조립한다.
// 읽는 것: 지도 정적 데이터(노드 · 연결선 · 과제 · 출처) · 본인 목표 · 과제 완료 · 기준 시험(최근 적격 N회)의 배점 · 오답률 · 연결표 · 최신 스냅샷.
// 지도 테이블이 없거나 시드 전이면 null(화면은 「준비 중」). 그 밖의 오류는 던진다 — 오류를 빈 지도로 삼키지 않는다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { selectByChunks, selectSmall } from '../diagnosis/fetch'
import { isDiagnosable, recordQuality } from '../diagnosis/engine/record-quality'
import { computeSnapshotNow } from '../diagnosis/server'
import { loadSnapshots } from '../diagnosis/snapshot'
import { embargoedExamIds, itemRevealDecision, userHasHeldSession } from '../embargo-gate'

import { NO_DATA_ATTRIBUTES } from './core'
import { lineItemKeys } from './memberships'
import { staleMapEvidence } from './stale'
import { loadPracticePool, practiceHrefsBeyond } from '../../knowledge/practice-server'
import { loadMapPracticeLinks, parseItemTaskRef, type MapPracticeLink } from '../../knowledge/product-server'
import type { AsIsSession } from './v4/as-is'
import type { ActivityRow } from './lifecycle-evidence'
import { findOutcome, type FindAttemptRow } from '../../knowledge/find-outcome'
import { decideStep } from '../../knowledge/learning-decision'
import { recordDecisions, type DecisionLogEntry } from '../../knowledge/decision-log-server'
import { PRACTICE_SLUG, PRACTICE_TASK, SKELETON_TASK, isSyntheticEmail } from '../../knowledge/practice'
import { createAdminClient } from '@/lib/supabase/admin'
import { ALL_STEPS } from './learner-path'

import { crossSessionHelp, type CrossSession, type CrossVerdict } from '@/lib/knowledge/prior-help'
import { practiceResultsFor, transferKeysOf, type AttemptRow, type FirstAttemptRow, type PracticeResult, type ReviewRow } from './practice-results'
import { buildMapModel, type MapEdgeRow, type MapModel, type MapNodeRow, type MapRaw, type MapSettings, type MapTaskRow, type SnapshotInput } from './model'
import { selectReferenceExams, type ExamCandidate, type RefItem } from './target'

type Db = SupabaseClient

export interface MapSourceRow {
  id: string
  citation: string
  supports: string
  status: 'verified' | 'needs_review'
  url: string | null
}

export interface MapPageData {
  /** 서버가 이 화면을 계산한 시각(ISO) — 화면의 기한 판정은 이 값으로만(시계를 직접 읽지 않는다) */
  now?: string
  model: MapModel
  nodes: MapNodeRow[]
  edges: MapEdgeRow[]
  tasks: MapTaskRow[]
  sources: MapSourceRow[]
  /** 노드 코드 → 출처 id */
  nodeSources: Record<string, string[]>
  /** 연결선 id → 출처 id */
  edgeSources: Record<number, string[]>
  doneTaskIds: string[]
  settings: MapSettings
  /** FIND 과제 id → 같은 실행 과제를 기출 한 문항으로 직접 해 보는 곳(학습 원리 적용 learning_map_find · 채택 사슬이 살아 있을 때만) */
  practiceLinks?: Record<string, MapPracticeLink>
  /** 확인 문항에서의 내 첫 시도(DB 뷰 learning_first_attempts · RLS 본인 행) — 확인 결과 → 확인된 학습 요구(find-outcome) */
  findAttempts?: FindAttemptRow[]
  /** 생애주기 수행 기록(바로잡기 · 적용 판정용) — 연결된 과제 키의 본인 시도 전부(첫 시도만이 아니다). 못 읽으면 undefined(「기록 없음」 으로 보이지 않게) */
  lifecycleActivity?: ActivityRow[]
  /** FIND 과제 id → 그 실행 과제의 본인 수행 요약(결과 환류) — 연결된 과제만 */
  practiceResults?: Record<string, PracticeResult>
  /** FIND 과제 id → 「같은 원리를 다른 지문에 적용」 Practice 주소 — 실학습 풀에 그 문항 말고 다른 문항이 있을 때만 */
  practiceNext?: Record<string, string>
  /** 학습자 본인의 시험 기록(진단에 반영된 회차 · 오래된 것부터) — 「현재 위치」는 이것만 근거로 쓴다 */
  records: LearnerRecord[]
  /**
   * rev4 As-Is · To-Be · Workspace 계산 재료(lib/csat/map/v4) — 계산은 화면이 같은 순수 함수로(목표를 바꾸면 바로 다시 계산).
   * 없으면(옛 응답) 화면은 rev4 섹션을 그리지 않는다.
   */
  v4?: MapV4Input
}

export interface MapV4Input {
  /** 본인의 모든 시험 기록(기록 테이블 직접) — 시행일 · 입력일 · 입력 신뢰도 · 시험 진단 준비 여부 */
  sessions: AsIsSession[]
  /** 축 관찰(스냅샷)이 반영한 세션 id — 여기 없는 기록은 「반영 중」(스냅샷 계산 전) */
  proxyCovers: string[]
  /** 목표 계산 기준 시험(평가원 최근 N회)의 전 문항 — splitMust 입력 */
  refItems: RefItem[]
  /** 확인 과제 키 → 확인 묶음 밖에서 같은 과제로 적용할 수 있는 활성 문항 수 */
  transferItems: Record<string, number>
}

/** 화면의 「시험상 위치」 — 실제 기록 한 회. 등급은 기록에 저장된 값(없으면 null — 화면이 원점수 구간으로 표시) */
export interface LearnerRecord {
  label: string
  takenAt: string
  raw: number | null
  grade: number | null
}

export const DEFAULT_MAP_SETTINGS: MapSettings = {
  default_goal: 100,
  reference_exams: 6,
  status: { near: 0.9 },
  min_coverage: 0.5,
  goal_presets: [100, 90, 80, 70, 60],
  core: { weak: 0.6, watch: 0.8 },
}

const MISSING_TABLE = new Set(['42P01', 'PGRST205'])
const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : d)

/** 활성 지도 설정 — 모르는 값 · 범위 밖 값은 기본값으로(잘못된 설정이 화면을 깨지 않게) */
export function parseMapSettings(json: unknown): MapSettings {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const status = (j.status && typeof j.status === 'object' ? j.status : {}) as Record<string, unknown>
  const presets = Array.isArray(j.goal_presets) ? j.goal_presets.filter((x): x is number => typeof x === 'number' && x >= 0 && x <= 100) : []
  return {
    default_goal: Math.round(num(j.default_goal, DEFAULT_MAP_SETTINGS.default_goal, 0, 100)),
    reference_exams: Math.round(num(j.reference_exams, DEFAULT_MAP_SETTINGS.reference_exams, 1, 30)),
    status: { near: num(status.near, DEFAULT_MAP_SETTINGS.status.near, 0, 1) },
    min_coverage: num(j.min_coverage, DEFAULT_MAP_SETTINGS.min_coverage, 0, 1),
    goal_presets: presets.length > 0 ? presets : DEFAULT_MAP_SETTINGS.goal_presets,
    core: parseCore(j.core),
  }
}

/** 핵심 지도 관찰 후보 기준 — 0~1 범위, weak ≤ watch 순서가 아니면 기본값(잘못된 설정이 판정을 뒤집지 않게) */
function parseCore(v: unknown): MapSettings['core'] {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const weak = num(o.weak, DEFAULT_MAP_SETTINGS.core.weak, 0, 1)
  const watch = num(o.watch, DEFAULT_MAP_SETTINGS.core.watch, 0, 1)
  return weak <= watch ? { weak, watch } : { ...DEFAULT_MAP_SETTINGS.core }
}

function group<T, K extends string | number>(rows: T[], key: (r: T) => K, val: (r: T) => string): Record<K, string[]> {
  const out = {} as Record<K, string[]>
  for (const r of rows) (out[key(r)] ??= []).push(val(r))
  return out
}

/**
 * 세션을 건너온 도움(새로고침 · 다른 기기 · 해설 극장 공개)을 첫 시도 줄마다 판정한다 — 읽을 때 M8 규칙(prior-help).
 * 못 읽으면 보수적으로 「시각 불확실」 — 독립이라고 단정하지 않는다.
 */
async function loadCrossVerdicts(db: Db, userId: string, rows: { attempt_id?: unknown; session_id?: unknown; item_ref?: unknown; answered_at?: unknown }[]): Promise<Map<number, CrossVerdict>> {
  const out = new Map<number, CrossVerdict>()
  const ids = rows.map((r) => Number(r.attempt_id)).filter((x) => Number.isFinite(x))
  const items = [...new Set(rows.map((r) => String(r.item_ref ?? '')).filter(Boolean))]
  if (ids.length === 0) return out
  const [att, sess] = await Promise.all([
    db.from('learning_task_attempts').select('id, received_at').eq('user_id', userId).in('id', ids),
    db.from('learning_sessions').select('id, item_ref, help_received_at, explanation_viewed_at, help_server_at, explanation_server_at, help_clock_suspect').eq('user_id', userId).in('item_ref', items).limit(1000),
  ])
  if (att.error || sess.error) {
    for (const id of ids) out.set(id, 'uncertain')
    return out
  }
  const received = new Map(((att.data ?? []) as { id: number; received_at: string | null }[]).map((a) => [a.id, a.received_at]))
  for (const r of rows) {
    const id = Number(r.attempt_id)
    if (!Number.isFinite(id)) continue
    out.set(id, crossSessionHelp({ sessionId: (r.session_id as string | null) ?? null, itemId: String(r.item_ref ?? ''), answeredAt: String(r.answered_at), receivedAt: received.get(id) ?? null }, (sess.data ?? []) as CrossSession[]))
  }
  return out
}

/** 확인 문항에서의 내 첫 시도 — 학습자 RLS 클라이언트로 본인 행만. 문항이 없으면 묻지 않는다 */
async function loadFindAttempts(db: Db, userId: string, items: string[]): Promise<FindAttemptRow[]> {
  if (items.length === 0) return []
  const { data, error } = await db.from('learning_first_attempts').select('*').eq('user_id', userId).in('item_ref', [...new Set(items)])
  if (error) throw new Error(`확인 결과 조회 실패: ${error.message}`)
  const cross = await loadCrossVerdicts(db, userId, (data ?? []) as Record<string, unknown>[])
  // 세부 채점(response.grade = { claim, support, relation } 등) — 「어디서 막혔나」 추적용(find-policy.v2). 못 읽으면 세부 없이 판정한다
  const ids = ((data ?? []) as Record<string, unknown>[]).map((r) => Number(r.attempt_id)).filter(Number.isFinite)
  const partsById = new Map<number, Record<string, boolean>>()
  if (ids.length) {
    const { data: rows } = await db.from('learning_task_attempts').select('id,response').eq('user_id', userId).in('id', ids)
    for (const row of (rows ?? []) as { id: number; response: { grade?: Record<string, unknown> } | null }[]) {
      const g = row.response?.grade
      if (g && typeof g === 'object') partsById.set(Number(row.id), Object.fromEntries(Object.entries(g).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>)
    }
  }
  const first: FindAttemptRow[] = ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const v = cross.get(Number(r.attempt_id)) ?? 'independent'
    return {
    userId: String(r.user_id),
    itemRef: String(r.item_ref),
    taskKey: String(r.task_key ?? ''),
    phase: String(r.phase) as FindAttemptRow['phase'],
    isCorrect: typeof r.is_correct === 'boolean' ? r.is_correct : null,
    synthetic: r.synthetic === true,
    // 다른 세션에서 앞서 도움 · 해설을 봤으면 도움받은 판단 · 순서가 불확실하면 보류
    helpLevel: v === 'helped' ? 'viewed_first' : (r.help_level as string | null) ?? null,
    afterViewedFirst: v === 'helped' || r.after_viewed_first === true,
    afterExplanation: r.after_explanation === true,
    timingUncertain: v === 'uncertain' || r.timing_uncertain === true,
    answeredAt: typeof r.answered_at === 'string' ? r.answered_at : null,
    parts: partsById.get(Number(r.attempt_id)) ?? null,
    // 확인 과제(theater) · 연습 화면(practice) 구분 — 연습 기록은 확인 근거가 아니다(find-policy.v3)
    activity: typeof r.activity === 'string' ? r.activity : null,
  }
  })
  // 연습 화면 기록은 원장에서 따로(확인 문항 밖 지문의 방법 연습 포함 — 과제 키로 고른다) — 첫 시도 뷰는 문항마다 하나라, 확인한 뒤 같은 문항을 연습한 기록이 빠져 재확인 순환이 멈춘다(Codex P2).
  //   정오는 넣지 않는다(isCorrect null) — 연습 기록은 확인 근거가 아니고 「연습한 지문 · 마지막 연습 시각」에만 쓴다
  const { data: prac, error: pe } = await db.from('learning_task_attempts').select('item_ref,task_key,answered_at,phase,synthetic').eq('user_id', userId).eq('activity', 'practice').in('task_key', [PRACTICE_TASK, SKELETON_TASK]).order('answered_at', { ascending: false }).limit(500)
  if (pe) throw new Error(`연습 기록 조회 실패: ${pe.message}`)
  const practice: FindAttemptRow[] = ((prac ?? []) as Record<string, unknown>[]).map((r) => ({
    userId, itemRef: String(r.item_ref), taskKey: String(r.task_key ?? ''), phase: String(r.phase) as FindAttemptRow['phase'], isCorrect: null,
    synthetic: r.synthetic === true, helpLevel: null, afterViewedFirst: false, afterExplanation: false,
    answeredAt: typeof r.answered_at === 'string' ? r.answered_at : null, parts: null, activity: 'practice',
  }))
  return [...first, ...practice]
}

/** 생애주기 수행 기록 — 연결된 과제 키의 본인 시도(문항 · 단계 · 정오 · 판단 시각). 최신 1,000건 — 판정은 이번 회차(직접 확인 뒤) 기록만 쓰므로 오래된 기록이 잘려도 지금 판정은 바뀌지 않는다(Codex P2). 보류 문항은 뺀다(Reveal Gate) */
async function loadLifecycleActivity(db: Db, userId: string, taskKeys: string[], gate: { held: Set<string>; failed: boolean }): Promise<ActivityRow[]> {
  if (taskKeys.length === 0 || gate.failed) return []
  const { data, error } = await db.from('learning_task_attempts').select('item_ref, task_key, phase, is_correct, answered_at')
    .eq('user_id', userId).in('task_key', taskKeys).order('answered_at', { ascending: false }).limit(1000)
  if (error) throw new Error(`수행 기록 조회 실패: ${error.message}`)
  return ((data ?? []) as { item_ref: string | null; task_key: string; phase: string; is_correct: boolean | null; answered_at: string | null }[])
    .filter((r) => !r.item_ref || !gate.held.has(r.item_ref))
    .map((r) => ({ itemRef: r.item_ref, taskKey: r.task_key, phase: r.phase, isCorrect: r.is_correct, answeredAt: r.answered_at }))
}

export async function loadMapPage(db: Db, userId: string, now: Date): Promise<MapPageData | null> {
  // 게이트 — 테이블 없음(미설치)과 시드 전을 가른다
  const probe = await db.from('csat_map_node').select('code').limit(1)
  if (probe.error) {
    if (probe.error.code && MISSING_TABLE.has(probe.error.code)) return null
    throw new Error(`지도 조회 실패: ${probe.error.message}`)
  }
  if ((probe.data ?? []).length === 0) return null

  const [nodes, edges, tasks, sources, nodeSrc, edgeSrc, links, mapSettingsRows, dxSettingsRows] = await Promise.all([
    selectSmall<MapNodeRow>(() => db.from('csat_map_node').select('code, kind, name, axis, track, summary, why, signal, evidence_status, sort').order('sort'), 'csat_map_node'),
    selectSmall<MapEdgeRow>(() => db.from('csat_map_edge').select('id, from_code, to_code, kind, basis'), 'csat_map_edge'),
    selectSmall<MapTaskRow>(() => db.from('csat_map_task').select('id, line_code, ord, title, how, cadence, done_when, material, method_line').order('ord'), 'csat_map_task'),
    selectSmall<MapSourceRow>(() => db.from('csat_map_source').select('id, citation, supports, status, url'), 'csat_map_source'),
    selectSmall<{ node_code: string; source_id: string }>(() => db.from('csat_map_node_source').select('node_code, source_id'), 'csat_map_node_source'),
    selectSmall<{ edge_id: number; source_id: string }>(() => db.from('csat_map_edge_source').select('edge_id, source_id'), 'csat_map_edge_source'),
    selectSmall<{ line_code: string; link_kind: string; ref: string }>(() => db.from('csat_map_line_link').select('line_code, link_kind, ref').in('link_kind', ['type', 'item_no', 'habit']), 'csat_map_line_link'),
    selectSmall<{ settings: unknown }>(() => db.from('csat_map_settings').select('settings').eq('active', true), 'csat_map_settings'),
    selectSmall<{ settings: unknown }>(() => db.from('csat_dx_settings').select('settings').eq('active', true), 'csat_dx_settings'),
  ])
  const settings = parseMapSettings(mapSettingsRows[0]?.settings)

  // 본인 상태
  const goalRes = await db.from('csat_map_goal').select('target_score').eq('user_id', userId).maybeSingle()
  if (goalRes.error) throw new Error(`목표 조회 실패: ${goalRes.error.message}`)
  const doneRows = await selectSmall<{ task_id: string }>(() => db.from('csat_map_task_done').select('task_id').eq('user_id', userId), 'csat_map_task_done')

  // 기준 시험 — 정답표(45문항 · 배점 합 100)가 갖춰진 평가원 시험 중 최근 N회
  const examRows = await selectSmall<{ id: string; label: string; month: number | null; exam_year: number | null }>(
    () => db.from('csat_exams').select('id, label, month, exam_year').eq('organizer', 'kice'),
    'csat_exams',
  )
  const keyRows = await selectByChunks<{ exam_id: string; no: number; points: number }>(
    examRows.map((e) => e.id),
    20,
    (chunk) => db.from('csat_dx_answer_key').select('exam_id, no, points').in('exam_id', chunk),
    'csat_dx_answer_key',
  )
  const keyByExam: Record<string, { no: number; points: number }[]> = {}
  for (const k of keyRows) (keyByExam[k.exam_id] ??= []).push({ no: k.no, points: k.points })
  // Reveal Gate — 보류 시험(오답 원인 Pilot 수집 중)은 기준 시험 후보에서 뺀다(문항별 함정 계열 연결이 지도에 실리지 않게 · 판정 실패면 전부 빠져 지도는 준비 중)
  const heldExams = await embargoedExamIds(examRows.map((e) => e.id))
  const candidates: ExamCandidate[] = examRows.filter((e) => !heldExams.has(e.id)).map((e) => ({
    id: e.id,
    label: e.label,
    held: (e.exam_year ?? 0) * 100 + (e.month ?? 0),
    itemCount: keyByExam[e.id]?.length ?? 0,
    pointsTotal: (keyByExam[e.id] ?? []).reduce((s, k) => s + k.points, 0),
  }))
  const selection = selectReferenceExams(candidates, settings.reference_exams)
  const examIds = selection.exams.map((e) => e.id)
  const examLabels = Object.fromEntries(examRows.map((e) => [e.id, e.label]))

  // 오답률(관측 원장) — 없는 문항은 미관측(null)
  const rateRows = await selectByChunks<{ exam_id: string; no: number; error_rate: number | string }>(
    examIds,
    5,
    (chunk) => db.from('csat_map_item_rate').select('exam_id, no, error_rate').in('exam_id', chunk),
    'csat_map_item_rate',
  )
  const rate = new Map(rateRows.map((r) => [`${r.exam_id}#${r.no}`, Number(r.error_rate)]))
  const itemsByExam: Record<string, RefItem[]> = {}
  for (const id of examIds) {
    itemsByExam[id] = (keyByExam[id] ?? []).map((k) => ({ examId: id, no: k.no, points: k.points, errorRate: rate.get(`${id}#${k.no}`) ?? null }))
  }

  // 문항 ↔ 라인 연결 재료
  const csatItems = await selectByChunks<{ id: string; exam_id: string; no: number; type_id: string | null }>(
    examIds,
    20,
    (chunk) => db.from('csat_items').select('id, exam_id, no, type_id').in('exam_id', chunk),
    'csat_items',
  )
  const itemIds = csatItems.map((i) => i.id)
  const attrRows = await selectByChunks<{ item_id: string; attribute_code: string; weight: number }>(
    itemIds,
    100,
    (chunk) => db.from('csat_dx_item_attribute').select('item_id, attribute_code, weight').in('item_id', chunk),
    'csat_dx_item_attribute',
  )
  const trapRows = await selectByChunks<{ item_id: string; trap_key: string }>(
    itemIds,
    100,
    (chunk) => db.from('csat_dx_option_trap').select('item_id, trap_key').in('item_id', chunk),
    'csat_dx_option_trap',
  )
  const familyRows = await selectSmall<{ trap_key: string; family: string | null }>(() => db.from('csat_dx_trap_family').select('trap_key, family'), 'csat_dx_trap_family')
  const familyOf = new Map(familyRows.map((f) => [f.trap_key, f.family]))

  const dx = (dxSettingsRows[0]?.settings ?? {}) as { listening?: { attribute?: string; weight?: number }; habits?: { listening?: { to_no?: number } } }
  const lineCodes = new Set(nodes.filter((n) => n.kind === 'line').map((n) => n.code))
  const lineItems = lineItemKeys({
    lineCodes,
    exams: examIds.map((id) => ({ id, items: itemsByExam[id] })),
    metaByKey: Object.fromEntries(csatItems.map((i) => [`${i.exam_id}#${i.no}`, { itemId: i.id, typeId: i.type_id }])),
    attributesByItem: group(attrRows.filter((a) => a.weight > 0), (a) => a.item_id, (a) => a.attribute_code),
    trapFamiliesByItem: group(
      trapRows.filter((t) => familyOf.get(t.trap_key)),
      (t) => t.item_id,
      (t) => familyOf.get(t.trap_key) as string,
    ),
    byType: Object.fromEntries(links.filter((l) => l.link_kind === 'type').map((l) => [l.ref, l.line_code])),
    byNo: Object.fromEntries(links.filter((l) => l.link_kind === 'item_no').map((l) => [l.ref, l.line_code])),
    listening: { attribute: dx.listening?.attribute ?? 'A7', weight: dx.listening?.weight ?? 0, toNo: dx.habits?.listening?.to_no ?? 17 },
  })

  // 최신 스냅샷 → 현재 관찰값. 저장된 지도 지표를 그대로 믿을 수 없으면 저장 없이 지금 입력으로 다시 계산한다:
  //   옛 엔진 버전(예: Record Quality Layer 전 rule-v1) · 지도 계산이 꺼졌거나 실패한 채 저장(mapStatus ≠ ok — 시드 전 기록 등) ·
  //   순위 축소 추정의 분모(den)가 없는 2026-10-08 이전 지표(없으면 k=8 보정을 건너뛰어 행동이 달라진다)
  // Reveal Gate — 보류 시험(오답 원인 Pilot 수집 중) 기록이 있는 학습자는 관찰값(정오 · 점수 파생)을 싣지 않는다(embargo-gate · 판정 실패면 보류)
  const heldUser = await userHasHeldSession(userId)
  const [stored] = heldUser ? [] : await loadSnapshots(db, userId, 1)
  let snap = stored
  if (stored && staleMapEvidence(stored)) {
    const fresh = await computeSnapshotNow(db, userId, now)
    snap = { ...stored, engineVersion: fresh.result.engineVersion, rawScore: fresh.result.rawScore, habitFlags: fresh.result.habitFlags, evidence: fresh.evidence as typeof stored.evidence }
  }
  const ev = snap?.evidence
  const trendRaw = [...(ev?.trend ?? [])].reverse().find((t) => t.raw !== null)?.raw ?? null
  // 현재 위치의 근거 — 스냅샷 점수 흐름의 세션 중 **입력 신뢰도를 통과한 것만**(엔진이 진단 집계에 쓰는 같은 판정 — 점수 흐름 자체는
  // 모든 기록을 담는다). 일괄 입력 같은 의심 기록이 「최근 점수 · 이전↔최근 · 목표까지」에 섞이지 않게(Codex P1 · 2026-10-08)
  const trendIds = (ev?.trend ?? []).map((t) => t.sessionId)
  const sessionRows = trendIds.length
    ? await selectByChunks<{ id: string; exam_id: string; taken_at: string; raw_score: number | null; grade: number | null }>(
        trendIds, 100, (chunk) => db.from('csat_dx_session').select('id, exam_id, taken_at, raw_score, grade').eq('user_id', userId).in('id', chunk), 'csat_dx_session')
    : []
  const recordExamIds = [...new Set(sessionRows.map((r) => r.exam_id))]
  const recordLabels = recordExamIds.length
    ? Object.fromEntries((await selectByChunks<{ id: string; label: string }>(recordExamIds, 100, (chunk) => db.from('csat_exams').select('id, label').in('id', chunk), 'csat_exams')).map((e) => [e.id, e.label]))
    : {}
  // 20세션 × 45문항 = 900행 — 1,000행 상한 아래(기존 진단 로더와 같은 단위 · Codex P1)
  const responseRows = sessionRows.length
    ? await selectByChunks<{ session_id: string; item_no: number; chosen_option: number | null }>(
        sessionRows.map((r) => r.id), 20, (chunk) => db.from('csat_dx_response').select('session_id, item_no, chosen_option').in('session_id', chunk), 'csat_dx_response')
    : []
  const answersBySession = new Map<string, { no: number; chosen: number | null }[]>()
  for (const r of responseRows) {
    const list = answersBySession.get(r.session_id) ?? []
    list.push({ no: r.item_no, chosen: r.chosen_option })
    answersBySession.set(r.session_id, list)
  }
  const diagnosableIds = new Set(sessionRows.filter((r) => isDiagnosable(recordQuality(answersBySession.get(r.id) ?? []))).map((r) => r.id))
  const sessionById = new Map(sessionRows.filter((r) => diagnosableIds.has(r.id)).map((r) => [r.id, r]))
  // rev4 As-Is 입력 — 스냅샷 점수 흐름이 아니라 **기록 테이블에서 직접**(기록 직후 스냅샷이 아직 없을 때 「기록 없음」으로 보이던 경합 · 2차 E2E).
  //   입력 신뢰도 · 시험 준비 여부는 칸으로 남긴다(빼지 않는다). 보류 시험 기록이 있는 학습자는 관찰값과 같이 싣지 않는다(Reveal Gate).
  const v4Sessions = heldUser ? [] : await loadV4Sessions(db, userId, ev?.trend ?? [])
  const records: LearnerRecord[] = (ev?.trend ?? []).flatMap((t) => {
    const r = sessionById.get(t.sessionId)
    return r ? [{ label: recordLabels[r.exam_id] ?? r.exam_id, takenAt: r.taken_at, raw: t.raw ?? r.raw_score, grade: r.grade }] : []
  }).sort((a, b) => a.takenAt.localeCompare(b.takenAt))
  const snapshot: SnapshotInput | null = snap
    ? {
        // 데이터 없음으로 고정한 역량(A7)은 모델을 만들기 전에 입력에서 뺀다 — 영역 집계 · 근거량 · coverage 에도 남지 않게
        attributePoints: Object.fromEntries(Object.entries(ev?.attributePoints ?? {}).filter(([code]) => !NO_DATA_ATTRIBUTES.includes(code))),
        lineAccuracy: ev?.lineAccuracy ?? {},
        vOverlap: ev?.vOverlap ?? null,
        trapAvoidance: ev?.trapAvoidance ?? {},
        habitCodes: (snap.habitFlags ?? []).map((h) => h.code),
        habitEvaluable: ev?.habitEvaluable,
        currentScore: trendRaw ?? snap.rawScore,
        examSessions: ev?.examSessions ?? 0,
        responses: ev?.responses ?? 0,
      }
    : null

  const raw: MapRaw = {
    nodes,
    edges,
    tasks,
    settings,
    goal: goalRes.data?.target_score ?? null,
    doneTaskIds: new Set(doneRows.map((d) => d.task_id)),
    selection,
    itemsByExam,
    lineItems,
    habitLine: Object.fromEntries(links.filter((l) => l.link_kind === 'habit').map((l) => [l.ref, l.line_code])),
    snapshot,
    noData: NO_DATA_ATTRIBUTES,
  }

  // 연결 조회가 실패해도 지도는 그린다 — 연결만 빠진다
  const allLinks = await loadMapPracticeLinks().catch((e) => { console.error('[csat-map practice links]', e); return {} as Record<string, MapPracticeLink> })
  // Reveal Gate — 보류 시험 문항은 확인 링크 · 확인 결과(정오) · 수행 요약에서 뺀다. 판정 실패면 전부 뺀다(fail-closed · Codex P1)
  const gate = await itemRevealDecision(Object.values(allLinks).flatMap((l) => l.confirm.map((c) => c.target)))
  const practiceLinks = withoutHeld(allLinks, gate)
  const findAttempts = await loadFindAttempts(db, userId, Object.values(practiceLinks).flatMap((l) => l.confirm.map((c) => c.target))).catch((e) => {
    // 빈 배열로 바꾸면 이미 확인한 학습자에게 「아직 확인 안 함」을 보인다 — undefined 로 넘겨 판정을 보류한다
    console.error('[csat-map find attempts]', e)
    return undefined
  })
  const practiceResults = await loadPracticeResults(db, userId, practiceLinks, now).catch((e) => { console.error('[csat-map practice results]', e); return undefined })
  const lifecycleActivity = await loadLifecycleActivity(db, userId, [...new Set(Object.values(practiceLinks).map((l) => l.taskKey))], gate).catch((e) => { console.error('[csat-map lifecycle activity]', e); return undefined })
  // 원리 기반 결정 기록 — 화면과 같은 함수로 서버가 다시 계산해 근거와 함께 남긴다(learning_decisions). 실패해도 지도는 그린다
  if (findAttempts) {
    await logMapDecisions(userId, practiceLinks, findAttempts).catch((e) => console.error('[csat-map decision log]', e))
  }
  // 결과 환류의 다음 칸 — 같은 원리를 다른 지문에 적용(Practice). 실학습 풀에 그 문항 말고 다른 문항이 있을 때만
  // 링크를 보일 수 있는 칸(마친 확인 · 전이 없음)이 있을 때만, 풀은 한 번만 계산한다
  const needNext = Object.entries(practiceLinks).filter(([taskId, link]) => link.taskKey === 'claim-support' && practiceResults?.[taskId]?.next === 'move_on' && !practiceResults[taskId].transfer)
  const hrefs = needNext.length ? await practiceHrefsBeyond(needNext.map(([, l]) => l.itemId)).catch((e) => { console.error('[csat-map practice next]', e); return {} as Record<string, string | null> }) : {}
  const practiceNext: Record<string, string> = {}
  for (const [taskId, link] of needNext) if (hrefs[link.itemId]) practiceNext[taskId] = hrefs[link.itemId] as string

  // rev4 — 확인 과제 키별 「확인 묶음 밖」 적용 문항 수(실제로 있는 만큼만). 못 읽으면 0(적용 단계는 「준비 중」으로 보인다 — 숫자를 지어내지 않는다)
  const transferItems = await loadTransferItems(db, practiceLinks).catch((e) => { console.error('[csat-map v4 transfer items]', e); return {} as Record<string, number> })

  return {
    now: now.toISOString(),
    v4: {
      sessions: v4Sessions,
      proxyCovers: snap ? (ev?.trend ?? []).map((t) => t.sessionId) : [],
      refItems: examIds.flatMap((id) => itemsByExam[id]),
      transferItems,
    },
    model: buildMapModel(raw, examLabels),
    nodes,
    edges,
    tasks,
    sources,
    nodeSources: group(nodeSrc, (r) => r.node_code, (r) => r.source_id),
    edgeSources: group(edgeSrc, (r) => r.edge_id, (r) => r.source_id),
    doneTaskIds: [...raw.doneTaskIds],
    settings,
    practiceLinks,
    findAttempts,
    lifecycleActivity,
    practiceResults,
    practiceNext,
    records,
  }
}

/** rev4 As-Is 세션 — 본인 기록 전부(최근 200회) · 응답으로 입력 신뢰도 판정 · 시험 진단 준비 여부. 점수는 스냅샷 값이 있으면 그것(엔진 채점) */
async function loadV4Sessions(db: Db, userId: string, trend: { sessionId: string; raw: number | null }[]): Promise<AsIsSession[]> {
  const { data, error } = await db.from('csat_dx_session').select('id, exam_id, taken_at, created_at, raw_score, grade').eq('user_id', userId).order('taken_at', { ascending: false }).limit(200)
  if (error) throw new Error(`시험 기록 조회 실패: ${error.message}`)
  const rows = (data ?? []) as { id: string; exam_id: string; taken_at: string; created_at: string; raw_score: number | null; grade: number | null }[]
  if (rows.length === 0) return []
  const examIds = [...new Set(rows.map((r) => r.exam_id))]
  const [exams, responses] = await Promise.all([
    selectByChunks<{ id: string; label: string; diagnosis_ready: boolean | null }>(examIds, 100, (chunk) => db.from('csat_exams').select('id, label, diagnosis_ready').in('id', chunk), 'csat_exams'),
    selectByChunks<{ session_id: string; item_no: number; chosen_option: number | null }>(rows.map((r) => r.id), 20, (chunk) => db.from('csat_dx_response').select('session_id, item_no, chosen_option').in('session_id', chunk), 'csat_dx_response'),
  ])
  const examById = new Map(exams.map((e) => [e.id, e]))
  const answers = new Map<string, { no: number; chosen: number | null }[]>()
  for (const r of responses) answers.set(r.session_id, [...(answers.get(r.session_id) ?? []), { no: r.item_no, chosen: r.chosen_option }])
  const trendRaw = new Map(trend.map((t) => [t.sessionId, t.raw]))
  return rows.map((r) => ({
    id: r.id, examId: r.exam_id, examLabel: examById.get(r.exam_id)?.label ?? r.exam_id, takenAt: r.taken_at, enteredAt: r.created_at,
    raw: trendRaw.get(r.id) ?? r.raw_score, grade: r.grade,
    diagnosable: isDiagnosable(recordQuality(answers.get(r.id) ?? [])), examReady: examById.get(r.exam_id)?.diagnosis_ready === true,
  }))
}

/**
 * rev4 Workspace 「다른 글에 적용」 학습량 — 확인 과제 키마다 확인 묶음 밖의 실제 적용 문항 수.
 *   claim-support: 실학습 Practice 풀(practice-server) · 그 밖: 활성 문항 과제 적용(knowledge_applications csat_item_task · 상태 active).
 * 보류 문항 판정(itemRevealDecision)을 거친다 — 실패면 0(fail-closed).
 */
async function loadTransferItems(db: Db, links: Record<string, MapPracticeLink>): Promise<Record<string, number>> {
  const confirmOf = new Map<string, Set<string>>()
  for (const l of Object.values(links)) for (const c of l.confirm) {
    const s = confirmOf.get(c.taskKey) ?? new Set<string>()
    s.add(c.target)
    confirmOf.set(c.taskKey, s)
  }
  if (confirmOf.size === 0) return {}
  const [pool, apps] = await Promise.all([
    confirmOf.has(PRACTICE_SLUG) ? loadPracticePool({ preview: false }) : Promise.resolve([]),
    selectSmall<{ surface_ref: string }>(() => db.from('knowledge_applications').select('surface_ref').eq('surface', 'csat_item_task').eq('status', 'active').or([...confirmOf.keys()].map((k) => `surface_ref.like.${k}:*`).join(',')), 'knowledge_applications'),
  ])
  const byKey = new Map<string, Set<string>>()
  const add = (key: string, item: string) => { if (!confirmOf.get(key)?.has(item)) byKey.set(key, (byKey.get(key) ?? new Set()).add(item)) }
  for (const p of pool) add(PRACTICE_SLUG, p.itemId)
  for (const a of apps) {
    const r = parseItemTaskRef(a.surface_ref)
    if (r && confirmOf.has(r.taskKey)) add(r.taskKey, r.itemId)
  }
  const candidates = [...new Set([...byKey.values()].flatMap((s) => [...s]))]
  const gate = await itemRevealDecision(candidates)
  if (gate.failed) return {}
  return Object.fromEntries([...confirmOf.keys()].map((k) => [k, [...(byKey.get(k) ?? [])].filter((i) => !gate.held.has(i)).length]))
}

/** 보류 문항을 확인 링크에서 뺀다 — 확인 문항이 하나도 안 남으면 그 과제 링크를 뺀다. 판정 실패면 링크 없음 */
export function withoutHeld(links: Record<string, MapPracticeLink>, gate: { held: Set<string>; failed: boolean }): Record<string, MapPracticeLink> {
  if (gate.failed) return {}
  const out: Record<string, MapPracticeLink> = {}
  for (const [taskId, link] of Object.entries(links)) {
    const confirm = link.confirm.filter((c) => !gate.held.has(c.target))
    if (confirm.length === 0) continue
    out[taskId] = gate.held.has(link.target) ? { ...link, ...confirm[0], itemId: confirm[0].target, confirm } : { ...link, confirm }
  }
  return out
}

/** 결과 환류 — 연결된 실행 과제의 본인 수행 기록과 첫 시도. 이 db 는 서버 키라서 user_id 로 직접 좁힌다 */
async function loadPracticeResults(db: Db, userId: string, links: Record<string, MapPracticeLink>, now: Date): Promise<Record<string, PracticeResult>> {
  // 확인 문항 전부 — 첫 문항만 읽으면 다른 확인 문항의 수행 · 복습 예약이 빠진다
  const items = [...new Set(Object.values(links).flatMap((l) => (l.confirm?.length ? l.confirm.map((c) => c.target) : [l.itemId])))]
  const keys = [...new Set(Object.values(links).flatMap((l) => (l.confirm?.length ? l.confirm.map((c) => c.taskKey) : [l.taskKey])))]
  if (items.length === 0) return {}
  const LIMIT = 500
  // 연습(연결 문항)과 전이(같은 과제 키 · 다른 문항)를 따로 읽는다 — 한쪽이 많아도 다른 쪽이 창에서 밀려나지 않게. 최근부터
  const [prac, tran, first, rev] = await Promise.all([
    db.from('learning_task_attempts').select('task_key, item_ref, is_correct, answered_at, phase').eq('user_id', userId).in('task_key', keys).in('item_ref', items).neq('phase', 'transfer').order('answered_at', { ascending: false }).limit(LIMIT),
    db.from('learning_task_attempts').select('task_key, item_ref, is_correct, answered_at, phase').eq('user_id', userId).in('task_key', keys.flatMap(transferKeysOf)).not('item_ref', 'in', `(${items.map((i) => `"${i}"`).join(',')})`).order('answered_at', { ascending: false }).limit(LIMIT),
    db.from('learning_first_attempts').select('attempt_id, session_id, task_key, item_ref, is_correct, help_level, after_explanation, timing_uncertain, answered_at, phase').eq('user_id', userId).in('item_ref', items).order('answered_at'),
    db.from('learning_sessions').select('item_ref, review_at, deleted_at').eq('user_id', userId).in('item_ref', items).not('review_at', 'is', null),
  ])
  if (prac.error) throw new Error(`수행 기록 조회 실패: ${prac.error.message}`)
  // 전이 조회가 실패하면 전이만 빠진다 — 연습 결과 · 다음 행동은 그대로 보인다
  if (tran.error) console.error('[csat-map practice transfer]', tran.error.message)
  const tranRows = tran.error ? [] : (tran.data ?? [])
  // 첫 시도 뷰 · 예약을 못 읽으면 그 부분만 빠진다(도움 여부 모름 · 예약 없음) — 횟수 · 결과는 그대로 보인다
  const firstsRaw = first.error ? [] : (first.data ?? []) as (FirstAttemptRow & { attempt_id?: number; session_id?: string | null })[]
  // 세션을 건너온 도움을 첫 시도 요약에 반영(읽을 때 판정)
  const cross = await loadCrossVerdicts(db, userId, firstsRaw)
  const firsts: FirstAttemptRow[] = firstsRaw.map((f) => {
    const v = cross.get(Number(f.attempt_id)) ?? 'independent'
    return v === 'helped' ? { ...f, help_level: 'viewed_first' } : v === 'uncertain' ? { ...f, timing_uncertain: true } : f
  })
  const reviews = rev.error ? [] : (rev.data ?? []) as ReviewRow[]
  const out = practiceResultsFor(links, [...(prac.data ?? []), ...tranRows] as AttemptRow[], firsts, reviews, now)
  // 창을 채운 학습자 — 횟수만 정확히 다시 센다(연결 수만큼 head 요청)
  const exact = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>, what: string) => {
    const { count, error } = await q
    if (error || count === null) throw new Error(`${what} 조회 실패: ${error?.message ?? 'count=null'}`)
    return count
  }
  for (const [taskId, link] of Object.entries(links)) {
    // 확인 문항 전부 — 집계(practiceResultsFor)와 같은 범위로 다시 센다
    const targets = link.confirm?.length ? link.confirm.map((c) => c.target) : [link.itemId]
    const inList = `(${targets.map((i) => `"${i}"`).join(',')})`
    if ((prac.data ?? []).length >= LIMIT) {
      out[taskId] = { ...out[taskId], attempts: await exact(db.from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('task_key', link.taskKey).in('item_ref', targets).neq('phase', 'transfer'), '수행 횟수') }
    }
    if (tranRows.length >= LIMIT && out[taskId].transfer) {
      const n = await exact(db.from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('task_key', transferKeysOf(link.taskKey)).not('item_ref', 'in', inList), '전이 횟수')
      out[taskId] = { ...out[taskId], transfer: { ...out[taskId].transfer!, attempts: n } }
    }
  }
  return out
}

/** 단계마다 화면과 같은 결정을 서버에서 다시 계산해 기록한다 — 지도 과제 id(B6-3)의 줄 코드가 속한 학습 단계로 묶는다 */
async function logMapDecisions(userId: string, links: Record<string, MapPracticeLink>, attempts: FindAttemptRow[]): Promise<void> {
  const entries: DecisionLogEntry[] = []
  for (const [taskId, link] of Object.entries(links)) {
    if (!link.chain) continue
    const step = ALL_STEPS.find((s) => s.lines.includes(taskId.split('-')[0]))
    if (!step) continue
    const targets = link.confirm.map((c) => ({ itemRef: c.target, taskKey: c.taskKey }))
    const outcome = findOutcome(targets, attempts)
    const decision = decideStep({
      stepKey: step.key,
      findTaskId: taskId,
      outcome,
      chain: link.chain,
      confirm: link.confirm.map((c) => ({ itemRef: c.target, href: c.href, label: c.label })),
      triedItems: [...new Set(attempts.filter((a) => a.phase === 'practice' && a.activity !== 'practice' && link.confirm.some((c) => c.target === a.itemRef && c.taskKey === a.taskKey)).map((a) => a.itemRef))],
      practiceHref: link.taskKey === PRACTICE_SLUG ? `/csat/practice/${PRACTICE_SLUG}` : null,
    })
    entries.push({ decision, application: link.application ?? null })
  }
  if (entries.length === 0) return
  // 합성 여부 — 기록이 아니라 **계정**으로 판정한다(기록이 아직 없는 합성 계정의 첫 추천이 실제로 섞이던 결함 · Codex P2).
  //   기록 쪽 synthetic 과 같은 기준(SYNTHETIC_EMAIL_DOMAINS)
  const { data: who } = await (createAdminClient() as unknown as SupabaseClient).auth.admin.getUserById(userId)
  const synthetic = isSyntheticEmail(who?.user?.email ?? null)
  await recordDecisions(userId, synthetic, entries)
}
