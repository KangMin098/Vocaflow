// apps/web/src/lib/csat/learner.ts
//
// 학습자에게 내보내는 기출 분석 — **우리가 쓴 것만 나간다.**
//
// ⚠️ 평가원 지문 원문(`csat_items.passage`)은 여기 어디에서도 읽지 않는다. 학습자 화면이
//    쓰는 것은 유형 리포트와 문항 분석(우리 저작물)이고, 원문은 분석 안의 짧은 인용
//    (`answer_locus.quote`)까지다. 원문 전체가 필요하면 평가원 공개자료로 보내야 한다.
//
// 그래서 이 파일은 **일반 클라이언트**(RLS 적용)를 쓴다. service_role 을 쓰면 실수 한 번에
// 지문이 새므로, 새지 않는 것을 코드 구조로 보장한다 — RLS 가 published 만 열어 준다.

import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

/**
 * RLS 를 그대로 따르는 학습자 클라이언트. `@vocaflow/types` 의 `Database` 는 스키마에서
 * 생성되므로 마이그레이션 `20260902055354` 적용 전 타입에는 `csat_*` 가 없다.
 * 완화 지점을 이 한 함수로 모은다 — 타입 재생성 뒤 제네릭만 되돌리면 전 경로가 다시 검사된다.
 */
async function csatDb(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient
}

export interface CsatTypeCard {
  type_id: string
  name: string
  section: string
  status: 'active' | 'retired'
  /** 사정권 기출에서 이 유형이 몇 문항인가 — 출제 비중 */
  items: number
  /** 최근 4개년(2023~) 문항 수 — 현행 설계에서의 비중 */
  recent: number
  /** 분석이 준비됐나 */
  ready: boolean
  /** 준비된 경우 한 줄 — 학습자가 실제로 미끄러지는 지점 */
  headline: string | null
  time_budget_sec: number | null
}

export interface CsatTypeDetail {
  type_id: string
  name: string
  items: number
  n_analyzed: number
  answer_locus_pattern: string | null
  procedure: { step: string; on_fail?: string }[]
  recurring_traps: { trap: string; count?: number; signature?: string }[]
  /** 접어 두기 전 전체 개수 — 화면이 «6/31» 처럼 말할 수 있어야 한다 */
  recurring_traps_total: number
  failure_modes: string[]
  failure_modes_total: number
  time_budget_sec: number | null
}

type TypeRow = { id: string; name: string; section: string; status: string }
type ItemRow = { type_id: string | null; exam_id: string }
type ReportRow = {
  type_id: string
  n_analyzed: number
  recurring_traps: unknown
  answer_locus_pattern: string | null
  procedure_steps: unknown
  failure_modes: unknown
  time_budget_sec: number | null
}

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** 회차 id 에서 학년도를 읽는다 — `2026` · `2014A` · `M2606` */
function yearOf(examId: string): number {
  if (examId.startsWith('M')) return 2000 + Number(examId.slice(1, 3))
  return Number(examId.slice(0, 4))
}

/**
 * 유형 카드 목록.
 *
 * **분석이 없는 유형도 숨기지 않는다.** 숨기면 학습자는 그 유형이 시험에 안 나온다고 읽는다.
 * 대신 「분석 준비 중」으로 담백하게 적는다(Calm UI — 없는 것을 재촉하지 않는다).
 */
export async function loadCsatTypeCards(): Promise<{ cards: CsatTypeCard[]; error: string | null }> {
  const db = await csatDb()

  const [types, items, reports] = await Promise.all([
    db.from('csat_types').select('id, name, section, status').eq('in_scope', true),
    db.from('csat_items_public').select('type_id, exam_id').eq('in_scope', true),
    db.from('csat_type_reports').select('type_id, failure_modes, time_budget_sec').eq('status', 'published'),
  ])

  const bad = [types, items, reports].find((r) => r.error)
  if (bad?.error) return { cards: [], error: bad.error.message }

  const count = new Map<string, { items: number; recent: number }>()
  for (const it of (items.data ?? []) as ItemRow[]) {
    if (!it.type_id) continue
    const e = count.get(it.type_id) ?? { items: 0, recent: 0 }
    e.items += 1
    if (yearOf(it.exam_id) >= 2023) e.recent += 1
    count.set(it.type_id, e)
  }

  const repOf = new Map(
    ((reports.data ?? []) as { type_id: string; failure_modes: unknown; time_budget_sec: number | null }[]).map(
      (r) => [r.type_id, r],
    ),
  )

  const cards: CsatTypeCard[] = ((types.data ?? []) as TypeRow[])
    .map((t) => {
      const c = count.get(t.id) ?? { items: 0, recent: 0 }
      const rep = repOf.get(t.id)
      const modes = arr<string>(rep?.failure_modes)
      return {
        type_id: t.id,
        name: t.name,
        section: t.section,
        status: t.status === 'retired' ? ('retired' as const) : ('active' as const),
        items: c.items,
        recent: c.recent,
        ready: Boolean(rep),
        headline: modes[0] ?? null,
        time_budget_sec: rep?.time_budget_sec ?? null,
      }
    })
    // 현행 설계에서 많이 나오는 유형부터. 폐지 유형은 뒤로 — 없애지는 않는다(옛 기출을 푸는 학습자가 있다)
    .sort((a, b) => Number(a.status === 'retired') - Number(b.status === 'retired') || b.recent - a.recent || b.items - a.items)

  return { cards, error: null }
}

/** 유형 하나의 분석 상세. 없으면 null (아직 준비되지 않은 유형) */
export async function loadCsatTypeDetail(typeId: string): Promise<{ detail: CsatTypeDetail | null; error: string | null }> {
  const db = await csatDb()

  const [typeRes, itemsRes, repRes] = await Promise.all([
    db.from('csat_types').select('id, name').eq('id', typeId).maybeSingle(),
    db.from('csat_items_public').select('type_id').eq('in_scope', true).eq('type_id', typeId),
    db
      .from('csat_type_reports')
      .select('type_id, n_analyzed, recurring_traps, answer_locus_pattern, procedure_steps, failure_modes, time_budget_sec')
      .eq('type_id', typeId)
      .eq('status', 'published')
      .maybeSingle(),
  ])

  const bad = [typeRes, itemsRes, repRes].find((r) => r.error)
  if (bad?.error) return { detail: null, error: bad.error.message }
  const t = typeRes.data as { id: string; name: string } | null
  if (!t) return { detail: null, error: null }

  const rep = repRes.data as ReportRow | null
  if (!rep) {
    return {
      detail: {
        type_id: t.id,
        name: t.name,
        items: (itemsRes.data ?? []).length,
        n_analyzed: 0,
        answer_locus_pattern: null,
        procedure: [],
        recurring_traps: [],
        recurring_traps_total: 0,
        failure_modes: [],
        failure_modes_total: 0,
        time_budget_sec: null,
      },
      error: null,
    }
  }

  return {
    detail: {
      type_id: t.id,
      name: t.name,
      items: (itemsRes.data ?? []).length,
      n_analyzed: rep.n_analyzed,
      answer_locus_pattern: rep.answer_locus_pattern,
      procedure: arr<{ step: string; on_fail?: string }>(rep.procedure_steps),
      // **화면에 다 쏟지 않는다.** 청크를 합치면 한 유형의 함정 31종·실패 지점 61개가 된다.
      // 그것은 원장의 값이지 학습자가 한 번에 읽을 것이 아니다(작업기억 ~4항목 · Cognitive Load).
      // 잘라 낸 것이 아니라 **접어 둔 것**이므로 화면이 전체 개수를 함께 말한다.
      recurring_traps: arr<{ trap: string; count?: number; signature?: string }>(rep.recurring_traps)
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, 6),
      recurring_traps_total: arr<unknown>(rep.recurring_traps).length,
      failure_modes: arr<string>(rep.failure_modes).slice(0, 6),
      failure_modes_total: arr<unknown>(rep.failure_modes).length,
      time_budget_sec: rep.time_budget_sec,
    },
    error: null,
  }
}

/** 한 회차를 번호 순서로 푸는 계획의 한 줄 */
export interface CsatPlanRow {
  no: number
  type_id: string
  type_name: string
  points: number | null
  time_budget_sec: number | null
  ready: boolean
  /** 이 유형의 첫 단계 — 번호를 만났을 때 가장 먼저 할 동작 */
  first_step: string | null
}

export interface CsatPlan {
  exam_id: string
  exam_label: string
  rows: CsatPlanRow[]
  scope_points: number
  /** 절차가 준비된 문항의 시간 예산 합 */
  budget_sec: number
  ready_items: number
  /** 시험에서 독해에 쓸 수 있는 시간(초). 영어 70분 중 듣기 약 25분을 뺀 값 */
  available_sec: number
  error: string | null
}

/** 영어 시험 70분 = 4,200초. 듣기 방송이 약 25분(1,500초)이므로 독해 몫은 2,700초다. */
export const CSAT_READING_SECONDS = 2700

/**
 * **한 회차 주파 계획.**
 *
 * 유형별 분석을 낱개로 읽는 것과, 그것을 **번호 순서로 늘어놓는 것**은 다른 물건이다.
 * 시험장에서 학습자가 만나는 것은 유형 목록이 아니라 18번부터 45번까지의 줄이고,
 * 그 줄을 시간 안에 통과할 수 있는지가 **독해 실점 0** 의 실제 조건이다.
 *
 * 그래서 이 화면은 **시간 예산 합계를 시험 시간과 나란히 적는다.** 합이 넘으면 절차가
 * 아무리 옳아도 쓸 수 없다 — 그건 분석의 결함이지 학습자의 결함이 아니다.
 *
 * 번호별 유형은 2019학년도부터 고정이므로(이 저장소 실측 명제 E11) 최신 회차 하나를
 * 본으로 쓴다. 본이 될 회차가 없으면 빈 계획을 돌려준다.
 */
export async function loadCsatPlan(): Promise<CsatPlan> {
  const db = await csatDb()
  const empty: CsatPlan = {
    exam_id: '',
    exam_label: '',
    rows: [],
    scope_points: 0,
    budget_sec: 0,
    ready_items: 0,
    available_sec: CSAT_READING_SECONDS,
    error: null,
  }

  const examRes = await db
    .from('csat_exams')
    .select('id, label, year, month, kind')
    .eq('kind', 'suneung')
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (examRes.error) return { ...empty, error: examRes.error.message }
  const exam = examRes.data as { id: string; label: string } | null
  if (!exam) return empty

  const [itemsRes, typesRes, repsRes] = await Promise.all([
    db.from('csat_items_public').select('no, type_id, points').eq('exam_id', exam.id).eq('in_scope', true),
    db.from('csat_types').select('id, name'),
    db.from('csat_type_reports').select('type_id, time_budget_sec, procedure_steps').eq('status', 'published'),
  ])
  const bad = [itemsRes, typesRes, repsRes].find((r) => r.error)
  if (bad?.error) return { ...empty, exam_id: exam.id, exam_label: exam.label, error: bad.error.message }

  const nameOf = new Map(((typesRes.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]))
  const repOf = new Map(
    ((repsRes.data ?? []) as { type_id: string; time_budget_sec: number | null; procedure_steps: unknown }[]).map(
      (r) => [r.type_id, r],
    ),
  )

  const rows: CsatPlanRow[] = ((itemsRes.data ?? []) as { no: number; type_id: string | null; points: number | null }[])
    .filter((i) => i.type_id)
    .map((i) => {
      const rep = repOf.get(i.type_id as string)
      const steps = arr<{ step?: string }>(rep?.procedure_steps)
      return {
        no: i.no,
        type_id: i.type_id as string,
        type_name: nameOf.get(i.type_id as string) ?? i.type_id!,
        points: i.points,
        time_budget_sec: rep?.time_budget_sec ?? null,
        ready: Boolean(rep),
        first_step: steps[0]?.step ?? null,
      }
    })
    .sort((a, b) => a.no - b.no)

  return {
    exam_id: exam.id,
    exam_label: exam.label,
    rows,
    scope_points: rows.reduce((a, r) => a + (r.points ?? 0), 0),
    budget_sec: rows.reduce((a, r) => a + (r.time_budget_sec ?? 0), 0),
    ready_items: rows.filter((r) => r.ready).length,
    available_sec: CSAT_READING_SECONDS,
    error: null,
  }
}

// ─────────────────────────────────────────────────────────────────────
// 문항 단위 — **「이 문제의 답이 왜 이것인가」**
//
// 유형 리포트는 "이 유형은 이렇게 푼다" 를 말한다. 그런데 학습자가 실제로 막히는 자리는
// **눈앞의 한 문항**이고, 알고 싶은 것은 "그래서 왜 ③인가" 하나다. 그 답이 화면에 없으면
// 유형 절차는 외울 것이 하나 더 늘어난 것에 지나지 않는다.
//
// ⚠️ **원문은 여기서도 안 나간다.** 지문·선지는 평가원 저작물이라 `csat_items_public` 뷰에
//    컬럼 자체가 없다. 이 화면이 내보내는 것은 **우리가 쓴 설명**과 그 안의 짧은 인용까지이고,
//    학습자는 문항 원문을 평가원 공개자료에서 함께 본다. 곧 이 화면은 **해설**이다.
// ─────────────────────────────────────────────────────────────────────

/** URL 에 쓰는 문항 id — 원장의 `2026#31` 은 `#` 때문에 주소가 안 된다 */
export const toItemSlug = (id: string) => id.replace('#', '-')
export const fromItemSlug = (slug: string) => slug.replace('-', '#')

export interface CsatItemBrief {
  id: string
  slug: string
  exam_label: string
  no: number
  points: number | null
  answer: number | null
  /** 정답 확정 근거가 실제로 적혀 있나 — 없으면 목록에서 「준비 중」으로 말한다 */
  explained: boolean
}

export interface CsatItemExplain {
  id: string
  exam_label: string
  no: number
  points: number | null
  answer: number | null
  type_id: string | null
  type_name: string | null
  /** 답을 모르는 회차 — 정답표가 없으면 「왜 정답인가」를 쓸 수 없다 */
  answer_unknown: boolean
  /** ① 답이 왜 이것인가 */
  why_correct: string | null
  evidence_quote: string | null
  evidence_reasoning: string | null
  /** ② 나머지가 왜 아닌가 */
  distractors: { n: number; trap: string | null; why_tempting: string | null; how_to_reject: string | null }[]
  /** ③ 다시 풀 때의 순서 */
  procedure: { step: string; on_fail?: string }[]
  required_vocab: string[]
  time_budget_sec: number | null
}

type AnalysisRow = {
  item_id: string
  version: number
  answer_unknown: boolean
  answer_locus: { quote?: string; reasoning?: string } | null
  choice_analysis: {
    n: number
    verdict?: string
    trap?: string | null
    why_correct?: string | null
    why_tempting?: string | null
    how_to_reject?: string | null
  }[] | null
  solve_procedure: { step: string; on_fail?: string }[] | null
  required_vocab: string[] | null
  time_budget_sec: number | null
}

/** 한 유형에 딸린 기출 문항 목록 — 최신 회차 먼저 */
export async function loadCsatTypeItems(typeId: string): Promise<CsatItemBrief[]> {
  const db = await csatDb()
  const [itemsRes, examsRes, aRes] = await Promise.all([
    db.from('csat_items_public').select('id, exam_id, no, points, answer').eq('type_id', typeId).eq('in_scope', true),
    db.from('csat_exams').select('id, label, year, month'),
    // 같은 이유로 여기도 버전이 여럿이다. 「해설 있음」은 **최신 버전**으로 판정한다 —
    // 옛 버전에만 근거가 있고 최신에는 없는 경우를 「있음」으로 세면 빈 해설로 학습자를 보낸다.
    db.from('csat_item_analyses').select('item_id, choice_analysis, version').eq('status', 'published'),
  ])
  if (itemsRes.error || examsRes.error) return []

  const exam = new Map(
    ((examsRes.data ?? []) as { id: string; label: string; year: number; month: number }[]).map((e) => [e.id, e]),
  )
  // 「설명이 있다」의 기준은 **정답 선지에 why_correct 가 있는가** 하나다.
  // 분석 행이 있다는 것만으로 있다고 말하면, 비어 있는 해설로 학습자를 보내게 된다.
  const latest = new Map<string, { version: number; choice_analysis: AnalysisRow['choice_analysis'] }>()
  for (const r of (aRes.data ?? []) as { item_id: string; version: number; choice_analysis: AnalysisRow['choice_analysis'] }[]) {
    const cur = latest.get(r.item_id)
    if (!cur || r.version > cur.version) latest.set(r.item_id, r)
  }
  const explained = new Set(
    [...latest.entries()]
      .filter(([, r]) => (r.choice_analysis ?? []).some((c) => c.verdict === 'correct' && (c.why_correct ?? '').length >= 40))
      .map(([id]) => id),
  )

  return ((itemsRes.data ?? []) as { id: string; exam_id: string; no: number; points: number | null; answer: number | null }[])
    .map((it) => ({
      id: it.id,
      slug: toItemSlug(it.id),
      exam_label: exam.get(it.exam_id)?.label ?? it.exam_id,
      no: it.no,
      points: it.points,
      answer: it.answer,
      explained: explained.has(it.id),
    }))
    .sort((a, b) => {
      const ea = exam.get(a.id.split('#')[0])
      const eb = exam.get(b.id.split('#')[0])
      return (eb?.year ?? 0) - (ea?.year ?? 0) || (eb?.month ?? 0) - (ea?.month ?? 0) || a.no - b.no
    })
}

/** 문항 하나의 해설 */
export async function loadCsatItemExplain(
  id: string,
): Promise<{ item: CsatItemExplain | null; error: string | null }> {
  const db = await csatDb()
  const [itemRes, aRes] = await Promise.all([
    db.from('csat_items_public').select('id, exam_id, no, points, answer, type_id').eq('id', id).maybeSingle(),
    // ⚠️ **한 문항에 published 가 여러 행 있다.** 드레인이 분석을 고칠 때 덮어쓰지 않고
    //    **버전을 올려 새 행**을 넣기 때문이다(옛 분석을 지우지 않는 것이 그 설계의 요점이다).
    //    그래서 `maybeSingle()` 은 여러 행을 만나 **빈손으로 돌아온다** — 화면은 멀쩡히 뜨고
    //    「아직 쓰는 중이에요」만 뜬다. DB 에는 근거가 다 들어 있는데도.
    //    실측 2026-09-03: 606건을 보강 적재한 직후 이 화면이 전부 그렇게 보였고, e2e 가 잡았다.
    //    **언제나 최신 버전 하나**를 집는다.
    db
      .from('csat_item_analyses')
      .select('item_id, answer_unknown, answer_locus, choice_analysis, solve_procedure, required_vocab, time_budget_sec, version')
      .eq('item_id', id)
      .eq('status', 'published')
      .order('version', { ascending: false })
      .limit(1),
  ])
  if (itemRes.error) return { item: null, error: itemRes.error.message }
  if (!itemRes.data) return { item: null, error: null }

  const it = itemRes.data as { id: string; exam_id: string; no: number; points: number | null; answer: number | null; type_id: string | null }
  const [examRes, typeRes] = await Promise.all([
    db.from('csat_exams').select('label').eq('id', it.exam_id).maybeSingle(),
    it.type_id ? db.from('csat_types').select('name').eq('id', it.type_id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const a = ((aRes.data ?? [])[0] ?? null) as AnalysisRow | null
  const chs = a?.choice_analysis ?? []
  const correct = chs.find((c) => c.verdict === 'correct') ?? null

  return {
    item: {
      id: it.id,
      exam_label: (examRes.data as { label?: string } | null)?.label ?? it.exam_id,
      no: it.no,
      points: it.points,
      answer: it.answer,
      type_id: it.type_id,
      type_name: (typeRes.data as { name?: string } | null)?.name ?? null,
      answer_unknown: a?.answer_unknown === true,
      why_correct: correct?.why_correct ?? null,
      evidence_quote: a?.answer_locus?.quote ?? null,
      evidence_reasoning: a?.answer_locus?.reasoning ?? null,
      distractors: chs
        .filter((c) => c.verdict === 'distractor')
        .map((c) => ({
          n: c.n,
          trap: c.trap ?? null,
          why_tempting: c.why_tempting ?? null,
          how_to_reject: c.how_to_reject ?? null,
        }))
        .sort((x, y) => x.n - y.n),
      procedure: a?.solve_procedure ?? [],
      required_vocab: a?.required_vocab ?? [],
      time_budget_sec: a?.time_budget_sec ?? null,
    },
    error: null,
  }
}
