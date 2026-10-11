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
/**
 * 정답 아닌 선지의 **내용이 맞는** 유형 — 교수 계약(apps/web/src/lib/csat/teaching-contract.ts) choiceTruth 와 같아야 한다
 * (동기화 회귀: apps/web/src/lib/csat/__tests__/teaching-contract.test.ts). 이 유형의 오답 선지는 함정이 아니다:
 * trap · why_tempting 을 쓰지 않고, how_to_reject 에 「지문의 어디와 대응해 맞는가 · 왜 발문의 답이 아닌가」를 쓴다.
 * 2026-10-11 측정: 이 유형 1,154문항 전부가 참인 선지에 함정 라벨을 달고 있었다(스키마가 trap 을 요구한 탓).
 */
export const CHOICE_TRUTH_TYPES = new Set(['R-GRAMMAR', 'R-VOCAB', 'X-VOCAB', 'R-NOTICE', 'R-FACT', 'X-FACT', 'R-CHART'])

/**
 * 발문이 **긍정형**인가 — 「일치하는 것은?」 · 「(A)(B)(C) … 가장 적절한 것은?」.
 * 2026-10-11 실측: 위 유형 중 안내문 113(평가원 28 · 학평 85) · 네모 어휘 23(6 · 17)이 긍정형이다. 이 문항은 정답이
 * 맞는 진술이고 **오답이 틀린 진술**이라 오답의 함정 서술이 정당하다(2014A#29 강의 심사에서 드러났다).
 * 부정형 판정은 띄어쓰기를 지우고 본다 — 원문 추출에 「일치하 지 않는」 · 「일 치하지」 꼴이 섞여 있다.
 */
export function stemPositive(stem) {
  const s = String(stem ?? '').replace(/\s+/g, '')
  if (!s) return false
  if (/않는|않은|틀린/.test(s)) return false
  return /일치하는|적절한것|맞는|옳은/.test(s)
}

/** 정답 아닌 선지가 **내용이 맞는** 진술인가 — 유형이 choiceTruth 이고 발문이 부정형일 때만(V14 · 화면 「내용은 맞음」) */
export function distractorsAreTrue(typeId, stem) {
  return CHOICE_TRUTH_TYPES.has(typeId) && !stemPositive(stem)
}

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
