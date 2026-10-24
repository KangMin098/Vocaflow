// apps/web/src/lib/csat/binding/adapter.ts
// 기존 DB 행(csat_items · csat_item_units · csat_item_analyses)을 읽기 전용으로 받아 「결속된 문항」을 만든다.
//
// 현재 판본 규칙 — DB 함수와 같다:
//   · 단위: csat_current_units_many — 지금 원문 해시(input_hash)에 맞는 최고 units_version
//   · 분석: published 중 그 단위(units_version · units_hash)에 결속된 최고 version.
//     published 가 여러 판이어도(809문항) 결속이 맞지 않는 판은 근거로 쓰지 않는다.
// 이 함수는 DB 를 고치지 않고, 없는 근거를 만들지 않는다. 확인할 수 없는 것은 차단 이유로 남긴다.
import { answerCoverage, answerSetOf } from './answers'
import { detectDefects, glossesOf, glossMatches, hasMissingFootnote, marksOf } from './extraction'
import { markerAnchors, UNDERLINE_TYPES } from './markers'
import { choiceKeys, conditionAnchors, readValues, valueAnchors } from './values'
import type {
  AnswerCoverage,
  AnswerSet,
  BindingBasis,
  BlockReason,
  ChoiceAnchor,
  ConditionAnchor,
  EvidenceAnchor,
  ExtractionDefect,
  FootnoteAnchor,
  MarkerAnchor,
  SpanAnchor,
  UnitAnchor,
  ValueAnchor,
} from './types'
import type { JudgmentItem } from '../judgment/types'

export type ItemRow = {
  id: string
  exam_id: string
  no: number
  type_id: string | null
  stem: string | null
  passage: string | null
  choices: unknown
  answer: number | null
  answers: number[] | null
  body_ok: boolean
}
export type UnitRow = { n: number; id: string; start: number; end: number; text: string; kind: string }
export type UnitsRow = { units_version: number; units_hash: string; input_hash: string; units: UnitRow[] }
export type AnalysisRow = {
  version: number
  status: string
  units_version: number | null
  units_hash: string | null
  design_intent?: string | null
  measured_ability?: string | null
  answer_locus: { quote?: string; reasoning?: string; sentence_index?: number[] } | null
  choice_analysis: Array<{ n: number; verdict?: string; why_correct?: string; how_to_reject?: string; why_tempting?: string; trap?: string; confirmed_at?: { sentence_index?: number[]; note?: string } }> | null
  solve_procedure?: unknown
}

export type BindInput = {
  item: ItemRow
  /** csat_item_input_hash(item) */
  inputHash: string
  /** csat_current_units_many 결과(현재 원문 해시에 맞는 것만). 없으면 null */
  units: UnitsRow | null
  /** 그 문항의 published 분석 전부 */
  analyses: AnalysisRow[]
  /** 그 회차 공식 PDF 좌표 파일에 이 문항 번호가 있는가 */
  pdfAnchored: boolean
}

export type ChoiceBinding = { n: number; anchors: EvidenceAnchor[] }

export type BoundItem = {
  id: string
  examId: string
  no: number
  typeId: string | null
  answer: AnswerSet
  coverage: AnswerCoverage
  /** 근거로 쓰는 분석 판본(없으면 null) — 고른 이유는 analysisPick */
  analysisVersion: number | null
  analysisPick: 'bound' | 'unbound' | 'stale' | 'none'
  publishedVersions: number[]
  basis: BindingBasis
  defects: ExtractionDefect[]
  /** 정답 근거(answer_locus) */
  answerAnchors: EvidenceAnchor[]
  /** 선지별 근거 — 분석의 confirmed_at·[uN] + 유형 구조(표지·수치) */
  choices: ChoiceBinding[]
  /** 원문 구조에서 읽은 것 — 분석과 무관(analysisVersion null basis) */
  structure: { markers: MarkerAnchor[]; conditions: ConditionAnchor[]; footnotes: FootnoteAnchor[] }
  reasons: BlockReason[]
}

const REF = /\[u(\d+)\]/g
const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[―–—－]/g, '-').replace(/\s+/g, ' ').toLowerCase()

/** 인용을 원문에서 찾는다 — 정확 일치 우선, 다음은 따옴표·대시·공백 정규화 후 원래 오프셋으로 되돌린다 */
export function findQuote(passage: string, quote: string): { start: number; end: number } | null {
  const q = quote.trim()
  if (!q) return null
  const at = passage.indexOf(q)
  if (at >= 0 && passage.indexOf(q, at + 1) < 0) return { start: at, end: at + q.length }
  if (at >= 0) return null // 두 번 이상 나오면 어느 자리인지 확정할 수 없다
  // 정규화 매핑: 정규화 문자열의 각 글자가 원문의 어느 오프셋에서 왔는지
  const map: number[] = []
  let flat = ''
  for (let i = 0; i < passage.length; i += 1) {
    const ch = passage[i]
    if (/\s/.test(ch)) {
      if (flat.endsWith(' ')) continue
      flat += ' '
    } else flat += norm(ch)
    map.push(i)
  }
  const nq = norm(q).trim()
  const k = flat.indexOf(nq)
  if (k < 0 || flat.indexOf(nq, k + 1) >= 0) return null
  return { start: map[k], end: map[k + nq.length - 1] + 1 }
}

function unitAnchorsOf(ns: number[], units: UnitRow[], basis: BindingBasis, unknown: Set<number>): UnitAnchor[] {
  const out: UnitAnchor[] = []
  for (const n of [...new Set(ns)]) {
    const u = units.find((x) => x.n === n)
    if (!u) unknown.add(n)
    else out.push({ kind: 'unit', basis, precision: 'unit', unitId: u.id, n: u.n })
  }
  return out
}

const refsIn = (...texts: (string | null | undefined)[]) => texts.flatMap((t) => (t ? [...t.matchAll(REF)].map((m) => Number(m[1])) : []))

export function pickAnalysis(analyses: AnalysisRow[], units: UnitsRow | null): { row: AnalysisRow | null; pick: BoundItem['analysisPick'] } {
  const pub = analyses.filter((a) => a.status === 'published').sort((a, b) => b.version - a.version)
  if (!pub.length) return { row: null, pick: 'none' }
  const bound = units ? pub.find((a) => a.units_version === units.units_version && a.units_hash === units.units_hash) : undefined
  if (bound) return { row: bound, pick: 'bound' }
  return { row: null, pick: pub[0].units_hash == null ? 'unbound' : 'stale' }
}

export function bindItem(input: BindInput): BoundItem {
  const { item, units } = input
  const passage = item.passage ?? ''
  const choicesText = Array.isArray(item.choices) ? (item.choices as unknown[]).map((c) => String(c ?? '')) : []
  const typeId = item.type_id
  const reasons = new Set<BlockReason>()
  const answer = answerSetOf(item)
  const { row: an, pick } = pickAnalysis(input.analyses, units)
  const published = input.analyses.filter((a) => a.status === 'published').map((a) => a.version).sort((a, b) => a - b)

  const basis: BindingBasis = {
    itemId: item.id,
    inputHash: input.inputHash,
    unitsVersion: units?.units_version ?? null,
    unitsHash: units?.units_hash ?? null,
    analysisVersion: an?.version ?? null,
  }
  const structBasis: BindingBasis = { ...basis, analysisVersion: null }
  const unitList = units?.units ?? []

  if (!item.body_ok) reasons.add('body_not_ok')
  if (!typeId) reasons.add('no_type')
  if (!units) reasons.add('no_current_units')
  if (pick === 'none') reasons.add('no_published_analysis')
  if (pick === 'unbound') reasons.add('analysis_unbound')
  if (pick === 'stale') reasons.add('analysis_stale')
  if (answer.legacyMismatch) reasons.add('answer_legacy_mismatch')
  if (!input.pdfAnchored) reasons.add('no_pdf_anchor')

  const defects = detectDefects({ typeId, passage, choices: choicesText })
  if (defects.some((d) => d.code !== 'footnote_mark_without_gloss')) reasons.add('extraction_defect')
  if (hasMissingFootnote(defects)) reasons.add('footnote_missing')

  // ── 원문 구조(분석과 무관) ──
  const markers = markerAnchors(passage, structBasis, typeId)
  if (typeId && UNDERLINE_TYPES.has(typeId) && markers.length !== 5) reasons.add('marker_anchor_unavailable')
  const conditions = typeId === 'R-NOTICE' || typeId === 'R-FACT' || typeId === 'X-FACT' ? conditionAnchors(passage, structBasis) : []
  const glosses = [passage, ...choicesText].flatMap(glossesOf)
  const footnotes: FootnoteAnchor[] = marksOf(passage).map((m) => {
    // 별표 수만이 아니라 표지 낱말과 정의 용어가 맞아야 짝이다 — 무관한 정의를 빠진 각주에 붙이지 않는다(T-0154 F2)
    const g = glosses.find((x) => x.mark === m.mark && glossMatches(x.term, m.before))
    return { kind: 'footnote', basis: structBasis, precision: g ? 'exact' : 'unavailable', mark: m.mark, term: g?.term ?? m.word ?? null, gloss: g?.gloss ?? null, at: m.at }
  })

  // ── 분석 근거 ──
  const unknown = new Set<number>()
  const answerAnchors: EvidenceAnchor[] = []
  const choices: ChoiceBinding[] = choicesText.map((_, i) => ({ n: i + 1, anchors: [] as EvidenceAnchor[] }))
  // 결함 검출은 결속과 무관하게 최신 published 판으로 한다 — 결속이 없다고 복수 정답 누락·근거 없는 수치를 못 보면 안 된다.
  // 근거 앵커는 아래에서 결속된 판(an)으로만 만든다.
  // 근거로 쓰는 결속 판(an)과 최신 판 둘 다 검사한다 — 한쪽이 맞다고 다른 쪽의 누락을 덮지 않는다(T-0154 F1).
  const latest = [...input.analyses].filter((a) => a.status === 'published').sort((a, b) => b.version - a.version)[0] ?? null
  const checked = [...new Set([an, latest].filter((a): a is AnalysisRow => a != null))]
  const coverages = checked.map((a) => answerCoverage(answer, a.choice_analysis))
  // 화면이 보는 coverage 는 근거로 쓰는 판의 것. 결속 판이 없으면 최신 판
  const coverage: AnswerCoverage = coverages[0] ?? { status: 'no_analysis' }
  // 복수 정답은 「다 다뤘다(covered)」를 확인해야 통과 — 선지 분석이 비면(no_analysis) 확인 못 한 것이다(T-0154 G1)
  const partial = coverages.some((c) => c.status !== 'covered')
  if (typeId === 'R-CHART') {
    for (const a of checked) {
      const loc = a.answer_locus ?? {}
      const claims = [loc.reasoning, ...(a.choice_analysis ?? []).flatMap((c) => [c.why_correct, c.how_to_reject])].filter(Boolean).join(' \n ')
      if (valueAnchors(claims, passage, structBasis).some((v) => v.imageOnly)) reasons.add('chart_value_unverified')
    }
  }

  if (an) {
    const loc = an.answer_locus ?? {}
    answerAnchors.push(...unitAnchorsOf([...(loc.sentence_index ?? []), ...refsIn(loc.reasoning)], unitList, basis, unknown))
    if (loc.quote) {
      const hit = findQuote(passage, loc.quote.replace(/[①②③④⑤]\s*/g, ''))
        ?? findQuote(passage, loc.quote)
      if (hit) answerAnchors.push({ kind: 'span', basis, precision: 'exact', start: hit.start, end: hit.end, quote: passage.slice(hit.start, hit.end) } satisfies SpanAnchor)
      else reasons.add('analysis_quote_not_in_source')
    }
    for (const c of an.choice_analysis ?? []) {
      const slot = choices.find((x) => x.n === c.n)
      if (!slot) continue
      slot.anchors.push(...unitAnchorsOf([...(c.confirmed_at?.sentence_index ?? []), ...refsIn(c.why_correct, c.how_to_reject, c.why_tempting)], unitList, basis, unknown))
    }
    if (unknown.size) reasons.add('analysis_ref_unknown_unit')

    // 도표: 분석이 단정한 값 중 원문 글자에 있는 것만 근거로 — 그림에만 있는 값은 위에서 차단 이유로 남겼다
    if (typeId === 'R-CHART') {
      const claims = [loc.reasoning, ...(an.choice_analysis ?? []).flatMap((c) => [c.why_correct, c.how_to_reject])].filter(Boolean).join(' \n ')
      answerAnchors.push(...valueAnchors(claims, passage, basis).filter((v) => !v.imageOnly))
    }
  }
  if (answer.multiple && partial) reasons.add('multi_answer_partial_analysis')

  // ── 유형 구조를 선지에 붙인다 ──
  for (const slot of choices) {
    slot.anchors.unshift({ kind: 'choice', basis: structBasis, precision: 'exact', choice: slot.n } satisfies ChoiceAnchor)
    const mk = markers.find((m) => m.choice === slot.n)
    if (mk) slot.anchors.push(mk)
    if (typeId === 'R-CHART') {
      // 도표 선지 문장 속 수치는 지문 글자에 있다(선지가 지문 안에 있다) — 값 자체는 그림과 대조해야 하므로 span 만
      const at = mk ? mk.at : -1
      if (at >= 0) {
        const next = markers.find((m) => m.choice === slot.n + 1)?.at ?? passage.length
        for (const v of readValues(passage.slice(at, next))) {
          slot.anchors.push({ kind: 'value', basis: structBasis, precision: 'exact', value: v.value, unit: v.unit, raw: v.raw, span: { start: at + v.start, end: at + v.end }, imageOnly: false } satisfies ValueAnchor)
        }
      }
    }
    if (conditions.length && typeId === 'R-NOTICE') {
      // 한국어 선지 ↔ 영어 안내문: 같은 수치가 있는 단위를 후보로 — 근거로 단정하지 않는다(candidate)
      const keys = choiceKeys(choicesText[slot.n - 1])
      const srcVals = readValues(passage)
      const ns = new Set<number>()
      for (const v of keys.values) for (const s of srcVals) if (Math.abs(s.value - v.value) < 1e-9 && v.unit !== 'count') {
        const u = unitList.find((x) => s.start >= x.start && s.start < x.end)
        if (u) ns.add(u.n)
      }
      for (const n of ns) {
        const u = unitList.find((x) => x.n === n)!
        slot.anchors.push({ kind: 'unit', basis: structBasis, precision: 'candidate', unitId: u.id, n })
      }
    }
  }

  return {
    id: item.id,
    examId: item.exam_id,
    no: item.no,
    typeId,
    answer,
    coverage,
    analysisVersion: an?.version ?? null,
    analysisPick: pick,
    publishedVersions: published,
    basis,
    defects,
    answerAnchors,
    choices,
    structure: { markers, conditions, footnotes },
    reasons: [...reasons],
  }
}

/** D 판단 도구가 다루는 유형 — D 의 RevealData 는 정답을 숫자 하나로만 받는다 */
export const D_TOOL_TYPES = new Set(['R-IRRELEVANT', 'R-ORDER', 'R-NOTICE', 'R-FACT', 'R-GRAMMAR', 'R-SUMMARY', 'R-MOOD'])

/**
 * D 도구의 공개 전 계약(JudgmentItem)으로 옮긴다. 차단 이유가 block 이면 null —
 * 판본이 맞지 않거나 근거가 비면 도구에 넘기지 않는다. 복수 정답은 D 계약이 표현하지 못하므로 넘기지 않는다.
 */
export function toJudgmentItem(b: BoundItem, row: ItemRow, units: UnitsRow | null, blocking: (r: BlockReason) => boolean): { item: JudgmentItem | null; reasons: BlockReason[] } {
  const reasons = [...b.reasons]
  if (b.typeId && D_TOOL_TYPES.has(b.typeId) && b.answer.multiple) reasons.push('multi_answer_unsupported_by_tool')
  const blocked = reasons.filter(blocking)
  if (blocked.length || !units || b.analysisVersion == null || !b.basis.unitsHash || b.basis.unitsVersion == null) return { item: null, reasons: blocked.length ? blocked : reasons }
  return {
    item: {
      id: row.id,
      examId: row.exam_id,
      no: row.no,
      typeId: row.type_id ?? '',
      stem: row.stem ?? '',
      choices: (row.choices as unknown[]).map(String),
      units: units.units.map((u) => ({ id: u.id, n: u.n, kind: u.kind, text: u.text })),
      version: { unitsVersion: b.basis.unitsVersion, unitsHash: b.basis.unitsHash, analysisVersion: b.analysisVersion },
    },
    reasons: [],
  }
}
