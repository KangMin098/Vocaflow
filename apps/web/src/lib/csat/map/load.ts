// apps/web/src/lib/csat/map/load.ts
//
// 내 진단 「학습 지도」 데이터 로더 — 서버가 service role 로 읽어 모델(model.ts)을 조립한다.
// 읽는 것: 지도 정적 데이터(노드 · 연결선 · 과제 · 출처) · 본인 목표 · 과제 완료 · 기준 시험(최근 적격 N회)의 배점 · 오답률 · 연결표 · 최신 스냅샷.
// 지도 테이블이 없거나 시드 전이면 null(화면은 「준비 중」). 그 밖의 오류는 던진다 — 오류를 빈 지도로 삼키지 않는다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { selectByChunks, selectSmall } from '../diagnosis/fetch'
import { loadSnapshots } from '../diagnosis/snapshot'

import { NO_DATA_ATTRIBUTES } from './core'
import { lineItemKeys } from './memberships'
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

export async function loadMapPage(db: Db, userId: string): Promise<MapPageData | null> {
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

  // 최신 스냅샷 → 현재 성취율
  const [snap] = await loadSnapshots(db, userId, 1)
  const ev = snap?.evidence
  const trendRaw = [...(ev?.trend ?? [])].reverse().find((t) => t.raw !== null)?.raw ?? null
  const snapshot: SnapshotInput | null = snap
    ? {
        // 데이터 없음으로 고정한 역량(A7)은 모델을 만들기 전에 입력에서 뺀다 — 영역 집계 · 근거량 · coverage 에도 남지 않게
        attributePoints: Object.fromEntries(Object.entries(ev?.attributePoints ?? {}).filter(([code]) => !NO_DATA_ATTRIBUTES.includes(code))),
        lineAccuracy: ev?.lineAccuracy ?? {},
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
  }
}
