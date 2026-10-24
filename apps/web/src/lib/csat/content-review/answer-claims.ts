// apps/web/src/lib/csat/content-review/answer-claims.ts
//
// **강의·해설 문장의 정답·오답 진술을 의미 구조로 읽는다(F6 보조).**
//
// 1~17차 독립 검증에서 「문자열 패턴 + 건너뜀 예외」 구조는 매번 새 꼴로 뚫렸다. 그래서 문장을 **절**로 나누고,
// 각 절을 [주어] [이유] [술어] 의 고정 구조로만 읽는다(사용자 지시 2026-10-24 「정답·오답 진술 처리 재설계」).
//
//   주어   = 선지 집합(「④」·「사 번」·「④와 ⑤」) + 조사·한정·추가 표지 — 또는 **비어 있음**(→ 소거 cue 의 target)
//            그 밖의 말(「다섯 번째 선택지는」·「①을 배제하면」)이 주어 자리에 오면 의미 불명확.
//   이유   = 「…라 · …서 · …니 · …므로」로 끝나는 짧은 서술. 「답」·선지 번호·숫자를 담을 수 없다.
//   술어   = 정답 긍정(정답이다 · 답이다 · 정답으로 인정) · 정답 부정(답이 아니다) · 오답 긍정(오답이다 → 정답 부정)
//            · 오답 부정(오답이 아니다 → **정답 긍정**). 술어 바로 뒤는 문장 끝 · 쉼표 · 연결(「이고·이며·고·며」)뿐.
//   앞 절  = 주어·술어 없는 이유 절(「맞는 진술이고,」·「여기 다섯 번째 문장,」)은 앞에만 올 수 있다. 마지막 절은 반드시 술어 절.
//   표제형 = 「정답은 (오직) ④(와 ⑤)(뿐)(입니다)」 · 「정답은 ①이 아닙니다」 · 「정답은 삼 번, <선지 본문 그대로>」.
//
// 구조에 맞지 않는 문장은 부분 해석을 버리고 **의미 불명확(사람 확인)** 이다 — 자동 발행하지 않는다.
// 구조에 맞는 문장은 공식 정답 집합과 대조해 자동으로 허용·차단한다(호출자 prepublish.ts).

const KO_NUM: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 }

/** 선지 하나: 「④」 또는 「사 번 · 4번」 */
const C = '(?:[①-⑤]|[일이삼사오1-5]\\s*번)'
const C_ONE = /([①-⑤])|([일이삼사오1-5])\s*번/g
/** 선지 목록: 「④와 ⑤」 · 「사 번과 오 번」 · 「①, ③」 */
const LIST = `${C}(?:\\s*(?:와|과|,|및)\\s*${C})*`
/**
 * 이유 서술 — 「답」·선지 번호·숫자·**선지를 가리키는 말**을 담지 않고 이유 연결 어미로 끝난다.
 * (「다섯 번째 선택지라 답이 아닙니다」에서 주어를 target 으로 오인하지 않게 — 지칭 어휘는 남은 한계로 보고한다)
 */
// 「다섯 번째 문장 · 두 번째 단락」 같은 **위치 설명**은 지칭이 아니다 — 「번째」 뒤가 문장·단락·줄·밑줄·칸이면 허용
const DESIGNATOR = '선지|선택지|보기|번째(?!\\s*(?:문장|단락|줄|밑줄|칸|빈칸|예시))|첫째|둘째|셋째|넷째|다섯째|마지막|맨\\s*(?:앞|뒤|끝)'
const REASON_BODY = `(?:(?!답|[①-⑤]|[일이삼사오1-5]\\s*번|\\p{N}|${DESIGNATOR})[^,.。?!])*?`
const REASON_END = '(?:이라서|라서|아서|어서|여서|해서|이라|라|서|으니까|니까|으니|니|므로|기에|고|며)'
/** 문장 종결·연결 */
const COPULA = '(?:입니다|이에요|예요|이다|이죠|이고|이며)?'
/** 술어 뒤: 문장 끝·쉼표, 또는 연결 어미(「이고 · 이며 · 니고 · 니며」) 다음 띄어쓰기로 다음 절이 이어짐 */
const TAIL = '(?:(?<=이고|이며|니고|니며)\\s+|(?=\\s*(?:[,.。!]|$)))'

/** 술어(절 끝). 그룹 이름으로 의미를 가른다 */
const PRED = [
  '(?<wneg>오답이\\s*아(?:닙니다|니에요|니다|니죠|니고|니며))',
  '(?<aneg>정?답이\\s*아(?:닙니다|니에요|니다|니죠|니고|니며))',
  '(?<wpos>오답(?:입니다|이에요|예요|이다|이죠|이고|이며)?)',
  '(?<apos>(?:모두\\s*|둘\\s*다\\s*)?(?:정답(?:\\s*으로\\s*인정(?:됐어요|되었습니다|됐습니다|됩니다|된다|돼요))?(?:입니다|이에요|예요|이다|이죠|이고|이며)?|답(?:입니다|이에요|예요|이다|이죠|이고|이며)))',
].join('|')

/** 술어 절: [한정]? [선지 목록 + 조사·표지]? [이유]? 술어 */
const PRED_CLAUSE = new RegExp(
  `^\\s*(?<only>오직|단|딱)?\\s*(?:(?<list>${LIST})\\s*(?<part>만이|만|은|는|이|가|도)?\\s*(?<also>역시|또한)?\\s+)?` +
  `(?:${REASON_BODY}${REASON_END}\\s+)?(?:${PRED})${TAIL}`,
  'u',
)
/** 표제형: 「정답은 (오직) ④(와 ⑤)(하나|뿐)(자리)(입니다)」 */
const HEAD_CLAUSE = new RegExp(`^\\s*정답은\\s*(?<only>오직|바로|단|딱)?\\s*(?<list>${LIST})\\s*(?<lim>하나뿐|하나|뿐|만)?(?:\\s*자리)?\\s*${COPULA}${TAIL}`, 'u')
/** 표제 부정형: 「정답은 ①이 아닙니다」 */
const HEAD_NEG = new RegExp(`^\\s*정답은\\s*(?<list>${LIST})\\s*[이가]\\s*아(?:닙니다|니에요|니다|니죠)${TAIL}`, 'u')
/** 표제형 뒤 위치 설명 동격: 「, 비 밑줄입니다」·「, 다섯 번째 문장입니다」·「, 밑줄 씨」·「, 자리입니다」 */
const POSITION_APPOSITION = /^\s*,\s*(?:(?:첫|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*번째\s*(?:문장|단락|줄|밑줄|칸)|비\s*밑줄|밑줄(?:\s*씨)?|자리)\s*(?:입니다|이에요|예요|이다)?\s*$/
/** 해설 화면 UI 안내 — 이 꼴 그대로일 때만 진술이 아니다 */
const UI_GUIDE = /^\s*(?:(?:그래서|이제|여기서|여러분)\s*,?\s*)?정답\s*블록을\s*(?:확인하세요|확인해\s*보세요|보세요|봅시다|봐요|열어\s*보세요)\s*[.。!]?\s*$/
/** 이유 절(앞에만): 주어·술어 없는 서술 + 쉼표 또는 이유·연결 어미 */
const REASON_CLAUSE = new RegExp(`^\\s*${REASON_BODY}(?:,|${REASON_END}\\s*,)`, 'u')

export type Polarity = 'answer' | 'notAnswer'

export interface AnswerClaim {
  choices: number[]
  /** 「오직 · 만 · 뿐 · 하나」 — 이 집합만 정답이라는 진술 */
  exclusive: boolean
  /** 「도 · 역시 · 또한」 — 다른 정답이 있음을 전제하는 진술 */
  inclusive: boolean
  /** 주어가 비어 cue target 으로 정해졌는가 */
  implicit: boolean
  sentence: string
}

export interface ClaimReading {
  answers: AnswerClaim[]
  rejected: number[]
  /** 구조에 맞지 않아 의미가 불명확한 문장 — 부분 해석은 버렸다(사람 확인) */
  unparsed: string[]
}

export interface ClaimContext {
  /** 선지 본문(①~⑤ 순) — 표제형 동격 대조 */
  choices?: readonly string[]
  /** 소거 cue 의 대상 선지(target reject:n) — 주어 없는 술어 절의 주어 */
  rejectTarget?: number
}

function choicesIn(list: string): number[] {
  const out: number[] = []
  for (const m of list.matchAll(C_ONE)) {
    const n = KO_NUM[(m[1] ?? m[2])!] ?? Number(m[2])
    if (n >= 1 && n <= 5 && !out.includes(n)) out.push(n)
  }
  return out
}

/** 번호 표기 변형을 ①~⑤ 로(❶ · ➀ · ➊ · ⓵ · ⑴ · ⒈ · 전각 １ — 12차). 그 밖의 숫자 문자는 구조 밖이라 의미 불명확으로 떨어진다 */
const NUMBER_VARIANTS: readonly (readonly string[])[] = [
  ['❶', '❷', '❸', '❹', '❺'], ['➀', '➁', '➂', '➃', '➄'], ['➊', '➋', '➌', '➍', '➎'],
  ['⓵', '⓶', '⓷', '⓸', '⓹'], ['⑴', '⑵', '⑶', '⑷', '⑸'], ['⒈', '⒉', '⒊', '⒋', '⒌'], ['１', '２', '３', '４', '５'],
]
const CIRCLED = ['①', '②', '③', '④', '⑤']
function canonicalNumbers(text: string): string {
  let t = text
  for (const set of NUMBER_VARIANTS) set.forEach((ch, i) => { t = t.split(ch).join(CIRCLED[i]!) })
  return t
}

const norm = (t: string) => t.replace(/^[①-⑤]\s*/, '').replace(/[\s.,。!]+/g, '').replace(/(?:입니다|이에요|예요|이다|이죠|죠)$/, '')

interface Parsed { claims: { polarity: Polarity; claim: AnswerClaim }[] }

/** 한 문장을 절 구조로 끝까지 읽는다. 하나라도 구조에 안 맞으면 null(의미 불명확) */
function parseSentence(sentence: string, ctx: ClaimContext): Parsed | null {
  const claims: Parsed['claims'] = []
  // 문장 첫머리 담화 표지 하나(「그래서 정답은 일 번입니다」) — 뜻을 바꾸지 않는다
  let rest = sentence.replace(/[.。!]\s*$/, '').replace(/^\s*(?:그래서|따라서|즉|결국|여러분|자|여기서)\s*,?\s+/, '')
  let sawPredicate = false
  let lastSubject: number[] | null = null
  while (rest.trim() !== '') {
    // 표제형
    const head = HEAD_CLAUSE.exec(rest)
    if (head) {
      const choices = choicesIn(head.groups!.list!)
      lastSubject = choices // 「정답은 ⑤이고 답이 아닙니다」 — 뒤 절 생략 주어도 ⑤
      claims.push({ polarity: 'answer', claim: { choices, exclusive: !!(head.groups!.only || head.groups!.lim), inclusive: false, implicit: false, sentence } })
      rest = rest.slice(head[0].length)
      sawPredicate = true
      // 「정답은 이 번, 비 밑줄입니다」·「정답은 삼 번, 다섯 번째 문장입니다」 — 위치 설명 동격
      if (POSITION_APPOSITION.test(rest)) { rest = ''; break }
      // 「정답은 삼 번, <선지 본문 그대로>」 — 동격은 그 선지 본문과 **정확히** 같을 때만(9차)
      const app = /^\s*,\s*(.+)$/.exec(rest)
      if (app && choices.length === 1) {
        const c = ctx.choices?.[choices[0]! - 1]
        if (c != null && norm(c) === norm(app[1]!) && norm(c).length > 0) { rest = ''; break }
      }
      rest = rest.replace(/^\s*,?\s*/, '')
      continue
    }
    const headNeg = HEAD_NEG.exec(rest)
    if (headNeg) {
      lastSubject = choicesIn(headNeg.groups!.list!)
      claims.push({ polarity: 'notAnswer', claim: { choices: lastSubject, exclusive: false, inclusive: false, implicit: false, sentence } })
      rest = rest.slice(headNeg[0].length).replace(/^\s*,?\s*/, '')
      sawPredicate = true
      continue
    }
    const pc = PRED_CLAUSE.exec(rest)
    if (pc) {
      const g = pc.groups!
      let choices: number[]
      let implicit = false
      // 생략 주어는 **같은 문장 앞 절의 주어를 이어받는다**(「⑤는 정답이고 답이 아닙니다」의 뒤 절 주어는 ⑤ — 19차 P1).
      // cue target 은 문장에 명시된 주어가 하나도 없을 때만 쓴다.
      if (g.list) { choices = choicesIn(g.list); lastSubject = choices }
      else if (lastSubject) choices = lastSubject
      else if (ctx.rejectTarget != null) { choices = [ctx.rejectTarget]; implicit = true }
      else return null // 주어가 없고 cue target 도 소거가 아니면 누구에 대한 진술인지 모른다
      const polarity: Polarity = g.apos || g.wneg ? 'answer' : 'notAnswer'
      const part = g.part ?? ''
      claims.push({
        polarity,
        claim: {
          choices,
          exclusive: !!g.only || part.startsWith('만'),
          inclusive: part === '도' || !!g.also,
          implicit,
          sentence,
        },
      })
      rest = rest.slice(pc[0].length).replace(/^\s*,?\s*/, '')
      sawPredicate = true
      continue
    }
    // 이유 절은 술어 절 **앞**에만 — 술어 뒤에 붙은 서술(「…정답이고 이는 오류입니다」)은 의미 불명확
    const rc = sawPredicate ? null : REASON_CLAUSE.exec(rest)
    if (rc) { rest = rest.slice(rc[0].length); continue }
    return null
  }
  if (!sawPredicate) return null
  // 한 문장 안에서 같은 선지를 정답이라고도, 정답이 아니라고도 하면 모순 — 의미 불명확(「⑤는 정답이고 오답입니다」)
  const yes = new Set(claims.filter((c) => c.polarity === 'answer').flatMap((c) => c.claim.choices))
  if (claims.some((c) => c.polarity === 'notAnswer' && c.claim.choices.some((n) => yes.has(n)))) return null
  return { claims }
}

export function readClaims(rawText: string, ctx: ClaimContext = {}): ClaimReading {
  const text = canonicalNumbers(rawText)
  const answers: AnswerClaim[] = []
  const rejected: number[] = []
  const unparsed: string[] = []
  // 문장 밖에서 앞 진술을 뒤집는 응답(「④가 정답이죠? 아니요, ①입니다.」) — 문장 단위로는 못 읽는다
  if (/아니요|아뇨/.test(text) && /답/.test(text)) return { answers: [], rejected: [], unparsed: [text.trim()] }
  for (const raw of text.split(/(?<=[.。?!])\s*/)) {
    const sentence = raw.trim()
    if (!sentence) continue
    // UI 안내는 **정확한 꼴**만 진술이 아니다(「정답 블록을 확인하세요 · 보세요」). 「정답 블록에는 첫 번째 선택지만 들어갑니다」처럼
    // 블록 이름에 선택지를 붙이면 일반 검사로 간다(18차 P1 — 블록 이름 예외가 정답 지정·배제를 건너뛰었다)
    if (UI_GUIDE.test(sentence)) continue
    // 정답과 무관한 「답」 낱말(대답 · 답하다 · 보답 · 응답 · 답장 · 답변)을 빼고도 「답」이 없으면 진술이 아니다
    const gate = sentence.replace(/대답|답하|답해|답했|답한|답할|보답|응답|답장|답변/g, '')
    if (!/답/.test(gate)) continue
    // 물음은 단언이 아니다
    if (/[?？]\s*$/.test(sentence)) { unparsed.push(sentence); continue }
    const parsed = parseSentence(sentence, ctx)
    if (!parsed) { unparsed.push(sentence); continue }
    for (const { polarity, claim } of parsed.claims) {
      if (polarity === 'answer') answers.push(claim)
      else for (const n of claim.choices) if (!rejected.includes(n)) rejected.push(n)
    }
  }
  return { answers, rejected, unparsed }
}
