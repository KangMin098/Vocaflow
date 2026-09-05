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
  detectAnalystMeta,
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
type DictFormRow = DictRow & { inflected_forms: string[] | null }

/** 사전 대조는 `in()`/`overlaps()` 가 URL 에 실리므로 잘라서 던진다 */
const DICT_CHUNK = 200

/** 낱말 하나가 사전에서 어떻게 찾혔나 */
interface DictHit {
  match: 'direct' | 'resolved'
  /** 표제어를 알 수 있으면 그것, 해소기만 통과했으면 null */
  headword: string | null
  cefr_level: string | null
  v_level: number | null
}

/**
 * 낱말이 사전에 있나 — **학습자 경로와 같은 잣대로** 판정한다.
 *
 * 분석이 적는 낱말은 지문에 나온 **그 꼴**이다(allowed · entries · submissions · diminishing).
 * 표제어(`word`)로만 대조하면 그것들이 전부 「사전에 없음」이 되고, 그 목록이 그대로 어휘
 * 드레인의 몫이 되어 **뜻이 이미 있는 낱말을 다시 만들게** 된다. 이 저장소는 같은 실수를
 * 세 번 했다 — 실측 2026-09-05:
 *
 *   · 표제어만 대조 → 미등재 **907**
 *   · `inflected_forms` 까지 → **474**
 *   · **`unresolved_dict_words` RPC(정본)** → **286** (구·숙어 194 · 낱말 92)
 *
 * 그 RPC 가 `resolve_dict_headword` 로 굴절·파생·철자 변이를 푸는 **학습자 경로의 잣대**다.
 * 여기서 잣대를 따로 만들면 콘솔이 말하는 빈칸과 학습자가 실제로 못 찾는 낱말이 갈린다.
 *
 * 다어절(구·숙어)은 대상 밖이 아니다 — 사전에 다어절 표제어가 5,547개 있다. 빈칸으로 센다.
 */
async function lookupDictionary(
  db: SupabaseClient,
  lemmas: string[],
): Promise<{ hits: Map<string, DictHit>; resolver: 'rpc' | 'fallback' }> {
  const found = new Map<string, DictHit>()

  // ① 표제어 직접 대조 — 여기서만 CEFR·V-Level 을 같이 얻는다(교재 어휘 상자가 쓴다)
  for (let i = 0; i < lemmas.length; i += DICT_CHUNK) {
    const chunk = lemmas.slice(i, i + DICT_CHUNK)
    const res = await db
      .from('shared_dictionary')
      .select('word, cefr_level, v_level')
      .in('word', chunk)
      .neq('archived', true)
    if (res.error) continue // 사전 메타는 부가 정보다 — 없으면 표시가 비지, 자료 전체가 멈추지 않는다
    for (const r of (res.data ?? []) as DictRow[]) {
      found.set(r.word, { match: 'direct', headword: r.word, cefr_level: r.cefr_level, v_level: r.v_level })
    }
  }

  const rest = lemmas.filter((l) => !found.has(l))
  if (!rest.length) return { hits: found, resolver: 'rpc' }

  // ② 남은 것은 **정본 해소기**에 묻는다. 한 번의 호출로 끝나므로 왕복도 줄어든다.
  const rpc = await db.rpc('unresolved_dict_words', { p_words: rest })
  if (!rpc.error) {
    // 이 RPC 는 못 푼 낱말들을 **한 행에 배열로** 돌려준다(행 수를 세면 언제나 1이다 — 실측으로 데었다)
    const raw = rpc.data as unknown
    const gap = new Set(
      (Array.isArray(raw) ? (raw.flat() as unknown[]) : []).map((x) => String(x).trim().toLowerCase()),
    )
    for (const l of rest) if (!gap.has(l)) found.set(l, { match: 'resolved', headword: null, cefr_level: null, v_level: null })
    return { hits: found, resolver: 'rpc' }
  }

  // ③ 해소기를 못 부르면 `inflected_forms` 로 물러선다 — **다만 조용히 물러서지 않는다.**
  //    이 경로는 빈칸을 실제보다 많게 센다(474 대 286). 화면이 그 사실을 말해야 관리자가
  //    부풀려진 목록을 드레인 몫으로 착각하지 않는다.
  for (let i = 0; i < rest.length; i += DICT_CHUNK) {
    const chunk = rest.slice(i, i + DICT_CHUNK)
    const want = new Set(chunk)
    const res = await db
      .from('shared_dictionary')
      .select('word, cefr_level, v_level, inflected_forms')
      .overlaps('inflected_forms', chunk)
      .neq('archived', true)
    if (res.error) continue
    for (const r of (res.data ?? []) as DictFormRow[]) {
      for (const rawForm of r.inflected_forms ?? []) {
        const f = String(rawForm).trim().toLowerCase()
        if (!want.has(f) || found.has(f)) continue
        found.set(f, { match: 'resolved', headword: r.word, cefr_level: r.cefr_level, v_level: r.v_level })
      }
    }
  }
  return { hits: found, resolver: 'fallback' }
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
  const { hits: dict, resolver } = await lookupDictionary(db, lemmas)

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
        match: (d?.match ?? 'none') as CsatGuideVocab['match'],
        headword: d?.headword ?? null,
        is_phrase: lemma.includes(' '),
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
        analyst_meta: detectAnalystMeta(rep?.answer_locus_pattern ?? null),
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
        typesLearnerReady: guideTypes.filter((t) => !t.analyst_meta.length).length,
        vocabLemmas: vocab.length,
        vocabDirect: vocab.filter((v) => v.match === 'direct').length,
        vocabResolved: vocab.filter((v) => v.match === 'resolved').length,
        vocabResolver: resolver,
        vocabGap: vocab.filter((v) => v.match === 'none').length,
        vocabGapPhrase: vocab.filter((v) => v.match === 'none' && v.is_phrase).length,
        vocabInDictionary: vocab.filter((v) => v.in_dictionary).length,
        timeBudgetSec: guideExams.reduce((s, e) => s + e.time_budget_sec, 0),
      },
    },
    error: null,
  }
}
