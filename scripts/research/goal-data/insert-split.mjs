// scripts/research/goal-data/insert-split.mjs
//
// 삽입 문항(R-INSERT) passage 에서 주어진 문장과 나머지 본문을 분리한다 — d2-export · insert-split-audit 공용.
// 저장 passage 는 바꾸지 않는다. body 는 passage 안의 연속 부분 문자열이라 인용은 여전히 passage 원문에서 확인된다.
/** 삽입 문항: passage = [주어진 문장] + [본문 첫 부분] + ( ① ) … — 첫 문장을 주어진 문장으로 분리한다. ① 앞 문장이 하나뿐이면 경계 불확실 */
export function insertSplit(passage) {
  const text = String(passage ?? '')
  // 저장 형식 둘: 명시 표지(「[GIVEN] … [BODY]」 · 「[주어진 문장] … [본문]」, 주로 학평) · 표지 없는 접두(평가원 · 수능)
  const marked = text.match(/^\s*\[(?:GIVEN|주어진 문장)\]\s*([\s\S]+?)\s*\[(?:BODY|본문)\]\s*/)
  if (marked) return { given_sentence: marked[1].trim(), body: text.slice(marked[0].length).trim(), confidence: 'explicit_marker', rule: 'passage 의 [GIVEN]/[주어진 문장] 표지 ~ [BODY]/[본문] 표지' }
  const pre = text.split('( ①')[0].trim()
  // 문장 시작에 대괄호 · 괄호 · 따옴표가 올 수 있다(「. [A]…」 — T-0097 이 찾은 오분류)
  const sentences = pre.split(/(?<=[.!?”"’)\]])\s+(?=[A-Z“"‘'([])/)
  if (sentences.length < 2) return { given_sentence: null, body: null, confidence: 'uncertain', rule: '① 앞 문장 1개 — 주어진 문장 · 본문 경계 불확실' }
  const given = sentences[0]
  const at = text.indexOf(given)
  return { given_sentence: given, body: text.slice(at + given.length).trim(), confidence: 'first_sentence', rule: 'passage 첫 문장 = 주어진 문장(인쇄본 박스) · 나머지는 본문' }
}
