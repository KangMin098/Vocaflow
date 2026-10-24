// apps/web/src/lib/csat/content-review/answer-claims.ts
//
// **강의·해설 문장에서 「정답/오답 진술」을 선지 집합으로 읽는다(F6 보조).**
//
// 한국어 정답 진술의 꼴은 끝이 없다(「① 또는 ④」 · 「① 역시」 · 「④가 아니라 ①」 · 「오답이 아닙니다」 …).
// 그래서 이 해석기의 목표는 「모든 문장을 이해한다」가 아니라 **「이해하지 못한 부분이 하나라도 있으면
// 그 문장을 사람 확인으로 돌린다」**이다(T-0158 Codex 5차).
//   - 정답·오답을 말하는 문장 안의 **모든 선지 번호**가 아는 진술 꼴에 소비돼야 한다. 하나라도 남으면 unparsed.
//   - 「아니/아닙/아닌」은 아는 꼴(「답이 아닙니다」) 안에서만 허용한다. 그 밖의 부정은 범위를 모르므로 unparsed.
//   - unparsed 문장의 부분 해석은 버린다 — 반쯤 읽은 결과로 「충돌 없음」이나 엉뚱한 진단을 내지 않는다.
// 해석하지 못했다고 통과시키지 않는다. 옳지만 복잡한 문장도 사람이 확인한다(의도된 한계).

const KO_NUM: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }

/** 선지 하나: 「④」 또는 「사 번 · 4번」 — 원문자에는 「번」이 없어도 된다 */
const C = '(?:[①-⑤]|[일이삼사오1-5]\\s*번)'
const C_RE = /([①-⑤])|([일이삼사오1-5])\s*번/g
/** 선지 목록: 「④와 ⑤」 · 「사 번과 오 번」 · 「①, ③」 */
const LIST = `${C}(?:\\s*(?:와|과|,|및)\\s*${C})*`
const NOT = '아[니닙닌]'
/** 번호와 술어 사이: 다른 선지 번호·「정답」·부정을 넘지 않는다 */
const GAP = `(?:(?![①-⑤]|[일이삼사오1-5]\\s*번|정답|오답|${NOT})[^.。?!]){0,60}?`

/**
 * 「정답은 (오직) ④(와 ⑤)(뿐)(입니다)」 · 「정답은 삼 번.」 · 「정답은 이 번, 해치기입니다.」 · 「정답은 삼 번 자리입니다.」
 * 실제 강의의 표준 꼴이다. 번호 뒤는 문장 끝 · 쉼표 동격 · 서술어만 허용한다 — 「④가 아니라 ①」처럼 조사가 붙으면
 * 이 꼴이 아니다(동격 안에 다른 번호·부정이 있으면 남은 번호·부정 검사가 잡는다).
 */
const ANSWER_HEAD = new RegExp(`정답은\\s*(오직|바로|단|딱)?\\s*(${LIST})\\s*(하나뿐|하나|뿐|만)?(?:\\s*자리)?\\s*(?=[,.。]|$|이에요|예요|입니다|이다|이죠|죠)`, 'g')
/**
 * 「(오직) ④(와 ⑤)(만/도/가) (모두) 정답」 · 「오 번도 정답으로 인정됐어요」.
 * 뒤에 「이 아니」·「에」·「을/를」·(인정이 아닌)「으로」가 오면 이 꼴이 아니다.
 */
const ANSWER_TAIL = new RegExp(`(오직|단|딱)?\\s*(${LIST})\\s*(만이?|도|[이가은는])?\\s*(?:모두\\s*|둘\\s*다\\s*)?정답(?!\\s*이\\s*${NOT}|에|으로(?!\\s*인정)|을|를)`, 'g')
/** 「④(와 ⑤)는 오답」 · 「오 번은 … 답이 아닙니다」 · 「⑤는 정답이 아닙니다」 */
const REJECT = new RegExp(`(${LIST})\\s*(?:[은는이가도]|모두)?\\s*${GAP}(오답(?!\\s*이\\s*${NOT})|정?답이\\s*${NOT})`, 'g')
const TALKS_ANSWER = /정답|오답|답이\s*아[니닙닌]/
const ANY_NOT = new RegExp(NOT, 'g')

export interface AnswerClaim {
  choices: number[]
  /** 「오직 · 만 · 뿐 · 하나」 — 이 집합만 정답이라는 진술 */
  exclusive: boolean
  /** 「도」 — 다른 정답이 있음을 전제하는 진술 */
  inclusive: boolean
  sentence: string
}

export interface ClaimReading {
  answers: AnswerClaim[]
  rejected: number[]
  /** 정답·오답을 말하는데 전부 해석하지 못한 문장 — 부분 해석은 버렸다 */
  unparsed: string[]
}

interface Span { start: number; end: number }

function refsIn(text: string, offset = 0): { n: number; at: number }[] {
  const out: { n: number; at: number }[] = []
  for (const m of text.matchAll(C_RE)) {
    const n = KO_NUM[(m[1] ?? m[2])!] ?? Number(m[2])
    if (n >= 1 && n <= 5) out.push({ n, at: offset + m.index! })
  }
  return out
}
const uniq = (xs: number[]) => [...new Set(xs)]
const inside = (at: number, spans: Span[]) => spans.some((s) => at >= s.start && at < s.end)

export function readClaims(text: string): ClaimReading {
  const answers: AnswerClaim[] = []
  const rejected: number[] = []
  const unparsed: string[] = []
  for (const raw of text.split(/(?<=[.。?!])\s*/)) {
    const sentence = raw.trim()
    if (!sentence || !TALKS_ANSWER.test(sentence)) continue
    // 선지 번호가 없는 문장(「…맞는 진술이고, 답이 아닙니다」)의 주어는 cue target(reject:n)이 정한다 — 호출자가 따로 검사한다
    if (refsIn(sentence).length === 0) continue
    const mine: AnswerClaim[] = []
    const mineRejected: number[] = []
    const used: Span[] = [] // 진술 꼴이 소비한 구간(선지 번호·부정 포함)
    for (const m of sentence.matchAll(ANSWER_HEAD)) {
      used.push({ start: m.index!, end: m.index! + m[0].length })
      mine.push({ choices: uniq(refsIn(m[2]!).map((r) => r.n)), exclusive: !!(m[1] || m[3]), inclusive: false, sentence })
    }
    for (const m of sentence.matchAll(ANSWER_TAIL)) {
      if (inside(m.index! + m[0].length - 1, used)) continue
      used.push({ start: m.index!, end: m.index! + m[0].length })
      const particle = m[3] ?? ''
      mine.push({ choices: uniq(refsIn(m[2]!).map((r) => r.n)), exclusive: !!m[1] || particle.startsWith('만'), inclusive: particle === '도', sentence })
    }
    for (const m of sentence.matchAll(REJECT)) {
      used.push({ start: m.index!, end: m.index! + m[0].length })
      mineRejected.push(...refsIn(m[1]!).map((r) => r.n))
    }
    // 소비되지 않은 선지 번호나 부정이 남았으면 이 문장은 사람이 읽는다
    const strayRef = refsIn(sentence).some((r) => !inside(r.at, used))
    const strayNot = [...sentence.matchAll(ANY_NOT)].some((m) => !inside(m.index!, used))
    if (strayRef || strayNot || (mine.length === 0 && mineRejected.length === 0)) {
      unparsed.push(sentence)
      continue
    }
    answers.push(...mine)
    for (const n of mineRejected) if (!rejected.includes(n)) rejected.push(n)
  }
  return { answers, rejected, unparsed }
}
