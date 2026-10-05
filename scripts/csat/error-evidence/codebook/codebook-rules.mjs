// scripts/csat/error-evidence/codebook/codebook-rules.mjs
//
// 판정 출력의 규칙 식별자(decision_rule_used 등)를 **코드북 본문에서 읽은 규칙 목록**으로 검사한다.
// 검증기가 코드북 구조를 하드코딩하면 안 된다 — R1–R11 을 박아 두었다가 rev4 에서 R12 인용이 전부 무효 처리됐다(2026-10-05).

// 코드북 §4-1 적용 규칙 표의 행(「| R12 | …」)에서 R 규칙 식별자를 모은다
export function rulesFromCodebook(text) {
  return new Set((String(text ?? '').match(/^\| R(\d+) \|/gm) ?? []).map((m) => `R${m.match(/\d+/)[0]}`))
}

// decision flow 식별자(Q- · Q0–Q8 · Q4a · Q4b)는 코드북 §4 의 흐름 — 흐름 단계가 바뀌면 여기와 코드북을 함께 고친다
const FLOW = /^(Q-|Q[0-8]|Q4[ab])$/

export function makeRuleCheck(rules) {
  return (token) => FLOW.test(token) || rules.has(token)
}

// 문장에서 규칙 식별자처럼 생긴 토큰만 뽑는다 — family 글자(R · E)나 「R.inference」 같은 코드 이름, 「§6 R vs E」 인용은 식별자가 아니다
export const RULE_SCAN = /(?<![A-Za-z.])(Q-|Q\d+[a-z]?|R\d+)(?![\w.])/g

// 식별자가 하나 이상 있고, 있는 것이 모두 그 코드북의 규칙인가
export function citesValidRule(text, check) {
  const t = String(text ?? '').match(RULE_SCAN) ?? []
  return t.length > 0 && t.every((x) => check(x))
}
