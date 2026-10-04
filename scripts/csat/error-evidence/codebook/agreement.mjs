// scripts/csat/error-evidence/codebook/agreement.mjs
//
// 두 판정자 일치 지표 — 관찰 일치(po) · Cohen κ · Gwet AC1.
// κ 는 범주 비율이 한쪽으로 쏠리면(prevalence) 관찰 일치가 높아도 낮게 나온다 — 그래서 AC1 과 함께 본다.

/**
 * @param {Array<[unknown, unknown]>} pairs 사례마다 [판정자 A 값, 판정자 B 값]
 * @param {unknown[]} cats 범주 전체(AC1 의 Q — 이 척도가 허용하는 범주 수. 관찰된 범주만이 아니다)
 */
export function agreement(pairs, cats) {
  const n = pairs.length
  if (n === 0) return { n: 0, po: null, kappa: null, ac1: null }
  const po = pairs.filter(([x, y]) => x === y).length / n
  const pA = (c) => pairs.filter(([x]) => x === c).length / n
  const pB = (c) => pairs.filter(([, y]) => y === c).length / n
  const pe = cats.reduce((s, c) => s + pA(c) * pB(c), 0)
  const kappa = pe === 1 ? null : (po - pe) / (1 - pe)
  const q = cats.length
  const peAc1 = q < 2 ? 1 : cats.reduce((s, c) => { const pi = (pA(c) + pB(c)) / 2; return s + pi * (1 - pi) }, 0) / (q - 1)
  const ac1 = peAc1 === 1 ? null : (po - peAc1) / (1 - peAc1)
  return { n, po, kappa, ac1 }
}

export const OUTCOMES = ['identified', 'multiple_plausible', 'insufficient_evidence', 'inconsistent_evidence', 'no_fitting_code', 'unsupported_stimulus']
export const FAMILIES = ['V', 'S', 'R', 'E', 'B', 'X']
export const CODES = ['V.unknown_word', 'V.wrong_sense', 'V.multiword', 'S.core_structure', 'S.attachment', 'S.operator_scope', 'S.form_rule',
  'R.reference', 'R.relation', 'R.main_point', 'R.inference', 'E.task_misread', 'E.evidence_location', 'E.option_mismatch',
  'B.outside_knowledge', 'B.surface_match', 'B.no_verification', 'X.time', 'X.attention']
// primary 로 쓸 수 있는 코드 — B.no_verification 은 contributing 전용(코드북 R11)이라 primary 범주가 아니다
export const PRIMARY_CODES = CODES.filter((c) => c !== 'B.no_verification')
