// apps/web/src/lib/csat/content-review/answer-claims.ts
//
// **강의·해설 문장에서 「정답/오답 진술」을 선지 집합으로 읽는다(F6 보조).**
//
// 번호를 하나씩 뽑으면 나열(「④와 ⑤」)·배타(「오직 ④」)·포함(「⑤도」)을 구분하지 못해
// 잘못된 정답 추가·공식 정답 소거·복수정답 축소를 놓치거나, 옳은 나열을 오탐한다(T-0158 Codex 4차).
// 그래서 문장마다 **선지 목록**을 집합으로 읽고, 해석하지 못한 정답 진술은 「확인됨」이 아니라
// `unparsed` 로 돌려준다 — 호출자가 차단한다(fail-closed).

const KO_NUM: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }

/** 선지 하나: 「④」 또는 「사 번 · 4번」 — 원문자에는 「번」이 없어도 된다 */
const C = '(?:[①-⑤]|[일이삼사오1-5]\\s*번)'
const C_CAPTURE = /([①-⑤])|([일이삼사오1-5])\s*번/g
/** 선지 목록: 「④와 ⑤」 · 「사 번과 오 번」 · 「①, ③」 */
const LIST = `${C}(?:\\s*(?:와|과|,|및|그리고|하고|이랑|랑)\\s*${C})*`
const NEG = '(?!이\\s*아[니닙닌])'
/** 번호와 술어 사이: 다른 선지 번호나 「정답」을 넘지 않는다(「④가 정답이고 ⑤는 오답」의 ④를 소거로 읽지 않는다) */
const GAP = '(?:(?![①-⑤]|[일이삼사오1-5]\\s*번|정답)[^.。?!]){0,60}?'

const ANSWER_HEAD = new RegExp(`정답은\\s*(오직|바로|단|딱)?\\s*(${LIST})\\s*(하나|뿐|만)?`, 'g')
const ANSWER_TAIL = new RegExp(`(오직|단|딱)?\\s*(${LIST})\\s*(만이?|도|[이가은는])?\\s*(?:모두\\s*|둘\\s*다\\s*)?정답${NEG}`, 'g')
const REJECT = new RegExp(`(${LIST})\\s*(?:[은는이가도]|모두)?\\s*${GAP}(오답|정?답이\\s*아[니닙닌])`, 'g')
const HAS_CHOICE = new RegExp(C)

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
  /** 선지 번호와 「정답」이 함께 있는데 정답 진술로 읽지 못한 문장 */
  unparsed: string[]
}

function choicesIn(list: string): number[] {
  const out: number[] = []
  for (const m of list.matchAll(C_CAPTURE)) {
    const n = KO_NUM[(m[1] ?? m[2])!] ?? (/^[1-5]$/.test(m[2] ?? '') ? Number(m[2]) : undefined)
    if (n != null && !out.includes(n)) out.push(n)
  }
  return out
}

export function readClaims(text: string): ClaimReading {
  const answers: AnswerClaim[] = []
  const rejected: number[] = []
  const unparsed: string[] = []
  for (const sentence of text.split(/(?<=[.。?!])\s*/).filter((s) => s.trim())) {
    let found = false
    for (const m of sentence.matchAll(ANSWER_HEAD)) {
      found = true
      answers.push({ choices: choicesIn(m[2]!), exclusive: !!(m[1] || m[3]), inclusive: false, sentence })
    }
    for (const m of sentence.matchAll(ANSWER_TAIL)) {
      found = true
      const particle = m[3] ?? ''
      answers.push({
        choices: choicesIn(m[2]!),
        exclusive: !!m[1] || particle.startsWith('만'),
        inclusive: particle === '도',
        sentence,
      })
    }
    for (const m of sentence.matchAll(REJECT)) {
      found = true
      for (const n of choicesIn(m[1]!)) if (!rejected.includes(n)) rejected.push(n)
    }
    // 「정답」과 선지 번호가 같이 있는데 아무 진술도 못 읽었다 — 검증 완료로 넘기지 않는다
    if (!found && /정답/.test(sentence) && HAS_CHOICE.test(sentence) && !/정답이\s*아[니닙닌]/.test(sentence)) {
      unparsed.push(sentence.trim())
    }
  }
  return { answers, rejected, unparsed }
}
