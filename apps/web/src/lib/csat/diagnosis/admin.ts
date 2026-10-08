// apps/web/src/lib/csat/diagnosis/admin.ts
//
// 관리자 진단 화면의 조회. service role 로 읽는다 — 호출하는 페이지·액션이 먼저 requireAdmin.
// 문항 「검수 완료」 = 그 문항의 역량 9개 행이 모두 있고 reviewed_at 이 찍힘(관리자가 태깅 화면에서 저장) — 판정은 readiness.ts 하나.
// 유형 기본값 시드(source=type_default)는 값이 있어도 검수 완료로 세지 않는다.
// 진단 대상은 평가원(수능·모평)뿐이다 — 학평은 듣기 정답표가 없어 채점할 수 없으므로 목록에서 뺀다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { keysetSelect } from '@/lib/supabase/keyset-select'

import { ATTRIBUTE_CODES, type AttributeCode } from './engine/types'
import { selectByChunks, selectSmall } from './fetch'
import { examReadiness, type ExamReadiness } from './readiness'
import { sortByRevision } from './snapshot'

type Db = SupabaseClient

export interface ExamTagging {
  id: string
  label: string
  kind: string
  year: number | null
  month: number | null
  ready: boolean
  hasKey: boolean
  items: number
  reviewed: number
  /** 진단 반영 판정(검수 필요 · 완료 · 남음 · 구조 문제 · 켤 수 있는가 · 이유) */
  readiness: ExamReadiness
  errorRates: number
  grade1Ratio: number | null
  statsSource: string | null
}

/**
 * 시험별 진단 반영 판정 — 정답표 행 수 · 문항 정답 · 문항별 역량 9행 검수 표지를 읽어 readiness.examReadiness 로 계산한다.
 * 관리자 목록과 켜기 액션(setExamReadyAction)이 같은 함수를 쓴다(판정이 두 곳에서 갈라지지 않게).
 */
export async function loadReadiness(db: Db, examIds: string[]): Promise<Map<string, ExamReadiness>> {
  const ids = [...new Set(examIds)]
  if (ids.length === 0) return new Map()
  const [keys, items] = await Promise.all([
    // 회차당 45행 → 20회차 묶음이면 900행
    selectByChunks<{ exam_id: string }>(ids, 20, (chunk) => db.from('csat_dx_answer_key').select('exam_id').in('exam_id', chunk), 'csat_dx_answer_key'),
    selectByChunks<{ id: string; exam_id: string; answer: number | null; answers: number[] | null }>(ids, 30, (chunk) => db.from('csat_items').select('id, exam_id, answer, answers').in('exam_id', chunk), 'csat_items'),
  ])
  // 문항당 역량 ≤ 9행 → 100문항 묶음이면 900행
  const attrs = await selectByChunks<{ item_id: string; attribute_code: string; reviewed_at: string | null }>(
    items.map((i) => i.id),
    100,
    (chunk) => db.from('csat_dx_item_attribute').select('item_id, attribute_code, reviewed_at').in('item_id', chunk),
    'csat_dx_item_attribute',
  )
  const keyCount = new Map<string, number>()
  for (const k of keys) keyCount.set(k.exam_id, (keyCount.get(k.exam_id) ?? 0) + 1)
  const attrsByItem = new Map<string, { code: string; reviewed: boolean }[]>()
  for (const a of attrs) {
    const l = attrsByItem.get(a.item_id) ?? []
    l.push({ code: a.attribute_code, reviewed: a.reviewed_at !== null })
    attrsByItem.set(a.item_id, l)
  }
  const out = new Map<string, ExamReadiness>()
  for (const id of ids) {
    const mine = items.filter((i) => i.exam_id === id).map((i) => ({
      id: i.id,
      hasAnswer: (i.answers?.length ?? 0) > 0 || i.answer !== null,
      attrs: attrsByItem.get(i.id) ?? [],
    }))
    out.set(id, examReadiness(keyCount.get(id) ?? 0, mine))
  }
  return out
}

export async function loadExamTagging(db: Db): Promise<ExamTagging[]> {
  const exams = await selectSmall<{ id: string; label: string; kind: string; year: number | null; month: number | null; diagnosis_ready: boolean; official_grade1_ratio: number | null; official_stats_source: string | null }>(
    () => db.from('csat_exams').select('id, label, kind, year, month, diagnosis_ready, official_grade1_ratio, official_stats_source').eq('organizer', 'kice'),
    'csat_exams',
  )
  const ids = exams.map((e) => e.id)
  const [items, readiness] = await Promise.all([
    // 회차당 문항 ≤ 28 → 30회차 묶음이면 840행
    selectByChunks<{ id: string; exam_id: string; official_error_rate: number | null }>(
      ids,
      30,
      (chunk) => db.from('csat_items').select('id, exam_id, official_error_rate').in('exam_id', chunk),
      'csat_items',
    ),
    loadReadiness(db, ids),
  ])
  const agg = new Map<string, { items: number; rates: number }>()
  for (const i of items) {
    const a = agg.get(i.exam_id) ?? { items: 0, rates: 0 }
    a.items += 1
    if (i.official_error_rate !== null) a.rates += 1
    agg.set(i.exam_id, a)
  }
  return exams
    .map((e) => ({
      id: e.id,
      label: e.label,
      kind: e.kind,
      year: e.year,
      month: e.month,
      ready: e.diagnosis_ready,
      hasKey: readiness.get(e.id)?.structural.every((x) => !x.startsWith('정답표')) ?? false,
      items: agg.get(e.id)?.items ?? 0,
      reviewed: readiness.get(e.id)?.reviewed ?? 0,
      readiness: readiness.get(e.id) as ExamReadiness,
      errorRates: agg.get(e.id)?.rates ?? 0,
      grade1Ratio: e.official_grade1_ratio === null ? null : Number(e.official_grade1_ratio),
      statsSource: e.official_stats_source,
    }))
    .sort((a, b) => Number(b.hasKey) - Number(a.hasKey) || (b.year ?? 0) - (a.year ?? 0) || (b.month ?? 0) - (a.month ?? 0))
}

export interface TaggingItem {
  id: string
  no: number
  typeId: string
  stem: string
  choices: string[]
  answers: number[]
  errorRate: number | null
  ebsLinked: boolean | null
  weights: Record<AttributeCode, number>
  weightSource: 'type_default' | 'admin' | null
  reviewedAt: string | null
  traps: Record<number, { key: string; source: string } | undefined>
}

export async function loadExamItemsForTagging(db: Db, examId: string): Promise<TaggingItem[]> {
  const { data: items, error } = await db.from('csat_items')
    .select('id, no, type_id, stem, choices, answer, answers, official_error_rate, ebs_linked')
    .eq('exam_id', examId).order('no')
  if (error) throw new Error(`문항 조회 실패: ${error.message}`)
  const ids = (items ?? []).map((i) => i.id as string)
  if (ids.length === 0) return []
  const [{ data: attrs, error: ae }, { data: traps, error: te }] = await Promise.all([
    db.from('csat_dx_item_attribute').select('item_id, attribute_code, weight, source, reviewed_at').in('item_id', ids),
    db.from('csat_dx_option_trap').select('item_id, option_no, trap_key, source').in('item_id', ids),
  ])
  if (ae) throw new Error(`역량 조회 실패: ${ae.message}`)
  if (te) throw new Error(`함정 조회 실패: ${te.message}`)
  return (items ?? []).map((i) => {
    const mine = (attrs ?? []).filter((a) => a.item_id === i.id)
    const weights = Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, 0])) as Record<AttributeCode, number>
    for (const a of mine) weights[a.attribute_code as AttributeCode] = a.weight as number
    const reviewedAt = mine.map((a) => a.reviewed_at as string | null).find(Boolean) ?? null
    const trapMap: TaggingItem['traps'] = {}
    for (const t of (traps ?? []).filter((x) => x.item_id === i.id)) trapMap[t.option_no as number] = { key: t.trap_key as string, source: t.source as string }
    return {
      id: i.id as string,
      no: i.no as number,
      typeId: i.type_id as string,
      stem: (i.stem as string | null) ?? '',
      choices: Array.isArray(i.choices) ? (i.choices as string[]) : [],
      answers: ((i.answers as number[] | null)?.length ? i.answers : [i.answer]) as number[],
      errorRate: i.official_error_rate === null ? null : Number(i.official_error_rate),
      ebsLinked: i.ebs_linked as boolean | null,
      weights,
      weightSource: (mine.some((a) => a.source === 'admin') ? 'admin' : mine.length ? 'type_default' : null),
      reviewedAt,
      traps: trapMap,
    }
  })
}

/** 함정 선택지 — 계열이 정해진 라벨 + 이미 쓰인 라벨(롱테일 보존) */
export async function loadTrapOptions(db: Db): Promise<{ key: string; family: string | null }[]> {
  const rows = await keysetSelect<{ trap_key: string; family: string | null }, string>(
    (cursor, limit) => {
      const q = db.from('csat_dx_trap_family').select('trap_key, family').order('trap_key').limit(limit)
      return cursor === null ? q : q.gt('trap_key', cursor)
    },
    (row) => row.trap_key,
    'csat_dx_trap_family',
  )
  return rows.map((r) => ({ key: r.trap_key, family: r.family }))
}

export interface LearnerSummary {
  userId: string
  email: string | null
  sessions: number
  lastTaken: string | null
  snapshot: { id: string; computedAt: string; gradeEst: number | null; ability: number | null; confidence: string } | null
}

export async function loadLearners(db: Db): Promise<LearnerSummary[]> {
  const byId = <T extends { id: string }>(table: string, cols: string) =>
    keysetSelect<T, string>(
      (cursor, limit) => {
        // 컬럼 문자열이 인자라 PostgREST 타입 추론이 안 된다 — 결과 모양은 호출부의 T 가 정한다
        const q = db.from(table).select(cols).order('id').limit(limit)
        return (cursor === null ? q : q.gt('id', cursor)) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>
      },
      (row) => row.id,
      table,
    )
  const [sessions, snapsRaw, profiles] = await Promise.all([
    byId<{ id: string; user_id: string; taken_at: string }>('csat_dx_session', 'id, user_id, taken_at'),
    byId<{ id: string; user_id: string; computed_at: string; inputs_as_of: string; settings_id: number | null; evidence: Record<string, unknown>; grade_est: number | null; adjusted_score: number | null; confidence: string }>(
      'csat_dx_snapshot', 'id, user_id, computed_at, inputs_as_of, settings_id, evidence, grade_est, adjusted_score, confidence',
    ),
    byId<{ id: string; user_id: string }>('csat_dx_profile_hist', 'id, user_id'),
  ])
  // 학습자 화면과 같은 「최신」 — 입력 워터마크, 같으면 계산 시각(snapshot.ts loadSnapshots)
  const snaps = sortByRevision(snapsRaw)
  const users = new Set([...sessions.map((s) => s.user_id), ...profiles.map((p) => p.user_id)])
  const out: LearnerSummary[] = []
  for (const userId of users) {
    const mine = sessions.filter((s) => s.user_id === userId)
    const snap = snaps.find((s) => s.user_id === userId)
    const { data } = await db.auth.admin.getUserById(userId)
    out.push({
      userId,
      email: data?.user?.email ?? null,
      sessions: mine.length,
      lastTaken: mine.map((s) => s.taken_at).sort().at(-1) ?? null,
      snapshot: snap
        ? { id: snap.id, computedAt: snap.computed_at, gradeEst: snap.grade_est, ability: snap.adjusted_score === null ? null : Number(snap.adjusted_score), confidence: snap.confidence }
        : null,
    })
  }
  return out.sort((a, b) => (b.snapshot?.computedAt ?? '').localeCompare(a.snapshot?.computedAt ?? ''))
}
