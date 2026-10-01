// apps/web/src/lib/csat/diagnosis/admin.ts
//
// 관리자 진단 화면의 조회. service role 로 읽는다 — 호출하는 페이지·액션이 먼저 requireAdmin.
// 문항 「검수 완료」 = 그 문항의 역량 행에 reviewed_at 이 찍힘(관리자가 태깅 화면에서 저장).
// 유형 기본값 시드(source=type_default)는 값이 있어도 검수 완료로 세지 않는다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { pagedSelect } from '@/lib/supabase/paged-select'

import { ATTRIBUTE_CODES, type AttributeCode } from './engine/types'

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
  errorRates: number
  grade1Ratio: number | null
  statsSource: string | null
}

export async function loadExamTagging(db: Db): Promise<ExamTagging[]> {
  const [exams, items, reviewed, keys] = await Promise.all([
    pagedSelect<{ id: string; label: string; kind: string; year: number | null; month: number | null; diagnosis_ready: boolean; official_grade1_ratio: number | null; official_stats_source: string | null }>(
      (f, t) => db.from('csat_exams').select('id, label, kind, year, month, diagnosis_ready, official_grade1_ratio, official_stats_source').order('id').range(f, t),
      'csat_exams',
    ),
    pagedSelect<{ id: string; exam_id: string; official_error_rate: number | null }>(
      (f, t) => db.from('csat_items').select('id, exam_id, official_error_rate').order('id').range(f, t),
      'csat_items',
    ),
    pagedSelect<{ item_id: string }>(
      (f, t) => db.from('csat_dx_item_attribute').select('item_id').not('reviewed_at', 'is', null).eq('attribute_code', 'A1').order('item_id').range(f, t),
      'csat_dx_item_attribute',
    ),
    pagedSelect<{ exam_id: string }>(
      (f, t) => db.from('csat_dx_answer_key').select('exam_id').eq('no', 1).order('exam_id').range(f, t),
      'csat_dx_answer_key',
    ),
  ])
  const reviewedSet = new Set(reviewed.map((r) => r.item_id))
  const keySet = new Set(keys.map((k) => k.exam_id))
  const agg = new Map<string, { items: number; reviewed: number; rates: number }>()
  for (const i of items) {
    const a = agg.get(i.exam_id) ?? { items: 0, reviewed: 0, rates: 0 }
    a.items += 1
    if (reviewedSet.has(i.id)) a.reviewed += 1
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
      hasKey: keySet.has(e.id),
      items: agg.get(e.id)?.items ?? 0,
      reviewed: agg.get(e.id)?.reviewed ?? 0,
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
  const rows = await pagedSelect<{ trap_key: string; family: string | null }>(
    (f, t) => db.from('csat_dx_trap_family').select('trap_key, family').order('trap_key').range(f, t),
    'csat_dx_trap_family',
  )
  return rows.map((r) => ({ key: r.trap_key, family: r.family }))
}

export interface PoolRow {
  itemId: string
  active: boolean
  examId: string
  no: number
  typeId: string
  weights: Partial<Record<AttributeCode, number>>
  reviewed: boolean
}

export async function loadPool(db: Db): Promise<PoolRow[]> {
  const { data: pool, error } = await db.from('csat_dx_pool').select('item_id, active').order('item_id')
  if (error) throw new Error(`진단 풀 조회 실패: ${error.message}`)
  const ids = (pool ?? []).map((p) => p.item_id as string)
  if (ids.length === 0) return []
  const [{ data: items, error: ie }, { data: attrs, error: ae }] = await Promise.all([
    db.from('csat_items').select('id, exam_id, no, type_id').in('id', ids),
    db.from('csat_dx_item_attribute').select('item_id, attribute_code, weight, reviewed_at').in('item_id', ids),
  ])
  if (ie) throw new Error(`문항 조회 실패: ${ie.message}`)
  if (ae) throw new Error(`역량 조회 실패: ${ae.message}`)
  const byId = new Map((items ?? []).map((i) => [i.id as string, i]))
  return (pool ?? []).map((p) => {
    const i = byId.get(p.item_id as string)
    const mine = (attrs ?? []).filter((a) => a.item_id === p.item_id)
    return {
      itemId: p.item_id as string,
      active: p.active as boolean,
      examId: (i?.exam_id as string) ?? '',
      no: (i?.no as number) ?? 0,
      typeId: (i?.type_id as string) ?? '',
      weights: Object.fromEntries(mine.filter((a) => (a.weight as number) > 0).map((a) => [a.attribute_code, a.weight])),
      reviewed: mine.some((a) => a.reviewed_at),
    }
  })
}

/** 역량별 커버리지 — 활성 풀 문항의 가중치 합과 문항 수 */
export function poolCoverage(rows: PoolRow[]): Record<AttributeCode, { items: number; weight: number }> {
  const out = Object.fromEntries(ATTRIBUTE_CODES.map((c) => [c, { items: 0, weight: 0 }])) as Record<AttributeCode, { items: number; weight: number }>
  for (const r of rows.filter((x) => x.active)) {
    for (const [c, w] of Object.entries(r.weights)) {
      if (!w) continue
      out[c as AttributeCode].items += 1
      out[c as AttributeCode].weight += w
    }
  }
  return out
}

export interface LearnerSummary {
  userId: string
  email: string | null
  sessions: number
  lastTaken: string | null
  snapshot: { id: string; computedAt: string; gradeEst: number | null; ability: number | null; confidence: string } | null
}

export async function loadLearners(db: Db): Promise<LearnerSummary[]> {
  const [sessions, snaps, profiles] = await Promise.all([
    pagedSelect<{ user_id: string; taken_at: string }>(
      (f, t) => db.from('csat_dx_session').select('user_id, taken_at').order('id').range(f, t),
      'csat_dx_session',
    ),
    pagedSelect<{ id: string; user_id: string; computed_at: string; grade_est: number | null; adjusted_score: number | null; confidence: string }>(
      (f, t) => db.from('csat_dx_snapshot').select('id, user_id, computed_at, grade_est, adjusted_score, confidence').order('computed_at', { ascending: false }).order('id').range(f, t),
      'csat_dx_snapshot',
    ),
    pagedSelect<{ user_id: string }>(
      (f, t) => db.from('csat_dx_profile_hist').select('user_id').order('id').range(f, t),
      'csat_dx_profile_hist',
    ),
  ])
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
