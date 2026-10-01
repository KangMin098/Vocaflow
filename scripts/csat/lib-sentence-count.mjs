// scripts/csat/lib-sentence-count.mjs
//
// **평가원 해설의 「N번 문장」 번호 기준(kice-sentence-v2)** — 학습자가 문제지를 읽으며 세는 방식.
// v2(2026-10-01, Codex 리뷰): v1 은 ①~⑤ 로 시작하는 문장을 앞 문장에 붙이고(규칙 4 위반 — 기호가 경계를 «지웠다»),
// 곧은 작은따옴표 대화에 발화 설명을 붙이지 않았다. 평가원 802 지문 중 61개 분할이 바뀐다(대부분 도표·무관한 문장·어법 문항).
//
// 왜 따로 있나: 학평 근거 단위(lib-evidence-units.mjs, UNITS_VERSION 1)는 «근거 위치를 가리키는 단위» 라서
// 따옴표 안 여러 문장을 한 단위로 묶고, 안내문 목록 줄·도표 제목을 단위로 세운다. 평가원 해설 서술의 「N번 문장」 은
// 학습자가 지문에서 «N번째 문장» 을 찾는 번호이므로 사람의 셈과 같아야 한다(2026-10-01 사용자 확정 기준).
// **적용 범위: 평가원 해설 번호 대조·교정만.** 학평 근거 단위 규칙과 이미 발행된 학평 번호는 바꾸지 않는다.
//
// ── 규칙(kice-sentence-v2) ─────────────────────────────────────────────
//   1. 문장 경계: 종결부호 `.` `!` `?`(+닫는 따옴표·괄호) 뒤 공백, 다음 글자가 대문자·여는 따옴표·`(`·숫자일 때.
//      약어(Mr. Dr. e.g. i.e. U.S. a.m. p.m. No. vs. etc.)와 소수점에서는 끊지 않는다.
//   2. 대화문: 따옴표 안의 독립 문장은 **각각** 센다. 닫는 따옴표 바로 뒤에 오는 발화 설명
//      (`he said` · `Nathan asked with interest.` · `Nancy said to herself, with a long sigh.`)은
//      **앞의 인용 문장에 붙인다** — 발화 설명 = 닫는 따옴표 뒤 6낱말 안에 발화 동사가 있고 그 절이 문장으로 끝남.
//   3. 장문 단락 표지 (A)~(D)는 문장으로 세지 않는다(뒤 문장의 머리로 붙는다). 번호는 **문제지에 제시된 순서**로 잇는다.
//   4. 선지 기호 ①~⑤ 는 경계를 만들지도 지우지도 않는다(문장 안의 위치 표시일 뿐 — 종결부호 뒤 「① She …」 는 새 문장).
//      별도 선택지 영역(choices)은 세지 않는다 —
//      이 함수는 지문(passage)만 받는다.
//   5. 구두점·기호만 있는 조각(「.」 「( ① )」 등)은 문장이 아니다 — 앞 문장에 붙인다.

import crypto from 'node:crypto'

export const SENTENCE_RULE = 'kice-sentence-v2'

const ABBREV = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|Mt|vs|etc|e\.g|i\.e|U\.S|U\.K|a\.m|p\.m|No|Fig|approx|cf|Inc|Ltd|Co)\.$/
const CLOSERS = /["'’”)\]]/
// 빈칸(`______`)으로 시작하는 문장도 문장이다(연결어 빈칸 — 「______(B) , the new …」). 빠뜨리면 앞 문장에 삼켜진다(2015#34)
const STARTERS = /[A-Z0-9“"‘'(_]/
const SPEECH = /\b(?:said|says|say|asked|asks|ask|replied|replies|told|tells|answered|answers|added|adds|shouted|shouts|cried|cries|whispered|whispers|exclaimed|exclaims|explained|explains|continued|continues|called|calls|yelled|yells|muttered|mutters|sighed|sighs|wondered|wonders|thought|thinks|responded|responds|insisted|insists|urged|urges|remarked|remarks|suggested|suggests|announced|announces|screamed|screams|murmured|murmurs|laughed|laughs|smiled|smiles|protested|protests|agreed|agrees|begged|begs|pleaded|pleads|declared|declares|repeated|repeats|stated|states)\b/i
// 곧은 작은따옴표도 닫는 따옴표다 — 따옴표 모양에 따라 번호가 달라지면 안 된다(Codex 리뷰 2026-10-01)
const QUOTE_CLOSE = /[”"’']$/
// 선지 기호 ①~⑤ 는 경계를 만들지도, 지우지도 않는다 — 기호 뒤 첫 글자로 문장 시작을 판정한다
const MARKER = /^[①-⑤]\s*/

/** 경계 오프셋(다음 문장 시작) 목록 — 규칙 1·2 */
function rawCuts(p) {
  const cuts = []
  let start = 0
  for (let i = 0; i < p.length; i++) {
    const ch = p[i]
    if (ch !== '.' && ch !== '!' && ch !== '?') continue
    let j = i + 1
    while (j < p.length && CLOSERS.test(p[j])) j++
    if (j < p.length && !/\s/.test(p[j])) continue
    if (ABBREV.test(p.slice(start, j))) continue
    let k = j
    while (k < p.length && /\s/.test(p[k])) k++
    if (k >= p.length) break
    const head = p.slice(k).replace(MARKER, '')
    if (!STARTERS.test(head[0] ?? '')) continue
    // 규칙 2 — 닫는 따옴표로 끝난 인용 문장 뒤 발화 설명이면 끊지 않는다(설명이 이 문장에 붙는다)
    if (QUOTE_CLOSE.test(p.slice(i, j))) {
      const rest = p.slice(k)
      const clauseEnd = rest.search(/[.!?](?=["'’”)\]]*(\s|$))/)
      const clause = clauseEnd >= 0 ? rest.slice(0, clauseEnd) : rest
      const head = clause.split(/\s+/).slice(0, 6).join(' ')
      if (!/["“”]/.test(clause) && SPEECH.test(head)) continue
    }
    cuts.push(k)
    start = k
    i = k - 1
  }
  return cuts
}

const isContent = (s) => /[A-Za-z]{2,}/.test(s.replace(/^\s*\([A-D]\)\s*/, ''))

/**
 * @param {string} passage 지문만(선택지 영역 제외)
 * @returns {{ rule: string, sentences: { n: number, start: number, end: number, text: string }[] }}
 */
export function countSentences(passage) {
  const p = String(passage ?? '')
  const bounds = [0, ...rawCuts(p), p.length]
  const pieces = []
  for (let b = 0; b < bounds.length - 1; b++) {
    let s = bounds[b], e = bounds[b + 1]
    while (s < e && /\s/.test(p[s])) s++
    while (e > s && /\s/.test(p[e - 1])) e--
    if (s < e) pieces.push([s, e])
  }
  // 규칙 3·5 — 표지만·구두점만인 조각은 문장이 아니다: 단락 표지는 다음 조각에, 나머지는 앞 조각에 붙인다
  const merged = []
  for (let i = 0; i < pieces.length; i++) {
    const [s, e] = pieces[i]
    const text = p.slice(s, e)
    if (isContent(text)) { merged.push([s, e]); continue }
    if (/^\(?[A-D]\)?$/.test(text.trim()) && i + 1 < pieces.length) { pieces[i + 1] = [s, pieces[i + 1][1]]; continue }
    if (merged.length) merged[merged.length - 1][1] = e
    else if (i + 1 < pieces.length) pieces[i + 1] = [s, pieces[i + 1][1]]
    else merged.push([s, e])
  }
  return { rule: SENTENCE_RULE, sentences: merged.map(([s, e], i) => ({ n: i + 1, start: s, end: e, text: p.slice(s, e) })) }
}

/** 지문 해시 — 판정 기록이 «어느 지문»을 셌는지 묶는다 */
export const passageHash = (passage) => crypto.createHash('sha256').update(String(passage ?? '')).digest('hex')
