// scripts/research/goal-data/insert-split.mjs
//
// 삽입 문항(R-INSERT) passage 에서 주어진 문장을 분리한다 — d2-export · insert-split-audit 공용.
/** 삽입 문항: passage = [주어진 문장] + [본문 첫 부분] + ( ① ) … — 첫 문장을 주어진 문장으로 분리한다. ① 앞 문장이 하나뿐이면 경계 불확실 */
export function insertSplit(passage) {
  // 저장 형식 둘: 명시 표지(「[GIVEN] … [BODY]」 · 「[주어진 문장] … [본문]」, 주로 학평) · 표지 없는 접두(평가원 · 수능)
  const marked = String(passage ?? '').match(/^\s*\[(?:GIVEN|주어진 문장)\]\s*([\s\S]+?)\s*\[(?:BODY|본문)\]/)
  if (marked) return { given_sentence: marked[1].trim(), confidence: 'explicit_marker', rule: 'passage 의 [GIVEN]/[주어진 문장] 표지 ~ [BODY]/[본문] 표지' }
  const pre = String(passage ?? '').split('( ①')[0].trim()
  // 문장 시작에 대괄호 · 괄호 · 따옴표가 올 수 있다(「. [A]…」 — T-0097 이 찾은 오분류)
  const sentences = pre.split(/(?<=[.!?”"’)\]])\s+(?=[A-Z“"‘'([])/)
  if (sentences.length < 2) return { given_sentence: null, confidence: 'uncertain', rule: '① 앞 문장 1개 — 주어진 문장 · 본문 경계 불확실' }
  return { given_sentence: sentences[0], confidence: 'first_sentence', rule: 'passage 첫 문장 = 주어진 문장(인쇄본 박스) · 나머지는 본문' }
}
