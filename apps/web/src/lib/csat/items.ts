// apps/web/src/lib/csat/items.ts
//
// 문항 단위 분석 적재기 — 콘솔의 「문항 분석」 탭이 읽는다.
//
// 이 화면이 답하는 질문: **"802문항이 다 통과했다는데, 어느 문항의 서술이 실제로 비어 있나."**
// 회차·유형 집계로는 안 보인다 — 한 문항의 오답 배제가 둘만 적혀 있어도 그 회차의 「덮은 배점」은
// 가득 찬 것으로 나온다.
//
// ⚠️ RLS 를 우회한다. **`requireAdmin*` 게이트 뒤에서만** 쓴다. 조회 컬럼에
//    `csat_items.passage` 는 없다 — 분석과 그 안의 짧은 인용까지만 읽는다.

import 'server-only'

import { createCsatClient, selectAllPages } from './client'
import { auditAnalysis, summarizeAudit, type CsatItemAudit, type RawAnalysis } from './items-fold'

export type { CsatItemAudit } from './items-fold'

export interface CsatItemAuditPage {
  rows: CsatItemAudit[]
  summary: ReturnType<typeof summarizeAudit>
}

type ItemRow = {
  id: string
  exam_id: string
  no: number
  type_id: string | null
  points: number | null
  answer: number | null
}

/** 문항 감사 한 벌 — 802행이라 화면이 한 번에 받아 접는다(서버 count 로는 못 내는 판정이다) */
export async function loadCsatItemAudit(): Promise<{ page: CsatItemAuditPage | null; error: string | null }> {
  const db = createCsatClient()

  const [examsRes, typesRes, itemsPaged, analysesPaged] = await Promise.all([
    db.from('csat_exams').select('id, label'),
    db.from('csat_types').select('id, name'),
    selectAllPages<ItemRow>((from, to) =>
      db.from('csat_items').select('id, exam_id, no, type_id, points, answer').eq('in_scope', true).range(from, to),
    ),
    selectAllPages<RawAnalysis>((from, to) =>
      db
        .from('csat_item_analyses')
        .select(
          'item_id, version, answer_unknown, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure, required_vocab, time_budget_sec, difficulty',
        )
        .eq('status', 'published')
        .range(from, to),
    ),
  ])

  const error =
    examsRes.error?.message ?? typesRes.error?.message ?? itemsPaged.error ?? analysesPaged.error ?? null
  if (error) return { page: null, error }

  const examLabel = new Map(((examsRes.data ?? []) as { id: string; label: string }[]).map((e) => [e.id, e.label]))
  const typeName = new Map(((typesRes.data ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]))

  // 문항마다 최신 버전만 — 분석은 버전을 올려 쌓이므로 옛 판을 감사하면 이미 고친 것을 다시 세운다
  const latest = new Map<string, RawAnalysis>()
  for (const a of analysesPaged.rows) {
    const cur = latest.get(a.item_id)
    if (!cur || a.version > cur.version) latest.set(a.item_id, a)
  }

  const rows = itemsPaged.rows
    .map((it) =>
      auditAnalysis(
        {
          item_id: it.id,
          exam_id: it.exam_id,
          exam_label: examLabel.get(it.exam_id) ?? it.exam_id,
          no: it.no,
          type_id: it.type_id,
          type_name: it.type_id ? (typeName.get(it.type_id) ?? it.type_id) : null,
          points: it.points,
          answer: it.answer,
        },
        latest.get(it.id) ?? null,
      ),
    )
    // 빈 항목이 많은 문항이 위로 — 다음에 손볼 것을 여기서 고른다
    .sort((a, b) => b.gaps.length - a.gaps.length || a.exam_id.localeCompare(b.exam_id) || a.no - b.no)

  return { page: { rows, summary: summarizeAudit(rows) }, error: null }
}

export interface CsatItemFull {
  item_id: string
  exam_label: string
  no: number
  type_name: string | null
  points: number | null
  answer: number | null
  answer_unknown: boolean
  measured_ability: string | null
  design_intent: string | null
  quote: string | null
  reasoning: string | null
  choices: { n: number; verdict: string | null; trap: string | null; text: string | null }[]
  procedure: { step: string; on_fail?: string }[]
  required_vocab: string[]
  time_budget_sec: number | null
  predicted: number | null
  drivers: string[]
}

/** 한 문항의 분석 전문 — 목록에서 한 줄을 열 때만 부른다 */
export async function loadCsatItemFull(itemId: string): Promise<{ item: CsatItemFull | null; error: string | null }> {
  const db = createCsatClient()

  const [itemRes, analysisRes] = await Promise.all([
    db.from('csat_items').select('id, exam_id, no, type_id, points, answer').eq('id', itemId).maybeSingle(),
    db
      .from('csat_item_analyses')
      .select(
        'item_id, version, answer_unknown, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure, required_vocab, time_budget_sec, difficulty',
      )
      .eq('item_id', itemId)
      .eq('status', 'published')
      .order('version', { ascending: false })
      .limit(1),
  ])

  if (itemRes.error) return { item: null, error: itemRes.error.message }
  if (analysisRes.error) return { item: null, error: analysisRes.error.message }
  const it = itemRes.data as ItemRow | null
  if (!it) return { item: null, error: `문항이 없다: ${itemId}` }

  const a = ((analysisRes.data ?? []) as RawAnalysis[])[0] ?? null

  const [examRes, typeRes] = await Promise.all([
    db.from('csat_exams').select('label').eq('id', it.exam_id).maybeSingle(),
    it.type_id
      ? db.from('csat_types').select('name').eq('id', it.type_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  return {
    item: {
      item_id: it.id,
      exam_label: (examRes.data as { label: string } | null)?.label ?? it.exam_id,
      no: it.no,
      type_name: (typeRes.data as { name: string } | null)?.name ?? it.type_id,
      points: it.points,
      answer: it.answer,
      answer_unknown: Boolean(a?.answer_unknown),
      measured_ability: a?.measured_ability ?? null,
      design_intent: a?.design_intent ?? null,
      quote: a?.answer_locus?.quote ?? null,
      reasoning: a?.answer_locus?.reasoning ?? null,
      // 선지마다 우리가 쓴 서술만 — 평가원 선지 원문은 싣지 않는다
      choices: (a?.choice_analysis ?? []).map((c) => ({
        n: c.n,
        verdict: c.verdict ?? null,
        trap: c.trap ?? null,
        text: (c.why_correct ?? c.how_to_reject ?? c.why_tempting ?? null) || null,
      })),
      procedure: a?.solve_procedure ?? [],
      required_vocab: a?.required_vocab ?? [],
      time_budget_sec: a?.time_budget_sec ?? null,
      predicted: typeof a?.difficulty?.predicted === 'number' ? a.difficulty.predicted : null,
      drivers: a?.difficulty?.drivers ?? [],
    },
    error: null,
  }
}
