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

import { NO_DATA_ATTRIBUTES } from './core'
import { lineItemKeys } from './memberships'
import { staleMapEvidence } from './stale'
import { loadMapPracticeLinks, type MapPracticeLink } from '../../knowledge/product-server'
import type { FindAttemptRow } from '../../knowledge/find-outcome'
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
  /** 학습자 본인의 시험 기록(진단에 반영된 회차 · 오래된 것부터) — 「현재 위치」는 이것만 근거로 쓴다 */
  records: LearnerRecord[]
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

/** 확인 문항에서의 내 첫 시도 — 학습자 RLS 클라이언트로 본인 행만. 문항이 없으면 묻지 않는다 */
async function loadFindAttempts(db: Db, userId: string, items: string[]): Promise<FindAttemptRow[]> {
  if (items.length === 0) return []
  const { data, error } = await db.from('learning_first_attempts').select('*').eq('user_id', userId).in('item_ref', [...new Set(items)])
  if (error) throw new Error(`확인 결과 조회 실패: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId: String(r.user_id),
    itemRef: String(r.item_ref),
    taskKey: String(r.task_key ?? ''),
    phase: String(r.phase) as FindAttemptRow['phase'],
    isCorrect: typeof r.is_correct === 'boolean' ? r.is_correct : null,
    synthetic: r.synthetic === true,
    helpLevel: (r.help_level as string | null) ?? null,
    afterViewedFirst: r.after_viewed_first === true,
    afterExplanation: r.after_explanation === true,
    timingUncertain: r.timing_uncertain === true,
  }))
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
  const candidates: ExamCandidate[] = examRows.map((e) => ({
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
  const [stored] = await loadSnapshots(db, userId, 1)
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
  const sessionById = new Map(sessionRows.filter((r) => isDiagnosable(recordQuality(answersBySession.get(r.id) ?? []))).map((r) => [r.id, r]))
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
  const practiceLinks = await loadMapPracticeLinks().catch((e) => { console.error('[csat-map practice links]', e); return {} as Record<string, MapPracticeLink> })
  const findAttempts = await loadFindAttempts(db, userId, Object.values(practiceLinks).flatMap((l) => l.confirm.map((c) => c.target))).catch((e) => {
    console.error('[csat-map find attempts]', e)
    return [] as FindAttemptRow[]
  })

  return {
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
    records,
  }
}
