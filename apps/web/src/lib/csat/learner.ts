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
  failure_modes: string[]
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
        failure_modes: [],
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
      recurring_traps: arr<{ trap: string; count?: number; signature?: string }>(rep.recurring_traps),
      failure_modes: arr<string>(rep.failure_modes),
      time_budget_sec: rep.time_budget_sec,
    },
    error: null,
  }
}
