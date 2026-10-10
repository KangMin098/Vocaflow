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

/**
 * 학습자에게 보이는 칸(재는 능력 · 출제 의도 · 정답 근거 · 선지 설명 · 함정 라벨)의 문자열들.
 * confirmed_at 같은 내부 기록 칸은 넣지 않는다 — 거기에는 작업 메모가 있어도 된다.
 */
export function learnerTexts(analysis) {
  const out = [analysis.measured_ability, analysis.design_intent, analysis.answer_locus?.reasoning]
  for (const ch of analysis.choices ?? analysis.choice_analysis ?? []) out.push(ch.why_correct, ch.why_tempting, ch.how_to_reject, ch.trap)
  return out.filter((x) => typeof x === 'string' && x.trim())
}

// 2026-10-11 평가원 802 의미 검수(scripts/csat/design-learning-audit) 실측: 학습자 칸에 「코퍼스 지문에도 columns2/2014A.txt」 ·
// 「인쇄 잔여가 선지를 미덥지 않게 만든다」 · 「이 청크에서 유일하게」 같은 작업 용어가 노출된 문항이 수십 개였다.
export const WORK_JARGON = /코퍼스|추출본|파싱|\bOCR\b|청크|보강 전|인쇄 잔여|원문 창|두 단(?:이)? 섞|columns\d*\/|\.txt\b|raw_block/

/** 막대 값이 그림에만 있는 도표에서 정답표로 정답을 정하는 서술 — 학습자가 배울 것은 도표 대조다(교수 계약 visual). */
export const ANSWER_KEY_INFERENCE = /정답표(?:가|는|로|에서)?[^.。\n]{0,30}(?:확정|불일치로|정하|역산)/

export function analysisRuleErrors(analysis, { typeId = null } = {}) {
  const errors = namedReferentExclusions(analysis.solve_procedure).map((text) =>
    `V10 이름·호칭의 별도 등장만으로 지칭 후보를 제외한다 — 행위·소유·발화 관계로 대조해야 한다: ${text}`)
  // Actual repeated repair metadata, confined to the learner-facing design field.
  // Original-PDF instructions and generic mentions of underline scope remain valid.
  if (/실제 밑줄은[^.!?\n]*이며 수리된 범위를 대상으로 검증한다(?:\.|$)/.test(analysis.design_intent ?? '')) {
    errors.push('V11 학습자용 출제 의도에 원문 수리·검수 메모가 남아 있다 — 출제 설계로 작성하고 내부 기록은 별도로 보존해야 한다')
  }
  for (const t of learnerTexts(analysis)) {
    const m = t.match(WORK_JARGON)
    if (m) { errors.push(`V12 학습자 칸에 작업 용어 「${m[0]}」 — 원문 사정 · 파일 · 작업 단위는 학습 내용이 아니다(내부 기록은 confirmed_at 에)`); break }
  }
  if ((typeId ?? analysis.type_id) === 'R-CHART') {
    const hit = learnerTexts(analysis).find((t) => ANSWER_KEY_INFERENCE.test(t))
    if (hit) errors.push('V13 도표 문항이 정답표로 정답을 정한다 — 원본 도표 값을 확인했으면 값으로, 못 했으면 대조 방법만 쓴다')
  }
  return errors
}
