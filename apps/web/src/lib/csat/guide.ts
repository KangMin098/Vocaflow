// apps/web/src/lib/csat/guide.ts
//
// 기출 분석 → **학습 가이드 원천 자료** 적재기.
//
// 이 파일이 답하는 질문: **"분석 802문항으로 교재와 학습 가이드를 쓰려면 무엇이 필요한가."**
// 콘솔이 세던 것(몇 문항 됐나)과 다른 물건이다 — 저쪽은 진행률, 이쪽은 **산출물**이다.
//
// ⚠️ RLS 를 우회한다(`createCsatClient`). **반드시 `requireAdmin*` 게이트 뒤에서만** 쓴다.
//    다만 여기서 읽는 컬럼에 `csat_items.passage` 는 없다 — 교재 원천으로 나가는 자료에
//    평가원 원문이 섞이지 않는 것을 조회 단계에서 보장한다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createCsatClient, selectAllPages } from './client'
import {
  foldTrapFamilies,
  type CsatGuideExam,
  type CsatGuideSource,
  type CsatGuideType,
  type CsatGuideVocab,
  type GuideProcedureStep,
  type RawTrap,
} from './guide-fold'

export type {
  CsatGuideExam,
  CsatGuideSource,
  CsatGuideType,
  CsatGuideVocab,
} from './guide-fold'

function yearOf(examId: string): number {
  if (examId.startsWith('M')) return 2000 + Number(examId.slice(1, 3))
  return Number(examId.slice(0, 4))
}

/** 최근 4개년 기준 — 학습자 화면(`learner.ts`)과 같은 값을 쓴다. 갈라지면 같은 유형이 두 비중을 갖는다 */
const RECENT_FROM = 2023

/** 유형 카드에 싣는 낱말 수 — 교재 한 꼭지의 어휘 상자에 들어갈 만큼만 */
const VOCAB_PER_TYPE = 40

type TypeRow = { id: string; name: string; section: string; status: string }
type ItemRow = { id: string; type_id: string | null; exam_id: string; points: number | null }
type ExamRow = { id: string; label: string; kind: string; year: number }
type ReportRow = {
  type_id: string
  n_analyzed: number
  recurring_traps: RawTrap[] | null
  answer_locus_pattern: string | null
  procedure_steps: GuideProcedureStep[] | null
  failure_modes: string[] | null
  time_budget_sec: number | null
  status: string
}
type AnalysisRow = {
  item_id: string
  version: number
  required_vocab: string[] | null
  difficulty: { predicted?: number } | null
  time_budget_sec: number | null
}
type DictRow = { word: string; cefr_level: string | null; v_level: number | null }

/** 낱말 뜻 조회는 `in()` 이 URL 에 실리므로 잘라서 던진다 */
const DICT_CHUNK = 200

async function lookupDictionary(db: SupabaseClient, lemmas: string[]): Promise<Map<string, DictRow>> {
  const found = new Map<string, DictRow>()
  for (let i = 0; i < lemmas.length; i += DICT_CHUNK) {
    const chunk = lemmas.slice(i, i + DICT_CHUNK)
    const res = await db
      .from('shared_dictionary')
      .select('word, cefr_level, v_level')
      .in('word', chunk)
      .neq('archived', true)
    if (res.error) continue // 사전은 부가 정보다 — 없으면 「미등재」로 보이지, 자료 전체가 멈추지 않는다
    for (const r of (res.data ?? []) as DictRow[]) found.set(r.word, r)
  }
  return found
}

/**
 * 가이드 원천 자료 한 벌.
 *
 * 콘솔이 매 요청 이것을 만들지 않는다 — 탭을 열 때 `/api/admin/csat/guide` 로 받는다.
 * 사전 조회만 15회쯤 나가므로 첫 화면 응답에 얹으면 콘솔이 그만큼 느려진다.
 */
export async function loadCsatGuideSource(): Promise<{ source: CsatGuideSource | null; error: string | null }> {
  const db = createCsatClient()

  const [typesRes, examsRes, reportsRes, itemsPaged, analysesPaged] = await Promise.all([
    db.from('csat_types').select('id, name, section, status').eq('in_scope', true),
    db.from('csat_exams').select('id, label, kind, year'),
    db
      .from('csat_type_reports')
      .select(
        'type_id, n_analyzed, recurring_traps, answer_locus_pattern, procedure_steps, failure_modes, time_budget_sec, status',
      )
      .eq('status', 'published'),
    selectAllPages<ItemRow>((from, to) =>
      db.from('csat_items').select('id, type_id, exam_id, points').eq('in_scope', true).range(from, to),
    ),
    selectAllPages<AnalysisRow>((from, to) =>
      db
        .from('csat_item_analyses')
        .select('item_id, version, required_vocab, difficulty, time_budget_sec')
        .eq('status', 'published')
        .range(from, to),
    ),
  ])

  const firstError =
    typesRes.error?.message ??
    examsRes.error?.message ??
    reportsRes.error?.message ??
    itemsPaged.error ??
    analysesPaged.error ??
    null
  if (firstError) return { source: null, error: firstError }

  const items = itemsPaged.rows
  const exams = (examsRes.data ?? []) as ExamRow[]
  const types = (typesRes.data ?? []) as TypeRow[]
  const reports = (reportsRes.data ?? []) as ReportRow[]

  // 문항마다 **최신 버전**만 남긴다 — 분석은 덮지 않고 버전을 올려 쌓이므로,
  // 그냥 세면 한 문항이 세 번 세어져 어휘 빈도와 시간 합이 부풀어 오른다.
  const latest = new Map<string, AnalysisRow>()
  for (const a of analysesPaged.rows) {
    const cur = latest.get(a.item_id)
    if (!cur || a.version > cur.version) latest.set(a.item_id, a)
  }

  const itemById = new Map(items.map((i) => [i.id, i]))
  const typeName = new Map(types.map((t) => [t.id, t.name]))

  // ── 어휘 원천 ────────────────────────────────────────────────────────
  interface VocabAcc {
    items: Set<string>
    types: Map<string, number>
    latestYear: number
  }
  const vocabAcc = new Map<string, VocabAcc>()
  const vocabByType = new Map<string, Map<string, number>>()

  for (const [itemId, a] of latest) {
    const item = itemById.get(itemId)
    if (!item) continue // 사정권 밖(듣기)이거나 코퍼스에서 사라진 문항
    const year = yearOf(item.exam_id)
    for (const raw of a.required_vocab ?? []) {
      const lemma = String(raw).trim().toLowerCase()
      if (!lemma) continue
      const acc = vocabAcc.get(lemma) ?? { items: new Set<string>(), types: new Map<string, number>(), latestYear: 0 }
      acc.items.add(itemId)
      if (item.type_id) acc.types.set(item.type_id, (acc.types.get(item.type_id) ?? 0) + 1)
      if (year > acc.latestYear) acc.latestYear = year
      vocabAcc.set(lemma, acc)

      if (item.type_id) {
        const m = vocabByType.get(item.type_id) ?? new Map<string, number>()
        m.set(lemma, (m.get(lemma) ?? 0) + 1)
        vocabByType.set(item.type_id, m)
      }
    }
  }

  const lemmas = [...vocabAcc.keys()].sort()
  const dict = await lookupDictionary(db, lemmas)

  const vocab: CsatGuideVocab[] = lemmas
    .map((lemma) => {
      const acc = vocabAcc.get(lemma) as VocabAcc
      const d = dict.get(lemma)
      return {
        lemma,
        items: acc.items.size,
        types: [...acc.types.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => typeName.get(id) ?? id),
        latest_year: acc.latestYear || null,
        in_dictionary: Boolean(d),
        cefr_level: d?.cefr_level ?? null,
        v_level: d?.v_level ?? null,
      }
    })
    .sort((a, b) => b.items - a.items || a.lemma.localeCompare(b.lemma))

  // ── 유형별 가이드 ────────────────────────────────────────────────────
  const perType = new Map<string, { items: number; recent: number; predicted: number[] }>()
  for (const it of items) {
    if (!it.type_id) continue
    const e = perType.get(it.type_id) ?? { items: 0, recent: 0, predicted: [] }
    e.items += 1
    if (yearOf(it.exam_id) >= RECENT_FROM) e.recent += 1
    const p = latest.get(it.id)?.difficulty?.predicted
    if (typeof p === 'number' && Number.isFinite(p)) e.predicted.push(p)
    perType.set(it.type_id, e)
  }

  const reportOf = new Map(reports.map((r) => [r.type_id, r]))
  const avg = (xs: number[]): number | null =>
    xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 1000) / 1000 : null

  const guideTypes: CsatGuideType[] = types
    .map((t) => {
      const agg = perType.get(t.id) ?? { items: 0, recent: 0, predicted: [] }
      const rep = reportOf.get(t.id)
      const rawTraps = (rep?.recurring_traps ?? []) as RawTrap[]
      const tv = vocabByType.get(t.id) ?? new Map<string, number>()
      return {
        type_id: t.id,
        name: t.name,
        section: t.section,
        status: t.status === 'retired' ? ('retired' as const) : ('active' as const),
        items: agg.items,
        recent: agg.recent,
        n_analyzed: rep?.n_analyzed ?? 0,
        time_budget_sec: rep?.time_budget_sec ?? null,
        answer_locus_pattern: rep?.answer_locus_pattern ?? null,
        procedure: (rep?.procedure_steps ?? []) as GuideProcedureStep[],
        traps_raw: rawTraps.length,
        trap_families: foldTrapFamilies(rawTraps),
        failure_modes: (rep?.failure_modes ?? []) as string[],
        predicted_avg: avg(agg.predicted),
        vocab: [...tv.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, VOCAB_PER_TYPE)
          .map(([lemma, n]) => ({ lemma, items: n })),
      }
    })
    .sort((a, b) => b.recent - a.recent || b.items - a.items)

  // ── 회차별 구성 ──────────────────────────────────────────────────────
  const examAcc = new Map<string, { items: number; points: number; time: number; predicted: number[] }>()
  for (const it of items) {
    const e = examAcc.get(it.exam_id) ?? { items: 0, points: 0, time: 0, predicted: [] }
    e.items += 1
    e.points += it.points ?? 0
    const a = latest.get(it.id)
    if (a?.time_budget_sec) e.time += a.time_budget_sec
    const p = a?.difficulty?.predicted
    if (typeof p === 'number' && Number.isFinite(p)) e.predicted.push(p)
    examAcc.set(it.exam_id, e)
  }

  const guideExams: CsatGuideExam[] = exams
    .map((ex) => {
      const e = examAcc.get(ex.id) ?? { items: 0, points: 0, time: 0, predicted: [] }
      return {
        exam_id: ex.id,
        label: ex.label,
        kind: ex.kind,
        year: ex.year,
        items: e.items,
        points: e.points,
        time_budget_sec: e.time,
        predicted_avg: avg(e.predicted),
      }
    })
    .sort((a, b) => b.year - a.year || a.label.localeCompare(b.label))

  const trapLabels = guideTypes.reduce((s, t) => s + t.traps_raw, 0)
  const trapFamilies = guideTypes.reduce((s, t) => s + t.trap_families.length, 0)

  return {
    source: {
      generated_at: new Date().toISOString().slice(0, 19).replace('T', ' ') + 'Z',
      types: guideTypes,
      vocab,
      exams: guideExams,
      totals: {
        types: guideTypes.length,
        items: items.length,
        analyzed: latest.size,
        trapLabels,
        trapFamilies,
        vocabLemmas: vocab.length,
        vocabInDictionary: vocab.filter((v) => v.in_dictionary).length,
        timeBudgetSec: guideExams.reduce((s, e) => s + e.time_budget_sec, 0),
      },
    },
    error: null,
  }
}
