// apps/web/src/lib/knowledge/__tests__/authored-responses.ts
// T-0068 — 시험 어댑터: 형식별 유효 정답 · 유효 오답 응답을 Gold 에서 만든다(authored-formats.test.ts 의 형식별 정답/오답 모양 그대로).
// 제품 채점기(FORMAT_SPECS.grade)는 바꾸지 않는다 — gradedPair 가 그 채점기로 정답=맞음 · 오답=틀림(형식은 유효)을 확인한다.
// 오답은 「틀린 판단 + 맞는 이유」 쪽을 고른다(segment_choice 틀린 덩어리 + 맞는 이유 · option_correspondence 틀린 선택 + 맞는 판정 등).
import { PATTERNS as STRUCT_PATTERNS } from '@/lib/csat/inquiry/structure-check'
import { FORMAT_SPECS, MEANING_RELATIONS, PAIR_RELATIONS, type FormatId } from '@/lib/knowledge/authored/formats'

type Obj = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export function rightResponse(fmt: FormatId, gold: Obj): Obj {
  switch (fmt) {
    case 'central_meaning': return { claim: gold.claim, support: gold.support, relation: gold.relationProbe.relation, choice: gold.answer }
    case 'choice_evidence': return { choice: gold.answer, evidence: [gold.decisive] }
    case 'option_correspondence': return { choice: gold.answer, options: gold.options.map((o: Obj) => ({ verdict: o.verdict, sentence: o.sentence })) }
    case 'contextual_sense': return { choice: gold.answer, cue: [gold.cue[0]] }
    case 'sentence_relation': return { pairs: gold.pairs.map((p: Obj) => p.relation) }
    case 'form_scope': return { choice: gold.answer, reason: gold.reason }
    case 'discourse_roles': return { roles: gold.roles, pattern: gold.pattern }
    case 'demand_choice': return { choice: gold.answer }
    case 'segment_choice': return { choice: gold.answer, reason: gold.reason }
    case 'equivalence': return { same: gold.same, relation: gold.relation }
  }
}

export function wrongResponse(fmt: FormatId, body: Obj, gold: Obj): Obj {
  const right = rightResponse(fmt, gold)
  switch (fmt) {
    case 'sentence_relation': {
      const p0 = gold.pairs[0]
      return { pairs: [PAIR_RELATIONS.find((r) => r !== p0.relation && !(p0.alt ?? []).includes(r)), ...right.pairs.slice(1)] }
    }
    case 'discourse_roles': {
      const ok = new Set([gold.pattern, ...(gold.patternAlternatives ?? [])])
      return { roles: gold.roles, pattern: STRUCT_PATTERNS.find((p) => !ok.has(p)) }
    }
    case 'segment_choice': return { ...right, choice: (gold.answer + 1) % (body.segments as unknown[]).length }
    case 'equivalence': return { same: !gold.same, relation: MEANING_RELATIONS.find((r) => r !== gold.relation && (r === 'synonym' || r === 'paraphrase') === !gold.same) }
    default: return { ...right, choice: (gold.answer + 1) % 5 }
  }
}

/** 제품 채점기로 정답 · 오답 응답을 확인한다 — 어댑터가 채점 계약과 어긋나면 순환 시험이 엉뚱한 이유로 통과하지 않게 */
export function gradedPair(fmt: FormatId, body: Obj, gold: Obj) {
  const right = rightResponse(fmt, gold), wrong = wrongResponse(fmt, body, gold)
  const r = FORMAT_SPECS[fmt].grade(body, gold, right, 'v1'), w = FORMAT_SPECS[fmt].grade(body, gold, wrong, 'v1')
  return { right, wrong, rightOk: r?.grade.isCorrect === true, wrongValid: w !== null, wrongOk: w?.grade.isCorrect === true }
}
