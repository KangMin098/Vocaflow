// scripts/csat/lib-analysis-rules.mjs
// Confirmed, narrow content defects; this is not a general semantic validator.

/** Return procedure instructions that exclude a referent just because it is named. */
export function namedReferentExclusions(procedure) {
  const hits = []
  const visit = (value) => {
    if (typeof value === 'string') {
      // Keep each clause separate: an unrelated warning must not excuse a bad rule.
      for (const clause of value.split(/[\n。.!?]+/)) {
        if (!/문장/.test(clause) || !/이름|호칭/.test(clause) || !/따로|별도/.test(clause)) continue
        if (/(?:지우|배제하|제외하)지\s*(?:말|않)|아니라고\s*(?:단정|판단)하지/.test(clause)) continue
        if (/밑줄은\s*그\s*(?:사람|인물|대상)(?:이|은)?\s*아니|따로\s*불린\s*(?:사람|인물)은\s*그\s*밑줄이\s*아니/.test(clause)) hits.push(clause.trim())
      }
    } else if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
  }
  visit(procedure)
  return [...new Set(hits)]
}

export function analysisRuleErrors(analysis) {
  const errors = namedReferentExclusions(analysis.solve_procedure).map((text) =>
    `V10 이름·호칭의 별도 등장만으로 지칭 후보를 제외한다 — 행위·소유·발화 관계로 대조해야 한다: ${text}`)
  // Actual repeated repair metadata, confined to the learner-facing design field.
  // Original-PDF instructions and generic mentions of underline scope remain valid.
  if (/실제 밑줄은[^.!?\n]*이며 수리된 범위를 대상으로 검증한다(?:\.|$)/.test(analysis.design_intent ?? '')) {
    errors.push('V11 학습자용 출제 의도에 원문 수리·검수 메모가 남아 있다 — 출제 설계로 작성하고 내부 기록은 별도로 보존해야 한다')
  }
  return errors
}
